# Story 1.4: Implement Thread ID Generation and Management

Status: done

## Story

As a **user**,
I want **each conversation to have a unique thread**,
So that **my conversations are isolated per deal and don't interfere with each other**.

## Acceptance Criteria

1. **New Thread ID Generation**: Given a user starts a new conversation in a deal, when the chat API is called without a `conversationId`, then:
   - A new thread ID is generated following pattern: `{workflowMode}:{dealId}:{userId}:{conversationId}`
   - The `conversationId` is returned to the client for future requests
   - Thread ID uses `:` delimiter (not `-`) to support UUIDs with hyphens

2. **Thread Resumption**: Given a user continues an existing conversation, when the chat API is called with a `conversationId`, then:
   - The existing thread is resumed from checkpoint
   - Previous messages are loaded from state (via PostgresSaver)
   - User sees their conversation history intact

3. **Thread Isolation (FR5)**: Given thread isolation requirements, when any graph operation occurs, then:
   - Data is scoped to the deal's `project_id`
   - Cross-deal access is prevented
   - Different users in the same deal have separate chat threads
   - CIM threads are shared within deal (collaborative mode)

## Tasks / Subtasks

- [x] Task 1: Create conversation ID generation utility (AC: #1)
  - [x] Create `lib/agent/v2/utils/conversation.ts`
  - [x] Implement `generateConversationId()` returning UUID v4
  - [x] Export from `lib/agent/v2/utils/index.ts` barrel
  - [x] Update `lib/agent/v2/index.ts` to export new utility

- [x] Task 2: Create chat-v2 API route (AC: #1, #2, #3)
  - [x] Create `app/api/projects/[id]/chat-v2/route.ts`
  - [x] Import from `@/lib/agent/v2` (createV2ThreadId, invokeAgent, createInitialState)
  - [x] Implement POST handler with body: `{ message: string, conversationId?: string, workflowMode?: WorkflowMode }`
  - [x] Generate new conversationId if not provided
  - [x] Build thread ID using `createV2ThreadId(workflowMode, dealId, userId, conversationId)`
  - [x] Return `conversationId` in response for client to store
  - [x] Add auth middleware protection (use existing `createClient()` from `lib/supabase/server.ts`)

- [x] Task 3: Implement thread resumption logic (AC: #2)
  - [x] In chat-v2 route, detect if `conversationId` is provided
  - [x] If provided, use existing conversationId to resume thread
  - [x] Load state via `invokeAgent()` with same thread ID
  - [x] Verify messages accumulate via messagesStateReducer

- [x] Task 4: Implement request validation (AC: #1)
  - [x] Validate `message` field is present and non-empty
  - [x] Validate `workflowMode` is valid if provided
  - [x] Return 400 with clear error message for invalid input
  - [x] Add Zod schema for request body validation

- [x] Task 5: Implement deal-scoped isolation (AC: #3)
  - [x] Extract `dealId` from route params `[id]`
  - [x] Verify deal exists in Supabase using authenticated client
  - [x] Return 404 if deal not found
  - [x] Extract `userId` from Supabase auth session
  - [x] Include `project_id` in state for RLS enforcement

- [x] Task 6: Add response schema and SSE streaming (AC: #1, #2)
  - [x] Define response type with `conversationId`, streaming events
  - [x] Use existing `streamAgent()` for real-time response
  - [x] Convert LangGraph stream events to SSE format
  - [x] Return proper `text/event-stream` content type

- [x] Task 7: Write unit tests (AC: #1)
  - [x] Create `app/api/projects/[id]/chat-v2/__tests__/route.test.ts`
  - [x] Test: new conversation generates conversationId
  - [x] Test: existing conversationId is reused
  - [x] Test: thread ID format matches pattern
  - [x] Test: validation errors return 400
  - [x] Mock Supabase client and PostgresSaver

- [x] Task 8: Write integration tests (AC: #2, #3)
  - [x] Create `app/api/projects/[id]/chat-v2/__tests__/route.integration.test.ts`
  - [x] Test: conversation persists across multiple requests
  - [x] Test: different conversations are isolated
  - [x] Test: auth required (401 without session)
  - [x] Guard with `describe.skipIf(!process.env.RUN_INTEGRATION_TESTS)`

## Dev Notes

### Architecture Context

This story creates the **chat API entry point for v2**. It connects:
- Frontend chat UI (existing) → new v2 API route
- v2 API route → `invokeAgent()` / `streamAgent()` → StateGraph + PostgresSaver

The v2 API runs in **parallel** with the existing `/api/projects/[id]/chat/route.ts`. This follows the 4-phase migration strategy from the architecture doc.

### Thread ID Pattern (CRITICAL)

**Format changed in Story 1.3 from `-` to `:` delimiter to support UUIDs:**
```typescript
// Pattern: {workflowMode}:{dealId}:{userId}:{conversationId}
'chat:550e8400-e29b-41d4-a716-446655440000:user-123:conv-456'

// CIM (deal-scoped, no userId): cim:{dealId}:{cimId}
'cim:550e8400-e29b-41d4-a716-446655440000:cim-001'
```

Use the `createV2ThreadId()` function from Story 1.3 - do NOT manually construct thread IDs.

### Existing Thread Utilities (from Story 1.3)

```typescript
import {
  createV2ThreadId,    // Generate thread ID
  parseV2ThreadId,     // Parse components from thread ID
  type ParsedThreadId  // { workflowMode, dealId, userId, conversationId }
} from '@/lib/agent/v2'
```

### Conversation ID Generation

Generate UUIDs for new conversations:
```typescript
import { randomUUID } from 'crypto'

export function generateConversationId(): string {
  return randomUUID()
}
```

### Chat-v2 API Route Implementation

```typescript
// app/api/projects/[id]/chat-v2/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createV2ThreadId,
  invokeAgent,
  streamAgent,
  createInitialState,
  type WorkflowMode
} from '@/lib/agent/v2'
import { HumanMessage } from '@langchain/core/messages'
import { generateConversationId } from '@/lib/agent/v2/utils/conversation'

interface ChatRequestBody {
  message: string
  conversationId?: string
  workflowMode?: WorkflowMode
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const dealId = params.id

  // Auth check
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify deal exists and user has access
  const { data: deal, error: dealError } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', dealId)
    .single()

  if (dealError || !deal) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
  }

  // Parse request body
  const body: ChatRequestBody = await request.json()
  const { message, conversationId: providedConversationId, workflowMode = 'chat' } = body

  // Generate or use provided conversationId
  const conversationId = providedConversationId || generateConversationId()

  // Build thread ID
  const threadId = createV2ThreadId(workflowMode, dealId, user.id, conversationId)

  // Create initial state with user message
  const state = createInitialState(workflowMode, dealId, user.id)
  state.messages = [new HumanMessage(message)]

  // Stream response
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of streamAgent(state, threadId)) {
          // Convert to SSE format
          const sseData = JSON.stringify({
            ...event,
            conversationId, // Include for client tracking
          })
          controller.enqueue(encoder.encode(`data: ${sseData}\n\n`))
        }
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Conversation-Id': conversationId, // Also in header for easy access
    },
  })
}
```

### Previous Story Intelligence (Story 1.3)

**Key Learnings from Story 1.3:**
- Thread ID delimiter changed from `-` to `:` to support UUIDs with hyphens
- Use singleton graph factory `createCompiledAgentGraph()` - don't compile on every request
- Include `thread_id` in both `configurable` and `metadata` for LangSmith visibility
- `messagesStateReducer` appends messages - don't need to manually concat
- Use `MemorySaver` mock for unit tests, real PostgreSQL for integration tests

**Breaking Change Note:**
Story 1.3 changed thread ID format. The API route in this story will use the NEW format (`:` delimiter). Any existing threads with old format will NOT be compatible.

### Supabase Auth Pattern

```typescript
import { createClient } from '@/lib/supabase/server'

// In API route
const supabase = await createClient()
const { data: { user }, error } = await supabase.auth.getUser()
```

### RLS Enforcement

The Supabase query with `.eq('id', dealId)` automatically enforces RLS policies. If user doesn't have access to the deal, the query returns null.

### Error Handling

| Error | HTTP Status | Response |
|-------|-------------|----------|
| No auth session | 401 | `{ error: 'Unauthorized' }` |
| Deal not found | 404 | `{ error: 'Deal not found' }` |
| Missing message | 400 | `{ error: 'Message is required' }` |
| Graph error | 500 | `{ error: 'Internal server error' }` |

### File Structure After This Story

```
manda-app/
├── app/api/projects/[id]/
│   ├── chat/route.ts                    # Existing v1 (keep)
│   └── chat-v2/                         # NEW v2 API
│       ├── route.ts
│       └── __tests__/
│           ├── route.test.ts
│           └── route.integration.test.ts
└── lib/agent/v2/
    ├── utils/
    │   ├── index.ts                     # Updated barrel
    │   ├── thread.ts                    # From Story 1.3
    │   └── conversation.ts              # NEW - UUID generation
    └── ... (from previous stories)
```

### Dependencies

**Story Dependencies:**
- Story 1.1: AgentState, createInitialState
- Story 1.2: agentGraph, routeByWorkflowMode
- Story 1.3: createV2ThreadId, invokeAgent, streamAgent

**Package Dependencies (already installed):**
- `@langchain/langgraph`: ^1.0.7
- `@langchain/core`: ^1.1.0
- `@supabase/supabase-js`: existing

### Testing Strategy

**Unit Tests (mock everything external):**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      })
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'test-deal-id', name: 'Test Deal' },
            error: null
          })
        })
      })
    })
  })
}))

