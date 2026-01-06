/**
 * LLM Configuration
 *
 * Environment-based provider configuration for model-agnostic LLM integration.
 * Story: E5.1 - Integrate LLM via LangChain (Model-Agnostic)
 *
 * Supported providers: Anthropic (Claude), OpenAI (GPT), Google (Gemini)
 * Default: Claude Sonnet 4.5 per tech spec
 */

import { z } from 'zod'

/**
 * Supported LLM providers
 */
export type LLMProvider = 'anthropic' | 'openai' | 'google'

/**
 * LLM configuration schema with validation
 */
export const LLMConfigSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'google']),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().positive().default(4096),
  retryAttempts: z.number().int().min(0).max(10).default(3),
  timeout: z.number().int().positive().default(30000), // 30s default
})

export type LLMConfig = z.infer<typeof LLMConfigSchema>

/**
 * Default model configurations per provider
 * Updated to align with MODEL_BY_COMPLEXITY in intent.ts (E13.3)
 */
export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  google: 'gemini-2.5-pro',
}

/**
 * Cost per 1M tokens (input/output) for cost tracking
 * Prices as of Dec 2024 - update as needed
 */
export const TOKEN_COSTS: Record<LLMProvider, { input: number; output: number }> = {
  anthropic: { input: 3.00, output: 15.00 },   // Claude Sonnet
  openai: { input: 10.00, output: 30.00 },     // GPT-4 Turbo
  google: { input: 1.25, output: 5.00 },       // Gemini 1.5 Pro
}

/**
 * Cost per 1M tokens (input/output) by specific model
 * Story: E13.3 - Model Selection Matrix (AC: #5)
 * Prices verified Jan 2026
 */
export const TOKEN_COSTS_BY_MODEL: Record<string, { input: number; output: number }> = {
  // Anthropic - Claude 4 family
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-sonnet-4-5-20250929': { input: 3.00, output: 15.00 },

  // Google - Gemini family
  'gemini-2.0-flash-lite': { input: 0.075, output: 0.30 },  // ~40x cheaper than Pro
  'gemini-2.5-flash-lite': { input: 0.10, output: 0.40 },
  'gemini-2.5-pro': { input: 1.25, output: 10.00 },  // Note: output is $10, not $5
  'gemini-2.5-flash': { input: 0.30, output: 1.20 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },

  // OpenAI (for reference)
  'gpt-4-turbo-preview': { input: 10.00, output: 30.00 },
  'gpt-4o': { input: 2.50, output: 10.00 },
}

/**
 * Get token costs for a specific model
 * Story: E13.3 - Model Selection Matrix (AC: #5)
 *
 * Falls back to gemini-2.5-pro pricing if model not found
 *
 * @param model - Model identifier string
 * @returns Token cost rates per 1M tokens
 *
 * @example
 * ```typescript
 * const costs = getTokenCosts('gemini-2.0-flash-lite')
 * // { input: 0.075, output: 0.30 }
 *
 * const inputCost = (tokens / 1_000_000) * costs.input
 * ```
 */
export function getTokenCosts(model: string): { input: number; output: number } {
  const costs = TOKEN_COSTS_BY_MODEL[model]
  if (costs) return costs
  // Fallback to gemini-2.5-pro pricing
  return { input: 1.25, output: 10.00 }
}

/**
 * Calculate estimated cost for a given model and token usage
 * Story: E13.3 - Model Selection Matrix (AC: #5)
 *
 * @param model - Model identifier string
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Total estimated cost in USD
 *
 * @example
 * ```typescript
 * const cost = calculateModelCost('gemini-2.0-flash-lite', 1000, 100)
 * // ~$0.000105
 * ```
 */
export function calculateModelCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const costs = getTokenCosts(model)
  return (inputTokens / 1_000_000) * costs.input + (outputTokens / 1_000_000) * costs.output
}

/**
 * Default configuration values per tech spec
 */
export const DEFAULT_CONFIG: Omit<LLMConfig, 'provider' | 'model'> = {
  temperature: 0.7,
  maxTokens: 4096,
  retryAttempts: 3,
  timeout: 30000,
}

