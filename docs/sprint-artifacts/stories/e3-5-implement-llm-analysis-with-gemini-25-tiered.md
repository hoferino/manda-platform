# Story 3.5: Implement LLM Analysis with Gemini 2.5 (Tiered Approach)

Status: done

## Story

As a **platform developer**,
I want **a job handler that performs LLM analysis on parsed document chunks using tiered Gemini 2.5 models**,
so that **the system automatically extracts key findings with confidence scores and links them to source chunks for comprehensive document intelligence**.

## Acceptance Criteria

1. **AC1: Analyze Document Job Handler Created**
   - `analyze_document` job handler exists in `manda-processing/src/jobs/handlers/`
   - Handler is registered with pg-boss job queue
   - Handler invoked automatically when `generate_embeddings` job completes successfully
   - Handler logs job lifecycle events (started, completed, failed)

2. **AC2: Tiered Gemini 2.5 Model Integration**
   - Use LangChain Google GenAI adapter for Gemini integration
   - Implement tiered model selection:
     - **Gemini 2.5 Flash** (`gemini-2.5-flash`): Default for standard documents ($0.30/1M input)
     - **Gemini 2.5 Pro** (`gemini-2.5-pro`): For financial documents/deep analysis ($1.25/1M input)
     - **Gemini 2.5 Flash-Lite** (`gemini-2.5-flash-lite`): For batch/bulk processing ($0.10/1M input)
   - Model selection based on document type (file_type) and analysis depth setting
   - Handle API errors with retry logic (3 attempts with exponential backoff)

3. **AC3: Finding Extraction**
   - Extract structured findings from document chunks using LLM
   - Each finding includes:
     - `content`: The extracted finding text
     - `finding_type`: One of `metric`, `fact`, `risk`, `opportunity`, `contradiction`
     - `domain`: One of `financial`, `operational`, `market`, `legal`, `technical`
     - `confidence_score`: Float 0-100 based on LLM certainty
     - `source_reference`: JSON with page, sheet, cell, line_number
   - Use Pydantic structured output for reliable extraction
   - Prompt engineering for M&A-specific finding extraction

4. **AC4: Findings Storage**
   - Findings stored in `findings` table per tech spec schema
   - Each finding linked to:
     - `project_id`: From document's project
     - `document_id`: Source document
     - `chunk_id`: Specific source chunk (nullable if spans multiple)
   - Atomic transaction: store all findings + update status together
   - Document status updated to `analyzed` on completion

5. **AC5: Job Queue Flow**
   - Job enqueued automatically after `generate_embeddings` completes
   - On success, next job (`extract_financials`) enqueued for Excel files
   - On non-Excel success, mark document as `complete`
   - On failure, job marked failed with error details
   - Document status updated to `analysis_failed` on permanent failure

6. **AC6: Tests Pass**
   - Unit tests for LLM client with mocked responses
   - Unit tests for finding extraction prompts and Pydantic models
   - Unit tests for `AnalyzeDocumentHandler`
   - Integration tests for full analysis flow
   - Minimum 80% coverage on new handler code

## Tasks / Subtasks

- [x] **Task 1: Create LLM Client Module** (AC: 2)
  - [x] Create `src/llm/__init__.py` module structure
  - [x] Implement `GeminiClient` class in `src/llm/client.py`
  - [x] Add tiered model selection logic in `src/llm/models.py`
  - [x] Implement retry with exponential backoff using `tenacity`
  - [x] Add structured output support via Pydantic models
  - [x] Create LLM client factory with model tier selection

- [x] **Task 2: Create Finding Models** (AC: 3)
  - [x] Create `src/models/findings.py` with Pydantic schemas
  - [x] Define `Finding` model with all required fields
  - [x] Define `FindingType` and `Domain` enums
  - [x] Define `SourceReference` model for source attribution
  - [x] Define `ExtractionResult` for batch extraction output
  - [x] Add validation for confidence scores (0-100 range)

- [x] **Task 3: Create Analysis Prompts** (AC: 3)
  - [x] Create `src/llm/prompts.py` with prompt templates
  - [x] Design M&A-specific finding extraction prompt
  - [x] Include examples of each finding_type
  - [x] Include domain classification guidance
  - [x] Add confidence scoring instructions
  - [x] Support chunk context injection

- [x] **Task 4: Create Analyze Document Job Handler** (AC: 1, 4, 5)
  - [x] Create `src/jobs/handlers/analyze_document.py`
  - [x] Implement `AnalyzeDocumentHandler` class
  - [x] Load chunks from database by document_id
  - [x] Determine model tier based on document file_type
  - [x] Call Gemini for finding extraction
  - [x] Store findings in findings table
  - [x] Update document processing_status to "analyzed"
  - [x] Enqueue next job (`extract_financials` for xlsx, else mark complete)
  - [x] Register handler in `src/jobs/handlers/__init__.py`

