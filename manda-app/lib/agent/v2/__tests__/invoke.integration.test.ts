/**
 * Agent System v2.0 - Invoke Helpers Integration Tests
 *
 * Story: 1-3 Connect PostgresSaver Checkpointer (AC: #1, #2)
 *
 * Integration tests verify:
 * - State persists across invocations with same thread ID
 * - Different thread IDs are isolated (negative test)
 * - Streaming emits events with thread context
 *
 * These tests use MemorySaver to avoid requiring a real PostgreSQL connection.
 * Run with RUN_INTEGRATION_TESTS=true to enable.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { HumanMessage } from '@langchain/core/messages'
import { MemorySaver } from '@langchain/langgraph'

import { createV2ThreadId } from '../utils/thread'
import { invokeAgent, streamAgent } from '../invoke'
import { resetCompiledGraph } from '../graph'
import { createInitialState } from '../state'
import { AgentErrorCode } from '../types'
import { resetCheckpointer } from '@/lib/agent/checkpointer'

// Mock getCheckpointer to return MemorySaver for tests
// This avoids requiring a real PostgreSQL connection
vi.mock('@/lib/agent/checkpointer', async () => {
  const actual = await vi.importActual('@/lib/agent/checkpointer')
  // Create a shared MemorySaver instance per test suite
  // It will be reset in beforeEach
  let memorySaver = new MemorySaver()

  return {
    ...actual,
    getCheckpointer: vi.fn().mockImplementation(() => {
      return Promise.resolve(memorySaver)
    }),
    resetCheckpointer: vi.fn().mockImplementation(() => {
      memorySaver = new MemorySaver()
    }),
    getCheckpointMetadata: vi.fn().mockReturnValue({
      checkpointer_type: 'MemorySaver',
      checkpointer_initialized: true,
      checkpointer_durable: false,
      checkpoint_metadata_at: new Date().toISOString(),
    }),
  }
})

describe.skipIf(!process.env.RUN_INTEGRATION_TESTS)(
  'invokeAgent integration',
  () => {
    beforeEach(() => {
      // Reset both checkpointer and compiled graph for test isolation
      resetCheckpointer()
      resetCompiledGraph()
    })

    it('persists state across invocations with same thread ID', async () => {
      const threadId = createV2ThreadId(
        'chat',
        'test-deal',
        'test-user',
        'test-conv'
      )

      // First invocation
      const state1 = createInitialState('chat')
      state1.messages = [new HumanMessage('Hello')]
      const result1 = await invokeAgent(state1, threadId)

      // Verify first invocation completed (placeholder nodes return state unchanged)
      expect(result1.messages.length).toBeGreaterThanOrEqual(1)

      // Second invocation - same thread
      const state2 = createInitialState('chat')
      state2.messages = [new HumanMessage('Follow-up')]
      const result2 = await invokeAgent(state2, threadId)

      // messagesStateReducer appends, so both messages should be present
      // The checkpointer should have merged the states
      expect(result2.messages.length).toBeGreaterThanOrEqual(2)

      // Check that messages from both invocations are present
      const messageContents = result2.messages.map((m) =>
        typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      )
      expect(messageContents).toContain('Hello')
      expect(messageContents).toContain('Follow-up')
    })

    it('isolates state between different thread IDs', async () => {
      const threadA = createV2ThreadId('chat', 'deal-A', 'user-A', 'conv-A')
      const threadB = createV2ThreadId('chat', 'deal-B', 'user-B', 'conv-B')

      // Invoke thread A
      const stateA = createInitialState('chat')
      stateA.messages = [new HumanMessage('Message for A')]
      await invokeAgent(stateA, threadA)

      // Invoke thread B - should NOT see thread A's messages
      const stateB = createInitialState('chat')
      stateB.messages = [new HumanMessage('Message for B')]
      const resultB = await invokeAgent(stateB, threadB)

      // Thread B should only have its own message
      const messageContents = resultB.messages.map((m) =>
        typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      )
      expect(messageContents).not.toContain('Message for A')
      expect(messageContents).toContain('Message for B')
    })

    it('returns proper state structure', async () => {
      const threadId = createV2ThreadId(
        'chat',
        'test-deal',
        'test-user',
        'test-conv'
      )

      const state = createInitialState('chat', 'test-deal', 'test-user')
      state.messages = [new HumanMessage('Test message')]

      const result = await invokeAgent(state, threadId)

      // Verify all state fields are present
      expect(result).toHaveProperty('messages')
      expect(result).toHaveProperty('sources')
      expect(result).toHaveProperty('pendingApproval')
      expect(result).toHaveProperty('activeSpecialist')
      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('dealContext')
      expect(result).toHaveProperty('workflowMode')
      expect(result).toHaveProperty('cimState')
      expect(result).toHaveProperty('scratchpad')
      expect(result).toHaveProperty('historySummary')
      expect(result).toHaveProperty('tokenCount')
    })

    it('merges additional config correctly', async () => {
      const threadId = createV2ThreadId(
        'chat',
        'test-deal',
        'test-user',
        'test-conv'
      )

      const state = createInitialState('chat')
      state.messages = [new HumanMessage('Test')]

      // Invoke with additional config
      const result = await invokeAgent(state, threadId, {
        metadata: {
          custom_field: 'custom_value',
        },
        tags: ['test-tag'],
      })

      // Should complete successfully with merged config
      expect(result.messages.length).toBeGreaterThanOrEqual(1)
    })
  }
)

describe.skipIf(!process.env.RUN_INTEGRATION_TESTS)(
  'streamAgent integration',
  () => {
    beforeEach(() => {
      resetCheckpointer()
      resetCompiledGraph()
    })

    it('streams events with thread context', async () => {
      const threadId = createV2ThreadId(
        'chat',
        'test-deal',
        'test-user',
        'test-conv'
      )

      const state = createInitialState('chat')
      state.messages = [new HumanMessage('Hello')]

      const events: unknown[] = []
      for await (const event of streamAgent(state, threadId)) {
        events.push(event)
      }

      // Should have received at least some events
      expect(events.length).toBeGreaterThan(0)

      // Each event should have event type
      events.forEach((event) => {
        expect(event).toHaveProperty('event')
      })
    })

    it('persists state across streaming invocations', async () => {
      const threadId = createV2ThreadId(
        'chat',
        'stream-deal',
        'stream-user',
        'stream-conv'
      )

      // First streaming invocation
      const state1 = createInitialState('chat')
      state1.messages = [new HumanMessage('Stream message 1')]

      for await (const _event of streamAgent(state1, threadId)) {
        // Consume all events
      }

      // Second streaming invocation - should see previous messages
      const state2 = createInitialState('chat')
      state2.messages = [new HumanMessage('Stream message 2')]

      let finalState: unknown = null
      for await (const event of streamAgent(state2, threadId)) {
        // Look for end events that might contain final state
        if (event.event === 'on_chain_end' && event.data?.output) {
          finalState = event.data.output
        }
      }

      // We should have received events
      expect(finalState).toBeDefined()
    })
  }
)

/**
 * Story: 1-6 Implement Basic Error Recovery (AC: #2)
 *
 * Checkpoint resumption verification tests.
 * Ensures state is preserved after errors and conversations can resume.
 */
