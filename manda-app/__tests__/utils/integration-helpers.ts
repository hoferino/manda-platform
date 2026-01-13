/**
 * Integration Test Helpers
 *
 * Story: E11.7 - Context-Knowledge Integration Tests
 * Shared mock factories and helpers for integration testing.
 *
 * These utilities provide:
 * - Mock LLM factory for testing agent interactions
 * - Mock Graphiti client for knowledge base operations
 * - Test message generators for conversation testing
 * - Token savings verification helpers
 */

import { vi } from 'vitest'
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'

// ============================================================================
// Test Data Constants
// ============================================================================

/**
 * Sample deal for testing
 */
export const TEST_DEAL = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Test Acquisition Target',
  documents: [
    {
      id: 'doc-001',
      name: 'Q3 Financials 2024.pdf',
      type: 'financial',
    },
    {
      id: 'doc-002',
      name: 'Due Diligence Summary.docx',
      type: 'summary',
    },
  ],
}

/**
 * Sample facts for indexing tests
 */
export const FACTS_TO_INDEX = [
  {
    content: 'Q3 revenue was $5.2M, corrected from initial $4.8M estimate',
    source_type: 'correction' as const,
    expected_confidence: 0.95,
  },
  {
    content: 'The company has 150 employees as of December 2024',
    source_type: 'new_info' as const,
    expected_confidence: 0.85,
  },
  {
    content: 'Yes, EBITDA margins were 22% in Q3, confirmed',
    source_type: 'confirmation' as const,
    expected_confidence: 0.90,
  },
]

/**
 * Sample Graphiti search results
 */
export const MOCK_GRAPHITI_RESULTS = [
  {
    id: 'ep-001',
    content: 'Q3 revenue was $5.2M',
    score: 0.95,
    source_type: 'episode' as const,
    source_channel: 'analyst_correction',
    confidence: 0.95,
    citation: {
      type: 'chat' as const,
      id: 'chat-001',
      title: 'Analyst Correction',
      excerpt: 'User corrected Q3 revenue from $4.8M to $5.2M',
      confidence: 0.95,
    },
  },
  {
    id: 'ep-002',
    content: 'Company has 150 employees',
    score: 0.88,
    source_type: 'episode' as const,
    source_channel: 'chat_ingestion',
    confidence: 0.85,
    citation: {
      type: 'chat' as const,
      id: 'chat-002',
      title: 'User Input',
      excerpt: 'User provided employee count information',
      confidence: 0.85,
    },
  },
]

// ============================================================================
// Mock Factories
// ============================================================================

/**
 * Create a mock LLM that returns configurable responses
 *
 * @param response - The response content to return
 * @param shouldFail - Whether the LLM should throw an error
 * @returns Mock LLM compatible with LangChain BaseChatModel interface
 */
export function createMockLLM(
  response = 'Summary: Financial metrics discussed.',
  shouldFail = false
) {
  return {
    invoke: vi.fn(async () => {
      if (shouldFail) {
        throw new Error('LLM API error')
      }
      return {
        content: response,
      }
    }),
    // Required for BaseChatModel compatibility
    _modelType: () => 'base_chat_model' as const,
    _llmType: () => 'mock' as const,
    bindTools: vi.fn(),
    pipe: vi.fn(),
    batch: vi.fn(),
    stream: vi.fn(),
    lc_namespace: ['langchain', 'chat_models'],
  }
}

/**
 * Create a mock Graphiti client for knowledge base operations
 */
export function createMockGraphitiClient() {
  return {
    addEpisode: vi.fn(async (params: {
      episodeBody: string
      source: string
      confidence: number
    }) => ({
      success: true,
      episode_id: `ep-${Date.now()}`,
      elapsed_ms: 150,
    })),
    search: vi.fn(async () => ({
      query: 'test query',
      results: MOCK_GRAPHITI_RESULTS,
      sources: MOCK_GRAPHITI_RESULTS.map(r => r.citation).filter(Boolean),
      entities: ['ABC Corporation', 'Q3 2024'],
      latency_ms: 100,
      result_count: MOCK_GRAPHITI_RESULTS.length,
    })),
    ingestChatFact: vi.fn(async () => ({
      success: true,
      episode_count: 1,
      elapsed_ms: 150,
      estimated_cost_usd: 0.00001,
    })),
  }
}

