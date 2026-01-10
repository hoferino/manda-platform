# Story 1.6: Implement Basic Error Recovery

Status: completed

## Story

As a **user**,
I want **the system to recover from interruptions**,
So that **I don't lose my conversation if something goes wrong**.

## Acceptance Criteria

1. **Error Logging with Context (FR55)**: Given a conversation in progress, when an unexpected error occurs (API timeout, network issue), then:
   - The error is logged with full context (thread ID, user ID, deal ID, node that failed)
   - Error uses `AgentError` structure from `types.ts` with appropriate `AgentErrorCode`
   - Conversation state is NOT corrupted (PostgresSaver checkpoint remains valid)
   - User receives a clear, user-friendly error message (not technical stack trace)

2. **Checkpoint Resumption (FR54)**: Given the system was interrupted mid-response, when the user sends a new message, then:
   - The graph resumes from the last successful checkpoint
   - Previous messages are still available in state
   - The conversation continues normally
   - No duplicate messages or lost context

3. **Graceful Degradation (NFR14)**: Given a specialist or tool failure, when processing continues:
   - The error is captured in `state.errors` array
   - The supervisor can continue with reduced capability
   - User is informed what couldn't be completed and why

4. **API Route Error Handling**: Given the chat-v2 API route, when any error occurs:
   - Streaming errors send proper error SSE event before closing
   - Non-streaming errors return appropriate HTTP status codes
   - Error responses follow consistent JSON structure

## Tasks / Subtasks

