# DEFERRED: Context Loader Middleware

> **STATUS: CODE EXISTS BUT NOT IN USE**
>
> This story was completed (code written, tests passing), but we decided NOT to use it in the agent invocation path. The decision was made on 2026-01-11 after reviewing:
>
> 1. **Not real middleware** - LangGraph has a proper middleware API; this is just a pre-invoke function
> 2. **Premature optimization** - Runs on every message, even "hello" which doesn't need deal context
> 3. **Wrong data** - Loads cosmetic metadata (dealName, status) instead of useful M&A intelligence
> 4. **API route already sufficient** - The chat route validates deal access via RLS (sufficient security)
> 5. **Another point of failure** - Adds complexity with unclear benefit
>
> **Code location:** `lib/agent/v2/middleware/context-loader.ts`
> **Tests location:** `lib/agent/v2/middleware/__tests__/context-loader.test.ts`
>
> If we need rich deal context in the future, see Story 3-5 (Deal Summary Generation) for the lazy-loading approach that was proposed as an alternative.

---

# Original Story: Context Loader Middleware

Status: done (code exists, NOT IN USE)

## Story

As a **developer**,
I want **deal context loaded once per thread and cached**,
So that **the agent has relevant deal context without repeated loading and database queries**.

## Acceptance Criteria

1. **Given** the middleware architecture from the architecture doc
   **When** I create `lib/agent/v2/middleware/context-loader.ts`
   **Then** it loads deal context on first invocation of a thread
   **And** stores context in `state.dealContext`
   **And** skips loading on subsequent invocations (context already present)

2. **Given** Redis caching strategy from architecture
   **When** deal context is loaded
   **Then** it's cached with key `deal:{dealId}:context` and 1-hour TTL
   **And** cache hits return in ~5ms
   **And** cache uses existing `RedisCache` class from `lib/cache/redis-cache.ts`

3. **Given** context loading failure
   **When** the middleware cannot load deal context (deal not found, access denied)
   **Then** it sets a `CONTEXT_ERROR` in `state.errors` array
   **And** logs warning with deal ID and error details
   **And** the agent continues with `state.dealContext` remaining null
   **And** supervisor can still handle non-deal-specific queries

4. **Given** the middleware is first in the pipeline
   **When** the middleware stack is assembled
   **Then** context-loader runs FIRST (before workflow-router)
   **And** subsequent middleware can rely on `state.dealContext` being populated or null
   **And** middleware order is enforced: context-loader → workflow-router → tool-selector → summarization

5. **Given** middleware is a pure state transformer
   **When** context-loader processes state
   **Then** it performs async data fetching (Supabase query, Redis cache)
   **But** returns a new state object (immutable pattern)
   **And** does NOT modify `state.messages` array
   **And** does NOT call the LLM directly

6. **Given** tenant isolation requirements (FR5)
   **When** deal context is loaded
   **Then** only deals the user has access to are loaded (RLS enforced)
   **And** `projectId` from deal is stored in `dealContext` for downstream isolation
   **And** document count is fetched and included in context

7. **Given** existing state schema (`lib/agent/v2/state.ts`)
   **When** context loader populates `dealContext`
   **Then** it fills all required `DealContext` fields:
   - `dealId`: UUID from request
   - `dealName`: From Supabase `deals.name`
   - `projectId`: From Supabase `deals.id` (deals table IS projects)
   - `organizationId`: From Supabase `deals.organization_id`
   - `status`: From Supabase `deals.status` (mapped to 'active' | 'closed' | 'archived')
   - `documentCount`: Count query on documents table
   - `createdAt`: From Supabase `deals.created_at`

## Tasks / Subtasks

