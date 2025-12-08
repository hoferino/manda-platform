/**
 * Validation Feedback Service Tests
 * Story: E7.2 - Track Validation/Rejection Feedback
 *
 * Tests for:
 * - calculateAdjustedConfidence (AC: #4, #5)
 * - Confidence bounds [0.1, 0.95]
 * - Validation boost (+0.05) and rejection penalty (-0.10)
 */

import { describe, it, expect } from 'vitest'
import { calculateAdjustedConfidence } from '@/lib/services/validation-feedback'

describe('calculateAdjustedConfidence', () => {
  describe('AC#4: Confidence increases by 0.05 per validation', () => {
    it('should increase confidence by 0.05 for one validation', () => {
      const result = calculateAdjustedConfidence(0.7, 1, 0)
      expect(result).toBe(0.75)
    })

    it('should increase confidence by 0.10 for two validations', () => {
      const result = calculateAdjustedConfidence(0.7, 2, 0)
      expect(result).toBeCloseTo(0.8, 10)
    })

    it('should increase confidence by 0.25 for five validations', () => {
      const result = calculateAdjustedConfidence(0.7, 5, 0)
      // 0.7 + 0.25 = 0.95 (capped)
      expect(result).toBe(0.95)
    })
  })

  describe('AC#5: Confidence decreases by 0.10 per rejection', () => {
    it('should decrease confidence by 0.10 for one rejection', () => {
      const result = calculateAdjustedConfidence(0.7, 0, 1)
      expect(result).toBe(0.6)
    })

    it('should decrease confidence by 0.20 for two rejections', () => {
      const result = calculateAdjustedConfidence(0.7, 0, 2)
      expect(result).toBeCloseTo(0.5, 10)
    })

    it('should decrease confidence by 0.50 for five rejections', () => {
      const result = calculateAdjustedConfidence(0.7, 0, 5)
      // 0.7 - 0.50 = 0.20, but floored at 0.1
      expect(result).toBeCloseTo(0.2, 10)
    })
  })

  describe('Confidence bounds [0.1, 0.95]', () => {
    it('should cap confidence at 0.95 (maximum)', () => {
      const result = calculateAdjustedConfidence(0.9, 10, 0)
      expect(result).toBe(0.95)
    })

    it('should floor confidence at 0.1 (minimum)', () => {
      const result = calculateAdjustedConfidence(0.3, 0, 10)
      expect(result).toBe(0.1)
    })

    it('should handle already at cap', () => {
      const result = calculateAdjustedConfidence(0.95, 1, 0)
      expect(result).toBe(0.95)
    })

    it('should handle already at floor', () => {
      const result = calculateAdjustedConfidence(0.1, 0, 1)
      expect(result).toBe(0.1)
    })
  })

  describe('Mixed validations and rejections', () => {
    it('should correctly combine validations and rejections', () => {
      // 0.5 + (2 * 0.05) - (1 * 0.10) = 0.5 + 0.10 - 0.10 = 0.5
      const result = calculateAdjustedConfidence(0.5, 2, 1)
      expect(result).toBe(0.5)
    })

    it('should handle more rejections than validations', () => {
      // 0.7 + (1 * 0.05) - (3 * 0.10) = 0.7 + 0.05 - 0.30 = 0.45
      const result = calculateAdjustedConfidence(0.7, 1, 3)
      expect(result).toBeCloseTo(0.45, 10)
    })

    it('should handle more validations than rejections', () => {
      // 0.5 + (5 * 0.05) - (2 * 0.10) = 0.5 + 0.25 - 0.20 = 0.55
      const result = calculateAdjustedConfidence(0.5, 5, 2)
      expect(result).toBe(0.55)
    })
  })

  describe('Edge cases', () => {
    it('should handle zero base confidence', () => {
      const result = calculateAdjustedConfidence(0, 1, 0)
      expect(result).toBe(0.1) // Floored at minimum
    })

    it('should handle zero counts', () => {
      const result = calculateAdjustedConfidence(0.5, 0, 0)
      expect(result).toBe(0.5)
    })

    it('should handle very high base confidence', () => {
      const result = calculateAdjustedConfidence(1.0, 0, 0)
      expect(result).toBe(0.95) // Capped at maximum
    })

    it('should handle negative adjustment correctly', () => {
      // Low base confidence with rejection should floor at 0.1
      const result = calculateAdjustedConfidence(0.15, 0, 1)
      expect(result).toBe(0.1)
    })
  })
})
