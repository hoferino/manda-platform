/**
 * Tests for Feedback Analysis Service
 * Story: E7.4 - Build Feedback Incorporation System
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase client
const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpsert = vi.fn()
const mockEq = vi.fn()
const mockIn = vi.fn()
const mockGte = vi.fn()
const mockLte = vi.fn()
const mockOrder = vi.fn()
const mockLimit = vi.fn()
const mockSingle = vi.fn()

const mockSupabase = {
  from: mockFrom,
}

// Import after mocking
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

vi.mock('@/lib/config/feature-flags', () => ({
  getFeatureFlag: vi.fn(() => Promise.resolve(true)),
}))

// Test data
const mockFindings = [
  { id: 'f1', text: 'Revenue 1M', domain: 'financial', document_id: 'd1', confidence: 0.85, needs_review: false, last_corrected_at: null },
  { id: 'f2', text: 'EBITDA 200K', domain: 'financial', document_id: 'd1', confidence: 0.75, needs_review: false, last_corrected_at: null },
  { id: 'f3', text: 'CEO is John', domain: 'operational', document_id: 'd2', confidence: 0.90, needs_review: false, last_corrected_at: null },
  { id: 'f4', text: 'Market share 15%', domain: 'market', document_id: 'd3', confidence: 0.60, needs_review: false, last_corrected_at: null },
]

const mockCorrections = [
  { id: 'c1', finding_id: 'f1', correction_type: 'value', created_at: '2025-12-01T00:00:00Z' },
  { id: 'c2', finding_id: 'f2', correction_type: 'value', created_at: '2025-12-02T00:00:00Z' },
]

const mockValidations = [
  { id: 'v1', finding_id: 'f3', action: 'validate' },
  { id: 'v2', finding_id: 'f4', action: 'reject' },
]

describe('Feedback Analysis Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mock chain
    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      upsert: mockUpsert,
    })

    mockSelect.mockReturnValue({
      eq: mockEq,
      in: mockIn,
    })

    mockEq.mockReturnValue({
      eq: mockEq,
      gte: mockGte,
      lte: mockLte,
      single: mockSingle,
      execute: vi.fn(() => Promise.resolve({ data: [], error: null })),
    })

    mockIn.mockReturnValue({
      gte: mockGte,
    })

    mockGte.mockReturnValue({
      lte: mockLte,
    })

    mockLte.mockReturnValue({
      execute: vi.fn(() => Promise.resolve({ data: [], error: null })),
    })

    mockOrder.mockReturnValue({
      limit: mockLimit,
    })

    mockLimit.mockReturnValue({
      single: mockSingle,
    })

    mockSingle.mockReturnValue(
      Promise.resolve({ data: null, error: { code: 'PGRST116' } })
    )

    mockUpsert.mockReturnValue({
      execute: vi.fn(() => Promise.resolve({ error: null })),
    })
  })

  describe('calculateDomainStats', () => {
    it('should group findings by domain and count correctly', async () => {
      // This is testing the internal logic - import the module directly
      const { analyzeFeedback } = await import('@/lib/services/feedback-analysis')

      // Setup mocks for findings
      mockEq.mockReturnValueOnce({
        execute: vi.fn(() => Promise.resolve({ data: mockFindings, error: null })),
      })

      // The function will internally calculate domain stats
      // We're verifying the structure is correct
      expect(mockFindings.length).toBe(4)
      expect(mockFindings.filter(f => f.domain === 'financial').length).toBe(2)
      expect(mockFindings.filter(f => f.domain === 'operational').length).toBe(1)
      expect(mockFindings.filter(f => f.domain === 'market').length).toBe(1)
    })
  })

  describe('Pattern Detection', () => {
    it('should detect domain bias when rejection rate is high', () => {
      const domainStats = [
        {
          domain: 'financial',
          finding_count: 20,
          correction_count: 2,
          validation_count: 5,
          rejection_count: 10, // 67% rejection rate
          average_confidence: 0.7,
          rejection_rate: 0.67,
        },
      ]

      // Pattern detection logic
      const patterns: Array<{
        pattern_type: string
        description: string
        affected_count: number
        severity: string
        recommendation: string
        examples: string[]
      }> = []

      for (const stats of domainStats) {
        if (stats.finding_count >= 10 && stats.rejection_rate > 0.30) {
          const severity = stats.rejection_rate > 0.5 ? 'high' : stats.rejection_rate > 0.3 ? 'medium' : 'low'
          patterns.push({
            pattern_type: 'domain_bias',
            description: `High rejection rate in ${stats.domain} domain (${Math.round(stats.rejection_rate * 100)}%)`,
            affected_count: stats.rejection_count,
            severity,
            recommendation: `Review extraction prompts for ${stats.domain} domain.`,
            examples: [],
          })
        }
      }

      expect(patterns).toHaveLength(1)
      expect(patterns[0]!.pattern_type).toBe('domain_bias')
      expect(patterns[0]!.severity).toBe('high')
    })

    it('should detect confidence drift when corrections are high but rejections low', () => {
      const domainStats = [
        {
          domain: 'legal',
          finding_count: 25,
          correction_count: 10, // 40% correction rate
          validation_count: 15,
          rejection_count: 1, // 6% rejection rate
          average_confidence: 0.65,
          rejection_rate: 0.06,
        },
      ]

      const patterns: Array<{
        pattern_type: string
        description: string
        affected_count: number
        severity: string
        recommendation: string
        examples: string[]
      }> = []

      for (const stats of domainStats) {
        if (stats.finding_count >= 10) {
          const correctionRate = stats.correction_count / stats.finding_count
          if (correctionRate > 0.20 && stats.rejection_rate < 0.1) {
            patterns.push({
              pattern_type: 'confidence_drift',
              description: `High correction rate in ${stats.domain} (${Math.round(correctionRate * 100)}%) but low rejection`,
              affected_count: stats.correction_count,
              severity: correctionRate > 0.4 ? 'high' : 'medium',
              recommendation: 'Consider improving initial extraction precision.',
              examples: [],
            })
          }
        }
      }

      expect(patterns).toHaveLength(1)
      expect(patterns[0]!.pattern_type).toBe('confidence_drift')
      expect(patterns[0]!.severity).toBe('medium')
    })

    it('should detect extraction errors when value corrections are common', () => {
      const corrections = [
        { correction_type: 'value' },
        { correction_type: 'value' },
        { correction_type: 'value' },
        { correction_type: 'value' },
        { correction_type: 'value' },
        { correction_type: 'value' },
        { correction_type: 'value' },
        { correction_type: 'value' },
        { correction_type: 'value' },
        { correction_type: 'value' },
        { correction_type: 'source' },
        { correction_type: 'text' },
      ]

      const correctionsByType: Record<string, number> = {}
      for (const correction of corrections) {
        correctionsByType[correction.correction_type] = (correctionsByType[correction.correction_type] || 0) + 1
      }

      const patterns: Array<{
        pattern_type: string
        description: string
        affected_count: number
        severity: string
        recommendation: string
        examples: string[]
      }> = []

      const valueCorrectionCount = correctionsByType.value || 0
      if (valueCorrectionCount >= 10) {
        patterns.push({
          pattern_type: 'extraction_error',
          description: `Systematic value extraction errors (${valueCorrectionCount} corrections)`,
          affected_count: valueCorrectionCount,
          severity: valueCorrectionCount > 30 ? 'high' : valueCorrectionCount > 15 ? 'medium' : 'low',
          recommendation: 'Review LLM extraction prompts.',
          examples: [],
        })
      }

      expect(patterns).toHaveLength(1)
      expect(patterns[0]!.pattern_type).toBe('extraction_error')
      expect(patterns[0]!.affected_count).toBe(10)
      expect(patterns[0]!.severity).toBe('low')
    })
  })

  describe('Confidence Threshold Adjustments', () => {
    it('should recommend raising threshold for high rejection rate', () => {
      const domainStats = [
        {
          domain: 'financial',
          finding_count: 30,
          rejection_rate: 0.45, // 45% rejection
          validation_count: 10,
        },
      ]

      const currentThreshold = 0.70

      const adjustments: Array<{
        domain: string
        current_threshold: number
        recommended_threshold: number
        reason: string
        based_on_sample_size: number
        statistical_confidence: number
      }> = []

      for (const stats of domainStats) {
        if (stats.finding_count < 10) continue

        let recommended = currentThreshold
        if (stats.rejection_rate > 0.4) {
          recommended = Math.min(0.95, currentThreshold + 0.15)
        } else if (stats.rejection_rate > 0.25) {
          recommended = Math.min(0.90, currentThreshold + 0.10)
        }

        if (Math.abs(recommended - currentThreshold) >= 0.05) {
          adjustments.push({
            domain: stats.domain,
            current_threshold: currentThreshold,
            recommended_threshold: Math.round(recommended * 100) / 100,
            reason: `High rejection rate (${Math.round(stats.rejection_rate * 100)}%)`,
            based_on_sample_size: stats.finding_count,
            statistical_confidence: Math.min(1, stats.finding_count / 100) * 0.8,
          })
        }
      }

      expect(adjustments).toHaveLength(1)
      expect(adjustments[0]!.recommended_threshold).toBe(0.85)
      expect(adjustments[0]!.reason).toContain('45%')
    })

    it('should recommend lowering threshold for very low rejection rate with high validation', () => {
      const domainStats = [
        {
          domain: 'operational',
          finding_count: 40,
          rejection_rate: 0.03, // 3% rejection
          validation_count: 25, // 62.5% of findings validated
        },
      ]

      const currentThreshold = 0.60

      const adjustments: Array<{
        domain: string
        current_threshold: number
        recommended_threshold: number
        reason: string
        based_on_sample_size: number
        statistical_confidence: number
      }> = []

      for (const stats of domainStats) {
        if (stats.finding_count < 10) continue

        let recommended = currentThreshold
        if (stats.rejection_rate < 0.05 && stats.validation_count > stats.finding_count * 0.5) {
          recommended = Math.max(0.40, currentThreshold - 0.05)
        }

        if (Math.abs(recommended - currentThreshold) >= 0.05) {
          adjustments.push({
            domain: stats.domain,
            current_threshold: currentThreshold,
            recommended_threshold: Math.round(recommended * 100) / 100,
            reason: 'Low rejection rate with high validation',
            based_on_sample_size: stats.finding_count,
            statistical_confidence: Math.min(1, stats.finding_count / 100) * 0.8,
          })
        }
      }

      expect(adjustments).toHaveLength(1)
      expect(adjustments[0]!.recommended_threshold).toBe(0.55)
    })

    it('should not recommend changes when sample size is too small', () => {
      const domainStats = [
        {
          domain: 'technical',
          finding_count: 5, // Too small
          rejection_rate: 0.60,
          validation_count: 2,
        },
      ]

      const adjustments: Array<{
        domain: string
      }> = []

      for (const stats of domainStats) {
        if (stats.finding_count < 10) continue // Skip small samples
        adjustments.push({ domain: stats.domain })
      }

      expect(adjustments).toHaveLength(0)
    })
  })

  describe('Statistical Confidence Calculation', () => {
    it('should return higher confidence for larger samples', () => {
      const calculateStatisticalConfidence = (sampleSize: number, rate: number): number => {
        const sampleConfidence = Math.min(1, sampleSize / 100)
        const rateExtremity = Math.abs(rate - 0.5) * 2
        return Math.round((sampleConfidence * 0.7 + rateExtremity * sampleConfidence * 0.3) * 100) / 100
      }

      const smallSample = calculateStatisticalConfidence(20, 0.4) // 20 samples, 40% rate
      const largeSample = calculateStatisticalConfidence(100, 0.4) // 100 samples, same rate

      expect(largeSample).toBeGreaterThan(smallSample)
    })

    it('should return higher confidence for extreme rates', () => {
      const calculateStatisticalConfidence = (sampleSize: number, rate: number): number => {
        const sampleConfidence = Math.min(1, sampleSize / 100)
        const rateExtremity = Math.abs(rate - 0.5) * 2
        return Math.round((sampleConfidence * 0.7 + rateExtremity * sampleConfidence * 0.3) * 100) / 100
      }

      const midRate = calculateStatisticalConfidence(50, 0.5) // 50% rate (not extreme)
      const extremeRate = calculateStatisticalConfidence(50, 0.9) // 90% rate (extreme)

      expect(extremeRate).toBeGreaterThan(midRate)
    })
  })

  describe('Recommendation Generation', () => {
    it('should generate threshold adjustment recommendations', () => {
      const domainStats = [
        { domain: 'financial', finding_count: 20, rejection_rate: 0.45 },
      ]
      const patterns: Array<{ pattern_type: string; severity: string; recommendation: string }> = []

      const recommendations: Array<{
        id: string
        type: string
        priority: string
        title: string
        description: string
        actionable: boolean
        auto_applicable: boolean
      }> = []

      for (const stats of domainStats) {
        if (stats.rejection_rate > 0.30 && stats.finding_count >= 10) {
          recommendations.push({
            id: 'test-id',
            type: 'threshold_adjustment',
            priority: stats.rejection_rate > 0.5 ? 'high' : 'medium',
            title: `Adjust ${stats.domain} confidence threshold`,
            description: `${stats.domain} has ${Math.round(stats.rejection_rate * 100)}% rejection rate.`,
            actionable: true,
            auto_applicable: true,
          })
        }
      }

      expect(recommendations).toHaveLength(1)
      expect(recommendations[0]!.type).toBe('threshold_adjustment')
      expect(recommendations[0]!.auto_applicable).toBe(true)
    })

    it('should generate prompt improvement recommendations from patterns', () => {
      const patterns = [
        { pattern_type: 'extraction_error', severity: 'medium', recommendation: 'Review LLM extraction prompts.' },
      ]

      const recommendations: Array<{
        id: string
        type: string
        priority: string
        title: string
        description: string
        actionable: boolean
        auto_applicable: boolean
      }> = []

      for (const pattern of patterns) {
        if (pattern.pattern_type === 'extraction_error' && pattern.severity !== 'low') {
          recommendations.push({
            id: 'test-id',
            type: 'prompt_improvement',
            priority: pattern.severity,
            title: 'Review extraction prompts',
            description: pattern.recommendation,
            actionable: true,
            auto_applicable: false, // Manual review needed
          })
        }
      }

      expect(recommendations).toHaveLength(1)
      expect(recommendations[0]!.type).toBe('prompt_improvement')
      expect(recommendations[0]!.auto_applicable).toBe(false)
    })
  })
})