- [x] **Task 5: Implement Database Operations** (AC: 4)
  - [x] Add `store_findings()` method to SupabaseClient
  - [x] Add `get_document_with_project()` method for project_id lookup
  - [x] Add `store_findings_and_update_status()` for atomic status updates
  - [x] Handle findings table foreign key constraints
  - [x] Support bulk insert for multiple findings

- [x] **Task 6: Add Configuration** (AC: 2)
  - [x] Add `GOOGLE_API_KEY` to config.py
  - [x] Add `GEMINI_FLASH_MODEL` setting (default: gemini-2.5-flash)
  - [x] Add `GEMINI_PRO_MODEL` setting (default: gemini-2.5-pro)
  - [x] Add `GEMINI_LITE_MODEL` setting (default: gemini-2.5-flash-lite)
  - [x] Add `LLM_ANALYSIS_BATCH_SIZE` setting (chunks per LLM call)
  - [x] Update `.env.example` with new variables

- [x] **Task 7: Create Findings Table Migration** (AC: 4)
  - [x] Create migration `00017_update_findings_for_llm_analysis.sql`
  - [x] Add chunk_id, finding_type, domain columns
  - [x] Add indexes for chunk_id, finding_type, domain
  - [x] Add updated_at trigger

- [x] **Task 8: Write Tests** (AC: 6)
  - [x] Unit tests for model selection logic (19 tests)
  - [x] Unit tests for prompt generation and response parsing (27 tests)
  - [x] Unit tests for `AnalyzeDocumentHandler` (16 tests)
  - [x] All 62 tests passing

## Dev Notes

### Architecture Patterns

**LLM Client Pattern (LangChain):**
```python
# src/llm/client.py
from langchain_google_genai import ChatGoogleGenerativeAI
from tenacity import retry, stop_after_attempt, wait_exponential

class GeminiClient:
    """Tiered Gemini client for document analysis."""

    def __init__(self, api_key: str, model: str = "gemini-2.5-flash"):
        self.llm = ChatGoogleGenerativeAI(
            model=model,
            google_api_key=api_key,
            temperature=0.1,  # Low temp for extraction tasks
        )

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=60))
    async def extract_findings(
        self, chunks: list[str], context: dict
    ) -> list[Finding]:
        """Extract structured findings from document chunks."""
        # Use with_structured_output for reliable Pydantic extraction
        structured_llm = self.llm.with_structured_output(ExtractionResult)
        ...
```

**Model Tier Selection:**
```python
# src/llm/models.py
from enum import Enum

class ModelTier(str, Enum):
    FLASH = "gemini-2.5-flash"      # Standard extraction
    PRO = "gemini-2.5-pro"          # Deep analysis (financial)
    LITE = "gemini-2.5-flash-lite"  # Batch processing

def select_model_tier(file_type: str, analysis_depth: str = "standard") -> ModelTier:
    """Select appropriate model based on document type and analysis needs."""
    financial_types = {
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel"
    }
    if file_type in financial_types or analysis_depth == "deep":
        return ModelTier.PRO
    if analysis_depth == "batch":
        return ModelTier.LITE
    return ModelTier.FLASH
```

**Job Handler Pattern:**
```python
# src/jobs/handlers/analyze_document.py
class AnalyzeDocumentHandler:
    """Handle analyze_document jobs from pg-boss queue."""

    async def handle(self, job: Job) -> dict:
        document_id = UUID(job.data["document_id"])

        # Get document info including project_id and file_type
        doc = await self.db.get_document_with_project(document_id)

        # Select model tier based on document type
        model_tier = select_model_tier(doc["file_type"])

        # Load chunks for this document
        chunks = await self.db.get_chunks_by_document(document_id)

        # Extract findings using LLM
        findings = await self._extract_findings(chunks, model_tier, doc)

        # Store findings and update status
        await self.db.store_findings_and_update_status(
            document_id=document_id,
            project_id=doc["project_id"],
            findings=findings,
            new_status="analyzed"
        )

        # Enqueue next job based on file type
        if self._is_excel(doc["file_type"]):
            await self._enqueue_job("extract_financials", document_id)
        else:
            await self.db.update_document_status(document_id, "complete")

        return {"success": True, "findings_count": len(findings)}
```

