/**
 * LLM Client Factory
 *
 * Model-agnostic LLM client wrapper supporting Anthropic, OpenAI, and Google providers.
 * Story: E5.1 - Integrate LLM via LangChain (Model-Agnostic)
 * Story: E13.3 - Model Selection Matrix (AC: #3)
 *
 * Features:
 * - Provider switching via environment or explicit config
 * - Unified BaseChatModel interface
 * - Built-in retry logic via LangChain
 * - Type-safe configuration validation
 * - Complexity-based model selection (E13.3)
 */

import { ChatAnthropic } from '@langchain/anthropic'
import { ChatOpenAI } from '@langchain/openai'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'

import {
  type LLMConfig,
  type LLMProvider,
  getLLMConfig,
  getAPIKey,
} from './config'
import { type ComplexityLevel } from '../agent/intent'
import {
  getEffectiveModelConfig,
  getFallbackConfig,
  formatModelSelection,
} from './routing'

/**
 * Creates an Anthropic (Claude) chat model
 */
function createAnthropicClient(config: LLMConfig): BaseChatModel {
  const apiKey = getAPIKey('anthropic')

  return new ChatAnthropic({
    anthropicApiKey: apiKey,
    modelName: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    maxRetries: config.retryAttempts,
  })
}

/**
 * Creates an OpenAI (GPT) chat model
 */
function createOpenAIClient(config: LLMConfig): BaseChatModel {
  const apiKey = getAPIKey('openai')

  return new ChatOpenAI({
    openAIApiKey: apiKey,
    modelName: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    maxRetries: config.retryAttempts,
    timeout: config.timeout,
  })
}

/**
 * Creates a Google (Gemini) chat model
 */
function createGoogleClient(config: LLMConfig): BaseChatModel {
  const apiKey = getAPIKey('google')

  return new ChatGoogleGenerativeAI({
    apiKey: apiKey,
    model: config.model,
    temperature: config.temperature,
    maxOutputTokens: config.maxTokens,
    maxRetries: config.retryAttempts,
  })
}

/**
 * Extended config options for createLLMClient
 * Story: E13.3 - Model Selection Matrix (AC: #3)
 */
export interface CreateLLMClientOptions extends Partial<LLMConfig> {
  /**
   * Query complexity for automatic model selection
   * When provided, model/provider/settings are selected from MODEL_ROUTING_CONFIG
   * Explicit config values override complexity-derived values
   */
  complexity?: ComplexityLevel
}

/**
 * Factory function to create an LLM client based on configuration
 * Story: E5.1 - Integrate LLM via LangChain (Model-Agnostic)
 * Story: E13.3 - Model Selection Matrix (AC: #3)
 *
 * @param options - Optional configuration or complexity-based selection
 * @returns A LangChain BaseChatModel instance
 * @throws Error if provider is invalid or API key is missing
 *
 * @example
 * ```typescript
 * // Using environment variables (default)
 * const llm = createLLMClient()
 *
 * // Explicit configuration
 * const llm = createLLMClient({
 *   provider: 'anthropic',
 *   model: 'claude-sonnet-4-5-20250929',
 *   temperature: 0.7,
 *   maxTokens: 4096,
 *   retryAttempts: 3,
 *   timeout: 30000,
 * })
 *
 * // E13.3: Complexity-based model selection
 * const llm = createLLMClient({ complexity: 'simple' })
 * // Creates gemini-2.0-flash-lite client
 *
 * // Basic usage
 * const response = await llm.invoke('Hello!')
 * ```
 */
export function createLLMClient(options?: CreateLLMClientOptions): BaseChatModel {
  let finalConfig: LLMConfig

  if (options?.complexity) {
    // E13.3: Use complexity-based model selection
    // getEffectiveModelConfig handles API key availability checks
    const routingConfig = getEffectiveModelConfig(options.complexity)

    // Allow explicit overrides on top of routing config
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { complexity, ...explicitConfig } = options
    finalConfig = { ...routingConfig, ...explicitConfig }

    console.log(`[LLM Client] ${formatModelSelection(finalConfig, options.complexity)}`)
  } else {
    // Original behavior: environment-based config with optional overrides
    const envConfig = getLLMConfig()
    finalConfig = options ? { ...envConfig, ...options } : envConfig
  }

  // Create provider-specific client
  switch (finalConfig.provider) {
    case 'anthropic':
      return createAnthropicClient(finalConfig)
    case 'openai':
      return createOpenAIClient(finalConfig)
    case 'google':
      return createGoogleClient(finalConfig)
    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = finalConfig.provider
      throw new Error(`Unknown LLM provider: ${_exhaustive}`)
  }
}

