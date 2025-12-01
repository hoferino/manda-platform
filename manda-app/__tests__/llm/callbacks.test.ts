/**
 * LLM Callback Handler Tests
 *
 * Tests for callbacks.ts - token counting and cost tracking
 * Story: E5.1 - Integrate LLM via LangChain (AC: 4)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  calculateCost,
  TokenCountingHandler,
  LoggingHandler,
  createTokenCountingHandler,
  createLoggingHandler,
  createStandardCallbacks,
} from '@/lib/llm/callbacks'
import { TOKEN_COSTS } from '@/lib/llm/config'

describe('Cost Calculation', () => {
  describe('calculateCost', () => {
    it('calculates cost for Anthropic (Claude)', () => {
      const cost = calculateCost('anthropic', 1000, 500)
      // Input: 1000 tokens * $3.00 / 1M = $0.003
      // Output: 500 tokens * $15.00 / 1M = $0.0075
      // Total: $0.0105
      expect(cost).toBeCloseTo(0.0105, 4)
    })

    it('calculates cost for OpenAI (GPT)', () => {
      const cost = calculateCost('openai', 1000, 500)
      // Input: 1000 tokens * $10.00 / 1M = $0.01
      // Output: 500 tokens * $30.00 / 1M = $0.015
      // Total: $0.025
      expect(cost).toBeCloseTo(0.025, 4)
    })

    it('calculates cost for Google (Gemini)', () => {
      const cost = calculateCost('google', 1000, 500)
      // Input: 1000 tokens * $1.25 / 1M = $0.00125
      // Output: 500 tokens * $5.00 / 1M = $0.0025
      // Total: $0.00375
      expect(cost).toBeCloseTo(0.00375, 5)
    })

    it('returns 0 for zero tokens', () => {
      const cost = calculateCost('anthropic', 0, 0)
      expect(cost).toBe(0)
    })

    it('handles large token counts', () => {
      // 1 million tokens
      const cost = calculateCost('anthropic', 1000000, 1000000)
      // Input: $3.00 + Output: $15.00 = $18.00
      expect(cost).toBeCloseTo(18.0, 2)
    })
  })
})

describe('TokenCountingHandler', () => {
  let handler: TokenCountingHandler
  const mockLLM = { id: ['langchain', 'chat', 'anthropic'] }

  beforeEach(() => {
    handler = new TokenCountingHandler('anthropic', 'claude-sonnet-4-5-20250929')
  })

  it('has correct name', () => {
    expect(handler.name).toBe('TokenCountingHandler')
  })

  it('starts with zero total usage', () => {
    const usage = handler.getTotalUsage()
    expect(usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCostUSD: 0,
    })
  })

  it('creates request metadata on handleLLMStart', async () => {
    await handler.handleLLMStart(mockLLM, ['test prompt'], 'run-123')

    const request = handler.getLastRequest()
    expect(request).toBeDefined()
    expect(request?.provider).toBe('anthropic')
    expect(request?.model).toBe('claude-sonnet-4-5-20250929')
    expect(request?.requestId).toMatch(/^llm_\d+_[a-z0-9]+$/)
    expect(request?.startTime).toBeDefined()
  })

  it('tracks token usage on handleLLMEnd', async () => {
    await handler.handleLLMStart(mockLLM, ['test'], 'run-123')

    await handler.handleLLMEnd(
      {
        generations: [[{ text: 'response' }]],
        llmOutput: {
          tokenUsage: {
            promptTokens: 100,
            completionTokens: 50,
          },
        },
      },
      'run-123'
    )

    const usage = handler.getTotalUsage()
    expect(usage.inputTokens).toBe(100)
    expect(usage.outputTokens).toBe(50)
    expect(usage.totalTokens).toBe(150)
    expect(usage.estimatedCostUSD).toBeGreaterThan(0)
  })

  it('handles alternative token usage formats', async () => {
    await handler.handleLLMStart(mockLLM, ['test'], 'run-123')

    // OpenAI format
    await handler.handleLLMEnd(
      {
        generations: [[{ text: 'response' }]],
        llmOutput: {
          usage: {
            prompt_tokens: 200,
            completion_tokens: 100,
          },
        },
      },
      'run-123'
    )

    const usage = handler.getTotalUsage()
    expect(usage.inputTokens).toBe(200)
    expect(usage.outputTokens).toBe(100)
  })

  it('accumulates usage across multiple requests', async () => {
    // First request
    await handler.handleLLMStart(mockLLM, ['test'], 'run-1')
    await handler.handleLLMEnd(
      {
        generations: [[{ text: 'response' }]],
        llmOutput: { tokenUsage: { promptTokens: 100, completionTokens: 50 } },
      },
      'run-1'
    )

    // Second request
    await handler.handleLLMStart(mockLLM, ['test'], 'run-2')
    await handler.handleLLMEnd(
      {
        generations: [[{ text: 'response' }]],
        llmOutput: { tokenUsage: { promptTokens: 200, completionTokens: 100 } },
      },
      'run-2'
    )

    const usage = handler.getTotalUsage()
    expect(usage.inputTokens).toBe(300)
    expect(usage.outputTokens).toBe(150)
    expect(usage.totalTokens).toBe(450)
  })

  it('records error on handleLLMError', async () => {
    await handler.handleLLMStart(mockLLM, ['test'], 'run-123')
    await handler.handleLLMError(new Error('API timeout'), 'run-123')

    const request = handler.getLastRequest()
    expect(request?.error).toBe('API timeout')
    expect(request?.endTime).toBeDefined()
    expect(request?.durationMs).toBeDefined()
  })

  it('resets usage data', async () => {
    await handler.handleLLMStart(mockLLM, ['test'], 'run-123')
    await handler.handleLLMEnd(
      {
        generations: [[{ text: 'response' }]],
        llmOutput: { tokenUsage: { promptTokens: 100, completionTokens: 50 } },
      },
      'run-123'
    )

    handler.reset()

    const usage = handler.getTotalUsage()
    expect(usage.totalTokens).toBe(0)
    expect(handler.getLastRequest()).toBeNull()
  })
})

describe('LoggingHandler', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>
  const mockLLM = { id: ['langchain', 'chat', 'openai'] }

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('has correct name', () => {
    const handler = new LoggingHandler()
    expect(handler.name).toBe('LoggingHandler')
  })

  it('does not log when verbose is false', async () => {
    const handler = new LoggingHandler(false)
    await handler.handleLLMStart(mockLLM, ['test'], 'run-123')

    expect(consoleSpy).not.toHaveBeenCalled()
  })

  it('logs when verbose is true', async () => {
    const handler = new LoggingHandler(true)
    await handler.handleLLMStart(mockLLM, ['test prompt'], 'run-123')

    expect(consoleSpy).toHaveBeenCalledTimes(1)
    const logArg = consoleSpy.mock.calls[0][0]
    const logData = JSON.parse(logArg)

    expect(logData.event).toBe('llm_start')
    expect(logData.runId).toBe('run-123')
  })

  it('logs retry events', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const handler = new LoggingHandler()

    handler.onRetry(new Error('rate limit'), 'run-123')

    expect(warnSpy).toHaveBeenCalled()
    const logArg = warnSpy.mock.calls[0][0]
    const logData = JSON.parse(logArg)

    expect(logData.event).toBe('llm_retry')
    expect(logData.error).toBe('rate limit')

    warnSpy.mockRestore()
  })
})

describe('Factory Functions', () => {
  it('createTokenCountingHandler creates handler with correct provider', () => {
    const handler = createTokenCountingHandler('openai', 'gpt-4')
    expect(handler).toBeInstanceOf(TokenCountingHandler)
    expect(handler.name).toBe('TokenCountingHandler')
  })

  it('createLoggingHandler creates handler with verbose option', () => {
    const handler = createLoggingHandler(true)
    expect(handler).toBeInstanceOf(LoggingHandler)
    expect(handler.name).toBe('LoggingHandler')
  })

  it('createStandardCallbacks returns array with token counting handler', () => {
    const callbacks = createStandardCallbacks('anthropic', 'claude-sonnet-4-5-20250929')
    expect(Array.isArray(callbacks)).toBe(true)
    expect(callbacks.length).toBeGreaterThan(0)
    expect(callbacks.some((cb) => cb.name === 'TokenCountingHandler')).toBe(true)
  })

  it('createStandardCallbacks includes logging handler when verbose', () => {
    const callbacks = createStandardCallbacks('anthropic', 'claude-sonnet-4-5-20250929', {
      verbose: true,
    })
    expect(callbacks.some((cb) => cb.name === 'LoggingHandler')).toBe(true)
  })
})