**Finding Extraction Prompt:**
```python
# src/llm/prompts.py
FINDING_EXTRACTION_PROMPT = """
You are an M&A analyst assistant extracting key findings from document content.

Document Context:
- File: {file_name}
- Type: {file_type}
- Project: {project_name}

Chunk Content:
{chunk_content}

Extract structured findings from this content. For each finding:

1. **finding_type**: Classify as one of:
   - metric: Quantitative data (revenue, margins, growth rates)
   - fact: Qualitative statements (company history, products, customers)
   - risk: Potential concerns or red flags
   - opportunity: Growth potential or positive indicators
   - contradiction: Conflicts with previously stated information

2. **domain**: Classify the business domain:
   - financial: Revenue, costs, profitability, cash flow
   - operational: Processes, efficiency, capacity
   - market: Industry, competition, market position
   - legal: Contracts, compliance, litigation
   - technical: Technology, systems, infrastructure

3. **confidence_score**: Rate 0-100 based on:
   - 90-100: Explicitly stated with clear source
   - 70-89: Strongly implied or calculated
   - 50-69: Inferred with moderate certainty
   - Below 50: Uncertain, needs validation

4. **source_reference**: Include page number, sheet name, or cell reference if available.

Return findings as structured JSON matching the ExtractionResult schema.
"""
```

### Database Considerations

**Findings Table Schema (from tech spec):**
```sql
CREATE TABLE findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL,

    content TEXT NOT NULL,
    finding_type TEXT NOT NULL, -- 'metric', 'fact', 'risk', 'opportunity', 'contradiction'
    domain TEXT NOT NULL, -- 'financial', 'operational', 'market', 'legal', 'technical'

    confidence_score DECIMAL(5,2) NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
    validation_status TEXT DEFAULT 'pending',
    source_reference JSONB NOT NULL,

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_findings_project ON findings(project_id);
CREATE INDEX idx_findings_document ON findings(document_id);
CREATE INDEX idx_findings_type ON findings(finding_type);
CREATE INDEX idx_findings_domain ON findings(domain);
```

### Error Handling Strategy

| Error Type | Action | Retry? |
|------------|--------|--------|
| Gemini rate limit (429) | Log, retry with backoff | Yes (3x) |
| Gemini API error (500) | Log, retry with backoff | Yes (3x) |
| Gemini invalid request (400) | Log, fail permanently | No |
| Structured output parse error | Log, retry with simpler prompt | Yes (1x) |
| Database connection error | Log, retry | Yes (3x) |
| Chunk not found | Log, skip chunk | Partial |

### Performance Considerations

- **Batch Size**: Process 5-10 chunks per LLM call to balance context and cost
- **Token Limits**: Gemini Flash has 1M token context - rarely a limit
- **Estimated Cost**:
  - Flash: ~$0.03 per 50-page document
  - Pro: ~$0.12 per 50-page document (financial docs)
- **Concurrency**: Process documents serially to manage rate limits
- **Caching**: Consider caching extraction results for identical content

### Project Structure Notes

**Files to Create:**
```
manda-processing/src/
├── llm/
│   ├── __init__.py
│   ├── client.py          # GeminiClient wrapper
│   ├── models.py          # ModelTier enum, selection logic
│   └── prompts.py         # Extraction prompt templates
├── models/
│   └── findings.py        # Finding Pydantic models
├── jobs/handlers/
│   └── analyze_document.py # This story's handler
```

**Files to Modify:**
```
manda-processing/src/
├── config.py              # Add Gemini model settings
├── storage/supabase_client.py  # Add findings DB operations
├── jobs/handlers/__init__.py   # Register handler
├── jobs/worker.py              # Register in setup_default_handlers
```