/**
 * Creates an LLM client with a specific provider override
 *
 * @param provider - The provider to use
 * @param overrides - Optional config overrides
 */
export function createLLMClientForProvider(
  provider: LLMProvider,
  overrides?: Partial<Omit<LLMConfig, 'provider'>>
): BaseChatModel {
  return createLLMClient({
    provider,
    ...overrides,
  })
}

/**
 * Type for the unified LLM client
 * This allows consumers to work with any provider interchangeably
 */
export type LLMClient = BaseChatModel

/**
 * Create LLM client with automatic fallback.
 * Story: E12.6 - Uses LangChain's built-in FallbackLLM for model switching.
 * Story: E13.3 - Model Selection Matrix (AC: #3) - Complexity-aware fallback chain.
 *
 * Fallback behavior:
 * - Without complexity: Claude → Gemini Pro (original E12.6 behavior)
 * - With complexity: Tier model → getFallbackConfig(tier) model
 *   - Simple (Flash Lite) → Medium (Gemini Pro)
 *   - Medium (Gemini Pro) → Complex (Claude Sonnet)
 *   - Complex (Claude Sonnet) → Medium (Gemini Pro)
 *
 * Note: Returns a Runnable that can be used like BaseChatModel.
 * The withFallbacks wrapper handles 429/503 errors automatically.
 */
export function createLLMClientWithFallback(options?: CreateLLMClientOptions) {
  // Create primary LLM using complexity-aware routing
  const primaryLLM = createLLMClient(options)

  // Determine fallback config based on complexity
  let fallbackConfig: LLMConfig

  if (options?.complexity) {
    // E13.3: Use tier-aware fallback chain
    const primaryConfig = getEffectiveModelConfig(options.complexity)
    fallbackConfig = getFallbackConfig(options.complexity)
    console.log(`[LLM Client] Fallback chain: ${primaryConfig.model} → ${fallbackConfig.model}`)
  } else {
    // Original E12.6 behavior: fallback to Gemini Pro
    const envConfig = getLLMConfig()
    fallbackConfig = {
      ...envConfig,
      provider: 'google',
      model: 'gemini-2.5-pro',
    }
  }

  // Check if fallback provider API key is available
  const fallbackKeyAvailable =
    (fallbackConfig.provider === 'google' && process.env.GOOGLE_AI_API_KEY) ||
    (fallbackConfig.provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) ||
    (fallbackConfig.provider === 'openai' && process.env.OPENAI_API_KEY)

  if (!fallbackKeyAvailable) {
    console.warn(`[LLM Client] Fallback provider ${fallbackConfig.provider} API key not available`)
    return primaryLLM
  }

  // Create fallback LLM
  let fallbackLLM: BaseChatModel

  switch (fallbackConfig.provider) {
    case 'google':
      fallbackLLM = new ChatGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_AI_API_KEY!,
        model: fallbackConfig.model,
        temperature: fallbackConfig.temperature,
        maxOutputTokens: fallbackConfig.maxTokens,
        maxRetries: fallbackConfig.retryAttempts,
      })
      break
    case 'anthropic':
      fallbackLLM = new ChatAnthropic({
        anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
        modelName: fallbackConfig.model,
        temperature: fallbackConfig.temperature,
        maxTokens: fallbackConfig.maxTokens,
        maxRetries: fallbackConfig.retryAttempts,
      })
      break
    case 'openai':
      fallbackLLM = new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY!,
        modelName: fallbackConfig.model,
        temperature: fallbackConfig.temperature,
        maxTokens: fallbackConfig.maxTokens,
        maxRetries: fallbackConfig.retryAttempts,
      })
      break
  }

  // LangChain's withFallbacks handles 429, 503, and connection errors automatically
  return primaryLLM.withFallbacks({
    fallbacks: [fallbackLLM],
  })
}

/**
 * Re-export types for convenience
 */
export type { LLMConfig, LLMProvider }