/**
 * Create a mock Graphiti response for specific test scenarios
 *
 * @param scenario - The test scenario ('fact_found', 'no_results', 'error')
 */
export function createMockGraphitiResponse(
  scenario: 'fact_found' | 'no_results' | 'error' | 'multiple_results' = 'fact_found'
) {
  switch (scenario) {
    case 'fact_found':
      return {
        success: true,
        results: [MOCK_GRAPHITI_RESULTS[0]],
        result_count: 1,
        latency_ms: 50,
      }
    case 'no_results':
      return {
        success: true,
        results: [],
        result_count: 0,
        latency_ms: 30,
      }
    case 'multiple_results':
      return {
        success: true,
        results: MOCK_GRAPHITI_RESULTS,
        result_count: MOCK_GRAPHITI_RESULTS.length,
        latency_ms: 75,
      }
    case 'error':
      throw new Error('Graphiti service unavailable')
  }
}

/**
 * Create a mock tool result with isolation support
 *
 * @param toolName - Name of the tool that generated the result
 * @param fullResult - The complete result data
 * @param summaryLength - Target length for the summary
 */
export function createMockToolResult(
  toolName: string,
  fullResult: Record<string, unknown>,
  summaryLength = 100
) {
  const fullResultString = JSON.stringify(fullResult)
  const summary = fullResultString.length > summaryLength
    ? fullResultString.slice(0, summaryLength) + '...'
    : fullResultString

  return {
    toolCallId: `tc-${toolName}-${Date.now()}`,
    toolName,
    fullResult,
    fullResultTokens: Math.ceil(fullResultString.length / 4),
    summary,
    summaryTokens: Math.ceil(summary.length / 4),
    isolationApplied: fullResultString.length > summaryLength,
  }
}

// ============================================================================
// Test Message Generators
// ============================================================================

/**
 * Create test messages for conversation testing
 *
 * @param count - Number of messages to create
 * @returns Array of alternating Human/AI messages
 */
export function createTestMessages(count: number): BaseMessage[] {
  const messages: BaseMessage[] = []
  for (let i = 0; i < count; i++) {
    if (i % 2 === 0) {
      messages.push(new HumanMessage(`User message ${i}: What is the Q3 revenue?`))
    } else {
      messages.push(new AIMessage(`Assistant response ${i}: The Q3 revenue was $5.2M.`))
    }
  }
  return messages
}

/**
 * Create test messages with M&A-specific content
 */
export function createFinancialMessages(): BaseMessage[] {
  return [
    new HumanMessage('What is the Q3 revenue?'),
    new AIMessage('The Q3 revenue was $5.2 million.'),
    new HumanMessage('What about EBITDA margins?'),
    new AIMessage('EBITDA margins were 22% in Q3.'),
    new HumanMessage('How many employees?'),
    new AIMessage('The company has 150 employees.'),
    new HumanMessage("Wait, I think Q3 revenue was actually $5.5M not $5.2M"),
    new AIMessage("You're right, I'll correct that. Q3 revenue was $5.5M."),
  ]
}

/**
 * Create messages that include tool calls (for isolation testing)
 */
