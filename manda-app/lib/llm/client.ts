/**
 * LLM Client Factory
 *
 * Model-agnostic LLM client wrapper supporting Anthropic, OpenAI, and Google providers.
 * Story: E5.1 - Integrate LLM via LangChain (Model-Agnostic)
 *
 * Features:
 * - Provider switching via environment or explicit config
 * - Unified BaseChatModel interface
 * - Built-in retry logic via LangChain
 * - Type-safe configuration validation
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
 * Factory function to create an LLM client based on configuration
 *
 * @param config - Optional explicit configuration. If not provided, reads from environment.
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
 * // Basic usage
 * const response = await llm.invoke('Hello!')
 * ```
 */
export function createLLMClient(config?: Partial<LLMConfig>): BaseChatModel {
  // Get base config from environment
  const envConfig = getLLMConfig()

  // Merge with explicit config if provided
  const finalConfig: LLMConfig = config
    ? { ...envConfig, ...config }
    : envConfig

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
 * Primary: Claude Sonnet -> Fallback: Gemini Pro on 429/503 errors.
 *
 * Note: Returns a Runnable that can be used like BaseChatModel.
 * The withFallbacks wrapper handles 429/503 errors automatically.
 */
export function createLLMClientWithFallback(config?: Partial<LLMConfig>) {
  const llmConfig = { ...getLLMConfig(), ...config }

  const primaryLLM = createLLMClient(llmConfig)

  // Only configure fallback if we have a fallback key
  if (!process.env.GOOGLE_AI_API_KEY) {
    return primaryLLM
  }

  const fallbackLLM = new ChatGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_AI_API_KEY,
    model: 'gemini-2.5-pro',
    temperature: llmConfig.temperature,
    maxOutputTokens: llmConfig.maxTokens,
    maxRetries: llmConfig.retryAttempts,
  })

  // LangChain's withFallbacks handles 429, 503, and connection errors automatically
  return primaryLLM.withFallbacks({
    fallbacks: [fallbackLLM],
  })
}

/**
 * Re-export types for convenience
 */
export type { LLMConfig, LLMProvider }
