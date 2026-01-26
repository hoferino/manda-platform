# Story 11.4: Intent-Aware Knowledge Retrieval

**Status:** done

---

## Story

As a **conversational agent**,
I want **to proactively retrieve relevant knowledge from the knowledge base before responding based on user intent classification**,
so that **I can prevent hallucinations by having relevant facts available before generating responses, skip unnecessary retrieval for greetings/meta-questions, and provide more accurate answers without the user explicitly asking me to search**.

---

## Acceptance Criteria

1. **AC1:** Intent classification before retrieval - categorize user message as: `greeting`, `meta`, `factual`, `task`
2. **AC2:** Skip retrieval for non-knowledge intents (`greeting`, `meta` patterns like "summarize our chat")
3. **AC3:** For `factual`/`task` intents, call Graphiti hybrid retrieval + Voyage reranking (E10.7)
4. **AC4:** Retrieved context injected into system prompt before LLM generation
5. **AC5:** Token budget for retrieval context (max 2000 tokens, configurable)
6. **AC6:** Caching: don't re-retrieve for follow-up on same topic (cache TTL: 5 minutes)
7. **AC7:** Latency tracking: pre-model retrieval should add < 500ms to response time

---

## Tasks / Subtasks

- [x] **Task 1: Create Intent Classification Module** (AC: #1, #2) ✅
  - [x] 1.1: Create `manda-app/lib/agent/intent.ts` with `classifyIntent(message: string): IntentType`
  - [x] 1.2: Define `IntentType = 'greeting' | 'meta' | 'factual' | 'task'`
  - [x] 1.3: Implement regex-based patterns for fast classification:
    - `greeting`: `/^(hi|hello|hey|thanks|bye|good morning)/i`
    - `meta`: `/^(what can you|help me|summarize|recap|what did we)/i`
    - `factual`/`task`: default for everything else
  - [x] 1.4: Add configurable pattern arrays in module (not hardcoded inline)

- [x] **Task 2: Create Pre-Model Retrieval Hook** (AC: #3, #4, #5) ✅
  - [x] 2.1: Create `manda-app/lib/agent/retrieval.ts` with `preModelRetrievalHook()`
  - [x] 2.2: Implement hook that takes messages, returns modified messages with injected context
  - [x] 2.3: Call `POST /api/search/hybrid` on manda-processing for Graphiti search
  - [x] 2.4: Format retrieved knowledge as system prompt section: `Relevant knowledge:\n${formattedContext}`
  - [x] 2.5: Implement token budget enforcement (truncate results to fit 2000 tokens)
  - [x] 2.6: Add `RETRIEVAL_MAX_TOKENS` env var (default: 2000)

- [x] **Task 3: Implement Retrieval Caching** (AC: #6) ✅
  - [x] 3.1: Create `RetrievalCache` class with topic-based key generation
  - [x] 3.2: Cache key: extract significant words (>3 chars) from query, sorted for topic matching
  - [x] 3.3: Cache TTL: 5 minutes (configurable via `RETRIEVAL_CACHE_TTL_MS`)
  - [x] 3.4: Max cache size: 20 entries (LRU eviction)
  - [x] 3.5: Skip cache for different deal context

- [x] **Task 4: Integrate Hook into Agent Executor** (AC: #3, #4) ✅
  - [x] 4.1: Modify `manda-app/lib/agent/executor.ts` - add `options` param with `dealId`
  - [x] 4.2: Integrate hook into `streamChat()` - call before agent.streamEvents()
  - [x] 4.3: Inject retrieved context as additional SystemMessage
  - [x] 4.4: Preserve existing tool-based search (this is additive, not replacement)

- [x] **Task 5: Wire Up Chat API Route** (AC: #3, #4) ✅
  - [x] 5.1: Modify `manda-app/app/api/projects/[id]/chat/route.ts`
  - [x] 5.2: Pass `dealId` (projectId) to `streamChat()` options parameter
  - [x] 5.3: Add retrieval metrics via `onRetrievalComplete` callback
  - [x] 5.4: Graceful degradation: if Graphiti unavailable, continue without context

- [x] **Task 6: Add Latency Tracking** (AC: #7) ✅
  - [x] 6.1: Add timing metrics to retrieval hook: `retrievalLatencyMs`
  - [x] 6.2: Log warning if retrieval exceeds 500ms target
  - [x] 6.3: Track cache hit rate via `cacheHit` boolean in metrics

- [x] **Task 7: Create Unit Tests** (AC: #1, #2, #6) ✅
  - [x] 7.1: Create `manda-app/__tests__/lib/agent/intent.test.ts` (92 tests for intent classification)
  - [x] 7.2: Test intent classification for all categories with edge cases
  - [x] 7.3: Create `manda-app/__tests__/lib/agent/retrieval.test.ts` (27 tests for retrieval hook)
  - [x] 7.4: Test cache behavior (hit, miss, TTL expiry, LRU eviction)
  - [x] 7.5: Test token budget enforcement
  - [x] **Total: 119 tests pass**

- [x] **Task 8: Integration Testing** (AC: #3, #4, #7) ✅
  - [x] 8.1: Test pre-model hook with mocked Graphiti response
  - [x] 8.2: Test agent receives injected context as SystemMessage
  - [x] 8.3: Test skip behavior for greetings/meta questions
  - [x] 8.4: All 119 unit tests pass

---

## Dev Notes

### Why Pre-Model Retrieval (Not Just Tool-Based)

**Current approach (tool-based):**
- Agent decides when to call `query_knowledge_base` tool
- Works well when agent knows it needs information
- **Problem:** Agent may not know to search, leading to hallucinations

**New approach (pre-model hook + tool-based):**
- **Pre-model hook:** Proactively retrieves relevant context BEFORE agent generates
- **Tool-based:** Agent can still explicitly search for more specific queries
- **Result:** Belt and suspenders - context is always available, agent can still search

**This is the primary defense against hallucinations** per Epic E11 requirements.

### Intent Classification Strategy

**Fast regex patterns (no LLM call needed):**
```typescript
// manda-app/lib/agent/intent.ts

export type IntentType = 'greeting' | 'meta' | 'factual' | 'task'

const SKIP_RETRIEVAL_PATTERNS = {
  greeting: [
    /^(hi|hello|hey|thanks|thank you|bye|goodbye|good morning|good evening)/i,
  ],
  meta: [
    /^(what can you|help me understand|how do you)/i,  // About agent
    /^(summarize|recap|what did we|review our)/i,      // About conversation
    /^(can you|could you|would you) (help|assist)/i,   // Requests about capabilities
  ],
}

export function classifyIntent(message: string): IntentType {
  const trimmed = message.trim()

  for (const pattern of SKIP_RETRIEVAL_PATTERNS.greeting) {
    if (pattern.test(trimmed)) return 'greeting'
  }

  for (const pattern of SKIP_RETRIEVAL_PATTERNS.meta) {
    if (pattern.test(trimmed)) return 'meta'
  }

  // Default: assume factual/task intent - retrieve knowledge
  return 'factual'
}

export function shouldRetrieve(intent: IntentType): boolean {
  return intent === 'factual' || intent === 'task'
}
```

### Pre-Model Hook Architecture

```typescript
// manda-app/lib/agent/retrieval.ts

import { classifyIntent, shouldRetrieve } from './intent'
import type { BaseMessage } from '@langchain/core/messages'
import { SystemMessage } from '@langchain/core/messages'

const PROCESSING_API_URL = process.env.PROCESSING_API_URL || 'http://localhost:8000'
const PROCESSING_API_KEY = process.env.PROCESSING_API_KEY || ''
const RETRIEVAL_MAX_TOKENS = parseInt(process.env.RETRIEVAL_MAX_TOKENS || '2000', 10)

interface RetrievalCache {
  get(key: string): CachedResult | undefined
  set(key: string, value: CachedResult): void
}

interface CachedResult {
  context: string
  entities: string[]
  timestamp: number
}

// Simple in-memory cache with LRU
const retrievalCache = new Map<string, CachedResult>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const MAX_CACHE_SIZE = 20

function getCacheKey(query: string, dealId: string): string {
  // Extract significant words for topic matching
  const words = query.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .sort()
    .join('_')
  return `${dealId}:${words}`
}

export interface PreModelHookResult {
  messages: BaseMessage[]
  retrievalLatencyMs: number
  cacheHit: boolean
  skipped: boolean
  entities?: string[]
}

export async function preModelRetrievalHook(
  messages: BaseMessage[],
  dealId: string,
): Promise<PreModelHookResult> {
  const startTime = performance.now()

  // Get last user message
  const lastMessage = messages.at(-1)
  const userQuery = typeof lastMessage?.content === 'string'
    ? lastMessage.content
    : ''

  if (!userQuery) {
    return { messages, retrievalLatencyMs: 0, cacheHit: false, skipped: true }
  }

  // Classify intent
  const intent = classifyIntent(userQuery)

  if (!shouldRetrieve(intent)) {
    console.log(`[preModelRetrievalHook] Skipping retrieval for intent: ${intent}`)
    return {
      messages,
      retrievalLatencyMs: Math.round(performance.now() - startTime),
      cacheHit: false,
      skipped: true,
    }
  }

  // Check cache
  const cacheKey = getCacheKey(userQuery, dealId)
  const cached = retrievalCache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[preModelRetrievalHook] Cache hit for: ${cacheKey}`)
    const contextMessage = new SystemMessage(`Relevant knowledge:\n${cached.context}`)
    return {
      messages: [contextMessage, ...messages],
      retrievalLatencyMs: Math.round(performance.now() - startTime),
      cacheHit: true,
      skipped: false,
      entities: cached.entities,
    }
  }

  // Call Graphiti hybrid search
  try {
    const response = await fetch(`${PROCESSING_API_URL}/api/search/hybrid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': PROCESSING_API_KEY,
      },
      body: JSON.stringify({
        query: userQuery,
        deal_id: dealId,
        num_results: 5, // Top 5 for context injection
      }),
    })

    if (!response.ok) {
      console.warn('[preModelRetrievalHook] Search failed:', response.status)
      return {
        messages,
        retrievalLatencyMs: Math.round(performance.now() - startTime),
        cacheHit: false,
        skipped: false,
      }
    }

    const searchResult = await response.json()

    if (!searchResult.results?.length) {
      return {
        messages,
        retrievalLatencyMs: Math.round(performance.now() - startTime),
        cacheHit: false,
        skipped: false,
      }
    }

    // Format context with token budget
    const context = formatRetrievedContext(searchResult.results, RETRIEVAL_MAX_TOKENS)

    // Cache the result
    if (retrievalCache.size >= MAX_CACHE_SIZE) {
      // LRU: delete oldest entry
      const oldestKey = retrievalCache.keys().next().value
      if (oldestKey) retrievalCache.delete(oldestKey)
    }
    retrievalCache.set(cacheKey, {
      context,
      entities: searchResult.entities || [],
      timestamp: Date.now(),
    })

    // Inject as system message
    const contextMessage = new SystemMessage(`Relevant knowledge:\n${context}`)

    const latencyMs = Math.round(performance.now() - startTime)
    if (latencyMs > 500) {
      console.warn(`[preModelRetrievalHook] Latency exceeded target: ${latencyMs}ms > 500ms`)
    }

    return {
      messages: [contextMessage, ...messages],
      retrievalLatencyMs: latencyMs,
      cacheHit: false,
      skipped: false,
      entities: searchResult.entities,
    }
  } catch (error) {
    console.error('[preModelRetrievalHook] Error:', error)
    return {
      messages,
      retrievalLatencyMs: Math.round(performance.now() - startTime),
      cacheHit: false,
      skipped: false,
    }
  }
}

function formatRetrievedContext(
  results: Array<{ content: string; score: number; citation?: { title: string; page?: number } }>,
  maxTokens: number,
): string {
  let context = ''
  let estimatedTokens = 0

  for (const result of results) {
    const source = result.citation?.title || 'Unknown'
    const page = result.citation?.page ? ` (p${result.citation.page})` : ''
    const line = `- ${result.content} [Source: ${source}${page}]\n`

    const lineTokens = Math.ceil(line.length / 4) // ~4 chars per token

    if (estimatedTokens + lineTokens > maxTokens) {
      break
    }

    context += line
    estimatedTokens += lineTokens
  }

  return context.trim()
}
```

### Executor Integration

```typescript
// In manda-app/lib/agent/executor.ts - modify streamChat
// Note: executeChat() is unused in the codebase (only streamChat is used by API routes)

import { preModelRetrievalHook, type PreModelHookResult } from './retrieval'

// Add options parameter to streamChat (this is what the API route uses)
export async function streamChat(
  agentOrWithCache: ReactAgentType | ChatAgentWithCache,
  input: string,
  chatHistory: ConversationMessage[] = [],
  callbacks: {
    onToken?: (token: string) => void
    onToolStart?: (tool: string, input: unknown) => void
    onToolEnd?: (tool: string, output: string) => void
    onError?: (error: Error) => void
    onRetrievalComplete?: (metrics: { latencyMs: number; cacheHit: boolean; skipped: boolean }) => void
  } = {},
  options?: { dealId?: string }  // NEW: Add options parameter
): Promise<string> {
  const agent = 'agent' in agentOrWithCache ? agentOrWithCache.agent : agentOrWithCache

  let messages = [...convertToLangChainMessages(chatHistory), new HumanMessage(input)]

  // E11.4: Pre-model retrieval hook
  if (options?.dealId) {
    const hookResult = await preModelRetrievalHook(messages, options.dealId)
    messages = hookResult.messages
    callbacks.onRetrievalComplete?.({
      latencyMs: hookResult.retrievalLatencyMs,
      cacheHit: hookResult.cacheHit,
      skipped: hookResult.skipped,
    })
  }

  // Use streaming with events (existing code)
  const eventStream = agent.streamEvents({ messages }, { version: 'v2' })
  // ... rest of streaming logic
}
```

### Chat API Route Modification

```typescript
// In manda-app/app/api/projects/[id]/chat/route.ts

// Current code (line 192):
await streamChat(agent, message, chatHistory, {
  onToken: (token) => handler.onToken(token),
  // ...
})

// Updated code - pass dealId to enable pre-model retrieval:
await streamChat(agent, message, chatHistory, {
  onToken: (token) => handler.onToken(token),
  onToolStart: (tool, input) => handler.onToolStart(tool, input),
  onToolEnd: (tool, output) => handler.onToolEnd(tool, output as string),
  onError: (error) => handler.onError(error),
  onRetrievalComplete: (metrics) => {
    console.log(`[api/chat] Retrieval: ${metrics.latencyMs}ms, cache=${metrics.cacheHit}, skipped=${metrics.skipped}`)
  },
}, { dealId: projectId })  // ← Pass dealId for pre-model retrieval
```

### Existing Code Patterns to Follow

**From `knowledge-tools.ts`:**
- Graphiti hybrid search call pattern: `POST /api/search/hybrid`
- Response structure: `{ results: [], entities: [], latency_ms: number }`
- Source citation format

**From `tool-isolation.ts` (E11.1):**
- Cache pattern: `Map<string, CacheEntry>` with TTL and LRU
- Token estimation: `~4 chars per token`
- Latency logging pattern

**From `executor.ts`:**
- Message conversion: `convertToLangChainMessages()`
- Agent invocation pattern

### File Structure

```
manda-app/
├── lib/agent/
│   ├── intent.ts           # NEW: Intent classification
│   ├── retrieval.ts        # NEW: Pre-model retrieval hook + cache
│   ├── executor.ts         # MODIFY: Add options param, integrate hook
│   ├── index.ts            # MODIFY: Export new modules
│   ├── tool-isolation.ts   # Reference: Cache patterns
│   └── tools/
│       └── knowledge-tools.ts  # Reference: Graphiti search format
├── app/api/projects/[id]/chat/
│   └── route.ts            # MODIFY: Pass dealId to streamChat
└── __tests__/lib/agent/
    ├── intent.test.ts      # NEW: Intent classification tests
    └── retrieval.test.ts   # NEW: Retrieval hook tests
```

**Files to CREATE (2):**
- `manda-app/lib/agent/intent.ts` - Intent classification
- `manda-app/lib/agent/retrieval.ts` - Pre-model hook + cache

**Files to MODIFY (3):**
- `manda-app/lib/agent/executor.ts` - Add options param to streamChat, integrate hook
- `manda-app/lib/agent/index.ts` - Export new modules
- `manda-app/app/api/projects/[id]/chat/route.ts` - Pass dealId to streamChat

**Test Files to CREATE (2):**
- `manda-app/__tests__/lib/agent/intent.test.ts`
- `manda-app/__tests__/lib/agent/retrieval.test.ts`

### Scope Clarification

**In Scope:**
- General project chat (`/api/projects/[id]/chat`)

**Out of Scope (for this story):**
- CIM chat (`/api/projects/[id]/cims/[cimId]/chat`) - separate agent with different context needs
- Can be added in follow-up if needed

### Testing Strategy

**Unit Tests:**
```typescript
// __tests__/lib/agent/intent.test.ts

describe('Intent Classification', () => {
  describe('greeting intent', () => {
    it('should classify "Hello" as greeting', () => {
      expect(classifyIntent('Hello')).toBe('greeting')
    })

    it('should classify "Thanks for the help" as greeting', () => {
      expect(classifyIntent('Thanks for the help')).toBe('greeting')
    })
  })

  describe('meta intent', () => {
    it('should classify "What can you do?" as meta', () => {
      expect(classifyIntent('What can you do?')).toBe('meta')
    })

    it('should classify "Summarize our conversation" as meta', () => {
      expect(classifyIntent('Summarize our conversation')).toBe('meta')
    })
  })

  describe('factual intent', () => {
    it('should classify "What was Q3 revenue?" as factual', () => {
      expect(classifyIntent('What was Q3 revenue?')).toBe('factual')
    })

    it('should classify "Tell me about the EBITDA margins" as factual', () => {
      expect(classifyIntent('Tell me about the EBITDA margins')).toBe('factual')
    })
  })
})
```

```typescript
// __tests__/lib/agent/retrieval.test.ts

describe('Pre-Model Retrieval Hook', () => {
  it('should skip retrieval for greetings', async () => {
    const messages = [new HumanMessage('Hello!')]
    const result = await preModelRetrievalHook(messages, 'deal-123')

    expect(result.skipped).toBe(true)
    expect(result.messages).toEqual(messages) // Unchanged
  })

  it('should inject context for factual queries', async () => {
    // Mock fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [{ content: 'Q3 revenue was $5.2M', score: 0.95 }],
        entities: ['Revenue', 'Q3'],
      }),
    })

    const messages = [new HumanMessage('What was Q3 revenue?')]
    const result = await preModelRetrievalHook(messages, 'deal-123')

    expect(result.skipped).toBe(false)
    expect(result.messages.length).toBe(2) // Context + original
    expect(result.messages[0].content).toContain('Relevant knowledge')
  })

  it('should use cache for repeated queries', async () => {
    // First call
    await preModelRetrievalHook([new HumanMessage('Q3 revenue?')], 'deal-123')

    // Second call (same topic)
    const result = await preModelRetrievalHook([new HumanMessage('Q3 revenue data')], 'deal-123')

    expect(result.cacheHit).toBe(true)
  })
})
```

### Relationship to Tool-Based Search

**This pre-model hook is ADDITIVE, not replacing existing behavior:**

| Mechanism | When | Purpose |
|-----------|------|---------|
| **Pre-model hook (E11.4)** | Before LLM generates | Proactive - ensure context available |
| **`query_knowledge_base` tool** | When agent decides | Reactive - agent explicitly searches |

The agent may still call `query_knowledge_base` for more specific queries even if pre-model hook already provided context. This is intentional - the hook provides general context, the tool enables specific lookups.

### Graceful Degradation

**Critical requirement:** The agent must still respond even if retrieval fails.

```typescript
// In retrieval.ts - handle Graphiti unavailability
try {
  const response = await fetch(`${PROCESSING_API_URL}/api/search/hybrid`, ...)

  if (!response.ok) {
    // Log for monitoring but don't block the agent
    console.warn('[preModelRetrievalHook] Search failed:', response.status)
    return { messages, retrievalLatencyMs, cacheHit: false, skipped: false }
  }
} catch (error) {
  // Network error, timeout, etc - continue without context
  console.error('[preModelRetrievalHook] Error:', error)
  return { messages, retrievalLatencyMs, cacheHit: false, skipped: false }
}
```

**Behavior when Graphiti unavailable:**
- Agent responds normally (without pre-fetched context)
- Tool-based `query_knowledge_base` still available as fallback
- Warning logged for monitoring/alerting

### Token Estimation

Using simple character-based estimation (`~4 chars per token`). This is consistent with other agent modules and sufficient for budget enforcement. If more accuracy needed, consider `tiktoken` library in future optimization.

### Cache Memory Management

The in-memory cache (`Map<string, CachedResult>`) is appropriate for:
- **Serverless (Vercel):** Each invocation is short-lived, cache naturally cleared
- **Long-running server:** LRU eviction (max 20 entries) prevents unbounded growth

For production monitoring, consider adding cache size metrics.

### E10.7 Dependency

This story depends on E10.7 (Hybrid Retrieval with Reranking) being complete:
- `HybridRetrievalService` in `manda-processing/src/graphiti/retrieval.py`
- `POST /api/search/hybrid` endpoint
- Voyage reranking pipeline

**Verify before implementation:** Run `curl -X POST localhost:8000/api/search/hybrid` to confirm endpoint exists.

---

## Project Structure Notes

### Alignment with Unified Project Structure

- New modules in `manda-app/lib/agent/` - consistent with existing agent modules
- Tests in `manda-app/__tests__/lib/agent/` - follows existing test structure
- Uses patterns from `tool-isolation.ts` (cache, token estimation)
- Integrates with existing `executor.ts` patterns

### Detected Variances

- None - this story follows established patterns

---

## References

- [Epic E11: Agent Context Engineering](../epics/epic-E11.md) - Epic context
- [LangChain Context Engineering Blog](https://blog.langchain.com/context-engineering-for-agents/) - "Select" strategy
- [E10.7 Hybrid Retrieval](../epics/epic-E10.md#e107-hybrid-retrieval-with-reranking) - Graphiti search
- [E11.1 Story: Tool Result Isolation](./e11-1-tool-result-isolation.md) - Cache patterns
- [Source: manda-processing/src/graphiti/retrieval.py] - HybridRetrievalService
- [Source: manda-app/lib/agent/tools/knowledge-tools.ts] - Graphiti search call pattern
- [Source: manda-app/lib/agent/executor.ts] - streamChat function to modify
- [Source: manda-app/app/api/projects/[id]/chat/route.ts] - Chat API route to wire up

---

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### Change Log

- 2025-12-18: Story created via create-story workflow with comprehensive developer context
- 2025-12-18: Story validated - added streamChat integration, API route modification, graceful degradation, scope clarification (8 tasks total)
- 2025-12-18: Implementation complete - all 8 tasks done, 119 unit tests pass
- 2025-12-18: Code review fixes applied (HIGH-1, MEDIUM-1, MEDIUM-3, LOW-2)

### File List

**Created:**
- `manda-app/lib/agent/intent.ts` - Intent classification module (greeting/meta/factual/task)
- `manda-app/lib/agent/retrieval.ts` - Pre-model retrieval hook with LRU caching
- `manda-app/__tests__/lib/agent/intent.test.ts` - 92 intent classification unit tests
- `manda-app/__tests__/lib/agent/retrieval.test.ts` - 27 retrieval hook unit tests

**Modified:**
- `manda-app/lib/agent/executor.ts` - Added `ChatExecutionOptions`, integrated `preModelRetrievalHook` into `streamChat()`
- `manda-app/lib/agent/index.ts` - Added barrel exports for intent and retrieval modules
- `manda-app/app/api/projects/[id]/chat/route.ts` - Wired up `dealId` and `onRetrievalComplete` callback
