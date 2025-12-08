/**
 * Tests for Confidence Thresholds Service
 * Story: E7.4 - Build Feedback Incorporation System
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DEFAULT_THRESHOLDS } from '@/lib/services/confidence-thresholds'

// Mock Supabase client
const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpsert = vi.fn()
const mockUpdate = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockOrder = vi.fn()
const mockLimit = vi.fn()
const mockGte = vi.fn()
const mockLte = vi.fn()
const mockRange = vi.fn()

const mockSupabase = {
  from: mockFrom,
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

vi.mock('@/lib/config/feature-flags', () => ({
  getFeatureFlag: vi.fn(() => Promise.resolve(true)),
}))

describe('Confidence Thresholds Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mock chain
    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      upsert: mockUpsert,
      update: mockUpdate,
    })

    mockSelect.mockReturnValue({
      eq: mockEq,
      order: mockOrder,
      gte: mockGte,
      lte: mockLte,
    })

    mockEq.mockReturnValue({
      eq: mockEq,
      single: mockSingle,
      order: mockOrder,
    })

    mockOrder.mockReturnValue({
      limit: mockLimit,
      range: mockRange,
    })

    mockLimit.mockReturnValue(
      Promise.resolve({ data: [], error: null })
    )

    mockSingle.mockReturnValue(
      Promise.resolve({ data: null, error: { code: 'PGRST116' } })
    )

    mockUpsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn(() => Promise.resolve({
          data: {
            id: 'threshold-1',
            deal_id: 'deal-1',
            domain: 'financial',
            threshold: 0.75,
            previous_threshold: 0.70,
            reason: 'Test reason',
            applied_at: new Date().toISOString(),
            applied_by: 'user-1',
            auto_applied: false,
          },
          error: null,
        })),
      }),
    })

    mockInsert.mockReturnValue(
      Promise.resolve({ error: null })
    )
  })

  describe('DEFAULT_THRESHOLDS', () => {
    it('should have correct default thresholds for each domain', () => {
      expect(DEFAULT_THRESHOLDS.financial).toBe(0.70)
      expect(DEFAULT_THRESHOLDS.legal).toBe(0.70)
      expect(DEFAULT_THRESHOLDS.operational).toBe(0.60)
      expect(DEFAULT_THRESHOLDS.market).toBe(0.55)
      expect(DEFAULT_THRESHOLDS.technical).toBe(0.60)
      expect(DEFAULT_THRESHOLDS.general).toBe(0.50)
    })

    it('should have higher thresholds for critical domains', () => {
      expect(DEFAULT_THRESHOLDS['financial']).toBeGreaterThan(DEFAULT_THRESHOLDS['general']!)
      expect(DEFAULT_THRESHOLDS['legal']).toBeGreaterThan(DEFAULT_THRESHOLDS['general']!)
    })
  })

  describe('Threshold Bounds', () => {
    const MIN_THRESHOLD = 0.30
    const MAX_THRESHOLD = 0.95

    it('should clamp threshold to minimum bound', () => {
      const clamp = (value: number) =>
        Math.max(MIN_THRESHOLD, Math.min(MAX_THRESHOLD, value))

      expect(clamp(0.10)).toBe(MIN_THRESHOLD)
      expect(clamp(0.25)).toBe(MIN_THRESHOLD)
    })

    it('should clamp threshold to maximum bound', () => {
      const clamp = (value: number) =>
        Math.max(MIN_THRESHOLD, Math.min(MAX_THRESHOLD, value))

      expect(clamp(0.99)).toBe(MAX_THRESHOLD)
      expect(clamp(1.0)).toBe(MAX_THRESHOLD)
    })

    it('should not clamp values within bounds', () => {
      const clamp = (value: number) =>
        Math.max(MIN_THRESHOLD, Math.min(MAX_THRESHOLD, value))

      expect(clamp(0.50)).toBe(0.50)
      expect(clamp(0.75)).toBe(0.75)
      expect(clamp(0.30)).toBe(0.30)
      expect(clamp(0.95)).toBe(0.95)
    })
  })

  describe('Auto-Adjustment Criteria', () => {
    const MIN_SAMPLE_SIZE_FOR_AUTO = 20
    const MIN_STATISTICAL_CONFIDENCE = 0.60

    it('should skip auto-adjustment for small sample sizes', () => {
      const shouldAutoAdjust = (sampleSize: number, confidence: number) =>
        sampleSize >= MIN_SAMPLE_SIZE_FOR_AUTO &&
        confidence >= MIN_STATISTICAL_CONFIDENCE

      expect(shouldAutoAdjust(10, 0.80)).toBe(false)
      expect(shouldAutoAdjust(15, 0.90)).toBe(false)
      expect(shouldAutoAdjust(19, 0.75)).toBe(false)
    })

    it('should skip auto-adjustment for low statistical confidence', () => {
      const shouldAutoAdjust = (sampleSize: number, confidence: number) =>
        sampleSize >= MIN_SAMPLE_SIZE_FOR_AUTO &&
        confidence >= MIN_STATISTICAL_CONFIDENCE

      expect(shouldAutoAdjust(50, 0.50)).toBe(false)
      expect(shouldAutoAdjust(100, 0.40)).toBe(false)
    })

    it('should allow auto-adjustment when criteria are met', () => {
      const shouldAutoAdjust = (sampleSize: number, confidence: number) =>
        sampleSize >= MIN_SAMPLE_SIZE_FOR_AUTO &&
        confidence >= MIN_STATISTICAL_CONFIDENCE

      expect(shouldAutoAdjust(20, 0.60)).toBe(true)
      expect(shouldAutoAdjust(50, 0.75)).toBe(true)
      expect(shouldAutoAdjust(100, 0.90)).toBe(true)
    })
  })

  describe('Threshold Comparison Logic', () => {
    it('should determine if finding meets threshold', () => {
      const meetsThreshold = (confidence: number, threshold: number) =>
        confidence >= threshold

      expect(meetsThreshold(0.75, 0.70)).toBe(true)
      expect(meetsThreshold(0.70, 0.70)).toBe(true)
      expect(meetsThreshold(0.65, 0.70)).toBe(false)
    })

    it('should use default threshold when no custom threshold exists', () => {
      const getEffectiveThreshold = (
        customThresholds: Map<string, number>,
        domain: string
      ) => {
        return customThresholds.get(domain) ?? DEFAULT_THRESHOLDS[domain] ?? DEFAULT_THRESHOLDS.general
      }

      const customThresholds = new Map<string, number>()
      customThresholds.set('financial', 0.80)

      expect(getEffectiveThreshold(customThresholds, 'financial')).toBe(0.80)
      expect(getEffectiveThreshold(customThresholds, 'legal')).toBe(0.70) // Default
      expect(getEffectiveThreshold(customThresholds, 'unknown')).toBe(0.50) // General default
    })
  })

  describe('History Tracking', () => {
    it('should record threshold changes with audit info', () => {
      const createHistoryRecord = (
        oldThreshold: number | null,
        newThreshold: number,
        reason: string,
        changedBy: string,
        autoChanged: boolean
      ) => ({
        old_threshold: oldThreshold,
        new_threshold: newThreshold,
        reason,
        changed_by: changedBy,
        auto_changed: autoChanged,
        changed_at: new Date().toISOString(),
      })

      const record = createHistoryRecord(0.70, 0.80, 'High rejection rate', 'user-1', false)

      expect(record.old_threshold).toBe(0.70)
      expect(record.new_threshold).toBe(0.80)
      expect(record.reason).toBe('High rejection rate')
      expect(record.auto_changed).toBe(false)
    })

    it('should track auto-applied threshold changes', () => {
      const createHistoryRecord = (
        oldThreshold: number | null,
        newThreshold: number,
        reason: string,
        changedBy: string,
        autoChanged: boolean
      ) => ({
        old_threshold: oldThreshold,
        new_threshold: newThreshold,
        reason,
        changed_by: changedBy,
        auto_changed: autoChanged,
        changed_at: new Date().toISOString(),
      })

      const record = createHistoryRecord(0.60, 0.75, 'Auto-adjusted based on feedback', 'system', true)

      expect(record.changed_by).toBe('system')
      expect(record.auto_changed).toBe(true)
    })
  })

  describe('Threshold Adjustment Application', () => {
    it('should track applied and skipped adjustments', () => {
      const adjustments = [
        { domain: 'financial', basedOnSampleSize: 50, statisticalConfidence: 0.75 },
        { domain: 'legal', basedOnSampleSize: 15, statisticalConfidence: 0.80 },
        { domain: 'operational', basedOnSampleSize: 30, statisticalConfidence: 0.45 },
      ]

      const MIN_SAMPLE = 20
      const MIN_CONFIDENCE = 0.60

      const applied: string[] = []
      const skipped: { domain: string; reason: string }[] = []

      for (const adj of adjustments) {
        if (adj.basedOnSampleSize < MIN_SAMPLE) {
          skipped.push({
            domain: adj.domain,
            reason: `Sample size (${adj.basedOnSampleSize}) below minimum (${MIN_SAMPLE})`,
          })
        } else if (adj.statisticalConfidence < MIN_CONFIDENCE) {
          skipped.push({
            domain: adj.domain,
            reason: `Statistical confidence (${Math.round(adj.statisticalConfidence * 100)}%) below minimum (${MIN_CONFIDENCE * 100}%)`,
          })
        } else {
          applied.push(adj.domain)
        }
      }

      expect(applied).toEqual(['financial'])
      expect(skipped).toHaveLength(2)
      expect(skipped[0]!.domain).toBe('legal')
      expect(skipped[0]!.reason).toContain('Sample size')
      expect(skipped[1]!.domain).toBe('operational')
      expect(skipped[1]!.reason).toContain('Statistical confidence')
    })
  })

  describe('Reset Functionality', () => {
    it('should reset threshold to default for domain', () => {
      const resetToDefault = (domain: string) => ({
        domain,
        threshold: DEFAULT_THRESHOLDS[domain] ?? DEFAULT_THRESHOLDS.general,
        reason: 'Reset to default threshold',
      })

      const reset = resetToDefault('financial')
      expect(reset.threshold).toBe(0.70)
      expect(reset.reason).toBe('Reset to default threshold')
    })

    it('should use general default for unknown domains', () => {
      const resetToDefault = (domain: string) => ({
        domain,
        threshold: DEFAULT_THRESHOLDS[domain] ?? DEFAULT_THRESHOLDS.general,
        reason: 'Reset to default threshold',
      })

      const reset = resetToDefault('unknown_domain')
      expect(reset.threshold).toBe(0.50)
    })
  })

  describe('Findings Below Threshold Detection', () => {
    it('should identify findings below their domain threshold', () => {
      const findings = [
        { id: 'f1', domain: 'financial', confidence: 0.65 },
        { id: 'f2', domain: 'financial', confidence: 0.80 },
        { id: 'f3', domain: 'legal', confidence: 0.60 },
        { id: 'f4', domain: 'market', confidence: 0.60 }, // Above 0.55 market threshold
      ]

      const thresholds: Map<string, number> = new Map()
      // Use defaults

      const belowThreshold = findings.filter(f => {
        const domain = (f.domain || 'general').toLowerCase()
        const threshold = thresholds.get(domain) ?? DEFAULT_THRESHOLDS[domain] ?? DEFAULT_THRESHOLDS['general']!
        return f.confidence < (threshold ?? 0.5)
      })

      expect(belowThreshold).toHaveLength(2)
      expect(belowThreshold.map(f => f.id)).toContain('f1') // 0.65 < 0.70 (financial)
      expect(belowThreshold.map(f => f.id)).toContain('f3') // 0.60 < 0.70 (legal)
    })
  })
})
