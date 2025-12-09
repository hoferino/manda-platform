/**
 * Unit tests for Finding to Q&A Mapping Utilities
 * Story: E8.5 - Finding → Q&A Quick-Add (AC: #2, #3)
 *
 * Tests:
 * - Domain to Q&A category mapping
 * - Question generation from findings
 * - Text truncation
 * - Priority suggestion
 */

import { describe, it, expect } from 'vitest'
import {
  mapDomainToQACategory,
  generateQuestionFromFinding,
  truncateFindingText,
  isContradictionFinding,
  suggestQAPriority,
  generateCustomQuestion,
} from './finding-qa-mapping'
import type { Finding, FindingDomain, FindingType } from '@/lib/types/findings'

// Helper to create a mock finding
function createMockFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'finding-1',
    dealId: 'deal-1',
    documentId: 'doc-1',
    chunkId: 'chunk-1',
    userId: 'user-1',
    text: 'Revenue decreased by 15% in Q3 2024.',
    sourceDocument: 'financials.xlsx',
    pageNumber: 1,
    confidence: 0.85,
    findingType: 'metric',
    domain: 'financial',
    status: 'pending',
    validationHistory: [],
    metadata: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: null,
    ...overrides,
  }
}

describe('mapDomainToQACategory', () => {
  it('maps financial domain to Financials category', () => {
    expect(mapDomainToQACategory('financial')).toBe('Financials')
  })

  it('maps operational domain to Operations category', () => {
    expect(mapDomainToQACategory('operational')).toBe('Operations')
  })

  it('maps market domain to Market category', () => {
    expect(mapDomainToQACategory('market')).toBe('Market')
  })

  it('maps legal domain to Legal category', () => {
    expect(mapDomainToQACategory('legal')).toBe('Legal')
  })

  it('maps technical domain to Technology category', () => {
    expect(mapDomainToQACategory('technical')).toBe('Technology')
  })

  it('returns Operations as default for null domain', () => {
    expect(mapDomainToQACategory(null)).toBe('Operations')
  })

  it('returns Operations as default for undefined domain', () => {
    expect(mapDomainToQACategory(undefined)).toBe('Operations')
  })

  it('handles all FindingDomain values without errors', () => {
    const domains: FindingDomain[] = ['financial', 'operational', 'market', 'legal', 'technical']
    for (const domain of domains) {
      expect(() => mapDomainToQACategory(domain)).not.toThrow()
      expect(mapDomainToQACategory(domain)).toBeTruthy()
    }
  })
})

describe('truncateFindingText', () => {
  it('returns short text unchanged', () => {
    const text = 'Short finding text'
    expect(truncateFindingText(text)).toBe(text)
  })

  it('truncates text longer than 500 chars with ellipsis', () => {
    const longText = 'A'.repeat(600)
    const result = truncateFindingText(longText)
    expect(result.length).toBe(503) // 500 + "..."
    expect(result.endsWith('...')).toBe(true)
  })

  it('respects custom maxLength parameter', () => {
    const text = 'This is a medium length text'
    const result = truncateFindingText(text, 10)
    expect(result).toBe('This is a...')
  })

  it('does not truncate text at exactly max length', () => {
    const text = 'A'.repeat(500)
    expect(truncateFindingText(text)).toBe(text)
  })

  it('handles empty string', () => {
    expect(truncateFindingText('')).toBe('')
  })
})

