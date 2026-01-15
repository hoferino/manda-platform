# Sprint Change Proposal: Knowledge Architecture Evolution

**Date:** 2025-12-15
**Triggered By:** Architecture review with PM — Neo4j consolidation and GraphRAG research
**Status:** APPROVED
**Scope:** Major (Architectural change requiring PM/Architect review)
**Supersedes:** Portions of sprint-change-proposal-2025-12-14.md (E10 scope expansion)

---

## 1. Issue Summary

### Problem Statement

During architecture review, we identified that the current dual-database approach (pgvector + Neo4j) creates unnecessary complexity and limits the system's ability to perform hybrid queries. Additionally:

1. **pgvector was chosen based on outdated assumptions** — Neo4j 5.18+ now supports native vector indexes with HNSW, making it capable of both semantic search AND graph traversal in single queries.

2. **E10 as originally scoped is insufficient** — The original E10 focused on "syncing findings to Neo4j" but doesn't address the fundamental architecture question: why maintain two databases for embeddings?

3. **Dynamic ontology is critical for M&A** — Every deal is different. The hardcoded schema approach doesn't scale. We need LLM-driven entity discovery with a stable "sell-side spine."

4. **Buy-side due diligence is on the roadmap** — Future buy-side features require temporal reasoning ("What did management claim vs. what we found?"). The architecture should support this from day one.

5. **No reranking in current design** — RAG best practices show 20-35% accuracy improvement with reranking, which we're missing.

### Context

- Phase 1 MVP complete (E1-E9)
- E10 and E11 defined but not started
- Pre-GTM — we have time to build the right architecture
- No production data to migrate

### Evidence

