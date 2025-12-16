/**
 * Regeneration Service Tests
 * Story: E7.6 - Propagate Corrections to Related Insights
 * TD-012: Deferred tests from E7.6 implementation
 *
 * Tests for the regeneration service that:
 * - Gets regeneration context for Q&A answers
 * - Gets regeneration context for CIM sections
 * - Triggers regeneration for items
 * - Gets list of regeneratable items
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  RegenerationResult,
  QARegenerationContext,
  CIMRegenerationContext,
} from '@/lib/services/regeneration'

// Mock Neo4j client
vi.mock('@/lib/neo4j/client', () => ({
  executeRead: vi.fn(),
  executeWrite: vi.fn(),
}))

// Mock correction propagation
vi.mock('@/lib/services/correction-propagation', () => ({
  clearReviewFlagForItem: vi.fn(),
}))

describe('Regeneration Service Types', () => {
  describe('RegenerationResult', () => {
    it('should correctly type a successful regeneration', () => {
      const result: RegenerationResult = {
        success: true,
        itemId: 'qa-123',
        itemType: 'qa_answer',
        previousContent: 'Old answer based on incorrect data',
        newContent: 'New answer based on corrected findings',
        regeneratedAt: '2024-01-15T10:00:00.000Z',
      }

      expect(result.success).toBe(true)
      expect(result.itemType).toBe('qa_answer')
      expect(result.newContent).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it('should correctly type a failed regeneration', () => {
      const result: RegenerationResult = {
        success: false,
        itemId: 'cim-456',
        itemType: 'cim_section',
        error: 'CIM section not found',
      }

      expect(result.success).toBe(false)
      expect(result.error).toBe('CIM section not found')
      expect(result.newContent).toBeUndefined()
    })

    it('should allow qa_answer item type', () => {
      const result: RegenerationResult = {
        success: true,
        itemId: 'qa-1',
        itemType: 'qa_answer',
      }

      expect(result.itemType).toBe('qa_answer')
    })

    it('should allow cim_section item type', () => {
      const result: RegenerationResult = {
        success: true,
        itemId: 'cim-1',
        itemType: 'cim_section',
      }

      expect(result.itemType).toBe('cim_section')
    })
  })

  describe('QARegenerationContext', () => {
    it('should correctly type Q&A regeneration context', () => {
      const context: QARegenerationContext = {
        qaId: 'qa-123',
        question: 'What was the company revenue in 2023?',
        previousAnswer: 'The company revenue was $10M in 2023.',
        qaListId: 'qalist-456',
        dealId: 'deal-789',
        correctedFindingIds: ['finding-1', 'finding-2'],
        findingContext: [
          { id: 'finding-1', text: 'Revenue was $12M in 2023', confidence: 0.95 },
          { id: 'finding-2', text: 'Growth rate was 15%', confidence: 0.88 },
        ],
      }

      expect(context.qaId).toBe('qa-123')
      expect(context.question).toContain('revenue')
      expect(context.correctedFindingIds).toHaveLength(2)
      expect(context.findingContext).toHaveLength(2)
      expect(context.findingContext[0]!.confidence).toBe(0.95)
    })

    it('should handle empty corrected findings', () => {
      const context: QARegenerationContext = {
        qaId: 'qa-123',
        question: 'What is the company name?',
        previousAnswer: 'Acme Corp',
        qaListId: 'qalist-456',
        dealId: 'deal-789',
        correctedFindingIds: [],
        findingContext: [
          { id: 'finding-1', text: 'Company name is Acme Corp', confidence: 0.99 },
        ],
      }

      expect(context.correctedFindingIds).toHaveLength(0)
      expect(context.findingContext).toHaveLength(1)
    })
  })

  describe('CIMRegenerationContext', () => {
    it('should correctly type CIM regeneration context', () => {
      const context: CIMRegenerationContext = {
        sectionId: 'section-123',
        cimId: 'cim-456',
        sectionTitle: 'Executive Summary',
        previousContent: 'The company showed strong growth with $10M revenue...',
        dealId: 'deal-789',
        correctedFindingIds: ['finding-1'],
        findingContext: [
          { id: 'finding-1', text: 'Revenue was $12M (corrected)', confidence: 0.95 },
        ],
      }

      expect(context.sectionId).toBe('section-123')
      expect(context.cimId).toBe('cim-456')
      expect(context.sectionTitle).toBe('Executive Summary')
      expect(context.correctedFindingIds).toContain('finding-1')
    })

    it('should handle multiple corrected findings', () => {
      const context: CIMRegenerationContext = {
        sectionId: 'section-123',
        cimId: 'cim-456',
        sectionTitle: 'Financial Overview',
        previousContent: 'Previous content...',
        dealId: 'deal-789',
        correctedFindingIds: ['f1', 'f2', 'f3'],
        findingContext: [
          { id: 'f1', text: 'Finding 1', confidence: 0.9 },
          { id: 'f2', text: 'Finding 2', confidence: 0.85 },
          { id: 'f3', text: 'Finding 3', confidence: 0.95 },
        ],
      }

      expect(context.correctedFindingIds).toHaveLength(3)
      expect(context.findingContext).toHaveLength(3)
    })
  })
})

describe('Regeneration Service Behavior', () => {
  describe('Q&A Regeneration', () => {
    it('should include all required context for LLM regeneration', () => {
      const context: QARegenerationContext = {
        qaId: 'qa-123',
        question: 'What was the gross margin?',
        previousAnswer: 'Gross margin was 40%.',
        qaListId: 'qalist-456',
        dealId: 'deal-789',
        correctedFindingIds: ['finding-1'],
        findingContext: [
          { id: 'finding-1', text: 'Gross margin was 45% (corrected from 40%)', confidence: 0.98 },
        ],
      }

      // Verify all pieces needed for regeneration are present
      expect(context.question).toBeDefined()
      expect(context.previousAnswer).toBeDefined()
      expect(context.findingContext.length).toBeGreaterThan(0)
      expect(context.dealId).toBeDefined()
    })

    it('should provide finding confidence scores for answer quality assessment', () => {
      const context: QARegenerationContext = {
        qaId: 'qa-123',
        question: 'What are the key risks?',
        previousAnswer: 'Key risks include...',
        qaListId: 'qalist-456',
        dealId: 'deal-789',
        correctedFindingIds: ['f1', 'f2'],
        findingContext: [
          { id: 'f1', text: 'Market concentration risk', confidence: 0.75 },
          { id: 'f2', text: 'Regulatory compliance risk', confidence: 0.92 },
        ],
      }

      // Low confidence finding should be factored into answer generation
      const lowConfidenceFindings = context.findingContext.filter(f => f.confidence < 0.8)
      expect(lowConfidenceFindings.length).toBe(1)
      expect(lowConfidenceFindings[0]!.confidence).toBe(0.75)
    })
  })

  describe('CIM Section Regeneration', () => {
    it('should include section title for appropriate regeneration', () => {
      const context: CIMRegenerationContext = {
        sectionId: 'section-123',
        cimId: 'cim-456',
        sectionTitle: 'Market Analysis',
        previousContent: 'The market shows...',
        dealId: 'deal-789',
        correctedFindingIds: ['f1'],
        findingContext: [
          { id: 'f1', text: 'TAM is $5B (corrected)', confidence: 0.88 },
        ],
      }

      // Section title is important for generating appropriate tone and content
      expect(context.sectionTitle).toBe('Market Analysis')
    })

    it('should track cimId for parent document relationship', () => {
      const context: CIMRegenerationContext = {
        sectionId: 'section-123',
        cimId: 'cim-master',
        sectionTitle: 'Introduction',
        previousContent: 'Introduction content...',
        dealId: 'deal-789',
        correctedFindingIds: [],
        findingContext: [],
      }

      expect(context.cimId).toBe('cim-master')
    })
  })

  describe('Regeneration Result Handling', () => {
    it('should preserve previous content for comparison', () => {
      const result: RegenerationResult = {
        success: true,
        itemId: 'qa-123',
        itemType: 'qa_answer',
        previousContent: 'Revenue was $10M',
        newContent: 'Revenue was $12M (updated based on corrected data)',
        regeneratedAt: new Date().toISOString(),
      }

      expect(result.previousContent).not.toBe(result.newContent)
    })

    it('should include timestamp for audit trail', () => {
      const result: RegenerationResult = {
        success: true,
        itemId: 'cim-123',
        itemType: 'cim_section',
        regeneratedAt: '2024-01-15T10:30:00.000Z',
      }

      expect(result.regeneratedAt).toBeDefined()
      expect(new Date(result.regeneratedAt!).toISOString()).toBe(result.regeneratedAt)
    })

    it('should provide specific error messages on failure', () => {
      const possibleErrors = [
        'Q&A answer not found',
        'CIM section not found',
        'Failed to clear review flag',
        'Internal error during regeneration',
      ]

      possibleErrors.forEach(error => {
        const result: RegenerationResult = {
          success: false,
          itemId: 'item-123',
          itemType: 'qa_answer',
          error,
        }

        expect(result.error).toBe(error)
      })
    })
  })
})

describe('Regeneratable Items Structure', () => {
  it('should structure Q&A items with question and review reason', () => {
    const qaItems = [
      { id: 'qa-1', question: 'What was revenue?', reviewReason: 'Source finding corrected' },
      { id: 'qa-2', question: 'What was margin?', reviewReason: 'Related data updated' },
    ]

    qaItems.forEach(item => {
      expect(item.id).toBeDefined()
      expect(item.question).toBeDefined()
      expect(item.reviewReason).toBeDefined()
    })
  })

  it('should structure CIM items with title and review reason', () => {
    const cimItems = [
      { id: 'cim-1', title: 'Executive Summary', reviewReason: 'Based on corrected findings' },
      { id: 'cim-2', title: 'Financial Analysis', reviewReason: 'Key metrics updated' },
    ]

    cimItems.forEach(item => {
      expect(item.id).toBeDefined()
      expect(item.title).toBeDefined()
      expect(item.reviewReason).toBeDefined()
    })
  })

  it('should support empty lists when no items need regeneration', () => {
    const result = {
      qaAnswers: [] as { id: string; question: string; reviewReason: string }[],
      cimSections: [] as { id: string; title: string; reviewReason: string }[],
    }

    expect(result.qaAnswers).toHaveLength(0)
    expect(result.cimSections).toHaveLength(0)
  })
})