export function createMessagesWithToolCalls(): BaseMessage[] {
  return [
    new HumanMessage('Query the knowledge base for revenue information'),
    new AIMessage({
      content: 'I found the following from the knowledge base:',
      additional_kwargs: {
        tool_calls: [
          {
            id: 'tc-001',
            type: 'function',
            function: {
              name: 'query_knowledge_base',
              arguments: JSON.stringify({ query: 'Q3 revenue', filters: { dealId: TEST_DEAL.id } }),
            },
          },
        ],
      },
    }),
    new HumanMessage('What about employee count?'),
    new AIMessage({
      content: 'Let me check the knowledge base for employee information.',
      additional_kwargs: {
        tool_calls: [
          {
            id: 'tc-002',
            type: 'function',
            function: {
              name: 'query_knowledge_base',
              arguments: JSON.stringify({ query: 'employee count', filters: { dealId: TEST_DEAL.id } }),
            },
          },
        ],
      },
    }),
  ]
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Verify token savings from tool result isolation
 *
 * @param originalTokens - Token count before isolation
 * @param isolatedTokens - Token count after isolation
 * @param expectedSavingsPercent - Expected savings percentage (0-100)
 * @param tolerance - Tolerance for percentage comparison (default 5%)
 */
export function verifyTokenSavings(
  originalTokens: number,
  isolatedTokens: number,
  expectedSavingsPercent: number,
  tolerance = 5
): { passed: boolean; actualSavings: number; message: string } {
  const actualSavings = ((originalTokens - isolatedTokens) / originalTokens) * 100

  const passed = Math.abs(actualSavings - expectedSavingsPercent) <= tolerance

  return {
    passed,
    actualSavings,
    message: passed
      ? `Token savings ${actualSavings.toFixed(1)}% within expected range ${expectedSavingsPercent}% (±${tolerance}%)`
      : `Token savings ${actualSavings.toFixed(1)}% outside expected range ${expectedSavingsPercent}% (±${tolerance}%)`
  }
}

/**
 * Verify that summarization preserved recent messages
 *
 * @param originalMessages - Original message array
 * @param resultMessages - Result message array after summarization
 * @param expectedKeptCount - Number of messages expected to be kept verbatim
 */
export function verifySummarizationPreservedRecent(
  originalMessages: BaseMessage[],
  resultMessages: BaseMessage[],
  expectedKeptCount = 10
): { passed: boolean; message: string } {
  // First message should be system message with summary
  const firstResult = resultMessages[0]
  if (!firstResult || !(firstResult instanceof SystemMessage)) {
    return {
      passed: false,
      message: 'First message should be a SystemMessage containing the summary',
    }
  }

  // Remaining messages should match last N from original
  const keptMessages = resultMessages.slice(1)
  const originalLast = originalMessages.slice(-expectedKeptCount)

  if (keptMessages.length !== originalLast.length) {
    return {
      passed: false,
      message: `Expected ${expectedKeptCount} kept messages, got ${keptMessages.length}`,
    }
  }

  for (let i = 0; i < keptMessages.length; i++) {
    if (keptMessages[i]!.content !== originalLast[i]!.content) {
      return {
        passed: false,
        message: `Message at position ${i + 1} content mismatch`,
      }
    }
  }

  return {
    passed: true,
    message: `Successfully preserved last ${expectedKeptCount} messages`,
  }
}

// ============================================================================
// Mock Fetch Helper
// ============================================================================

/**
 * Create a mock fetch function for API testing
 *
 * @param responses - Map of URL patterns to response data
 */
export function createMockFetch(
  responses: Map<string, { ok: boolean; status: number; data: unknown }>
): typeof global.fetch {
  return vi.fn(async (url: string | URL | Request) => {
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url

    for (const [pattern, response] of responses) {
      if (urlStr.includes(pattern)) {
        return {
          ok: response.ok,
          status: response.status,
          json: async () => response.data,
          text: async () => JSON.stringify(response.data),
        } as Response
      }
    }

    // Default 404 for unmatched URLs
    return {
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
      text: async () => 'Not found',
    } as Response
  }) as typeof global.fetch
}

// ============================================================================
// Environment Check
// ============================================================================

/**
 * Check if integration tests should run based on environment
 */
export function shouldRunIntegrationTests(): boolean {
  return process.env.RUN_INTEGRATION_TESTS === 'true'
}

/**
 * Get required environment variables for integration tests
 */
export function getIntegrationTestEnv(): {
  graphitiUrl: string
  processingApiKey: string
  hasRequiredEnv: boolean
} {
  const graphitiUrl = process.env.GRAPHITI_API_URL || process.env.PROCESSING_API_URL || 'http://localhost:8000'
  const processingApiKey = process.env.PROCESSING_API_KEY || ''

  return {
    graphitiUrl,
    processingApiKey,
    hasRequiredEnv: !!processingApiKey || process.env.NODE_ENV === 'test',
  }
}
