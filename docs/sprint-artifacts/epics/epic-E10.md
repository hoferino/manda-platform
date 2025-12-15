# Epic 10: Knowledge Graph Foundation (Graphiti + Neo4j)

**Epic ID:** E10
**Jira Issue:** SCRUM-10
**Priority:** P0

**User Value:** The system builds a living, temporal knowledge graph that understands M&A entities, resolves duplicates, tracks truth evolution, and enables powerful hybrid retrieval — setting the foundation for both sell-side and future buy-side intelligence.

---

## Description

This epic implements the Knowledge Architecture Evolution approved in [Sprint Change Proposal 2025-12-15](../../sprint-change-proposal-2025-12-15.md). Key changes:

1. **Consolidate to Graphiti + Neo4j** — Single knowledge store replacing pgvector + Neo4j dual-database
2. **Voyage finance-2 embeddings** — Domain-optimized for M&A (1024d, 32K context)
3. **Reranking pipeline** — Voyage rerank-2.5 for 20-35% accuracy improvement
4. **Dynamic ontology** — Sell-side spine schema + LLM-discovered entities
5. **Bi-temporal model** — Truth evolution tracking for living knowledge base

---

## Technical Context

### Previous Architecture (v3.x)

```
PostgreSQL (Supabase)           Neo4j
├── documents                   ├── :Deal
├── document_chunks             ├── :Document
│   └── embedding (pgvector)    ├── :Finding ← NOT SYNCED
├── findings                    └── :Insight
│   └── embedding (pgvector)
└── qa_items
```

**Problems:**
- pgvector and Neo4j required sync (never implemented)
- Two-step retrieval: pgvector → then Neo4j
- Hardcoded schema didn't fit M&A deal diversity
- No temporal model for truth evolution

### New Architecture (v4.0)

```
PostgreSQL (Supabase)           Graphiti + Neo4j
├── deals                       ├── :Episode (raw chunks)
├── documents (metadata only)   │   └── embedding (1024d)
├── users                       ├── :Entity (resolved)
├── qa_items                    │   └── embedding (1024d)
├── irl_items                   └── Fact Edges (temporal)
├── conversations                   ├── valid_at
└── pg-boss (jobs)                  └── invalid_at

NO EMBEDDINGS                   ALL KNOWLEDGE
```

---

## Stories

### E10.1: Graphiti Infrastructure Setup
**Points:** 5

**Description:**
Set up Graphiti with Neo4j backend, configure for M&A use case.

**Acceptance Criteria:**
- [ ] Graphiti installed and configured with Neo4j 5.26+
- [ ] group_id namespacing configured for deal isolation
- [ ] Connection pooling and error handling
- [ ] Local development environment working (Docker Compose)
- [ ] Basic smoke test: ingest text → query graph
- [ ] Documentation for local setup

**Technical Notes:**
- Use Graphiti's Neo4j backend (not FalkorDB)
- Configure OpenAI or Gemini for LLM calls during extraction
- Neo4j Community Edition (self-hosted, Docker)
- Update docker-compose.yml with Neo4j 5.26+ image

**Files to create/modify:**
- `manda-processing/src/graphiti/client.py`
- `manda-processing/src/graphiti/config.py`
- `docker/docker-compose.yml`
- `docs/setup/graphiti-local-setup.md`

---

### E10.2: Voyage Embedding Integration
**Points:** 3

**Description:**
Replace OpenAI embeddings with voyage-finance-2 for domain-optimized retrieval.

**Acceptance Criteria:**
- [ ] Voyage API client configured
- [ ] voyage-finance-2 model selected (1024 dimensions)
- [ ] Embedding generation integrated with Graphiti pipeline
- [ ] Fallback to OpenAI if Voyage unavailable
- [ ] Cost tracking per embedding call
- [ ] Environment variable configuration (VOYAGE_API_KEY)

**Technical Notes:**
- Voyage dimensions: 1024 (down from 3072)
- Context window: 32K tokens
- Cost: $0.12/1M tokens (50M free tier)
- Update all dimension references throughout codebase

**Files to create/modify:**
- `manda-processing/src/embeddings/voyage.py`
- `manda-processing/src/embeddings/config.py`
- `.env.example` (add VOYAGE_API_KEY)

---

### E10.3: Sell-Side Spine Schema
**Points:** 5

**Description:**
Define core M&A entity types as Pydantic models for Graphiti's guided extraction.

