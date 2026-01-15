---
title: Dynamic Knowledge Graph Pipeline - Architecture Decision Record
status: accepted
date: 2026-01-15
deciders: Max
parent_architecture: docs/manda-architecture.md (v4.3)
related_prd: dynamic-kg-pipeline-prd.md
---

# ADR: Dynamic Knowledge Graph Pipeline

## Context

The Manda platform needs to process documents from ANY industry/deal type without predefined schema constraints. Current implementation uses static entity types and hardcoded query mappings that fail for niche industries.

**Problem:** A pet products company has entities like "SKU velocity" and "retail partner margins" that don't fit predefined types → information gets dropped or miscategorized.

**Goal:** Deal-agnostic, zero-loss extraction and retrieval.

## Decision Drivers

1. **Zero information loss** — completeness is non-negotiable
2. **Deal-agnostic** — works for any industry without configuration
3. **Dual retrieval** — both semantic search and graph traversal
4. **Cost efficiency** — minimal overhead for dynamic behavior
5. **Leverage existing infrastructure** — Graphiti, Neo4j, Voyage already operational

## Decisions

### D1: Dynamic Extraction via source_description (Not Schema Changes)

**Decision:** Add dynamic extraction instructions via Graphiti's `source_description` parameter rather than modifying Graphiti's core schema.

**Rationale:**
- `source_description` already exists in `add_episode()` API
- No Graphiti library modifications required
- LLM interprets instructions and extracts accordingly
- Zero additional cost (uses existing extraction call)

**Alternatives Considered:**
| Option | Rejected Because |
|--------|------------------|
| Custom entity schema per deal | Too complex, schema management overhead |
| Fork Graphiti | Maintenance burden, upgrade incompatibility |
| Pre-processing entity detection | Additional LLM call, latency/cost |

### D2: Document-Type Extraction Hints Module

**Decision:** Create `extraction_hints.py` module that generates document-type-aware instructions.

**Implementation:**
```python
def get_extraction_hints(doc_type: str, doc_metadata: dict) -> str:
    """Returns extraction instructions based on document type."""
    hints = {
        "financial": "Extract all financial metrics, ratios, trends...",
        "legal": "Extract contract terms, parties, obligations...",
        "operational": "Extract processes, KPIs, capacity metrics...",
        "market": "Extract market size, competitors, trends..."
    }
    return hints.get(doc_type, hints["general"])
```

**Rationale:**
- Simple, maintainable module
- Easy to extend for new document types
- No Graphiti changes required

### D3: Dynamic Query Generation with Static Fallback

**Decision:** Generate CIM retrieval queries dynamically using LLM (Haiku) with automatic fallback to static `SECTION_QUERIES`.

**Flow:**
```
1. Introspect deal graph schema → get entity types
2. Generate query via Haiku (fast, cheap)
3. Cache query (1h TTL)
4. If generation fails → use static mapping
```

**Rationale:**
- Haiku is fast (<500ms) and cheap ($0.001 per query)
- Caching amortizes cost across sessions
- Fallback ensures reliability
- Static queries remain as safety net

**Alternatives Considered:**
| Option | Rejected Because |
|--------|------------------|
| Always dynamic | No fallback if LLM fails |
| Always static | Misses deal-specific entities |
| Embedding similarity routing | Over-engineered for this use case |

### D4: Complexity Detection for Document Routing (Post-MVP)

**Decision:** Add complexity scoring to route high-complexity documents to direct LLM extraction.

**Complexity Factors:**
- Table density (>50 tables = high)
- Formula count (>100 formulas = high)
- Sheet count (>20 sheets = high)
- File size (>10MB = flag for review)

**Routing:**
```
if complexity_score > 80:
    route_to_direct_llm_extraction()  # Claude Sonnet
else:
    route_to_graphiti()  # Standard path
```

**Rationale:**
- Complex Excel models lose context in chunk-based processing
- Direct LLM extraction preserves formula relationships
- Only ~10% of documents need expensive path
- Cost increase acceptable for quality gain (+$0.20-0.40/doc)

### D5: Graph Schema Introspection Endpoint

**Decision:** Add new FastAPI endpoint for graph schema introspection.

**Endpoint:** `GET /api/search/schema/{project_id}`

**Response:**
```json
{
  "entity_types": ["Company", "Product_Line", "Retail_Partner", "SKU_Velocity"],
  "relationship_types": ["SUPPLIES", "DISTRIBUTES", "MEASURES"],
  "entity_counts": {"Company": 5, "Product_Line": 23, ...}
}
```

**Rationale:**
- Frontend needs schema awareness for query generation
- Simple Cypher query against Neo4j
- Cache per deal (invalidate on document processing)

## Architecture Impact

### Modified Components

| Component | Change | Risk |
|-----------|--------|------|
| `manda-processing/src/graphiti/ingestion.py` | Add dynamic instructions | Low |
| `manda-app/lib/agent/cim-mvp/tools.ts` | Replace static queries | Medium |
| `manda-processing/src/api/routes/search.py` | New endpoint | Low |

### New Components

| Component | Purpose |
|-----------|---------|
| `extraction_hints.py` | Document-type aware instructions |
| `query-generator.ts` | Dynamic CIM query generation |
| `complexity.py` | Document complexity scoring (Post-MVP) |

### No Changes To

- Graphiti library itself
- Neo4j schema
- Voyage embeddings configuration
- Agent v2.0 supervisor architecture

## Consequences

### Positive

- Zero-loss extraction for any industry
- Better CIM retrieval relevance
- Minimal cost increase (~5-10%)
- Leverages existing infrastructure investment

### Negative

- Query generation adds latency (mitigated by caching)
- Complexity detection may misroute (mitigated by tunable thresholds)
- More LLM calls = more points of failure (mitigated by fallbacks)

### Risks

| Risk | Mitigation |
|------|------------|
| Dynamic queries produce irrelevant results | Static fallback + A/B testing |
| Cost escalation | Complexity threshold tuning, monitoring |
| Cache staleness | Short TTL, invalidation on upload |

## Implementation Order

1. **Phase 1 (MVP):** Dynamic extraction hints → `source_description`
2. **Phase 3 (MVP):** Dynamic CIM queries → replace `SECTION_QUERIES`
3. **Phase 2 (Post-MVP):** Complexity routing → direct LLM extraction

## References

- **Parent Architecture:** [docs/manda-architecture.md](../../../docs/manda-architecture.md) (v4.3)
- **PRD:** [dynamic-kg-pipeline-prd.md](dynamic-kg-pipeline-prd.md)
- **Graphiti Docs:** https://github.com/getzep/graphiti
- **E10 Retrospective:** [docs/sprint-artifacts/retrospectives/epic-E10-retrospective.md](../../../docs/sprint-artifacts/retrospectives/epic-E10-retrospective.md)
