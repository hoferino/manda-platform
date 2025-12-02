/**
 * Confidence Extraction Utilities Tests
 *
 * Story: E5.7 - Implement Confidence Indicators and Uncertainty Handling
 * AC: #1 (Confidence Score Extraction), #6 (Multiple Finding Aggregation)
 */

import { describe, it, expect } from 'vitest'
import {
  normalizeConfidence,
  getConfidenceLevelFromScore,
  extractConfidenceFromToolResults,
  aggregateConfidence,
  extractAndAggregateConfidence,
  getDefaultConfidence,
  CONFIDENCE_THRESHOLDS,
  type ConfidenceData,
} from '@/lib/utils/confidence'

describe('confidence utilities', () => {
  describe('normalizeConfidence', () => {
    it('should keep values in 0-1 range unchanged', () => {
      expect(normalizeConfidence(0.85)).toBe(0.85)
      expect(normalizeConfidence(0)).toBe(0)
      expect(normalizeConfidence(1)).toBe(1)
    })

    it('should convert percentage values to 0-1', () => {
      expect(normalizeConfidence(85)).toBe(0.85)
      expect(normalizeConfidence(100)).toBe(1)
      expect(normalizeConfidence(50)).toBe(0.5)
    })

    it('should clamp values to valid range', () => {
      expect(normalizeConfidence(-0.5)).toBe(0)
      // 1.5 is > 1, so treated as percentage (1.5/100 = 0.015), not clamped
      expect(normalizeConfidence(1.5)).toBeCloseTo(0.015, 5)
      expect(normalizeConfidence(150)).toBe(1) // 150% clamped to 1
    })
  })

  describe('getConfidenceLevelFromScore', () => {
    it('should return high for scores >= 0.8', () => {
      expect(getConfidenceLevelFromScore(0.8)).toBe('high')
      expect(getConfidenceLevelFromScore(0.95)).toBe('high')
      expect(getConfidenceLevelFromScore(1)).toBe('high')
    })

    it('should return medium for scores >= 0.6 and < 0.8', () => {
      expect(getConfidenceLevelFromScore(0.6)).toBe('medium')
      expect(getConfidenceLevelFromScore(0.7)).toBe('medium')
      expect(getConfidenceLevelFromScore(0.79)).toBe('medium')
    })

    it('should return low for scores < 0.6', () => {
      expect(getConfidenceLevelFromScore(0.59)).toBe('low')
      expect(getConfidenceLevelFromScore(0.3)).toBe('low')
      expect(getConfidenceLevelFromScore(0)).toBe('low')
    })

    it('should return unknown for null', () => {
      expect(getConfidenceLevelFromScore(null)).toBe('unknown')
    })
  })

  describe('extractConfidenceFromToolResults', () => {
    it('should extract confidence from query_knowledge_base results', () => {
      const toolResults = [
        {
          result: JSON.stringify({
            data: {
              findings: [
                { confidence: 0.85, sourceDocument: 'report.pdf' },
                { confidence: 0.7, sourceDocument: 'draft.docx' },
              ],
            },
          }),
        },
      ]

      const extracted = extractConfidenceFromToolResults(toolResults)

      expect(extracted).toHaveLength(2)
      expect(extracted[0]?.score).toBe(0.85)
      expect(extracted[0]?.sourceDocument).toBe('report.pdf')
      expect(extracted[1]?.score).toBe(0.7)
    })

    it('should handle direct findings array', () => {
      const toolResults = [
        {
          result: JSON.stringify({
            findings: [{ confidence: 0.9, sourceDocument: 'audit.pdf' }],
          }),
        },
      ]

      const extracted = extractConfidenceFromToolResults(toolResults)

      expect(extracted).toHaveLength(1)
      expect(extracted[0]?.score).toBe(0.9)
    })

    it('should handle object output (non-string)', () => {
      const toolResults = [
        {
          result: {
            data: {
              findings: [{ confidence: 0.75 }],
            },
          },
        },
      ]

      const extracted = extractConfidenceFromToolResults(toolResults)

      expect(extracted).toHaveLength(1)
      expect(extracted[0]?.score).toBe(0.75)
    })

    it('should return empty array for invalid input', () => {
      expect(extractConfidenceFromToolResults(null)).toEqual([])
      expect(extractConfidenceFromToolResults(undefined)).toEqual([])
      expect(extractConfidenceFromToolResults([])).toEqual([])
      expect(extractConfidenceFromToolResults('not an array')).toEqual([])
    })

    it('should skip results without confidence', () => {
      const toolResults = [
        {
          result: JSON.stringify({
            data: {
              findings: [
                { text: 'no confidence here' },
                { confidence: 0.8, sourceDocument: 'with-confidence.pdf' },
              ],
            },
          }),
        },
      ]

      const extracted = extractConfidenceFromToolResults(toolResults)

      expect(extracted).toHaveLength(1)
      expect(extracted[0]?.score).toBe(0.8)
    })
  })

  describe('aggregateConfidence', () => {
    it('should return lowest confidence as primary score', () => {
      const confidences: ConfidenceData[] = [
        { score: 0.9 },
        { score: 0.6 },
        { score: 0.8 },
      ]

      const aggregated = aggregateConfidence(confidences)

      expect(aggregated.lowest).toBe(0.6)
      expect(aggregated.highest).toBe(0.9)
      expect(aggregated.level).toBe('medium') // Based on lowest
    })

    it('should calculate average correctly', () => {
      const confidences: ConfidenceData[] = [
        { score: 0.6 },
        { score: 0.8 },
        { score: 1.0 },
      ]

      const aggregated = aggregateConfidence(confidences)

      // Use toBeCloseTo for floating point comparison
      expect(aggregated.average).toBeCloseTo(0.8, 10)
    })

    it('should detect variance when spread > 0.2', () => {
      const withVariance: ConfidenceData[] = [
        { score: 0.5 },
        { score: 0.9 },
      ]
      const withoutVariance: ConfidenceData[] = [
        { score: 0.75 },
        { score: 0.85 },
      ]

      expect(aggregateConfidence(withVariance).hasVariance).toBe(true)
      expect(aggregateConfidence(withoutVariance).hasVariance).toBe(false)
    })

    it('should return default medium confidence for empty array', () => {
      const aggregated = aggregateConfidence([])

      expect(aggregated.lowest).toBe(CONFIDENCE_THRESHOLDS.DEFAULT)
      expect(aggregated.count).toBe(0)
      expect(aggregated.level).toBe('medium')
    })

    it('should track count correctly', () => {
      const confidences: ConfidenceData[] = [
        { score: 0.7 },
        { score: 0.8 },
        { score: 0.9 },
      ]

      const aggregated = aggregateConfidence(confidences)

      expect(aggregated.count).toBe(3)
      expect(aggregated.items).toHaveLength(3)
    })
  })

  describe('extractAndAggregateConfidence', () => {
    it('should extract and aggregate in one call', () => {
      const toolResults = [
        {
          result: JSON.stringify({
            data: {
              findings: [
                { confidence: 0.9 },
                { confidence: 0.5 },
              ],
            },
          }),
        },
      ]

      const result = extractAndAggregateConfidence(toolResults)

      expect(result).not.toBeNull()
      expect(result?.lowest).toBe(0.5)
      expect(result?.highest).toBe(0.9)
      expect(result?.level).toBe('low')
    })

    it('should return null when no confidence found', () => {
      const toolResults = [
        {
          result: JSON.stringify({ data: { findings: [] } }),
        },
      ]

      const result = extractAndAggregateConfidence(toolResults)

      expect(result).toBeNull()
    })
  })

  describe('getDefaultConfidence', () => {
    it('should return medium confidence defaults', () => {
      const defaultConf = getDefaultConfidence()

      expect(defaultConf.level).toBe('medium')
      expect(defaultConf.lowest).toBe(CONFIDENCE_THRESHOLDS.DEFAULT)
      expect(defaultConf.count).toBe(0)
      expect(defaultConf.hasVariance).toBe(false)
    })
  })
})