Research conducted via PM workflow session:
- [Neo4j Vector Indexes Documentation](https://neo4j.com/docs/cypher-manual/current/indexes/semantic-indexes/vector-indexes/)
- [Graphiti Knowledge Graph Framework](https://github.com/getzep/graphiti)
- [Voyage AI Embeddings](https://docs.voyageai.com/docs/embeddings)
- [Neo4j GraphRAG Python Package](https://neo4j.com/docs/neo4j-graphrag-python/current/user_guide_rag.html)

---

## 2. Architecture Decisions

### 2.1 Database Consolidation: Neo4j as Primary Knowledge Store

| Component | Current (Documented) | Proposed |
|-----------|---------------------|----------|
| **Embeddings** | pgvector (PostgreSQL) | Neo4j native vector indexes |
| **Graph relationships** | Neo4j | Neo4j (unchanged) |
| **Semantic search** | pgvector | Neo4j VectorRetriever |
| **Hybrid search** | Two-step (pgvector → Neo4j) | Single Neo4j query |
| **Transactional data** | PostgreSQL/Supabase | PostgreSQL/Supabase (unchanged) |
| **Auth/RLS** | Supabase | Supabase (unchanged) |

**Rationale:**
- Neo4j 5.18+ supports native HNSW vector indexes (up to 4096 dimensions)
- Hybrid queries combine vector similarity + graph traversal in ONE Cypher query
- Eliminates dual-database sync complexity
- Single source of truth for knowledge

**PostgreSQL/Supabase retains:**
- User authentication (Supabase Auth)
- Deal, document, user metadata
- Q&A items, IRL items, CIM workflow state
- Job queue (pg-boss)
- Row-level security for multi-tenancy

### 2.2 Knowledge Graph Framework: Graphiti

| Aspect | Without Graphiti | With Graphiti |
|--------|------------------|---------------|
| **Temporal model** | Manual timestamps | Bi-temporal (valid_at, invalid_at) built-in |
| **Entity resolution** | Custom implementation | Built-in fuzzy + semantic matching |
| **Conflict detection** | Manual | Automatic — new facts can invalidate old |
| **Schema evolution** | Migration scripts | Dynamic, LLM-driven discovery |
| **Buy-side readiness** | Would need migration | Ready from day one |

**Rationale:**
- Graphiti uses Neo4j as backend — same infrastructure
- Bi-temporal model supports future buy-side due diligence
- Automatic entity resolution reduces duplicates
- Dynamic ontology discovery with stable "spine" schema
- P95 retrieval latency ~300ms — production-ready

### 2.3 Embedding Model: Voyage Finance

| Model | Dimensions | Context | Domain | Price |
|-------|------------|---------|--------|-------|
| ~~OpenAI text-embedding-3-large~~ | 3072 | 8K | General | $0.13/1M |
| **voyage-finance-2** | 1024 | 32K | Finance | ~$0.06/1M |

**Rationale:**
- Purpose-built for financial document retrieval
- Outperforms OpenAI on finance/legal benchmarks by ~10%
- 32K context window (4x OpenAI) — handles long M&A documents
- Lower cost, smaller dimensions (1024 vs 3072) — more efficient storage

### 2.4 Reranking: Always Applied

| Stage | Action | Latency |
|-------|--------|---------|
| 1. Hybrid Search | Vector + BM25 + Graph → 50 candidates | ~300ms |
| 2. Rerank | Voyage Reranker → Top 5-10 | ~200-300ms |
| 3. LLM Response | Generate answer with citations | ~1-2s |
| **Total** | | **~2-3s** |

**Rationale:**
- Reranking improves RAG accuracy by 20-35%
- 2-3 second latency acceptable for chat queries
- Applied to all queries (no conditional logic)

### 2.5 Dynamic Ontology: Sell-Side Spine + Discovery

**Core Entities (stable across all deals):**

```python
# Defined as Pydantic models for Graphiti
class Company(BaseModel):
    name: str
    role: Literal["target", "acquirer", "competitor", "customer", "supplier", "investor"]
    industry: str | None

class Person(BaseModel):
    name: str
    title: str | None
    role: Literal["executive", "advisor", "board", "investor", "employee"]

class FinancialMetric(BaseModel):
    metric_type: str  # revenue, ebitda, margin, growth_rate
    value: float
    period: str  # Q3 2024, FY 2023
    currency: str = "USD"
    basis: str | None  # GAAP, adjusted, pro_forma

class Finding(BaseModel):
    content: str
    confidence: float
    source_channel: Literal["document", "qa_response", "meeting_note", "analyst_chat"]

class Risk(BaseModel):
    description: str
    severity: Literal["high", "medium", "low"]
    category: str
```

**Dynamic Discovery:**
- Graphiti discovers deal-specific entities (Patent, Earnout, Regulatory Approval, etc.)
- LLM classifies entities during extraction
- Automatic deduplication prevents schema sprawl

**Key Relationships:**
- `EXTRACTED_FROM` — Finding → Document (provenance)
- `MENTIONS` — Finding → Entity
- `SUPERSEDES` — Finding → Finding (new truth replaces old)
- `CONTRADICTS` — Finding → Finding (unresolved conflict)
- `SUPPORTS` — Finding → Finding (corroboration)

---

## 3. Impact Analysis

### Epic Impact

| Epic | Impact | Action |
|------|--------|--------|
| E1-E9 | None | Complete, no changes |
| **E10** | Major rewrite | Redefine around Graphiti + Neo4j consolidation |
| **E11** | Moderate updates | Knowledge write-back targets Neo4j, not pgvector |

### Artifact Conflicts

| Artifact | Conflict | Resolution |
|----------|----------|------------|
| **Architecture Doc** | pgvector references, embedding model | Needs update |
| **PRD** | Architecture decisions section | Needs update |
| **E10 Epic** | Entire scope changes | Rewrite |
| **E11 Epic** | E11.3 (write-back), E11.4 (retrieval) | Update targets |

### Technical Impact

| Area | Change |
|------|--------|
| **manda-processing** | Replace pgvector writes with Graphiti ingestion |
| **Neo4j schema** | Adopt Graphiti node/edge model |
| **Embedding generation** | Switch from OpenAI to Voyage |
| **Retrieval** | Graphiti hybrid search + reranking |
| **PostgreSQL** | Remove embedding columns from findings table |

---

## 4. Revised Epic 10: Knowledge Graph Foundation

### Epic Overview

**Epic ID:** E10
**Title:** Knowledge Graph Foundation (Graphiti + Neo4j)
**Priority:** P0

**User Value:** The system builds a living, temporal knowledge graph that understands M&A entities, resolves duplicates, tracks truth evolution, and enables powerful hybrid retrieval — setting the foundation for both sell-side and future buy-side intelligence.

### Stories

#### E10.1: Graphiti Infrastructure Setup
**Points:** 5

**Description:**
Set up Graphiti with Neo4j backend, configure for M&A use case.

**Acceptance Criteria:**
- [ ] Graphiti installed and configured with Neo4j 5.26+
- [ ] group_id namespacing configured for deal isolation
- [ ] Connection pooling and error handling
- [ ] Local development environment working
- [ ] Basic smoke test: ingest text → query graph

**Technical Notes:**
- Use Graphiti's Neo4j backend (not FalkorDB)
- Configure OpenAI for LLM calls during extraction (or Gemini if supported)
- Set up Voyage API for embeddings

---

#### E10.2: Voyage Embedding Integration
**Points:** 3

**Description:**
Replace OpenAI embeddings with voyage-finance-2 for domain-optimized retrieval.

**Acceptance Criteria:**
- [ ] Voyage API client configured
- [ ] voyage-finance-2 model selected (1024 dimensions)
- [ ] Embedding generation integrated with Graphiti pipeline
- [ ] Fallback to OpenAI if Voyage unavailable
- [ ] Cost tracking per embedding call

**Technical Notes:**
- Update embedding dimension from 3072 to 1024 throughout
- Remove pgvector index creation from migrations
- Document Voyage API key setup

---

#### E10.3: Sell-Side Spine Schema
**Points:** 5

**Description:**
Define core M&A entity types as Pydantic models for Graphiti's guided extraction.

**Acceptance Criteria:**
- [ ] Pydantic models for: Company, Person, Deal, Document, FinancialMetric, Finding, Risk
- [ ] Entity type definitions registered with Graphiti
- [ ] Dynamic discovery enabled (`additional_node_types=True` equivalent)
- [ ] Relationship types defined (SUPERSEDES, CONTRADICTS, SUPPORTS, MENTIONS, EXTRACTED_FROM)
- [ ] Documentation for extending schema

**Technical Notes:**
- Balance guidance vs. flexibility
- Core types are stable; deal-specific types discovered
- Test with sample M&A documents

---

#### E10.4: Document Ingestion Pipeline
**Points:** 8

**Description:**
Integrate Docling parsing with Graphiti ingestion for documents.

**Acceptance Criteria:**
- [ ] Document upload triggers Graphiti episode creation
- [ ] Docling chunks become episode content
- [ ] Entity extraction runs on each chunk
- [ ] Entities linked to source document with provenance
- [ ] Embeddings generated and stored in Neo4j
- [ ] Processing status tracked in PostgreSQL

**Technical Notes:**
- Replace current pgvector write path
- Maintain document metadata in PostgreSQL
- Episode = document chunk in Graphiti terms

---

#### E10.5: Q&A and Chat Ingestion
**Points:** 5

**Description:**
Ingest Q&A responses and analyst chat as first-class knowledge sources.

**Acceptance Criteria:**
- [ ] Q&A answer updates create Graphiti episodes
- [ ] Chat-provided facts create episodes with source_channel="analyst_chat"
- [ ] New facts can SUPERSEDE document-extracted facts
- [ ] Confidence scoring: analyst-provided > document-extracted
- [ ] Provenance chain maintained (Finding → QAItem or Message)

**Technical Notes:**
- This is the "living truth" mechanism
- When client answers Q&A, that becomes authoritative
- Temporal model tracks when truth changed

---

#### E10.6: Entity Resolution
**Points:** 5

**Description:**
Configure and tune Graphiti's entity resolution for M&A naming variations.

**Acceptance Criteria:**
- [ ] Fuzzy matching catches "ABC Corp" = "ABC Corporation"
- [ ] Semantic matching for context-based resolution
- [ ] Manual merge/split capability (UI in future story)
- [ ] Resolution confidence thresholds tuned
- [ ] Test with real M&A entity variations

**Technical Notes:**
- Graphiti has built-in resolution — tune, don't rebuild
- Track resolution decisions for audit
- Flag low-confidence matches for review

---

#### E10.7: Hybrid Retrieval with Reranking
**Points:** 8

**Description:**
Implement retrieval pipeline: Graphiti search → Voyage rerank → LLM.

**Acceptance Criteria:**
- [ ] Graphiti hybrid search (vector + BM25 + graph)
- [ ] Retrieve top 50 candidates
- [ ] Voyage reranker scores and reorders
- [ ] Return top 5-10 to LLM
- [ ] Latency < 3 seconds end-to-end
- [ ] Source citations in responses

**Technical Notes:**
- All queries go through this pipeline
- No conditional reranking — always applied
- Test with various query types (factual, comparative, exploratory)

---

#### E10.8: PostgreSQL Cleanup
**Points:** 3

**Description:**
Remove pgvector dependencies now that embeddings live in Neo4j.

**Acceptance Criteria:**
- [ ] Remove embedding columns from findings table
- [ ] Remove pgvector extension usage
- [ ] Update document_chunks table (if keeping for reference)
- [ ] Migration script for schema changes
- [ ] Verify no broken queries

**Technical Notes:**
- Keep PostgreSQL for transactional data
- This is cleanup, not migration (no production data)

---

### E10 Summary

| Story | Points | Description |
|-------|--------|-------------|
| E10.1 | 5 | Graphiti Infrastructure Setup |
| E10.2 | 3 | Voyage Embedding Integration |
| E10.3 | 5 | Sell-Side Spine Schema |
| E10.4 | 8 | Document Ingestion Pipeline |
| E10.5 | 5 | Q&A and Chat Ingestion |
| E10.6 | 5 | Entity Resolution |
| E10.7 | 8 | Hybrid Retrieval with Reranking |
| E10.8 | 3 | PostgreSQL Cleanup |
| **Total** | **42** | |

---

## 5. Impact on Epic 11

E11 (Agent Context Engineering) remains largely valid but needs updates:

| Story | Change |
|-------|--------|
| E11.1 (Tool Compression) | No change |
| E11.2 (Summarization) | No change |
| **E11.3 (Knowledge Write-Back)** | Target Graphiti, not pgvector |
| **E11.4 (Intent-Aware Retrieval)** | Use Graphiti search, not pgvector |
| E11.5 (Pydantic AI) | No change |
| E11.6 (Model Config) | Add Voyage to config |
| E11.7 (Integration Tests) | Update for Graphiti |

---

## 6. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MANDA KNOWLEDGE ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  INGESTION LAYER                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Documents (PDF, Excel, Word)  →  Docling Parser  →  Chunks            ││
│  │  Q&A Responses                 →  Direct Input    →  Episodes          ││
│  │  Meeting Notes                 →  Chat/Upload     →  Episodes          ││
│  │  Analyst Findings              →  Agent Chat      →  Episodes          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                      ↓                                       │
│  EXTRACTION LAYER (Graphiti + LLM)                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  • Entity Extraction (Companies, People, Metrics, Contracts, etc.)     ││
│  │  • Relationship Extraction (WORKS_FOR, SUPPLIES, CONTRADICTS, etc.)    ││
│  │  • Entity Resolution (fuzzy + semantic matching)                       ││
│  │  • Temporal Tagging (valid_at, invalid_at, created_at)                 ││
│  │  • Dynamic Ontology (sell-side spine + deal-specific discovery)        ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                      ↓                                       │
│  STORAGE LAYER                                                               │
│  ┌────────────────────────────────┐  ┌────────────────────────────────────┐ │
│  │  GRAPHITI + NEO4J              │  │  POSTGRESQL (SUPABASE)             │ │
│  │                                │  │                                    │ │
│  │  • Entity Nodes (with embeds)  │  │  • deals, users, documents meta   │ │
│  │  • Episode Nodes (raw chunks)  │  │  • qa_items, irl_items            │ │
│  │  • Fact Edges (temporal)       │  │  • cims, conversations            │ │
│  │  • Vector Indexes (1024d)      │  │  • job queue (pg-boss)            │ │
│  │  • BM25 Full-text Indexes      │  │  • auth (Supabase Auth + RLS)     │ │
│  │                                │  │                                    │ │
│  │  voyage-finance-2 embeddings   │  │  Transactional data only          │ │
│  └────────────────────────────────┘  └────────────────────────────────────┘ │
│                                      ↓                                       │
│  RETRIEVAL LAYER                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  1. Graphiti Hybrid Search (vector + BM25 + graph) → 50 candidates     ││
│  │  2. Voyage Reranker → Score and reorder → Top 5-10                     ││
│  │  3. LLM (Claude/Gemini) → Generate response with citations             ││
│  │                                                                         ││
│  │  Total latency: ~2-3 seconds                                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Implementation Approach

### Phase 1: Foundation (E10.1-E10.3)
- Set up Graphiti + Neo4j
- Integrate Voyage embeddings
- Define sell-side spine schema

### Phase 2: Ingestion (E10.4-E10.5)
- Document processing pipeline
- Q&A and chat ingestion
- Truth supersession mechanism

### Phase 3: Retrieval (E10.6-E10.7)
- Entity resolution tuning
- Hybrid search + reranking pipeline

### Phase 4: Cleanup (E10.8)
- Remove pgvector dependencies
- Update E11 stories

---

## 8. Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Graphiti learning curve | Medium | Start with simple ingestion, iterate |
| Voyage API availability | Low | Fallback to OpenAI embeddings |
| Neo4j vector performance | Low | Well-documented, production-proven |
| Increased Neo4j complexity | Medium | Clear separation: Neo4j=knowledge, Postgres=transactional |
| Timeline expansion | Medium | E10 grew from 26 to 42 points — plan accordingly |

---

## 9. Success Criteria

1. **Unified knowledge store** — All embeddings and graph in Neo4j
2. **Hybrid queries work** — Vector + graph in single Cypher query
3. **Entity resolution active** — "ABC Corp" = "ABC Corporation" automatically
4. **Truth supersession works** — Q&A answer > document fact
5. **Retrieval accuracy** — Measurable improvement with reranking
6. **Latency acceptable** — <3 seconds for chat queries
7. **Buy-side ready** — Temporal model supports future features

---

## 10. Approval

### Requested Decision

Approve this architectural evolution:
- [ ] Consolidate embeddings to Neo4j (remove pgvector)
- [ ] Adopt Graphiti for knowledge graph management
- [ ] Switch to voyage-finance-2 embeddings
- [ ] Add reranking to retrieval pipeline
- [ ] Rewrite E10 with expanded scope (42 points)
- [ ] Update E11 for Graphiti integration

### Approval

**Status:** APPROVED

**Approved By:** Max

**Date:** 2025-12-15

---

## References

- [Neo4j Vector Indexes Documentation](https://neo4j.com/docs/cypher-manual/current/indexes/semantic-indexes/vector-indexes/)
- [Neo4j GraphRAG Python User Guide](https://neo4j.com/docs/neo4j-graphrag-python/current/user_guide_rag.html)
- [Graphiti GitHub Repository](https://github.com/getzep/graphiti)
- [Graphiti: Knowledge Graph Memory for an Agentic World](https://neo4j.com/blog/developer/graphiti-knowledge-graph-memory/)
- [Voyage AI Embeddings Documentation](https://docs.voyageai.com/docs/embeddings)
- [Voyage-3-large Announcement](https://blog.voyageai.com/2025/01/07/voyage-3-large/)
- [Top Rerankers for RAG](https://www.analyticsvidhya.com/blog/2025/06/top-rerankers-for-rag/)
- [LangChain Neo4j Integration](https://neo4j.com/labs/genai-ecosystem/langchain/)

---

**Document Version:** 1.0
**Created:** 2025-12-15
**Author:** PM Agent (Correct-Course Workflow)