// Mock invokeAgent/streamAgent
vi.mock('@/lib/agent/v2', async () => {
  const actual = await vi.importActual('@/lib/agent/v2')
  return {
    ...actual,
    streamAgent: vi.fn().mockImplementation(async function* () {
      yield { event: 'on_chat_model_stream', data: { chunk: 'Hello' } }
    })
  }
})
```

**Integration Tests (real components):**
```typescript
describe.skipIf(!process.env.RUN_INTEGRATION_TESTS)('chat-v2 integration', () => {
  // Uses real Supabase, MemorySaver, etc.
})
```

### Anti-Patterns to Avoid

```typescript
// WRONG: Manually constructing thread ID
const threadId = `chat-${dealId}-${userId}-${conversationId}`

// CORRECT: Use utility function
const threadId = createV2ThreadId('chat', dealId, userId, conversationId)

// WRONG: Compiling graph on every request
const graph = graphBuilder.compile({ checkpointer })

// CORRECT: Use cached compiled graph via invokeAgent/streamAgent
const result = await invokeAgent(state, threadId)

// WRONG: Not returning conversationId to client
return NextResponse.json({ response })

// CORRECT: Include conversationId for client storage
return new Response(stream, {
  headers: { 'X-Conversation-Id': conversationId }
})

// WRONG: Manually building message array
state.messages = [...existingMessages, newMessage]

