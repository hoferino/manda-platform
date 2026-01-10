/**
 * Agent System v2.0 - Supervisor Node Tests
 *
 * Story: 1-6 Implement Basic Error Recovery (AC: #1, #3)
 *
 * Tests for supervisor node error handling capabilities.
 * Note: Full LLM routing tests will be in Story 2.1.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

import { supervisorNode, classifyAndLogError, isRecoverableError } from '../supervisor'
import { createInitialState } from '../../state'
import { AgentErrorCode } from '../../types'
import { logError } from '../../utils/errors'

// Mock the logError utility
vi.mock('../../utils/errors', async () => {
  const actual = await vi.importActual<typeof import('../../utils/errors')>('../../utils/errors')
  return {
    ...actual,
    logError: vi.fn(),
  }
})

describe('supervisorNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('placeholder behavior', () => {
    it('returns empty partial state (placeholder)', async () => {
      const state = createInitialState('chat', 'deal123', 'user456')

      const result = await supervisorNode(state)

      // Placeholder returns empty object - no state changes
      expect(result).toEqual({})
    })

    it('does not add errors in normal operation', async () => {
      const state = createInitialState('chat', 'deal123', 'user456')

      const result = await supervisorNode(state)

      // No errors field means no errors added
      expect(result.errors).toBeUndefined()
    })
  })

  describe('error handling structure', () => {
    it('accepts state with existing errors', async () => {
      const existingError = {
        code: AgentErrorCode.CACHE_ERROR,
        message: 'Redis unavailable',
        recoverable: true,
        timestamp: new Date().toISOString(),
      }
      const state = {
        ...createInitialState('chat', 'deal123', 'user456'),
        errors: [existingError],
      }

      // Should not throw
      const result = await supervisorNode(state)
      expect(result).toBeDefined()
    })

    it('preserves state workflow mode', async () => {
      const chatState = createInitialState('chat')
      const cimState = createInitialState('cim')
      const irlState = createInitialState('irl')

      await supervisorNode(chatState)
      await supervisorNode(cimState)
      await supervisorNode(irlState)

      // Should handle all workflow modes without error
      expect(chatState.workflowMode).toBe('chat')
      expect(cimState.workflowMode).toBe('cim')
      expect(irlState.workflowMode).toBe('irl')
    })
  })

  describe('classifyAndLogError', () => {
    it('classifies LLM errors as LLM_ERROR', () => {
      const state = createInitialState('chat', 'deal123', 'user456')
      const llmError = new Error('Rate limit exceeded')

      const result = classifyAndLogError(llmError, state)

      expect(result.code).toBe(AgentErrorCode.LLM_ERROR)
      expect(result.recoverable).toBe(true)
      expect(result.nodeId).toBe('supervisor')
    })

    it('classifies unknown errors as STATE_ERROR', () => {
      const state = createInitialState('chat', 'deal123', 'user456')
      const unknownError = new Error('Something unexpected')

      const result = classifyAndLogError(unknownError, state)

      expect(result.code).toBe(AgentErrorCode.STATE_ERROR)
      expect(result.recoverable).toBe(false)
    })

    it('logs error with context', () => {
      const state = createInitialState('chat', 'deal123', 'user456')
      state.messages = [{ content: 'Hello' } as any]

      classifyAndLogError(new Error('Test'), state)

      expect(logError).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          nodeId: 'supervisor',
          workflowMode: 'chat',
          dealId: 'deal123',
          messageCount: 1,
        })
      )
    })

    it('includes original error in details', () => {
      const state = createInitialState('chat')
      const originalError = new Error('Original message')

      const result = classifyAndLogError(originalError, state)

      expect(result.details).toEqual(
        expect.objectContaining({
          originalError: expect.stringContaining('Original message'),
        })
      )
    })
  })

  describe('isRecoverableError re-export', () => {
    it('correctly identifies recoverable errors', () => {
      const recoverableError = {
        code: AgentErrorCode.LLM_ERROR,
        message: 'Test',
        recoverable: true,
        timestamp: new Date().toISOString(),
      }
      const nonRecoverableError = {
        code: AgentErrorCode.STATE_ERROR,
        message: 'Test',
        recoverable: false,
        timestamp: new Date().toISOString(),
      }

      expect(isRecoverableError(recoverableError)).toBe(true)
      expect(isRecoverableError(nonRecoverableError)).toBe(false)
    })
  })
})
