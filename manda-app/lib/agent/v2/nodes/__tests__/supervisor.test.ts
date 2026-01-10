/**
 * Agent System v2.0 - Supervisor Node Tests
 *
 * Story: 2-1 Implement Supervisor Node with Tool-Calling
 *
 * Tests covering all 4 Acceptance Criteria:
 * - AC #1: LLM integration with error handling
 * - AC #2: Greeting messages get natural responses
 * - AC #3: Simple queries get direct responses
 * - AC #4: Complex queries trigger tool calls to specialists
 *
 * Run: cd manda-app && npm run test:run -- lib/agent/v2/nodes/__tests__/supervisor.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HumanMessage, AIMessage } from '@langchain/core/messages'
import { createInitialState } from '../../state'
import { supervisorNode, classifyAndLogError, isRecoverableError } from '../supervisor'
import { AgentErrorCode } from '../../types'

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

describe('supervisorNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('greeting handling (AC: #2)', () => {
    it('responds naturally to "Hello" without tool calls', async () => {
      // Mock LLM to return a direct response (no tool calls)
      const mockResponse = {
        content: 'Hello! How can I help you with this deal today?',
        tool_calls: undefined,
      }
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue(mockResponse),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      // Create state with greeting message
      const state = createInitialState('chat')
      state.messages = [new HumanMessage('Hello')]

      // Execute supervisor node
      const result = await supervisorNode(state)

      // Verify no specialist routing
      expect(result.activeSpecialist).toBeUndefined()
      // Verify response message was added
      expect(result.messages).toBeDefined()
      expect(result.messages).toHaveLength(1)
      const message = result.messages?.[0]
      expect(message).toBeInstanceOf(AIMessage)
      expect(message?.content).toBe(
        'Hello! How can I help you with this deal today?'
      )
      // Verify no errors
      expect(result.errors).toBeUndefined()
    })

    it('responds naturally to "Hi there" without document search', async () => {
      const mockResponse = {
        content: "Hi! I'm your M&A Due Diligence Assistant. What can I help you with?",
        tool_calls: undefined,
      }
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue(mockResponse),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      const state = createInitialState('chat')
      state.messages = [new HumanMessage('Hi there')]

      const result = await supervisorNode(state)

      expect(result.activeSpecialist).toBeUndefined()
      expect(result.messages).toBeDefined()
      expect(result.messages).toHaveLength(1)
      expect(result.messages?.[0]?.content).toContain('Due Diligence Assistant')
    })
  })

  describe('simple query handling (AC: #3)', () => {
    it('responds directly to simple system questions', async () => {
      const mockResponse = {
        content: "I'm your M&A Due Diligence Assistant, here to help you analyze documents and extract insights.",
        tool_calls: undefined,
      }
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue(mockResponse),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      const state = createInitialState('chat')
      state.messages = [new HumanMessage("What's your name?")]

      const result = await supervisorNode(state)

      expect(result.activeSpecialist).toBeUndefined()
      expect(result.messages).toHaveLength(1)
    })

    it('handles simple factual questions without unnecessary tool calls', async () => {
      const mockResponse = {
        content: 'I can help you with document analysis, financial review, due diligence, and more.',
        tool_calls: undefined,
      }
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue(mockResponse),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      const state = createInitialState('chat')
      state.messages = [new HumanMessage('What can you help me with?')]

      const result = await supervisorNode(state)

      expect(result.activeSpecialist).toBeUndefined()
      expect(result.errors).toBeUndefined()
    })
  })

  describe('tool-calling for specialists (AC: #4)', () => {
    it('routes financial questions to financial-analyst specialist', async () => {
      const mockResponse = {
        content: '',
        tool_calls: [
          {
            name: 'financial-analyst',
            args: { query: 'What is the EBITDA?', focusArea: 'profitability' },
            id: 'call_123',
          },
        ],
      }
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue(mockResponse),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      const state = createInitialState('chat')
      state.messages = [new HumanMessage('What is the EBITDA?')]

      const result = await supervisorNode(state)

      expect(result.activeSpecialist).toBe('financial-analyst')
      expect(result.messages).toBeDefined()
      expect(result.messages).toHaveLength(1)
      // Message should include tool_calls for downstream processing
      const message = result.messages?.[0]
      expect(message).toBeInstanceOf(AIMessage)
      // Verify tool_calls are preserved in the AIMessage for Epic 4 specialist execution
      const aiMessage = message as AIMessage
      expect(aiMessage.tool_calls).toBeDefined()
      expect(aiMessage.tool_calls).toHaveLength(1)
      expect(aiMessage.tool_calls?.[0]?.name).toBe('financial-analyst')
    })

    it('routes document research questions to document-researcher specialist', async () => {
      const mockResponse = {
        content: '',
        tool_calls: [
          {
            name: 'document-researcher',
            args: { query: 'Find all revenue mentions', searchDepth: 'deep' },
            id: 'call_456',
          },
        ],
      }
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue(mockResponse),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      const state = createInitialState('chat')
      state.messages = [new HumanMessage('Find all mentions of revenue in the documents')]

      const result = await supervisorNode(state)

      expect(result.activeSpecialist).toBe('document-researcher')
    })

    it('routes entity relationship questions to kg-expert specialist', async () => {
      const mockResponse = {
        content: '',
        tool_calls: [
          {
            name: 'kg-expert',
            args: { query: 'Who are the key shareholders?' },
            id: 'call_789',
          },
        ],
      }
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue(mockResponse),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      const state = createInitialState('chat')
      state.messages = [new HumanMessage('Who are the key shareholders and how are they related?')]

      const result = await supervisorNode(state)

      expect(result.activeSpecialist).toBe('kg-expert')
    })

    it('routes risk assessment questions to due-diligence specialist', async () => {
      const mockResponse = {
        content: '',
        tool_calls: [
          {
            name: 'due-diligence',
            args: { query: 'Any red flags?', category: 'general' },
            id: 'call_abc',
          },
        ],
      }
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue(mockResponse),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      const state = createInitialState('chat')
      state.messages = [new HumanMessage('Are there any red flags in this deal?')]

      const result = await supervisorNode(state)

      expect(result.activeSpecialist).toBe('due-diligence')
    })
  })

  describe('error handling (AC: #1)', () => {
    it('handles LLM errors gracefully and returns error in state', async () => {
      const mockLLM = {
        invoke: vi.fn().mockRejectedValue(new Error('Rate limit exceeded - 429')),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      const state = createInitialState('chat')
      state.messages = [new HumanMessage('Test query')]

      const result = await supervisorNode(state)

      expect(result.errors).toBeDefined()
      expect(result.errors).toHaveLength(1)
      expect(result.errors?.[0]?.code).toBe(AgentErrorCode.LLM_ERROR)
      expect(result.errors?.[0]?.recoverable).toBe(true)
      expect(result.messages).toBeUndefined()
    })

    it('classifies non-LLM errors as STATE_ERROR', async () => {
      const mockLLM = {
        invoke: vi.fn().mockRejectedValue(new Error('Unknown internal error')),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      const state = createInitialState('chat')
      state.messages = [new HumanMessage('Test query')]

      const result = await supervisorNode(state)

      expect(result.errors).toBeDefined()
      expect(result.errors).toHaveLength(1)
      expect(result.errors?.[0]?.code).toBe(AgentErrorCode.STATE_ERROR)
      expect(result.errors?.[0]?.recoverable).toBe(false)
    })

    it('handles timeout errors as LLM_ERROR', async () => {
      const timeoutError = new Error('Request timeout')
      timeoutError.name = 'AbortError'
      const mockLLM = {
        invoke: vi.fn().mockRejectedValue(timeoutError),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      const state = createInitialState('chat')
      state.messages = [new HumanMessage('Test query')]

      const result = await supervisorNode(state)

      expect(result.errors).toBeDefined()
      expect(result.errors).toHaveLength(1)
      expect(result.errors?.[0]?.code).toBe(AgentErrorCode.LLM_ERROR)
      expect(result.errors?.[0]?.recoverable).toBe(true)
    })
  })

  describe('deal context handling', () => {
    it('includes deal context in system prompt when available', async () => {
      const mockResponse = {
        content: 'Here is information about Test Acquisition...',
        tool_calls: undefined,
      }
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue(mockResponse),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      const state = createInitialState('chat', 'deal-123', 'user-456')
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Acquisition',
        projectId: 'proj-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }
      state.messages = [new HumanMessage('What documents do we have?')]

      await supervisorNode(state)

      // Verify LLM was called with messages including system prompt
      expect(mockLLM.invoke).toHaveBeenCalledTimes(1)
      const callArgs = mockLLM.invoke.mock.calls[0]?.[0] as unknown[]
      // First message should be SystemMessage containing deal name
      const firstMessage = callArgs?.[0] as { content?: string }
      expect(firstMessage?.content).toContain('Test Acquisition')
    })

    it('works without deal context', async () => {
      const mockResponse = {
        content: 'Hello! How can I help you?',
        tool_calls: undefined,
      }
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue(mockResponse),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      const state = createInitialState('chat')
      state.messages = [new HumanMessage('Hello')]

      const result = await supervisorNode(state)

      expect(result.errors).toBeUndefined()
      expect(result.messages).toHaveLength(1)
    })
  })

  describe('system prompt construction', () => {
    it('includes specialist routing guidance in system prompt', async () => {
      const mockResponse = {
        content: 'Response',
        tool_calls: undefined,
      }
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue(mockResponse),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      const state = createInitialState('chat')
      state.messages = [new HumanMessage('Hello')]

      await supervisorNode(state)

      const callArgs = mockLLM.invoke.mock.calls[0]?.[0] as unknown[]
      const firstMessage = callArgs?.[0] as { content?: string }
      const systemPrompt = firstMessage?.content

      // Verify specialist guidance is included
      expect(systemPrompt).toContain('Specialist Delegation')
      expect(systemPrompt).toContain('financial-analyst')
      expect(systemPrompt).toContain('document-researcher')
      expect(systemPrompt).toContain('kg-expert')
      expect(systemPrompt).toContain('due-diligence')
    })

    it('preserves base prompt behaviors', async () => {
      const mockResponse = {
        content: 'Response',
        tool_calls: undefined,
      }
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue(mockResponse),
      }
      vi.mocked(getSupervisorLLMWithTools).mockReturnValue(mockLLM as never)

      const state = createInitialState('chat')
      state.messages = [new HumanMessage('Hello')]

      await supervisorNode(state)

      const callArgs = mockLLM.invoke.mock.calls[0]?.[0] as unknown[]
      const firstMessage = callArgs?.[0] as { content?: string }
      const systemPrompt = firstMessage?.content

      // Verify base prompt content is preserved
      expect(systemPrompt).toContain('M&A Due Diligence Assistant')
      expect(systemPrompt).toContain('Always cite sources')
    })
  })
})

describe('classifyAndLogError', () => {
  it('classifies LLM errors correctly', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const state = createInitialState('chat')
    state.messages = [new HumanMessage('Test')]

    const error = classifyAndLogError(new Error('Rate limit 429'), state)

    expect(error.code).toBe(AgentErrorCode.LLM_ERROR)
    expect(error.recoverable).toBe(true)
    expect(error.nodeId).toBe('supervisor')

    consoleSpy.mockRestore()
  })

  it('classifies non-LLM errors as STATE_ERROR', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const state = createInitialState('chat')
    state.messages = [new HumanMessage('Test')]

    const error = classifyAndLogError(new Error('Something went wrong'), state)

    expect(error.code).toBe(AgentErrorCode.STATE_ERROR)
    expect(error.recoverable).toBe(false)

    consoleSpy.mockRestore()
  })

  it('logs error with correct context', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const state = createInitialState('chat', 'deal-123')
    state.dealContext = {
      dealId: 'deal-123',
      dealName: 'Test',
      projectId: 'proj-123',
      status: 'active',
      documentCount: 0,
      createdAt: new Date().toISOString(),
    }
    state.messages = [new HumanMessage('Test')]

    classifyAndLogError(new Error('Test error'), state)

    expect(consoleSpy).toHaveBeenCalledWith(
      '[AgentError]',
      expect.objectContaining({
        nodeId: 'supervisor',
        workflowMode: 'chat',
        dealId: 'deal-123',
        messageCount: 1,
      })
    )

    consoleSpy.mockRestore()
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
