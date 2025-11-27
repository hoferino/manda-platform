# Story 3.4: Generate Embeddings for Semantic Search

Status: done

## Story

As a **platform developer**,
I want **a job handler that generates vector embeddings for parsed document chunks**,
so that **users can perform semantic similarity search across all uploaded documents to find relevant information quickly**.

## Acceptance Criteria

1. **AC1: Embedding Job Handler Created**
   - `generate_embeddings` job handler exists in `manda-processing/src/jobs/handlers/`
   - Handler is registered with pg-boss job queue
   - Handler invoked automatically when `parse_document` job completes successfully
   - Handler logs job lifecycle events (started, completed, failed)

2. **AC2: OpenAI Embeddings Integration**
   - Use `text-embedding-3-large` model (3072 dimensions)
   - Batch API calls to respect rate limits (max 100 texts per request)
   - Handle API errors with retry logic (3 attempts with exponential backoff)
   - Track token usage for cost monitoring

3. **AC3: Embedding Storage**
   - Embedding vectors stored in `document_chunks.embedding` column (pgvector)
   - Update happens within transaction (all-or-nothing for a document)
   - Document status updated to `embedded` on completion
   - Handle partial failures gracefully (retry individual chunks if needed)

4. **AC4: Similarity Search**
   - API endpoint for vector similarity search: `GET /api/search/similar`
   - Search accepts query text and returns top-K most similar chunks
   - Results include: chunk_id, document_id, content preview, similarity score
   - Support filtering by project_id and document_id

5. **AC5: Job Queue Flow**
   - Job enqueued automatically after `parse_document` completes (already done in E3.3)
   - On success, next job (`analyze_document`) is enqueued
   - On failure, job marked failed with error details
   - Document status updated to `embedding_failed` on permanent failure

6. **AC6: Tests Pass**
   - Unit tests for embedding generation logic
   - Unit tests for OpenAI client with mocked responses
   - Integration tests for full embedding flow
   - Similarity search API tests
   - Minimum 80% coverage on new handler code

## Tasks / Subtasks

- [x] **Task 1: Create Embedding Client Module** (AC: 2)
  - [x] Create `src/embeddings/__init__.py` module structure
  - [x] Implement `OpenAIEmbeddingClient` class in `src/embeddings/openai_client.py`
  - [x] Add batching logic (chunk texts into groups of 100)
  - [x] Implement retry with exponential backoff using `tenacity`
  - [x] Add token counting for cost tracking using `tiktoken`
  - [x] Create embedding client singleton factory

- [x] **Task 2: Create Embedding Job Handler** (AC: 1, 5)
  - [x] Create `src/jobs/handlers/generate_embeddings.py`
  - [x] Implement `GenerateEmbeddingsHandler` class
  - [x] Load chunks from database by document_id
  - [x] Call OpenAI embedding client in batches
  - [x] Store embeddings back to document_chunks table
  - [x] Update document processing_status to "embedded"
  - [x] Enqueue next job (`analyze_document`) on success
  - [x] Register handler in `src/jobs/handlers/__init__.py`

- [x] **Task 3: Implement Database Operations** (AC: 3)
  - [x] Add `get_chunks_by_document()` method to SupabaseClient
  - [x] Add `update_chunk_embeddings()` method to SupabaseClient
  - [x] Add `update_embeddings_and_status()` for atomic operations
  - [x] Add `search_similar_chunks()` for pgvector similarity search
  - [x] Handle pgvector format conversion (list → vector string)

- [x] **Task 4: Implement Similarity Search API** (AC: 4)
  - [x] Create `src/api/routes/search.py`
  - [x] Implement `GET /api/search/similar` endpoint
  - [x] Add query embedding generation via OpenAI client
  - [x] Implement pgvector cosine similarity search
  - [x] Add filtering by project_id, document_id
  - [x] Return ranked results with similarity scores
  - [x] Register router in main.py

- [x] **Task 5: Add Configuration** (AC: 2)
  - [x] Add `OPENAI_API_KEY` to config.py
  - [x] Add `EMBEDDING_MODEL` setting (default: text-embedding-3-large)
  - [x] Add `EMBEDDING_BATCH_SIZE` setting (default: 100)
  - [x] Add `EMBEDDING_DIMENSIONS` setting (default: 3072)
  - [x] Update `.env.example` with new variables

