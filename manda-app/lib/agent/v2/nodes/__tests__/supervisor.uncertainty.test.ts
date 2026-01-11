/**
 * Agent System v2.0 - Supervisor Node Uncertainty Integration Tests
 *
 * Story: 3-3 Implement Honest Uncertainty Handling (AC: #5)
 *
 * Tests covering supervisor integration with uncertainty utilities:
 * - Test 7.2: supervisor injects uncertainty context when sources are empty
 * - Test 7.3: supervisor handles missing dealContext gracefully
 * - Test 7.4: supervisor logs validation warnings for prohibited phrases
 * - Test 7.5: supervisor works correctly with both 'chat' and 'cim' workflow modes
 *
 * Run: cd manda-app && npm run test:run -- lib/agent/v2/nodes/__tests__/supervisor.uncertainty.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HumanMessage, AIMessage } from '@langchain/core/messages'
import { createInitialState } from '../../state'
import { supervisorNode } from '../supervisor'
import type { SourceCitation } from '../../types'

// Mock the LLM module
vi.mock('../../llm/gemini', () => ({
  getSupervisorLLMWithTools: vi.fn(),
}))

// Mock the retry utility to avoid delays in tests
vi.mock('../../utils/retry', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}))

// Import after mocking
import { getSupervisorLLMWithTools } from '../../llm/gemini'

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a mock source citation with specified relevance score.
 */
function createSource(relevanceScore: number, id = 'doc-1'): SourceCitation {
  return {
    documentId: id,
    documentName: `Document ${id}`,
    snippet: 'Test snippet',
    relevanceScore,
    retrievedAt: new Date().toISOString(),
  }
}

// =============================================================================
// Supervisor Uncertainty Integration Tests (Task 7)
// =============================================================================

