# Sprint Change Proposal: Fast Path Document Retrieval

**Date:** 2026-01-05
**Author:** Claude (PM Agent)
**Status:** Pending Approval
**Change Scope:** Minor
**Triggered By:** E10.4 (Document Ingestion Pipeline) validation testing

---

## 1. Issue Summary

### Problem Statement

During validation testing of the E10 Knowledge Graph pipeline, a significant user experience issue was identified: **documents cannot be queried immediately after upload**. The current Graphiti ingestion pipeline requires 2-3 minutes per chunk for LLM-based entity extraction, meaning a 100-page document could take 30+ minutes before becoming queryable.

### Context

This issue was discovered during E10.4 pipeline validation on 2026-01-05. User feedback confirmed the severity:

> "When I upload documents into Claude I can almost immediately start asking questions. This should probably work here too."

### Evidence

| Metric | Current | Expected |
|--------|---------|----------|
| Time to first query | 2-3 min/chunk | < 5 seconds |
| 50-doc batch availability | ~1-2 hours | < 1 minute |
| 1000-doc bulk upload | 10+ hours | < 5 minutes |

### User Impact

- **Analyst workflow disruption:** Analysts read documents immediately after upload and expect to ask questions
- **Single-document use cases blocked:** Users uploading one Excel file for financial modeling cannot query it
- **Batch upload friction:** Real-world usage involves 50 docs/day typical, up to 1000 in bulk

---

## 2. Impact Analysis

### Epic Impact

| Epic | Status | Impact |
|------|--------|--------|
| E10 (Knowledge Graph Foundation) | Completed | Source of issue - architecture limitation, not failure |
| E11 (Agent Context Engineering) | Completed | Uses E10 retrieval - will benefit from enhancement |
| E12 (Production Readiness) | In Progress | Recommended location for new story |

**Assessment:** No existing epics need modification. This is an **additive enhancement** that complements the existing architecture.

### Artifact Conflicts

| Artifact | Conflict? | Action Needed |
|----------|-----------|---------------|
| PRD | Minor | Add "Immediate Availability" principle |
| Architecture | Yes | Document two-tier retrieval pipeline |
| UI/UX Specs | No | No visual changes |
| Epics | No | Add new story to E12 |

### Technical Impact

- **Neo4j:** New ChunkNode type and vector index (uses existing infrastructure)
- **Voyage:** Same voyage-3.5 embeddings already in use
- **Python worker:** New `embed-chunks` job handler (parallel to `ingest-graphiti`)
- **Retrieval service:** Two-tier search logic (fast path + knowledge graph)

---

## 3. Recommended Approach

### Selected Path: Direct Adjustment (Option 1)

Add new story E12.10 to implement "Fast Path Document Retrieval" without modifying existing completed work.

### Rationale

1. **Uses existing infrastructure** - Neo4j already has vector index capability; Voyage embeddings already configured
2. **Parallel, not replacement** - Fast path runs alongside Graphiti extraction, doesn't disrupt it
3. **Low risk** - Additive change with clear fallback (if fast path fails, use knowledge graph)
4. **High value** - Directly addresses critical user workflow pain point
5. **Minimal effort** - Estimated 8 story points

### Trade-offs Considered

| Alternative | Why Not Selected |
|-------------|------------------|
| Speed up Graphiti extraction | LLM calls are inherently slow; would require major architecture change |
| Add pgvector back | Rejected by user; introduces complexity of dual-database sync |
| Make users wait | Unacceptable UX; doesn't match market expectations |

### Effort Estimate: **Medium (8 points)**

### Risk Assessment: **Low**

- Uses proven technologies (Neo4j vectors, Voyage embeddings)
- Doesn't modify existing knowledge graph pipeline
- Clear fallback behavior

---

## 4. Detailed Change Proposals

### 4.1 New Story: E12.10 Fast Path Document Retrieval

**File:** `docs/sprint-artifacts/epics/epic-E12.md` (append to stories)

