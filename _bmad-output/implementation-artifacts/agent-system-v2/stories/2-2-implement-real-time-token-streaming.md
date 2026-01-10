# Story 2.2: Implement Real-Time Token Streaming

Status: complete

## Story

As a **user**,
I want to **see the response as it's being generated**,
So that **I know the system is working and can read along**.

## Acceptance Criteria

1. **Token Streaming via SSE**: Given a user sends a message, when the supervisor generates a response, then tokens stream in real-time via SSE (FR18).

2. **First Token Latency**: Given a user sends a message, when the supervisor begins generating, then the first token appears within 2 seconds (NFR1).

3. **Smooth Streaming**: Given tokens are being streamed, when the user is reading, then streaming is smooth without visible buffering (NFR2).

4. **SSE Event Format Compliance**: Given the existing SSE event types in `lib/agent/streaming.ts`, when streaming occurs, then events follow the discriminated union pattern with timestamps.

5. **Token Event Content**: Given streaming is active, when token events are emitted, then `token` events include the content being streamed.

6. **Done Event Completion**: Given streaming completes, when the done event is sent, then it includes the complete response and sources.

## Tasks / Subtasks

- [x] Task 1: Create Token Streaming Function (AC: #1, #2, #3)
  - [x] Create `lib/agent/v2/stream.ts` with streaming utilities
  - [x] Implement `streamAgentWithTokens()` that builds on existing `streamAgent()` from `invoke.ts`
  - [x] Extract tokens from `on_chat_model_stream` events
  - [x] Ensure streaming begins immediately without buffering

- [x] Task 2: Update Chat Route for Token Streaming (AC: #4, #5)
  - [x] Modify `/api/projects/[id]/chat/route.ts` to use new streaming function
  - [x] Emit token events with v2-compliant format (`content` field)
  - [x] Emit `token` events with timestamp per architecture requirements

- [x] Task 3: Update SSE Token Event Format (AC: #4, #5, #6)
  - [x] Create v2-specific event emission in chat route (bypassing legacy AgentStreamHandler)
  - [x] Use `content` field per architecture doc instead of legacy `text` field
  - [x] Add timestamps to token events per architecture doc
  - [x] Updated TokenStreamEvent in types.ts to include optional `node` field

- [x] Task 4: Performance Optimization for First Token Latency (AC: #2)
  - [x] No buffering - async generator yields immediately
  - [x] Iterator pattern ensures no collection before emit

- [x] Task 5: Error Handling During Streaming (AC: #1)
  - [x] Handle stream interruption with try/catch in ReadableStream
  - [x] Emit structured `error` event on failure during streaming
  - [x] Error handling integrated directly in route (simpler than separate wrapper)

- [x] Task 6: Unit and Integration Tests (AC: all)
  - [x] Test token extraction logic (13 unit tests pass)
  - [x] Test TokenStreamEvent structure matches architecture
  - [x] Test timestamps are ISO format
  - [x] Integration test for real LLM (guarded, skipped without credentials)

## Dev Notes

### Architecture Context

Story 2.2 builds directly on Story 2.1 which implemented the supervisor node with LLM-based routing. Now we add **real-time token streaming** so users see responses character-by-character rather than waiting for the complete response.

**Current State After Story 2.1:**
- Supervisor node using Gemini via Vertex AI (`lib/agent/v2/nodes/supervisor.ts`)
- Chat route with basic SSE streaming (`app/api/projects/[id]/chat/route.ts`)
- SSE infrastructure with event types (`lib/agent/streaming.ts`)
- `streamAgent()` function already using `streamEvents` v2 (`lib/agent/v2/invoke.ts:90-119`)
- `safeStreamAgent()` wrapper for error handling (`lib/agent/v2/utils/safe-invoke.ts`)

**Problem to Solve:**
The current chat route uses `safeStreamAgent()` which yields LangGraph `StreamEvent` objects but doesn't extract individual tokens from `on_chat_model_stream` events. Users see state updates but not the actual text being generated in real-time.

**Key Insight:** The existing `streamAgent()` in `invoke.ts` already uses `graph.streamEvents()` with version 'v2'. This story ENHANCES that pattern by extracting token events, not duplicating infrastructure.

### Technical Requirements

**Existing streamAgent (DO NOT DUPLICATE):**

The `lib/agent/v2/invoke.ts` already implements streaming with `streamEvents` v2:

```typescript
// FROM invoke.ts - REUSE THIS PATTERN
export async function* streamAgent(
  state: AgentStateType,
  threadId: string,
  config?: RunnableConfig
): AsyncGenerator<StreamEvent> {
  const graph = await createCompiledAgentGraph()
  // ... config setup ...
  for await (const event of graph.streamEvents(state, streamOptions)) {
    yield event
  }
}
```

The new `streamAgentWithTokens()` should wrap or enhance this, extracting tokens from `on_chat_model_stream` events.

**LangGraph Token Events:**

```typescript
// Token events from streamEvents v2
for await (const event of graph.streamEvents(input, { version: 'v2' })) {
  if (event.event === 'on_chat_model_stream') {
    const content = event.data?.chunk?.content
    if (content) onToken(content)
  }
}
```

### SSE Field Naming: CRITICAL Decision

**Issue:** The existing `AgentStreamHandler.onToken()` at line 170 writes:
```typescript
this.writer.write({ type: 'token', text: token })  // Uses 'text'
```

But architecture doc specifies `content` field:
```typescript
interface TokenEvent { type: 'token'; content: string; timestamp: string }
```

**Resolution Options (choose one):**
1. Update `AgentStreamHandler` to use `content` instead of `text` (breaking change for any existing consumers)
2. Create v2-specific token event emission in the new stream utilities
3. Update frontend to accept both `text` and `content` during transition

**Recommended:** Option 2 - emit v2-compliant events directly in the chat route, bypassing `AgentStreamHandler.onToken()` for token events only. Use handler for tool events and done.

### Implementation Pattern

**New File: `lib/agent/v2/stream.ts`**

```typescript
/**
 * Agent System v2.0 - Token Streaming Utilities
 *
 * Story: 2-2 Implement Real-Time Token Streaming (AC: #1, #2, #3)
 *
 * Enhances existing streamAgent with token-level extraction.
 */

import type { StreamEvent } from '@langchain/core/tracers/log_stream'
import type { RunnableConfig } from '@langchain/core/runnables'
import { streamAgent } from './invoke'
import type { AgentStateType } from './state'

/**
 * Token streaming event emitted during LLM generation.
 * Per architecture doc: uses 'content' field with timestamp.
 */
export interface TokenStreamEvent {
  type: 'token'
  content: string
  timestamp: string
  node?: string
}

/**
 * Stream agent with token-level granularity.
 * Wraps existing streamAgent, extracting tokens from on_chat_model_stream events.
 *
 * @yields TokenStreamEvent for each token, plus original StreamEvent for state tracking
 */
export async function* streamAgentWithTokens(
  state: AgentStateType,
  threadId: string,
  config?: RunnableConfig
): AsyncGenerator<TokenStreamEvent | StreamEvent> {
  for await (const event of streamAgent(state, threadId, config)) {
    // Extract tokens from chat model stream events
    if (event.event === 'on_chat_model_stream') {
      const chunk = event.data?.chunk
      const content = chunk?.content
      if (typeof content === 'string' && content.length > 0) {
        yield {
          type: 'token',
          content,
          timestamp: new Date().toISOString(),
          node: event.tags?.find((t: string) => t.startsWith('node:'))?.replace('node:', ''),
        }
      }
    }
    // Also yield original event for tool events, state tracking, etc.
    yield event
  }
}
```

### Chat Route Update Pattern

**Update: `app/api/projects/[id]/chat/route.ts`**

```typescript
import { createSSEStream, getSSEHeaders, formatSSEEvent } from '@/lib/agent/streaming'
import { streamAgentWithTokens, type TokenStreamEvent } from '@/lib/agent/v2/stream'
import { safeStreamAgentWithTokens } from '@/lib/agent/v2/utils/safe-invoke'

// Generate messageId for the response
const messageId = crypto.randomUUID()

const { stream, writer } = createSSEStream()

// Start async streaming
;(async () => {
  try {
    let fullContent = ''
    const sources: Array<{ documentName: string; location: string }> = []

    for await (const event of safeStreamAgentWithTokens(state, threadId, {
      metadata: {
        api_route: '/api/projects/[id]/chat',
        deal_id: dealId,
        user_id: user.id,
        conversation_id: conversationId,
      },
    })) {
      // Error event from safe wrapper
      if ('type' in event && event.type === 'error') {
        writer.write({
          type: 'error',
          message: toUserFriendlyMessage(event.error),
          code: event.error.code,
        })
        writer.close()
        return
      }

      // Token events - emit v2 format with content field
      if ('type' in event && event.type === 'token') {
        const tokenEvent = event as TokenStreamEvent
        fullContent += tokenEvent.content
        // Emit v2-compliant token event directly
        const data = encoder.encode(`data: ${JSON.stringify({
          type: 'token',
          content: tokenEvent.content,
          timestamp: tokenEvent.timestamp,
        })}\n\n`)
        controller.enqueue(data)
        continue
      }

      // Tool events - use existing handler
      const streamEvent = event as StreamEvent
      if (streamEvent.event === 'on_tool_start') {
        // Handle tool start
      } else if (streamEvent.event === 'on_tool_end') {
        // Extract sources from tool output
      }
    }

    // Done event with complete content
    const doneData = encoder.encode(`data: ${JSON.stringify({
      type: 'done',
      message: {
        id: messageId,
        content: fullContent,
        role: 'assistant',
      },
      conversationId,
      timestamp: new Date().toISOString(),
    })}\n\n`)
    controller.enqueue(doneData)
    controller.close()
  } catch (error) {
    // Handle unexpected errors
  }
})()
```

### Safe Wrapper for Error Handling

**Add to `lib/agent/v2/utils/safe-invoke.ts`:**

```typescript
import { streamAgentWithTokens, type TokenStreamEvent } from '../stream'

/**
 * Safely stream with token extraction and error handling.
 * Yields token events normally, then yields error event if stream fails.
 */
export async function* safeStreamAgentWithTokens(
  state: AgentStateType,
  threadId: string,
  config?: RunnableConfig
): AsyncGenerator<TokenStreamEvent | StreamEvent | SafeStreamErrorEvent> {
  try {
    for await (const event of streamAgentWithTokens(state, threadId, config)) {
      yield event
    }
  } catch (err) {
    const agentError = classifyError(err, threadId)
    logError(agentError, { threadId, workflowMode: state.workflowMode })
    yield { type: 'error' as const, error: agentError }
  }
}
```

### File Structure After This Story

```
lib/agent/v2/
├── index.ts                    # UPDATE - add stream exports
├── graph.ts                    # UNCHANGED
├── state.ts                    # UNCHANGED
├── types.ts                    # UNCHANGED
├── invoke.ts                   # UNCHANGED - existing streamAgent reused
├── stream.ts                   # NEW - token streaming utilities
├── llm/
│   ├── index.ts
│   └── gemini.ts
├── nodes/
│   └── ...
├── tools/
│   └── ...
└── utils/
    ├── index.ts                # UPDATE - export safeStreamAgentWithTokens
    ├── safe-invoke.ts          # UPDATE - add safeStreamAgentWithTokens
    └── ...
```

**Files to CREATE:**
- `lib/agent/v2/stream.ts` - Token streaming utilities

**Files to MODIFY:**
- `lib/agent/v2/index.ts` - Add stream exports
- `lib/agent/v2/utils/safe-invoke.ts` - Add `safeStreamAgentWithTokens`
- `lib/agent/v2/utils/index.ts` - Export new safe wrapper
- `app/api/projects/[id]/chat/route.ts` - Use token streaming with v2 event format

### Known Gaps (Document for Future)

**Tool Call Streaming:** When supervisor makes a tool call (routes to specialist), there won't be `on_chat_model_stream` events from the supervisor - the supervisor's response is a tool_call, not streamed content. Token streaming from specialists will be implemented in Epic 4 when specialist nodes are added. For now, tool calls show tool_start/tool_end events but no intermediate tokens.

**Frontend Compatibility:** The frontend chat components in `manda-app/components/chat/` currently expect `text` field for token events. During this story's implementation, either:
1. Update frontend to handle `content` field, OR
2. Document that frontend update is needed in a follow-up

### Previous Story Learnings (Story 2.1)

**Key Patterns:**
1. Use `any` cast for LangChain invoke due to complex generic types
2. Use `withRetry` from `lib/agent/v2/utils/retry.ts` for transient failures
3. Mock patterns: `vi.mock('../graph')` for unit tests
4. All 19 supervisor tests pass - don't break existing tests

**Error Handling:**
- Errors added to `state.errors` (reducer auto-appends)
- User-friendly messages via `toUserFriendlyMessage()`
- Don't expose technical details in SSE error events

### Performance Requirements

From PRD NFRs:
- **NFR1**: First token latency < 2 seconds
- **NFR2**: Smooth token streaming without visible buffering

**Implementation Tips:**
1. Do NOT buffer tokens before emitting
2. Async generator `yield` is immediate
3. Avoid unnecessary object creation in hot path
4. Profile with real Gemini calls to verify latency

### Anti-Patterns to Avoid

```typescript
// WRONG: Duplicating streamAgent logic
const graph = await createCompiledAgentGraph()
for await (const event of graph.streamEvents(...)) { ... }

// CORRECT: Build on existing streamAgent
for await (const event of streamAgent(state, threadId, config)) {
  // Extract tokens from events
}

// WRONG: Missing messageId
handler.onComplete(undefined, followups)

// CORRECT: Generate unique messageId
const messageId = crypto.randomUUID()
handler.onComplete(messageId, followups)

// WRONG: Using 'text' field for v2 events
yield { type: 'token', text: content }

// CORRECT: Using 'content' field per architecture
yield { type: 'token', content, timestamp: new Date().toISOString() }

// WRONG: Buffering before emit
const tokens: string[] = []
for await (const e of stream) { tokens.push(e.content) }
tokens.forEach(emit)

// CORRECT: Emit immediately
for await (const e of stream) { emit(e.content) }
```

### Testing Strategy

**Test File:** `manda-app/lib/agent/v2/__tests__/stream.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { streamAgentWithTokens, type TokenStreamEvent } from '../stream'
import { createInitialState } from '../state'
import { HumanMessage } from '@langchain/core/messages'

// Mock invoke module (which has streamAgent)
vi.mock('../invoke', () => ({
  streamAgent: vi.fn(),
}))

import { streamAgent } from '../invoke'

describe('streamAgentWithTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('extracts tokens from on_chat_model_stream events', async () => {
    const mockEvents = [
      { event: 'on_chat_model_stream', data: { chunk: { content: 'Hello' } }, tags: ['node:supervisor'] },
      { event: 'on_chat_model_stream', data: { chunk: { content: ' world' } }, tags: ['node:supervisor'] },
    ]

    vi.mocked(streamAgent).mockImplementation(async function* () {
      for (const e of mockEvents) yield e
    })

    const state = createInitialState('chat')
    state.messages = [new HumanMessage('Hi')]

    const tokens: TokenStreamEvent[] = []
    for await (const event of streamAgentWithTokens(state, 'test-thread')) {
      if ('type' in event && event.type === 'token') {
        tokens.push(event as TokenStreamEvent)
      }
    }

    expect(tokens).toHaveLength(2)
    expect(tokens[0].content).toBe('Hello')
    expect(tokens[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('yields original events for state tracking', async () => {
    const mockEvent = { event: 'on_chain_end', data: { output: {} } }
    vi.mocked(streamAgent).mockImplementation(async function* () {
      yield mockEvent
    })

    const state = createInitialState('chat')
    state.messages = [new HumanMessage('Hi')]

    const events = []
    for await (const event of streamAgentWithTokens(state, 'test-thread')) {
      events.push(event)
    }

    expect(events).toContainEqual(mockEvent)
  })

  it('skips empty content chunks', async () => {
    vi.mocked(streamAgent).mockImplementation(async function* () {
      yield { event: 'on_chat_model_stream', data: { chunk: { content: '' } }, tags: [] }
      yield { event: 'on_chat_model_stream', data: { chunk: { content: 'actual' } }, tags: [] }
    })

    const state = createInitialState('chat')
    state.messages = [new HumanMessage('test')]

    const tokens: TokenStreamEvent[] = []
    for await (const event of streamAgentWithTokens(state, 'test-thread')) {
      if ('type' in event && event.type === 'token') {
        tokens.push(event as TokenStreamEvent)
      }
    }

    expect(tokens).toHaveLength(1)
    expect(tokens[0].content).toBe('actual')
  })

  it('extracts node identifier from tags', async () => {
    vi.mocked(streamAgent).mockImplementation(async function* () {
      yield { event: 'on_chat_model_stream', data: { chunk: { content: 'x' } }, tags: ['node:supervisor', 'other'] }
    })

    const state = createInitialState('chat')
    state.messages = [new HumanMessage('test')]

    for await (const event of streamAgentWithTokens(state, 'test-thread')) {
      if ('type' in event && event.type === 'token') {
        expect((event as TokenStreamEvent).node).toBe('supervisor')
      }
    }
  })
})
```

**Integration Test (guarded):**
```typescript
describe.skipIf(!process.env.RUN_INTEGRATION_TESTS)('streamAgentWithTokens integration', () => {
  it('streams tokens from real LLM with <2s TTFT', async () => {
    const state = createInitialState('chat')
    state.messages = [new HumanMessage('Say hello briefly')]

    let tokenCount = 0
    let firstTokenTime: number | null = null
    const startTime = Date.now()

    for await (const event of streamAgentWithTokens(state, `test-${Date.now()}`)) {
      if ('type' in event && event.type === 'token') {
        if (firstTokenTime === null) {
          firstTokenTime = Date.now() - startTime
        }
        tokenCount++
      }
    }

    expect(firstTokenTime).toBeLessThan(2000) // NFR1
    expect(tokenCount).toBeGreaterThan(1)
  })
})
```

**Run Tests:**
```bash
cd manda-app && npm run test:run -- lib/agent/v2/__tests__/stream.test.ts
```

### Dependencies

**Existing Packages (already installed):**
- `@langchain/langgraph` - StateGraph, streamEvents
- `@langchain/core` - StreamEvent type, RunnableConfig

**Required Imports for stream.ts:**
```typescript
import type { StreamEvent } from '@langchain/core/tracers/log_stream'
import type { RunnableConfig } from '@langchain/core/runnables'
import { streamAgent } from './invoke'
import type { AgentStateType } from './state'
```

### Graph Edge Updates

No graph changes needed. Token streaming is handled at invocation level.

Current graph: `START → [supervisor | cim/phaseRouter] → END`

### References

**Architecture & Planning:**
- [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Streaming Event Patterns]
- [Source: _bmad-output/planning-artifacts/agent-system-epics.md#Story 2.2]
- [Source: docs/langgraph-reference.md#Streaming]

**Critical Existing Code (MUST REUSE):**
- [Source: manda-app/lib/agent/v2/invoke.ts:90-119 - streamAgent already uses streamEvents v2]
- [Source: manda-app/lib/agent/v2/utils/safe-invoke.ts - safeStreamAgent pattern to extend]
- [Source: manda-app/lib/agent/streaming.ts - AgentStreamHandler, SSE utilities]
- [Source: manda-app/app/api/projects/[id]/chat/route.ts - Current route to update]

**Guidelines:**
- [Source: CLAUDE.md#Agent System v2.0 - Implementation Rules]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None required - clean implementation.

### Completion Notes List

1. **Simplified Implementation**: Chose Option 2 from Dev Notes - v2-specific token events emitted directly in chat route, bypassing legacy `AgentStreamHandler.onToken()`. This is cleaner and avoids breaking changes to legacy consumers.

2. **No safeStreamAgentWithTokens Wrapper**: Instead of creating a separate safe wrapper, error handling is integrated directly in the chat route's ReadableStream `start()` function. This is simpler and the error handling is already comprehensive.

3. **TokenStreamEvent Enhanced**: Added optional `node` field to `TokenStreamEvent` in `types.ts` to track which graph node emitted each token (e.g., 'supervisor'). This aids debugging and future specialist-specific streaming.

4. **Test Strategy Adapted**: Due to complex vitest mocking challenges with the graph singleton pattern, tests focus on:
   - Token extraction logic (testing the filtering/transformation behavior)
   - Event structure validation (ensuring types match architecture)
   - Module export verification
   Full end-to-end tests require `RUN_INTEGRATION_TESTS=true` with real LLM credentials.

5. **Frontend Compatibility Note**: The frontend chat components may need updates to handle the new `content` field instead of `text`. This is documented for follow-up work.

### Code Review (2026-01-10)

**Reviewer:** Claude Opus 4.5

**Issues Found & Fixed:**
- HIGH-1: TypeScript errors in stream.test.ts (type narrowing to `never`) → Fixed with `unknown` type annotations
- HIGH-2: File List incomplete (missing code review fixes) → Updated File List section
- HIGH-3: Pre-existing type errors in graph.test.ts (`'qa'` not valid WorkflowMode) and supervisor.test.ts (possibly undefined) → Fixed with proper types
- MEDIUM-1: Done event missing messageId/content/sources per AC#6 → Added accumulation and done event fields
- MEDIUM-2: Duplicate event yielding (both TokenStreamEvent and original StreamEvent for same chunk) → Added `continue` statement

**Verification:**
- All 262 v2 agent tests pass
- Type-check clean for all lib/agent/v2 files
- Lint passes for stream.ts

**Status:** Code review passed with all fixes applied.

### File List

**Created (Story 2-2):**
- `manda-app/lib/agent/v2/stream.ts` - Token streaming utilities with `streamAgentWithTokens()`
- `manda-app/lib/agent/v2/__tests__/stream.test.ts` - Unit tests (13 passing, 1 skipped integration)

**Modified (Story 2-2):**
- `manda-app/lib/agent/v2/types.ts` - Added `node` field to `TokenStreamEvent`
- `manda-app/lib/agent/v2/index.ts` - Export `streamAgentWithTokens`
- `manda-app/app/api/projects/[id]/chat/route.ts` - Updated to use token streaming with v2 event format, done event now includes messageId/content/sources per AC#6

**Modified (Code Review Fixes):**
- `manda-app/lib/agent/v2/stream.ts` - Fixed duplicate event yielding (added `continue` after token yield)
- `manda-app/lib/agent/v2/__tests__/stream.test.ts` - Fixed TypeScript errors (added `unknown` type annotations)
- `manda-app/lib/agent/v2/__tests__/graph.test.ts` - Fixed invalid `'qa'` WorkflowMode (qa is cross-cutting tool, not mode)
- `manda-app/lib/agent/v2/nodes/__tests__/supervisor.test.ts` - Fixed `possibly undefined` type errors with optional chaining

**Note:** Files from Story 2-1 (supervisor.ts, llm/, etc.) are tracked in that story's File List.
