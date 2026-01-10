/**
 * Agent System v2.0 - Error Utilities Tests
 *
 * Story: 1-6 Implement Basic Error Recovery (AC: #1)
 *
 * Tests for error factory, detection, and logging utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  createAgentError,
  isRecoverableError,
  toUserFriendlyMessage,
  isLLMError,
  isAuthError,
  isToolError,
  logError,
} from '../errors'
import { AgentErrorCode } from '../../types'

describe('errors utilities', () => {
  describe('createAgentError', () => {
    it('creates an error with required fields', () => {
      const error = createAgentError(
        AgentErrorCode.LLM_ERROR,
        'LLM call failed'
      )

      expect(error.code).toBe(AgentErrorCode.LLM_ERROR)
      expect(error.message).toBe('LLM call failed')
      expect(error.timestamp).toBeDefined()
      expect(new Date(error.timestamp).toISOString()).toBe(error.timestamp)
    })

    it('sets recoverable based on error code when not provided', () => {
      // LLM_ERROR defaults to recoverable
      const llmError = createAgentError(
        AgentErrorCode.LLM_ERROR,
        'Rate limited'
      )
      expect(llmError.recoverable).toBe(true)

      // STATE_ERROR defaults to not recoverable
      const stateError = createAgentError(
        AgentErrorCode.STATE_ERROR,
        'Invalid state'
      )
      expect(stateError.recoverable).toBe(false)

      // CACHE_ERROR defaults to recoverable
      const cacheError = createAgentError(
        AgentErrorCode.CACHE_ERROR,
        'Redis unavailable'
      )
      expect(cacheError.recoverable).toBe(true)

      // CONTEXT_ERROR defaults to recoverable
      const contextError = createAgentError(
        AgentErrorCode.CONTEXT_ERROR,
        'Context load failed'
      )
      expect(contextError.recoverable).toBe(true)
    })

    it('allows overriding recoverable flag', () => {
      const error = createAgentError(
        AgentErrorCode.LLM_ERROR,
        'Auth failed',
        { recoverable: false }
      )
      expect(error.recoverable).toBe(false)
    })

    it('includes optional details and nodeId', () => {
      const error = createAgentError(
        AgentErrorCode.TOOL_ERROR,
        'Graphiti query failed',
        {
          details: { query: 'SELECT * FROM facts', errorCode: 'NEO4J_DOWN' },
          nodeId: 'retrieval',
        }
      )

      expect(error.details).toEqual({
        query: 'SELECT * FROM facts',
        errorCode: 'NEO4J_DOWN',
      })
      expect(error.nodeId).toBe('retrieval')
    })
  })

  describe('isRecoverableError', () => {
    it('returns true for recoverable errors', () => {
      const error = createAgentError(
        AgentErrorCode.LLM_ERROR,
        'Timeout',
        { recoverable: true }
      )
      expect(isRecoverableError(error)).toBe(true)
    })

    it('returns false for non-recoverable errors', () => {
      const error = createAgentError(
        AgentErrorCode.STATE_ERROR,
        'Corruption',
        { recoverable: false }
      )
      expect(isRecoverableError(error)).toBe(false)
    })
  })

  describe('toUserFriendlyMessage', () => {
    it('maps LLM_ERROR to friendly message', () => {
      const error = createAgentError(AgentErrorCode.LLM_ERROR, 'Technical')
      expect(toUserFriendlyMessage(error)).toBe(
        "I'm having trouble thinking. Let me try again."
      )
    })

    it('maps TOOL_ERROR to friendly message', () => {
      const error = createAgentError(AgentErrorCode.TOOL_ERROR, 'Technical')
      expect(toUserFriendlyMessage(error)).toBe(
        "I couldn't access that information."
      )
    })

    it('maps STATE_ERROR to friendly message', () => {
      const error = createAgentError(AgentErrorCode.STATE_ERROR, 'Technical')
      expect(toUserFriendlyMessage(error)).toBe(
        'Something went wrong. Please refresh.'
      )
    })

    it('maps CONTEXT_ERROR to friendly message', () => {
      const error = createAgentError(AgentErrorCode.CONTEXT_ERROR, 'Technical')
      expect(toUserFriendlyMessage(error)).toBe(
        "I couldn't load the deal context."
      )
    })

    it('maps APPROVAL_REJECTED to friendly message', () => {
      const error = createAgentError(
        AgentErrorCode.APPROVAL_REJECTED,
        'Technical'
      )
      expect(toUserFriendlyMessage(error)).toBe(
        "Got it, I won't proceed with that."
      )
    })

    it('maps STREAMING_ERROR to friendly message', () => {
      const error = createAgentError(
        AgentErrorCode.STREAMING_ERROR,
        'Technical'
      )
      expect(toUserFriendlyMessage(error)).toBe(
        'Connection interrupted. Please try again.'
      )
    })

    it('uses error message for CACHE_ERROR (silent)', () => {
      const error = createAgentError(
        AgentErrorCode.CACHE_ERROR,
        'Redis connection failed'
      )
      expect(toUserFriendlyMessage(error)).toBe('Redis connection failed')
    })
  })

  describe('isLLMError', () => {
    it('returns false for non-Error values', () => {
      expect(isLLMError(null)).toBe(false)
      expect(isLLMError(undefined)).toBe(false)
      expect(isLLMError('error string')).toBe(false)
      expect(isLLMError({ message: 'error object' })).toBe(false)
    })

    it('detects rate limit errors', () => {
      expect(isLLMError(new Error('Rate limit exceeded'))).toBe(true)
      expect(isLLMError(new Error('HTTP 429 Too Many Requests'))).toBe(true)
    })

    it('detects timeout errors', () => {
      const timeoutError = new Error('Request timeout')
      expect(isLLMError(timeoutError)).toBe(true)

      const etimedout = new Error('ETIMEDOUT')
      expect(isLLMError(etimedout)).toBe(true)

      const abortError = new Error('aborted')
      abortError.name = 'AbortError'
      expect(isLLMError(abortError)).toBe(true)
    })

    it('detects model overload errors', () => {
      expect(isLLMError(new Error('Model overloaded'))).toBe(true)
      expect(isLLMError(new Error('HTTP 503 Service Unavailable'))).toBe(true)
    })

    it('detects auth errors', () => {
      expect(isLLMError(new Error('Unauthorized'))).toBe(true)
      expect(isLLMError(new Error('HTTP 401'))).toBe(true)
    })

    it('detects LangChain provider errors', () => {
      expect(isLLMError(new Error('Anthropic API error'))).toBe(true)
      expect(isLLMError(new Error('Vertex AI request failed'))).toBe(true)
      expect(isLLMError(new Error('OpenAI error occurred'))).toBe(true)
    })

    it('returns false for non-LLM errors', () => {
      expect(isLLMError(new Error('File not found'))).toBe(false)
      expect(isLLMError(new Error('Database connection failed'))).toBe(false)
      expect(isLLMError(new Error('Validation error'))).toBe(false)
    })
  })

  describe('isAuthError', () => {
    it('returns false for non-Error values', () => {
      expect(isAuthError(null)).toBe(false)
      expect(isAuthError(undefined)).toBe(false)
      expect(isAuthError('error string')).toBe(false)
      expect(isAuthError({ message: 'error object' })).toBe(false)
    })

    it('detects 401 unauthorized errors', () => {
      expect(isAuthError(new Error('Unauthorized'))).toBe(true)
      expect(isAuthError(new Error('HTTP 401'))).toBe(true)
      expect(isAuthError(new Error('401 Unauthorized'))).toBe(true)
    })

    it('detects 403 forbidden errors', () => {
      expect(isAuthError(new Error('Forbidden'))).toBe(true)
      expect(isAuthError(new Error('HTTP 403'))).toBe(true)
      expect(isAuthError(new Error('403 Forbidden'))).toBe(true)
    })

    it('detects invalid API key errors', () => {
      expect(isAuthError(new Error('Invalid API key'))).toBe(true)
      expect(isAuthError(new Error('invalid api key provided'))).toBe(true)
    })

    it('detects authentication failed errors', () => {
      expect(isAuthError(new Error('Authentication failed'))).toBe(true)
      expect(isAuthError(new Error('authentication failed for user'))).toBe(true)
    })

    it('returns false for non-auth errors', () => {
      expect(isAuthError(new Error('Rate limit exceeded'))).toBe(false)
      expect(isAuthError(new Error('Timeout'))).toBe(false)
      expect(isAuthError(new Error('Model overloaded'))).toBe(false)
    })

    it('is a subset of LLM errors', () => {
      // Auth errors should also be detected as LLM errors
      const authError = new Error('HTTP 401 Unauthorized')
      expect(isAuthError(authError)).toBe(true)
      expect(isLLMError(authError)).toBe(true)
    })
  })

  describe('isToolError', () => {
    it('returns false for non-Error values', () => {
      expect(isToolError(null)).toBe(false)
      expect(isToolError(undefined)).toBe(false)
      expect(isToolError('error string')).toBe(false)
    })

    it('detects tool-related errors', () => {
      expect(isToolError(new Error('Tool execution failed'))).toBe(true)
      expect(isToolError(new Error('Specialist not found'))).toBe(true)
      expect(isToolError(new Error('Graphiti query error'))).toBe(true)
    })

    it('returns false for non-tool errors', () => {
      expect(isToolError(new Error('Rate limit exceeded'))).toBe(false)
      expect(isToolError(new Error('File not found'))).toBe(false)
    })
  })

  describe('logError', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      consoleErrorSpy.mockRestore()
    })

    it('logs error with context to console.error', () => {
      const error = createAgentError(
        AgentErrorCode.LLM_ERROR,
        'Timeout',
        { nodeId: 'supervisor' }
      )

      logError(error, {
        threadId: 'chat:deal123:user456:conv789',
        workflowMode: 'chat',
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[AgentError]',
        expect.objectContaining({
          code: AgentErrorCode.LLM_ERROR,
          message: 'Timeout',
          nodeId: 'supervisor',
          recoverable: true,
          threadId: 'chat:deal123:user456:conv789',
          workflowMode: 'chat',
        })
      )
    })

    it('includes timestamp in log output', () => {
      const error = createAgentError(AgentErrorCode.STATE_ERROR, 'Invalid')

      logError(error, { threadId: 'test-thread' })

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[AgentError]',
        expect.objectContaining({
          timestamp: expect.any(String),
        })
      )
    })
  })
})