**Acceptance Criteria:**
- [ ] Pydantic models for: Company, Person, Deal, Document, FinancialMetric, Finding, Risk
- [ ] Entity type definitions registered with Graphiti
- [ ] Dynamic discovery enabled for deal-specific entities
- [ ] Relationship types defined (SUPERSEDES, CONTRADICTS, SUPPORTS, etc.)
- [ ] Documentation for extending schema
- [ ] Test with sample M&A document

**Technical Notes:**
```python
# Core entities - these guide extraction but don't constrain it
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
    period: str       # Q3 2024, FY 2023
    currency: str = "USD"
    basis: str | None # GAAP, adjusted, pro_forma

class Finding(BaseModel):
    content: str
    confidence: float
    source_channel: Literal["document", "qa_response", "meeting_note", "analyst_chat"]

class Risk(BaseModel):
    description: str
    severity: Literal["high", "medium", "low"]
    category: str  # customer_concentration, key_person, regulatory
```

**Files to create/modify:**
- `manda-processing/src/graphiti/schema/entities.py`
- `manda-processing/src/graphiti/schema/relationships.py`
- `manda-processing/src/graphiti/schema/__init__.py`

---

### E10.4: Document Ingestion Pipeline
**Points:** 8

**Description:**
Integrate Docling parsing with Graphiti ingestion for documents.

**Acceptance Criteria:**
- [ ] Document upload triggers Graphiti episode creation
- [ ] Docling chunks become episode content
- [ ] Entity extraction runs on each chunk
- [ ] Entities linked to source document with provenance
- [ ] Embeddings generated (Voyage) and stored in Neo4j
- [ ] Processing status tracked in PostgreSQL
- [ ] Error handling and retry logic
- [ ] Test with PDF, Excel, Word documents

