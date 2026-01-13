/**
 * Unit tests for observability usage logging.
 * Story: E12.2 - Usage Logging Integration (AC: #2, #4, #5)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import {
  logLLMUsage,
  logFeatureUsage,
  calculateLLMCost,
} from '@/lib/observability/usage'

describe('Usage Logging Service', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)
  })

  describe('logLLMUsage', () => {
    it('should log LLM usage with all fields', async () => {
      // AC #2: TypeScript usage is logged correctly
      mockSupabase.single.mockResolvedValue({
        data: { id: 'test-uuid' },
        error: null,
      })

      const result = await logLLMUsage({
        organizationId: 'org-123',
        dealId: 'deal-456',
        userId: 'user-789',
        provider: 'anthropic',
        model: 'claude-sonnet-4-0',
        feature: 'chat',
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: 0.0105,
        latencyMs: 350,
      })

      expect(result).toBe('test-uuid')
      expect(mockSupabase.from).toHaveBeenCalledWith('llm_usage')
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'anthropic',
          model: 'claude-sonnet-4-0',
          feature: 'chat',
          input_tokens: 1000,
          output_tokens: 500,
        })
      )
    })

    it('should return null on database error', async () => {
      // AC #5: Graceful error handling
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Insert failed' },
      })

      const result = await logLLMUsage({
        provider: 'google-gla',
        model: 'gemini-2.5-flash',
        feature: 'extraction',
        inputTokens: 500,
        outputTokens: 200,
        costUsd: 0.0001,
      })

      expect(result).toBeNull()
    })

    it('should handle missing optional fields', async () => {
      // AC #4: Optional fields are truly optional
      mockSupabase.single.mockResolvedValue({
        data: { id: 'minimal-uuid' },
        error: null,
      })

      const result = await logLLMUsage({
        provider: 'voyage',
        model: 'voyage-3.5',
        feature: 'embeddings',
        inputTokens: 1000,
        outputTokens: 0,
        costUsd: 0.00006,
      })

      expect(result).toBe('minimal-uuid')
      // Should not include optional fields that weren't provided
      const insertCall = mockSupabase.insert.mock.calls[0]![0]
      expect(insertCall.organization_id).toBeUndefined()
      expect(insertCall.deal_id).toBeUndefined()
      expect(insertCall.user_id).toBeUndefined()
    })
  })

  describe('logFeatureUsage', () => {
    it('should log feature usage with success status', async () => {
      // AC #4: Feature usage logging works
      mockSupabase.single.mockResolvedValue({
        data: { id: 'feature-uuid' },
        error: null,
      })

      const result = await logFeatureUsage({
        dealId: 'deal-123',
        userId: 'user-456',
        featureName: 'document_upload',
        status: 'success',
        durationMs: 2500,
        metadata: { documentSize: 1024000 },
      })

      expect(result).toBe('feature-uuid')
      expect(mockSupabase.from).toHaveBeenCalledWith('feature_usage')
    })

    it('should log feature usage with error status', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { id: 'error-uuid' },
        error: null,
      })

      const result = await logFeatureUsage({
        featureName: 'chat',
        status: 'error',
        durationMs: 100,
        errorMessage: 'Connection timeout',
      })

      expect(result).toBe('error-uuid')
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          error_message: 'Connection timeout',
        })
      )
    })

    it('should return null on database error', async () => {
      // AC #5: Graceful error handling
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'DB error' },
      })

      const result = await logFeatureUsage({
        featureName: 'search',
        status: 'timeout',
      })

      expect(result).toBeNull()
    })
  })

  describe('calculateLLMCost', () => {
    it('should calculate cost for Gemini Flash correctly', () => {
      // $0.075/1M input, $0.30/1M output
      const cost = calculateLLMCost('google-gla', 'gemini-2.5-flash', 1000000, 1000000)
      expect(cost).toBeCloseTo(0.375, 6)
    })

    it('should calculate cost for Claude Sonnet correctly', () => {
      // $3.00/1M input, $15.00/1M output
      const cost = calculateLLMCost('anthropic', 'claude-sonnet-4-0', 1000000, 1000000)
      expect(cost).toBeCloseTo(18.0, 6)
    })

    it('should calculate cost for Voyage embeddings correctly', () => {
      // $0.06/1M input, $0 output
      const cost = calculateLLMCost('voyage', 'voyage-3.5', 1000000, 0)
      expect(cost).toBeCloseTo(0.06, 6)
    })

    it('should return 0 for unknown models', () => {
      const cost = calculateLLMCost('unknown', 'unknown-model', 1000, 1000)
      expect(cost).toBe(0)
    })

    it('should handle small token counts accurately', () => {
      // 1000 input, 500 output with Gemini Flash
      // (1000 * 0.075 / 1M) + (500 * 0.30 / 1M) = 0.000075 + 0.00015 = 0.000225
      const cost = calculateLLMCost('google-gla', 'gemini-2.5-flash', 1000, 500)
      expect(cost).toBeCloseTo(0.000225, 6)
    })
  })
})
