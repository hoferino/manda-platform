# Dynamic Knowledge Graph Pipeline for M&A Intelligence

## Overview

Transform the Manda document processing and CIM builder from a rigid, template-based system to a dynamic, LLM-driven architecture that adapts to any deal type, buyer persona, or user focus.

**Core Principle:** If extraction is excellent and dynamic, everything downstream can adapt.

---

## Phase 1: Dynamic Entity Extraction (Backend)

### Goal
Remove schema constraints from Graphiti extraction to capture all relevant entities, not just predefined types.

### Changes

#### 1.1 Add Dynamic Extraction Instructions
**File:** `manda-processing/src/graphiti/ingestion.py`

Add `extraction_context` parameter to ingestion methods that gets embedded in `source_description`:

```python
DYNAMIC_EXTRACTION_TEMPLATE = """
Document: {document_name} | Type: {doc_type}
EXTRACTION FOCUS: Extract ALL entities relevant to M&A analysis including:
- Companies, subsidiaries, JVs, competitors
- People with roles and reporting relationships
- Financial metrics (always note period: Q1 2023, FY2024, etc.)
- Contracts, obligations, terms, clauses
- Products, customers, markets, facilities
- Risks, opportunities, assumptions
Create entities for domain-specific concepts even if not in predefined types.
"""
```

Modify `_build_source_description()` to include this context.

#### 1.2 Expose excluded_entity_types Parameter
**File:** `manda-processing/src/graphiti/client.py`

The graphiti_core library supports `excluded_entity_types` but it's not exposed. Add parameter to `add_episode()`:

```python
async def add_episode(
    cls,
    # ... existing params ...
    excluded_entity_types: Optional[list[str]] = None,  # NEW
) -> None:
```

#### 1.3 Document-Type-Aware Extraction Hints
**File:** `manda-processing/src/graphiti/extraction_hints.py` (NEW)

```python
EXTRACTION_HINTS = {
    "financial": "Focus on metrics with periods, accounting basis (GAAP/adjusted), formula relationships",
    "legal": "Focus on parties, obligations, terms, clauses, governing law, termination conditions",
    "operational": "Focus on facilities, capacity, KPIs, processes, org structure",
    "market": "Focus on competitors, market size, segments, growth drivers",
}

def get_extraction_hint(doc_type: str, user_focus: Optional[str] = None) -> str:
    base = EXTRACTION_HINTS.get(doc_type, "")
    if user_focus:
        base += f"\nUSER PRIORITY: {user_focus}"
    return base
```

### Files to Modify
- `manda-processing/src/graphiti/ingestion.py` (lines 176-293, 327-413, 415-496)
- `manda-processing/src/graphiti/client.py` (lines 224-347)
- `manda-processing/src/jobs/handlers/ingest_graphiti.py` (lines 194-200)

---

## Phase 2: Complexity-Based Document Routing (Backend)

### Goal
Route complex documents (financial models, dense tables) to direct LLM extraction for better quality.

### Changes

#### 2.1 Add Complexity Detection
**File:** `manda-processing/src/parsers/complexity.py` (NEW)

```python
@dataclass
class DocumentComplexity:
    score: int  # 0-100
    level: Literal["low", "medium", "high", "very_high"]
    signals: dict  # What triggered the score
    recommended_extraction: Literal["graphiti", "direct_llm"]

def assess_complexity(
    chunks_count: int,
    table_count: int,
    formula_count: int,
    file_size: int,
    mime_type: str
) -> DocumentComplexity:
    # Score based on: table density, formula presence, size, type
```

#### 2.2 Add Direct LLM Extraction Handler
**File:** `manda-processing/src/jobs/handlers/extract_direct_llm.py` (NEW)

For very complex documents, bypass Docling structured output and send raw content to Claude/Gemini:

```python
async def handle_extract_direct_llm(job: Job) -> dict:
    """Direct LLM extraction for complex financial models."""
    # 1. Download document from GCS
    # 2. Send to Claude with extraction prompt
    # 3. Parse structured JSON response
    # 4. Ingest entities directly to Neo4j
    # 5. Skip Graphiti episodic ingestion (already structured)
```

#### 2.3 Route Based on Complexity
**File:** `manda-processing/src/jobs/handlers/parse_document.py`

After parsing, assess complexity and route:

```python
complexity = assess_complexity(len(chunks), len(tables), len(formulas), file_size, mime_type)

if complexity.recommended_extraction == "direct_llm":
    await queue.enqueue("extract-direct-llm", {..., "complexity": complexity})
else:
    # Existing parallel path
    await queue.enqueue("embed-chunks", {...})
    await queue.enqueue("ingest-graphiti", {...})
```

### Files to Modify
- `manda-processing/src/jobs/handlers/parse_document.py` (lines 180-220)
- `manda-processing/src/jobs/worker.py` (register new handler)
- `manda-processing/src/jobs/queue.py` (add job options)

---

## Phase 3: Dynamic CIM Retrieval (Frontend)

### Goal
Replace static `SECTION_QUERIES` mapping with LLM-generated queries based on actual graph content and user context.

### Changes

#### 3.1 Add Query Generator
**File:** `manda-app/lib/agent/cim-mvp/query-generator.ts` (NEW)

```typescript
export async function generateDynamicQuery(
  sectionPath: string,
  context: {
    dealId: string;
    buyerPersona?: string;
    userFocus?: string;
    previousFindings?: string[];
  }
): Promise<string> {
  // 1. Get graph schema summary (what entities exist)
  // 2. Generate optimized query using Claude Haiku
  // 3. Cache result in Redis (24h TTL)
  return generatedQuery;
}
```

