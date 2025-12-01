/**
 * LLM Integration Tests (Manual)
 *
 * These tests verify actual API connectivity with real providers.
 * They are SKIPPED by default and should only be run manually before releases.
 *
 * Story: E5.1 - Integrate LLM via LangChain (AC: 3)
 *
 * To run these tests:
 * 1. Set required API keys in your environment:
 *    - ANTHROPIC_API_KEY
 *    - OPENAI_API_KEY
 *    - GOOGLE_AI_API_KEY
 * 2. Run with: npm run test:run -- __tests__/llm/integration.test.ts --run
 *
 * Note: These tests make real API calls and will incur costs.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { createLLMClientForProvider } from '@/lib/llm/client'
import { createTokenCountingHandler } from '@/lib/llm/callbacks'
import { HumanMessage } from '@langchain/core/messages'

// Skip all tests by default - only run manually
const SKIP_INTEGRATION_TESTS = process.env.RUN_INTEGRATION_TESTS !== 'true'

describe.skipIf(SKIP_INTEGRATION_TESTS)('LLM Integration Tests', () => {
  const testPrompt = 'Say "Hello" and nothing else.'

  describe('Anthropic (Claude) Integration', () => {
    beforeAll(() => {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is required for integration tests')
      }
    })

    it('connects to Anthropic API and receives response', async () => {
      const client = createLLMClientForProvider('anthropic', {
        model: 'claude-sonnet-4-5-20250929',
        maxTokens: 100,
      })

      const response = await client.invoke([new HumanMessage(testPrompt)])

      expect(response).toBeDefined()
      expect(response.content).toBeDefined()
      expect(typeof response.content).toBe('string')
      expect(response.content.toString().toLowerCase()).toContain('hello')
    }, 30000)

    it('tracks token usage with Anthropic', async () => {
      const handler = createTokenCountingHandler('anthropic', 'claude-sonnet-4-5-20250929')
      const client = createLLMClientForProvider('anthropic', {
        model: 'claude-sonnet-4-5-20250929',
        maxTokens: 100,
      })

      await client.invoke([new HumanMessage(testPrompt)], {
        callbacks: [handler],
      })

      const usage = handler.getTotalUsage()
      expect(usage.inputTokens).toBeGreaterThan(0)
      expect(usage.outputTokens).toBeGreaterThan(0)
      expect(usage.estimatedCostUSD).toBeGreaterThan(0)
    }, 30000)
  })

  describe('OpenAI (GPT) Integration', () => {
    beforeAll(() => {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is required for integration tests')
      }
    })

    it('connects to OpenAI API and receives response', async () => {
      const client = createLLMClientForProvider('openai', {
        model: 'gpt-4-turbo-preview',
        maxTokens: 100,
      })

      const response = await client.invoke([new HumanMessage(testPrompt)])

      expect(response).toBeDefined()
      expect(response.content).toBeDefined()
      expect(typeof response.content).toBe('string')
      expect(response.content.toString().toLowerCase()).toContain('hello')
    }, 30000)

    it('tracks token usage with OpenAI', async () => {
      const handler = createTokenCountingHandler('openai', 'gpt-4-turbo-preview')
      const client = createLLMClientForProvider('openai', {
        model: 'gpt-4-turbo-preview',
        maxTokens: 100,
      })

      await client.invoke([new HumanMessage(testPrompt)], {
        callbacks: [handler],
      })

      const usage = handler.getTotalUsage()
      expect(usage.inputTokens).toBeGreaterThan(0)
      expect(usage.outputTokens).toBeGreaterThan(0)
      expect(usage.estimatedCostUSD).toBeGreaterThan(0)
    }, 30000)
  })

  describe('Google (Gemini) Integration', () => {
    beforeAll(() => {
      if (!process.env.GOOGLE_AI_API_KEY) {
        throw new Error('GOOGLE_AI_API_KEY is required for integration tests')
      }
    })

    it('connects to Google AI API and receives response', async () => {
      const client = createLLMClientForProvider('google', {
        model: 'gemini-1.5-pro',
        maxTokens: 100,
      })

      const response = await client.invoke([new HumanMessage(testPrompt)])

      expect(response).toBeDefined()
      expect(response.content).toBeDefined()
      expect(typeof response.content).toBe('string')
      expect(response.content.toString().toLowerCase()).toContain('hello')
    }, 30000)

    it('tracks token usage with Google', async () => {
      const handler = createTokenCountingHandler('google', 'gemini-1.5-pro')
      const client = createLLMClientForProvider('google', {
        model: 'gemini-1.5-pro',
        maxTokens: 100,
      })

      await client.invoke([new HumanMessage(testPrompt)], {
        callbacks: [handler],
      })

      const usage = handler.getTotalUsage()
      expect(usage.inputTokens).toBeGreaterThan(0)
      expect(usage.outputTokens).toBeGreaterThan(0)
      expect(usage.estimatedCostUSD).toBeGreaterThan(0)
    }, 30000)
  })

  describe('Provider Switching', () => {
    it('can switch between providers at runtime', async () => {
      // This test requires all API keys to be set
      const providers = ['anthropic', 'openai', 'google'] as const
      const results: Record<string, string> = {}

      for (const provider of providers) {
        const client = createLLMClientForProvider(provider, {
          maxTokens: 50,
        })

        const response = await client.invoke([new HumanMessage(testPrompt)])
        results[provider] = response.content.toString()
      }

      // All providers should return a response containing "hello"
      expect(results.anthropic.toLowerCase()).toContain('hello')
      expect(results.openai.toLowerCase()).toContain('hello')
      expect(results.google.toLowerCase()).toContain('hello')
    }, 90000) // 30s per provider
  })
})

/**
 * Structured Output Integration Tests
 *
 * These test the withStructuredOutput functionality with real providers.
 */
describe.skipIf(SKIP_INTEGRATION_TESTS)('Structured Output Integration Tests', () => {
  describe('Anthropic Structured Output', () => {
    it('returns structured output with Anthropic', async () => {
      const { z } = await import('zod')
      const { withStructuredOutput } = await import('@/lib/llm/types')

      const TestSchema = z.object({
        greeting: z.string(),
        language: z.string(),
      })

      const client = createLLMClientForProvider('anthropic', {
        model: 'claude-sonnet-4-5-20250929',
        maxTokens: 100,
      })

      const structuredClient = withStructuredOutput(client, TestSchema)

      const response = await structuredClient.invoke(
        'Say hello in French and tell me what language it is. Respond with a greeting and language.'
      )

      expect(response).toBeDefined()
      expect(typeof response.greeting).toBe('string')
      expect(typeof response.language).toBe('string')
    }, 30000)
  })

  describe('OpenAI Structured Output', () => {
    it('returns structured output with OpenAI', async () => {
      const { z } = await import('zod')
      const { withStructuredOutput } = await import('@/lib/llm/types')

      const TestSchema = z.object({
        greeting: z.string(),
        language: z.string(),
      })

      const client = createLLMClientForProvider('openai', {
        model: 'gpt-4-turbo-preview',
        maxTokens: 100,
      })

      const structuredClient = withStructuredOutput(client, TestSchema)

      const response = await structuredClient.invoke(
        'Say hello in Spanish and tell me what language it is. Respond with a greeting and language.'
      )

      expect(response).toBeDefined()
      expect(typeof response.greeting).toBe('string')
      expect(typeof response.language).toBe('string')
    }, 30000)
  })
})