- [x] Task 1: Create error utilities (AC: #1)
  - [x] Create `lib/agent/v2/utils/errors.ts`
  - [x] Implement `createAgentError(code, message, options?)` factory
  - [x] Implement `isRecoverableError(error: AgentError)` helper
  - [x] Implement `toUserFriendlyMessage(error: AgentError)` mapping
  - [x] Implement `isLLMError(err)` - detects rate limits, timeouts, model overload
  - [x] Implement `isToolError(err)` - detects specialist/tool failures
  - [x] Implement `logError(error, context)` - structured logging
  - [x] Export from `lib/agent/v2/utils/index.ts` barrel
  - [x] Create `lib/agent/v2/utils/__tests__/errors.test.ts` with unit tests (25 tests)

- [x] Task 2: Implement try-catch wrapper for graph invocation (AC: #1, #2)
  - [x] Create `lib/agent/v2/utils/safe-invoke.ts`
  - [x] Implement `safeInvokeAgent(state, threadId, config?)` - returns `{ result, error }` tuple
  - [x] Implement `safeStreamAgent(state, threadId, config?)` - yields events + error event on failure
  - [x] Implement `classifyError(err, threadId)` - categorizes unknown errors
  - [x] Export all from barrel
  - [x] Create `lib/agent/v2/utils/__tests__/safe-invoke.test.ts` with unit tests (18 tests)

- [x] Task 3: Add error state handling in graph nodes (AC: #1, #3)
  - [x] Modify `nodes/supervisor.ts` to catch LLM errors
  - [x] Added `classifyAndLogError` helper for node-level error handling
  - [x] Pattern ready for Story 2.1 (LLM implementation)
  - [x] Unit tests for supervisor error handling (9 tests)

- [x] Task 4: Implement checkpoint resumption verification (AC: #2)
  - [x] Added integration tests to `invoke.integration.test.ts`
  - [x] Test: resumes from checkpoint after simulated error
  - [x] Test: preserves state even with errors in error array
  - [x] Test: messagesStateReducer correctly handles resume
  - [x] Test: does not corrupt state on partial execution

- [x] Task 5: Update chat-v2 route with error handling (AC: #4)
  - [x] Updated to use `safeStreamAgent` instead of `streamAgent`
  - [x] On error during streaming: yields structured error SSE event
  - [x] Error response includes code and user-friendly message
  - [x] Conversation state preserved in checkpoint for resume

- [x] Task 6: Add retry logic for transient failures (AC: #1)
  - [x] Create `lib/agent/v2/utils/retry.ts`
  - [x] Implement `withRetry<T>(fn, options)` with exponential backoff
  - [x] Default: 3 retries, 1s base delay, 30s max delay, 20% jitter
  - [x] Implement `calculateDelay` with jitter
  - [x] Export from barrel
  - [x] Create `lib/agent/v2/utils/__tests__/retry.test.ts` with unit tests (10 tests)

- [x] Task 7: Run full test suite and verify (AC: #1, #2, #3, #4)
  - [x] All 211 unit tests pass (10 integration tests skipped without flag)
  - [x] All 10 integration tests pass with RUN_INTEGRATION_TESTS=true
  - [x] Error recovery integration tests added to existing invoke.integration.test.ts

## Dev Notes

### Architecture Context

Story 1.6 adds the **error recovery layer** to the v2 agent system. This is critical for production reliability - users must never lose their conversation due to transient failures.

**Error Flow:**
```
User Message → API Route → [try: Graph Execution] → Response
                              ↓ (on error)
                    Catch → Log → Classify → User Message
                              ↓
                    State NOT corrupted (checkpoint intact)
```

### Error Types and Handling Strategy

Per the architecture document, use these error codes:

| Error Code | User Message | Retry? | Action |
|------------|--------------|--------|--------|
| `LLM_ERROR` | "I'm having trouble thinking. Let me try again." | Yes (3x) | Retry with backoff, then fallback |
| `TOOL_ERROR` | "I couldn't access that information." | Partial | Continue without tool result |
| `STATE_ERROR` | "Something went wrong. Please refresh." | No | Log, halt, don't retry |
| `CONTEXT_ERROR` | "I couldn't load the deal context." | Yes (1x) | Block operation if still fails |
| `APPROVAL_REJECTED` | "Got it, I won't proceed with that." | No | Continue conversation |
| `CACHE_ERROR` | (silent) | N/A | Proceed without cache |
| `STREAMING_ERROR` | "Connection interrupted. Please try again." | No | Close stream gracefully |

### Error Utilities Implementation

```typescript
// lib/agent/v2/utils/errors.ts
import { AgentError, AgentErrorCode } from '../types'

/**
 * Create a structured AgentError with required fields.
 */
export function createAgentError(
  code: AgentErrorCode,
  message: string,
  options?: {
    details?: unknown
    recoverable?: boolean
    nodeId?: string
  }
): AgentError {
  return {
    code,
    message,
    details: options?.details,
    recoverable: options?.recoverable ?? isDefaultRecoverable(code),
    timestamp: new Date().toISOString(),
    nodeId: options?.nodeId,
  }
}

function isDefaultRecoverable(code: AgentErrorCode): boolean {
  return code === AgentErrorCode.LLM_ERROR ||
         code === AgentErrorCode.CACHE_ERROR ||
         code === AgentErrorCode.CONTEXT_ERROR
}

export function isRecoverableError(error: AgentError): boolean {
  return error.recoverable
}

/**
 * Map error code to user-friendly message.
 */
export function toUserFriendlyMessage(error: AgentError): string {
  const messages: Record<AgentErrorCode, string> = {
    [AgentErrorCode.LLM_ERROR]: "I'm having trouble thinking. Let me try again.",
    [AgentErrorCode.TOOL_ERROR]: "I couldn't access that information.",
    [AgentErrorCode.STATE_ERROR]: "Something went wrong. Please refresh.",
    [AgentErrorCode.CONTEXT_ERROR]: "I couldn't load the deal context.",
    [AgentErrorCode.APPROVAL_REJECTED]: "Got it, I won't proceed with that.",
    [AgentErrorCode.STREAMING_ERROR]: "Connection interrupted. Please try again.",
    [AgentErrorCode.CACHE_ERROR]: error.message, // Cache errors are usually silent
  }
  return messages[error.code] || "An unexpected error occurred."
}

/**
 * Detect LLM-specific errors from Vertex AI / LangChain.
 * Checks for rate limits, timeouts, model overload, and auth errors.
 */
export function isLLMError(err: unknown): boolean {
  if (!(err instanceof Error)) return false

  const message = err.message.toLowerCase()
  const name = err.name.toLowerCase()

  // Rate limit (429)
  if (message.includes('rate limit') || message.includes('429')) return true

  // Timeout errors
  if (name === 'aborterror' || message.includes('timeout') || message.includes('etimedout')) return true

  // Model overload (503)
  if (message.includes('overloaded') || message.includes('503')) return true

  // Invalid API key (401) - still an LLM error, but not retryable
  if (message.includes('unauthorized') || message.includes('401')) return true

  // LangChain-specific error patterns
  if (message.includes('anthropic') || message.includes('vertex') || message.includes('openai')) {
    if (message.includes('error') || message.includes('failed')) return true
  }

  return false
}

/**
 * Detect tool/specialist errors.
 */
export function isToolError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const message = err.message.toLowerCase()
  return message.includes('tool') || message.includes('specialist') || message.includes('graphiti')
}

/**
 * Log error with full context for debugging.
 * Uses console.error for local dev; LangSmith for production tracing.
 */
export function logError(error: AgentError, context: Record<string, unknown>): void {
  // Always log to console for local debugging
  console.error('[AgentError]', {
    code: error.code,
    message: error.message,
    nodeId: error.nodeId,
    recoverable: error.recoverable,
    timestamp: error.timestamp,
    ...context,
  })

  // LangSmith tracing happens automatically via graph metadata
  // Custom events can be added via tracer if needed
}
```

### Safe Invoke Pattern

```typescript
// lib/agent/v2/utils/safe-invoke.ts
import type { RunnableConfig } from '@langchain/core/runnables'
import type { StreamEvent } from '@langchain/core/tracers/log_stream'

import { invokeAgent, streamAgent } from '../invoke'
import {
  createAgentError,
  isLLMError,
  isToolError,
  logError,
} from './errors'
import type { AgentStateType } from '../state'
import type { AgentError } from '../types'
import { AgentErrorCode } from '../types'

interface SafeInvokeResult {
  result: AgentStateType | null
  error: AgentError | null
}

/**
 * Safely invoke the agent graph with error handling.
 * Returns { result, error } tuple - never throws.
 */
export async function safeInvokeAgent(
  state: AgentStateType,
  threadId: string,
  config?: RunnableConfig
): Promise<SafeInvokeResult> {
  try {
    const result = await invokeAgent(state, threadId, config)
    return { result, error: null }
  } catch (err) {
    const agentError = classifyError(err, threadId)
    logError(agentError, { threadId, workflowMode: state.workflowMode })
    return { result: null, error: agentError }
  }
}

/**
 * Safely stream agent graph execution with error handling.
 * Yields events normally, then yields error event if stream fails.
 */
export async function* safeStreamAgent(
  state: AgentStateType,
  threadId: string,
  config?: RunnableConfig
): AsyncGenerator<StreamEvent | { type: 'error'; error: AgentError }> {
  try {
    for await (const event of streamAgent(state, threadId, config)) {
      yield event
    }
  } catch (err) {
    const agentError = classifyError(err, threadId)
    logError(agentError, { threadId, workflowMode: state.workflowMode })
    yield { type: 'error' as const, error: agentError }
  }
}

/**
 * Classify unknown errors into AgentError with appropriate code.
 */
function classifyError(err: unknown, threadId: string): AgentError {
  // LLM errors (rate limit, timeout, model overload)
  if (isLLMError(err)) {
    return createAgentError(AgentErrorCode.LLM_ERROR, 'LLM call failed', {
      details: { originalError: String(err), threadId },
      recoverable: true,
    })
  }

  // Tool/specialist errors
  if (isToolError(err)) {
    return createAgentError(AgentErrorCode.TOOL_ERROR, 'Tool execution failed', {
      details: { originalError: String(err), threadId },
      recoverable: false, // Continue without tool result
    })
  }

  // Default to STATE_ERROR for unknown errors
  return createAgentError(AgentErrorCode.STATE_ERROR, 'Unexpected error', {
    details: { originalError: String(err), threadId },
    recoverable: false,
  })
}

// Re-export classifyError for use in API routes
export { classifyError }
```

### Previous Story Intelligence (Story 1.4)

**Key Learnings from Story 1.4:**
- Use Zod for request validation - provides clear error messages
- Return `X-Conversation-Id` header for client tracking
- SSE stream needs proper error event format before closing
- Integration tests should be guarded with `describe.skipIf(!process.env.RUN_INTEGRATION_TESTS)`
- Mock Supabase client pattern established

**Breaking Change Note:**
Story 1.4 created the chat-v2 route. This story enhances it with proper error handling. The error response format must be consistent with the SSE event types defined in `types.ts`.

### Git Patterns from Recent Commits

From commit `58c0cfd` (PostgreSQL checkpointing):
- Checkpointer already handles state persistence
- Use `getCheckpointMetadata()` for consistent LangSmith tagging

From commit `2b1c25f` (Redis caching):
- Redis cache failures should be silent (CACHE_ERROR)
- Fall back to source data if cache unavailable

### Retry Implementation

```typescript
// lib/agent/v2/utils/retry.ts
interface RetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  retryableCodes?: AgentErrorCode[]
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 8000,
  retryableCodes: [AgentErrorCode.LLM_ERROR, AgentErrorCode.CACHE_ERROR],
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err as Error

      if (attempt === opts.maxRetries) break

      // Exponential backoff: 1s, 2s, 4s...
      const delay = Math.min(
        opts.baseDelayMs * Math.pow(2, attempt),
        opts.maxDelayMs
      )
      await sleep(delay)
    }
  }

  throw lastError
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

### Chat-v2 Route Error Handling Update

```typescript
// app/api/projects/[id]/chat-v2/route.ts (modification)

// In the stream processing:
const stream = new ReadableStream({
  async start(controller) {
    try {
      for await (const event of streamAgent(state, threadId)) {
        const sseData = JSON.stringify({
          ...transformEvent(event),
          conversationId,
        })
        controller.enqueue(encoder.encode(`data: ${sseData}\n\n`))
      }
      controller.close()
    } catch (error) {
      // Send error event before closing stream
      const agentError = classifyError(error, threadId)
      const errorEvent = JSON.stringify({
        type: 'error',
        error: {
          code: agentError.code,
          message: toUserFriendlyMessage(agentError),
        },
        conversationId,
        timestamp: new Date().toISOString(),
      })
      controller.enqueue(encoder.encode(`data: ${errorEvent}\n\n`))
      controller.close()
    }
  }
})
```

### File Structure After This Story

```
manda-app/lib/agent/v2/
├── utils/
│   ├── index.ts                  # Updated barrel - export all error utils
│   ├── thread.ts                 # From Story 1.3
│   ├── conversation.ts           # From Story 1.4
│   ├── errors.ts                 # NEW - error factories + detection
│   ├── safe-invoke.ts            # NEW - safe invoke wrappers
│   ├── retry.ts                  # NEW - retry logic
│   └── __tests__/
│       ├── conversation.test.ts  # Existing from Story 1.4
│       ├── errors.test.ts        # NEW - error utility tests
│       ├── safe-invoke.test.ts   # NEW - safe invoke tests
│       └── retry.test.ts         # NEW - retry logic tests
├── __tests__/
│   ├── graph.test.ts             # Existing
│   ├── state.test.ts             # Existing
│   └── invoke.integration.test.ts # Updated - added error recovery tests
├── nodes/
│   └── supervisor.ts             # Modified - error handling
└── ... (unchanged from previous stories)
```

### Testing Strategy

**Unit Tests:**
- Test `createAgentError` factory produces correct structure
- Test `toUserFriendlyMessage` maps all codes correctly
- Test `withRetry` retries on retryable codes, fails fast on non-retryable
- Test `safeInvokeAgent` catches and classifies errors
- Mock LLM to simulate various error conditions

**Integration Tests (guarded):**
```typescript
describe.skipIf(!process.env.RUN_INTEGRATION_TESTS)('error recovery', () => {
  it('resumes from checkpoint after simulated crash', async () => {
    // 1. Start conversation, send message
    // 2. Get checkpoint ID
    // 3. Simulate error (e.g., throw in mock)
    // 4. Send follow-up message
    // 5. Verify previous message still in state
    // 6. Verify new message appended correctly
  })
})
```

### Dependencies

**Story Dependencies:**
- Story 1.1: AgentStateType, createInitialState
- Story 1.2: agentGraph, routeByWorkflowMode
- Story 1.3: createV2ThreadId, invokeAgent, streamAgent
- Story 1.4: chat-v2 API route, conversation utilities

**Package Dependencies (already installed):**
- `@langchain/langgraph`: ^1.0.7
- `@langchain/core`: ^1.1.0
- `vitest`: existing test framework

### State Reducer Behavior (Critical)

The `errors` field in AgentState uses an **accumulating reducer** that concats arrays:
```typescript
errors: Annotation<AgentError[]>({
  reducer: (prev, next) => [...prev, ...next],  // CONCAT, not replace!
  default: () => [],
})
```

**When returning errors from a node:**
```typescript
// CORRECT: Return array with single error - reducer will append
return { errors: [agentError] }

// WRONG: Manually spreading existing errors (reducer does this)
return { errors: [...state.errors, agentError] }  // Results in duplicates!
```

### Anti-Patterns to Avoid

```typescript
// WRONG: Exposing technical error details to user
return NextResponse.json({ error: err.stack }, { status: 500 })

// CORRECT: User-friendly message, log details internally
logError(agentError, { threadId, userId })
return NextResponse.json({ error: toUserFriendlyMessage(agentError) }, { status: 500 })

// WRONG: Corrupting state on error - adding error as message
state.messages = [...state.messages, errorMessage]  // Don't pollute message history!

// CORRECT: Return error in errors array - reducer handles append
return { errors: [agentError] }

// WRONG: Manually managing errors array (reducer does concat)
state.errors = [...(state.errors || []), agentError]  // Don't mutate directly!

// CORRECT: Return partial state, let reducer handle
return { errors: [agentError] }

// WRONG: Swallowing errors silently
try { await riskyOperation() } catch { /* do nothing */ }

// CORRECT: Log and handle appropriately
try {
  await riskyOperation()
} catch (err) {
  const agentError = classifyError(err, threadId)
  if (agentError.code !== AgentErrorCode.CACHE_ERROR) {
    logError(agentError, { threadId })
  }
  return { errors: [agentError] }
}

// WRONG: Retrying non-retryable errors
await withRetry(() => someStateMutatingOperation())  // STATE_ERROR shouldn't retry!

// CORRECT: Only retry idempotent operations
if (isRecoverableError(error)) {
  await withRetry(() => llmCall())
}
```

### References

- [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Error Handling Patterns]
- [Source: _bmad-output/planning-artifacts/agent-system-epics.md#Story 1.6]
- [Source: _bmad-output/planning-artifacts/agent-system-prd.md#FR52-FR55]
- [Source: manda-app/lib/agent/v2/types.ts - AgentError, AgentErrorCode]
- [Source: manda-app/lib/agent/v2/invoke.ts - invokeAgent, streamAgent]
- [Source: manda-app/app/api/projects/[id]/chat-v2/route.ts - existing route]
- [Source: CLAUDE.md#Agent System v2.0 - Implementation Rules]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

1. **Error Utilities** - Implemented comprehensive error factory, detection, and logging in [errors.ts](manda-app/lib/agent/v2/utils/errors.ts). All 7 AgentErrorCode types have user-friendly messages. isLLMError detects rate limits, timeouts, model overload, and provider errors.

2. **Safe Invoke Wrappers** - Created [safe-invoke.ts](manda-app/lib/agent/v2/utils/safe-invoke.ts) with `safeInvokeAgent` and `safeStreamAgent` that never throw. Errors are classified and returned/yielded as structured events.

3. **Node Error Handling** - Updated [supervisor.ts](manda-app/lib/agent/v2/nodes/supervisor.ts) with `classifyAndLogError` helper. Full try-catch implementation deferred to Story 2.1 when LLM calls are added.

4. **Checkpoint Resumption** - Added 4 integration tests verifying state persists across errors. The PostgresSaver checkpointer correctly preserves conversation state when errors occur.

5. **Chat-v2 Route** - Updated [route.ts](manda-app/app/api/projects/[id]/chat-v2/route.ts) to use `safeStreamAgent`. Errors during streaming yield structured SSE events with user-friendly messages instead of crashing.

6. **Retry Logic** - Implemented [retry.ts](manda-app/lib/agent/v2/utils/retry.ts) with exponential backoff (1s base, 30s max, 20% jitter). Default is 3 retries for LLM errors only.

7. **Test Coverage** - 62 new unit tests added (25 errors, 18 safe-invoke, 10 retry, 9 supervisor). All 211 tests pass.

### File List

**New Files:**
- [manda-app/lib/agent/v2/utils/errors.ts](manda-app/lib/agent/v2/utils/errors.ts)
- [manda-app/lib/agent/v2/utils/safe-invoke.ts](manda-app/lib/agent/v2/utils/safe-invoke.ts)
- [manda-app/lib/agent/v2/utils/retry.ts](manda-app/lib/agent/v2/utils/retry.ts)
- [manda-app/lib/agent/v2/utils/__tests__/errors.test.ts](manda-app/lib/agent/v2/utils/__tests__/errors.test.ts)
- [manda-app/lib/agent/v2/utils/__tests__/safe-invoke.test.ts](manda-app/lib/agent/v2/utils/__tests__/safe-invoke.test.ts)
- [manda-app/lib/agent/v2/utils/__tests__/retry.test.ts](manda-app/lib/agent/v2/utils/__tests__/retry.test.ts)
- [manda-app/lib/agent/v2/nodes/__tests__/supervisor.test.ts](manda-app/lib/agent/v2/nodes/__tests__/supervisor.test.ts)

**Modified Files:**
- [manda-app/lib/agent/v2/utils/index.ts](manda-app/lib/agent/v2/utils/index.ts) - Added error/retry exports
- [manda-app/lib/agent/v2/index.ts](manda-app/lib/agent/v2/index.ts) - Added error/retry to barrel
- [manda-app/lib/agent/v2/nodes/supervisor.ts](manda-app/lib/agent/v2/nodes/supervisor.ts) - Added error handling pattern
- [manda-app/lib/agent/v2/__tests__/invoke.integration.test.ts](manda-app/lib/agent/v2/__tests__/invoke.integration.test.ts) - Added checkpoint resumption tests
- [manda-app/app/api/projects/[id]/chat-v2/route.ts](manda-app/app/api/projects/[id]/chat-v2/route.ts) - Use safeStreamAgent
