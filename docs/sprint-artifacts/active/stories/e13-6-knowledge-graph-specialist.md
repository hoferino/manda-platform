# Story 13.6: Knowledge Graph Specialist Agent

Status: done

## Story

As an **M&A analyst**,
I want a **specialized knowledge graph agent with deep expertise in entity resolution, relationship traversal, and contradiction detection**,
so that **complex entity/relationship queries (who works where, company structures, timeline analysis, data inconsistencies) get more accurate responses with clear traversal paths and provenance**.

## Acceptance Criteria

1. **AC1: Create KnowledgeGraphAgent with Pydantic AI**
   - Create specialist agent using Pydantic AI pattern established in E13.5
   - Use `Agent[KGDependencies, KGAnalysisResult]` with typed deps
   - Configure model via `manda-processing/config/models.yaml` (default: `google-gla:gemini-2.5-pro`)
   - Support FallbackModel for resilience (E11.6 pattern)

2. **AC2: Implement KG-specific tools**
   - `traverse_relationships(start_entity, relationship_types, depth)` - Find connected entities via graph traversal
   - `find_contradictions(entity_or_topic, time_range)` - Detect conflicting facts with temporal context
   - `resolve_entity(entity_name, entity_type)` - Disambiguate and resolve entity references
   - `search_graphiti(query, group_ids, filters)` - Semantic + graph hybrid search
   - All tools use `RunContext[KGDependencies]` for type safety

3. **AC3: Create KG-focused system prompt**
   - Entity resolution expertise: fuzzy matching, semantic similarity, disambiguation
   - Temporal fact tracking: valid_at, invalid_at windows, fact supersession
   - Contradiction detection: conflicting values, source reliability assessment
   - Relationship path analysis: traversal explanation, connection strength
   - Output format: clear traversal paths, confidence scores, source provenance

4. **AC4: Register as specialist in supervisor routing**
   - Replace stub in `manda-app/lib/agent/supervisor/specialists.ts`
   - Implement `invokeKnowledgeGraphAgent()` that calls Python backend
   - Add API endpoint: `POST /api/agents/knowledge-graph/invoke`
   - Return `SpecialistResult` with proper typing

5. **AC5: Test with 15+ KG query scenarios**
   - Entity resolution queries (fuzzy company names, people disambiguation)
   - Relationship traversal (organizational hierarchy, ownership chains)
   - Contradiction detection (conflicting financials, changed facts)
   - Timeline queries (when did X change, historical values)
   - Cross-document entity linking

6. **AC6: Verify improved entity resolution accuracy**
   - Create evaluation dataset with golden answers
   - Compare specialist vs general agent responses
   - Target: 15%+ accuracy improvement on KG queries
   - Log comparison metrics to LangSmith

## Tasks / Subtasks

