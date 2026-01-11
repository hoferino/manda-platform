# Story 3.1: Implement Retrieval Node with Graphiti Integration

Status: review

## Story

As a **user**,
I want **the agent to search my deal documents for answers**,
So that **I get accurate, sourced information about my deals**.

## Acceptance Criteria

1. **Given** the v2 StateGraph
   **When** I create `lib/agent/v2/nodes/retrieval.ts`
   **Then** it integrates with existing Graphiti client via `callGraphitiSearch`
   **And** searches the knowledge graph for deal-specific context (FR23)
   **And** returns results with source citations (`SourceCitation[]`)

2. **Given** a query about deal information
   **When** retrieval is invoked
   **Then** appropriate search method is selected (vector, keyword, or graph) based on query (FR25)
   **And** results are entity-connected and context-aware (FR26)
   **And** query completes in <500ms for simple retrieval (NFR3)

3. **Given** deal context is available in state
   **When** retrieval executes
   **Then** it uses `state.dealContext.dealId` for Graphiti namespace isolation
   **And** respects tenant boundaries (multi-tenant security)

4. **Given** the retrieval node returns results
   **When** results are added to state
   **Then** `state.sources` is populated with `SourceCitation[]` objects
   **And** sources include: documentId, documentName, location, snippet, relevanceScore, retrievedAt

5. **Given** the retrieval infrastructure
   **When** supervisor node needs retrieval
   **Then** it can route to retrieval node via graph edges
   **And** retrieval returns control back to supervisor with enriched state

## Tasks / Subtasks

