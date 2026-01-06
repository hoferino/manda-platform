# ADR-001: Migration from pgvector to Graphiti + Neo4j

## Status

**Accepted** (2025-12-15)
**Cleanup Executed:** 2026-01-06

## Context

### Original Architecture (E1-E9)

The Manda platform initially used a dual-database approach for embeddings and knowledge storage:

- **pgvector (PostgreSQL)**: Stored embeddings using OpenAI's `text-embedding-3-large` model (3072 dimensions)
- **Neo4j**: Stored graph relationships for entity connections
- **Semantic search**: Required two-step queries (pgvector for vectors, then Neo4j for graph traversal)

### Problems Identified (2025-12-15)

During architecture review with PM, we identified critical issues:

1. **Dual-database complexity**: Maintaining sync between pgvector and Neo4j created unnecessary overhead
2. **Outdated assumptions**: Neo4j 5.18+ now supports native HNSW vector indexes, making pgvector redundant
3. **No reranking**: RAG best practices show 20-35% accuracy improvement with reranking, which we lacked
4. **Fixed schema**: Hardcoded entity types didn't scale for M&A deals where every deal is different
5. **No temporal model**: Future buy-side features require tracking "what was claimed vs. what we found"

### Evidence

Research conducted via PM workflow session:
- [Neo4j Vector Indexes Documentation](https://neo4j.com/docs/cypher-manual/current/indexes/semantic-indexes/vector-indexes/)
- [Graphiti Knowledge Graph Framework](https://github.com/getzep/graphiti)
- [Voyage AI Embeddings](https://docs.voyageai.com/docs/embeddings)

## Decision

Migrate all embeddings and semantic search to Graphiti + Neo4j:

### Storage Architecture

| Component | Before (pgvector) | After (Graphiti + Neo4j) |
|-----------|-------------------|--------------------------|
| **Embeddings** | PostgreSQL pgvector extension | Neo4j native vector indexes |
| **Embedding model** | OpenAI text-embedding-3-large (3072d) | Voyage voyage-3.5 (1024d) |
| **Semantic search** | pgvector similarity | Neo4j VectorRetriever |
| **Hybrid search** | Two-step (pgvector → Neo4j) | Single Neo4j Cypher query |
| **Graph relationships** | Neo4j | Neo4j (unchanged) |
| **Transactional data** | PostgreSQL/Supabase | PostgreSQL/Supabase (unchanged) |

### New Capabilities

- **Hybrid queries**: Vector + BM25 + graph traversal in single query
- **Reranking**: Voyage rerank-2.5 applied to all retrievals (20-35% accuracy improvement)
- **Temporal model**: Bi-temporal facts (valid_at, invalid_at) for truth evolution
- **Entity resolution**: Built-in fuzzy + semantic matching
- **Dynamic ontology**: LLM-driven entity discovery with stable "sell-side spine"

### Retrieval Pipeline

```
1. Graphiti Hybrid Search (vector + BM25 + graph) → 50 candidates (~300ms)
2. Voyage Reranker → Score and reorder → Top 5-10 (~200-300ms)
3. LLM (Claude/Gemini) → Generate response with citations (~1-2s)
Total latency: ~2-3 seconds
```

## Consequences

### Positive

- Single source of truth for knowledge (Neo4j)
- Reduced operational complexity (no pgvector sync)
- Better retrieval accuracy with reranking
- Domain-optimized embeddings (Voyage Finance outperforms OpenAI by ~10% on finance/legal)
- Lower embedding costs ($0.06/1M vs $0.13/1M)
- Smaller storage footprint (1024d vs 3072d)
- Buy-side ready from day one (temporal model)

### Negative

- Graphiti learning curve
- E10 scope expanded from 26 to 42 points
- Required updates to E11 stories

### Deprecated Files Removed (2026-01-06)

The following files were deprecated in E10.8 and removed during cleanup:

**Frontend (manda-app):**
- `lib/services/embeddings.ts` - OpenAI embedding service with LRU cache
- `lib/pgboss/handlers/generate-embeddings.ts` - pg-boss job handler for embeddings
- `__tests__/lib/services/embeddings.test.ts` - Tests for deprecated service

**Backend (manda-processing):**
- `src/jobs/handlers/generate_embeddings.py` - Python embedding job handler

### Deprecated Code Cleaned From Active Files

References to deprecated functionality were removed from:
- `lib/services/source-error-cascade.ts` - Embedding regeneration logic
- `lib/agent/cim/utils/content-retrieval.ts` - `searchPgvectorFindings`, `queryEmbeddingIndex`
- `lib/agent/intent.ts` - `SYNCHRONOUS_PATTERNS`, `classifyIntentSync`
- `lib/agent/tools/workflow-tools.ts` - `addToQATool`

## Implementation

### Epic 10: Knowledge Graph Foundation

E10 was rewritten to implement this architecture:

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
| **Total** | **42** | Completed 2025-12-17 |

### Epic 11 Updates

E11 (Agent Context Engineering) was updated for Graphiti integration:
- E11.3: Knowledge write-back targets Graphiti (not pgvector)
- E11.4: Intent-aware retrieval uses Graphiti search
- E11.6: Model config includes Voyage
- E11.7: Integration tests updated

## References

- [Sprint Change Proposal 2025-12-15](../sprint-change-proposal-2025-12-15.md) - Full architectural decision document
- [Architecture v4.2](../manda-architecture.md) - Current architecture
- [Epic E10 Retrospective](../sprint-artifacts/retrospectives/epic-E10-retrospective.md)

## Timeline

- **2025-12-15**: Architecture decision approved
- **2025-12-17**: E10 completed (Graphiti + Neo4j migration)
- **2025-12-18**: E11 completed (Agent context engineering)
- **2026-01-06**: Deprecated code cleanup executed
