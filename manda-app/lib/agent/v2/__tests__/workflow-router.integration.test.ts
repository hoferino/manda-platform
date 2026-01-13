/**
 * Agent System v2.0 - Workflow Router Integration Tests
 *
 * Story: 2-3 Implement Workflow Router Middleware (AC: #5)
 *
 * Tests verify:
 * - Middleware sets systemPrompt, supervisor uses it
 * - Deal context from state included in final prompt
 * - CIM phase correctly passed through chain
 *
 * These are integration tests that require RUN_INTEGRATION_TESTS=true
 *
 * References:
 * - [Source: _bmad-output/implementation-artifacts/agent-system-v2/stories/2-3-implement-workflow-router-middleware.md#Testing Strategy]
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

import { workflowRouterMiddleware } from '../middleware/workflow-router'
import { supervisorNode, SPECIALIST_GUIDANCE } from '../nodes/supervisor'
import { createInitialState, createInitialCIMState } from '../state'
import type { AgentStateType } from '../state'
import { HumanMessage } from '@langchain/core/messages'

// =============================================================================
// Skip if not running integration tests
// =============================================================================

const SKIP_INTEGRATION = process.env.RUN_INTEGRATION_TESTS !== 'true'

// Helper to conditionally run tests
const itIntegration = SKIP_INTEGRATION ? it.skip : it

// =============================================================================
// Mock LLM for integration tests (we're testing middleware → supervisor chain)
// =============================================================================

// Mock the LLM module to avoid actual API calls
vi.mock('../llm/gemini', () => ({
  getSupervisorLLMWithTools: vi.fn().mockReturnValue({
    invoke: vi.fn().mockResolvedValue({
      content: 'Integration test response',
      tool_calls: [],
    }),
  }),
}))

// We need to mock the prompt functions for controlled testing
vi.mock('@/lib/agent/prompts', () => ({
  getSystemPromptWithContext: vi.fn().mockImplementation((dealName?: string) => {
    const base = 'INTEGRATION_CHAT_PROMPT'
    return dealName ? `${base}\nDeal: ${dealName}` : base
  }),
}))

vi.mock('@/lib/agent/cim/prompts', () => ({
  getCIMSystemPrompt: vi.fn().mockImplementation((phase: string, dealName?: string) => {
    const base = `INTEGRATION_CIM_PROMPT_${phase.toUpperCase()}`
    return dealName ? `${base}\nDeal: ${dealName}` : base
  }),
}))

import { getSupervisorLLMWithTools } from '../llm/gemini'
import { getSystemPromptWithContext } from '@/lib/agent/prompts'
import { getCIMSystemPrompt } from '@/lib/agent/cim/prompts'

// =============================================================================
// Integration Test Suite
// =============================================================================

describe('Workflow Router → Supervisor Integration (AC: #5)', () => {
  beforeAll(() => {
    if (SKIP_INTEGRATION) {
      console.log('⚠️ Skipping integration tests. Set RUN_INTEGRATION_TESTS=true to run.')
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  // ---------------------------------------------------------------------------
  // Test #14: Middleware sets systemPrompt, supervisor uses it (AC: #5)
  // ---------------------------------------------------------------------------
  itIntegration('middleware sets systemPrompt which supervisor uses', async () => {
    // Create initial state
    const initialState: AgentStateType = {
      ...createInitialState('chat'),
      messages: [new HumanMessage('Hello')],
    }

    // Step 1: Run middleware
    const stateAfterMiddleware = workflowRouterMiddleware(initialState)

    // Verify middleware set systemPrompt
    expect(stateAfterMiddleware.systemPrompt).toBeDefined()
    expect(stateAfterMiddleware.systemPrompt).toBe('INTEGRATION_CHAT_PROMPT')

    // Step 2: Run supervisor (it should use the systemPrompt)
    await supervisorNode(stateAfterMiddleware)

    // Verify the LLM was invoked
    const mockLLM = getSupervisorLLMWithTools()
    expect(mockLLM.invoke).toHaveBeenCalled()

    // Get the messages passed to LLM
    const invokeCalls = vi.mocked(mockLLM.invoke).mock.calls
    expect(invokeCalls.length).toBeGreaterThan(0)
    const invokeCall = invokeCalls[0]!

    // First message should be SystemMessage with our prompt + specialist guidance
    const messages = invokeCall[0] as unknown as Array<{ content: string }>
    expect(Array.isArray(messages)).toBe(true)
    expect(messages.length).toBeGreaterThanOrEqual(2) // At least system + human message

    // System message content should include middleware prompt + specialist guidance
    const systemMessage = messages[0]!
    expect(systemMessage.content).toContain('INTEGRATION_CHAT_PROMPT')
    expect(systemMessage.content).toContain('Specialist Delegation')
  })

  // ---------------------------------------------------------------------------
  // Test #15: Deal context from state included in final prompt (AC: #3, #5)
  // ---------------------------------------------------------------------------
  itIntegration('deal context is included in final supervisor prompt', async () => {
    // Create state with deal context
    const stateWithDeal: AgentStateType = {
      ...createInitialState('chat'),
      dealContext: {
        dealId: 'deal-integration',
        dealName: 'Integration Test Corp',
        projectId: 'proj-int',
        organizationId: 'org-int',
        status: 'active',
        documentCount: 10,
        createdAt: '2026-01-01T00:00:00Z',
      },
      messages: [new HumanMessage('What is the revenue?')],
    }

    // Run middleware
    const stateAfterMiddleware = workflowRouterMiddleware(stateWithDeal)

    // Verify deal name was passed to prompt function
    expect(getSystemPromptWithContext).toHaveBeenCalledWith('Integration Test Corp')

    // Verify systemPrompt contains deal name
    expect(stateAfterMiddleware.systemPrompt).toContain('Integration Test Corp')

    // Run supervisor
    await supervisorNode(stateAfterMiddleware)

    // Get the messages passed to LLM
    const mockLLM = getSupervisorLLMWithTools()
    const invokeCalls = vi.mocked(mockLLM.invoke).mock.calls
    expect(invokeCalls.length).toBeGreaterThan(0)
    const invokeCall = invokeCalls[0]!
    const messages = invokeCall[0] as unknown as Array<{ content: string }>
    const systemMessage = messages[0]!

    // Final prompt should include deal context
    expect(systemMessage.content).toContain('Integration Test Corp')
  })

  // ---------------------------------------------------------------------------
  // Test #16: CIM phase correctly passed through chain (AC: #4, #5)
  // ---------------------------------------------------------------------------
  itIntegration('CIM phase is correctly passed through middleware → supervisor chain', async () => {
    // Create CIM state with specific phase
    const cimState: AgentStateType = {
      ...createInitialCIMState('cim-integration', 'deal-cim', 'user-cim'),
      cimState: {
        cimId: 'cim-integration',
        currentPhase: 'content_creation', // Unified CIMPhase - no mapping needed
        completedPhases: ['persona', 'thesis', 'outline'],
        buyerPersona: 'Strategic acquirer seeking growth',
        investmentThesis: 'Strong market position',
        outline: ['Overview', 'Financials'],
        slides: [],
        dependencyGraph: {},
        isComplete: false,
      },
      messages: [new HumanMessage('Generate the executive summary slide')],
    }

    // Run middleware
    const stateAfterMiddleware = workflowRouterMiddleware(cimState)

    // Verify CIM prompt function was called with mapped phase
    expect(getCIMSystemPrompt).toHaveBeenCalledWith('content_creation', undefined)

    // Verify systemPrompt is set
    expect(stateAfterMiddleware.systemPrompt).toContain('CIM_PROMPT')
    expect(stateAfterMiddleware.systemPrompt).toContain('CONTENT_CREATION')

    // Run supervisor
    await supervisorNode(stateAfterMiddleware)

    // Get the messages passed to LLM
    const mockLLM = getSupervisorLLMWithTools()
    const invokeCalls = vi.mocked(mockLLM.invoke).mock.calls
    expect(invokeCalls.length).toBeGreaterThan(0)
    const invokeCall = invokeCalls[0]!
    const messages = invokeCall[0] as unknown as Array<{ content: string }>
    const systemMessage = messages[0]!

    // Final prompt should be CIM-specific with specialist guidance
    expect(systemMessage.content).toContain('CIM_PROMPT')
    expect(systemMessage.content).toContain('Specialist Delegation')
  })

  // ---------------------------------------------------------------------------
  // Fallback behavior test
  // ---------------------------------------------------------------------------
  itIntegration('supervisor falls back to inline prompt when systemPrompt is null', async () => {
    // Create state without running middleware (systemPrompt is null)
    const stateWithoutMiddleware: AgentStateType = {
      ...createInitialState('chat'),
      systemPrompt: null, // Explicitly null
      messages: [new HumanMessage('Hello')],
    }

    // Run supervisor directly without middleware
    await supervisorNode(stateWithoutMiddleware)

    // Supervisor should fall back to calling getSystemPromptWithContext
    expect(getSystemPromptWithContext).toHaveBeenCalled()

    // LLM should still be invoked
    const mockLLM = getSupervisorLLMWithTools()
    expect(mockLLM.invoke).toHaveBeenCalled()
  })
})

// =============================================================================
// Non-integration tests (always run)
// =============================================================================

describe('Workflow Router Middleware Type (non-integration)', () => {
  it('Middleware type signature is correct', () => {
    // Verify the middleware function has correct signature
    expect(typeof workflowRouterMiddleware).toBe('function')
    expect(workflowRouterMiddleware.length).toBe(1) // Takes 1 argument (state)
  })

  it('SPECIALIST_GUIDANCE is exported from supervisor', () => {
    expect(typeof SPECIALIST_GUIDANCE).toBe('string')
    expect(SPECIALIST_GUIDANCE).toContain('Specialist Delegation')
    expect(SPECIALIST_GUIDANCE).toContain('financial-analyst')
    expect(SPECIALIST_GUIDANCE).toContain('document-researcher')
    expect(SPECIALIST_GUIDANCE).toContain('kg-expert')
    expect(SPECIALIST_GUIDANCE).toContain('due-diligence')
  })
})