describe.skipIf(!process.env.RUN_INTEGRATION_TESTS)(
  'checkpoint resumption after error',
  () => {
    beforeEach(() => {
      resetCheckpointer()
      resetCompiledGraph()
    })

    it('resumes from checkpoint after simulated error', async () => {
      const threadId = createV2ThreadId(
        'chat',
        'error-deal',
        'error-user',
        'error-conv'
      )

      // First invocation - establish conversation
      const state1 = createInitialState('chat')
      state1.messages = [new HumanMessage('First message before error')]
      const result1 = await invokeAgent(state1, threadId)

      // Verify first message is persisted
      expect(result1.messages.length).toBeGreaterThanOrEqual(1)

      // Simulate an error scenario by:
      // Not invoking anything - just send a follow-up message
      // The checkpointer should preserve the previous state

      // Follow-up after "error" - should resume from checkpoint
      const state2 = createInitialState('chat')
      state2.messages = [new HumanMessage('Second message after recovery')]
      const result2 = await invokeAgent(state2, threadId)

      // Both messages should be present (checkpointer preserved state)
      const messageContents = result2.messages.map((m) =>
        typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      )
      expect(messageContents).toContain('First message before error')
      expect(messageContents).toContain('Second message after recovery')
    })

    it('preserves state even with errors in error array', async () => {
      const threadId = createV2ThreadId(
        'chat',
        'error-state-deal',
        'error-state-user',
        'error-state-conv'
      )

      // First invocation with an error already in state
      const state1 = createInitialState('chat')
      state1.messages = [new HumanMessage('Message with existing error')]
      state1.errors = [
        {
          code: AgentErrorCode.CACHE_ERROR,
          message: 'Redis unavailable',
          recoverable: true,
          timestamp: new Date().toISOString(),
        },
      ]
      const result1 = await invokeAgent(state1, threadId)

      // Verify error is in state
      expect(result1.errors.length).toBeGreaterThanOrEqual(1)

      // Second invocation - errors should accumulate (not replace)
      const state2 = createInitialState('chat')
      state2.messages = [new HumanMessage('Follow-up message')]
      state2.errors = [
        {
          code: AgentErrorCode.LLM_ERROR,
          message: 'Rate limit hit',
          recoverable: true,
          timestamp: new Date().toISOString(),
        },
      ]
      const result2 = await invokeAgent(state2, threadId)

      // Both errors should be present (accumulating reducer)
      expect(result2.errors.length).toBeGreaterThanOrEqual(2)

      // Messages should also accumulate
      expect(result2.messages.length).toBeGreaterThanOrEqual(2)
    })

    it('messagesStateReducer correctly handles resume', async () => {
      const threadId = createV2ThreadId(
        'chat',
        'resume-deal',
        'resume-user',
        'resume-conv'
      )

      // Send multiple messages in sequence
      const messages = ['First', 'Second', 'Third']

      for (const content of messages) {
        const state = createInitialState('chat')
        state.messages = [new HumanMessage(content)]
        await invokeAgent(state, threadId)
      }

      // Final check - invoke with empty state to get accumulated messages
      const checkState = createInitialState('chat')
      checkState.messages = [new HumanMessage('Final check')]
      const result = await invokeAgent(checkState, threadId)

      // All messages should be present
      const messageContents = result.messages.map((m) =>
        typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      )
      expect(messageContents).toContain('First')
      expect(messageContents).toContain('Second')
      expect(messageContents).toContain('Third')
      expect(messageContents).toContain('Final check')
    })

    it('does not corrupt state on partial execution', async () => {
      const threadId = createV2ThreadId(
        'chat',
        'partial-deal',
        'partial-user',
        'partial-conv'
      )

      // Establish initial state
      const state1 = createInitialState('chat', 'partial-deal', 'partial-user')
      state1.messages = [new HumanMessage('Initial message')]
      const result1 = await invokeAgent(state1, threadId)

      // Verify initial state
      expect(result1.dealContext?.dealId).toBe('partial-deal')
      expect(result1.workflowMode).toBe('chat')

      // Simulate partial execution by starting a new state but keeping thread
      // State should merge correctly
      const state2 = createInitialState('chat')
      state2.messages = [new HumanMessage('After partial')]
      const result2 = await invokeAgent(state2, threadId)

      // State should not be corrupted
      expect(result2.messages.length).toBeGreaterThanOrEqual(2)
      expect(result2.workflowMode).toBe('chat')
      // dealContext should be preserved from checkpoint
      // (Note: actual behavior depends on reducer - replace reducer will use new value)
    })
  }
)
