# Graphiti Local Setup Guide

**Story:** E10.1 - Graphiti Infrastructure Setup
**Created:** 2025-12-15

This guide explains how to set up Graphiti with Neo4j for local development.

## Prerequisites

- Docker Desktop installed and running
- Python 3.12+ installed
- Google API key for Gemini (entity extraction)

## Quick Start

```bash
# 1. Navigate to manda-processing
cd manda-processing

# 2. Start Neo4j
docker compose up neo4j -d

# 3. Wait for Neo4j to be healthy (about 30 seconds)
docker compose ps neo4j

# 4. Run smoke test
python scripts/test_graphiti.py
```

## Step-by-Step Setup

### 1. Install Dependencies

```bash
cd manda-processing
pip install -e .
```

This installs:
- `graphiti-core[google-genai]` - Graphiti with Google Gemini support
- `neo4j` - Neo4j Python driver

### 2. Configure Environment Variables

Copy the example environment file and configure:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
# Neo4j (local Docker)
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-secure-password
NEO4J_DATABASE=neo4j

# Graphiti settings
GRAPHITI_SEMAPHORE_LIMIT=10

# Google API (REQUIRED for entity extraction)
GOOGLE_API_KEY=your-google-api-key
```

### 3. Start Neo4j

```bash
cd manda-processing
docker compose up neo4j -d
```

Verify Neo4j is running:

```bash
# Check container status
docker compose ps neo4j

# View logs
docker compose logs neo4j
```

### 4. Verify Neo4j Browser

Open [http://localhost:7474](http://localhost:7474) in your browser.

Login with:
- Username: `neo4j`
- Password: (your NEO4J_PASSWORD from .env)

### 5. Run Smoke Test

```bash
python scripts/test_graphiti.py
```

Expected output:

```
============================================================
Graphiti Smoke Test - E10.1
============================================================

Test Deal A ID: smoke-test-deal-a-abc12345
Test Deal B ID: smoke-test-deal-b-xyz67890

--- Test 1: Neo4j Connection ---
✓ Neo4j connection successful

--- Test 2: Episode Ingestion ---
✓ Episode ingestion successful

--- Test 3: Graph Query ---
✓ Graph query successful (5 results)

--- Test 4: Group ID Isolation ---
✓ Deal B query found 3 results (expected)
✓ Group_id isolation verified (Deal A cannot see Deal B data)

============================================================
✓ All smoke tests passed!
============================================================
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Manda Processing                      │
│                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Document  │───▶│  Graphiti   │───▶│   Neo4j     │  │
│  │   Parser    │    │   Client    │    │   (Graph)   │  │
│  └─────────────┘    └─────────────┘    └─────────────┘  │
│                            │                             │
│                            ▼                             │
│                    ┌─────────────┐                       │
│                    │   Gemini    │                       │
│                    │   (LLM)     │                       │
│                    └─────────────┘                       │
└─────────────────────────────────────────────────────────┘
```

## Key Concepts

### Deal Isolation (group_id)

Each deal gets its own namespace via `group_id`:

```python
# Deal A's data
await GraphitiClient.add_episode(
    deal_id="deal-A",  # group_id
    content="Deal A revenue: $100M",
    source="deal-a-report.pdf",
    source_description="Deal A financial report"
)

# Deal B's data
await GraphitiClient.add_episode(
    deal_id="deal-B",  # group_id
    content="Deal B revenue: $50M",
    source="deal-b-report.pdf",
    source_description="Deal B financial report"
)

# Searching Deal A returns ONLY Deal A data
results = await GraphitiClient.search(
    deal_id="deal-A",
    query="What is the revenue?"
)
```

### Entity Extraction

Graphiti uses Gemini to automatically extract:
- **Entities**: Companies, people, products, metrics
- **Relationships**: Ownership, partnerships, contracts
- **Facts**: Key data points with temporal context

No manual entity definition required.

### Temporal Knowledge

Graphiti maintains bi-temporal data:
- **Valid time**: When the fact was true in the real world
- **Transaction time**: When we learned about it

This enables queries like "What did we know about revenue as of last week?"

## Troubleshooting

### Neo4j Won't Start

```bash
# Check logs
docker compose logs neo4j

# Common issues:
# - Port 7687 already in use
# - Insufficient memory (needs 512MB+ heap)
# - Volume permission issues
```

### Connection Refused

```bash
# Verify Neo4j is healthy
docker compose ps neo4j
# Should show: STATUS = healthy

# Test direct connection
docker exec -it manda-processing-neo4j-1 cypher-shell -u neo4j -p YOUR_PASSWORD
```

### Entity Extraction Fails

- Verify `GOOGLE_API_KEY` is set and valid
- Check Gemini API quota at [Google AI Studio](https://aistudio.google.com/)
- Reduce `GRAPHITI_SEMAPHORE_LIMIT` if hitting rate limits

### APOC Procedures Missing

APOC is required for Graphiti. Verify it's loaded:

```cypher
// In Neo4j Browser
RETURN apoc.version();
```

If not loaded, check docker-compose.yaml has:
```yaml
NEO4J_PLUGINS=["apoc"]
NEO4J_dbms_security_procedures_allowlist=apoc.*
```

## Docker Commands Reference

```bash
# Start Neo4j
docker compose up neo4j -d

# Stop Neo4j
docker compose stop neo4j

# View logs
docker compose logs -f neo4j

# Restart Neo4j
docker compose restart neo4j