#### 3.2 Add Graph Schema Introspection
**File:** `manda-processing/src/api/routes/search.py`

New endpoint to get deal-specific schema:

```python
@router.get("/api/search/schema/{deal_id}")
async def get_deal_schema(deal_id: str) -> DealSchemaResponse:
    """Return entity types, relationship types, and sample entities in this deal."""
    # Query Neo4j for node labels, relationship types, counts
```

#### 3.3 Replace Static Query Mapping
**File:** `manda-app/lib/agent/cim-mvp/graphiti-knowledge.ts`

Replace `SECTION_QUERIES` with dynamic generation:

```typescript
export async function getSectionGraphiti(
  sectionPath: string,
  dealId: string,
  context?: { buyerPersona?: string; userFocus?: string }
): Promise<KnowledgeSearchResult[]> {
  // Try cache first
  const cacheKey = `cim:query:${dealId}:${sectionPath}`;
  let query = await redis.get(cacheKey);

  if (!query) {
    // Generate dynamic query
    query = await generateDynamicQuery(sectionPath, { dealId, ...context });
    await redis.set(cacheKey, query, { ex: 86400 }); // 24h
  }

  return searchGraphiti(query, dealId);
}
```

#### 3.4 Pass Context Through Tools
**File:** `manda-app/lib/agent/cim-mvp/tools.ts`

Modify `get_section_context` to pass buyer persona and user focus:

```typescript
// Access workflow state for context
const buyerPersona = state.buyerPersona?.buyerType;
const userFocus = state.gatheredContext?.notes?.join(' ');

const results = await globalKnowledgeService.getSection(sectionPath, {
  buyerPersona,
  userFocus,
});
```

### Files to Modify
- `manda-app/lib/agent/cim-mvp/graphiti-knowledge.ts` (lines 20-80)
- `manda-app/lib/agent/cim-mvp/tools.ts` (lines 233-321)
- `manda-app/lib/agent/cim-mvp/knowledge-service.ts` (interface update)
- `manda-processing/src/api/routes/search.py` (new endpoint)

---

## Phase 4: Text2Cypher (DEFERRED)

> User chose simpler search query generation over full Cypher generation. Can revisit later if needed.

---

## Phase 5: User-Driven Focus Adaptation (Frontend)

### Goal
Allow users to dynamically change what the system prioritizes without code changes.

### Changes

#### 5.1 Add Focus Management Tool
**File:** `manda-app/lib/agent/cim-mvp/tools.ts`

```typescript
const setFocusTool = tool({
  name: 'set_analysis_focus',
  description: 'Tell the system to prioritize specific aspects in retrieval and analysis',
  schema: z.object({
    focus: z.string().describe('What to focus on, e.g., "customer concentration" or "management team"'),
    scope: z.enum(['section', 'cim']).default('section'),
  }),
  func: async ({ focus, scope }) => {
    // Store in state.gatheredContext or state.userFocus
    // Invalidate cached queries for affected sections
  },
});
```

#### 5.2 Propagate Focus to Retrieval
Ensure `userFocus` is passed through all retrieval calls and included in query generation prompts.

### Files to Modify
- `manda-app/lib/agent/cim-mvp/tools.ts`
- `manda-app/lib/agent/cim-mvp/state.ts` (add userFocus field)
- `manda-app/lib/agent/cim-mvp/graphiti-knowledge.ts`

---

## Implementation Order (User Selected)

| Phase | Effort | Impact | Status |
|-------|--------|--------|--------|
| **Phase 1: Dynamic Extraction** | 4-6 hours | High | **IMPLEMENT** |
| **Phase 3: Dynamic CIM Retrieval** | 6-8 hours | High | **IMPLEMENT** |
| **Phase 2: Direct LLM for Complex Docs** | 8-12 hours | Medium | **IMPLEMENT** |
| **Phase 5: User Focus Adaptation** | 2-4 hours | Medium | Backlog |
| ~~Phase 4: Text2Cypher~~ | - | - | Deferred (using search queries instead) |

**Implementation Order:** Phase 1 → Phase 3 → Phase 2

---

## Verification Plan

### Phase 1 Verification
1. Upload a document with novel entity types (e.g., "Patent", "License")
2. Check Neo4j for nodes with those labels
3. Verify entities appear in Graphiti search results

### Phase 2 Verification
1. Upload a complex Excel financial model
2. Verify complexity detection routes to direct LLM
3. Compare extraction quality vs standard path
4. Check cost difference in usage logs

### Phase 3 Verification
1. Create CIM for a deal with unusual content
2. Verify dynamic queries are generated (check Redis cache)
3. Compare retrieval quality to static queries
4. Test with different buyer personas

### Phase 5 Verification (Backlog)
1. Set focus to "customer concentration"
2. Verify subsequent retrievals prioritize concentration data
3. Change focus and verify adaptation

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| LLM query generation produces bad queries | Keep static mapping as fallback; log and monitor query quality |
| Direct LLM extraction costs too high | Only route truly complex docs (>80 complexity score); monitor costs |
| Cypher generation produces unsafe queries | Validate all generated Cypher before execution; whitelist patterns |
| Cache invalidation issues | Use short TTL initially (1h); add manual invalidation endpoint |

---

## Cost Estimates

| Change | Additional Cost per Doc |
|--------|------------------------|
| Dynamic extraction instructions | ~$0 (uses existing source_description) |
| Direct LLM for complex docs | +$0.20-0.40 (but only for ~10% of docs) |
| Query generation | +$0.001 per section (Haiku, cached) |
| Cypher generation | +$0.002 per query (Haiku) |

**Net impact:** ~5-10% increase in processing cost for significantly better extraction quality and retrieval flexibility.