- [x] Task 1: Add cache namespace for deal context (AC: #2)
  - [x] 1.1 Add `dealContext: 'cache:deal:context:'` to `CACHE_NAMESPACES` in `lib/cache/redis-client.ts`
  - [x] 1.2 Create `DealContextCache` instance in new file or export from cache module
  - [x] 1.3 Set TTL to 3600 seconds (1 hour) per architecture spec
  - [x] 1.4 Set maxEntries to 100 (reasonable limit for concurrent deals)

- [x] Task 2: Create context loader middleware (AC: #1, #4, #5)
  - [x] 2.1 Create `lib/agent/v2/middleware/context-loader.ts`
  - [x] 2.2 Define `contextLoaderMiddleware` as async function (needs DB/cache access)
  - [x] 2.3 Update `Middleware` type in index.ts to support both sync and async:
    ```typescript
    export type Middleware = (state: AgentStateType) => AgentStateType | Promise<AgentStateType>
    ```
  - [x] 2.4 Early return if `state.dealContext` is already fully populated (skip loading)
  - [x] 2.5 Extract `dealId` from partial `state.dealContext.dealId` (set by `createInitialState`)
  - [x] 2.6 Handle case where `dealContext` is null (no deal context needed - chat without deal)

- [x] Task 3: Implement cache-first loading (AC: #2)
  - [x] 3.1 Check Redis cache first with key `deal:{dealId}:context`
  - [x] 3.2 If cache hit, return cached `DealContext` directly (~5ms)
  - [x] 3.3 If cache miss, fetch from Supabase
  - [x] 3.4 Cache the result with 1-hour TTL
  - [x] 3.5 Log cache hit/miss for observability: `[context-loader] cache=hit|miss dealId=xxx`

- [x] Task 4: Implement Supabase data fetching (AC: #6, #7)
  - [x] 4.1 Import `createClient` from `@/lib/supabase/server`
  - [x] 4.2 Query `deals` table: `supabase.from('deals').select('*').eq('id', dealId).single()`
  - [x] 4.3 Query document count: `supabase.from('documents').select('id', { count: 'exact' }).eq('deal_id', dealId)`
  - [x] 4.4 Map Supabase `Deal` row to `DealContext` interface:
    - `dealId` = `deal.id`
    - `dealName` = `deal.name`
    - `projectId` = `deal.id` (deals table IS projects)
    - `organizationId` = `deal.organization_id`
    - `status` = map `deal.status` ('active' | 'closed' | 'archived', default 'active')
    - `documentCount` = count from documents query
    - `createdAt` = `deal.created_at`
  - [x] 4.5 RLS policies on `deals` table enforce tenant isolation automatically

- [x] Task 5: Implement error handling (AC: #3)
  - [x] 5.1 Wrap Supabase queries in try/catch
  - [x] 5.2 If deal not found (error or null result):
    - Create `AgentError` with code `CONTEXT_ERROR`
    - Set `recoverable: false` (can't proceed with invalid deal)
    - Set `message: 'Deal not found or access denied'`
    - Add to `state.errors` array
  - [x] 5.3 If cache error (Redis fail):
    - Log warning but don't add to state.errors (non-fatal)
    - Fall through to Supabase query
  - [x] 5.4 Return state with `dealContext: null` on error (agent can still handle general queries)

- [x] Task 6: Export and integrate middleware (AC: #4)
  - [x] 6.1 Export `contextLoaderMiddleware` from `lib/agent/v2/middleware/index.ts`
  - [x] 6.2 Export from `lib/agent/v2/index.ts`
  - [x] 6.3 Document middleware order in JSDoc:
    ```typescript
    /**
     * Middleware Order (Critical):
     * 1. contextLoaderMiddleware  - Load deal context (THIS)
     * 2. workflowRouterMiddleware - Set system prompt
     * 3. toolSelectorMiddleware   - Filter tools (Story 4.1)
     * 4. summarizationMiddleware  - Compress context (Story 4.7)
     */
    ```

- [x] Task 7: Write unit tests (AC: #1, #2, #3, #5, #7)
  - [x] 7.1 Create `lib/agent/v2/middleware/__tests__/context-loader.test.ts`
  - [x] 7.2 Test: skips loading when dealContext already populated
  - [x] 7.3 Test: loads from cache when available (mock Redis hit)
  - [x] 7.4 Test: loads from Supabase on cache miss (mock Supabase)
  - [x] 7.5 Test: caches result after Supabase load
  - [x] 7.6 Test: maps Deal fields to DealContext correctly
  - [x] 7.7 Test: includes document count in context
  - [x] 7.8 Test: handles deal not found (sets CONTEXT_ERROR)
  - [x] 7.9 Test: handles cache error gracefully (falls through to Supabase)
  - [x] 7.10 Test: preserves all other state fields unchanged
  - [x] 7.11 Test: does NOT modify messages array
  - [x] 7.12 Test: handles null dealContext (no deal context needed)

- [ ] Task 8: Write integration tests (AC: #4, #6) - SKIPPED (requires live infrastructure)
  - [ ] 8.1 Create `lib/agent/v2/__tests__/context-loader.integration.test.ts`
  - [ ] 8.2 Test: context-loader populates dealContext, workflow-router reads it
  - [ ] 8.3 Test: middleware chain order is enforced
  - [ ] 8.4 Test: RLS isolation (mock different user, verify access denied)
  - [ ] 8.5 Guard with `RUN_INTEGRATION_TESTS=true`

## Dev Notes

### Architecture Context

This is the **FIRST middleware** in the 4-pillar context engineering stack from the architecture doc:

```
Middleware Order (Critical - from architecture doc):
1. contextLoaderMiddleware  - Load deal context ← THIS STORY
2. workflowRouterMiddleware - Set system prompt by mode (Story 2.3 - DONE)
3. toolSelectorMiddleware   - Filter tools by mode/permissions (Story 4.1)
4. summarizationMiddleware  - Compress at 70% threshold (Story 4.7)
```

The context loader implements the **Select** pillar of context engineering:
- Load deal context ONCE per thread
- Cache in Redis for subsequent requests
- Downstream middleware/nodes can rely on `state.dealContext`

### Async Middleware Pattern

Unlike `workflowRouterMiddleware` which is synchronous, `contextLoaderMiddleware` MUST be async because it performs:
1. Redis cache lookup
2. Supabase database query
3. Redis cache write

Update the `Middleware` type to support async:

```typescript
// lib/agent/v2/middleware/index.ts
export type Middleware = (state: AgentStateType) => AgentStateType | Promise<AgentStateType>

// Or define both types explicitly:
export type SyncMiddleware = (state: AgentStateType) => AgentStateType
export type AsyncMiddleware = (state: AgentStateType) => Promise<AgentStateType>
export type Middleware = SyncMiddleware | AsyncMiddleware
```

### Existing Infrastructure to Use

**Redis Cache (`lib/cache/redis-cache.ts`):**
```typescript
import { RedisCache } from '@/lib/cache/redis-cache'
import type { DealContext } from '../types'

// Create cache instance
const dealContextCache = new RedisCache<DealContext>(
  'cache:deal:context:',  // namespace
  3600,                    // TTL: 1 hour (per architecture spec)
  100                      // maxEntries
)

// Usage
const cached = await dealContextCache.get(dealId)
if (cached.hit) {
  return { ...state, dealContext: cached.value }
}
// ... fetch from Supabase ...
await dealContextCache.set(dealId, dealContext)
```

**Supabase Client (`lib/supabase/server.ts`):**
```typescript
import { createClient } from '@/lib/supabase/server'

const supabase = await createClient()
const { data: deal, error } = await supabase
  .from('deals')
  .select('*')
  .eq('id', dealId)
  .single()
```

**Deal Table Schema (from database.types.ts):**
```typescript
deals: {
  Row: {
    id: string              // UUID, also serves as projectId
    name: string            // Deal name for display
    company_name: string | null
    organization_id: string // Tenant ID for isolation
    user_id: string        // Creator
    status: string | null  // 'active' | 'closed' | 'archived'
    industry: string | null
    created_at: string     // ISO timestamp
    updated_at: string
    metadata: Json | null
  }
}
```

### Redis Strategy from Epic 2 Retro

From `epic-2-retro-2026-01-10.md`:

> **Redis Strategy:**
> - Code migrated to ioredis (from @upstash/redis) but Redis not required to run
> - Cache gracefully falls back to in-memory when REDIS_URL not set
> - No Redis usage in lib/agent/v2/ - no interference with LangGraph agent
> - Redis can be enabled later via `docker-compose.dev.yml` when needed

The existing `RedisCache` class handles:
- Automatic fallback to in-memory Map when Redis unavailable
- Graceful degradation on Redis errors
- LangSmith-compatible logging

**This means:** Context loader can use Redis caching, and it will automatically fall back to in-memory if Redis isn't configured. No special handling needed.

### organizationId Note

While `organizationId` is marked optional in the `DealContext` interface, **always populate it** from `deals.organization_id` for proper multi-tenant isolation tracking. This field is critical for downstream tenant isolation and audit logging.

### Error Handling from Architecture

From `agent-system-architecture.md`, use standard error codes:

```typescript
import { AgentErrorCode, type AgentError } from '../types'

// On deal not found:
const error: AgentError = {
  code: AgentErrorCode.CONTEXT_ERROR,
  message: 'Deal not found or access denied',
  details: { dealId, supabaseError: error?.message },
  recoverable: false,
  timestamp: new Date().toISOString(),
  nodeId: 'context-loader',
}

return {
  ...state,
  dealContext: null,
  errors: [...state.errors, error],
}
```

### Implementation Pattern

```typescript
/**
 * Context Loader Middleware
 *
 * Story: 3-1 Implement Context Loader Middleware (AC: #1-#7)
 *
 * Loads deal context once per thread and caches in Redis.
 * First middleware in the stack - runs before workflow-router.
 */
export async function contextLoaderMiddleware(
  state: AgentStateType
): Promise<AgentStateType> {
  // Skip if context already fully loaded
  if (state.dealContext?.dealName) {
    return state
  }

  // Skip if no deal ID (non-deal conversation)
  const dealId = state.dealContext?.dealId
  if (!dealId) {
    console.log('[context-loader] No dealId in state, skipping context load')
    return state
  }

  try {
    // 1. Check cache first
    const cached = await dealContextCache.get(dealId)
    if (cached.hit && cached.value) {
      console.log(`[context-loader] cache=hit dealId=${dealId} latency=${cached.latencyMs}ms`)
      return { ...state, dealContext: cached.value }
    }
    console.log(`[context-loader] cache=miss dealId=${dealId}`)

    // 2. Fetch from Supabase
    const dealContext = await loadDealContextFromSupabase(dealId)
    if (!dealContext) {
      return handleDealNotFound(state, dealId)
    }

    // 3. Cache the result
    await dealContextCache.set(dealId, dealContext)

    return { ...state, dealContext }
  } catch (error) {
    console.error('[context-loader] Failed to load context:', error)
    return handleContextError(state, dealId, error)
  }
}

async function loadDealContextFromSupabase(dealId: string): Promise<DealContext | null> {
  const supabase = await createClient()

  // Parallel queries for better performance
  const [dealResult, countResult] = await Promise.all([
    supabase.from('deals').select('*').eq('id', dealId).single(),
    supabase.from('documents').select('id', { count: 'exact', head: true }).eq('deal_id', dealId),
  ])

  const { data: deal, error: dealError } = dealResult
  const { count } = countResult

  if (dealError || !deal) {
    return null
  }

  return {
    dealId: deal.id,
    dealName: deal.name,
    projectId: deal.id, // deals table IS projects
    organizationId: deal.organization_id,
    status: mapDealStatus(deal.status),
    documentCount: count ?? 0,
    createdAt: deal.created_at,
  }
}

function mapDealStatus(status: string | null): 'active' | 'closed' | 'archived' {
  if (status === 'closed' || status === 'archived') {
    return status
  }
  return 'active' // default
}
```

### Testing Strategy

**Unit Tests (12 tests):**
| # | Test Case | Verifies |
|---|-----------|----------|
| 1 | Skips loading when dealContext already populated | AC #1 |
| 2 | Returns cached context on Redis hit | AC #2 |
| 3 | Fetches from Supabase on cache miss | AC #1 |
| 4 | Caches result after Supabase load | AC #2 |
| 5 | Maps all Deal fields to DealContext | AC #7 |
| 6 | Includes document count | AC #7 |
| 7 | Handles deal not found (CONTEXT_ERROR) | AC #3 |
| 8 | Handles Redis error gracefully (fallthrough) | AC #3 |
| 9 | Preserves other state fields | AC #5 |
| 10 | Does NOT modify messages | AC #5 |
| 11 | Handles null dealContext (no deal) | AC #1 |
| 12 | Returns ~5ms on cache hit | AC #2 |

**Mock Requirements:**
```typescript
vi.mock('@/lib/cache/redis-cache', () => ({
  RedisCache: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
  }),
}))
```

### File Structure After Implementation

```
lib/agent/v2/
├── middleware/
│   ├── index.ts                    # Updated Middleware type + exports
│   ├── context-loader.ts           # NEW - contextLoaderMiddleware
│   ├── workflow-router.ts          # From Story 2.3
│   └── __tests__/
│       ├── context-loader.test.ts  # NEW - 12 unit tests
│       └── workflow-router.test.ts # From Story 2.3
├── __tests__/
│   ├── context-loader.integration.test.ts  # NEW - 4 integration tests
│   └── workflow-router.integration.test.ts # From Story 2.3
└── ...

lib/cache/
├── redis-client.ts                 # Updated: add dealContext namespace
└── redis-cache.ts                  # Existing (no changes needed)
```

### Anti-Patterns to Avoid

```typescript
// ❌ Don't make middleware sync when it needs async operations
export function contextLoaderMiddleware(state): AgentStateType {
  // Can't await here!
}

// ❌ Don't fetch on every invocation (should skip if context exists)
const deal = await supabase.from('deals')... // Always fetches!

// ❌ Don't block on cache errors
if (!cached) throw new Error('Cache failed')  // Should fall through

// ❌ Don't modify messages in context loader
return { ...state, messages: [...state.messages, msg] }

// ❌ Don't hardcode deal IDs or skip RLS
.eq('id', 'hardcoded-deal-id')

// ❌ Don't import DealContext from irl-tools (different local interface)
import { DealContext } from '@/lib/agent/tools/irl-tools'  // WRONG!

// ✅ DO import from v2/types (unified interface)
import type { DealContext } from '../types'

// ✅ DO skip if context already loaded
if (state.dealContext?.dealName) return state

// ✅ DO use cache-first pattern
const cached = await cache.get(dealId)
if (cached.hit) return { ...state, dealContext: cached.value }

// ✅ DO handle errors gracefully
return handleContextError(state, dealId, error)

// ✅ DO log for observability
console.log(`[context-loader] cache=hit|miss dealId=${dealId}`)
```

### Previous Story Learnings

From Epic 2 stories, patterns to follow:
1. **JSDoc with story references:** `Story: 3-1 Implement Context Loader... (AC: #1)`
2. **Guard integration tests:** Use `RUN_INTEGRATION_TESTS=true`
3. **Log namespace prefix:** `[context-loader]` for all console output
4. **Error structure:** Use `AgentError` interface with proper codes
5. **Immutable state:** Always spread `{ ...state, field: newValue }`

### References

- [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Context Engineering Strategy]
- [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Redis Caching Strategy]
- [Source: _bmad-output/planning-artifacts/agent-system-epics.md#Story 2.3] - Workflow Router (moved from original 2.3 slot)
- [Source: _bmad-output/implementation-artifacts/agent-system-v2/epic-2-retro-2026-01-10.md#Redis Strategy]
- [Source: manda-app/lib/cache/redis-cache.ts] - RedisCache class
- [Source: manda-app/lib/cache/redis-client.ts] - Redis client and namespaces
- [Source: manda-app/lib/api/deals.ts] - getDealById function pattern
- [Source: manda-app/lib/supabase/database.types.ts:334-347] - deals table schema
- [Source: manda-app/lib/agent/v2/types.ts:172-194] - DealContext interface
- [Source: manda-app/lib/agent/v2/state.ts:112-119] - dealContext Annotation
- [Source: CLAUDE.md#Middleware Order (Critical)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

1. **Cache namespace added** - Added `dealContext: 'cache:deal:context:'` to `CACHE_NAMESPACES` in `lib/cache/redis-client.ts`

2. **Async middleware type** - Extended `Middleware` type to support both sync and async middleware via `SyncMiddleware | AsyncMiddleware` union

3. **Cache-first pattern** - Implementation uses separate try/catch for cache and DB operations, so cache failures gracefully fall through to Supabase

4. **29 unit tests passing** - Comprehensive test suite covering all ACs

5. **Integration tests skipped** - Requires live Supabase/Redis infrastructure

### Code Review Fixes (2026-01-11)

1. **[HIGH] organizationId made non-optional** - Updated `DealContext.organizationId` from `string | undefined` to `string` in `lib/agent/v2/types.ts` per multi-tenant isolation requirements

2. **[MEDIUM] Cache write error test added** - Added 2 tests for cache write error graceful fallthrough (Tests #13.1, #13.2)

3. **[MEDIUM] Cache latency test added** - Added 2 tests verifying ~5ms cache hit performance (Tests #14.1, #14.2)

4. **[MEDIUM] Integration test scaffold created** - Created `lib/agent/v2/__tests__/context-loader.integration.test.ts` with placeholder tests for RLS, middleware order, and Redis integration

5. **33 unit tests now passing** (was 29)

### File List

**Created:**
- `manda-app/lib/agent/v2/middleware/context-loader.ts` - Main middleware implementation
- `manda-app/lib/agent/v2/middleware/__tests__/context-loader.test.ts` - 33 unit tests
- `manda-app/lib/agent/v2/__tests__/context-loader.integration.test.ts` - Integration test scaffold

**Modified:**
- `manda-app/lib/cache/redis-client.ts` - Added `dealContext` namespace
- `manda-app/lib/agent/v2/middleware/index.ts` - Added async middleware types, exported contextLoaderMiddleware
- `manda-app/lib/agent/v2/index.ts` - Exported contextLoaderMiddleware and new middleware types
- `manda-app/lib/agent/v2/types.ts` - Made `organizationId` non-optional in `DealContext`