```markdown
### E12.10: Fast Path Document Retrieval
**Points:** 8
**Priority:** P1

**Description:**
Enable immediate document querying after upload by creating a parallel "fast path"
that embeds chunks directly into Neo4j without waiting for LLM-based entity extraction.

**User Value:**
Analysts can start asking questions about uploaded documents immediately (within seconds),
rather than waiting for full knowledge graph extraction (2-3 minutes per chunk).

**Acceptance Criteria:**
- [ ] ChunkNode type created in Neo4j with content, embedding (1024d), and metadata
- [ ] Vector index created: CREATE VECTOR INDEX chunk_embeddings FOR (c:Chunk) ON (c.embedding)
- [ ] Document upload triggers immediate chunk embedding (parallel to ingest-graphiti job)
- [ ] Retrieval pipeline queries ChunkNodes when knowledge graph has no results
- [ ] Latency < 500ms for chunk-based retrieval
- [ ] Graceful degradation: if fast path fails, wait for knowledge graph
- [ ] Multi-tenant isolation via group_id on ChunkNodes
- [ ] Test with 100-document bulk upload

**Technical Notes:**
- New job handler: embed_chunks.py (runs in parallel with ingest_graphiti.py)
- Neo4j schema: (:Chunk {id, content, embedding, document_id, deal_id, group_id, created_at})
- Uses existing Voyage voyage-3.5 (1024d) - same as Graphiti
- group_id format: {organization_id}_{deal_id} (matches E12.9)

**Files to create/modify:**
- manda-processing/src/jobs/handlers/embed_chunks.py (new)
- manda-processing/src/graphiti/retrieval.py (add chunk search)
- manda-processing/src/neo4j/schema.py (add Chunk node)
- docs/manda-architecture.md (document two-tier retrieval)
```

---

### 4.2 Architecture Document Update

**File:** `docs/manda-architecture.md`
**Section:** Knowledge Graph Architecture > Retrieval Pipeline

**OLD:**
```markdown
#### Retrieval Pipeline

User Query → Graphiti Hybrid Search → Voyage Reranker → LLM Response
Total latency: ~2-3 seconds
```

**NEW:**
```markdown
#### Retrieval Pipeline (Two-Tier)

The retrieval system uses a two-tier approach to balance immediacy with depth:

**Tier 1: Fast Path (ChunkNodes) - Available immediately after upload**
- Neo4j vector search on ChunkNodes
- Direct chunk content retrieval
- Latency: ~300ms

**Tier 2: Deep Path (Knowledge Graph) - Available after extraction**
- Graphiti hybrid search (vector + BM25 + graph)
- Entity-aware retrieval with relationships
- Latency: ~2-3 seconds

**Strategy:**
1. Try Tier 2 first for semantic richness
2. Fall back to Tier 1 if Tier 2 returns no results
3. User can force "raw search" for Tier 1 only
```

---

### 4.3 PRD Enhancement

**File:** `docs/manda-prd.md`
**Section:** Core Principles

**ADD after line 313:**
```markdown
- **Immediate Availability**: Documents become queryable within seconds of upload
  via fast vector search, while deeper knowledge graph extraction continues in background
```

---

## 5. Implementation Handoff

### Change Scope Classification: **Minor**

This change can be implemented directly by the development team without broader organizational coordination.

### Handoff Recipients

| Role | Responsibility |
|------|----------------|
| Dev Team | Implement E12.10 story |
| PM | Update PRD with new principle |
| Tech Lead | Update architecture documentation |

### Implementation Tasks

1. **Create Neo4j Chunk schema** (1 point)
   - Add ChunkNode type definition
   - Create vector index
   - Add to docker-compose Neo4j init

2. **Implement embed_chunks job handler** (3 points)
   - Parallel job triggered after document-parse
   - Uses existing Voyage client
   - Writes ChunkNodes to Neo4j

3. **Update retrieval service** (3 points)
   - Add chunk_search() method
   - Implement two-tier fallback logic
   - Integrate with existing GraphitiRetrievalService

4. **Testing and documentation** (1 point)
   - Integration tests for fast path
   - Update architecture docs
   - Test bulk upload scenario

### Success Criteria

- [ ] Documents queryable within 5 seconds of upload
- [ ] No degradation of knowledge graph quality
- [ ] Multi-tenant isolation maintained
- [ ] Bulk upload (100 docs) completes fast path in < 1 minute

---

## 6. Appendix

### Checklist Completion Summary

| Section | Status | Notes |
|---------|--------|-------|
| 1. Trigger & Context | [x] Done | E10.4 validation |
| 2. Epic Impact | [x] Done | Additive to E12 |
| 3. Artifact Conflicts | [x] Done | Minor PRD/Arch updates |
| 4. Path Forward | [x] Done | Option 1: Direct Adjustment |
| 5. Proposal Components | [x] Done | All documented |
| 6. Final Review | [ ] Pending | Awaiting approval |

### Related Documents

- [E10 Epic](epics/epic-E10.md) - Knowledge Graph Foundation
- [Bugfix Report 2026-01-05](bugfixes/bugfix-2026-01-05-graphiti-pipeline.md) - Pipeline fixes
- [Architecture v4.1](../manda-architecture.md) - Current architecture

---

**Document Version:** 1.0
**Created:** 2026-01-05
**Workflow:** correct-course (BMAD BMM)
