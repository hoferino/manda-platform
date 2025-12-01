/**
 * LLM Client Factory Tests
 *
 * Tests for client.ts - LLM client factory with provider switching
 * Story: E5.1 - Integrate LLM via LangChain (AC: 1, 2, 6)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Store mock call information
let anthropicCalls: Record<string, unknown>[] = []
let openaiCalls: Record<string, unknown>[] = []
let googleCalls: Record<string, unknown>[] = []

// Mock the LangChain providers with proper class constructors
vi.mock('@langchain/anthropic', () => {
  return {
    ChatAnthropic: vi.fn().mockImplementation(function(this: unknown, config: Record<string, unknown>) {
      anthropicCalls.push(config)
      return {
        _type: 'anthropic',
        config,
        invoke: vi.fn().mockResolvedValue({ content: 'mocked response' }),
      }
    }),
  }
})

vi.mock('@langchain/openai', () => {
  return {
    ChatOpenAI: vi.fn().mockImplementation(function(this: unknown, config: Record<string, unknown>) {
      openaiCalls.push(config)
      return {
        _type: 'openai',
        config,
        invoke: vi.fn().mockResolvedValue({ content: 'mocked response' }),
      }
    }),
  }
})

vi.mock('@langchain/google-genai', () => {
  return {
    ChatGoogleGenerativeAI: vi.fn().mockImplementation(function(this: unknown, config: Record<string, unknown>) {
      googleCalls.push(config)
      return {
        _type: 'google',
        config,
        invoke: vi.fn().mockResolvedValue({ content: 'mocked response' }),
      }
    }),
  }
})

// Import mocked modules
import { ChatAnthropic } from '@langchain/anthropic'
import { ChatOpenAI } from '@langchain/openai'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'

// Import after mocks are set up
import {
  createLLMClient,
  createLLMClientForProvider,
} from '@/lib/llm/client'
import { DEFAULT_MODELS, DEFAULT_CONFIG } from '@/lib/llm/config'

describe('LLM Client Factory', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Clear call records
    anthropicCalls = []
    openaiCalls = []
    googleCalls = []
    vi.clearAllMocks()

    // Set default API keys for tests
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    process.env.OPENAI_API_KEY = 'sk-openai-test'
    process.env.GOOGLE_AI_API_KEY = 'google-test'
    // Clear provider env var
    delete process.env.LLM_PROVIDER
    delete process.env.LLM_MODEL
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  describe('createLLMClient', () => {
    it('creates Anthropic client by default', () => {
      const client = createLLMClient()

      expect(ChatAnthropic).toHaveBeenCalled()
      expect(client).toBeDefined()
    })

    it('creates OpenAI client when provider is openai', () => {
      process.env.LLM_PROVIDER = 'openai'
      const client = createLLMClient()

      expect(ChatOpenAI).toHaveBeenCalled()
      expect(client).toBeDefined()
    })

    it('creates Google client when provider is google', () => {
      process.env.LLM_PROVIDER = 'google'
      const client = createLLMClient()

      expect(ChatGoogleGenerativeAI).toHaveBeenCalled()
      expect(client).toBeDefined()
    })

    it('uses default model when not specified', () => {
      createLLMClient()

      expect(anthropicCalls.length).toBeGreaterThan(0)
      expect(anthropicCalls[0]).toMatchObject({
        modelName: DEFAULT_MODELS.anthropic,
      })
    })

    it('uses custom model from environment', () => {
      process.env.LLM_MODEL = 'claude-3-opus'
      createLLMClient()

      expect(anthropicCalls.length).toBeGreaterThan(0)
      expect(anthropicCalls[0]).toMatchObject({
        modelName: 'claude-3-opus',
      })
    })

    it('passes temperature to client', () => {
      createLLMClient()

      expect(anthropicCalls[0]).toMatchObject({
        temperature: DEFAULT_CONFIG.temperature,
      })
    })

    it('passes maxTokens to client', () => {
      createLLMClient()

      expect(anthropicCalls[0]).toMatchObject({
        maxTokens: DEFAULT_CONFIG.maxTokens,
      })
    })

    it('passes maxRetries to client', () => {
      createLLMClient()

      expect(anthropicCalls[0]).toMatchObject({
        maxRetries: DEFAULT_CONFIG.retryAttempts,
      })
    })

    it('accepts explicit configuration override', () => {
      createLLMClient({
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.5,
      })

      expect(openaiCalls.length).toBeGreaterThan(0)
      expect(openaiCalls[0]).toMatchObject({
        modelName: 'gpt-4o',
        temperature: 0.5,
      })
    })

    it('throws error when API key is missing', () => {
      delete process.env.ANTHROPIC_API_KEY
      expect(() => createLLMClient()).toThrow('ANTHROPIC_API_KEY')
    })
  })

  describe('createLLMClientForProvider', () => {
    it('creates client for specified provider', () => {
      createLLMClientForProvider('openai')

      expect(ChatOpenAI).toHaveBeenCalled()
    })

    it('accepts config overrides', () => {
      createLLMClientForProvider('openai', {
        model: 'gpt-4o-mini',
        temperature: 0.3,
      })

      expect(openaiCalls.length).toBeGreaterThan(0)
      expect(openaiCalls[0]).toMatchObject({
        modelName: 'gpt-4o-mini',
        temperature: 0.3,
      })
    })

    it('creates Google client with correct config', () => {
      createLLMClientForProvider('google', {
        model: 'gemini-2.0-flash',
      })

      expect(googleCalls.length).toBeGreaterThan(0)
      expect(googleCalls[0]).toMatchObject({
        model: 'gemini-2.0-flash',
      })
    })
  })

  describe('Provider-specific configuration', () => {
    it('passes timeout to OpenAI client', () => {
      process.env.LLM_PROVIDER = 'openai'
      createLLMClient()

      expect(openaiCalls.length).toBeGreaterThan(0)
      expect(openaiCalls[0]).toMatchObject({
        timeout: DEFAULT_CONFIG.timeout,
      })
    })

    it('passes maxOutputTokens to Google client', () => {
      process.env.LLM_PROVIDER = 'google'
      createLLMClient()

      expect(googleCalls.length).toBeGreaterThan(0)
      expect(googleCalls[0]).toMatchObject({
        maxOutputTokens: DEFAULT_CONFIG.maxTokens,
      })
    })
  })
})