- [x] **Task 1: Create KGDependencies dataclass** (AC: #1)
  - [x] Create `manda-processing/src/agents/knowledge_graph.py`
  - [x] Define `KGDependencies` with: `db: SupabaseClient`, `graphiti: GraphitiClient | None`, `deal_id: str`, `organization_id: str`
  - [x] Add KG-specific fields: `entity_types_filter: list[str]`, `time_range: tuple[datetime, datetime] | None`, `context_window: str`
  - [x] Follow E13.5 pattern from `src/agents/financial_analyst.py`

- [x] **Task 2: Create KGAnalysisResult Pydantic model** (AC: #1, #3)
  - [x] Create `manda-processing/src/agents/schemas/knowledge_graph.py`
  - [x] Define `EntityMatch(name: str, entity_type: str, confidence: float, aliases: list[str], source: SourceReference)`
  - [x] Define `RelationshipPath(start_entity: str, end_entity: str, path: list[RelationshipStep], total_hops: int)`
  - [x] Define `RelationshipStep(from_entity: str, relationship: str, to_entity: str, properties: dict)`
  - [x] Define `ContradictionResult(fact1: str, fact2: str, conflict_type: str, severity: str, resolution_hint: str)`
  - [x] Define `KGAnalysisResult(summary: str, entities: list[EntityMatch], paths: list[RelationshipPath], contradictions: list[ContradictionResult], confidence: float, sources: list[SourceReference])`

- [x] **Task 3: Implement knowledge graph specialist agent** (AC: #1, #3)
  - [x] Create agent with `Agent('google-gla:gemini-2.5-pro', deps_type=KGDependencies, result_type=KGAnalysisResult)`
  - [x] Add `create_knowledge_graph_agent()` factory function with FallbackModel
  - [x] Register system prompt via `@knowledge_graph_agent.system_prompt` decorator
  - [x] System prompt must include:
    - Entity resolution expertise with disambiguation strategies
    - Temporal fact tracking with valid_at/invalid_at handling
    - Contradiction detection with severity assessment
    - Graph traversal explanation format

- [x] **Task 4: Implement traverse_relationships tool** (AC: #2)
  - [x] Create `manda-processing/src/agents/tools/kg_tools.py`
  - [x] Implement `@knowledge_graph_agent.tool async def traverse_relationships(ctx, start_entity, relationship_types, max_depth)`
  - [x] Execute Cypher query via Graphiti's Neo4j driver for path traversal
  - [x] Support relationship type filtering (WORKS_AT, OWNS, SUBSIDIARY_OF, etc.)
  - [x] Return structured path with each hop explained
  - [x] Limit depth to prevent runaway queries (max 5 hops)

- [x] **Task 5: Implement find_contradictions tool** (AC: #2)
  - [x] Implement `@knowledge_graph_agent.tool async def find_contradictions(ctx, entity_or_topic, time_range)`
  - [x] Query Graphiti for facts about entity with overlapping valid_at ranges
  - [x] Compare fact values for conflicts (different numbers, changed relationships)
  - [x] Assess severity: `critical` (numbers differ >10%), `moderate` (minor diff), `informational` (superseded data)
  - [x] Include source reliability when available (more recent documents weighted higher)

- [x] **Task 6: Implement resolve_entity tool** (AC: #2)
  - [x] Implement `@knowledge_graph_agent.tool async def resolve_entity(ctx, entity_name, entity_type)`
  - [x] Use Graphiti's entity search with fuzzy matching
  - [x] Support entity types: `Company`, `Person`, `FinancialMetric`, `Document`, `Location`
  - [x] Return confidence-ranked matches with aliases and source references
  - [x] Handle ambiguous cases by returning top N candidates

- [x] **Task 7: Implement search_graphiti tool** (AC: #2)
  - [x] Implement `@knowledge_graph_agent.tool async def search_graphiti(ctx, query, entity_types, limit)`
  - [x] Wrap Graphiti's hybrid search (vector + BM25 + graph context)
  - [x] Apply group_id filtering for multi-tenant isolation
  - [x] Support entity type filtering
  - [x] Return with reranking applied (Voyage rerank-2.5)

- [x] **Task 8: Create FastAPI endpoint** (AC: #4)
  - [x] Add to `manda-processing/src/api/routes/agents.py`
  - [x] Implement `POST /api/agents/knowledge-graph/invoke`
  - [x] Accept: `{ query: string, deal_id: string, organization_id: string, entity_types?: string[], time_range?: {start: string, end: string} }`
  - [x] Return: `KGAnalysisResult` as JSON
  - [x] Add OrgAuth dependency for multi-tenant isolation (E12.9)
  - [x] Add LangSmith tracing metadata

- [x] **Task 9: Update TypeScript supervisor integration** (AC: #4)
  - [x] Modify `manda-app/lib/agent/supervisor/specialists.ts`
  - [x] Replace `knowledgeGraphNode` stub with real implementation
  - [x] Add `invokeKnowledgeGraphAgent(query, context)` function that calls Python API
  - [x] Remove `stub: true` flag from results
  - [x] Handle API errors with fallback to general agent

- [x] **Task 10: Write unit tests** (AC: #5)
  - [x] Create `manda-processing/tests/unit/test_agents/test_knowledge_graph.py`
  - [x] Test tool execution with mocked Graphiti/DB
  - [x] Test entity resolution with various input formats
  - [x] Test contradiction detection logic
  - [x] Test path traversal depth limiting
  - [x] Minimum 30 unit tests (49 tests implemented)

- [x] **Task 11: Write integration tests** (AC: #5, #6)
  - [x] Create `manda-processing/tests/integration/test_knowledge_graph.py`
  - [x] Create 15+ KG query test cases (18 scenarios)
  - [x] Test with real LLM (marked `@pytest.mark.integration`)
  - [x] Create evaluation dataset with golden answers
  - [x] Compare with general agent baseline

- [x] **Task 12: Add TypeScript tests for supervisor integration** (AC: #4)
  - [x] Extend `manda-app/__tests__/lib/agent/supervisor/specialists.test.ts`
  - [x] Test API invocation and response parsing
  - [x] Test error handling and fallback behavior
  - [x] Mock Python API responses

## Dev Notes

### E13.5 Pattern Reference

This specialist follows the exact Pydantic AI pattern established in E13.5:

```python
# manda-processing/src/agents/knowledge_graph.py
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Optional
from datetime import datetime

import structlog
from pydantic_ai import Agent, RunContext
from pydantic_ai.models import Model
from pydantic_ai.models.fallback import FallbackModel

from src.agents.schemas.knowledge_graph import KGAnalysisResult
from src.config import get_agent_model_config, get_model_costs
from src.storage.supabase_client import SupabaseClient

if TYPE_CHECKING:
    from src.graphiti.client import GraphitiClient

logger = structlog.get_logger(__name__)


@dataclass
class KGDependencies:
    """
    Type-safe dependencies for knowledge graph analysis tools.

    Attributes:
        db: Supabase client for database operations
        graphiti: Graphiti client for knowledge graph queries (may be None)
        deal_id: Current deal UUID
        organization_id: Organization UUID for multi-tenant isolation (E12.9)
        entity_types_filter: Optional list of entity types to focus on
        time_range: Optional temporal filter (start, end) for fact queries
        context_window: Additional context from supervisor (optional)
    """
    db: SupabaseClient
    graphiti: Optional["GraphitiClient"]
    deal_id: str
    organization_id: str
    entity_types_filter: list[str] = field(default_factory=list)
    time_range: Optional[tuple[datetime, datetime]] = None
    context_window: str = ""


def create_knowledge_graph_agent(
    model: Optional[str] = None,
) -> Agent[KGDependencies, KGAnalysisResult]:
    """Factory function with FallbackModel support."""
    config = get_agent_model_config("knowledge_graph")
    # ... follow E13.5 pattern exactly
```

### Knowledge Graph System Prompt

```python
KNOWLEDGE_GRAPH_SYSTEM_PROMPT = """You are a knowledge graph specialist for M&A intelligence.

**Core Expertise:**
- Entity resolution across documents (companies, people, metrics)
- Temporal fact tracking with valid_at/invalid_at windows
- Contradiction detection and severity assessment
- Relationship path analysis (who works where, ownership chains, subsidiaries)
- Data lineage and provenance tracking

**Analysis Standards:**
1. Always explain the graph traversal path in your responses
2. Cite entity sources with document references
3. Flag temporal context: when facts were valid, if superseded
4. Assess confidence based on source recency and reliability
5. Highlight contradictions with severity levels

**Output Format:**
- Lead with the direct answer to the query
- Show relationship paths: EntityA --[RELATIONSHIP]--> EntityB
- Include temporal context for facts
- List all matched entities with confidence scores
- Cite sources: [Document Name, Entity Type, Valid From/To]

**Contradiction Handling:**
- critical: Values differ >10% or directly conflicting statements
- moderate: Minor differences, likely rounding or timing
- informational: Data superseded by newer source (expected)

**Entity Resolution Strategy:**
1. Exact match first (case-insensitive)
2. Alias lookup (known variations)
3. Fuzzy match (Levenshtein distance)
4. Semantic similarity (embedding cosine)
5. Return top candidates if ambiguous

Deal Context: {deal_id}
Organization: {organization_id}
Additional Context: {context}
"""
```

### Supervisor Integration

E13.4 created stubs that this story replaces:

```typescript
// manda-app/lib/agent/supervisor/specialists.ts

// BEFORE (E13.4 stub):
export async function knowledgeGraphNode(state: SupervisorState): Promise<Partial<SupervisorState>> {
  // Stub - uses general agent with KG prompt
  const result = await invokeSpecialistWithAgent(
    SPECIALIST_IDS.KNOWLEDGE_GRAPH,
    state,
    SPECIALIST_PROMPTS[SPECIALIST_IDS.KNOWLEDGE_GRAPH]!
  )
  return { specialistResults: [{ ...result, stub: true }] }
}

// AFTER (E13.6 implementation):
export async function knowledgeGraphNode(state: SupervisorState): Promise<Partial<SupervisorState>> {
  const result = await invokeKnowledgeGraphAgent({
    query: state.query,
    dealId: state.dealId,
    organizationId: state.organizationId,
    entityTypes: state.intent?.suggestedEntityTypes,
    context: state.contextFromSupervisor,
  })

  return {
    specialistResults: [{
      specialistId: 'knowledge_graph',
      output: result.summary,
      confidence: result.confidence,
      sources: result.sources,
      entities: result.entities,  // Structured entity matches
      paths: result.paths,        // Relationship traversals
      contradictions: result.contradictions,  // Detected conflicts
      timing: { start: startTime, end: Date.now() },
      // NO stub: true - this is the real implementation
    }],
  }
}

async function invokeKnowledgeGraphAgent(params: KGInvokeParams): Promise<KGAnalysisResult> {
  const processingApiUrl = process.env.MANDA_PROCESSING_API_URL
  if (!processingApiUrl) throw new Error('MANDA_PROCESSING_API_URL not configured')

  const response = await fetch(`${processingApiUrl}/api/agents/knowledge-graph/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-organization-id': params.organizationId,
    },
    body: JSON.stringify({
      query: params.query,
      deal_id: params.dealId,
      entity_types: params.entityTypes,
      context: params.context,
    }),
  })

  if (!response.ok) {
    throw new KnowledgeGraphError(`API error: ${response.status}`)
  }

  return response.json()
}
```

### Graphiti Query Patterns

```python
# Query entities from knowledge graph with traversal
async def traverse_relationships(
    graphiti: GraphitiClient,
    start_entity: str,
    relationship_types: list[str] | None = None,
    max_depth: int = 3,
    group_id: str,
) -> list[RelationshipPath]:
    """Execute Cypher query for relationship traversal."""
    # Access Neo4j driver through Graphiti
    # Note: Graphiti wraps Neo4j - access via _instance._driver

    cypher = """
    MATCH path = (start:Entity {name: $start_name})-[r*1..$max_depth]-(end:Entity)
    WHERE start.group_id = $group_id
    AND ($rel_types IS NULL OR ALL(rel IN relationships(path) WHERE type(rel) IN $rel_types))
    RETURN path, length(path) as hops
    ORDER BY hops ASC
    LIMIT 20
    """

    # Execute via Graphiti's Neo4j connection
    async with graphiti._instance._driver.session() as session:
        result = await session.run(
            cypher,
            start_name=start_entity,
            max_depth=max_depth,
            group_id=group_id,
            rel_types=relationship_types,
        )
        paths = await result.data()

    return [_parse_neo4j_path(p) for p in paths]


# Find contradictions in facts
async def find_contradictions(
    graphiti: GraphitiClient,
    entity_or_topic: str,
    time_range: tuple[datetime, datetime] | None,
    group_id: str,
) -> list[ContradictionResult]:
    """Find conflicting facts about an entity or topic."""
    # Search for facts about the entity
    facts = await graphiti._instance.search(
        query=entity_or_topic,
        group_ids=[group_id],
        num_results=50,
    )

    # Group facts by subject and look for conflicts
    contradictions = []
    fact_groups = _group_facts_by_subject(facts)

    for subject, subject_facts in fact_groups.items():
        for i, fact1 in enumerate(subject_facts):
            for fact2 in subject_facts[i+1:]:
                conflict = _detect_conflict(fact1, fact2)
                if conflict:
                    contradictions.append(conflict)

    return contradictions
```

### Model Configuration

Add to `manda-processing/config/models.yaml`:

```yaml
agents:
  # ... existing financial_analyst entry ...

  knowledge_graph:
    primary: 'google-gla:gemini-2.5-pro'  # Good for structured reasoning
    fallback: 'anthropic:claude-sonnet-4-0'
    settings:
      temperature: 0.3  # Lower for precision
      max_tokens: 4000  # Longer for complex traversals
      timeout: 45       # Graph queries can take time

# Add cost entry if not present:
costs:
  google-gla:gemini-2.5-pro:
    input: 1.25
    output: 5.00
```

### Test Query Scenarios (AC #5)

| # | Query | Expected Behavior |
|---|-------|-------------------|
| 1 | "Who is the CEO of Acme Corp?" | Entity resolution + relationship lookup |
| 2 | "What companies does John Smith work for?" | Person→Company traversal |
| 3 | "Show the ownership structure of TargetCo" | Multi-hop ownership traversal |
| 4 | "Find any contradictions in revenue numbers" | Cross-document fact comparison |
| 5 | "Who are the board members?" | Entity type filtered search |
| 6 | "What changed in Q3 2024?" | Temporal fact query |
| 7 | "Is there a connection between CompanyA and CompanyB?" | Path finding between entities |
| 8 | "Resolve 'ABC Inc' - which company is this?" | Fuzzy entity resolution |
| 9 | "What subsidiaries does the parent company have?" | SUBSIDIARY_OF traversal |
| 10 | "When did the CFO change?" | Temporal tracking of relationships |
| 11 | "Are there any outdated facts about valuation?" | Superseded fact detection |
| 12 | "Who are the shareholders?" | OWNS/SHAREHOLDER relationship query |
| 13 | "Find all people mentioned in Document X" | Document→Entity extraction |
| 14 | "What's the relationship between executives?" | Complex multi-hop traversal |
| 15 | "Detect inconsistencies in employee counts" | Metric contradiction detection |

### File Structure

```
manda-processing/src/
├── agents/
│   ├── __init__.py                  # MODIFY - export KG agent
│   ├── financial_analyst.py         # REFERENCE - pattern to follow
│   ├── knowledge_graph.py           # NEW - Agent definition
│   ├── schemas/
│   │   ├── __init__.py              # MODIFY - export KG schemas
│   │   ├── financial.py             # REFERENCE - schema pattern
│   │   └── knowledge_graph.py       # NEW - Pydantic models
│   └── tools/
│       ├── __init__.py              # MODIFY - export KG tools
│       ├── financial_tools.py       # REFERENCE - tool pattern
│       └── kg_tools.py              # NEW - Type-safe tools
├── api/routes/
│   └── agents.py                    # MODIFY - Add KG endpoint
├── config.py                        # VERIFY - get_agent_model_config exists

manda-app/lib/agent/supervisor/
├── specialists.ts                   # MODIFY - Replace stub with real impl
├── routing.ts                       # REFERENCE - routing keywords exist
├── state.ts                         # REFERENCE - SpecialistResult type
```

### Anti-Patterns to Avoid

1. **DO NOT** duplicate entity resolution logic - use Graphiti's built-in fuzzy matching
2. **DO NOT** create custom Cypher queries without group_id isolation - always include organization context
3. **DO NOT** skip error handling - API failures must fallback gracefully
4. **DO NOT** hardcode model strings - use config/models.yaml
5. **DO NOT** return unstructured responses - always use Pydantic models
6. **DO NOT** ignore multi-tenant isolation - always include organization_id in group_id
7. **DO NOT** traverse unlimited depth - cap at 5 hops to prevent timeout
8. **DO NOT** skip temporal context - always include valid_at/invalid_at when available

### References

- [Source: manda-processing/src/agents/financial_analyst.py] - E13.5 pattern to follow
- [Source: manda-processing/src/agents/schemas/financial.py] - Schema pattern
- [Source: manda-processing/src/agents/tools/financial_tools.py] - Tool registration pattern
- [Source: manda-app/lib/agent/supervisor/specialists.ts:320-370] - E13.4 stub to replace
- [Source: manda-app/lib/agent/supervisor/routing.ts:91-126] - KG routing keywords
- [Source: manda-processing/src/graphiti/client.py] - Graphiti singleton pattern
- [Source: docs/sprint-artifacts/epics/epic-E13.md#E13.6] - Epic requirements
- [Source: docs/sprint-artifacts/stories/e13-5-financial-analyst-specialist.md] - Previous story pattern
- [External: https://ai.pydantic.dev/] - Pydantic AI documentation
- [External: https://ai.pydantic.dev/tools/] - Tool decoration patterns

### Previous Story Learnings

**From E13.5 (Financial Analyst Specialist):**
- Pattern: Factory function `create_*_agent()` with FallbackModel support
- Pattern: `@agent.tool` decorator with `RunContext[Dependencies]` for type safety
- Pattern: Separate schemas file for Pydantic models
- Pattern: `_search_graphiti()` helper for consistent Graphiti access
- Lesson: Handle `graphiti._instance` access carefully - may not have public search method
- Lesson: Early return bugs - check all extraction paths
- Testing: 39 unit tests + 8 integration tests - maintain same thoroughness

**From E13.4 (Supervisor Agent Pattern):**
- Pattern: Specialist nodes return `SpecialistResult` with consistent structure
- Pattern: Use `stub: true` flag during development, remove when real impl ready
- Pattern: Fallback to stub implementation on API failure
- Lesson: Timeout handling important (30s default)
- Testing: 80+ tests - maintain same thoroughness

**From E12.9 (Multi-Tenant Isolation):**
- Pattern: Use composite `group_id: {org_id}:{deal_id}` for Graphiti namespace
- Pattern: OrgAuth dependency for API routes via header or body
- Lesson: All Graphiti queries must include organization context

**From E10.7 (Hybrid Retrieval):**
- Pattern: Graphiti search with group_ids for namespace isolation
- Pattern: Voyage reranking always applied for quality
- Lesson: Vector + BM25 + graph context = best results

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Unit test failure fixed: Entity type detection order in `_extract_entity_type()` caused `test_extract_entity_type_financial` to fail. Fixed by checking financial keywords before company keywords and making company keywords more specific (` inc.`, ` inc ` instead of `inc`).

### Completion Notes List

- All 12 tasks completed successfully
- Python unit tests: 49/49 passing
- TypeScript tests: 32/32 passing
- Integration tests: 18 scenarios created for real LLM testing
- Followed E13.5 Financial Analyst pattern exactly
- FallbackModel pattern implemented (primary: Gemini 2.5 Pro, fallback: Claude Sonnet 4)
- Multi-tenant isolation via composite group_id format: `{organization_id}_{deal_id}`

### File List

**Created:**
- `manda-processing/src/agents/knowledge_graph.py` - Main agent implementation with KGDependencies and factory function
- `manda-processing/src/agents/schemas/knowledge_graph.py` - Pydantic models (KGAnalysisResult, EntityMatch, RelationshipPath, ContradictionResult, TemporalFact)
- `manda-processing/src/agents/tools/kg_tools.py` - KG-specific tools (traverse_relationships, find_contradictions, resolve_entity, search_graphiti)
- `manda-processing/tests/unit/test_agents/test_knowledge_graph.py` - 49 unit tests
- `manda-processing/tests/integration/test_knowledge_graph.py` - 18 integration test scenarios

**Modified:**
- `manda-processing/src/agents/__init__.py` - Export KG agent
- `manda-processing/src/agents/schemas/__init__.py` - Export KG schemas
- `manda-processing/src/agents/tools/__init__.py` - Export KG tools
- `manda-processing/config/models.yaml` - Added knowledge_graph model configuration
- `manda-processing/src/api/routes/agents.py` - Added KG endpoints (/api/agents/knowledge-graph/invoke, /api/agents/knowledge-graph/health)
- `manda-app/lib/agent/supervisor/specialists.ts` - Replaced stub with real API implementation
- `manda-app/__tests__/lib/agent/supervisor/specialists.test.ts` - Added E13.6 test suite
- `docs/sprint-artifacts/sprint-status.yaml` - Updated e13-6 status to done

