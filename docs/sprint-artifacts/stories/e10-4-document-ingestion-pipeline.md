# Story 10.4: Document Ingestion Pipeline

**Status:** ready-for-dev

---

## Story

As a **platform developer**,
I want **document uploads to trigger Graphiti episode creation with entity extraction**,
so that **documents are automatically ingested into the unified knowledge graph with entities, facts, and embeddings stored in Neo4j**.

---

## Acceptance Criteria

1. **AC1:** Document upload triggers Graphiti episode creation (new pg-boss job: `ingest-graphiti`)
2. **AC2:** Docling chunks become episode content with source metadata (page, chunk index, document name)
3. **AC3:** Entity extraction runs on each chunk via Graphiti LLM pipeline
4. **AC4:** Entities linked to source document via EXTRACTED_FROM relationships
5. **AC5:** Embeddings generated (Voyage 1024d) and stored in Neo4j
6. **AC6:** Processing status tracked in PostgreSQL (documents table status field)
7. **AC7:** Error handling with retry logic via existing retry_manager
8. **AC8:** Test with PDF, Excel, Word documents (multi-format validation)

---

## Tasks / Subtasks

- [ ] **Task 1: Create Graphiti Ingestion Service Module** (AC: #1, #2, #3)
  - [ ] 1.1: Create `manda-processing/src/graphiti/ingestion.py` module
  - [ ] 1.2: Define `GraphitiIngestionService` class with dependencies (GraphitiClient, VoyageClient reference)
  - [ ] 1.3: Implement `ingest_document_chunks()` method signature per tech spec
  - [ ] 1.4: Define `IngestionResult` model (episode_count, entity_count, fact_count, elapsed_ms)
  - [ ] 1.5: Define `EpisodeMetadata` model (source_type, source_id, page_number, chunk_index, confidence)

- [ ] **Task 2: Implement Core Ingestion Logic** (AC: #2, #3, #5)
  - [ ] 2.1: In `ingest_document_chunks()`, iterate over chunks from Docling
  - [ ] 2.2: For each chunk, call `GraphitiClient.add_episode()` with:
    - `deal_id` as group_id for namespace isolation
    - `content` from chunk text
    - `name` as document name with chunk index (e.g., "report.pdf#chunk-5")
    - `source_description` with document type and page info
    - `entity_types`, `edge_types`, `edge_type_map` from E10.3 schema
  - [ ] 2.3: Track episode creation count and entity counts
  - [ ] 2.4: Return `IngestionResult` with metrics

- [ ] **Task 3: Create ingest-graphiti Job Handler** (AC: #1, #6, #7)
  - [ ] 3.1: Create `manda-processing/src/jobs/handlers/ingest_graphiti.py`
  - [ ] 3.2: Define `IngestGraphitiHandler` class following existing handler patterns
  - [ ] 3.3: Implement `handle()` method:
    - Load chunks from PostgreSQL (existing db.get_chunks_by_document())
    - Call `GraphitiIngestionService.ingest_document_chunks()`
    - Update document status to 'graphiti_ingested'
    - Enqueue next job (analyze-document)
  - [ ] 3.4: Add error handling with retry classification per E3.8 pattern
  - [ ] 3.5: Register handler in TWO places:
    - `handlers/__init__.py`: Add lazy wrapper + export in `__all__`
    - `worker.py`: Add to `setup_default_handlers()` function
  - [ ] 3.6: Add `DEFAULT_WORKER_CONFIG` entry: `"ingest-graphiti": WorkerConfig(batch_size=3, polling_interval_seconds=5)`

- [ ] **Task 4: Update Document Processing Pipeline** (AC: #1, #6)
  - [ ] 4.1: Modify `generate_embeddings.py` to enqueue `ingest-graphiti` as next job (after embeddings complete)
  - [ ] 4.2: Update `ingest_graphiti.py` to enqueue `analyze-document` as next job (after ingestion complete)
  - [ ] 4.3: Add document status value 'graphiti_ingesting' to status transitions
  - [ ] 4.4: Ensure idempotency - check if already ingested before re-processing

- [ ] **Task 5: Implement EXTRACTED_FROM Relationship Creation** (AC: #4)
  - [ ] 5.1: Ensure `ExtractedFrom` edge model from E10.3 is used
  - [ ] 5.2: Graphiti automatically creates EXTRACTED_FROM edges via entity_types/edge_types
  - [ ] 5.3: Verify edge contains: page_number, chunk_index, confidence
  - [ ] 5.4: Document node must exist - create via episode or separate call

- [ ] **Task 6: Add WebSocket Notification** (AC: #6)
  - [ ] 6.1: After successful ingestion, send WebSocket notification
  - [ ] 6.2: Notification payload: document_id, deal_id, status='graphiti_ingested', entity_count

- [ ] **Task 7: Create Unit Tests** (AC: #1, #2, #3)
  - [ ] 7.1: Create `manda-processing/tests/unit/test_graphiti/test_ingestion.py`
  - [ ] 7.2: Test `ingest_document_chunks()` with mocked GraphitiClient
  - [ ] 7.3: Test chunk iteration and episode creation calls
  - [ ] 7.4: Test `IngestionResult` metrics accuracy
  - [ ] 7.5: Test error handling and retry classification

- [ ] **Task 8: Create Integration Tests** (AC: #8)
  - [ ] 8.1: Create `manda-processing/tests/integration/test_graphiti_ingestion.py`
  - [ ] 8.2: Test with sample PDF document (multi-page, text + tables)
  - [ ] 8.3: Test with sample Excel document (financial data)
  - [ ] 8.4: Test with sample Word document (narrative content)
  - [ ] 8.5: Verify entities appear in Neo4j after ingestion
  - [ ] 8.6: Verify EXTRACTED_FROM relationships created

---

## Dev Notes

### Architecture Context

This story implements the **Document Ingestion Pipeline** for Epic E10 - Knowledge Graph Foundation. The pipeline:

- **Replaces pgvector** for document embeddings (embeddings now live in Neo4j via Graphiti)
- **Triggers entity extraction** automatically via Graphiti's LLM pipeline (using Gemini Flash)
- **Creates semantic relationships** via the E10.3 sell-side spine schema
- **Maintains provenance** via EXTRACTED_FROM edges linking entities to source documents

**Source:** [Tech Spec E10 Section 4.1](../../sprint-artifacts/tech-specs/tech-spec-epic-E10.md) - Document Ingestion Flow

### Processing Flow

```
Document Upload (existing)
        |
        v
parse_document (Docling) -> Chunks in PostgreSQL
        |
        v
generate-embeddings (pgvector - keep for backward compat)
        |
        v
ingest-graphiti (NEW - E10.4)  <-- Modify generate_embeddings.py to enqueue this
    |
    | For each chunk:
    |   -> GraphitiClient.add_episode()
    |   -> LLM entity extraction (Gemini Flash)
    |   -> Entity resolution (Graphiti built-in)
    |   -> Voyage embeddings -> Neo4j storage
    |
    v
Update document status -> 'graphiti_ingested'
        |
        v
analyze-document (existing)  <-- ingest_graphiti.py enqueues this
```

**Pipeline Change Summary:**
- `generate_embeddings.py`: Change next job from `analyze-document` → `ingest-graphiti`
- `ingest_graphiti.py` (NEW): Enqueue `analyze-document` as next job

### CRITICAL: Do NOT Reinvent - Build on E10.1/E10.2/E10.3

**E10.1 Deliverables (DONE):**
- `GraphitiClient` singleton with `get_instance()`, `close()`, `add_episode()`, `search()`
- Neo4j 5.26+ in Docker Compose with APOC
- GeminiClient for LLM extraction

**E10.2 Deliverables (DONE):**
- VoyageAIEmbedder with voyage-finance-2 (1024d)
- Fallback to GeminiEmbedder if Voyage unavailable
- Cost tracking logging

**E10.3 Deliverables (DONE):**
- Schema module (`src/graphiti/schema/`) with entities, edges, helpers
- `GraphitiClient.add_episode()` accepts `entity_types`, `edge_types`, `edge_type_map`
- Defaults to M&A schema when not provided

**This story adds:**
- `GraphitiIngestionService` class for orchestrating document ingestion
- `ingest-graphiti` pg-boss job handler
- Pipeline integration between Docling parsing and Graphiti ingestion

### Data Types Reference

**Chunk structure from `db.get_chunks_by_document()`:**
```python
# DocumentChunk is a dict with these keys:
chunk = {
    "id": UUID,              # Chunk UUID
    "content": str,          # Text content
    "chunk_index": int,      # 0-based index within document
    "page_number": int | None,  # Page number (PDFs)
    "chunk_type": str,       # "text" | "table"
    "sheet_name": str | None,   # Sheet name (Excel)
    "token_count": int,      # Approximate token count
}
```

**IngestionResult model:**
```python
@dataclass
class IngestionResult:
    episode_count: int
    elapsed_ms: int
    estimated_cost_usd: float  # Sum of embedding costs from Voyage
```

### Complete Implementation Reference

```python
# manda-processing/src/graphiti/ingestion.py
import time
from dataclasses import dataclass
from typing import Any

import structlog

from src.graphiti.client import GraphitiClient
from src.graphiti.schema import get_entity_types, get_edge_types, get_edge_type_map

logger = structlog.get_logger(__name__)


@dataclass
class IngestionResult:
    """Result metrics from document ingestion."""
    episode_count: int
    elapsed_ms: int
    estimated_cost_usd: float = 0.0


class GraphitiIngestionService:
    """
    Ingestion service for adding document content to the knowledge graph.

    Orchestrates chunk iteration and episode creation in Graphiti.
    Entity extraction happens automatically via Graphiti's LLM pipeline.
    """

    def _build_source_description(self, chunk: dict[str, Any], document_name: str) -> str:
        """Build source description for episode provenance."""
        parts = [f"From: {document_name}"]
        if chunk.get("page_number"):
            parts.append(f"Page {chunk['page_number']}")
        if chunk.get("sheet_name"):
            parts.append(f"Sheet: {chunk['sheet_name']}")
        parts.append(f"Type: {chunk.get('chunk_type', 'text')}")
        return " | ".join(parts)

    async def ingest_document_chunks(
        self,
        document_id: str,
        deal_id: str,
        document_name: str,
        chunks: list[dict[str, Any]],
    ) -> IngestionResult:
        """
        Ingest document chunks as Graphiti episodes.

        Args:
            document_id: Source document UUID
            deal_id: Deal UUID (group_id for namespace isolation)
            document_name: Document filename for episode naming
            chunks: Parsed document chunks from db.get_chunks_by_document()

        Returns:
            IngestionResult with episode_count, elapsed_ms, estimated_cost_usd
        """
        start_time = time.perf_counter()

        # Use M&A schema helpers (from E10.3)
        entity_types = get_entity_types()
        edge_types = get_edge_types()
        edge_type_map = get_edge_type_map()

        episode_count = 0
        total_chars = 0

        for i, chunk in enumerate(chunks):
            episode_name = f"{document_name}#chunk-{i}"
            source_desc = self._build_source_description(chunk, document_name)
            content = chunk["content"]

            await GraphitiClient.add_episode(
                deal_id=deal_id,
                content=content,
                name=episode_name,
                source_description=source_desc,
                entity_types=entity_types,
                edge_types=edge_types,
                edge_type_map=edge_type_map,
            )
            episode_count += 1
            total_chars += len(content)

            # Progress logging every 10 chunks
            if (i + 1) % 10 == 0:
                logger.info(
                    "Ingestion progress",
                    completed=i + 1,
                    total=len(chunks),
                    document_id=document_id,
                )

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)

        # Estimate cost: Voyage voyage-finance-2 is $0.12 per 1M tokens
        # ~4 chars per token estimate
        estimated_tokens = total_chars // 4
        estimated_cost_usd = estimated_tokens * 0.00000012

        return IngestionResult(
            episode_count=episode_count,
            elapsed_ms=elapsed_ms,
            estimated_cost_usd=estimated_cost_usd,
        )
```

### Job Handler Implementation

```python
# manda-processing/src/jobs/handlers/ingest_graphiti.py
import time
from typing import Any, Optional
from uuid import UUID

import structlog

from src.config import Settings, get_settings
from src.graphiti.client import GraphitiConnectionError
from src.graphiti.ingestion import GraphitiIngestionService, IngestionResult
from src.jobs.queue import Job, get_job_queue
from src.jobs.retry_manager import RetryManager, get_retry_manager
from src.storage.supabase_client import SupabaseClient, DatabaseError, get_supabase_client

logger = structlog.get_logger(__name__)

NON_RETRYABLE_ERRORS = (ValueError,)


class IngestGraphitiHandler:
    """Handler for ingest-graphiti jobs."""

    def __init__(
        self,
        db_client: Optional[SupabaseClient] = None,
        ingestion_service: Optional[GraphitiIngestionService] = None,
        retry_manager: Optional[RetryManager] = None,
        config: Optional[Settings] = None,
    ):
        self.db = db_client or get_supabase_client()
        self.ingestion = ingestion_service or GraphitiIngestionService()
        self.retry_mgr = retry_manager or get_retry_manager()
        self.config = config or get_settings()
        logger.info("IngestGraphitiHandler initialized")

    async def handle(self, job: Job) -> dict[str, Any]:
        start_time = time.perf_counter()
        document_id = UUID(job.data["document_id"])
        deal_id = job.data["deal_id"]
        user_id = job.data.get("user_id")
        is_retry = job.data.get("is_retry", False)

        logger.info(
            "Processing ingest-graphiti job",
            job_id=job.id,
            document_id=str(document_id),
            retry_count=job.retry_count,
        )

        try:
            if is_retry:
                await self.retry_mgr.prepare_stage_retry(document_id, "graphiti_ingested")
            else:
                await self.db.update_document_status(document_id, "graphiti_ingesting")

            await self.db.clear_processing_error(document_id)

            # Load chunks and document
            chunks = await self.db.get_chunks_by_document(document_id)
            doc = await self.db.get_document(document_id)

            if not doc:
                raise ValueError(f"Document not found: {document_id}")

            if not chunks:
                logger.warning("No chunks found", document_id=str(document_id))
                await self.db.update_document_status(document_id, "graphiti_ingested")
                await self.retry_mgr.mark_stage_complete(document_id, "graphiti_ingested")
                next_job_id = await self._enqueue_next_job(document_id, deal_id, user_id)
                return {"success": True, "episodes_created": 0, "next_job_id": next_job_id}

            # Ingest to Graphiti
            result = await self.ingestion.ingest_document_chunks(
                document_id=str(document_id),
                deal_id=deal_id,
                document_name=doc["name"],
                chunks=chunks,
            )

            # Update status
            await self.db.update_document_status(document_id, "graphiti_ingested")
            await self.retry_mgr.mark_stage_complete(document_id, "graphiti_ingested")

            # Enqueue analyze-document
            next_job_id = await self._enqueue_next_job(document_id, deal_id, user_id)

            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            return {
                "success": True,
                "document_id": str(document_id),
                "episodes_created": result.episode_count,
                "ingestion_time_ms": result.elapsed_ms,
                "estimated_cost_usd": result.estimated_cost_usd,
                "total_time_ms": elapsed_ms,
                "next_job_id": next_job_id,
            }

        except GraphitiConnectionError as e:
            logger.warning("Graphiti connection error (may retry)", error=str(e))
            await self.retry_mgr.handle_job_failure(
                document_id=document_id,
                error=e,
                current_stage="graphiti_ingesting",
                retry_count=job.retry_count,
            )
            raise

        except NON_RETRYABLE_ERRORS as e:
            logger.error("Permanent failure", error=str(e))
            await self.retry_mgr.handle_job_failure(
                document_id=document_id,
                error=e,
                current_stage="graphiti_ingesting",
                retry_count=job.retry_count,
            )
            raise

        except Exception as e:
            logger.error("Unexpected error", error=str(e), exc_info=True)
            await self.retry_mgr.handle_job_failure(
                document_id=document_id,
                error=e,
                current_stage="graphiti_ingesting",
                retry_count=job.retry_count,
            )
            raise

    async def _enqueue_next_job(
        self, document_id: UUID, deal_id: str, user_id: Optional[str]
    ) -> str:
        """Enqueue analyze-document job."""
        queue = await get_job_queue()
        job_data = {"document_id": str(document_id), "deal_id": deal_id}
        if user_id:
            job_data["user_id"] = user_id
        job_id = await queue.enqueue("analyze-document", job_data)
        logger.info("Enqueued analyze-document", document_id=str(document_id), next_job_id=job_id)
        return job_id


_handler: Optional[IngestGraphitiHandler] = None


def get_ingest_graphiti_handler() -> IngestGraphitiHandler:
    global _handler
    if _handler is None:
        _handler = IngestGraphitiHandler()
    return _handler


async def handle_ingest_graphiti(job: Job) -> dict[str, Any]:
    """Entry point for ingest-graphiti job handling."""
    handler = get_ingest_graphiti_handler()
    return await handler.handle(job)


__all__ = ["IngestGraphitiHandler", "handle_ingest_graphiti", "get_ingest_graphiti_handler"]
```

### Worker Registration Code

**1. Add to `handlers/__init__.py`:**
```python
# Add lazy wrapper
def handle_ingest_graphiti(job):
    """Handle an ingest-graphiti job (lazy wrapper)."""
    from src.jobs.handlers.ingest_graphiti import handle_ingest_graphiti as _handler
    return _handler(job)

def get_handle_ingest_graphiti():
    """Get the ingest_graphiti handler (lazy import)."""
    from src.jobs.handlers.ingest_graphiti import handle_ingest_graphiti
    return handle_ingest_graphiti

# Add to __all__
__all__ = [
    # ... existing exports ...
    "handle_ingest_graphiti",
    "get_handle_ingest_graphiti",
]
```

**2. Add to `worker.py` in `setup_default_handlers()`:**
```python
def setup_default_handlers(worker: Worker) -> None:
    """Register default job handlers."""
    # ... existing handlers ...

    # Graphiti ingestion handler (E10.4)
    from src.jobs.handlers import handle_ingest_graphiti
    worker.register("ingest-graphiti", handle_ingest_graphiti)
```

**3. Add to `DEFAULT_WORKER_CONFIG` in `worker.py`:**
```python
DEFAULT_WORKER_CONFIG: dict[str, WorkerConfig] = {
    # ... existing configs ...
    "ingest-graphiti": WorkerConfig(batch_size=3, polling_interval_seconds=5),
}
```

### Previous Story Learnings (E10.1, E10.2, E10.3)

**From E10.1:**
- Graphiti API import paths may differ from documentation - verify with actual imports
- `add_episode` uses `EpisodeType` enum for `source` parameter
- `build_indices_and_constraints()` may raise `EquivalentSchemaRuleAlreadyExists` if indices exist

**From E10.2:**
- VoyageAIEmbedder fallback pattern: try Voyage, catch exception, fall back to Gemini
- Cost tracking uses `estimated_tokens = len(content) // 4`

**From E10.3:**
- `entity_types`, `edge_types`, `edge_type_map` are `add_episode()` parameters
- Dictionary format: `{'TypeName': PydanticModelClass}` for entities and edges
- Tuple keys for edge_type_map: `{('SourceType', 'TargetType'): ['EDGE_NAME']}`
- Defaults to M&A schema helpers when not provided - enables dynamic discovery

**Apply to E10.4:**
- Use `GraphitiClient.add_episode()` directly (don't create new Graphiti instance)
- Follow singleton pattern - client is already initialized with correct embedder
- Chunk iteration should be sequential within a deal (Graphiti processes sequentially per group_id)
- Error classification follows E3.8 pattern (retryable vs permanent)

### File Structure

```
manda-processing/src/
├── graphiti/
│   ├── __init__.py          # MODIFY: Add ingestion exports
│   ├── client.py            # Existing (E10.1, E10.2, E10.3)
│   ├── config.py            # Existing (E10.1)
│   ├── ingestion.py         # NEW: GraphitiIngestionService + IngestionResult
│   └── schema/              # Existing (E10.3)
├── jobs/
│   ├── worker.py            # MODIFY: Add DEFAULT_WORKER_CONFIG + setup_default_handlers
│   └── handlers/
│       ├── __init__.py      # MODIFY: Add handle_ingest_graphiti + __all__
│       ├── generate_embeddings.py  # MODIFY: Change next job to ingest-graphiti
│       ├── analyze_document.py     # Existing (reference)
│       └── ingest_graphiti.py      # NEW: IngestGraphitiHandler
```

**Files to CREATE (2):**
- `manda-processing/src/graphiti/ingestion.py`
- `manda-processing/src/jobs/handlers/ingest_graphiti.py`

**Files to MODIFY (4):**
- `manda-processing/src/graphiti/__init__.py` - Add ingestion exports
- `manda-processing/src/jobs/handlers/__init__.py` - Add lazy wrapper
- `manda-processing/src/jobs/worker.py` - Add config + registration
- `manda-processing/src/jobs/handlers/generate_embeddings.py` - Change next job

### Testing Strategy

**Unit Tests:**
- `GraphitiIngestionService.ingest_document_chunks()` with mocked `GraphitiClient`
- Verify `add_episode()` called once per chunk
- Verify episode name format: `{document_name}#chunk-{index}`
- Verify source_description includes page number and chunk type
- Verify `IngestionResult` metrics

**Integration Tests (Neo4j required):**
- Upload PDF → verify episodes in Neo4j
- Upload Excel → verify financial entities extracted
- Upload Word → verify text entities extracted
- Verify EXTRACTED_FROM relationships exist
- Verify deal isolation (group_id works correctly)

**E2E Test Pattern:**
```python
async def test_document_ingestion_to_neo4j():
    # 1. Upload test document
    doc_id = await upload_document("test_financials.pdf")

    # 2. Wait for processing (parse -> embeddings -> graphiti)
    await wait_for_status(doc_id, "graphiti_ingested")

    # 3. Query Neo4j for episodes
    results = await GraphitiClient.search(deal_id, "revenue")

    # 4. Verify results include document content
    assert len(results) > 0
    assert "revenue" in results[0].content.lower()
```

### Environment Requirements

Uses existing environment variables:
- `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` (E10.1)
- `GOOGLE_API_KEY` (E10.1 - for Gemini entity extraction)
- `VOYAGE_API_KEY` (E10.2 - for embeddings, optional with fallback)

### Dependencies

**Python Packages (already installed):**
- `graphiti-core` (E10.1)
- `voyageai` (E10.2)
- `pydantic` (existing)

**Story Dependencies:**
- E10.1: Graphiti Infrastructure Setup (DONE) - provides `GraphitiClient`
- E10.2: Voyage Embedding Integration (DONE) - embeddings work
- E10.3: Sell-Side Spine Schema (DONE) - entity/edge types defined

---

## Project Structure Notes

### Alignment with Unified Project Structure

- New files in `manda-processing/src/graphiti/` - follows existing module pattern
- Handler in `manda-processing/src/jobs/handlers/` - consistent with E3 handlers
- Tests in `manda-processing/tests/unit/test_graphiti/` - consistent with E10.2/E10.3

### Detected Variances

- This story creates a NEW pipeline step (`ingest-graphiti`), not replacing existing
- `generate-embeddings` job remains for backward compatibility (pgvector still used by some features)
- Future E10.8 will remove pgvector dependencies after migration verified

---

## References

- [Epic E10: Knowledge Graph Foundation](../epics/epic-E10.md) - Epic context
- [Tech Spec E10](../../sprint-artifacts/tech-specs/tech-spec-epic-E10.md) - Detailed technical specification
- [E10.1 Story](./e10-1-graphiti-infrastructure-setup.md) - Graphiti infrastructure (DONE)
- [E10.2 Story](./e10-2-voyage-embedding-integration.md) - Voyage embeddings (DONE)
- [E10.3 Story](./e10-3-sell-side-spine-schema.md) - Sell-side schema (DONE)
- [Graphiti GitHub](https://github.com/getzep/graphiti) - Official repo
- [analyze_document.py](../../manda-processing/src/jobs/handlers/analyze_document.py) - Reference handler pattern
- [parse_document.py](../../manda-processing/src/jobs/handlers/parse_document.py) - Pipeline integration point

---

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### Change Log

- 2025-12-16: Story validated and enhanced with complete implementation code
- 2025-12-16: Story created via create-story workflow

### File List
