/**
 * Correction Propagation Service Tests
 * Story: E7.6 - Propagate Corrections to Related Insights
 * TD-012: Deferred tests from E7.6 implementation
 *
 * Tests for the correction propagation service that:
 * - Finds dependent insights, Q&A answers, CIM sections
 * - Flags dependent items for review
 * - Generates impact summaries
 * - Manages review queue
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateImpactSummary,
  ReviewQueueCount,
  ReviewQueueItem,
} from '@/lib/services/correction-propagation'
import type {
  DependentInsight,
  PropagationResult,
} from '@/lib/types/feedback'

// Mock Neo4j client
vi.mock('@/lib/neo4j/client', () => ({
  executeRead: vi.fn(),
  executeWrite: vi.fn(),
}))

// Mock Supabase client type
const mockSupabaseClient = {
  from: vi.fn(),
  auth: {
    getUser: vi.fn(),
  },
}

describe('Correction Propagation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateImpactSummary', () => {
    it('returns "no dependent items" message when no dependents exist', () => {
      const result: PropagationResult = {
        success: true,
        dependentCount: 0,
        flaggedCount: 0,
        dependentInsights: [],
      }

      const summary = generateImpactSummary(result)

      expect(summary).toBe('No dependent items require review.')
    })

    it('generates summary for findings only', () => {
      const result: PropagationResult = {
        success: true,
        dependentCount: 3,
        flaggedCount: 3,
        dependentInsights: [
          { id: '1', type: 'finding', title: 'Finding 1', flaggedForReview: true },
          { id: '2', type: 'finding', title: 'Finding 2', flaggedForReview: true },
          { id: '3', type: 'finding', title: 'Finding 3', flaggedForReview: true },
        ],
      }

      const summary = generateImpactSummary(result)

      expect(summary).toContain('3 related findings')
      expect(summary).toContain('flagged for review')
    })

    it('generates summary for Q&A answers only', () => {
      const result: PropagationResult = {
        success: true,
        dependentCount: 2,
        flaggedCount: 2,
        dependentInsights: [
          { id: '1', type: 'qa_answer', title: 'Question 1', flaggedForReview: true },
          { id: '2', type: 'qa_answer', title: 'Question 2', flaggedForReview: true },
        ],
      }

      const summary = generateImpactSummary(result)

      expect(summary).toContain('2 Q&A answers')
      expect(summary).toContain('flagged for review')
    })

    it('generates summary for CIM sections only', () => {
      const result: PropagationResult = {
        success: true,
        dependentCount: 1,
        flaggedCount: 1,
        dependentInsights: [
          { id: '1', type: 'cim_section', title: 'Section 1', flaggedForReview: true },
        ],
      }

      const summary = generateImpactSummary(result)

      expect(summary).toContain('1 CIM sections')
      expect(summary).toContain('flagged for review')
    })

    it('generates summary for insights only', () => {
      const result: PropagationResult = {
        success: true,
        dependentCount: 2,
        flaggedCount: 2,
        dependentInsights: [
          { id: '1', type: 'insight', title: 'Insight 1', flaggedForReview: true },
          { id: '2', type: 'insight', title: 'Insight 2', flaggedForReview: true },
        ],
      }

      const summary = generateImpactSummary(result)

      expect(summary).toContain('2 insights')
      expect(summary).toContain('flagged for review')
    })

    it('generates summary for mixed types', () => {
      const result: PropagationResult = {
        success: true,
        dependentCount: 5,
        flaggedCount: 5,
        dependentInsights: [
          { id: '1', type: 'finding', title: 'Finding 1', flaggedForReview: true },
          { id: '2', type: 'qa_answer', title: 'Q&A 1', flaggedForReview: true },
          { id: '3', type: 'qa_answer', title: 'Q&A 2', flaggedForReview: true },
          { id: '4', type: 'cim_section', title: 'CIM 1', flaggedForReview: true },
          { id: '5', type: 'insight', title: 'Insight 1', flaggedForReview: true },
        ],
      }

      const summary = generateImpactSummary(result)

      expect(summary).toContain('related findings')
      expect(summary).toContain('Q&A answers')
      expect(summary).toContain('CIM sections')
      expect(summary).toContain('insights')
      expect(summary).toContain('flagged for review')
    })
  })

  describe('DependentInsight type', () => {
    it('should correctly type finding dependents', () => {
      const dependent: DependentInsight = {
        id: 'dep-123',
        type: 'finding',
        title: 'Revenue increased by 15%',
        flaggedForReview: false,
      }

      expect(dependent.type).toBe('finding')
      expect(dependent.id).toBe('dep-123')
      expect(dependent.flaggedForReview).toBe(false)
    })

    it('should correctly type insight dependents', () => {
      const dependent: DependentInsight = {
        id: 'ins-456',
        type: 'insight',
        title: 'Pattern detected in revenue growth',
        flaggedForReview: true,
      }

      expect(dependent.type).toBe('insight')
      expect(dependent.flaggedForReview).toBe(true)
    })

    it('should correctly type qa_answer dependents', () => {
      const dependent: DependentInsight = {
        id: 'qa-789',
        type: 'qa_answer',
        title: 'What was the revenue last year?',
        flaggedForReview: false,
      }

      expect(dependent.type).toBe('qa_answer')
    })

    it('should correctly type cim_section dependents', () => {
      const dependent: DependentInsight = {
        id: 'cim-101',
        type: 'cim_section',
        title: 'Financial Overview',
        flaggedForReview: true,
      }

      expect(dependent.type).toBe('cim_section')
    })
  })

  describe('ReviewQueueCount type', () => {
    it('should correctly calculate total from all item types', () => {
      const counts: ReviewQueueCount = {
        findings: 5,
        qaAnswers: 3,
        cimSections: 2,
        insights: 4,
        total: 14,
      }

      expect(counts.total).toBe(
        counts.findings + counts.qaAnswers + counts.cimSections + counts.insights
      )
    })

    it('should handle zero counts', () => {
      const counts: ReviewQueueCount = {
        findings: 0,
        qaAnswers: 0,
        cimSections: 0,
        insights: 0,
        total: 0,
      }

      expect(counts.total).toBe(0)
    })
  })

  describe('ReviewQueueItem type', () => {
    it('should correctly type a finding review item', () => {
      const item: ReviewQueueItem = {
        id: 'finding-1',
        type: 'finding',
        title: 'Revenue was $10M last year',
        reviewReason: 'Source finding was corrected',
        createdAt: '2024-01-15T10:00:00.000Z',
        confidence: 0.85,
        domain: 'financial',
        documentId: 'doc-123',
        documentName: 'Annual Report.pdf',
      }

      expect(item.type).toBe('finding')
      expect(item.confidence).toBe(0.85)
      expect(item.documentName).toBe('Annual Report.pdf')
    })

    it('should correctly type a Q&A review item', () => {
      const item: ReviewQueueItem = {
        id: 'qa-1',
        type: 'qa_answer',
        title: 'What was the EBITDA margin?',
        reviewReason: 'Referenced finding was updated',
        createdAt: '2024-01-15T10:00:00.000Z',
        question: 'What was the EBITDA margin?',
        answer: 'The EBITDA margin was 25%.',
      }

      expect(item.type).toBe('qa_answer')
      expect(item.question).toBe('What was the EBITDA margin?')
      expect(item.answer).toContain('25%')
    })

    it('should correctly type a CIM section review item', () => {
      const item: ReviewQueueItem = {
        id: 'cim-1',
        type: 'cim_section',
        title: 'Executive Summary',
        reviewReason: 'Based on corrected findings',
        createdAt: '2024-01-15T10:00:00.000Z',
        sectionTitle: 'Executive Summary',
        cimId: 'cim-main-1',
      }

      expect(item.type).toBe('cim_section')
      expect(item.sectionTitle).toBe('Executive Summary')
      expect(item.cimId).toBe('cim-main-1')
    })

    it('should correctly type an insight review item', () => {
      const item: ReviewQueueItem = {
        id: 'insight-1',
        type: 'insight',
        title: 'Trend analysis shows declining margins',
        reviewReason: 'Underlying data was corrected',
        createdAt: '2024-01-15T10:00:00.000Z',
      }

      expect(item.type).toBe('insight')
      expect(item.confidence).toBeUndefined()
      expect(item.question).toBeUndefined()
    })
  })

  describe('PropagationResult type', () => {
    it('should track successful propagation', () => {
      const result: PropagationResult = {
        success: true,
        dependentCount: 5,
        flaggedCount: 5,
        dependentInsights: [
          { id: '1', type: 'finding', title: 'Test', flaggedForReview: true },
        ],
      }

      expect(result.success).toBe(true)
      expect(result.dependentCount).toBe(5)
      expect(result.flaggedCount).toBe(5)
      expect(result.errors).toBeUndefined()
    })

    it('should track failed propagation with errors', () => {
      const result: PropagationResult = {
        success: false,
        dependentCount: 3,
        flaggedCount: 1,
        dependentInsights: [],
        errors: ['Failed to flag some findings', 'Neo4j connection timeout'],
      }

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(2)
      expect(result.errors![0]).toContain('Failed to flag')
    })

    it('should track partial success', () => {
      const result: PropagationResult = {
        success: true,
        dependentCount: 5,
        flaggedCount: 3, // Only 3 out of 5 flagged
        dependentInsights: [
          { id: '1', type: 'finding', title: 'F1', flaggedForReview: true },
          { id: '2', type: 'qa_answer', title: 'Q1', flaggedForReview: true },
          { id: '3', type: 'cim_section', title: 'C1', flaggedForReview: true },
          { id: '4', type: 'finding', title: 'F2', flaggedForReview: false },
          { id: '5', type: 'insight', title: 'I1', flaggedForReview: false },
        ],
        errors: ['Failed to flag some items in Neo4j'],
      }

      expect(result.flaggedCount).toBeLessThan(result.dependentCount)
      expect(result.dependentInsights.filter(d => d.flaggedForReview)).toHaveLength(3)
    })
  })
})

describe('Impact Summary Edge Cases', () => {
  it('handles empty dependentInsights array', () => {
    const result: PropagationResult = {
      success: true,
      dependentCount: 0,
      flaggedCount: 0,
      dependentInsights: [],
    }

    const summary = generateImpactSummary(result)
    expect(summary).toBe('No dependent items require review.')
  })

  it('handles single item correctly', () => {
    const result: PropagationResult = {
      success: true,
      dependentCount: 1,
      flaggedCount: 1,
      dependentInsights: [
        { id: '1', type: 'finding', title: 'Single finding', flaggedForReview: true },
      ],
    }

    const summary = generateImpactSummary(result)
    expect(summary).toContain('1 related findings')
  })

  it('handles all types present', () => {
    const dependentInsights: DependentInsight[] = [
      { id: '1', type: 'finding', title: 'F1', flaggedForReview: true },
      { id: '2', type: 'finding', title: 'F2', flaggedForReview: true },
      { id: '3', type: 'qa_answer', title: 'Q1', flaggedForReview: true },
      { id: '4', type: 'cim_section', title: 'C1', flaggedForReview: true },
      { id: '5', type: 'insight', title: 'I1', flaggedForReview: true },
      { id: '6', type: 'insight', title: 'I2', flaggedForReview: true },
    ]

    const result: PropagationResult = {
      success: true,
      dependentCount: 6,
      flaggedCount: 6,
      dependentInsights,
    }

    const summary = generateImpactSummary(result)

    // Should mention all types
    expect(summary).toContain('2 related findings')
    expect(summary).toContain('1 Q&A answers')
    expect(summary).toContain('1 CIM sections')
    expect(summary).toContain('2 insights')
  })
})
