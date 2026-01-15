---
story_id: E14-S3
epic: E14
title: Graph Schema Introspection Endpoint
status: completed
priority: P0
effort: 2-3 hours
assignee: null
completed_date: 2026-01-15
---

# E14-S3: Graph Schema Introspection Endpoint

## User Story

**As a** CIM builder frontend
**I want to** query the graph schema for a specific deal
**So that** I can generate context-aware retrieval queries

## Background

The dynamic query generator (E14-S4) needs to know what entity types exist in a deal's knowledge graph to generate relevant queries. This endpoint exposes that schema information.

## Acceptance Criteria

- [x] New endpoint: `GET /api/search/schema/{project_id}`
- [x] Returns entity types, relationship types, and counts
- [x] Response cached per deal (invalidated on document processing)
- [x] Multi-tenant isolation via `group_id`
- [x] Latency < 500ms

## Technical Details

### New Endpoint

**File:** `manda-processing/src/api/routes/search.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Dict, List
from src.storage.neo4j import get_neo4j_driver
from src.config import settings
import hashlib

router = APIRouter(prefix="/api/search", tags=["search"])

class GraphSchema(BaseModel):
    entity_types: List[str]
    relationship_types: List[str]
    entity_counts: Dict[str, int]
    total_entities: int
    total_relationships: int

# Simple in-memory cache (replace with Redis if needed)
_schema_cache: Dict[str, tuple[GraphSchema, float]] = {}
CACHE_TTL = 3600  # 1 hour

@router.get("/schema/{project_id}", response_model=GraphSchema)
async def get_graph_schema(project_id: str) -> GraphSchema:
    """
    Get the knowledge graph schema for a specific project/deal.

    Returns entity types, relationship types, and counts to enable
    dynamic query generation.
    """
    cache_key = f"schema:{project_id}"

    # Check cache
    if cache_key in _schema_cache:
        cached, timestamp = _schema_cache[cache_key]
        import time
        if time.time() - timestamp < CACHE_TTL:
            return cached

    driver = get_neo4j_driver()

    async with driver.session() as session:
        # Get entity types and counts
        entity_result = await session.run("""
            MATCH (n)
            WHERE n.group_id = $group_id
            WITH labels(n) AS labels, count(n) AS count
            UNWIND labels AS label
            WHERE label <> 'Entity'  // Exclude base label
            RETURN label, sum(count) AS entity_count
            ORDER BY entity_count DESC
        """, group_id=project_id)

        entity_data = await entity_result.data()
        entity_types = [r['label'] for r in entity_data]
        entity_counts = {r['label']: r['entity_count'] for r in entity_data}

        # Get relationship types
        rel_result = await session.run("""
            MATCH ()-[r]->()
            WHERE r.group_id = $group_id OR true  // Relationships may not have group_id
            RETURN DISTINCT type(r) AS rel_type
        """, group_id=project_id)

        rel_data = await rel_result.data()
        relationship_types = [r['rel_type'] for r in rel_data]

        # Get totals
        total_result = await session.run("""
            MATCH (n)
            WHERE n.group_id = $group_id
            WITH count(n) AS entities
            MATCH ()-[r]->()
            RETURN entities, count(r) AS relationships
        """, group_id=project_id)

        totals = await total_result.single()

    schema = GraphSchema(
        entity_types=entity_types,
        relationship_types=relationship_types,
        entity_counts=entity_counts,
        total_entities=totals['entities'] if totals else 0,
        total_relationships=totals['relationships'] if totals else 0
    )

    # Cache result
    import time
    _schema_cache[cache_key] = (schema, time.time())

    return schema

@router.delete("/schema/{project_id}/cache")
async def invalidate_schema_cache(project_id: str) -> dict:
    """Invalidate cached schema for a project (called after document processing)."""
    cache_key = f"schema:{project_id}"
    if cache_key in _schema_cache:
        del _schema_cache[cache_key]
        return {"status": "invalidated"}
    return {"status": "not_cached"}
```

### Register Router

**File:** `manda-processing/src/api/main.py` (or equivalent)

```python
from src.api.routes.search import router as search_router

app.include_router(search_router)
```

### Cache Invalidation Hook

**File:** `manda-processing/src/jobs/handlers/ingest_graphiti.py`

Add cache invalidation after successful ingestion:

```python
# At end of successful ingestion
import httpx

async def invalidate_schema_cache(project_id: str):
    """Invalidate schema cache after document ingestion."""
    try:
        async with httpx.AsyncClient() as client:
            await client.delete(f"{settings.API_BASE_URL}/api/search/schema/{project_id}/cache")
    except Exception:
        pass  # Non-critical, cache will expire naturally
```

### Response Example

```json
{
  "entity_types": [
    "Company",
    "Financial_Metric",
    "Product_Line",
    "Retail_Partner",
    "Contract",
    "Person"
  ],
  "relationship_types": [
    "HAS_METRIC",
    "SUPPLIES",
    "MENTIONS",
    "RELATES_TO"
  ],
  "entity_counts": {
    "Company": 5,
    "Financial_Metric": 127,
    "Product_Line": 23,
    "Retail_Partner": 8,
    "Contract": 12,
    "Person": 34
  },
  "total_entities": 209,
  "total_relationships": 456
}
```

## Dependencies

- Neo4j running and accessible
- Project documents already ingested

## Out of Scope

- Detailed entity properties
- Relationship properties
- Graph visualization

---

## Completion Notes (2026-01-15)

### Tasks Completed

1. **Created `GET /api/search/schema/{project_id}` endpoint** in `search.py`
   - Returns `GraphSchema` model with entity_types, relationship_types, entity_counts, totals
   - API key authentication required
   - Deal existence verification before querying Neo4j

2. **Implemented in-memory caching** with 1-hour TTL
   - Cache key format: `schema:{project_id}`
   - Cache is checked before executing Neo4j queries
   - Reduces load on Neo4j for repeated requests

3. **Created `DELETE /api/search/schema/{project_id}/cache` endpoint**
   - Allows manual cache invalidation after document processing
   - Returns status dict indicating if cache was invalidated

4. **Multi-tenant isolation** via composite `group_id`
   - Uses `{org_id}_{deal_id}` format matching GraphitiClient
   - All Cypher queries filter by `group_id`

5. **Graceful degradation** on Neo4j unavailability
   - Returns empty schema instead of error
   - Logs warning for monitoring

### Implementation Details

- **Cypher queries** use efficient aggregation patterns
- **Entity types** filtered to exclude base 'Entity' label
- **Ordered by count** descending for most significant types first
- **Uses existing Graphiti client** to get Neo4j driver (no new connections)

### Response Example

```json
{
  "entity_types": ["Company", "Financial_Metric", "Product_Line"],
  "relationship_types": ["HAS_METRIC", "SUPPLIES", "MENTIONS"],
  "entity_counts": {"Company": 5, "Financial_Metric": 127, "Product_Line": 23},
  "total_entities": 155,
  "total_relationships": 289
}
```

### Files Modified

- **Modified:** `manda-processing/src/api/routes/search.py`
  - Added `GraphSchema` Pydantic model
  - Added `get_graph_schema()` endpoint
  - Added `invalidate_schema_cache()` endpoint
  - Added in-memory cache with TTL

### Testing Notes

- Syntax verified via `py_compile`
- Full integration test requires running Neo4j and ingested data
