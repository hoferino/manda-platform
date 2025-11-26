# Story 3.3: Implement Document Parsing Job Handler

Status: drafted

## Story

As a **platform developer**,
I want **a job handler that processes uploaded documents through the parsing pipeline**,
so that **documents are automatically parsed when uploaded, with results stored in the database for downstream processing**.

## Acceptance Criteria

1. **AC1: Job Handler Created**
   - `parse_document` job handler exists in `manda-processing/src/jobs/handlers/`
   - Handler is registered with pg-boss job queue
   - Handler invoked automatically when job is enqueued
   - Handler logs job lifecycle events (started, completed, failed)

2. **AC2: GCS File Download**
   - Handler downloads document from GCS using `gcs_path` from job payload
   - File downloaded to secure temporary location
   - Temporary files cleaned up after processing
   - Download errors handled gracefully with retry

3. **AC3: Parser Integration**
   - Handler invokes `DocumentParser` from E3.2 with downloaded file
   - Correct parser selected based on `file_type` in payload
   - `ParseResult` (chunks, tables, formulas) captured successfully
   - Parse errors handled and logged appropriately

4. **AC4: Database Storage**
   - Parsed chunks stored in `document_chunks` table
   - Tables stored in `document_tables` table (if exists) or as chunks
   - Chunk metadata includes: page_number, sheet_name, cell_reference, chunk_type
   - Document record updated: `processing_status = "parsed"`
   - All database operations are transactional

5. **AC5: Job Queue Integration**
   - On success, next job (`generate_embeddings`) is enqueued
   - On failure, job marked failed with error details
   - Retry logic: 3 attempts with exponential backoff (0s, 30s, 90s)
   - `document_parsed` event emitted on successful completion

6. **AC6: Tests Pass**
   - Unit tests for job handler logic
   - Integration tests for full parse flow (mock GCS)
   - Error scenario tests (download fail, parse fail, DB fail)
   - Minimum 80% coverage on new handler code

## Tasks / Subtasks

- [ ] **Task 1: Create Job Handler Module Structure** (AC: 1)
  - [ ] Create `src/jobs/handlers/parse_document.py`
  - [ ] Define `ParseDocumentHandler` class
  - [ ] Implement job handler interface matching pg-boss pattern
  - [ ] Add structured logging throughout handler lifecycle
  - [ ] Register handler in `src/jobs/handlers/__init__.py`

- [ ] **Task 2: Implement GCS Download** (AC: 2)
  - [ ] Use existing `gcs_client` from `src/storage/` or create if missing
  - [ ] Implement `download_to_temp()` method
  - [ ] Use Python `tempfile` for secure temporary storage
  - [ ] Implement cleanup in `finally` block or context manager
  - [ ] Add retry logic for transient GCS errors (3 attempts)

- [ ] **Task 3: Integrate Document Parser** (AC: 3)
  - [ ] Import `DocumentParser` from `src/parsers/`
  - [ ] Initialize parser with config from E3.2
  - [ ] Call `parser.parse(file_path, file_type)`
  - [ ] Handle `ParseError` exceptions appropriately
  - [ ] Log parse duration and chunk count

- [ ] **Task 4: Implement Database Storage** (AC: 4)
  - [ ] Create `document_chunks` table if not exists (migration)
  - [ ] Implement `store_chunks()` method using Supabase client
  - [ ] Map `ChunkData` to database columns
  - [ ] Update `documents.processing_status` to "parsed"
  - [ ] Wrap all writes in transaction for atomicity
  - [ ] Handle duplicate chunk inserts (upsert or skip)

- [ ] **Task 5: Implement Job Queue Flow** (AC: 5)
  - [ ] Enqueue `generate_embeddings` job on success
  - [ ] Configure pg-boss retry options: `retryLimit=3, retryDelay=30`
  - [ ] Mark job failed with error message on permanent failure
  - [ ] Emit `document_parsed` event via Supabase Realtime or custom pub/sub
  - [ ] Update document status to "failed" on permanent failure

- [ ] **Task 6: Write Tests** (AC: 6)
  - [ ] Unit tests for `ParseDocumentHandler` class methods
  - [ ] Unit tests for GCS download with mocked client
  - [ ] Unit tests for database storage with mocked Supabase
  - [ ] Integration test: full handler flow with mocked external services
  - [ ] Error scenario tests: GCS timeout, parse failure, DB error
  - [ ] Verify 80% coverage target on handler code

- [ ] **Task 7: Add Webhook Trigger** (AC: 1, 5)
  - [ ] Verify `/webhooks/document-uploaded` endpoint triggers job
  - [ ] Add test for webhook → job enqueue flow
  - [ ] Document webhook configuration in Supabase

## Dev Notes