# Remove Neo4j (including data)
docker compose down -v
```

## Schema Module (E10.3)

Graphiti supports guided extraction with custom entity and edge schemas. The M&A platform provides pre-built schemas optimized for deal analysis.

### Entity Types

The following entity types are extracted from documents:

| Entity | Description | Key Fields |
|--------|-------------|------------|
| `Company` | Corporate entities in deals | `name`, `role` (target/acquirer/competitor), `industry`, `aliases` |
| `Person` | Individuals involved | `name`, `title`, `role` (executive/advisor/board), `company_id` |
| `FinancialMetric` | Financial data points | `metric_type`, `value`, `period`, `currency`, `basis` |
| `Finding` | Knowledge findings | `content`, `confidence`, `source_channel`, `finding_type` |
| `Risk` | Identified risks | `description`, `severity` (high/medium/low), `category`, `mitigation` |

### Edge Types

The following relationship types connect entities:

| Edge | Connection | Description |
|------|------------|-------------|
| `WORKS_FOR` | Person → Company | Employment relationship |
| `SUPERSEDES` | Finding → Finding | New truth replaces old |
| `CONTRADICTS` | Finding → Finding | Unresolved conflict |
| `SUPPORTS` | Finding → Finding | Corroboration |
| `EXTRACTED_FROM` | Entity → Document | Provenance tracking |
| `COMPETES_WITH` | Company → Company | Competition |
| `INVESTS_IN` | Company/Person → Company | Investment |
| `MENTIONS` | Finding → Entity | Finding references an entity |
| `SUPPLIES` | Company → Company | Supply chain relationship |

### Using the Schema

The schema is applied automatically when using `add_episode()`:

```python
from src.graphiti import GraphitiClient

# Uses M&A schema by default
await GraphitiClient.add_episode(
    deal_id="deal-123",
    content="ABC Corp reported $4.8M revenue...",
    name="financial-report.pdf",
    source_description="Annual financial report"
)
```

### Custom Entity Types

To add a new entity type:

1. Create a Pydantic model in `src/graphiti/schema/entities.py`:

```python
from pydantic import BaseModel
from typing import Literal

class Product(BaseModel):
    """Product entity for deal analysis."""
    name: str
    category: str
    market_share: float | None = None
    lifecycle_stage: Literal["growth", "mature", "decline"] | None = None
```

2. Add to `ENTITY_TYPES` in `src/graphiti/schema/__init__.py`:

```python
ENTITY_TYPES: dict[str, type[BaseModel]] = {
    "Company": Company,
    "Person": Person,
    # ... existing types
    "Product": Product,  # NEW
}
```

3. Update `__all__` exports.

### Custom Edge Types

To add a new edge type:

1. Create a Pydantic model in `src/graphiti/schema/edges.py`:

```python
from pydantic import BaseModel

class Manufactures(BaseModel):
    """Company manufactures Product relationship."""
    production_volume: int | None = None
    facility_location: str | None = None
```

2. Add to `EDGE_TYPES` in `src/graphiti/schema/__init__.py`:

```python
EDGE_TYPES: dict[str, type[BaseModel]] = {
    "WORKS_FOR": WorksFor,
    # ... existing types
    "MANUFACTURES": Manufactures,  # NEW
}
```

3. Update `EDGE_TYPE_MAP` in `src/graphiti/schema/relationships.py`:

```python
EDGE_TYPE_MAP: dict[tuple[str, str], list[str]] = {
    ("Person", "Company"): ["WORKS_FOR"],
    # ... existing mappings
    ("Company", "Product"): ["MANUFACTURES"],  # NEW
}
```

### edge_type_map Configuration

The `edge_type_map` defines which edge types can connect which entity pairs:

```python
from src.graphiti.schema.relationships import EDGE_TYPE_MAP

# Format: {(source_type, target_type): [allowed_edge_types]}
# Example entry:
{
    ("Person", "Company"): ["WORKS_FOR"],
    ("Company", "Company"): ["COMPETES_WITH", "SUPPLIES"],
    ("Finding", "Finding"): ["SUPERSEDES", "CONTRADICTS", "SUPPORTS"],
}
```

Use `"Entity"` as a wildcard for generic relationships:

```python
("Entity", "Document"): ["EXTRACTED_FROM"],  # Any entity to Document
```

### Passing Custom Schema to add_episode()

Override defaults by passing schema parameters:

```python
from src.graphiti import GraphitiClient, get_entity_types, get_edge_types

# Get base types and customize
entity_types = get_entity_types()
entity_types["Product"] = Product  # Add custom type

await GraphitiClient.add_episode(
    deal_id="deal-123",
    content="...",
    name="document.pdf",
    source_description="Document",
    entity_types=entity_types,  # Custom entities
    edge_types=get_edge_types(),
    edge_type_map=get_edge_type_map(),
)
```

### Dynamic Discovery (AC: #5)

Even with guided extraction, Graphiti can discover novel entities not in the schema. The schema guides extraction but doesn't limit it - if the LLM finds a relevant entity not in your types, it will still be extracted as a generic entity.

## Next Steps

1. **E10.4**: Document Ingestion Pipeline - Connect to processing pipeline
2. **E10.5**: QA and Chat Ingestion - Add conversation memory
3. **E10.6**: Entity Resolution - Tune alias-based entity resolution

## References

- [Graphiti Documentation](https://help.getzep.com/graphiti)
- [Graphiti GitHub](https://github.com/getzep/graphiti)
- [Neo4j Docker](https://neo4j.com/docs/operations-manual/current/docker/)
- [APOC Procedures](https://neo4j.com/labs/apoc/)
