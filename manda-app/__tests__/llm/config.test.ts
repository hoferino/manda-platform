/**
 * LLM Configuration Tests
 *
 * Tests for config.ts - environment-based LLM configuration
 * Story: E5.1 - Integrate LLM via LangChain (AC: 1, 6)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getLLMProvider,
  getLLMModel,
  getAPIKey,
  getLLMConfig,
  isLangSmithEnabled,
  getLangSmithConfig,
  DEFAULT_MODELS,
  TOKEN_COSTS,
  DEFAULT_CONFIG,
  CONSTANTS,
} from '@/lib/llm/config'

describe('LLM Configuration', () => {
  // Store original env vars
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Reset environment before each test
    vi.resetModules()
    // Clear relevant env vars
    delete process.env.LLM_PROVIDER
    delete process.env.LLM_MODEL
    delete process.env.LLM_TEMPERATURE
    delete process.env.LLM_MAX_TOKENS
    delete process.env.LLM_RETRY_ATTEMPTS
    delete process.env.LLM_TIMEOUT
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.GOOGLE_AI_API_KEY
    delete process.env.LANGCHAIN_TRACING_V2
    delete process.env.LANGCHAIN_API_KEY
    delete process.env.LANGCHAIN_PROJECT
  })

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv }
  })

  describe('getLLMProvider', () => {
    it('returns anthropic as default when LLM_PROVIDER is not set', () => {
      const provider = getLLMProvider()
      expect(provider).toBe('anthropic')
    })

    it('returns anthropic when LLM_PROVIDER is set to anthropic', () => {
      process.env.LLM_PROVIDER = 'anthropic'
      const provider = getLLMProvider()
      expect(provider).toBe('anthropic')
    })

    it('returns openai when LLM_PROVIDER is set to openai', () => {
      process.env.LLM_PROVIDER = 'openai'
      const provider = getLLMProvider()
      expect(provider).toBe('openai')
    })

    it('returns google when LLM_PROVIDER is set to google', () => {
      process.env.LLM_PROVIDER = 'google'
      const provider = getLLMProvider()
      expect(provider).toBe('google')
    })

    it('is case-insensitive', () => {
      process.env.LLM_PROVIDER = 'ANTHROPIC'
      const provider = getLLMProvider()
      expect(provider).toBe('anthropic')
    })

    it('throws error for invalid provider', () => {
      process.env.LLM_PROVIDER = 'invalid'
      expect(() => getLLMProvider()).toThrow(
        'Invalid LLM_PROVIDER: "invalid". Must be one of: anthropic, openai, google'
      )
    })
  })

  describe('getLLMModel', () => {
    it('returns custom model when LLM_MODEL is set', () => {
      process.env.LLM_MODEL = 'custom-model-123'
      const model = getLLMModel('anthropic')
      expect(model).toBe('custom-model-123')
    })

    it('returns default Anthropic model when not set', () => {
      const model = getLLMModel('anthropic')
      expect(model).toBe(DEFAULT_MODELS.anthropic)
    })

    it('returns default OpenAI model when not set', () => {
      const model = getLLMModel('openai')
      expect(model).toBe(DEFAULT_MODELS.openai)
    })

    it('returns default Google model when not set', () => {
      const model = getLLMModel('google')
      expect(model).toBe(DEFAULT_MODELS.google)
    })
  })

  describe('getAPIKey', () => {
    it('returns ANTHROPIC_API_KEY for anthropic provider', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key'
      const apiKey = getAPIKey('anthropic')
      expect(apiKey).toBe('sk-ant-test-key')
    })

    it('returns OPENAI_API_KEY for openai provider', () => {
      process.env.OPENAI_API_KEY = 'sk-openai-test-key'
      const apiKey = getAPIKey('openai')
      expect(apiKey).toBe('sk-openai-test-key')
    })

    it('returns GOOGLE_AI_API_KEY for google provider', () => {
      process.env.GOOGLE_AI_API_KEY = 'google-test-key'
      const apiKey = getAPIKey('google')
      expect(apiKey).toBe('google-test-key')
    })

    it('throws error when ANTHROPIC_API_KEY is missing', () => {
      expect(() => getAPIKey('anthropic')).toThrow(
        'ANTHROPIC_API_KEY environment variable is not set. Required for provider: anthropic'
      )
    })

    it('throws error when OPENAI_API_KEY is missing', () => {
      expect(() => getAPIKey('openai')).toThrow(
        'OPENAI_API_KEY environment variable is not set. Required for provider: openai'
      )
    })

    it('throws error when GOOGLE_AI_API_KEY is missing', () => {
      expect(() => getAPIKey('google')).toThrow(
        'GOOGLE_AI_API_KEY environment variable is not set. Required for provider: google'
      )
    })
  })

  describe('getLLMConfig', () => {
    it('returns default configuration when no env vars are set', () => {
      const config = getLLMConfig()
      expect(config).toEqual({
        provider: 'anthropic',
        model: DEFAULT_MODELS.anthropic,
        temperature: DEFAULT_CONFIG.temperature,
        maxTokens: DEFAULT_CONFIG.maxTokens,
        retryAttempts: DEFAULT_CONFIG.retryAttempts,
        timeout: DEFAULT_CONFIG.timeout,
      })
    })

    it('reads configuration from environment variables', () => {
      process.env.LLM_PROVIDER = 'openai'
      process.env.LLM_MODEL = 'gpt-4o'
      process.env.LLM_TEMPERATURE = '0.5'
      process.env.LLM_MAX_TOKENS = '2048'
      process.env.LLM_RETRY_ATTEMPTS = '5'
      process.env.LLM_TIMEOUT = '60000'

      const config = getLLMConfig()
      expect(config).toEqual({
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.5,
        maxTokens: 2048,
        retryAttempts: 5,
        timeout: 60000,
      })
    })

    it('throws error for invalid temperature', () => {
      process.env.LLM_TEMPERATURE = '3.0'
      expect(() => getLLMConfig()).toThrow('Invalid LLM configuration')
    })

    it('throws error for negative maxTokens', () => {
      process.env.LLM_MAX_TOKENS = '-100'
      expect(() => getLLMConfig()).toThrow('Invalid LLM configuration')
    })
  })

  describe('LangSmith Configuration', () => {
    it('returns false when LANGCHAIN_TRACING_V2 is not set', () => {
      expect(isLangSmithEnabled()).toBe(false)
    })

    it('returns false when LANGCHAIN_API_KEY is missing', () => {
      process.env.LANGCHAIN_TRACING_V2 = 'true'
      expect(isLangSmithEnabled()).toBe(false)
    })

    it('returns true when both LANGCHAIN_TRACING_V2 and LANGCHAIN_API_KEY are set', () => {
      process.env.LANGCHAIN_TRACING_V2 = 'true'
      process.env.LANGCHAIN_API_KEY = 'ls-test-key'
      expect(isLangSmithEnabled()).toBe(true)
    })

    it('returns correct config when enabled', () => {
      process.env.LANGCHAIN_TRACING_V2 = 'true'
      process.env.LANGCHAIN_API_KEY = 'ls-test-key'
      process.env.LANGCHAIN_PROJECT = 'test-project'

      const config = getLangSmithConfig()
      expect(config).toEqual({
        tracingEnabled: true,
        apiKey: 'ls-test-key',
        project: 'test-project',
      })
    })

    it('returns default project name when not set', () => {
      process.env.LANGCHAIN_TRACING_V2 = 'true'
      process.env.LANGCHAIN_API_KEY = 'ls-test-key'

      const config = getLangSmithConfig()
      expect(config.project).toBe('manda-chat')
    })
  })

  describe('Constants Export', () => {
    it('exports DEFAULT_MODELS', () => {
      expect(DEFAULT_MODELS).toBeDefined()
      expect(DEFAULT_MODELS.anthropic).toBe('claude-sonnet-4-5-20250929')
      expect(DEFAULT_MODELS.openai).toBe('gpt-4-turbo-preview')
      expect(DEFAULT_MODELS.google).toBe('gemini-1.5-pro')
    })

    it('exports TOKEN_COSTS', () => {
      expect(TOKEN_COSTS).toBeDefined()
      expect(TOKEN_COSTS.anthropic).toHaveProperty('input')
      expect(TOKEN_COSTS.anthropic).toHaveProperty('output')
      expect(TOKEN_COSTS.openai).toHaveProperty('input')
      expect(TOKEN_COSTS.google).toHaveProperty('input')
    })

    it('exports DEFAULT_CONFIG', () => {
      expect(DEFAULT_CONFIG).toBeDefined()
      expect(DEFAULT_CONFIG.temperature).toBe(0.7)
      expect(DEFAULT_CONFIG.maxTokens).toBe(4096)
      expect(DEFAULT_CONFIG.retryAttempts).toBe(3)
      expect(DEFAULT_CONFIG.timeout).toBe(30000)
    })

    it('exports CONSTANTS object', () => {
      expect(CONSTANTS).toBeDefined()
      expect(CONSTANTS.DEFAULT_MODELS).toEqual(DEFAULT_MODELS)
      expect(CONSTANTS.TOKEN_COSTS).toEqual(TOKEN_COSTS)
      expect(CONSTANTS.DEFAULT_CONFIG).toEqual(DEFAULT_CONFIG)
    })
  })
})
