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

## Documentation

> **Note:** Documentation will be consolidated here from `_bmad-output/` and `docs/` directories during Phase 2.

Current documentation sources:
- `docs/dynamic-knowledge-graph-pipeline-plan.md` - Pipeline design
- E10 completion notes (2025-12-17) - Migration from pgvector

---

[Back to Feature Documentation](../README.md)