describe('supervisorNode uncertainty integration', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>
  let consoleLogSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    consoleWarnSpy.mockRestore()
    consoleLogSpy.mockRestore()
  })

  // Test 7.2: supervisor injects uncertainty context when sources are empty
  describe('uncertainty context injection (Test 7.2)', () => {
    it('injects uncertainty context when sources are empty', async () => {
      const mockResponse = {
        content:
          'No documents have been uploaded yet. Please upload documents to get started.',
        tool_calls: undefined,
      }
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue(mockResponse),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      // State with empty sources (no documents)
      const state = createInitialState('chat', 'deal-123')
      state.messages = [new HumanMessage('What is the revenue?')]
      state.sources = [] // Empty sources = complete uncertainty
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 0, // No documents
        createdAt: new Date().toISOString(),
      }

      await supervisorNode(state)

      // Verify LLM was called with uncertainty context in system prompt
      expect(mockLLM.invoke).toHaveBeenCalledTimes(1)
      const callArgs = mockLLM.invoke.mock.calls[0]?.[0] as unknown[]
      const firstMessage = callArgs?.[0] as { content?: string }
      const systemPrompt = firstMessage?.content

      // Should contain uncertainty context for complete uncertainty without docs
      expect(systemPrompt).toContain('**CONTEXT:**')
      expect(systemPrompt).toContain('No documents in the Data Room')
    })

    it('injects Q&A suggestion context when sources empty but documents exist', async () => {
      const mockResponse = {
        content:
          'I could not find relevant information. Would you like me to add this to the Q&A list?',
        tool_calls: undefined,
      }
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue(mockResponse),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      // State with empty sources but documents exist
      const state = createInitialState('chat', 'deal-123')
      state.messages = [new HumanMessage('What is the customer churn rate?')]
      state.sources = [] // Empty sources = complete uncertainty
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 10, // Has documents
        createdAt: new Date().toISOString(),
      }

      await supervisorNode(state)

      const callArgs = mockLLM.invoke.mock.calls[0]?.[0] as unknown[]
      const firstMessage = callArgs?.[0] as { content?: string }
      const systemPrompt = firstMessage?.content

      // Should suggest Q&A list, not uploading docs
      expect(systemPrompt).toContain('**CONTEXT:**')
      expect(systemPrompt).toContain('Q&A list')
    })

    it('injects limited information context for high uncertainty', async () => {
      const mockResponse = {
        content: 'Based on limited information, revenue appears to be around $5M.',
        tool_calls: undefined,
      }
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue(mockResponse),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      // State with low-relevance sources
      const state = createInitialState('chat', 'deal-123')
      state.messages = [new HumanMessage('What is the revenue?')]
      state.sources = [createSource(0.2), createSource(0.25)] // High uncertainty
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }

      await supervisorNode(state)

      const callArgs = mockLLM.invoke.mock.calls[0]?.[0] as unknown[]
      const firstMessage = callArgs?.[0] as { content?: string }
      const systemPrompt = firstMessage?.content

      expect(systemPrompt).toContain('**CONTEXT:**')
      expect(systemPrompt).toContain('Limited relevant information')
    })

    it('does not inject context for high-relevance sources', async () => {
      const mockResponse = {
        content: 'Revenue was $5.2M (source: Q3_Report.pdf, p.12).',
        tool_calls: undefined,
      }
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue(mockResponse),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      // State with high-relevance sources
      const state = createInitialState('chat', 'deal-123')
      state.messages = [new HumanMessage('What is the revenue?')]
      state.sources = [createSource(0.85), createSource(0.9)] // None uncertainty
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }

      await supervisorNode(state)

      const callArgs = mockLLM.invoke.mock.calls[0]?.[0] as unknown[]
      const firstMessage = callArgs?.[0] as { content?: string }
      const systemPrompt = firstMessage?.content

      // Should NOT contain uncertainty context for high relevance
      expect(systemPrompt).not.toContain('**CONTEXT:**')
    })
  })

  // Test 7.3: supervisor handles missing dealContext gracefully
  describe('missing dealContext handling (Test 7.3)', () => {
    it('handles missing dealContext gracefully (assumes hasDocuments=false)', async () => {
      const mockResponse = {
        content:
          'No documents available. Please upload documents to get started.',
        tool_calls: undefined,
      }
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue(mockResponse),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      // State WITHOUT dealContext
      const state = createInitialState('chat')
      state.messages = [new HumanMessage('What is the revenue?')]
      state.sources = [] // Empty sources
      state.dealContext = null // No deal context

      const result = await supervisorNode(state)

      // Should not error
      expect(result.errors).toBeUndefined()

      // Should warn about missing dealContext
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[uncertainty] dealContext not loaded')
      )

      // Should assume no documents and suggest uploading
      const callArgs = mockLLM.invoke.mock.calls[0]?.[0] as unknown[]
      const firstMessage = callArgs?.[0] as { content?: string }
      const systemPrompt = firstMessage?.content

      expect(systemPrompt).toContain('No documents in the Data Room')
    })

    it('handles dealContext with null documentCount', async () => {
      const mockResponse = {
        content: 'Response text',
        tool_calls: undefined,
      }
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue(mockResponse),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      const state = createInitialState('chat', 'deal-123')
      state.messages = [new HumanMessage('Hello')]
      state.sources = []
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 0, // Zero documents
        createdAt: new Date().toISOString(),
      }

      const result = await supervisorNode(state)

      expect(result.errors).toBeUndefined()
    })
  })

  // Test 7.4: supervisor logs validation warnings for prohibited phrases
  describe('response validation logging (Test 7.4)', () => {
    it('logs validation warnings for prohibited phrases', async () => {
      const mockResponse = {
        content: 'I think the revenue might be around $5M.',
        tool_calls: undefined,
      }
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue(mockResponse),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      const state = createInitialState('chat', 'deal-123')
      state.messages = [new HumanMessage('What is the revenue?')]
      state.sources = [createSource(0.8)]
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }

      await supervisorNode(state)

      // Should log validation warning for "I think"
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[uncertainty] response validation issues:',
        expect.arrayContaining([expect.stringContaining('I think')])
      )
    })

    it('logs validation warnings for currency without source', async () => {
      const mockResponse = {
        content: 'The revenue was $5.2M last quarter.',
        tool_calls: undefined,
      }
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue(mockResponse),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      const state = createInitialState('chat', 'deal-123')
      state.messages = [new HumanMessage('What is the revenue?')]
      state.sources = [createSource(0.8)]
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }

      await supervisorNode(state)

      // Should log validation warning for currency without source
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[uncertainty] response validation issues:',
        expect.arrayContaining([
          expect.stringContaining('Currency amount without source'),
        ])
      )
    })

    it('does not log warnings for clean responses', async () => {
      const mockResponse = {
        content:
          'Revenue was $5.2M (source: Q3_Report.pdf, p.12). EBITDA improved (source: Annual.pdf).',
        tool_calls: undefined,
      }
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue(mockResponse),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      const state = createInitialState('chat', 'deal-123')
      state.messages = [new HumanMessage('What is the revenue?')]
      state.sources = [createSource(0.9)]
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }

      await supervisorNode(state)

      // Should NOT log validation warnings for clean response
      expect(consoleWarnSpy).not.toHaveBeenCalledWith(
        '[uncertainty] response validation issues:',
        expect.anything()
      )
    })

    it('still returns response even with validation issues (soft enforcement)', async () => {
      const mockResponse = {
        content: 'I think the revenue is around $5M.',
        tool_calls: undefined,
      }
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue(mockResponse),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      const state = createInitialState('chat', 'deal-123')
      state.messages = [new HumanMessage('What is the revenue?')]
      state.sources = [createSource(0.8)]
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }

      const result = await supervisorNode(state)

      // Should still return the response (soft enforcement - don't block)
      expect(result.messages).toHaveLength(1)
      expect(result.messages?.[0]?.content).toBe(
        'I think the revenue is around $5M.'
      )
      expect(result.errors).toBeUndefined()
    })
  })

  // Test 7.5: supervisor works correctly with both 'chat' and 'cim' workflow modes
  describe('workflow mode compatibility (Test 7.5)', () => {
    it('works correctly with "chat" workflow mode', async () => {
      const mockResponse = {
        content: 'No information found.',
        tool_calls: undefined,
      }
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue(mockResponse),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      const state = createInitialState('chat', 'deal-123')
      state.messages = [new HumanMessage('What is the revenue?')]
      state.sources = []
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }

      const result = await supervisorNode(state)

      expect(result.errors).toBeUndefined()
      expect(result.messages).toHaveLength(1)

      // Verify uncertainty detection ran
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[uncertainty] detected level=complete')
      )
    })

    it('works correctly with "cim" workflow mode', async () => {
      const mockResponse = {
        content: 'Generating CIM content...',
        tool_calls: undefined,
      }
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue(mockResponse),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      const state = createInitialState('cim', 'deal-123')
      state.messages = [new HumanMessage('Create executive summary')]
      state.sources = [createSource(0.6), createSource(0.65)] // Low uncertainty
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 10,
        createdAt: new Date().toISOString(),
      }

      const result = await supervisorNode(state)

      expect(result.errors).toBeUndefined()
      expect(result.messages).toHaveLength(1)

      // Verify uncertainty detection ran with correct level
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[uncertainty] detected level=low')
      )
    })

    it('works correctly with "irl" workflow mode', async () => {
      const mockResponse = {
        content: 'IRL suggestion content...',
        tool_calls: undefined,
      }
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue(mockResponse),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      const state = createInitialState('irl', 'deal-123')
      state.messages = [new HumanMessage('Generate IRL suggestions')]
      state.sources = [createSource(0.4), createSource(0.45)] // Medium uncertainty
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }

      const result = await supervisorNode(state)

      expect(result.errors).toBeUndefined()
      expect(result.messages).toHaveLength(1)

      // Verify uncertainty detection ran
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[uncertainty] detected level=medium')
      )
    })
  })

  describe('edge cases', () => {
    it('handles undefined sources array', async () => {
      const mockResponse = {
        content: 'Hello!',
        tool_calls: undefined,
      }
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue(mockResponse),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      const state = createInitialState('chat')
      state.messages = [new HumanMessage('Hello')]
      // Force undefined sources to test defensive behavior
      // In practice, reducers ensure sources is always an array, but this tests robustness
      ;(state as { sources?: SourceCitation[] }).sources = undefined

      const result = await supervisorNode(state)

      expect(result.errors).toBeUndefined()
      // Should treat undefined as empty array = complete uncertainty
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[uncertainty] detected level=complete')
      )
    })

    it('handles empty message array', async () => {
      const mockResponse = {
        content: 'How can I help?',
        tool_calls: undefined,
      }
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue(mockResponse),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      const state = createInitialState('chat')
      state.messages = [] // Empty messages
      state.sources = []

      const result = await supervisorNode(state)

      expect(result.errors).toBeUndefined()
    })

    it('handles response with non-string content', async () => {
      const mockResponse = {
        content: ['array', 'content'], // Non-string content
        tool_calls: undefined,
      }
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue(mockResponse),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      const state = createInitialState('chat')
      state.messages = [new HumanMessage('Hello')]
      state.sources = [createSource(0.8)]

      const result = await supervisorNode(state)

      // Should not throw, should handle gracefully
      expect(result.errors).toBeUndefined()
      // Should not call validation for non-string content
      expect(consoleWarnSpy).not.toHaveBeenCalledWith(
        '[uncertainty] response validation issues:',
        expect.anything()
      )
    })
  })
})