describe('isContradictionFinding', () => {
  it('returns true for contradiction type', () => {
    expect(isContradictionFinding('contradiction')).toBe(true)
  })

  it('returns false for other types', () => {
    const otherTypes: FindingType[] = ['metric', 'fact', 'risk', 'opportunity']
    for (const type of otherTypes) {
      expect(isContradictionFinding(type)).toBe(false)
    }
  })

  it('returns false for null', () => {
    expect(isContradictionFinding(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isContradictionFinding(undefined)).toBe(false)
  })
})

describe('generateQuestionFromFinding', () => {
  it('generates standard clarification question for regular findings', () => {
    const finding = createMockFinding({ findingType: 'fact' })
    const question = generateQuestionFromFinding(finding)
    expect(question).toContain('Can you provide clarification')
    expect(question).toContain(finding.text)
  })

  it('generates contradiction-specific question for contradiction findings', () => {
    const finding = createMockFinding({
      findingType: 'contradiction',
      text: 'Revenue figures in Q3 report differ from Q4 projections. This creates confusion.',
    })
    const question = generateQuestionFromFinding(finding)
    expect(question).toContain('potential inconsistency')
    expect(question).toContain('Revenue figures in Q3 report differ from Q4 projections')
    expect(question).toContain('additional documentation or clarification')
  })

  it('generates metric-specific question for metric findings', () => {
    const finding = createMockFinding({ findingType: 'metric' })
    const question = generateQuestionFromFinding(finding)
    expect(question).toContain('provide documentation supporting')
    expect(question).toContain(finding.text)
  })

  it('generates risk-specific question for risk findings', () => {
    const finding = createMockFinding({
      findingType: 'risk',
      text: 'Cybersecurity vulnerabilities identified in payment system.',
    })
    const question = generateQuestionFromFinding(finding)
    expect(question).toContain('risk identified')
    expect(question).toContain('how this is being addressed')
  })

  it('truncates very long finding text in the question', () => {
    const longText = 'X'.repeat(600)
    const finding = createMockFinding({ text: longText, findingType: 'fact' })
    const question = generateQuestionFromFinding(finding)
    expect(question.length).toBeLessThan(700)
    expect(question).toContain('...')
  })

  it('handles findings with null type using default question format', () => {
    const finding = createMockFinding({ findingType: null })
    const question = generateQuestionFromFinding(finding)
    expect(question).toContain('Can you provide clarification')
  })

  it('extracts topic from first sentence for contradiction findings', () => {
    const finding = createMockFinding({
      findingType: 'contradiction',
      text: 'Employee count is 150. However, another document states 200 employees.',
    })
    const question = generateQuestionFromFinding(finding)
    // Should include the first sentence as the topic
    expect(question).toContain('Employee count is 150')
  })

  it('truncates long topics in contradiction questions', () => {
    const longTopic = 'Y'.repeat(150)
    const finding = createMockFinding({
      findingType: 'contradiction',
      text: longTopic + '. This contradicts other data.',
    })
    const question = generateQuestionFromFinding(finding)
    // Topic should be truncated to ~100 chars
    expect(question).toContain('...')
  })
})

describe('generateCustomQuestion', () => {
  it('generates question with custom prefix and suffix', () => {
    const finding = createMockFinding()
    const question = generateCustomQuestion(finding, 'Question about: ', ' Please explain.')
    expect(question).toContain('Question about:')
    expect(question).toContain(finding.text)
    expect(question).toContain('Please explain.')
  })

  it('uses default prefix and suffix when not provided', () => {
    const finding = createMockFinding()
    const question = generateCustomQuestion(finding)
    expect(question).toContain('Regarding:')
    expect(question).toContain('Can you please clarify?')
  })
})

describe('suggestQAPriority', () => {
  it('returns high priority for contradiction findings', () => {
    const finding = createMockFinding({ findingType: 'contradiction' })
    expect(suggestQAPriority(finding)).toBe('high')
  })

  it('returns high priority for risk findings', () => {
    const finding = createMockFinding({ findingType: 'risk' })
    expect(suggestQAPriority(finding)).toBe('high')
  })

  it('returns high priority for low confidence findings', () => {
    const finding = createMockFinding({ confidence: 0.5 })
    expect(suggestQAPriority(finding)).toBe('high')
  })

  it('returns medium priority for medium confidence findings', () => {
    const finding = createMockFinding({ confidence: 0.7 })
    expect(suggestQAPriority(finding)).toBe('medium')
  })

  it('returns medium priority for high confidence findings', () => {
    const finding = createMockFinding({ confidence: 0.9 })
    expect(suggestQAPriority(finding)).toBe('medium')
  })

  it('returns medium priority for null confidence', () => {
    const finding = createMockFinding({ confidence: null })
    expect(suggestQAPriority(finding)).toBe('medium')
  })

  it('returns high priority for exactly 0.6 confidence threshold', () => {
    const finding = createMockFinding({ confidence: 0.59 })
    expect(suggestQAPriority(finding)).toBe('high')
  })

  it('returns medium priority at exactly 0.6 confidence', () => {
    const finding = createMockFinding({ confidence: 0.6 })
    expect(suggestQAPriority(finding)).toBe('medium')
  })
})
