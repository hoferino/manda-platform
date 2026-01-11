# Story 3.5: Implement Deal Summary Generation

Status: backlog

> **DEFERRED:** This story is parked for future consideration. We don't yet know if we need rich deal context loaded upfront. Adding it now would be premature optimization and another point of failure. Revisit once we understand real user query patterns.

## Story

As a **user**,
I want **the agent to know key facts about my deal without me telling it**,
So that **conversations are immediately productive with relevant context**.

## Background

Story 3-1 implemented a "context-loader middleware" that loads basic deal metadata (dealId, dealName, status, documentCount) before every agent invocation. After review, this approach has several issues:

1. **Not real middleware** - LangGraph has a proper middleware API; this is just a pre-invoke function
2. **Unnecessary compute** - Runs on every message, even "hello" which doesn't need deal context
3. **Wrong data** - Loads cosmetic metadata (dealName, status) instead of useful M&A intelligence
4. **Premature loading** - Should be lazy-loaded when retrieval actually needs context

This story implements the correct approach:
- Generate rich deal summaries in the document processing pipeline
- Store in a `deal_summaries` table
- Retrieval node loads summary on-demand (lazy loading)
- Remove/deprecate the context-loader middleware

## Acceptance Criteria

1. **Given** the document processing pipeline completes for a deal
   **When** `detect-contradictions` finishes
   **Then** a `generate-deal-summary` job is enqueued
   **And** the summary includes: company name, sector, employees, products, revenue, EBITDA
   **And** the summary is stored in `deal_summaries` table

2. **Given** the `deal_summaries` table
   **When** a summary is generated
   **Then** it includes all key fields:
   - `company_name`: Target company being sold
   - `sector`: Industry/sector
   - `employees`: Employee count (if available)
   - `products`: Array of products/services
   - `revenue`: Latest revenue figure
   - `revenue_currency`: Currency code (default USD)
   - `ebitda`: Latest EBITDA
   - `ebitda_margin`: Calculated margin
   - `key_facts`: JSONB for additional context
   - `updated_at`: Timestamp of last update

3. **Given** a new document is uploaded to an existing deal
   **When** processing completes
   **Then** the deal summary is regenerated/updated
   **And** `updated_at` reflects the new timestamp

4. **Given** the retrieval node needs deal context
   **When** processing a user query
   **Then** it loads from `deal_summaries` (if exists)
   **And** caches the result for the session
   **And** falls back to basic `deals` table data if no summary exists

5. **Given** the context-loader middleware (Story 3-1)
   **When** this story is complete
   **Then** it is deprecated with a comment explaining lazy loading approach
   **And** it is NOT called in the agent invocation path
   **And** exports remain for backwards compatibility

6. **Given** deal isolation requirements
   **When** deal summary is loaded
   **Then** it uses the verified `dealId` from the API route
   **And** Supabase RLS enforces access control
   **And** no cross-deal data leakage is possible

## Tasks / Subtasks

- [ ] Task 1: Create deal_summaries table migration
  - [ ] 1.1 Create Supabase migration file
  - [ ] 1.2 Add RLS policies (same as deals table)
  - [ ] 1.3 Generate TypeScript types with `npm run db:types`

- [ ] Task 2: Create generate_deal_summary handler (manda-processing)
  - [ ] 2.1 Create `src/jobs/handlers/generate_deal_summary.py`
  - [ ] 2.2 Load findings from `findings` table
  - [ ] 2.3 Load financial metrics from `financial_metrics` table
  - [ ] 2.4 Query Graphiti for key entities (company, sector, products)
  - [ ] 2.5 Use LLM (Gemini 2.5 Pro) to synthesize structured summary
  - [ ] 2.6 Upsert to `deal_summaries` table
  - [ ] 2.7 Register handler in worker

- [ ] Task 3: Trigger summary generation from pipeline
  - [ ] 3.1 Add job enqueue after `detect-contradictions` completes
  - [ ] 3.2 Add job enqueue after any document processing completes (update flow)

- [ ] Task 4: Update retrieval to lazy-load deal context
  - [ ] 4.1 Create `loadDealSummary` helper in `lib/agent/v2/utils/`
  - [ ] 4.2 Implement cache-first loading (Redis → Supabase)
  - [ ] 4.3 Integrate into retrieval node (Story 3-2)
  - [ ] 4.4 Fallback to basic deal info if no summary

- [ ] Task 5: Deprecate context-loader middleware
  - [ ] 5.1 Add deprecation JSDoc comment
  - [ ] 5.2 Remove from agent invocation path
  - [ ] 5.3 Update CLAUDE.md middleware documentation
  - [ ] 5.4 Keep exports for backwards compatibility

