/**
 * Agent System v2.0 - Workflow Router Middleware Tests
 *
 * Story: 2-3 Implement Workflow Router Middleware (AC: #1, #2, #3, #4, #5, #6)
 *
 * Tests verify:
 * - Chat mode returns correct prompt (AC: #1)
 * - CIM mode returns phase-specific prompt (AC: #1, #4)
 * - IRL mode returns placeholder prompt (AC: #1)
 * - Deal context handling (AC: #3)
 * - Edge case handling (AC: #6)
 * - State preservation (AC: #3)
 * - Middleware is synchronous
 *
 * References:
 * - [Source: _bmad-output/implementation-artifacts/agent-system-v2/stories/2-3-implement-workflow-router-middleware.md#Testing Strategy]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

import { workflowRouterMiddleware, getIRLSystemPrompt } from '../workflow-router'
import { createInitialState, createInitialCIMState } from '../../state'
import type { AgentStateType } from '../../state'

// =============================================================================
// Mock Setup
// =============================================================================

// Mock the external prompt functions
vi.mock('@/lib/agent/prompts', () => ({
  getSystemPromptWithContext: vi.fn().mockImplementation((dealName?: string) => {
    const base = 'MOCK_CHAT_PROMPT'
    return dealName ? `${base}\nDeal: ${dealName}` : base
  }),
}))

vi.mock('@/lib/agent/cim/prompts', () => ({
  getCIMSystemPrompt: vi.fn().mockImplementation((phase: string, dealName?: string) => {
    const base = `MOCK_CIM_PROMPT_${phase.toUpperCase()}`
    return dealName ? `${base}\nDeal: ${dealName}` : base
  }),
}))

// Import mocked modules after setting up mocks
import { getSystemPromptWithContext } from '@/lib/agent/prompts'
import { getCIMSystemPrompt } from '@/lib/agent/cim/prompts'

// =============================================================================
// Test Suites
// =============================================================================

describe('workflowRouterMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Suppress console.warn during tests
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  // ---------------------------------------------------------------------------
  // Test #1: Chat mode returns correct prompt (AC: #1)
  // ---------------------------------------------------------------------------
  describe('chat mode (AC: #1, #3)', () => {
    it('returns correct prompt for chat mode', () => {
      const state = createInitialState('chat')
      const result = workflowRouterMiddleware(state)

      expect(getSystemPromptWithContext).toHaveBeenCalled()
      expect(result.systemPrompt).toBe('MOCK_CHAT_PROMPT')
    })

    it('includes deal name when dealContext is populated', () => {
      const state: AgentStateType = {
        ...createInitialState('chat'),
        dealContext: {
          dealId: 'deal-123',
          dealName: 'Acme Corp',
          projectId: 'proj-1',
          organizationId: 'org-1',
          status: 'active',
          documentCount: 5,
          createdAt: '2026-01-01T00:00:00Z',
        },
      }

      const result = workflowRouterMiddleware(state)

      expect(getSystemPromptWithContext).toHaveBeenCalledWith('Acme Corp')
      expect(result.systemPrompt).toContain('Acme Corp')
    })

    it('returns default chat prompt when dealContext is null', () => {
      const state = createInitialState('chat')
      const result = workflowRouterMiddleware(state)

      expect(getSystemPromptWithContext).toHaveBeenCalledWith(undefined)
      expect(result.systemPrompt).toBe('MOCK_CHAT_PROMPT')
    })
  })

  // ---------------------------------------------------------------------------
  // Test #2: CIM mode returns phase-specific prompt (AC: #1, #4)
  // ---------------------------------------------------------------------------
  describe('cim mode (AC: #1, #4)', () => {
    it('returns phase-specific prompt for CIM mode', () => {
      const state = createInitialCIMState('cim-001', 'deal-123', 'user-456')
      const result = workflowRouterMiddleware(state)

      expect(getCIMSystemPrompt).toHaveBeenCalled()
      expect(result.systemPrompt).toContain('CIM_PROMPT')
    })

    it('passes correct phase from cimState.currentPhase', () => {
      // Create state with 'outline' phase (unified CIMPhase)
      const state: AgentStateType = {
        ...createInitialCIMState('cim-001', 'deal-123', 'user-456'),
        cimState: {
          cimId: 'cim-001',
          currentPhase: 'outline',
          completedPhases: ['persona'],
          buyerPersona: 'Strategic acquirer',
          investmentThesis: null,
          outline: null,
          slides: [],
          dependencyGraph: {},
          isComplete: false,
        },
      }

      workflowRouterMiddleware(state)

      // CIMPhase is now unified - passes through directly
      expect(getCIMSystemPrompt).toHaveBeenCalledWith('outline', undefined)
    })

    it('passes content_creation phase correctly', () => {
      const state: AgentStateType = {
        ...createInitialCIMState('cim-001', 'deal-123', 'user-456'),
        cimState: {
          cimId: 'cim-001',
          currentPhase: 'content_creation', // Unified phase name
          completedPhases: ['persona', 'thesis', 'outline'],
          buyerPersona: 'Strategic acquirer',
          investmentThesis: 'Growth potential',
          outline: ['Overview'],
          slides: [],
          dependencyGraph: {},
          isComplete: false,
        },
      }

      workflowRouterMiddleware(state)

      // CIMPhase is now unified - no mapping needed
      expect(getCIMSystemPrompt).toHaveBeenCalledWith('content_creation', undefined)
    })

    it('passes visual_concepts phase correctly', () => {
      const state: AgentStateType = {
        ...createInitialCIMState('cim-001', 'deal-123', 'user-456'),
        cimState: {
          cimId: 'cim-001',
          currentPhase: 'visual_concepts', // Unified phase name
          completedPhases: ['persona', 'thesis', 'outline', 'content_creation'],
          buyerPersona: 'Strategic acquirer',
          investmentThesis: 'Growth potential',
          outline: ['Overview'],
          slides: [],
          dependencyGraph: {},
          isComplete: false,
        },
      }

      workflowRouterMiddleware(state)

      // CIMPhase is now unified - no mapping needed
      expect(getCIMSystemPrompt).toHaveBeenCalledWith('visual_concepts', undefined)
    })

    it('defaults to persona phase if cimState is null', () => {
      const state: AgentStateType = {
        ...createInitialState('cim'),
        cimState: null, // Explicitly null
      }

      workflowRouterMiddleware(state)

      expect(console.warn).toHaveBeenCalledWith(
        '[workflow-router] CIM mode but cimState is null, defaulting to persona phase'
      )
      expect(getCIMSystemPrompt).toHaveBeenCalledWith('persona', undefined)
    })
  })

  // ---------------------------------------------------------------------------
  // Test #5: IRL mode returns placeholder prompt (AC: #1)
  // ---------------------------------------------------------------------------
  describe('irl mode (AC: #1)', () => {
    it('returns placeholder prompt for IRL mode', () => {
      const state = createInitialState('irl')
      const result = workflowRouterMiddleware(state)

      expect(result.systemPrompt).toContain('IRL')
      expect(result.systemPrompt).toContain('Information Request List')
    })

    it('includes deal name in IRL prompt when available', () => {
      const state: AgentStateType = {
        ...createInitialState('irl'),
        dealContext: {
          dealId: 'deal-123',
          dealName: 'Widget Inc',
          projectId: 'proj-1',
          organizationId: 'org-1',
          status: 'active',
          documentCount: 3,
          createdAt: '2026-01-01T00:00:00Z',
        },
      }

      const result = workflowRouterMiddleware(state)

      expect(result.systemPrompt).toContain('Widget Inc')
    })
  })

  // ---------------------------------------------------------------------------
  // Test #8: Null workflowMode defaults to chat with warning (AC: #6)
  // ---------------------------------------------------------------------------
  describe('edge cases (AC: #6)', () => {
    it('defaults to chat mode with warning when workflowMode is null', () => {
      // Create state with null workflowMode (need to cast to bypass type check)
      const state = {
        ...createInitialState('chat'),
        workflowMode: null as unknown as 'chat' | 'cim' | 'irl',
      }

      const result = workflowRouterMiddleware(state)

      expect(console.warn).toHaveBeenCalledWith(
        '[workflow-router] workflowMode is null/undefined, defaulting to chat'
      )
      expect(result.systemPrompt).toBe('MOCK_CHAT_PROMPT')
    })

    it('defaults to chat mode with warning when workflowMode is undefined', () => {
      const state = {
        ...createInitialState('chat'),
        workflowMode: undefined as unknown as 'chat' | 'cim' | 'irl',
      }

      const result = workflowRouterMiddleware(state)

      expect(console.warn).toHaveBeenCalled()
      expect(result.systemPrompt).toBe('MOCK_CHAT_PROMPT')
    })
  })

  // ---------------------------------------------------------------------------
  // Test #9: Does NOT modify messages array (AC: #3)
  // ---------------------------------------------------------------------------
  describe('state preservation (AC: #3)', () => {
    it('does NOT modify messages array', () => {
      const originalMessages = [{ content: 'test' }]
      const state: AgentStateType = {
        ...createInitialState('chat'),
        messages: originalMessages as AgentStateType['messages'],
      }

      const result = workflowRouterMiddleware(state)

      // Messages should be the same reference (not modified)
      expect(result.messages).toBe(originalMessages)
    })

    it('preserves all other state fields unchanged', () => {
      const state: AgentStateType = {
        ...createInitialState('chat'),
        sources: [
          {
            documentId: 'doc-1',
            documentName: 'Test Doc',
            snippet: 'test',
            relevanceScore: 0.9,
            retrievedAt: '2026-01-01T00:00:00Z',
          },
        ],
        activeSpecialist: 'financial-analyst',
        scratchpad: { key: 'value' },
        historySummary: 'Previous conversation summary',
        tokenCount: 1500,
      }

      const result = workflowRouterMiddleware(state)

      // All fields should be preserved
      expect(result.sources).toBe(state.sources)
      expect(result.activeSpecialist).toBe(state.activeSpecialist)
      expect(result.scratchpad).toBe(state.scratchpad)
      expect(result.historySummary).toBe(state.historySummary)
      expect(result.tokenCount).toBe(state.tokenCount)
    })

    it('output type matches AgentStateType', () => {
      const state = createInitialState('chat')
      const result = workflowRouterMiddleware(state)

      // TypeScript would catch this at compile time, but we verify at runtime
      expect(result).toHaveProperty('messages')
      expect(result).toHaveProperty('sources')
      expect(result).toHaveProperty('workflowMode')
      expect(result).toHaveProperty('systemPrompt')
    })
  })

  // ---------------------------------------------------------------------------
  // Test #12: Middleware is synchronous (AC: #5)
  // ---------------------------------------------------------------------------
  describe('synchronous behavior', () => {
    it('returns state synchronously (not a Promise)', () => {
      const state = createInitialState('chat')
      const result = workflowRouterMiddleware(state)

      // If it were async, result would be a Promise
      expect(result).not.toBeInstanceOf(Promise)
      expect(result.systemPrompt).toBeDefined()
    })
  })

  // ---------------------------------------------------------------------------
  // Test #13: Mock verification - correct prompt function called (AC: #1)
  // ---------------------------------------------------------------------------
  describe('prompt function selection (AC: #1)', () => {
    it('calls getSystemPromptWithContext for chat mode', () => {
      const state = createInitialState('chat')
      workflowRouterMiddleware(state)

      expect(getSystemPromptWithContext).toHaveBeenCalled()
      expect(getCIMSystemPrompt).not.toHaveBeenCalled()
    })

    it('calls getCIMSystemPrompt for cim mode', () => {
      const state = createInitialCIMState('cim-001', 'deal-123', 'user-456')
      workflowRouterMiddleware(state)

      expect(getCIMSystemPrompt).toHaveBeenCalled()
    })

    it('does not call external prompt functions for irl mode', () => {
      // Clear mocks first
      vi.clearAllMocks()

      const state = createInitialState('irl')
      workflowRouterMiddleware(state)

      // IRL uses inline getIRLSystemPrompt, not external functions
      expect(getSystemPromptWithContext).not.toHaveBeenCalled()
      expect(getCIMSystemPrompt).not.toHaveBeenCalled()
    })
  })
})

// =============================================================================
// getIRLSystemPrompt Tests
// =============================================================================

describe('getIRLSystemPrompt', () => {
  it('returns base prompt without deal name', () => {
    const prompt = getIRLSystemPrompt()

    expect(prompt).toContain('IRL')
    expect(prompt).toContain('Information Request List')
    expect(prompt).toContain('Core Responsibilities')
    expect(prompt).not.toContain('Current Deal Context')
  })

  it('includes deal name when provided', () => {
    const prompt = getIRLSystemPrompt('Mega Corp')

    expect(prompt).toContain('Mega Corp')
    expect(prompt).toContain('Current Deal Context')
  })

  it('returns string type', () => {
    const prompt = getIRLSystemPrompt()
    expect(typeof prompt).toBe('string')
  })
})
