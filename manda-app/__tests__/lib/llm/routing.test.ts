/**
 * Model Routing Tests
 *
 * Story: E13.3 - Model Selection Matrix (AC: #6)
 *
 * Tests:
 * - Model selection returns correct config for each tier
 * - Backward compatibility (undefined complexity = default model)
 * - Fallback behavior when tier model unavailable
 * - API key missing scenarios
 * - Cost calculation accuracy
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  MODEL_ROUTING_CONFIG,
  selectModelForComplexity,
  getFallbackConfig,
  getEffectiveModelConfig,
  isGoogleAvailable,
  isAnthropicAvailable,
  getTierFromModel,
  formatModelSelection,
} from '@/lib/llm/routing'
import { getTokenCosts, calculateModelCost, TOKEN_COSTS_BY_MODEL } from '@/lib/llm/config'

describe('Model Routing', () => {
  // Save original env
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Reset env before each test
    vi.resetModules()
  })

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv }
  })

  describe('MODEL_ROUTING_CONFIG', () => {
    it('has correct config for simple tier', () => {
      const config = MODEL_ROUTING_CONFIG.simple
      expect(config.provider).toBe('google')
      expect(config.model).toBe('gemini-2.0-flash-lite')
      expect(config.temperature).toBe(0.3)
      expect(config.maxTokens).toBe(500)
      expect(config.timeout).toBe(5000)
      expect(config.retryAttempts).toBe(2)
    })

    it('has correct config for medium tier', () => {
      const config = MODEL_ROUTING_CONFIG.medium
      expect(config.provider).toBe('google')
      expect(config.model).toBe('gemini-2.5-pro')
      expect(config.temperature).toBe(0.5)
      expect(config.maxTokens).toBe(2000)
      expect(config.timeout).toBe(30000)
      expect(config.retryAttempts).toBe(3)
    })

    it('has correct config for complex tier', () => {
      const config = MODEL_ROUTING_CONFIG.complex
      expect(config.provider).toBe('anthropic')
      expect(config.model).toBe('claude-sonnet-4-20250514')
      expect(config.temperature).toBe(0.7)
      expect(config.maxTokens).toBe(4096)
      expect(config.timeout).toBe(60000)
      expect(config.retryAttempts).toBe(3)
    })
  })

  describe('selectModelForComplexity', () => {
    it('returns Gemini Flash Lite config for simple complexity', () => {
      const config = selectModelForComplexity('simple')
      expect(config.provider).toBe('google')
      expect(config.model).toBe('gemini-2.0-flash-lite')
      expect(config.maxTokens).toBe(500)
      expect(config.timeout).toBe(5000)
    })

    it('returns Gemini Pro config for medium complexity', () => {
      const config = selectModelForComplexity('medium')
      expect(config.provider).toBe('google')
      expect(config.model).toBe('gemini-2.5-pro')
      expect(config.maxTokens).toBe(2000)
    })

    it('returns Claude Sonnet config for complex complexity', () => {
      const config = selectModelForComplexity('complex')
      expect(config.provider).toBe('anthropic')
      expect(config.model).toBe('claude-sonnet-4-20250514')
      expect(config.maxTokens).toBe(4096)
    })

    it('defaults to complex tier when complexity undefined (backward compatibility)', () => {
      const config = selectModelForComplexity(undefined)
      expect(config.provider).toBe('anthropic')
      expect(config.model).toBe('claude-sonnet-4-20250514')
    })
  })

  describe('getFallbackConfig', () => {
    it('escalates simple to medium on failure', () => {
      const fallback = getFallbackConfig('simple')
      expect(fallback.model).toBe('gemini-2.5-pro')
      expect(fallback.provider).toBe('google')
    })

    it('escalates medium to complex on failure', () => {
      const fallback = getFallbackConfig('medium')
      expect(fallback.model).toBe('claude-sonnet-4-20250514')
      expect(fallback.provider).toBe('anthropic')
    })

    it('falls back complex to medium (existing E12.6 behavior)', () => {
      const fallback = getFallbackConfig('complex')
      expect(fallback.model).toBe('gemini-2.5-pro')
      expect(fallback.provider).toBe('google')
    })
  })

  describe('API key availability', () => {
    it('isGoogleAvailable returns true when key is set', () => {
      process.env.GOOGLE_AI_API_KEY = 'test-key'
      expect(isGoogleAvailable()).toBe(true)
    })

    it('isGoogleAvailable returns false when key is missing', () => {
      delete process.env.GOOGLE_AI_API_KEY
      expect(isGoogleAvailable()).toBe(false)
    })

    it('isAnthropicAvailable returns true when key is set', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key'
      expect(isAnthropicAvailable()).toBe(true)
    })

    it('isAnthropicAvailable returns false when key is missing', () => {
      delete process.env.ANTHROPIC_API_KEY
      expect(isAnthropicAvailable()).toBe(false)
    })
  })

  describe('getEffectiveModelConfig', () => {
    it('returns requested tier when Google key available', () => {
      process.env.GOOGLE_AI_API_KEY = 'test-key'
      const config = getEffectiveModelConfig('simple')
      expect(config.provider).toBe('google')
      expect(config.model).toBe('gemini-2.0-flash-lite')
    })

    it('falls back to Claude when Google key missing and simple tier requested', () => {
      delete process.env.GOOGLE_AI_API_KEY
      process.env.ANTHROPIC_API_KEY = 'test-key'
      const config = getEffectiveModelConfig('simple')
      expect(config.provider).toBe('anthropic')
      expect(config.model).toBe('claude-sonnet-4-20250514')
    })

    it('falls back to Claude when Google key missing and medium tier requested', () => {
      delete process.env.GOOGLE_AI_API_KEY
      process.env.ANTHROPIC_API_KEY = 'test-key'
      const config = getEffectiveModelConfig('medium')
      expect(config.provider).toBe('anthropic')
      expect(config.model).toBe('claude-sonnet-4-20250514')
    })

    it('falls back to Gemini when Anthropic key missing and complex tier requested', () => {
      process.env.GOOGLE_AI_API_KEY = 'test-key'
      delete process.env.ANTHROPIC_API_KEY
      const config = getEffectiveModelConfig('complex')
      expect(config.provider).toBe('google')
      expect(config.model).toBe('gemini-2.5-pro')
    })

    it('defaults to complex tier when complexity undefined', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key'
      const config = getEffectiveModelConfig(undefined)
      expect(config.provider).toBe('anthropic')
      expect(config.model).toBe('claude-sonnet-4-20250514')
    })
  })

  describe('getTierFromModel', () => {
    it('returns simple for gemini-2.0-flash-lite', () => {
      expect(getTierFromModel('gemini-2.0-flash-lite')).toBe('simple')
    })

    it('returns medium for gemini-2.5-pro', () => {
      expect(getTierFromModel('gemini-2.5-pro')).toBe('medium')
    })

    it('returns complex for claude-sonnet-4-20250514', () => {
      expect(getTierFromModel('claude-sonnet-4-20250514')).toBe('complex')
    })

    it('returns unknown for unrecognized model', () => {
      expect(getTierFromModel('gpt-4-turbo')).toBe('unknown')
    })
  })

  describe('formatModelSelection', () => {
    it('formats model selection correctly', () => {
      const config = MODEL_ROUTING_CONFIG.simple
      const formatted = formatModelSelection(config, 'simple')
      expect(formatted).toBe('google:gemini-2.0-flash-lite (simple tier)')
    })

    it('handles undefined complexity', () => {
      const config = MODEL_ROUTING_CONFIG.complex
      const formatted = formatModelSelection(config, undefined)
      expect(formatted).toBe('anthropic:claude-sonnet-4-20250514 (default tier)')
    })
  })
})

describe('Token Costs', () => {
  describe('TOKEN_COSTS_BY_MODEL', () => {
    it('has pricing for gemini-2.0-flash-lite', () => {
      const costs = TOKEN_COSTS_BY_MODEL['gemini-2.0-flash-lite']
      expect(costs).toBeDefined()
      expect(costs!.input).toBe(0.075)
      expect(costs!.output).toBe(0.30)
    })

    it('has pricing for gemini-2.5-pro', () => {
      const costs = TOKEN_COSTS_BY_MODEL['gemini-2.5-pro']
      expect(costs).toBeDefined()
      expect(costs!.input).toBe(1.25)
      expect(costs!.output).toBe(10.00)
    })

    it('has pricing for claude-sonnet-4-20250514', () => {
      const costs = TOKEN_COSTS_BY_MODEL['claude-sonnet-4-20250514']
      expect(costs).toBeDefined()
      expect(costs!.input).toBe(3.00)
      expect(costs!.output).toBe(15.00)
    })
  })

  describe('getTokenCosts', () => {
    it('returns correct costs for known model', () => {
      const costs = getTokenCosts('gemini-2.0-flash-lite')
      expect(costs.input).toBe(0.075)
      expect(costs.output).toBe(0.30)
    })

    it('returns fallback costs for unknown model', () => {
      const costs = getTokenCosts('unknown-model')
      // Falls back to gemini-2.5-pro pricing
      expect(costs.input).toBe(1.25)
      expect(costs.output).toBe(10.00)
    })
  })

  describe('calculateModelCost', () => {
    it('calculates correct cost for simple tier (gemini-2.0-flash-lite)', () => {
      // 1000 input + 100 output tokens
      const cost = calculateModelCost('gemini-2.0-flash-lite', 1000, 100)
      // Expected: (1000/1M * 0.075) + (100/1M * 0.30) = 0.000075 + 0.00003 = 0.000105
      expect(cost).toBeCloseTo(0.000105, 6)
    })

    it('calculates correct cost for medium tier (gemini-2.5-pro)', () => {
      // 1000 input + 100 output tokens
      const cost = calculateModelCost('gemini-2.5-pro', 1000, 100)
      // Expected: (1000/1M * 1.25) + (100/1M * 10.00) = 0.00125 + 0.001 = 0.00225
      expect(cost).toBeCloseTo(0.00225, 5)
    })

    it('calculates correct cost for complex tier (claude-sonnet-4-20250514)', () => {
      // 1000 input + 100 output tokens
      const cost = calculateModelCost('claude-sonnet-4-20250514', 1000, 100)
      // Expected: (1000/1M * 3.00) + (100/1M * 15.00) = 0.003 + 0.0015 = 0.0045
      expect(cost).toBeCloseTo(0.0045, 4)
    })

    it('simple tier is ~40x cheaper than complex tier for same tokens', () => {
      const simpleCost = calculateModelCost('gemini-2.0-flash-lite', 1000, 100)
      const complexCost = calculateModelCost('claude-sonnet-4-20250514', 1000, 100)
      const ratio = complexCost / simpleCost
      expect(ratio).toBeGreaterThan(30) // At least 30x cheaper
      expect(ratio).toBeLessThan(50) // But not more than 50x
    })
  })
})

describe('Cost Savings Analysis', () => {
  // Story goal: 98% cost reduction for simple queries
  it('demonstrates ~98% cost savings for simple queries vs complex', () => {
    // Typical simple query: 200 input, 100 output tokens
    const simpleCost = calculateModelCost('gemini-2.0-flash-lite', 200, 100)
    const complexCost = calculateModelCost('claude-sonnet-4-20250514', 200, 100)

    const savingsPercent = ((complexCost - simpleCost) / complexCost) * 100
    expect(savingsPercent).toBeGreaterThan(95) // At least 95% savings
  })

  // Story goal: ~40% cost reduction for medium queries (actual based on pricing)
  // Note: Original story goal of 66% was aspirational; actual savings is ~40%
  it('demonstrates ~40% cost savings for medium queries vs complex', () => {
    // Typical medium query: 500 input, 300 output tokens
    const mediumCost = calculateModelCost('gemini-2.5-pro', 500, 300)
    const complexCost = calculateModelCost('claude-sonnet-4-20250514', 500, 300)

    const savingsPercent = ((complexCost - mediumCost) / complexCost) * 100
    expect(savingsPercent).toBeGreaterThan(35) // At least 35% savings
    expect(savingsPercent).toBeLessThan(50) // Based on actual pricing
  })
})