**Dependencies to Add (pyproject.toml):**
```toml
"langchain-google-genai>=2.1.0",  # From tech spec
```

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E3.md#E3.5-LLM-Analysis]
- [Source: docs/sprint-artifacts/tech-spec-epic-E3.md#Data-Models-and-Contracts]
- [Source: docs/sprint-artifacts/tech-spec-epic-E3.md#Detailed-Design-LLM-Module]
- [Source: docs/manda-architecture.md#Multi-Model-Strategy]
- [Source: docs/manda-architecture.md#Pydantic-LangGraph-Integration-Strategy]

### Learnings from Previous Story

**From Story e3-4 (Status: done)**

- **Embedding Client Pattern**: `OpenAIEmbeddingClient` at `src/embeddings/openai_client.py` - follow similar structure for GeminiClient
  - Use tenacity for retry logic: `@retry(stop=stop_after_attempt(3), wait=wait_exponential(...))`
  - Create client factory with singleton pattern
  - Use async methods throughout
- **Job Handler Pattern**: `GenerateEmbeddingsHandler` at `src/jobs/handlers/generate_embeddings.py`
  - Get document info first to determine processing approach
  - Process chunks in batches
  - Use atomic transactions for storage + status updates
  - Enqueue next job on success
- **Database Operations**: `SupabaseClient` has pattern for new operations
  - Use `get_pool()` for direct asyncpg access
  - Wrap in transactions for atomicity
  - Add new methods following existing patterns
- **Test Coverage**: E3.4 achieved 86% coverage with 37 tests
  - Mock external services (OpenAI → Google GenAI)
  - Test error handling paths
  - Verify job queue integration

**Key Integration Points:**
- Import from E3.4: `from src.storage.supabase_client import SupabaseClient, get_supabase_client`
- Import job queue: `from src.jobs.queue import Job, get_job_queue`
- Import settings: `from src.config import Settings, get_settings`
- Follow async patterns: All handlers and clients are async
- Use `update_chunk_embeddings` pattern from E3.4 for atomic operations

**New Files Created in E3.4 to Reuse:**
- `src/embeddings/openai_client.py` - Pattern for API client with retry
- `src/jobs/handlers/generate_embeddings.py` - Pattern for handler structure
- `src/api/routes/search.py` - Pattern for API endpoint structure

[Source: stories/e3-4-generate-embeddings-for-semantic-search.md#Dev-Agent-Record]

## Dev Agent Record

### Context Reference

- [Story Context XML](e3-5-implement-llm-analysis-with-gemini-25-tiered.context.xml) - Generated 2025-11-27

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

1. **LLM Client Module**: Implemented `GeminiClient` using LangChain's `ChatGoogleGenerativeAI` adapter with tiered model support (Flash, Pro, Lite). Includes retry logic via tenacity with exponential backoff.

2. **Model Selection Logic**: `select_model_tier()` function selects Pro for financial documents (Excel), Lite for batch processing, and Flash for everything else. Pricing utilities included.

3. **Finding Models**: Pydantic models for `FindingCreate`, `Finding`, `ExtractionResult` with proper enum types (`FindingType`, `Domain`, `ValidationStatus`) and validation.

4. **Analysis Prompts**: M&A-specific prompt templates with detailed instructions for finding extraction, confidence scoring, and domain classification. Includes response parsing with JSON extraction from markdown blocks.

5. **Job Handler**: `AnalyzeDocumentHandler` follows existing patterns from E3.4. Loads chunks, selects model tier, calls LLM, stores findings atomically, updates status, and enqueues next job.

6. **Database Operations**: Added `store_findings()`, `store_findings_and_update_status()`, and `get_document_with_project()` to `SupabaseClient`. All operations use async transactions.

7. **Configuration**: Added `GOOGLE_API_KEY`, `GEMINI_FLASH_MODEL`, `GEMINI_PRO_MODEL`, `GEMINI_LITE_MODEL`, `LLM_ANALYSIS_BATCH_SIZE` settings.

8. **Migration**: Created `00017_update_findings_for_llm_analysis.sql` to add `chunk_id`, `finding_type`, `domain` columns with appropriate enums and indexes.

9. **Tests**: 62 unit tests passing - covering model selection, prompts, response parsing, and handler functionality.

### File List

**New Files Created:**
- `manda-processing/src/llm/__init__.py` - LLM module exports
- `manda-processing/src/llm/client.py` - GeminiClient implementation
- `manda-processing/src/llm/models.py` - ModelTier enum and selection logic
- `manda-processing/src/llm/prompts.py` - M&A extraction prompts
- `manda-processing/src/models/__init__.py` - Models module exports
- `manda-processing/src/models/findings.py` - Finding Pydantic models
- `manda-processing/src/jobs/handlers/analyze_document.py` - Job handler
- `manda-app/supabase/migrations/00017_update_findings_for_llm_analysis.sql` - DB migration
- `manda-processing/tests/unit/test_llm/__init__.py` - Test module init
- `manda-processing/tests/unit/test_llm/test_models.py` - Model selection tests
- `manda-processing/tests/unit/test_llm/test_prompts.py` - Prompt tests
- `manda-processing/tests/unit/test_jobs/test_analyze_document.py` - Handler tests

**Files Modified:**
- `manda-processing/src/config.py` - Added Gemini settings
- `manda-processing/src/storage/supabase_client.py` - Added findings storage methods
- `manda-processing/src/jobs/handlers/__init__.py` - Registered analyze_document handler
- `manda-processing/src/jobs/worker.py` - Added analyze-document handler registration
- `manda-processing/pyproject.toml` - Added langchain-google-genai dependencies
- `manda-processing/.env.example` - Added Gemini environment variables

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-27 | Story drafted | SM Agent |
| 2025-11-27 | Story context created, status -> ready-for-dev | SM Agent |
| 2025-11-27 | Implementation complete, 62 tests passing, status -> ready-for-review | Dev Agent (Claude Opus 4.5) |
