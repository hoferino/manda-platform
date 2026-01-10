/**
 * Agent System v2.0 - Safe Invoke Utilities Tests
 *
 * Story: 1-6 Implement Basic Error Recovery (AC: #1, #2)
 *
 * Tests for safe invoke wrappers that catch and classify errors.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  safeInvokeAgent,
  safeStreamAgent,
  classifyError,
} from '../safe-invoke'
import { AgentErrorCode } from '../../types'
import { createInitialState } from '../../state'

// Mock the invoke module
vi.mock('../../invoke', () => ({
  invokeAgent: vi.fn(),
  streamAgent: vi.fn(),
}))

// Mock the errors module (but keep createAgentError real)
vi.mock('../errors', async () => {
  const actual = await vi.importActual<typeof import('../errors')>('../errors')
  return {
    ...actual,
    logError: vi.fn(),
  }
})

import { invokeAgent, streamAgent } from '../../invoke'
import { logError } from '../errors'

describe('safe-invoke utilities', () => {
  const mockThreadId = 'chat:deal123:user456:conv789'
  const mockState = createInitialState('chat', 'deal123', 'user456')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('safeInvokeAgent', () => {
    it('returns result on success', async () => {
      const expectedResult = { ...mockState, tokenCount: 100 }
      vi.mocked(invokeAgent).mockResolvedValue(expectedResult)

      const { result, error } = await safeInvokeAgent(mockState, mockThreadId)

      expect(result).toEqual(expectedResult)
      expect(error).toBeNull()
      expect(invokeAgent).toHaveBeenCalledWith(mockState, mockThreadId, undefined)
    })

    it('passes config to invokeAgent', async () => {
      const config = { metadata: { test: true } }
      vi.mocked(invokeAgent).mockResolvedValue(mockState)

      await safeInvokeAgent(mockState, mockThreadId, config)

      expect(invokeAgent).toHaveBeenCalledWith(mockState, mockThreadId, config)
    })

    it('returns error on LLM failure', async () => {
      const llmError = new Error('Rate limit exceeded')
      vi.mocked(invokeAgent).mockRejectedValue(llmError)

      const { result, error } = await safeInvokeAgent(mockState, mockThreadId)

      expect(result).toBeNull()
      expect(error).not.toBeNull()
      expect(error?.code).toBe(AgentErrorCode.LLM_ERROR)
      expect(error?.recoverable).toBe(true)
      expect(logError).toHaveBeenCalled()
    })

    it('returns error on tool failure', async () => {
      const toolError = new Error('Tool execution failed')
      vi.mocked(invokeAgent).mockRejectedValue(toolError)

      const { result, error } = await safeInvokeAgent(mockState, mockThreadId)

      expect(result).toBeNull()
      expect(error).not.toBeNull()
      expect(error?.code).toBe(AgentErrorCode.TOOL_ERROR)
      expect(error?.recoverable).toBe(false)
    })

    it('returns STATE_ERROR for unknown errors', async () => {
      const unknownError = new Error('Something unexpected')
      vi.mocked(invokeAgent).mockRejectedValue(unknownError)

      const { result, error } = await safeInvokeAgent(mockState, mockThreadId)

      expect(result).toBeNull()
      expect(error?.code).toBe(AgentErrorCode.STATE_ERROR)
      expect(error?.recoverable).toBe(false)
    })

    it('logs error with context', async () => {
      vi.mocked(invokeAgent).mockRejectedValue(new Error('Timeout'))

      await safeInvokeAgent(mockState, mockThreadId)

      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({ code: AgentErrorCode.LLM_ERROR }),
        expect.objectContaining({
          threadId: mockThreadId,
          workflowMode: 'chat',
        })
      )
    })
  })

  describe('safeStreamAgent', () => {
    it('yields events on success', async () => {
      const mockEvents = [
        { event: 'on_chat_model_stream', data: { chunk: 'Hello' } },
        { event: 'on_chat_model_stream', data: { chunk: ' world' } },
      ]

      vi.mocked(streamAgent).mockImplementation(async function* () {
        for (const event of mockEvents) {
          yield event as any
        }
      })

      const events: unknown[] = []
      for await (const event of safeStreamAgent(mockState, mockThreadId)) {
        events.push(event)
      }

      expect(events).toHaveLength(2)
      expect(events[0]).toEqual(mockEvents[0])
      expect(events[1]).toEqual(mockEvents[1])
    })

    it('yields error event on failure', async () => {
      const mockEvents = [
        { event: 'on_chat_model_stream', data: { chunk: 'Hello' } },
      ]

      vi.mocked(streamAgent).mockImplementation(async function* () {
        yield mockEvents[0] as any
        throw new Error('Rate limit exceeded')
      })

      const events: unknown[] = []
      for await (const event of safeStreamAgent(mockState, mockThreadId)) {
        events.push(event)
      }

      expect(events).toHaveLength(2)
      expect(events[0]).toEqual(mockEvents[0])
      expect((events[1] as any).type).toBe('error')
      expect((events[1] as any).error.code).toBe(AgentErrorCode.LLM_ERROR)
    })

    it('logs error when stream fails', async () => {
      vi.mocked(streamAgent).mockImplementation(async function* () {
        throw new Error('Timeout')
      })

      const events: unknown[] = []
      for await (const event of safeStreamAgent(mockState, mockThreadId)) {
        events.push(event)
      }

      expect(logError).toHaveBeenCalled()
    })

    it('passes config to streamAgent', async () => {
      const config = { metadata: { test: true } }
      vi.mocked(streamAgent).mockImplementation(async function* () {
        // Empty stream
      })

      for await (const _ of safeStreamAgent(mockState, mockThreadId, config)) {
        // Consume stream
      }

      expect(streamAgent).toHaveBeenCalledWith(mockState, mockThreadId, config)
    })
  })

  describe('classifyError', () => {
    it('classifies rate limit as LLM_ERROR', () => {
      const error = classifyError(new Error('Rate limit exceeded'), mockThreadId)

      expect(error.code).toBe(AgentErrorCode.LLM_ERROR)
      expect(error.recoverable).toBe(true)
      expect(error.details).toEqual(expect.objectContaining({ threadId: mockThreadId }))
    })

    it('classifies timeout as LLM_ERROR', () => {
      const error = classifyError(new Error('Request timeout'), mockThreadId)

      expect(error.code).toBe(AgentErrorCode.LLM_ERROR)
      expect(error.recoverable).toBe(true)
    })

    it('classifies tool errors as TOOL_ERROR', () => {
      const error = classifyError(new Error('Tool execution failed'), mockThreadId)

      expect(error.code).toBe(AgentErrorCode.TOOL_ERROR)
      expect(error.recoverable).toBe(false)
    })

    it('classifies specialist errors as TOOL_ERROR', () => {
      const error = classifyError(new Error('Specialist not available'), mockThreadId)

      expect(error.code).toBe(AgentErrorCode.TOOL_ERROR)
    })

    it('classifies graphiti errors as TOOL_ERROR', () => {
      const error = classifyError(new Error('Graphiti query failed'), mockThreadId)

      expect(error.code).toBe(AgentErrorCode.TOOL_ERROR)
    })

    it('classifies unknown errors as STATE_ERROR', () => {
      const error = classifyError(new Error('Something random'), mockThreadId)

      expect(error.code).toBe(AgentErrorCode.STATE_ERROR)
      expect(error.recoverable).toBe(false)
    })

    it('classifies 401 auth errors as non-recoverable LLM_ERROR', () => {
      const error = classifyError(new Error('HTTP 401 Unauthorized'), mockThreadId)

      expect(error.code).toBe(AgentErrorCode.LLM_ERROR)
      expect(error.recoverable).toBe(false) // Auth errors should NOT be retried
      expect(error.message).toBe('Authentication failed')
    })

    it('classifies 403 forbidden errors as non-recoverable LLM_ERROR', () => {
      const error = classifyError(new Error('HTTP 403 Forbidden'), mockThreadId)

      expect(error.code).toBe(AgentErrorCode.LLM_ERROR)
      expect(error.recoverable).toBe(false)
    })

    it('classifies invalid API key errors as non-recoverable', () => {
      const error = classifyError(new Error('Invalid API key'), mockThreadId)

      expect(error.code).toBe(AgentErrorCode.LLM_ERROR)
      expect(error.recoverable).toBe(false)
    })

    it('handles non-Error values', () => {
      const error = classifyError('string error', mockThreadId)

      expect(error.code).toBe(AgentErrorCode.STATE_ERROR)
      expect(error.details).toEqual(expect.objectContaining({
        originalError: 'string error',
      }))
    })

    it('includes threadId in error details', () => {
      const error = classifyError(new Error('Test'), 'test-thread-id')

      expect(error.details).toEqual(expect.objectContaining({
        threadId: 'test-thread-id',
      }))
    })
  })
})
