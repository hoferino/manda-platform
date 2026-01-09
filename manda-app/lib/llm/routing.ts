/**
 * Model Routing Module
 *
 * Selects appropriate LLM model based on query complexity.
 * Story: E13.3 - Model Selection Matrix (AC: #1, #2, #3)
 *
 * Routing Strategy:
 * - Simple queries (greetings, single facts) → gemini-2.0-flash-lite (fast, cheap)
 * - Medium queries (summarization, comparisons) → gemini-2.5-pro (balanced)
 * - Complex queries (analysis, multi-doc) → claude-sonnet-4-20250514 (capable)
 *
 * Fallback Chain:
 * - Simple fails → Medium (Gemini Pro)
 * - Medium fails → Complex (Claude Sonnet)
 * - Complex fails → Medium (existing E12.6 behavior)
 */

import { type ComplexityLevel, MODEL_BY_COMPLEXITY } from '../agent/intent'
import type { LLMConfig, LLMProvider } from './config'

/**
 * Complete model configuration per complexity tier
 * Story: E13.3 - Model Selection Matrix (AC: #1)
 *
 * Each tier has optimized settings for its use case:
 * - Simple: Low temp, short responses, fast timeout
 * - Medium: Balanced settings
 * - Complex: Higher temp for creativity, longer responses, longer timeout
 */
// TEMPORARY: Using OpenAI for all tiers to test flow (Google GenAI bindTools issue)
export const MODEL_ROUTING_CONFIG: Record<ComplexityLevel, LLMConfig> = {
  simple: {
    provider: 'openai' as LLMProvider,
    model: 'gpt-4o-mini', // Cheap, fast, supports tools
    temperature: 0.3,
    maxTokens: 500,
    retryAttempts: 2,
    timeout: 5000,
  },
  medium: {
    provider: 'openai' as LLMProvider,
    model: 'gpt-4o-mini',
    temperature: 0.5,
    maxTokens: 2000,
    retryAttempts: 3,
    timeout: 30000,
  },
  complex: {
    provider: 'openai' as LLMProvider,
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 4096,
    retryAttempts: 3,
    timeout: 60000,
  },
}

/**
 * Select model configuration based on query complexity
 * Story: E13.3 - Model Selection Matrix (AC: #2)
 *
 * @param complexity - Complexity level from intent classification
 * @returns Full LLMConfig for the tier
 *
 * @example
 * ```typescript
 * const config = selectModelForComplexity('simple')
 * // { provider: 'google', model: 'gemini-2.0-flash-lite', ... }
 *
 * const defaultConfig = selectModelForComplexity(undefined)
 * // Returns 'complex' tier for backward compatibility
 * ```
 */
export function selectModelForComplexity(complexity?: ComplexityLevel): LLMConfig {
  // Default to complex for backward compatibility
  const tier = complexity ?? 'complex'
  const config = MODEL_ROUTING_CONFIG[tier]

  console.log(`[LLM Routing] Selected ${config.provider}:${config.model} for ${tier} tier`)

  return config
}

/**
 * Get fallback model for a given tier
 * Story: E13.3 - Model Selection Matrix (AC: #3)
 *
 * Fallback chain:
 * - Simple (Flash Lite) fails → Medium (Gemini Pro)
 * - Medium (Gemini Pro) fails → Complex (Claude Sonnet)
 * - Complex (Claude Sonnet) fails → Medium (Gemini Pro) - existing E12.6 behavior
 *
 * @param complexity - Current tier that failed
 * @returns Fallback LLMConfig
 *
 * @example
 * ```typescript
 * const fallback = getFallbackConfig('simple')
 * // Returns medium tier config (gemini-2.5-pro)
 * ```
 */
export function getFallbackConfig(complexity: ComplexityLevel): LLMConfig {
  switch (complexity) {
    case 'simple':
      // Flash Lite fails → try Gemini Pro
      return MODEL_ROUTING_CONFIG['medium']
    case 'medium':
      // Gemini Pro fails → try Claude Sonnet
      return MODEL_ROUTING_CONFIG['complex']
    case 'complex':
      // Claude Sonnet fails → fall back to Gemini Pro (existing E12.6 behavior)
      return MODEL_ROUTING_CONFIG['medium']
  }
}

/**
 * Check if Google API key is available
 * Used for graceful degradation when simple/medium tier requested but Google unavailable
 *
 * @returns true if GOOGLE_AI_API_KEY environment variable is set
 */
export function isGoogleAvailable(): boolean {
  return !!process.env.GOOGLE_AI_API_KEY
}

/**
 * Check if Anthropic API key is available
 *
 * @returns true if ANTHROPIC_API_KEY environment variable is set
 */
export function isAnthropicAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY
}

/**
 * Get effective model config, handling missing API keys
 * Story: E13.3 - Model Selection Matrix (AC: #3)
 *
 * If Google key missing and tier requires Google → fall back to Claude
 * If Anthropic key missing and tier requires Anthropic → fall back to Gemini
 *
 * @param complexity - Complexity level from intent classification
 * @returns LLMConfig with appropriate fallback if needed
 *
 * @example
 * ```typescript
 * // Google API key missing
 * delete process.env.GOOGLE_AI_API_KEY
 * const config = getEffectiveModelConfig('simple')
 * // Returns Claude config (falls back to complex tier)
 * ```
 */
export function getEffectiveModelConfig(complexity?: ComplexityLevel): LLMConfig {
  const tier = complexity ?? 'complex'
  const config = MODEL_ROUTING_CONFIG[tier]

  // If tier requires Google but Google API key is missing, fall back to Claude
  if (config.provider === 'google' && !isGoogleAvailable()) {
    console.warn(`[LLM Routing] Google API key missing, falling back to Claude for ${tier} tier`)
    return MODEL_ROUTING_CONFIG['complex']
  }

  // If tier requires Anthropic but Anthropic API key is missing, fall back to Gemini
  if (config.provider === 'anthropic' && !isAnthropicAvailable()) {
    console.warn(`[LLM Routing] Anthropic API key missing, falling back to Gemini for ${tier} tier`)
    return MODEL_ROUTING_CONFIG['medium']
  }

  return config
}

/**
 * Get the model tier name from a model string
 * Useful for logging and debugging
 *
 * @param model - Model identifier string
 * @returns Tier name or 'unknown' if not found
 */
export function getTierFromModel(model: string): ComplexityLevel | 'unknown' {
  for (const [tier, config] of Object.entries(MODEL_ROUTING_CONFIG)) {
    if (config.model === model) {
      return tier as ComplexityLevel
    }
  }
  return 'unknown'
}

/**
 * Format model selection for logging/tracing
 * Story: E13.3 - Model Selection Matrix (AC: #4)
 *
 * @param config - LLM configuration
 * @param complexity - Complexity level used for selection
 * @returns Formatted string for logging
 */
export function formatModelSelection(config: LLMConfig, complexity?: ComplexityLevel): string {
  return `${config.provider}:${config.model} (${complexity ?? 'default'} tier)`
}