/**
 * Validates and returns the LLM provider from environment
 *
 * @throws Error if LLM_PROVIDER is invalid
 */
export function getLLMProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER?.toLowerCase()

  if (!provider) {
    // Default to Anthropic per tech spec
    return 'anthropic'
  }

  if (provider !== 'anthropic' && provider !== 'openai' && provider !== 'google') {
    throw new Error(
      `Invalid LLM_PROVIDER: "${provider}". Must be one of: anthropic, openai, google`
    )
  }

  return provider
}

/**
 * Gets the model name from environment or provider default
 */
export function getLLMModel(provider: LLMProvider): string {
  const model = process.env.LLM_MODEL

  if (model) {
    return model
  }

  return DEFAULT_MODELS[provider]
}

/**
 * Gets the API key for the specified provider
 *
 * @throws Error if the required API key is not set
 */
export function getAPIKey(provider: LLMProvider): string {
  const keyMap: Record<LLMProvider, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    google: 'GOOGLE_AI_API_KEY',
  }

  const envVar = keyMap[provider]
  const apiKey = process.env[envVar]

  if (!apiKey) {
    throw new Error(
      `${envVar} environment variable is not set. Required for provider: ${provider}`
    )
  }

  return apiKey
}

/**
 * Builds a complete LLM configuration from environment variables
 *
 * Environment variables:
 * - LLM_PROVIDER: 'anthropic' | 'openai' | 'google' (default: anthropic)
 * - LLM_MODEL: Model name (default: provider-specific default)
 * - LLM_TEMPERATURE: Temperature 0-2 (default: 0.7)
 * - LLM_MAX_TOKENS: Max tokens (default: 4096)
 * - LLM_RETRY_ATTEMPTS: Number of retries (default: 3)
 * - LLM_TIMEOUT: Timeout in ms (default: 30000)
 *
 * @returns Validated LLM configuration
 * @throws Error if configuration is invalid
 */
export function getLLMConfig(): LLMConfig {
  const provider = getLLMProvider()
  const model = getLLMModel(provider)

  const rawConfig = {
    provider,
    model,
    temperature: process.env.LLM_TEMPERATURE
      ? parseFloat(process.env.LLM_TEMPERATURE)
      : DEFAULT_CONFIG.temperature,
    maxTokens: process.env.LLM_MAX_TOKENS
      ? parseInt(process.env.LLM_MAX_TOKENS, 10)
      : DEFAULT_CONFIG.maxTokens,
    retryAttempts: process.env.LLM_RETRY_ATTEMPTS
      ? parseInt(process.env.LLM_RETRY_ATTEMPTS, 10)
      : DEFAULT_CONFIG.retryAttempts,
    timeout: process.env.LLM_TIMEOUT
      ? parseInt(process.env.LLM_TIMEOUT, 10)
      : DEFAULT_CONFIG.timeout,
  }

  // Validate with Zod
  const result = LLMConfigSchema.safeParse(rawConfig)

  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `${String(e.path.join('.'))}: ${e.message}`)
      .join(', ')
    throw new Error(`Invalid LLM configuration: ${errors}`)
  }

  return result.data
}

/**
 * Checks if optional LangSmith tracing is enabled
 */
export function isLangSmithEnabled(): boolean {
  return (
    process.env.LANGCHAIN_TRACING_V2 === 'true' &&
    !!process.env.LANGCHAIN_API_KEY
  )
}

/**
 * Gets LangSmith configuration if enabled
 */
export function getLangSmithConfig(): {
  tracingEnabled: boolean
  apiKey?: string
  project?: string
} {
  if (!isLangSmithEnabled()) {
    return { tracingEnabled: false }
  }

  return {
    tracingEnabled: true,
    apiKey: process.env.LANGCHAIN_API_KEY,
    project: process.env.LANGCHAIN_PROJECT || 'manda-chat',
  }
}

/**
 * Export constants for testing
 */
export const CONSTANTS = {
  DEFAULT_MODELS,
  TOKEN_COSTS,
  DEFAULT_CONFIG,
}
