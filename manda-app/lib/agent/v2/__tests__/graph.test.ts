/**
 * Agent System v2.0 - StateGraph Tests
 *
 * Story: 1-2 Create Base StateGraph Structure (AC: #5)
 *
 * Tests for the StateGraph with conditional entry points:
 * - Graph compilation
 * - Workflow mode routing
 * - State pass-through behavior
 * - Graph reusability
 */

import { describe, it, expect } from 'vitest'
import { HumanMessage } from '@langchain/core/messages'

import { agentGraph, routeByWorkflowMode } from '../graph'
import { createInitialState, createInitialCIMState } from '../state'

describe('agentGraph', () => {
  // ==========================================================================
  // Graph Compilation Tests (AC: #3)
  // ==========================================================================

  describe('compilation', () => {
    it('should compile without errors and expose invoke/stream methods', () => {
      expect(agentGraph).toBeDefined()
      expect(typeof agentGraph.invoke).toBe('function')
      expect(typeof agentGraph.stream).toBe('function')
    })
  })

  // ==========================================================================
  // Node Execution Verification Tests (verifies actual routing via stream)
  // These tests require LLM API keys and are skipped in CI
  // ==========================================================================

  describe.skip('node execution', () => {
    it('should execute supervisor node for chat mode', async () => {
      const state = createInitialState('chat')
      const events: string[] = []

      for await (const chunk of await agentGraph.stream(state)) {
        // LangGraph stream emits objects keyed by node name
        events.push(...Object.keys(chunk))
      }

      expect(events).toContain('supervisor')
      expect(events).not.toContain('cim/phaseRouter')
    })

    it('should execute cim/phaseRouter node for cim mode', async () => {
      const state = createInitialCIMState('cim-001', 'deal-123', 'user-456')
      const events: string[] = []

      for await (const chunk of await agentGraph.stream(state)) {
        events.push(...Object.keys(chunk))
      }

      expect(events).toContain('cim/phaseRouter')
      expect(events).not.toContain('supervisor')
    })

    it('should execute supervisor node for irl mode', async () => {
      const state = createInitialState('irl')
      const events: string[] = []

      for await (const chunk of await agentGraph.stream(state)) {
        events.push(...Object.keys(chunk))
      }

      expect(events).toContain('supervisor')
      expect(events).not.toContain('cim/phaseRouter')
    })

  })

  // ==========================================================================
  // Router Function Tests (AC: #4)
  // ==========================================================================

  describe('routeByWorkflowMode', () => {
    it('should route chat mode to supervisor', () => {
      const state = createInitialState('chat')
      expect(routeByWorkflowMode(state)).toBe('supervisor')
    })

    it('should route cim mode to cim/phaseRouter', () => {
      const state = createInitialState('cim')
      expect(routeByWorkflowMode(state)).toBe('cim/phaseRouter')
    })

    it('should route irl mode to supervisor (fallback)', () => {
      const state = createInitialState('irl')
      expect(routeByWorkflowMode(state)).toBe('supervisor')
    })

    it('should use default chat mode when no mode specified', () => {
      const state = createInitialState()
      expect(state.workflowMode).toBe('chat')
      expect(routeByWorkflowMode(state)).toBe('supervisor')
    })
  })

  // ==========================================================================
  // Graph Invocation Tests (AC: #5)
  // ==========================================================================

  describe('invoke', () => {
    it('should route chat mode to supervisor and return state', async () => {
      const state = createInitialState('chat')
      const result = await agentGraph.invoke(state)

      // State should be returned with workflow mode preserved
      expect(result.workflowMode).toBe('chat')
    })

    it('should route cim mode to cim/phaseRouter and return state', async () => {
      const state = createInitialCIMState('cim-001', 'deal-123', 'user-456')
      const result = await agentGraph.invoke(state)

      // State should be returned with workflow mode preserved
      expect(result.workflowMode).toBe('cim')
    })

    it('should preserve messages through placeholder nodes', async () => {
      const state = createInitialState('chat')
      state.messages = [new HumanMessage('Hello')]

      const result = await agentGraph.invoke(state)

      // Messages should pass through unchanged
      expect(result.messages).toHaveLength(1)
      expect(result.messages[0]?.content).toBe('Hello')
    })

    it('should preserve sources through placeholder nodes', async () => {
      const state = createInitialState('chat')
      state.sources = [
        {
          documentId: 'doc-1',
          documentName: 'Test Doc',
          snippet: 'Test snippet',
          relevanceScore: 0.9,
          retrievedAt: new Date().toISOString(),
        },
      ]

      const result = await agentGraph.invoke(state)

      // Sources should pass through unchanged
      expect(result.sources).toHaveLength(1)
      expect(result.sources[0]?.documentId).toBe('doc-1')
    })

    it('should preserve dealContext through placeholder nodes', async () => {
      const state = createInitialState('chat', 'deal-123', 'user-456')

      const result = await agentGraph.invoke(state)

      // Deal context should pass through unchanged
      expect(result.dealContext).not.toBeNull()
      expect(result.dealContext?.dealId).toBe('deal-123')
    })

    it('should preserve cimState through placeholder nodes', async () => {
      const state = createInitialCIMState('cim-001', 'deal-123', 'user-456')

      const result = await agentGraph.invoke(state)

      // CIM state should pass through unchanged
      expect(result.cimState).not.toBeNull()
      expect(result.cimState?.cimId).toBe('cim-001')
      expect(result.cimState?.currentPhase).toBe('persona')
    })

    it('should preserve scratchpad through placeholder nodes', async () => {
      const state = createInitialState('chat')
      state.scratchpad = { key: 'value', nested: { data: 123 } }

      const result = await agentGraph.invoke(state)

      // Scratchpad should pass through unchanged
      expect(result.scratchpad.key).toBe('value')
      expect((result.scratchpad.nested as { data: number }).data).toBe(123)
    })

    it('should preserve errors through nodes (errors accumulate)', async () => {
      const state = createInitialState('chat')
      // @ts-expect-error - testing with partial error for simplicity
      state.errors = [{ code: 'LLM_ERROR', message: 'Test error' }]

      const result = await agentGraph.invoke(state)

      // Errors accumulate - original error should be preserved
      // Additional errors may be added if LLM fails during node execution
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      // Original error should still be present (reducer appends)
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'LLM_ERROR', message: 'Test error' }),
        ])
      )
    })

    it('should preserve all 11 state fields through invocation', async () => {
      const state = createInitialState('chat', 'deal-123', 'user-456')
      state.messages = [new HumanMessage('Test')]
      state.tokenCount = 100

      const result = await agentGraph.invoke(state)

      // All 11 fields should be present
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
  })

  // ==========================================================================
  // Graph Reusability Tests (AC: #5)
  // ==========================================================================

  describe('reusability', () => {
    it('should be invocable multiple times (stateless)', async () => {
      const state1 = createInitialState('chat')
      const state2 = createInitialState('cim')

      const result1 = await agentGraph.invoke(state1)
      const result2 = await agentGraph.invoke(state2)

      // Each invocation should work independently
      expect(result1.workflowMode).toBe('chat')
      expect(result2.workflowMode).toBe('cim')
    })

    it('should not share state between invocations', async () => {
      const state1 = createInitialState('chat', 'deal-1')
      const state2 = createInitialState('chat', 'deal-2')

      const result1 = await agentGraph.invoke(state1)
      const result2 = await agentGraph.invoke(state2)

      // States should remain independent
      expect(result1.dealContext?.dealId).toBe('deal-1')
      expect(result2.dealContext?.dealId).toBe('deal-2')
    })

    it('should handle concurrent invocations', async () => {
      // Test all valid workflow modes: chat, cim, irl (qa is a cross-cutting tool, not a mode)
      const states = [
        createInitialState('chat', 'deal-1'),
        createInitialState('cim', 'deal-2'),
        createInitialState('irl', 'deal-3'),
        createInitialState('chat', 'deal-4'), // Another chat instance
      ]

      const results = await Promise.all(states.map((s) => agentGraph.invoke(s)))

      // All concurrent invocations should succeed
      expect(results).toHaveLength(4)
      expect(results[0]?.dealContext?.dealId).toBe('deal-1')
      expect(results[1]?.dealContext?.dealId).toBe('deal-2')
      expect(results[2]?.dealContext?.dealId).toBe('deal-3')
      expect(results[3]?.dealContext?.dealId).toBe('deal-4')
    })
  })

  // ==========================================================================
  // Stream Tests
  // ==========================================================================

  describe('stream', () => {
    it('should support streaming invocation', async () => {
      const state = createInitialState('chat')
      const events: unknown[] = []

      for await (const event of await agentGraph.stream(state)) {
        events.push(event)
      }

      // Should have at least one event from the stream
      expect(events.length).toBeGreaterThan(0)
    })
  })
})