- [x] Task 1: Create retrieval node file (AC: #1, #5)
  - [x] 1.1 Create `lib/agent/v2/nodes/retrieval.ts`
  - [x] 1.2 Define `retrievalNode` as async function `(state: AgentStateType) => Promise<Partial<AgentStateType>>`
  - [x] 1.3 Extract query from last user message in `state.messages`
  - [x] 1.4 Add comprehensive JSDoc with story references

- [x] Task 2: Integrate Graphiti search (AC: #1, #2, #3)
  - [x] 2.1 Import `callGraphitiSearch` from `@/lib/agent/retrieval`
  - [x] 2.2 Extract `dealId` from `state.dealContext?.dealId`
  - [x] 2.3 Handle missing dealId gracefully (return empty sources, log warning)
  - [x] 2.4 Call Graphiti hybrid search with query and dealId
  - [x] 2.5 Log retrieval latency: `[retrieval] query="${query}" dealId=${dealId} latency=${ms}ms results=${count}`
  - [x] 2.6 Log warning when latency exceeds 500ms (NFR3)

- [x] Task 3: Transform results to SourceCitation (AC: #4)
  - [x] 3.1 Map Graphiti `HybridSearchResult` to `SourceCitation` interface
  - [x] 3.2 Handle null/missing citation fields gracefully (see Type Mismatch Note below)
  - [x] 3.3 Set `retrievedAt` to current ISO timestamp
  - [x] 3.4 Calculate relevanceScore from Graphiti score (0-1 range)

- [x] Task 4: Update state with sources (AC: #4, #5)
  - [x] 4.1 Return `{ sources: SourceCitation[] }` partial state
  - [x] 4.2 DO NOT modify `state.messages` - that's supervisor's job
  - [x] 4.3 Preserve existing state fields (immutable pattern)

- [x] Task 5: Export and integrate with graph (AC: #5)
  - [x] 5.1 Export `retrievalNode` from `lib/agent/v2/nodes/index.ts`
  - [x] 5.2 Export from `lib/agent/v2/index.ts`
  - [x] 5.3 Add node to graph in `lib/agent/v2/graph.ts` (node only, no edges yet)

- [x] Task 6: Write unit tests (AC: #1-#5)
  - [x] 6.1 Create `lib/agent/v2/nodes/__tests__/retrieval.test.ts`
  - [x] 6.2 Test: returns empty sources when no dealContext
  - [x] 6.3 Test: calls Graphiti with correct dealId
  - [x] 6.4 Test: transforms Graphiti results to SourceCitation
  - [x] 6.5 Test: handles Graphiti errors gracefully (returns empty sources)
  - [x] 6.6 Test: preserves other state fields unchanged
  - [x] 6.7 Test: does NOT modify messages array
  - [x] 6.8 Test: includes retrievedAt timestamp on all sources
  - [x] 6.9 Test: handles empty Graphiti results
  - [x] 6.10 Test: logs warning when latency exceeds 500ms

## Dev Notes

### ⚠️ CRITICAL: DO NOT REINVENT - Use Existing Code

```typescript
// ✅ MUST USE - existing Graphiti search function
import { callGraphitiSearch } from '@/lib/agent/retrieval'

// ✅ MUST USE - existing SourceCitation type
import type { SourceCitation } from '../types'

// ❌ NEVER create new fetch calls to /api/search/hybrid
// ❌ NEVER define your own SourceCitation interface
```

### Context Loader Dependency Note

The epics file shows this story depends on "Context Loader Middleware" (Story 2.3). However, **context-loader was DEFERRED** (code exists in `lib/agent/v2/middleware/context-loader.ts` but is NOT active in the agent invocation path).

**This means:** The retrieval node must work with PARTIAL `dealContext` that only has `dealId` populated. Do NOT assume `dealName`, `organizationId`, or other fields are present.

```typescript
// ✅ CORRECT - only check dealId
const dealId = state.dealContext?.dealId
if (!dealId) {
  console.warn('[retrieval] No dealId, skipping')
  return { sources: [] }
}

// ❌ WRONG - these fields may not be populated
if (!state.dealContext?.dealName) { ... }  // dealName may be empty string
```

### Type Mismatch Note (IMPORTANT)

There is a **type inconsistency** between `lib/agent/retrieval.ts` and `lib/agent/tools/knowledge-tools.ts`:

**In `retrieval.ts` (line 79-87):**
```typescript
interface HybridSearchResult {
  content: string
  score: number
  citation?: {
    type: string
    title: string
    page?: number
    // NOTE: No 'id' field in this definition!
  }
}
```

**In `knowledge-tools.ts` (line 159):**
```typescript
documentId: result.citation?.id || ''  // Uses citation.id which doesn't exist in types!
```

**Resolution:** The actual API response from `manda-processing` includes `citation.id`. The TypeScript types in `retrieval.ts` are incomplete. Use this pattern:

```typescript
// Safe transform that handles missing id field
documentId: (result.citation as { id?: string })?.id || '',
```

Or generate a placeholder ID if not available:
```typescript
documentId: result.citation?.id || `graphiti-${Date.now()}-${index}`,
```

### Architecture Context

This is the **retrieval node** in the v2 agent system - a core component that provides knowledge graph search capabilities. It implements the **Select** pillar of context engineering.

**Role in Graph:**
```
User Message → Supervisor → (decides to retrieve) → Retrieval Node → Supervisor → Response
```

**Graph Integration Clarification:**
- Add the node to `graph.ts` with `graphBuilder.addNode('retrieval', retrievalNode)`
- Do NOT add edges yet - supervisor will call retrieval directly (or via tool-calling in Epic 4)
- This story creates the node; routing integration comes in later stories

### Node Implementation Pattern

```typescript
/**
 * Retrieval Node
 *
 * Story: 3-1 Implement Retrieval Node with Graphiti Integration (AC: #1-#5)
 *
 * Searches Graphiti knowledge graph for deal-specific context.
 * Returns SourceCitation[] in state for supervisor to use.
 */
export async function retrievalNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  // 1. Extract query from last user message
  const lastMessage = state.messages.at(-1)
  const query = typeof lastMessage?.content === 'string'
    ? lastMessage.content
    : ''

  if (!query) {
    console.log('[retrieval] No query in messages, skipping')
    return { sources: [] }
  }

  // 2. Get dealId from context (may be partial - see Context Loader Note)
  const dealId = state.dealContext?.dealId
  if (!dealId) {
    console.warn('[retrieval] No dealId in state.dealContext, skipping retrieval')
    return { sources: [] }
  }

  // 3. Call Graphiti with error handling
  const startTime = performance.now()
  let result: HybridSearchResponse | null = null

  try {
    result = await callGraphitiSearch(query, dealId)
  } catch (error) {
    console.error('[retrieval] Graphiti search failed:', error)
    return { sources: [] }
  }

  const latencyMs = Math.round(performance.now() - startTime)

  // 4. Log with latency warning (NFR3: < 500ms)
  console.log(`[retrieval] query="${query.slice(0, 50)}..." dealId=${dealId} latency=${latencyMs}ms results=${result?.results?.length ?? 0}`)
  if (latencyMs > 500) {
    console.warn(`[retrieval] Latency exceeded target: ${latencyMs}ms > 500ms`)
  }

  // 5. Transform to SourceCitation
  if (!result?.results?.length) {
    return { sources: [] }
  }

  const sources: SourceCitation[] = result.results.map((r, index) => ({
    documentId: (r.citation as { id?: string })?.id || `graphiti-${index}`,
    documentName: r.citation?.title || 'Unknown source',
    location: r.citation?.page ? { page: r.citation.page } : undefined,
    snippet: r.content,
    relevanceScore: r.score,
    retrievedAt: new Date().toISOString(),
  }))

  return { sources }
}
```

### Testing Strategy

**Mock Requirements:**
```typescript
vi.mock('@/lib/agent/retrieval', () => ({
  callGraphitiSearch: vi.fn(),
}))
```

**Test Cases (10 tests):**
| # | Test Case | Verifies |
|---|-----------|----------|
| 1 | Returns empty sources when no query | AC #1 |
| 2 | Returns empty sources when no dealContext | AC #3 |
| 3 | Returns empty sources when dealContext.dealId is missing | AC #3 |
| 4 | Calls Graphiti with correct dealId | AC #3 |
| 5 | Transforms results to SourceCitation correctly | AC #4 |
| 6 | Handles Graphiti null response | AC #1 |
| 7 | Handles Graphiti error gracefully | AC #1 |
| 8 | Preserves other state fields | Immutability |
| 9 | Does NOT modify messages | Immutability |
| 10 | Logs warning when latency exceeds 500ms | NFR3 |

### File Structure After Implementation

```
lib/agent/v2/
├── nodes/
│   ├── index.ts           # Export retrievalNode
│   ├── supervisor.ts      # Existing
│   ├── retrieval.ts       # NEW - retrievalNode
│   └── __tests__/
│       ├── supervisor.test.ts  # Existing
│       └── retrieval.test.ts   # NEW - 10 unit tests
├── graph.ts               # Add retrieval node (no edges)
└── index.ts               # Export retrievalNode
```

### Anti-Patterns to Avoid

```typescript
// ❌ Don't reinvent Graphiti search
const response = await fetch(`${PROCESSING_API_URL}/api/search/hybrid`, ...)
// ✅ DO use existing callGraphitiSearch
import { callGraphitiSearch } from '@/lib/agent/retrieval'

// ❌ Don't check for fully populated dealContext
if (!state.dealContext?.dealName) { ... }
// ✅ DO only check dealId (context-loader is deferred)
if (!state.dealContext?.dealId) { ... }

// ❌ Don't throw on errors
if (!result) throw new Error('Graphiti failed')
// ✅ DO degrade gracefully
if (!result) return { sources: [] }

// ❌ Don't modify messages
return { ...state, messages: [...state.messages, newMsg] }
// ✅ DO only return sources
return { sources }
```

### Previous Story Learnings

From Epic 2 retrospective:
1. **Context-loader deferred** - Don't assume full dealContext is populated
2. **Log namespace prefix** - Use `[retrieval]` for all console output
3. **Immutable state** - Always return `{ sources }` not modify existing state
4. **Error structure** - Graceful degradation, don't crash agent

### References

- `lib/agent/retrieval.ts:319-347` - `callGraphitiSearch` function
- `lib/agent/retrieval.ts:79-96` - HybridSearchResult/Response types
- `lib/agent/v2/types.ts:38-58` - SourceCitation interface
- `lib/agent/v2/nodes/supervisor.ts` - Node implementation pattern
- `lib/agent/v2/state.ts:211-239` - createInitialState (partial dealContext)
- `_bmad-output/implementation-artifacts/agent-system-v2/stories/_deferred-context-loader-middleware.md` - Context loader deferral rationale
- `CLAUDE.md#Agent System v2.0` - Naming conventions and patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation proceeded smoothly without debugging issues.

### Completion Notes List

1. **Implementation Complete** - All 6 tasks and subtasks completed
2. **18 Unit Tests Pass** - Comprehensive test coverage for all 5 ACs
3. **Type Safety** - Created MockHybridSearchResponse interface to handle API response vs. TypeScript type mismatch (per Dev Notes)
4. **Graph Integration** - Node added to graph.ts but no edges (as specified)
5. **Exports Updated** - Properly exported from nodes/index.ts and lib/agent/v2/index.ts
6. **Pre-existing Type Errors** - Type check reveals errors in OTHER test files (not related to this story) - those are pre-existing issues

### Implementation Summary

**What was built:**
- `lib/agent/v2/nodes/retrieval.ts` - The retrieval node that searches Graphiti for deal-specific context
- `lib/agent/v2/nodes/__tests__/retrieval.test.ts` - 18 unit tests covering all acceptance criteria

**Key design decisions:**
- Graceful degradation: Returns empty sources on errors instead of throwing
- Partial context support: Works with minimal dealContext (only dealId required)
- Latency logging: Logs all queries with performance warnings at 500ms threshold
- Immutable state: Only returns `{ sources }` - never modifies messages or other state

**Tests verify:**
- Query extraction from messages
- Deal namespace isolation
- Graphiti result transformation to SourceCitation
- Error handling (null response, network errors, empty results)
- State immutability
- Latency logging and warnings

### File List

| File | Action | Lines |
|------|--------|-------|
| `lib/agent/v2/nodes/retrieval.ts` | Created | 130 |
| `lib/agent/v2/nodes/__tests__/retrieval.test.ts` | Created | 680 |
| `lib/agent/v2/nodes/index.ts` | Modified | +2 |
| `lib/agent/v2/index.ts` | Modified | +1 |
| `lib/agent/v2/graph.ts` | Modified | +8 |