### Architecture Patterns

**Job Handler Pattern:**
```python
# src/jobs/handlers/parse_document.py
from src.jobs.queue import JobHandler, JobResult
from src.parsers import DocumentParser, ParseResult
from src.storage.gcs_client import GCSClient
from src.storage.supabase_client import SupabaseClient

class ParseDocumentHandler(JobHandler):
    """Handle parse_document jobs from pg-boss queue."""

    job_name = "parse_document"

    def __init__(self, gcs: GCSClient, db: SupabaseClient, parser: DocumentParser):
        self.gcs = gcs
        self.db = db
        self.parser = parser

    async def handle(self, job_data: dict) -> JobResult:
        document_id = job_data["document_id"]
        gcs_path = job_data["gcs_path"]
        file_type = job_data["file_type"]

        # Download from GCS
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            await self.gcs.download(gcs_path, tmp.name)
            try:
                # Parse document
                result = await self.parser.parse(Path(tmp.name), file_type)

                # Store results
                await self._store_results(document_id, result)

                # Update status
                await self.db.update_document_status(document_id, "parsed")

                # Enqueue next job
                await self.enqueue_next("generate_embeddings", {"document_id": document_id})

                return JobResult.success()
            finally:
                os.unlink(tmp.name)
```

**Job Payload Schema:**
```python
class ParseDocumentPayload(BaseModel):
    document_id: UUID
    project_id: UUID
    gcs_path: str  # gs://bucket/path/to/file
    file_type: str  # xlsx, pdf, docx
```

### Database Considerations

**document_chunks table (from tech spec):**
```sql
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    chunk_type TEXT NOT NULL DEFAULT 'text',
    metadata JSONB DEFAULT '{}',
    page_number INTEGER,
    sheet_name TEXT,
    cell_reference TEXT,
    embedding vector(3072),  -- populated by E3.4
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_chunk_per_document UNIQUE (document_id, chunk_index)
);
```

### Error Handling Strategy

| Error Type | Action | Retry? |
|------------|--------|--------|
| GCS download timeout | Log, retry | Yes (3x) |
| GCS file not found | Log, fail permanently | No |
| Parse error (corrupt file) | Log, fail permanently | No |
| Parse error (unsupported type) | Log, fail permanently | No |
| Database connection error | Log, retry | Yes (3x) |
| Database constraint violation | Log, fail permanently | No |

### Project Structure Notes

**Files to Create:**
```
manda-processing/src/jobs/handlers/
├── __init__.py           # Register handlers
├── parse_document.py     # This story's handler
└── base.py               # Base handler if needed
```

**Dependencies from E3.1 and E3.2:**
- `src/jobs/queue.py` - pg-boss queue wrapper (E3.1)
- `src/parsers/__init__.py` - DocumentParser interface (E3.2)
- `src/storage/gcs_client.py` - GCS download (create or enhance)
- `src/storage/supabase_client.py` - Database operations (create or enhance)

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E3.md#Workflows-and-Sequencing]
- [Source: docs/sprint-artifacts/tech-spec-epic-E3.md#Data-Models-and-Contracts]
- [Source: docs/epics.md#Story-E3.3]
- [Source: docs/manda-architecture.md#Document-Processing-Flow]

### Learnings from Previous Story

**From Story e3-2 (Status: done)**

- **Parser Interface Created**: `DocumentParser` protocol available at `src/parsers/__init__.py`
  - Use `ParseResult` model with `chunks`, `tables`, `formulas` fields
  - Use `ChunkData` for individual chunks with `chunk_type`, `page_number`, `sheet_name`, `cell_reference`
- **Parser Implementation**: `DoclingParser` at `src/parsers/docling_parser.py` handles Excel, PDF, Word
- **Excel Parser**: `src/parsers/excel_parser.py` preserves formulas as text
- **Chunking**: `src/parsers/chunker.py` implements 512-1024 token chunking with semantic boundaries
- **Test Patterns**: Follow test structure in `tests/unit/test_parsers/` with fixtures in `tests/conftest.py`
- **Coverage**: Target 80%+ coverage (e3-2 achieved 87-96%)
- **Skip Pattern**: Tests skip gracefully when optional dependencies not installed

**Key Integration Points:**
- Import parsers: `from src.parsers import DocumentParser, DoclingParser, ParseResult`
- Parser config: Use settings from `src/config.py` parser section
- Follow async patterns established in E3.1 and E3.2

[Source: stories/e3-2-integrate-docling-for-document-parsing.md#Dev-Agent-Record]

## Dev Agent Record

### Context Reference

- [e3-3-implement-document-parsing-job-handler.context.xml](e3-3-implement-document-parsing-job-handler.context.xml)

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-26 | Story drafted | SM Agent |