- [x] **Task 6: Write Tests** (AC: 6)
  - [x] Unit tests for `OpenAIEmbeddingClient` with mocked OpenAI (13 tests)
  - [x] Unit tests for batch processing logic
  - [x] Unit tests for `GenerateEmbeddingsHandler` (12 tests)
  - [x] API tests for similarity search endpoint (12 tests)
  - [x] Verify 80% coverage target on new code (achieved 86%)

## Dev Notes

### Architecture Patterns

**Embedding Client Pattern:**
```python
# src/embeddings/openai_client.py
from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

class OpenAIEmbeddingClient:
    """Generate embeddings using OpenAI text-embedding-3-large."""

    def __init__(self, api_key: str, model: str = "text-embedding-3-large"):
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = model
        self.dimensions = 3072

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=60))
    async def generate_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a batch of texts."""
        response = await self.client.embeddings.create(
            model=self.model,
            input=texts,
            dimensions=self.dimensions
        )
        return [item.embedding for item in response.data]
```

**Job Handler Pattern:**
```python
# src/jobs/handlers/generate_embeddings.py
class GenerateEmbeddingsHandler:
    """Handle generate_embeddings jobs from pg-boss queue."""

    async def handle(self, job: Job) -> dict:
        document_id = UUID(job.data["document_id"])

        # Load chunks
        chunks = await self.db.get_chunks_by_document(document_id)

        # Generate embeddings in batches
        texts = [chunk["content"] for chunk in chunks]
        embeddings = await self._generate_in_batches(texts)

        # Store embeddings
        await self.db.update_chunk_embeddings(document_id, chunks, embeddings)

        # Update status and enqueue next job
        await self.db.update_document_status(document_id, "embedded")
        await self._enqueue_next_job(document_id)

        return {"success": True, "chunks_embedded": len(chunks)}
```

**Similarity Search Query:**
```sql
-- pgvector cosine similarity search
SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.chunk_type,
    1 - (dc.embedding <=> $1::vector) as similarity
FROM document_chunks dc
JOIN documents d ON dc.document_id = d.id
WHERE d.project_id = $2
ORDER BY dc.embedding <=> $1::vector
LIMIT $3;
```

### Database Considerations

**pgvector Index (from E3.3 migration):**
```sql
-- Already created in 00015_create_document_chunks_table.sql
CREATE INDEX idx_chunks_embedding ON document_chunks
    USING ivfflat (embedding vector_cosine_ops);
```

**Batch Update Pattern:**
```python
async def update_chunk_embeddings(
    self,
    document_id: UUID,
    chunk_ids: list[UUID],
    embeddings: list[list[float]]
) -> int:
    """Update embeddings for multiple chunks in one transaction."""
    async with self.pool.acquire() as conn:
        async with conn.transaction():
            for chunk_id, embedding in zip(chunk_ids, embeddings):
                await conn.execute(
                    """
                    UPDATE document_chunks
                    SET embedding = $1::vector
                    WHERE id = $2 AND document_id = $3
                    """,
                    embedding, chunk_id, document_id
                )
    return len(chunk_ids)
```

### Error Handling Strategy

| Error Type | Action | Retry? |
|------------|--------|--------|
| OpenAI rate limit (429) | Log, retry with backoff | Yes (3x) |
| OpenAI API error (500) | Log, retry with backoff | Yes (3x) |
| OpenAI invalid request (400) | Log, fail permanently | No |
| Database connection error | Log, retry | Yes (3x) |
| Chunk not found | Log, skip chunk | Partial |

### Performance Considerations

- **Batch Size**: 100 texts per OpenAI API call (API limit)
- **Concurrency**: Process documents one at a time to avoid rate limits
- **Token Tracking**: ~8000 tokens per batch → ~$0.0008 per batch
- **Estimated Cost**: ~$0.01 per 50-page document

### Project Structure Notes

**Files to Create:**
```
manda-processing/src/
├── embeddings/
│   ├── __init__.py
│   └── openai_client.py      # OpenAI embedding client
├── jobs/handlers/
│   └── generate_embeddings.py # This story's handler
└── api/routes/
    └── search.py              # Similarity search API
```

