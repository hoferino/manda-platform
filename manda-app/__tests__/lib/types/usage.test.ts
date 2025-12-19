import { describe, it, expect } from 'vitest'
import {
  CreateLlmUsageSchema,
  CreateFeatureUsageSchema,
  LLM_PROVIDERS,
  LLM_FEATURES,
  FEATURE_NAMES,
  FEATURE_STATUSES,
} from '@/lib/types/usage'

describe('Usage Types', () => {
  describe('CreateLlmUsageSchema', () => {
    it('validates valid LLM usage input', () => {
      const input = {
        dealId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        organizationId: '550e8400-e29b-41d4-a716-446655440002',
        provider: 'google-gla',
        model: 'gemini-2.5-flash',
        feature: 'chat',
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: 0.0015,
        latencyMs: 1234,
      }

      const result = CreateLlmUsageSchema.safeParse(input)
      expect(result.success).toBe(true)
    })

    it('rejects invalid provider', () => {
      const input = {
        provider: 'invalid-provider',
        model: 'test-model',
        feature: 'chat',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.001,
      }

      const result = CreateLlmUsageSchema.safeParse(input)
      expect(result.success).toBe(false)
    })

    it('rejects negative tokens', () => {
      const input = {
        provider: 'anthropic',
        model: 'claude-sonnet-4-0',
        feature: 'chat',
        inputTokens: -100,
        outputTokens: 50,
        costUsd: 0.001,
      }

      const result = CreateLlmUsageSchema.safeParse(input)
      expect(result.success).toBe(false)
    })

    it('allows optional fields to be omitted', () => {
      const input = {
        provider: 'voyage',
        model: 'voyage-3.5',
        feature: 'embeddings',
        inputTokens: 5000,
        outputTokens: 0,
        costUsd: 0.0003,
      }

      const result = CreateLlmUsageSchema.safeParse(input)
      expect(result.success).toBe(true)
    })
  })

  describe('CreateFeatureUsageSchema', () => {
    it('validates valid feature usage input', () => {
      const input = {
        dealId: '550e8400-e29b-41d4-a716-446655440000',
        featureName: 'upload_document',
        status: 'success',
        durationMs: 5432,
        metadata: { documentCount: 3, totalBytes: 1024000 },
      }

      const result = CreateFeatureUsageSchema.safeParse(input)
      expect(result.success).toBe(true)
    })

    it('validates error status with message', () => {
      const input = {
        featureName: 'chat',
        status: 'error',
        errorMessage: 'Rate limit exceeded',
        metadata: { retryCount: 3 },
      }

      const result = CreateFeatureUsageSchema.safeParse(input)
      expect(result.success).toBe(true)
    })

    it('rejects invalid feature name', () => {
      const input = {
        featureName: 'invalid_feature',
        status: 'success',
      }

      const result = CreateFeatureUsageSchema.safeParse(input)
      expect(result.success).toBe(false)
    })

    it('rejects invalid status', () => {
      const input = {
        featureName: 'chat',
        status: 'invalid_status',
      }

      const result = CreateFeatureUsageSchema.safeParse(input)
      expect(result.success).toBe(false)
    })
  })

  describe('Enum Constants', () => {
    it('LLM_PROVIDERS includes expected providers', () => {
      expect(LLM_PROVIDERS).toContain('google-gla')
      expect(LLM_PROVIDERS).toContain('anthropic')
      expect(LLM_PROVIDERS).toContain('voyage')
      expect(LLM_PROVIDERS).toContain('openai')
    })

    it('LLM_FEATURES includes expected features', () => {
      expect(LLM_FEATURES).toContain('chat')
      expect(LLM_FEATURES).toContain('document_analysis')
      expect(LLM_FEATURES).toContain('embeddings')
    })

    it('FEATURE_STATUSES includes success, error, timeout', () => {
      expect(FEATURE_STATUSES).toContain('success')
      expect(FEATURE_STATUSES).toContain('error')
      expect(FEATURE_STATUSES).toContain('timeout')
    })
  })
})
