/**
 * Confidence Reasoning Utilities Tests
 *
 * Story: E5.7 - Implement Confidence Indicators and Uncertainty Handling
 * AC: #3 (Badge Tooltip with Reasoning), #7 (P2 Compliance - No Raw Scores)
 */

import { describe, it, expect } from 'vitest'
import {
  generateConfidenceReasoning,
  generateAggregatedReasoning,
  getInlineConfidencePhrase,
  getSuggestedNextSteps,
  formatConfidenceForDisplay,
  CONFIDENCE_LEVEL_LABELS,
  CONFIDENCE_LEVEL_DESCRIPTIONS,
} from '@/lib/utils/confidence-reasoning'
import type { AggregatedConfidence, ConfidenceFactor } from '@/lib/utils/confidence'

describe('confidence reasoning utilities', () => {
  describe('generateConfidenceReasoning', () => {
    it('should generate reasoning for high confidence', () => {
      const reasoning = generateConfidenceReasoning(0.9)

      expect(reasoning.level).toBe('high')
      expect(reasoning.label).toBe('High confidence')
      expect(reasoning.description).toContain('authoritative')
      expect(reasoning.factors.length).toBeGreaterThan(0)
    })

    it('should generate reasoning for medium confidence', () => {
      const reasoning = generateConfidenceReasoning(0.7)

      expect(reasoning.level).toBe('medium')
      expect(reasoning.label).toBe('Moderate confidence')
      expect(reasoning.description).toContain('verification')
    })

    it('should generate reasoning for low confidence', () => {
      const reasoning = generateConfidenceReasoning(0.4)

      expect(reasoning.level).toBe('low')
      expect(reasoning.label).toBe('Limited confidence')
      expect(reasoning.description).toContain('review')
    })

    it('should generate reasoning for unknown (null) confidence', () => {
      const reasoning = generateConfidenceReasoning(null)

      expect(reasoning.level).toBe('unknown')
      expect(reasoning.label).toBe('Confidence not determined')
    })

    it('should include provided factors in reasoning', () => {
      const factors: ConfidenceFactor[] = [
        { type: 'source_quality', value: 'audited financials', impact: 'positive' },
        { type: 'number_of_sources', value: '3', impact: 'positive' },
      ]

      const reasoning = generateConfidenceReasoning(0.9, factors)

      expect(reasoning.factors).toContain('from the audited financials')
      expect(reasoning.factors).toContain('corroborated by 3 sources')
    })

    it('should translate source_quality factors correctly', () => {
      const testCases: Array<{ input: string; expected: string }> = [
        { input: 'audited financials', expected: 'from the audited financials' },
        { input: 'internal draft', expected: 'from an internal draft' },
        { input: 'management presentation', expected: 'from a management presentation' },
      ]

      for (const { input, expected } of testCases) {
        const factors: ConfidenceFactor[] = [
          { type: 'source_quality', value: input, impact: 'positive' },
        ]
        const reasoning = generateConfidenceReasoning(0.8, factors)
        expect(reasoning.factors).toContain(expected)
      }
    })
  })

  describe('generateAggregatedReasoning', () => {
    it('should use lowest confidence for base reasoning', () => {
      const aggregated: AggregatedConfidence = {
        lowest: 0.5,
        highest: 0.9,
        average: 0.7,
        count: 3,
        items: [
          { score: 0.5, sourceDocument: 'draft.docx' },
          { score: 0.7, sourceDocument: 'report.pdf' },
          { score: 0.9, sourceDocument: 'audit.pdf' },
        ],
        hasVariance: true,
        level: 'low',
      }

      const reasoning = generateAggregatedReasoning(aggregated)

      expect(reasoning.level).toBe('low')
      expect(reasoning.label).toBe('Limited confidence')
    })

    it('should include range explanation when variance exists', () => {
      const aggregated: AggregatedConfidence = {
        lowest: 0.5,
        highest: 0.9,
        average: 0.7,
        count: 2,
        items: [
          { score: 0.5 },
          { score: 0.9 },
        ],
        hasVariance: true,
        level: 'low',
      }

      const reasoning = generateAggregatedReasoning(aggregated)

      expect(reasoning.rangeExplanation).toBeDefined()
      expect(reasoning.rangeExplanation).toContain('2 sources')
      expect(reasoning.rangeExplanation).toContain('varying reliability')
    })

    it('should not include range explanation for single source', () => {
      const aggregated: AggregatedConfidence = {
        lowest: 0.8,
        highest: 0.8,
        average: 0.8,
        count: 1,
        items: [{ score: 0.8 }],
        hasVariance: false,
        level: 'high',
      }

      const reasoning = generateAggregatedReasoning(aggregated)

      expect(reasoning.rangeExplanation).toBeUndefined()
    })

    it('should collect factors from all items', () => {
      const aggregated: AggregatedConfidence = {
        lowest: 0.7,
        highest: 0.9,
        average: 0.8,
        count: 2,
        items: [
          {
            score: 0.7,
            sourceDocument: 'draft.docx',
            factors: [{ type: 'source_quality', value: 'draft', impact: 'negative' }],
          },
          {
            score: 0.9,
            sourceDocument: 'audit.pdf',
            factors: [{ type: 'source_quality', value: 'audit', impact: 'positive' }],
          },
        ],
        hasVariance: true,
        level: 'medium',
      }

      const reasoning = generateAggregatedReasoning(aggregated)

      // Should have source documents in factors
      expect(reasoning.factors.some(f => f.includes('draft.docx'))).toBe(true)
      expect(reasoning.factors.some(f => f.includes('audit.pdf'))).toBe(true)
    })
  })

  describe('getInlineConfidencePhrase', () => {
    it('should return empty string for high confidence', () => {
      expect(getInlineConfidencePhrase('high')).toBe('')
    })

    it('should return caveat for medium confidence', () => {
      const phrase = getInlineConfidencePhrase('medium')
      expect(phrase).toBe('Based on available data, ')
    })

    it('should return stronger caveat for low confidence', () => {
      const phrase = getInlineConfidencePhrase('low')
      expect(phrase).toContain('not fully certain')
    })

    it('should return caveat for unknown confidence', () => {
      const phrase = getInlineConfidencePhrase('unknown')
      expect(phrase).toContain('Unable to verify')
    })
  })

  describe('getSuggestedNextSteps', () => {
    it('should return empty array for high confidence', () => {
      const steps = getSuggestedNextSteps('high')
      expect(steps).toEqual([])
    })

    it('should suggest Q&A and gap flagging for low confidence', () => {
      const steps = getSuggestedNextSteps('low')
      expect(steps.some(s => s.includes('Q&A'))).toBe(true)
      expect(steps.some(s => s.includes('gap'))).toBe(true)
    })

    it('should suggest additional sources for medium confidence', () => {
      const steps = getSuggestedNextSteps('medium')
      expect(steps.some(s => s.includes('additional sources'))).toBe(true)
    })

    it('should include context-specific suggestion when provided', () => {
      const steps = getSuggestedNextSteps('medium', 'revenue data')
      expect(steps.some(s => s.includes('revenue data'))).toBe(true)
    })
  })

  describe('formatConfidenceForDisplay (P2 compliance)', () => {
    it('should never return raw numbers', () => {
      const testScores = [0, 0.3, 0.5, 0.7, 0.85, 1.0, null]

      for (const score of testScores) {
        const formatted = formatConfidenceForDisplay(score)
        // Should not contain numbers (except possibly in words like "not")
        expect(formatted).not.toMatch(/\d+%/)
        expect(formatted).not.toMatch(/0\.\d+/)
        // Should be a human-readable label
        expect(Object.values(CONFIDENCE_LEVEL_LABELS)).toContain(formatted)
      }
    })

    it('should return correct labels for each level', () => {
      expect(formatConfidenceForDisplay(0.9)).toBe('High confidence')
      expect(formatConfidenceForDisplay(0.7)).toBe('Moderate confidence')
      expect(formatConfidenceForDisplay(0.4)).toBe('Limited confidence')
      expect(formatConfidenceForDisplay(null)).toBe('Confidence not determined')
    })
  })

  describe('CONFIDENCE_LEVEL_LABELS', () => {
    it('should have labels for all levels', () => {
      expect(CONFIDENCE_LEVEL_LABELS.high).toBeDefined()
      expect(CONFIDENCE_LEVEL_LABELS.medium).toBeDefined()
      expect(CONFIDENCE_LEVEL_LABELS.low).toBeDefined()
      expect(CONFIDENCE_LEVEL_LABELS.unknown).toBeDefined()
    })

    it('should not contain raw scores in labels', () => {
      Object.values(CONFIDENCE_LEVEL_LABELS).forEach(label => {
        expect(label).not.toMatch(/\d+%/)
        expect(label).not.toMatch(/0\.\d+/)
      })
    })
  })

  describe('CONFIDENCE_LEVEL_DESCRIPTIONS', () => {
    it('should have descriptions for all levels', () => {
      expect(CONFIDENCE_LEVEL_DESCRIPTIONS.high).toBeDefined()
      expect(CONFIDENCE_LEVEL_DESCRIPTIONS.medium).toBeDefined()
      expect(CONFIDENCE_LEVEL_DESCRIPTIONS.low).toBeDefined()
      expect(CONFIDENCE_LEVEL_DESCRIPTIONS.unknown).toBeDefined()
    })
  })
})
