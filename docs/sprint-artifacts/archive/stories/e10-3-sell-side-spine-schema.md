# Story 10.3: Sell-Side Spine Schema

**Status:** Done

---

## Story

As a **platform developer**,
I want **Pydantic entity and edge models for Graphiti guided extraction**,
so that **the knowledge graph can automatically extract and resolve M&A-specific entities (companies, people, financial metrics, findings, risks) and typed relationships from documents**.

---

## Acceptance Criteria

1. **AC1:** Pydantic entity models exist for: Company, Person, FinancialMetric, Finding, Risk
2. **AC2:** Pydantic edge models exist for typed relationships (WorksFor, SupersedesEdge, etc.)
3. **AC3:** Helper functions return `entity_types` and `edge_types` dictionaries for `add_episode()`
4. **AC4:** `GraphitiClient.add_episode()` updated to pass entity/edge types to underlying API
5. **AC5:** Dynamic discovery enabled (novel entities created without schema change)
6. **AC6:** Relationship type constants defined with edge_type_map for entity pair mappings
7. **AC7:** Schema extension documentation exists
8. **AC8:** Test with sample M&A document extracts expected entities and relationships

---

## Tasks / Subtasks

- [x] **Task 1: Create Schema Module Structure** (AC: #1, #2)
  - [x] 1.1: Create `manda-processing/src/graphiti/schema/` directory
  - [x] 1.2: Create `manda-processing/src/graphiti/schema/__init__.py` with exports
  - [x] 1.3: Create `manda-processing/src/graphiti/schema/entities.py` with entity Pydantic models
  - [x] 1.4: Create `manda-processing/src/graphiti/schema/edges.py` with edge Pydantic models
  - [x] 1.5: Create `manda-processing/src/graphiti/schema/relationships.py` with constants and edge_type_map

- [x] **Task 2: Define Core Entity Pydantic Models** (AC: #1)
  - [x] 2.1: Define `Company` entity with fields: `name`, `role` (Literal), `industry`, `aliases`
  - [x] 2.2: Define `Person` entity with fields: `name`, `title`, `role` (Literal), `company_id`
  - [x] 2.3: Define `FinancialMetric` entity with fields: `metric_type`, `value`, `period`, `currency`, `basis`
  - [x] 2.4: Define `Finding` entity with fields: `content`, `confidence`, `source_channel` (Literal), `finding_type` (Literal)
  - [x] 2.5: Define `Risk` entity with fields: `description`, `severity` (Literal), `category`, `mitigation`

- [x] **Task 3: Define Edge Pydantic Models** (AC: #2)
  - [x] 3.1: Define `WorksFor` edge model (Person → Company)
  - [x] 3.2: Define `SupersedesEdge` edge model (Finding → Finding) with `reason` field
  - [x] 3.3: Define `ContradictsEdge` edge model (Finding → Finding)
  - [x] 3.4: Define `SupportsEdge` edge model (Finding → Finding)
  - [x] 3.5: Define `ExtractedFrom` edge model (Entity → Document) with `page_number`, `chunk_index`
  - [x] 3.6: Define `CompetesWith` edge model (Company → Company)
  - [x] 3.7: Define `InvestsIn` edge model (Company/Person → Company) with `investment_type`

- [x] **Task 4: Create Helper Functions and Type Dictionaries** (AC: #3, #6)
  - [x] 4.1: Create `get_entity_types()` returning `dict[str, type[BaseModel]]`
  - [x] 4.2: Create `get_edge_types()` returning `dict[str, type[BaseModel]]`
  - [x] 4.3: Create `get_edge_type_map()` returning `dict[tuple[str, str], list[str]]`
  - [x] 4.4: Export `ENTITY_TYPES`, `EDGE_TYPES`, `EDGE_TYPE_MAP` as module-level constants

- [x] **Task 5: Update GraphitiClient.add_episode()** (AC: #4)
  - [x] 5.1: Add `entity_types` parameter to `add_episode()` method signature
  - [x] 5.2: Add `edge_types` parameter to `add_episode()` method signature
  - [x] 5.3: Add `edge_type_map` parameter to `add_episode()` method signature
  - [x] 5.4: Pass parameters to underlying `client.add_episode()` call
  - [x] 5.5: Default to schema module helpers when parameters not provided
  - [x] 5.6: Update `__init__.py` exports for schema module

- [x] **Task 6: Create Unit Tests** (AC: #1, #2, #3, #6)
  - [x] 6.1: Create `manda-processing/tests/unit/test_graphiti/test_schema.py`
  - [x] 6.2: Test entity model validation (valid/invalid data)
  - [x] 6.3: Test edge model validation (valid/invalid data)
  - [x] 6.4: Test `get_entity_types()` returns correct dictionary format
  - [x] 6.5: Test `get_edge_types()` returns correct dictionary format
  - [x] 6.6: Test `get_edge_type_map()` returns correct tuple-keyed dictionary

- [x] **Task 7: Create Integration Test with Sample Document** (AC: #8)
  - [x] 7.1: Create `manda-processing/tests/integration/test_graphiti_extraction.py` (marked `@pytest.mark.integration`)
  - [x] 7.2: Create sample M&A text with known entities and relationships
  - [x] 7.3: Test `add_episode` extracts expected entity types
  - [x] 7.4: Test `add_episode` creates expected edge types
  - [x] 7.5: Test entity resolution identifies aliases (e.g., "ABC Corp" = "ABC Corporation")

- [x] **Task 8: Create Schema Extension Documentation** (AC: #7)
  - [x] 8.1: Update `docs/setup/graphiti-local-setup.md` with schema section
  - [x] 8.2: Document how to add new entity types
  - [x] 8.3: Document how to add new edge types
  - [x] 8.4: Document edge_type_map configuration
  - [x] 8.5: Include examples of custom entity and edge creation

---

## Dev Notes

### Architecture Context

This story implements the **Sell-Side Spine Schema** for Epic E10 - Knowledge Graph Foundation. The schema provides:

- **Guided extraction** — Pydantic models tell Graphiti what entities and edges to extract
- **Dynamic discovery** — Graphiti can still discover novel entities not in the schema
- **Domain optimization** — M&A-specific entity types (Company roles, financial metrics, deal risks)
- **Typed relationships** — Edge models define structured relationship attributes
- **Entity resolution foundation** — Aliases on entities prepare for E10.6 resolution tuning

**Source:** [Tech Spec E10 Section 3.3](../../sprint-artifacts/tech-specs/tech-spec-epic-E10.md) - Sell-Side Spine Schema

### CRITICAL: Graphiti API Pattern for Custom Types

**Entity and edge types are passed to `add_episode()`, NOT the constructor.**

```python
from pydantic import BaseModel, Field
from typing import Literal

# Entity models
class Company(BaseModel):
    """Company entity for M&A deals."""
    name: str
    role: Literal["target", "acquirer", "competitor", "customer", "supplier", "investor"]
    industry: str | None = None
    aliases: list[str] = Field(default_factory=list)

class Person(BaseModel):
    """Person entity involved in deal."""
    name: str
    title: str | None = None
    role: Literal["executive", "advisor", "board", "investor", "employee"]

# Edge models (for typed relationships)
class WorksFor(BaseModel):
    """Relationship between Person and Company."""
    start_date: str | None = None
    end_date: str | None = None

# Build dictionaries for Graphiti API
entity_types = {
    'Company': Company,
    'Person': Person,
    'FinancialMetric': FinancialMetric,
    'Finding': Finding,
    'Risk': Risk,
}

edge_types = {
    'WORKS_FOR': WorksFor,
    'SUPERSEDES': SupersedesEdge,
    'EXTRACTED_FROM': ExtractedFrom,
}

# Map which edges connect which entity pairs
edge_type_map = {
    ('Person', 'Company'): ['WORKS_FOR'],
    ('Finding', 'Finding'): ['SUPERSEDES', 'CONTRADICTS', 'SUPPORTS'],
    ('Company', 'Company'): ['COMPETES_WITH', 'SUPPLIES'],
}

# Pass to add_episode() - NOT the constructor!
await graphiti.add_episode(
    name="document.pdf",
    episode_body=content,
    source_description="Financial report",
    reference_time=datetime.now(timezone.utc),
    group_id=deal_id,
    entity_types=entity_types,      # Dict[str, type[BaseModel]]
    edge_types=edge_types,          # Dict[str, type[BaseModel]]
    edge_type_map=edge_type_map,    # Dict[tuple[str, str], list[str]]
)
```

**Key Points:**
- `entity_types`: Dictionary mapping type name strings to Pydantic model classes
- `edge_types`: Dictionary mapping edge name strings to Pydantic edge model classes
- `edge_type_map`: Dictionary mapping `(source_type, target_type)` tuples to allowed edge types
- All three are passed to `add_episode()`, not the Graphiti constructor

### Critical: Do NOT Reinvent - Build on E10.1/E10.2

The Graphiti client already exists at `manda-processing/src/graphiti/client.py`:

**E10.1 Deliverables (DONE):**
- `GraphitiClient` singleton with `get_instance()`, `close()`, `add_episode()`, `search()`
- Neo4j 5.26+ in Docker Compose with APOC
- GeminiClient for LLM extraction
- `build_indices_and_constraints()` called on init

**E10.2 Deliverables (DONE):**
- VoyageAIEmbedder with voyage-finance-2 (1024d)
- Fallback to GeminiEmbedder if Voyage unavailable
- Cost tracking logging

**This story adds:**
- Schema module (`src/graphiti/schema/`) with entities, edges, and helpers
- Update `GraphitiClient.add_episode()` to pass entity/edge types
- Helper functions: `get_entity_types()`, `get_edge_types()`, `get_edge_type_map()`
- Schema documentation

### Entity Model Specifications

**Company Entity:**
```python
class Company(BaseModel):
    """Company entity for M&A deals."""
    name: str
    role: Literal["target", "acquirer", "competitor", "customer", "supplier", "investor"]
    industry: str | None = None
    aliases: list[str] = Field(default_factory=list)
```
- `role` constrains to M&A-relevant company roles
- `aliases` enables entity resolution ("ABC Corp" = "ABC Corporation")

**Person Entity:**
```python
class Person(BaseModel):
    """Person entity involved in deal."""
    name: str
    title: str | None = None
    role: Literal["executive", "advisor", "board", "investor", "employee"]
    company_id: str | None = None  # Links to Company entity
```
- `company_id` creates relationship to Company entity
- `role` constrains to M&A-relevant person roles

**FinancialMetric Entity:**
```python
class FinancialMetric(BaseModel):
    """Financial metric extracted from documents."""
    metric_type: str  # revenue, ebitda, margin, growth_rate, etc.
    value: float
    period: str       # Q3 2024, FY 2023, LTM, etc.
    currency: str = "USD"
    basis: str | None = None  # GAAP, adjusted, pro_forma
```
- `metric_type` is free-form to allow discovery of novel metrics
- `basis` distinguishes GAAP vs. adjusted figures (critical for M&A)

**Finding Entity:**
```python
class Finding(BaseModel):
    """Knowledge finding extracted from source."""
    content: str
    confidence: float = Field(ge=0, le=1)
    source_channel: Literal["document", "qa_response", "meeting_note", "analyst_chat"]
    finding_type: Literal["fact", "metric", "risk", "opportunity", "insight"]
```
- `source_channel` tracks provenance (document vs Q&A vs chat)
- `confidence` enables truth ranking (Q&A > document)

**Risk Entity:**
```python
class Risk(BaseModel):
    """Risk identified in deal."""
    description: str
    severity: Literal["high", "medium", "low"]
    category: str  # customer_concentration, key_person, regulatory, litigation, etc.
    mitigation: str | None = None
```
- `category` is free-form for novel risk types
- `mitigation` captures any identified mitigations

### Edge Model Specifications

**WorksFor Edge:**
```python
class WorksFor(BaseModel):
    """Relationship between Person and Company."""
    start_date: str | None = None
    end_date: str | None = None
    title: str | None = None  # Role at that company
```

**SupersedesEdge:**
```python
class SupersedesEdge(BaseModel):
    """When new fact supersedes old fact (truth evolution)."""
    reason: str | None = None  # Why this supersedes
    superseded_at: str | None = None  # When supersession occurred
```

**ExtractedFrom Edge:**
```python
class ExtractedFrom(BaseModel):
    """Provenance: Entity/Finding extracted from Document."""
    page_number: int | None = None
    chunk_index: int | None = None
    confidence: float | None = None
```

**InvestsIn Edge:**
```python
class InvestsIn(BaseModel):
    """Investment relationship."""
    investment_type: Literal["equity", "debt", "convertible", "other"] | None = None
    amount: float | None = None
    currency: str = "USD"
```

### Relationship Constants and edge_type_map

Define in `relationships.py`:

```python
# Relationship type name constants
RELATIONSHIP_TYPES = [
    "EXTRACTED_FROM",  # Entity → Document (provenance)
    "MENTIONS",        # Finding → Entity (any entity mentioned)
    "SUPERSEDES",      # Finding → Finding (new truth replaces old)
    "CONTRADICTS",     # Finding → Finding (unresolved conflict)
    "SUPPORTS",        # Finding → Finding (corroboration)
    "WORKS_FOR",       # Person → Company
    "COMPETES_WITH",   # Company → Company
    "SUPPLIES",        # Company → Company
    "INVESTS_IN",      # Company/Person → Company
]

# edge_type_map: Which edges can connect which entity types
# Format: {(source_type, target_type): [allowed_edge_types]}
EDGE_TYPE_MAP: dict[tuple[str, str], list[str]] = {
    ('Person', 'Company'): ['WORKS_FOR'],
    ('Company', 'Company'): ['COMPETES_WITH', 'SUPPLIES'],
    ('Company', 'Entity'): ['INVESTS_IN'],  # Entity = generic for any target
    ('Person', 'Entity'): ['INVESTS_IN'],
    ('Finding', 'Finding'): ['SUPERSEDES', 'CONTRADICTS', 'SUPPORTS'],
    ('Entity', 'Document'): ['EXTRACTED_FROM'],  # Generic entity to doc
    ('Finding', 'Entity'): ['MENTIONS'],
}
```

### GraphitiClient.add_episode() Update Pattern

**Modify `client.py` to pass entity/edge types to the underlying API:**

```python
# At module level - import schema helpers
from src.graphiti.schema import (
    get_entity_types,
    get_edge_types,
    get_edge_type_map,
)

# Update add_episode() method signature and implementation:
@classmethod
async def add_episode(
    cls,
    deal_id: str,
    content: str,
    name: str,
    source_description: str,
    reference_time: Optional[datetime] = None,
    episode_type: EpisodeType = EpisodeType.text,
    entity_types: dict[str, type[BaseModel]] | None = None,    # NEW
    edge_types: dict[str, type[BaseModel]] | None = None,      # NEW
    edge_type_map: dict[tuple[str, str], list[str]] | None = None,  # NEW
) -> None:
    """Add an episode with custom entity/edge extraction."""
    client = await cls.get_instance()

    # Default to schema module helpers if not provided
    entity_types = entity_types or get_entity_types()
    edge_types = edge_types or get_edge_types()
    edge_type_map = edge_type_map or get_edge_type_map()

    await client.add_episode(
        name=name,
        episode_body=content,
        source_description=source_description,
        reference_time=reference_time or datetime.now(timezone.utc),
        source=episode_type,
        group_id=deal_id,
        entity_types=entity_types,      # Pass to Graphiti API
        edge_types=edge_types,          # Pass to Graphiti API
        edge_type_map=edge_type_map,    # Pass to Graphiti API
    )
```

### File Structure

```
manda-processing/src/graphiti/
├── __init__.py          # Exports GraphitiClient, GraphitiConnectionError, EpisodeType
├── client.py            # GraphitiClient singleton (E10.1, E10.2, update for E10.3)
├── config.py            # Graphiti-specific config (E10.1)
└── schema/              # NEW: Entity/Edge schema module
    ├── __init__.py      # Exports helpers, types, entity/edge classes
    ├── entities.py      # Pydantic entity models (Company, Person, etc.)
    ├── edges.py         # Pydantic edge models (WorksFor, SupersedesEdge, etc.)
    └── relationships.py # Constants: RELATIONSHIP_TYPES, EDGE_TYPE_MAP
```

### Testing Strategy

**Unit Tests:**
- Entity model validation (valid data creates instance)
- Edge model validation (valid data creates instance)
- Invalid data raises ValidationError for both entities and edges
- Literal field constraints (invalid role/severity values rejected)
- `get_entity_types()` returns dict with string keys and BaseModel values
- `get_edge_types()` returns dict with string keys and BaseModel values
- `get_edge_type_map()` returns dict with tuple keys and list values

**Integration Test (sample M&A text):**
```python
SAMPLE_MNA_TEXT = """
ABC Corporation (the "Target") is a leading provider of cloud services.
John Smith, CEO of ABC Corp, confirmed revenue of $4.8M for FY 2023.
The company faces key person risk due to dependence on the founder.
Major competitor TechCo Inc. recently raised Series B funding.
"""

# Expected entity extractions:
# - Company: ABC Corporation (role=target, aliases=["ABC Corp"])
# - Company: TechCo Inc. (role=competitor)
# - Person: John Smith (title=CEO, role=executive)
# - FinancialMetric: revenue, $4.8M, FY 2023, USD
# - Risk: key person risk, severity=medium, category=key_person

# Expected edge extractions:
# - WORKS_FOR: John Smith → ABC Corporation
# - COMPETES_WITH: TechCo Inc. → ABC Corporation
# - EXTRACTED_FROM: all entities → source document
```

### Previous Story Learnings (E10.1, E10.2)

**From E10.1:**
- Graphiti API import paths may differ from documentation - verify with actual imports
- `GeminiClient` is at `graphiti_core.llm_client.gemini_client.GeminiClient`
- `add_episode` uses `EpisodeType` enum for `source` parameter
- `build_indices_and_constraints()` may raise `EquivalentSchemaRuleAlreadyExists` if indices exist

**From E10.2:**
- VoyageAIEmbedder at `graphiti_core.embedder.voyage.VoyageAIEmbedder`
- Fallback pattern: try Voyage, catch exception, fall back to Gemini
- Cost tracking uses `estimated_tokens = len(content) // 4`

**Apply to E10.3:**
- `entity_types`, `edge_types`, `edge_type_map` are `add_episode()` parameters, NOT constructor params
- Dictionary format: `{'TypeName': PydanticModelClass}` for entities and edges
- Tuple keys for edge_type_map: `{('SourceType', 'TargetType'): ['EDGE_NAME']}`
- Test with real Graphiti instance (smoke test pattern from E10.1)

### Environment Requirements

No new environment variables needed. Uses existing:
- `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` (E10.1)
- `GOOGLE_API_KEY` (E10.1)
- `VOYAGE_API_KEY` (E10.2, optional with fallback)

---

## Project Structure Notes

### Alignment with Unified Project Structure

- New files in `manda-processing/src/graphiti/schema/` — follows existing module pattern
- Tests in `manda-processing/tests/unit/test_graphiti/` — consistent with E10.2
- Integration tests in `manda-processing/tests/integration/` — standard location

### No Conflicts Detected

- Does not modify E10.1/E10.2 deliverables (only extends client.py)
- Does not touch manda-app (frontend)
- Does not modify existing storage/neo4j_client.py (legacy, parallel system)

---

## References

- [Epic E10: Knowledge Graph Foundation](../epics/epic-E10.md) - Epic context
- [Tech Spec E10](../../sprint-artifacts/tech-specs/tech-spec-epic-E10.md) - Detailed technical specification
- [E10.1 Story](./e10-1-graphiti-infrastructure-setup.md) - Graphiti infrastructure (DONE)
- [E10.2 Story](./e10-2-voyage-embedding-integration.md) - Voyage embeddings (DONE)
- [Graphiti GitHub](https://github.com/getzep/graphiti) - Official repo
- [Graphiti Custom Entity Types](https://help.getzep.com/graphiti/core-concepts/custom-entity-and-edge-types) - Documentation

---

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All 61 unit tests pass
- All 74 graphiti unit tests pass (including E10.1 and E10.2 tests)
- Integration tests: 3 passed, 4 skipped (Neo4j not running in CI - expected)

### Completion Notes List

- Created schema module structure at `manda-processing/src/graphiti/schema/`
- Implemented 5 entity Pydantic models: Company, Person, FinancialMetric, Finding, Risk
- Implemented 7 edge Pydantic models: WorksFor, SupersedesEdge, ContradictsEdge, SupportsEdge, ExtractedFrom, CompetesWith, InvestsIn
- Created helper functions: `get_entity_types()`, `get_edge_types()`, `get_edge_type_map()`
- Exported module-level constants: ENTITY_TYPES, EDGE_TYPES, EDGE_TYPE_MAP, RELATIONSHIP_TYPES
- Updated GraphitiClient.add_episode() to accept entity_types, edge_types, edge_type_map parameters
- Defaults to M&A schema helpers when parameters not provided (AC: #5 dynamic discovery)
- Created 61 comprehensive unit tests for entity/edge model validation and helper functions
- Created 7 integration tests for Graphiti schema integration
- Updated graphiti-local-setup.md with comprehensive schema extension documentation

### Change Log

- 2025-12-16: Implemented E10.3 Sell-Side Spine Schema - all 8 tasks completed
- 2025-12-16: Code review fixes - added MentionsEdge, SuppliesEdge models and bounds validation

### File List

**Files Created:**
- `manda-processing/src/graphiti/schema/__init__.py` — Exports helpers and types (9 edge types, 5 entity types)
- `manda-processing/src/graphiti/schema/entities.py` — Entity Pydantic models (Company, Person, FinancialMetric, Finding, Risk)
- `manda-processing/src/graphiti/schema/edges.py` — Edge Pydantic models (WorksFor, SupersedesEdge, ContradictsEdge, SupportsEdge, ExtractedFrom, CompetesWith, InvestsIn, MentionsEdge, SuppliesEdge)
- `manda-processing/src/graphiti/schema/relationships.py` — Constants and edge_type_map
- `manda-processing/tests/unit/test_graphiti/test_schema.py` — 73 unit tests (includes new edge model tests and bounds validation)
- `manda-processing/tests/integration/test_graphiti_extraction.py` — 7 integration tests

**Files Modified:**
- `manda-processing/src/graphiti/client.py` — Added entity_types, edge_types, edge_type_map parameters to add_episode()
- `manda-processing/src/graphiti/__init__.py` — Added schema module exports (including MentionsEdge, SuppliesEdge, EntityType, EdgeType)
- `docs/setup/graphiti-local-setup.md` — Added comprehensive schema extension documentation (9 edge types documented)