// CORRECT: messagesStateReducer handles appending
state.messages = [new HumanMessage(message)]  // Just the new message
```

### LangSmith Tracing

The `invokeAgent` and `streamAgent` functions already include checkpoint metadata for LangSmith. Additional metadata can be passed via config:

```typescript
await invokeAgent(state, threadId, {
  metadata: {
    api_route: '/api/projects/[id]/chat-v2',
    request_id: crypto.randomUUID(),
  }
})
```

### References

- [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Thread Management]
- [Source: _bmad-output/planning-artifacts/agent-system-epics.md#Story 1.4]
- [Source: _bmad-output/planning-artifacts/agent-system-prd.md#FR5-FR6]
- [Source: manda-app/lib/agent/v2/utils/thread.ts - createV2ThreadId, parseV2ThreadId]
- [Source: manda-app/lib/agent/v2/invoke.ts - invokeAgent, streamAgent]
- [Source: CLAUDE.md#Agent System v2.0 - Implementation Rules]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

No issues encountered during implementation.

### Completion Notes List

- Implemented `generateConversationId()` utility using Node.js crypto.randomUUID()
- Added `isValidConversationId()` helper for UUID validation
- Created chat-v2 API route with full Zod request validation
- Thread ID follows pattern `{workflowMode}:{dealId}:{userId}:{conversationId}` using `:` delimiter
- SSE streaming with proper headers (`Content-Type: text/event-stream`)
- Returns `X-Conversation-Id` header for client to persist
- Returns `X-Thread-Id` header for debugging
- Authentication via Supabase `createClient()` + `auth.getUser()`
- Deal access verified via RLS-enforced Supabase query
- 22 unit tests passing, 7 integration tests (skipped without RUN_INTEGRATION_TESTS)

### Change Log

- 2026-01-10: Implemented Story 1.4 - Thread ID Generation and Management

### File List

- [x] manda-app/lib/agent/v2/utils/conversation.ts (new - generateConversationId, isValidConversationId)
- [x] manda-app/lib/agent/v2/utils/index.ts (modified - export conversation utils)
- [x] manda-app/lib/agent/v2/index.ts (modified - export from utils)
- [x] manda-app/app/api/projects/[id]/chat-v2/route.ts (new - v2 API route)
- [x] manda-app/app/api/projects/[id]/chat-v2/__tests__/route.test.ts (new - unit tests)
- [x] manda-app/app/api/projects/[id]/chat-v2/__tests__/route.integration.test.ts (new - integration tests)
- [x] manda-app/lib/agent/v2/utils/__tests__/conversation.test.ts (new - conversation utility tests, added by code review)

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5 | **Date:** 2026-01-10

### Review Outcome: APPROVED WITH FIXES APPLIED

### Issues Found & Fixed

| ID | Severity | Issue | Resolution |
|----|----------|-------|------------|
| H1 | ~~HIGH~~ → N/A | Table name mismatch (deals vs projects) | VERIFIED CORRECT - `deals` is the right table. Dev Notes example was wrong. |
| H2 | HIGH | Redundant UUID validation (Zod + isValidConversationId) | FIXED - Removed redundant `isValidConversationId()` check in route |
| M1 | MEDIUM | Missing unit tests for `isValidConversationId()` | FIXED - Added comprehensive test file `conversation.test.ts` |
| M2 | MEDIUM | No test for non-v4 UUID edge cases | FIXED - Included in new conversation.test.ts |
| M3 | MEDIUM | No rate limiting on chat API | DEFERRED - Documented as future requirement (see below) |
| M4 | MEDIUM | Message length error not helpful | FIXED - Error now shows "exceeds maximum length of 10,000 characters" |

### Deferred Items (Future Stories)

**Rate Limiting Requirement (M3):** The chat-v2 API has no rate limiting. A malicious user could spam requests to exhaust LLM tokens or DoS the streaming endpoint. This should be addressed in a future security hardening story with:
- Per-user request rate limits
- Per-deal concurrent request limits
- Token budget tracking

### Tests After Review

- **42 unit tests** passing (22 route + 20 conversation utility)
- **7 integration tests** ready (skipped without RUN_INTEGRATION_TESTS)

### Files Modified by Review

- `manda-app/app/api/projects/[id]/chat-v2/route.ts` - Removed redundant validation, improved error message
- `manda-app/lib/agent/v2/utils/__tests__/conversation.test.ts` - NEW: comprehensive utility tests
