# CIM Knowledge Source Toggle

**Epic:** CIM Neo4j Integration
**Created:** 2026-01-15
**Status:** Ready for Implementation

---

## Overview

Enable the CIM Builder to use Neo4j/Graphiti as its knowledge source instead of the predefined JSON file. The existing MVP toggle switches between modes:

- **Toggle ON (MVP/Dev):** JSON knowledge file (`data/test-company/knowledge.json`)
- **Toggle OFF (Production):** Neo4j/Graphiti (live deal data)

**Key Principle:** Same graph, same tools, same prompts, same UI. Only the data source changes.

## Business Value

| Benefit | Impact |
|---------|--------|
| **Live data** | CIMs reflect actual uploaded documents, not static test data |
| **Multi-tenant** | Each deal uses its own knowledge graph (group_id isolation) |
| **Dynamic updates** | New documents indexed mid-workflow are immediately available |
| **Single codebase** | No parallel implementations to maintain |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  CIM Builder (unchanged)                                        │
│  - graph.ts (flat 3-node graph)                                │
│  - tools.ts (15 CIM tools)                                     │
│  - prompts.ts (7 workflow stages)                              │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  Knowledge Service (NEW)                                        │
│  - Abstraction layer for knowledge queries                      │
│  - Routes to JSON or Graphiti based on toggle                  │
└──────────────┬────────────────────────────┬─────────────────────┘
               │                            │
               ▼                            ▼
┌──────────────────────────┐  ┌──────────────────────────────────┐
│  JSON Knowledge Loader   │  │  Graphiti Service                │
│  (existing)              │  │  - Hybrid search                 │
│  - loadKnowledge()       │  │  - Vector + BM25 + Graph         │
│  - searchKnowledge()     │  │  - Reranking                     │
│  - getKnowledgeSection() │  │  - Source attribution            │
└──────────────────────────┘  └──────────────────────────────────┘
```

## Story Execution Order

| # | Story | File(s) | Estimate |
|---|-------|---------|----------|
| 1 | [Knowledge Service Abstraction](./story-01-knowledge-service.md) | `knowledge-service.ts` | Small |
| 2 | [Graphiti Integration](./story-02-graphiti-integration.md) | `graphiti-knowledge.ts` | Medium |
| 3 | [Toggle Wiring](./story-03-toggle-wiring.md) | `CIMBuilderPage.tsx`, API route | Small |
| 4 | [Knowledge Readiness Check](./story-04-readiness-check.md) | `knowledge-service.ts`, UI | Small |

## Dependencies

```
Story 1 (Knowledge Service) ───┐
                               ├──→ Story 3 (Toggle Wiring)
Story 2 (Graphiti Integration) ┘
                               │
                               ▼
                        Story 4 (Readiness Check)
```

Stories 1 and 2 can be done in parallel. Story 3 requires both. Story 4 requires Story 3.

## Reference Documents

- [CIM MVP Fix Stories](../../../_bmad-output/sprint-artifacts/cim-mvp-fix-stories.md)
- [CIM Subgraph Architecture](../../../_bmad-output/planning-artifacts/cim-subgraph-architecture.md) - Section on hybrid knowledge approach
- [Agent v2 Retrieval](../../../manda-app/lib/agent/v2/nodes/retrieval.ts) - Existing Graphiti integration
- [Knowledge Loader](../../../manda-app/lib/agent/cim-mvp/knowledge-loader.ts) - Current JSON implementation

## Success Criteria

1. CIM Builder works identically with both knowledge sources
2. Toggle switches cleanly between JSON and Graphiti
3. Graphiti mode shows real deal data with source citations
4. Knowledge readiness check prevents empty-knowledge CIM attempts
5. No regression in existing MVP functionality