**Dependencies to Add (pyproject.toml):**
```toml
"openai>=1.82.0",  # Already in tech spec
"numpy>=2.2.0",    # Already in tech spec
```

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E3.md#E3.4-Embedding-Generation]
- [Source: docs/sprint-artifacts/tech-spec-epic-E3.md#Data-Models-and-Contracts]
- [Source: docs/sprint-artifacts/tech-spec-epic-E3.md#APIs-and-Interfaces]
- [Source: docs/manda-architecture.md#Vector-Search-Architecture]

### Learnings from Previous Story

**From Story e3-3 (Status: done)**

- **Storage Client Pattern**: `SupabaseClient` at `src/storage/supabase_client.py` provides database operations
  - Use `store_chunks_and_update_status()` pattern for atomic operations
  - Use `asyncpg` pool via `get_pool()` for direct database access
- **Job Handler Pattern**: `ParseDocumentHandler` at `src/jobs/handlers/parse_document.py` shows handler structure
  - Use `Job` dataclass from `src/jobs/queue.py`
  - Use lazy imports to avoid circular dependencies in tests
- **Job Queue Integration**: Handler registered in `src/jobs/worker.py` via `setup_default_handlers()`
  - Job name: `document-parse` → next job: `generate-embeddings`
- **Webhook Flow**: `/webhooks/document-uploaded` triggers parse → embed → analyze chain
- **Test Patterns**: Mock external services (GCS, DB) in unit tests
  - Use `pytest.fixture` with `MagicMock` and `AsyncMock`
  - Coverage target: 80%+ (E3.3 achieved 84%)

**Key Integration Points:**
- Import from E3.3: `from src.storage.supabase_client import SupabaseClient, get_supabase_client`
- Import job queue: `from src.jobs.queue import Job, get_job_queue`
- Import settings: `from src.config import Settings, get_settings`
- Follow async patterns: All handlers and clients are async

[Source: stories/e3-3-implement-document-parsing-job-handler.md#Dev-Agent-Record]

## Dev Agent Record

### Context Reference

- [e3-4-generate-embeddings-for-semantic-search.context.xml](e3-4-generate-embeddings-for-semantic-search.context.xml)

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- All 6 tasks completed successfully
- 37 unit tests passing with 86% coverage (exceeds 80% target)
- OpenAI embedding client with batching, retry logic, and token counting
- Job handler integrates into parse → embed → analyze pipeline
- Similarity search API with filtering and ranked results
- Database migration updates embedding column to 3072 dimensions

### File List

**Created:**
- `manda-app/supabase/migrations/00016_update_embedding_dimension.sql` - Migration to update vector dimensions
- `manda-processing/src/embeddings/__init__.py` - Module exports
- `manda-processing/src/embeddings/openai_client.py` - OpenAI embedding client
- `manda-processing/src/jobs/handlers/generate_embeddings.py` - Job handler
- `manda-processing/src/api/routes/search.py` - Similarity search API
- `manda-processing/tests/unit/test_embeddings/__init__.py` - Test module
- `manda-processing/tests/unit/test_embeddings/test_openai_client.py` - Embedding client tests (13 tests)
- `manda-processing/tests/unit/test_jobs/test_generate_embeddings.py` - Handler tests (12 tests)
- `manda-processing/tests/unit/test_api/test_search.py` - Search API tests (12 tests)

**Modified:**
- `manda-processing/src/config.py` - Added OpenAI embedding settings
- `manda-processing/pyproject.toml` - Added openai dependency
- `manda-processing/.env.example` - Added OpenAI environment variables
- `manda-processing/src/storage/supabase_client.py` - Added 4 new methods for embedding operations
- `manda-processing/src/jobs/handlers/__init__.py` - Registered generate_embeddings handler
- `manda-processing/src/jobs/worker.py` - Registered handler in setup_default_handlers
- `manda-processing/src/main.py` - Registered search router

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-27 | Story drafted | SM Agent |
| 2025-11-27 | Story implemented | Dev Agent (Claude Opus 4.5) |
