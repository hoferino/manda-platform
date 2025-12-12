# Story 4.15: Sync Findings to Neo4j Knowledge Graph

Status: drafted

## Story

As a **developer**,
I want **findings automatically synced to Neo4j after LLM extraction**,
so that **the knowledge graph is populated and ready for relationship queries, contradiction detection, and agent tools**.

## Context

Currently, the document processing pipeline extracts findings using Gemini 2.5 Flash (Phase 4) and stores them in PostgreSQL, but does **not** sync them to Neo4j. Story E1-7 configured Neo4j and created the **frontend** client module (`manda-app/lib/neo4j/`), but the **backend** Python service (`manda-processing`) has no Neo4j integration code.

**Current State:**
- ✅ Neo4j running (Docker, bolt://localhost:7687)
- ✅ Neo4j schema defined (E1-7: Finding, Document, Deal nodes + relationship types)
- ✅ Gemini 2.5 Flash extracting findings (8 findings extracted in Phase 4 test)
- ✅ Findings stored in PostgreSQL `findings` table
- ❌ **Neo4j database is EMPTY** (0 Finding nodes, 0 relationships)

**Root Cause:** E1-7 only created frontend TypeScript Neo4j client. E4-13 "Real-Time Knowledge Graph Updates" only implemented frontend Supabase realtime hooks. No backend Python code writes to Neo4j.

**Gap:** The `analyze-document` job handler ([manda-processing/src/jobs/handlers/analyze_document.py:233-265](../../../manda-processing/src/jobs/handlers/analyze_document.py#L233-L265)) stores findings to PostgreSQL but doesn't sync to Neo4j.

This story implements the missing backend Neo4j sync in the Python processing service, ensuring every finding extracted by the LLM is also written to the knowledge graph.

## Acceptance Criteria

### AC1: Neo4j Python Client Module Created
**Given** the manda-processing service needs to write to Neo4j
**When** I create a Neo4j client module
**Then** the module includes:
  - `manda-processing/src/storage/neo4j_client.py`
  - Connection pooling using `neo4j` Python driver
  - Functions: `create_finding_node()`, `create_document_node()`, `create_extracted_from_relationship()`
  - Error handling for connection failures
  - Environment variables: `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` (already in `.env`)
**And** Dependencies installed: `pip install neo4j`

### AC2: Neo4j Schema Initialization on Startup
**Given** Neo4j is running
**When** the worker starts
**Then** it initializes Neo4j schema:
  - Constraints: `deal_id_unique`, `document_id_unique`, `finding_id_unique`
  - Indexes: `finding_date_referenced`, `finding_user_id`, `finding_domain`
  - Index on `document_project_id` for filtering by deal
**And** Idempotent operations (IF NOT EXISTS)
**And** Schema initialization completes in <2 seconds

### AC3: Findings Synced to Neo4j After Extraction
**Given** the `analyze-document` job extracts findings
**When** findings are stored in PostgreSQL
**Then** `sync_findings_to_neo4j()` is called
**And** For each finding:
  - Create `:Finding` node with properties: `id`, `content`, `type`, `confidence`, `date_referenced`, `date_extracted`, `domain`, `user_id`, `project_id`
  - Create `EXTRACTED_FROM` relationship to `:Document` node (create Document node if needed)
**And** Operations use transactions (atomic write)
**And** Errors logged but don't fail the job (PostgreSQL is source of truth)

### AC4: Document Nodes Created on Upload
**Given** a document is uploaded
**When** the document is processed
**Then** a `:Document` node is created in Neo4j with properties:
  - `id` (document UUID)
  - `name` (filename)
  - `project_id` (deal UUID)
  - `upload_date` (ISO timestamp)
  - `doc_type` (file extension)
**And** Document node creation is **idempotent** (ON CREATE vs ON MATCH)

### AC5: Existing Findings Synced (Backfill Script)
**Given** 8 findings exist in PostgreSQL from Phase 4 testing (document: `c9d7117b-e696-4434-b7ef-a9e4607eec49`)
**When** I run `python3 -m src.scripts.backfill_neo4j`
**Then** all findings are synced to Neo4j
**And** Neo4j contains:
  - 8 `:Finding` nodes with correct properties
  - 1 `:Document` node for the test PDF
  - 8 `EXTRACTED_FROM` relationships
**And** Idempotent (running twice doesn't create duplicates)

### AC6: Neo4j Sync Performance
**Given** the analyze-document job completes
**When** syncing findings to Neo4j
**Then** Neo4j write operations complete in <500ms for 8 findings
**And** Total job time increase is <5% (negligible impact)
**And** Connection pooling handles concurrent jobs (5 worker threads)

### AC7: Neo4j Sync Error Handling
**Given** Neo4j is unavailable (stopped)
**When** findings are extracted
**Then** findings are still stored in PostgreSQL successfully
**And** Neo4j sync error is logged with level ERROR
**And** Document status updated to `analyzed` (not blocked by Neo4j)
**And** Worker continues processing other jobs

### AC8: Verification Queries Work
**Given** findings are synced to Neo4j
**When** I query the knowledge graph
**Then** the following Cypher queries succeed:
  - `MATCH (f:Finding) RETURN count(f)` → 8
  - `MATCH (d:Document) RETURN count(d)` → 1
  - `MATCH (f:Finding)-[:EXTRACTED_FROM]->(d:Document) RETURN count(f)` → 8
  - `MATCH (f:Finding) WHERE f.domain = 'Risk Management' RETURN f` → findings filtered by domain
  - `MATCH (f:Finding) WHERE f.project_id = $project_id RETURN f` → user isolation works
**And** Queries complete in <100ms

### AC9: Logging and Observability
**Given** findings are being synced to Neo4j
**When** the analyze-document job runs
**Then** logs include:
  - `[info] Syncing N findings to Neo4j` (before sync)
  - `[info] Neo4j sync complete: N findings, M relationships` (after sync)
  - `[error] Neo4j sync failed: <error>` (on failure)
**And** Logs include document_id and finding_ids for debugging

### AC10: Documentation Updated
**Given** Neo4j sync is implemented
**When** I check documentation
**Then** the following files are updated:
  - `docs/manda-architecture.md` - Add "Neo4j sync happens in analyze-document job"
  - `docs/sprint-artifacts/PHASE4_GEMINI_SETUP_COMPLETE.md` - Update to reflect Neo4j integration
  - `manda-processing/README.md` - Document Neo4j client module and backfill script
  - Code comments in `neo4j_client.py` - Explain connection pooling and error handling

## Tasks / Subtasks

- [ ] **Task 1: Install Neo4j Python Driver** (AC: #1)
  - [ ] Add to `manda-processing/requirements.txt`: `neo4j>=5.15.0`
  - [ ] Install: `pip3 install neo4j`
  - [ ] Verify compatibility with Neo4j 5.15-community

- [ ] **Task 2: Create Neo4j Client Module** (AC: #1)
  - [ ] Create `manda-processing/src/storage/neo4j_client.py`
  - [ ] Implement singleton driver pattern:
    ```python
    from neo4j import GraphDatabase, Driver
    from src.config import get_settings

    _driver: Driver | None = None

    def get_neo4j_driver() -> Driver:
        global _driver
        if _driver is None:
            settings = get_settings()
            _driver = GraphDatabase.driver(
                settings.neo4j_uri,
                auth=(settings.neo4j_user, settings.neo4j_password),
                max_connection_pool_size=10,
            )
        return _driver

    async def close_neo4j_driver():
        global _driver
        if _driver:
            _driver.close()
            _driver = None
    ```
  - [ ] Add error handling for connection failures

- [ ] **Task 3: Implement Node Creation Functions** (AC: #1, #3, #4)
  - [ ] `create_finding_node(finding_id, content, type, confidence, ...)`
    ```python
    def create_finding_node(
        finding_id: str,
        content: str,
        finding_type: str,
        confidence: float,
        domain: str,
        date_referenced: str | None,
        date_extracted: str,
        user_id: str,
        project_id: str,
    ):
        driver = get_neo4j_driver()
        with driver.session() as session:
            session.run(
                """
                MERGE (f:Finding {id: $id})
                SET f.content = $content,
                    f.type = $type,
                    f.confidence = $confidence,
                    f.domain = $domain,
                    f.date_referenced = $date_referenced,
                    f.date_extracted = $date_extracted,
                    f.user_id = $user_id,
                    f.project_id = $project_id
                """,
                id=finding_id,
                content=content,
                type=finding_type,
                confidence=confidence,
                domain=domain,
                date_referenced=date_referenced,
                date_extracted=date_extracted,
                user_id=user_id,
                project_id=project_id,
            )
    ```
  - [ ] `create_document_node(document_id, name, project_id, upload_date, doc_type)`
  - [ ] `create_extracted_from_relationship(finding_id, document_id)`

- [ ] **Task 4: Implement Schema Initialization** (AC: #2)
  - [ ] Create `manda-processing/src/storage/neo4j_schema.py`
  - [ ] Implement `initialize_neo4j_schema()`:
    ```python
    def initialize_neo4j_schema():
        driver = get_neo4j_driver()
        with driver.session() as session:
            # Constraints
            session.run("CREATE CONSTRAINT finding_id_unique IF NOT EXISTS FOR (f:Finding) REQUIRE f.id IS UNIQUE")
            session.run("CREATE CONSTRAINT document_id_unique IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE")
            session.run("CREATE CONSTRAINT deal_id_unique IF NOT EXISTS FOR (d:Deal) REQUIRE d.id IS UNIQUE")

            # Indexes
            session.run("CREATE INDEX finding_date_referenced IF NOT EXISTS FOR (f:Finding) ON (f.date_referenced)")
            session.run("CREATE INDEX finding_user_id IF NOT EXISTS FOR (f:Finding) ON (f.user_id)")
            session.run("CREATE INDEX finding_domain IF NOT EXISTS FOR (f:Finding) ON (f.domain)")
            session.run("CREATE INDEX document_project_id IF NOT EXISTS FOR (d:Document) ON (d.project_id)")
    ```
  - [ ] Call `initialize_neo4j_schema()` in worker startup ([src/jobs/__main__.py](../../../manda-processing/src/jobs/__main__.py))

- [ ] **Task 5: Integrate Neo4j Sync into analyze-document Handler** (AC: #3)
  - [ ] Update `manda-processing/src/jobs/handlers/analyze_document.py`
  - [ ] Add import: `from src.storage.neo4j_client import create_finding_node, create_document_node, create_extracted_from_relationship`
  - [ ] After PostgreSQL storage (line 265), add:
    ```python
    # Sync findings to Neo4j (best-effort, don't fail job on error)
    try:
        logger.info("Syncing findings to Neo4j", document_id=document_id, finding_count=len(findings))

        # Create document node
        create_document_node(
            document_id=document.id,
            name=document.name,
            project_id=document.project_id,
            upload_date=document.created_at.isoformat(),
            doc_type=document.file_type or "unknown",
        )

        # Create finding nodes and relationships
        for finding in findings:
            create_finding_node(
                finding_id=finding["id"],
                content=finding["content"],
                finding_type=finding["type"],
                confidence=finding["confidence_score"],
                domain=finding["domain"],
                date_referenced=finding.get("date_referenced"),
                date_extracted=datetime.now(timezone.utc).isoformat(),
                user_id=document.user_id,
                project_id=document.project_id,
            )

            create_extracted_from_relationship(
                finding_id=finding["id"],
                document_id=document.id,
            )

        logger.info("Neo4j sync complete", finding_count=len(findings))
    except Exception as e:
        logger.error("Neo4j sync failed", error=str(e), document_id=document_id)
        # Don't fail the job - PostgreSQL is source of truth
    ```

- [ ] **Task 6: Add Neo4j Settings to Config** (AC: #1)
  - [ ] Update `manda-processing/src/config.py` (Settings class):
    ```python
    neo4j_uri: str = Field(default="bolt://localhost:7687")
    neo4j_user: str = Field(default="neo4j")
    neo4j_password: str = Field(default="")
    ```
  - [ ] Verify `.env` already has these variables (from Phase 4 setup)

- [ ] **Task 7: Create Backfill Script for Existing Findings** (AC: #5)
  - [ ] Create `manda-processing/src/scripts/backfill_neo4j.py`
  - [ ] Query all findings from PostgreSQL
  - [ ] For each finding:
    - Create Finding node
    - Create Document node (if not exists)
    - Create EXTRACTED_FROM relationship
  - [ ] Progress logging: `Synced 10/100 findings...`
  - [ ] Test with 8 findings from Phase 4 (document: `c9d7117b-e696-4434-b7ef-a9e4607eec49`)

- [ ] **Task 8: Test Neo4j Sync with New Upload** (AC: #3, #6, #8)
  - [ ] Upload a new document through UI
  - [ ] Monitor worker logs for:
    - `[info] Syncing N findings to Neo4j`
    - `[info] Neo4j sync complete`
  - [ ] Query Neo4j to verify:
    - Finding nodes created
    - Document node created
    - EXTRACTED_FROM relationships created
  - [ ] Measure Neo4j sync time (<500ms for ~8 findings)

- [ ] **Task 9: Test Error Handling** (AC: #7)
  - [ ] Stop Neo4j: `docker stop manda-neo4j`
  - [ ] Upload document and trigger analysis
  - [ ] Verify:
    - Findings stored in PostgreSQL ✅
    - Document status = `analyzed` ✅
    - Error logged: `Neo4j sync failed: ...` ✅
    - Job completes successfully ✅
  - [ ] Restart Neo4j: `docker start manda-neo4j`
  - [ ] Run backfill script to sync missed findings

- [ ] **Task 10: Run Backfill Script for Phase 4 Findings** (AC: #5)
  - [ ] Run: `cd manda-processing && python3 -m src.scripts.backfill_neo4j`
  - [ ] Verify output:
    ```
    [info] Starting Neo4j backfill
    [info] Found 8 findings in PostgreSQL
    [info] Syncing finding 1/8: c2bbd841-...
    [info] Syncing finding 2/8: c2bbd841-...
    ...
    [info] Backfill complete: 8 findings, 8 relationships, 1 document
    ```
  - [ ] Query Neo4j: `MATCH (f:Finding) RETURN count(f)` → 8

- [ ] **Task 11: Verify Neo4j Queries** (AC: #8)
  - [ ] Open Neo4j Browser: `http://localhost:7474`
  - [ ] Run verification queries:
    ```cypher
    // Count findings
    MATCH (f:Finding) RETURN count(f)

    // Count documents
    MATCH (d:Document) RETURN count(d)

    // Count relationships
    MATCH (f:Finding)-[:EXTRACTED_FROM]->(d:Document) RETURN count(f)

    // Filter by domain
    MATCH (f:Finding) WHERE f.domain = 'Risk Management' RETURN f.id, f.content, f.confidence

    // Filter by project (user isolation)
    MATCH (f:Finding) WHERE f.project_id = 'c9d7117b-e696-4434-b7ef-a9e4607eec49' RETURN f

    // Traverse relationships
    MATCH (f:Finding)-[r:EXTRACTED_FROM]->(d:Document)
    RETURN f.id, f.type, d.name
    LIMIT 5
    ```
  - [ ] Measure query performance (<100ms)

- [ ] **Task 12: Update Documentation** (AC: #10)
  - [ ] Update `docs/manda-architecture.md`:
    - Add section: "Neo4j Sync in Document Processing Pipeline"
    - Flow diagram update: analyze-document → PostgreSQL + Neo4j
  - [ ] Update `docs/sprint-artifacts/PHASE4_GEMINI_SETUP_COMPLETE.md`:
    - Update pipeline flow to include Neo4j sync step
  - [ ] Create `manda-processing/README.md` (if missing) or update:
    - Document Neo4j client module
    - Explain backfill script usage
    - Environment variables required
  - [ ] Add code comments to `neo4j_client.py`

- [ ] **Task 13: Write Unit Tests** (AC: All)
  - [ ] Test Neo4j client connection (mock driver)
  - [ ] Test `create_finding_node()` function
  - [ ] Test `create_document_node()` function
  - [ ] Test `create_extracted_from_relationship()` function
  - [ ] Test error handling when Neo4j unavailable
  - [ ] Use pytest with `pytest-mock`

- [ ] **Task 14: Performance Testing** (AC: #6)
  - [ ] Measure Neo4j sync time for 8 findings
  - [ ] Compare job duration before/after Neo4j sync:
    - Before: ~5-10s (Gemini analysis)
    - After: ~5-10.5s (Gemini + Neo4j sync)
    - Increase: <5%
  - [ ] Test concurrent jobs (5 workers) to verify connection pooling

## Dev Notes

### Technology Stack

**Neo4j Python Driver:**
- Package: `neo4j` (official driver)
- Docs: [Neo4j Python Driver](https://neo4j.com/docs/python-manual/current/)
- Version: 5.15.0+ (compatible with Neo4j 5.15-community)
- Connection pooling built-in (max_connection_pool_size)

**Neo4j Already Running:**
- Docker container configured in E1-7
- URI: `bolt://localhost:7687`
- Credentials: `neo4j` / `mandadev123`
- Neo4j Browser: `http://localhost:7474`

### Architecture Context

**Hybrid Database Strategy:**
- **PostgreSQL (Supabase)**: Source of truth for findings, documents, chunks, embeddings
- **Neo4j**: Knowledge graph for relationships, cross-domain patterns, contradiction detection

**Why Sync to Neo4j?**
- **Graph Queries**: Traverse relationships (e.g., "Find all findings extracted from this document")
- **Contradiction Detection**: Find conflicting findings using graph traversals + temporal metadata
- **Agent Tools**: `query_knowledge_base`, `validate_finding` use Neo4j for context
- **Source Attribution**: Chain of evidence from finding → document → project

**Error Handling Philosophy:**
- PostgreSQL write failure → Job fails (critical)
- Neo4j write failure → Log error, continue (best-effort)
- Rationale: PostgreSQL is source of truth, Neo4j is derived data (can backfill)

### Neo4j Graph Model (from E1-7)

**Nodes:**
- `:Finding` - Extracted fact with properties: `id`, `content`, `type`, `confidence`, `domain`, `date_referenced`, `date_extracted`, `user_id`, `project_id`
- `:Document` - Uploaded file with properties: `id`, `name`, `project_id`, `upload_date`, `doc_type`
- `:Deal` - Project/deal (not used in this story, future)

**Relationships:**
- `EXTRACTED_FROM` - Finding → Document (implemented in this story)
- `CONTRADICTS` - Finding → Finding (E4-7 contradiction detection)
- `SUPERSEDES` - Finding → Finding (future, temporal updates)
- `SUPPORTS` - Finding → Finding (future, corroboration)
- `PATTERN_DETECTED` - Finding → Finding (future, cross-domain patterns)

**Indexes and Constraints (from E1-7):**
- Constraints: `finding_id_unique`, `document_id_unique`, `deal_id_unique`
- Indexes: `finding_date_referenced`, `finding_user_id`, `finding_domain`, `document_project_id`

### Connection Management

**Singleton Driver Pattern:**
```python
_driver: Driver | None = None

def get_neo4j_driver() -> Driver:
    global _driver
    if _driver is None:
        _driver = GraphDatabase.driver(uri, auth, max_connection_pool_size=10)
    return _driver
```

**Session Management:**
```python
with driver.session() as session:
    session.run("CREATE (f:Finding {id: $id})", id=finding_id)
    # Session auto-closed
```

**Best Practices:**
- One driver per application (singleton)
- Short-lived sessions (use `with` statement)
- Connection pooling handles concurrency (10 max connections for 5 worker threads)

### Performance Considerations

**Neo4j Write Performance:**
- Creating 8 Finding nodes + 8 relationships: ~200-500ms
- Negligible impact on total job time (~5-10s for Gemini analysis)

**Batch Writes (Future Optimization):**
- For large documents with >50 findings, use `UNWIND` for batch inserts
- Not required for MVP (typical documents have 5-15 findings)

**Indexing:**
- Constraints ensure uniqueness (MERGE operations are idempotent)
- Indexes on `user_id`, `project_id` enable fast filtering for multi-tenancy

### Backfill Script Design

**Idempotent Design:**
- Use `MERGE` instead of `CREATE` (creates if missing, matches if exists)
- Safe to run multiple times (no duplicates)

**Progress Logging:**
```python
logger.info("Syncing finding", current=i+1, total=len(findings), finding_id=finding.id)
```

**Error Handling:**
- Catch exceptions per finding (don't fail entire backfill)
- Log failed finding IDs for manual investigation

### Testing Strategy

**Unit Tests:**
- Mock Neo4j driver using `pytest-mock`
- Test node creation functions with mock responses
- Test error handling when driver.session() raises exception

**Integration Tests:**
- Requires running Neo4j instance (Docker)
- Create test finding → verify in Neo4j → clean up
- Test backfill script with 1-2 sample findings

**Manual Testing:**
- Upload document → verify findings in Neo4j Browser
- Stop Neo4j → upload document → verify PostgreSQL write succeeds
- Run backfill → verify 8 Phase 4 findings appear in Neo4j

### Security and Multi-Tenancy

**User Isolation:**
- Every Finding node has `user_id` and `project_id` properties
- Agent queries MUST filter: `WHERE f.project_id = $project_id`
- No RLS in Neo4j Community Edition (application-level enforcement)

**Data Privacy:**
- Neo4j not exposed publicly (only accessible within Docker network)
- Bolt protocol (7687) only accessible from backend services
- Browser (7474) accessible only in development

### Dependencies and Prerequisites

**From E1-7:**
- Neo4j 5.15-community running in Docker ✅
- Neo4j schema defined (constraints, indexes) ✅
- Environment variables configured ✅

**From Phase 4:**
- Gemini 2.5 Flash extracting findings ✅
- Findings stored in PostgreSQL ✅
- 8 test findings ready for backfill ✅

**New Dependencies:**
- `neo4j` Python driver (to be installed)

### Expected Outcomes

**After Story Completion:**
1. New document upload → Findings extracted by Gemini → Stored in PostgreSQL + Neo4j
2. Neo4j contains 8 Finding nodes from Phase 4 test (after backfill)
3. Knowledge graph queries work: count findings, filter by domain, traverse relationships
4. Error handling tested: Neo4j unavailable → PostgreSQL writes still succeed
5. Documentation updated: architecture, setup guides, code comments

**Enables Future Work:**
- E4-7 contradiction detection can query Neo4j for similar findings
- E5 agent tools can use Neo4j for source attribution chains
- E5 hybrid search can combine pgvector + Neo4j graph traversal
- Pattern detection (future epic) can use PATTERN_DETECTED relationships

### References

**Architecture:**
- [Source: docs/sprint-artifacts/NEO4J_ARCHITECTURE_EXPLAINED.md](./NEO4J_ARCHITECTURE_EXPLAINED.md)
- [Source: docs/sprint-artifacts/PHASE4_GEMINI_SETUP_COMPLETE.md](./PHASE4_GEMINI_SETUP_COMPLETE.md)
- [Source: docs/manda-architecture.md#Hybrid-Database-Strategy]

**Previous Stories:**
- [E1-7: Configure Neo4j Graph Database](./e1-7-configure-neo4j-graph-database.md) - Neo4j setup and schema
- [E4-7: Detect Contradictions Using Neo4j](./e4-7-detect-contradictions-using-neo4j.md) - LLM contradiction detector
- [E4-13: Build Real-Time Knowledge Graph Updates](./e4-13-build-real-time-knowledge-graph-updates.md) - Frontend realtime hooks

**Official Documentation:**
- [Neo4j Python Driver Manual](https://neo4j.com/docs/python-manual/current/)
- [Neo4j Cypher Manual](https://neo4j.com/docs/cypher-manual/current/)
- [Neo4j Driver Best Practices](https://neo4j.com/developer/kb/neo4j-driver-best-practices/)

## Dev Agent Record

### Context Reference

(Story context will be generated when story is marked ready-for-dev)

### Agent Model Used

(TBD when story is implemented)

### Debug Log References

(TBD when story is implemented)

### Completion Notes List

(TBD when story is implemented)

### File List

**To Be Created:**
- `manda-processing/src/storage/neo4j_client.py` - Neo4j driver singleton and node creation functions
- `manda-processing/src/storage/neo4j_schema.py` - Schema initialization (constraints, indexes)
- `manda-processing/src/scripts/backfill_neo4j.py` - Backfill script for existing findings
- `manda-processing/tests/test_neo4j_client.py` - Unit tests

**To Be Modified:**
- `manda-processing/src/jobs/handlers/analyze_document.py` - Add Neo4j sync after PostgreSQL storage
- `manda-processing/src/jobs/__main__.py` - Call `initialize_neo4j_schema()` on startup
- `manda-processing/src/config.py` - Add Neo4j settings (uri, user, password)
- `manda-processing/requirements.txt` - Add `neo4j>=5.15.0`
- `docs/manda-architecture.md` - Document Neo4j sync in pipeline
- `docs/sprint-artifacts/PHASE4_GEMINI_SETUP_COMPLETE.md` - Update pipeline flow
- `manda-processing/README.md` - Document Neo4j client and backfill script

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2025-12-12 | Dev Agent (Amelia) | Initial story draft created from manual testing findings and architecture analysis |
