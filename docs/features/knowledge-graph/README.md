# Knowledge Graph

Graphiti + Neo4j integration for entity extraction, relationship mapping, and semantic search.

## Overview

The knowledge graph provides intelligent document understanding through:
- **Entity extraction** - Identifying companies, people, financials, and relationships
- **Temporal facts** - Tracking information with time context
- **Hybrid search** - Combining vector (Voyage 3.5), BM25, and graph traversal

## Architecture

```
Document Upload -> Docling Parsing -> Graphiti Ingestion -> Neo4j Storage
                                           |
                        Entity Resolution + Voyage Embeddings
```

## Key Components

| Component | Purpose |
|-----------|---------|
| Graphiti | Knowledge graph framework with temporal modeling |
| Neo4j | Graph database with `group_id` multi-tenant isolation |
| Voyage 3.5 | 1024-dimension embeddings stored in Neo4j |
| Voyage Rerank 2.5 | 20-35% retrieval accuracy improvement |

## Implementation

- **Backend:** `manda-processing/src/jobs/handlers/ingest_graphiti.py`
- **Frontend retrieval:** `manda-app/lib/agent/v2/nodes/retrieval.ts`

## E10 Migration Context

As of E10 completion (2025-12-17), all embeddings and semantic search were consolidated to Graphiti + Neo4j:

- **Removed:** pgvector and PostgreSQL-based vector storage
- **Current:** Voyage voyage-3.5 embeddings stored in Neo4j
- **Decision:** See [SCP-003](../../decisions/sprint-change-proposal-2025-12-15.md)

This means:
- All vector search goes through Graphiti hybrid search
- No more dual-storage (PG + Neo4j) complexity
- Entity resolution and temporal facts in single graph

## Documentation

### Current (Authoritative)

The knowledge graph implementation is documented primarily in code:

| Location | Description |
|----------|-------------|
| `manda-processing/src/graphiti/` | Graphiti client and ingestion |
| `manda-processing/src/jobs/handlers/ingest_graphiti.py` | Ingestion job handler |
| `manda-app/lib/agent/v2/nodes/retrieval.ts` | Frontend retrieval integration |
| CLAUDE.md | Architecture overview and E10 context |

### Historical (Planning Reference)

These documents capture planning before implementation:

| Document | Purpose | Notes |
|----------|---------|-------|
| [Dynamic KG Pipeline PRD](../../../_bmad-output/planning-artifacts/dynamic-kg-pipeline/dynamic-kg-pipeline-prd.md) | Requirements for dynamic extraction | Future enhancement planned |
| [Dynamic KG Pipeline ADR](../../../_bmad-output/planning-artifacts/dynamic-kg-pipeline/dynamic-kg-pipeline-adr.md) | Architecture decision record | |
| [Pipeline Plan](../../dynamic-knowledge-graph-pipeline-plan.md) | Initial design document | Pre-implementation spec |
| [Epic & Stories](../../../_bmad-output/planning-artifacts/dynamic-kg-pipeline/) | E14 epic breakdown | Not yet implemented |

### Dynamic Extraction (Future)

The Dynamic KG Pipeline (E14) is planned but not yet implemented. It will add:
- Document-type-aware extraction hints
- Dynamic entity discovery (beyond predefined types)
- Complexity-based routing

---

[Back to Feature Documentation](../README.md)