- [ ] Task 6: Write tests
  - [ ] 6.1 Unit tests for generate_deal_summary handler
  - [ ] 6.2 Unit tests for loadDealSummary helper
  - [ ] 6.3 Integration test: pipeline → summary → retrieval

## Dev Notes

### Why This Approach

**Lazy loading vs eager loading:**
- Eager (Story 3-1): Load deal context on EVERY message, even "hello"
- Lazy (this story): Load deal context only when retrieval needs it

Most queries that need deal context will go through retrieval anyway. For simple greetings or non-deal questions, we skip the DB hit entirely.

**Rich context vs cosmetic data:**
- Story 3-1 loaded: dealName, status, documentCount, createdAt (cosmetic)
- This story loads: company name, financials, sector, products (actionable M&A intelligence)

The LLM can actually use this to answer questions like "What's the revenue?" without hitting the knowledge graph.

### Deal Summary Schema

```sql
CREATE TABLE deal_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    company_name TEXT,
    sector TEXT,
    employees INTEGER,
    products TEXT[],
    revenue DECIMAL,
    revenue_currency TEXT DEFAULT 'USD',
    ebitda DECIMAL,
    ebitda_margin DECIMAL,
    key_facts JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(deal_id)
);

-- RLS: Same as deals table
ALTER TABLE deal_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's deal summaries"
ON deal_summaries FOR SELECT
USING (
    deal_id IN (
        SELECT id FROM deals
        WHERE organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    )
);
```

### LLM Prompt for Summary Generation

```python
SUMMARY_PROMPT = """
Analyze the following deal findings and financial data. Extract a structured summary:

## Findings
{findings}

## Financial Metrics
{financials}

## Knowledge Graph Entities
{entities}

Return a JSON object with:
- company_name: The name of the target company being sold
- sector: Industry sector (e.g., "Industrial Manufacturing", "SaaS", "Healthcare")
- employees: Number of employees (integer, or null if unknown)
- products: Array of main products/services (max 5)
- revenue: Latest annual revenue in USD (number, or null)
- ebitda: Latest EBITDA in USD (number, or null)
- key_facts: Object with additional important facts (max 5 key-value pairs)

Only include facts that are clearly stated in the source data. Do not infer or fabricate.
"""
```

### Pipeline Integration

```python
# In detect_contradictions.py, after successful completion:
async def handle_detect_contradictions(job: Job) -> dict:
    deal_id = job.data["deal_id"]

    # ... existing contradiction detection ...

    # Trigger summary generation
    await job_manager.enqueue(
        "generate-deal-summary",
        {"deal_id": deal_id, "trigger": "contradiction_detection"},
        queue="default"
    )

    return {"status": "success", ...}
```

### Lazy Loading in Retrieval

```typescript
// lib/agent/v2/utils/deal-summary.ts

export async function loadDealSummary(dealId: string): Promise<DealSummary | null> {
  // 1. Check Redis cache
  const cached = await dealSummaryCache.get(dealId)
  if (cached.hit) return cached.value

  // 2. Load from Supabase
  const { data } = await supabase
    .from('deal_summaries')
    .select('*')
    .eq('deal_id', dealId)
    .single()

  if (data) {
    await dealSummaryCache.set(dealId, data)
    return data
  }

  // 3. Fallback to basic deal info
  return null
}

// In retrieval node:
async function retrievalNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const dealId = state.dealContext?.dealId
  if (!dealId) return state

  // Lazy load summary only when needed
  const summary = await loadDealSummary(dealId)

  // Use summary in retrieval context...
}
```

### References

- [Discussion: context-loader critique and lazy loading proposal]
- [Source: manda-processing/src/jobs/handlers/detect_contradictions.py]
- [Source: manda-processing/src/jobs/handlers/analyze_document.py]
- [Source: manda-app/lib/agent/v2/middleware/context-loader.ts] (to deprecate)
- [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Context Engineering Strategy]

## Story Dependencies

- **Depends on:** Story 3-2 (Retrieval Node) - for lazy loading integration
- **Deprecates:** Story 3-1 (Context Loader Middleware)

## File List (Planned)

**Create (manda-processing):**
- `src/jobs/handlers/generate_deal_summary.py`

**Create (manda-app):**
- `supabase/migrations/YYYYMMDD_create_deal_summaries.sql`
- `lib/agent/v2/utils/deal-summary.ts`

**Modify:**
- `manda-processing/src/jobs/handlers/detect_contradictions.py` - add job enqueue
- `manda-processing/src/jobs/worker.py` - register handler
- `manda-app/lib/agent/v2/middleware/context-loader.ts` - deprecation comment
- `manda-app/CLAUDE.md` - update middleware section