**Technical Notes:**
- Replace current pgvector write path in analyze_document handler
- Episode = document chunk in Graphiti terms
- Maintain document metadata in PostgreSQL (don't duplicate)
- Use group_id = deal_id for namespace isolation

**Processing Flow:**
```
Document Upload
    ↓
Docling Parse → Chunks
    ↓
For each chunk:
    → Create Graphiti Episode
    → LLM extracts entities
    → Entity resolution (dedupe)
    → Store with Voyage embeddings
    ↓
Update PostgreSQL document status
    ↓
WebSocket notification
```

**Files to modify:**
- `manda-processing/src/jobs/handlers/analyze_document.py`
- `manda-processing/src/graphiti/ingestion.py` (new)

---

### E10.5: Q&A and Chat Ingestion
**Points:** 5

**Description:**
Ingest Q&A responses and analyst chat as first-class knowledge sources.

**Acceptance Criteria:**
- [ ] Q&A answer updates create Graphiti episodes
- [ ] Chat-provided facts create episodes with source_channel="analyst_chat"
- [ ] New facts can SUPERSEDE document-extracted facts
- [ ] Confidence scoring: analyst-provided (0.95) > document-extracted (0.85)
- [ ] Provenance chain maintained (Finding → QAItem or Message)
- [ ] Test: Q&A answer supersedes document fact

**Example Flow:**
```
Document says: "Revenue = $4.8M" (confidence: 0.85)
    ↓
Client Q&A: "Revenue was actually $5.2M"
    ↓
System creates:
    - New Episode (source: qa_response)
    - New Fact with confidence: 0.95
    - Old fact marked invalid_at = now()
    - SUPERSEDES relationship created
    ↓
Query "What is revenue?" → Returns $5.2M
```

**Files to modify:**
- `manda-processing/src/graphiti/ingestion.py`
- `manda-app/lib/agent/tools/knowledge.ts` (trigger ingestion)

---

### E10.6: Entity Resolution
**Points:** 5

**Description:**
Configure and tune Graphiti's entity resolution for M&A naming variations.

**Acceptance Criteria:**
- [ ] Fuzzy matching catches "ABC Corp" = "ABC Corporation"
- [ ] Semantic matching for context-based resolution
- [ ] Resolution confidence thresholds tuned for M&A
- [ ] Manual merge/split capability (API endpoint, UI in future)
- [ ] Track resolution decisions for audit
- [ ] Test with real M&A entity variations

**Technical Notes:**
- Graphiti has built-in resolution — tune parameters, don't rebuild
- Threshold: >85% similarity for auto-merge
- Flag low-confidence matches for review
- Store aliases on Entity nodes

**Test Cases:**
- "ABC Corp" + "ABC Corporation" + "ABC Inc." → single entity
- "John Smith (CEO)" + "J. Smith" → likely same person
- "Revenue" vs "Revenues" vs "Net Revenue" → different metrics (don't merge)

**Files to modify:**
- `manda-processing/src/graphiti/resolution.py` (new)
- `manda-processing/src/graphiti/config.py`

---

### E10.7: Hybrid Retrieval with Reranking
**Points:** 8

**Description:**
Implement retrieval pipeline: Graphiti search → Voyage rerank → LLM.

**Acceptance Criteria:**
- [ ] Graphiti hybrid search (vector + BM25 + graph)
- [ ] Retrieve top 50 candidates
- [ ] Voyage reranker (rerank-2.5) scores and reorders
- [ ] Return top 5-10 to LLM
- [ ] Latency < 3 seconds end-to-end
- [ ] Source citations in responses
- [ ] Test with various query types

**Pipeline:**
```
User Query
    ↓
1. Graphiti Hybrid Search (~300ms)
   - Vector similarity (Voyage, 1024d)
   - BM25 full-text
   - Graph traversal (relationships)
   → 50 candidates
    ↓
2. Voyage Reranker (~200-300ms)
   - rerank-2.5 model
   - Score by query relevance
   → Top 5-10 results
    ↓
3. Format for LLM
   - Include source citations
   - Provenance links
   → Context for response generation
```

**Query Types to Test:**
- Factual: "What is Q3 revenue?"
- Comparative: "How does revenue compare to EBITDA?"
- Exploratory: "What are the key risks?"
- Entity-focused: "Tell me about the CEO"

**Files to create/modify:**
- `manda-processing/src/graphiti/retrieval.py` (new)
- `manda-processing/src/reranking/voyage.py` (new)
- `manda-app/lib/agent/tools/knowledge.ts` (use new retrieval)

---

### E10.8: PostgreSQL Cleanup
**Points:** 3

**Description:**
Remove pgvector dependencies now that embeddings live in Neo4j.

**Acceptance Criteria:**
- [ ] Remove embedding columns from findings table
- [ ] Remove pgvector extension usage from queries
- [ ] Update document_chunks table (keep for reference, remove embeddings)
- [ ] Migration script for schema changes
- [ ] Verify no broken queries
- [ ] Update TypeScript types

**Technical Notes:**
- This is cleanup, not migration (no production data)
- Keep PostgreSQL for transactional data
- Findings table becomes metadata-only (content stays in Graphiti)

**Files to modify:**
- `supabase/migrations/000XX_remove_pgvector.sql`
- `manda-app/lib/supabase/types.ts`
- Any queries referencing embedding columns

---

## Dependencies

- **Requires:** Docker, Neo4j 5.26+, Voyage API key
- **Enables:** E11 (Agent Context Engineering), CIM Builder improvements
- **Parallel:** Can develop E10.1-E10.3 while E10.4+ depends on them

---

## Testing Strategy

### High Risk (test first)
- **E10.4** (Document Ingestion) — Integration tests for full pipeline
- **E10.7** (Retrieval) — End-to-end retrieval accuracy tests

### Medium Risk
- **E10.5** (Q&A Ingestion) — Supersession logic tests
- **E10.6** (Entity Resolution) — Fuzzy matching accuracy tests

### End-to-End Test
```
Upload document → verify entities in Neo4j →
Q&A answer supersedes fact → verify retrieval returns new truth →
Query via chat → verify source citations
```

---

## Success Criteria

1. **Unified knowledge store** — All embeddings and graph in Neo4j (no pgvector)
2. **Hybrid queries work** — Vector + BM25 + graph in single retrieval
3. **Entity resolution active** — "ABC Corp" = "ABC Corporation" automatically
4. **Truth supersession works** — Q&A answer > document fact
5. **Retrieval accuracy** — Measurable improvement with reranking
6. **Latency acceptable** — <3 seconds for chat queries
7. **Buy-side ready** — Temporal model supports future features

---

## Effort Summary

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

## References

- [Sprint Change Proposal 2025-12-15](../../sprint-change-proposal-2025-12-15.md)
- [Architecture Doc v4.0](../../manda-architecture.md)
- [Graphiti GitHub](https://github.com/getzep/graphiti)
- [Voyage AI Documentation](https://docs.voyageai.com/docs/embeddings)
- [Neo4j Vector Indexes](https://neo4j.com/docs/cypher-manual/current/indexes/semantic-indexes/vector-indexes/)

---

*Epic created: 2025-12-14*
*Epic rewritten: 2025-12-15 (Graphiti architecture)*
*Status: Ready for Development*
