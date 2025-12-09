/**
 * Q&A Question Drafting Tests
 *
 * Story: E8.4 - Conversational Q&A Suggestion Flow
 * AC: #2 - The AI drafts a well-formed question based on the conversation context
 */

import { describe, it, expect } from 'vitest'
import {
  draftQAQuestion,
  enhanceQuestion,
  suggestTimePeriod,
  type DraftQuestionOptions,
} from './qa-question'

describe('draftQAQuestion', () => {
  describe('Template matching', () => {
    it('should use template for "revenue" queries', () => {
      const result = draftQAQuestion({ query: "What's the revenue?" })
      expect(result.isTemplated).toBe(true)
      expect(result.question).toContain('revenue')
      expect(result.suggestedPriority).toBe('high')
    })

    it('should use template for "churn" queries', () => {
      const result = draftQAQuestion({ query: 'What is the churn rate?' })
      expect(result.isTemplated).toBe(true)
      expect(result.question).toContain('churn')
      expect(result.question).toContain('monthly')
      expect(result.suggestedPriority).toBe('high')
    })

    it('should use template for "litigation" queries', () => {
      const result = draftQAQuestion({ query: 'Any pending litigation?' })
      expect(result.isTemplated).toBe(true)
      expect(result.question).toContain('litigation')
      expect(result.suggestedPriority).toBe('high')
    })

    it('should use template for "contracts" queries', () => {
      const result = draftQAQuestion({ query: 'What about key contracts?' })
      expect(result.isTemplated).toBe(true)
      expect(result.question).toContain('contract')
      expect(result.suggestedPriority).toBe('high')
    })

    it('should use template for "EBITDA" queries', () => {
      const result = draftQAQuestion({ query: 'Tell me about EBITDA' })
      expect(result.isTemplated).toBe(true)
      expect(result.question).toContain('EBITDA')
    })

    it('should use template for "security" queries', () => {
      const result = draftQAQuestion({ query: 'What about security?' })
      expect(result.isTemplated).toBe(true)
      expect(result.question).toContain('security')
    })

    it('should use template for "headcount" queries', () => {
      const result = draftQAQuestion({ query: 'What is the headcount?' })
      expect(result.isTemplated).toBe(true)
      expect(result.question).toContain('headcount')
    })
  })

  describe('Time period handling', () => {
    it('should include provided time period', () => {
      const result = draftQAQuestion({
        query: 'What is the revenue?',
        timePeriod: 'past 5 years',
      })
      expect(result.question).toContain('past 5 years')
    })

    it('should default to "past 3 years" when no time period provided for templates', () => {
      const result = draftQAQuestion({ query: 'What is the revenue?' })
      expect(result.question).toContain('past 3 years')
    })

    it('should format time period with "for" prefix', () => {
      const result = draftQAQuestion({
        query: 'What is the revenue?',
        timePeriod: '2024',
      })
      expect(result.question).toContain('for 2024')
    })
  })

  describe('Custom question generation', () => {
    it('should create custom question when no template matches', () => {
      const result = draftQAQuestion({ query: 'What about widget production?' })
      expect(result.isTemplated).toBe(false)
      expect(result.question.length).toBeGreaterThan(20)
    })

    it('should include category context in custom questions', () => {
      const result = draftQAQuestion({
        query: 'Tell me about X',
        category: 'Financials',
      })
      expect(result.question).toContain('financial')
    })

    it('should set high priority for Financial custom questions', () => {
      const result = draftQAQuestion({
        query: 'Tell me about X',
        category: 'Financials',
      })
      expect(result.suggestedPriority).toBe('high')
    })

    it('should set high priority for Legal custom questions', () => {
      const result = draftQAQuestion({
        query: 'Tell me about X',
        category: 'Legal',
      })
      expect(result.suggestedPriority).toBe('high')
    })

    it('should set medium priority for other categories', () => {
      const result = draftQAQuestion({
        query: 'Tell me about X',
        category: 'Market',
      })
      expect(result.suggestedPriority).toBe('medium')
    })
  })

  describe('Subject extraction', () => {
    it('should extract subject from "What is the..." queries', () => {
      const result = draftQAQuestion({
        query: "What is the company culture?",
        category: 'HR',
      })
      expect(result.question.toLowerCase()).toContain('company culture')
    })

    it('should extract subject from "Tell me about..." queries', () => {
      const result = draftQAQuestion({
        query: 'Tell me about the pricing strategy',
        category: 'Market',
      })
      expect(result.question.toLowerCase()).toContain('pricing strategy')
    })

    it('should handle question marks', () => {
      const result = draftQAQuestion({
        query: "What's the deal?",
        category: 'Operations',
      })
      // Should not have double question marks
      expect(result.question).not.toContain('??')
    })
  })

  describe('Context inclusion', () => {
    it('should include additional context when provided', () => {
      const result = draftQAQuestion({
        query: 'What is the revenue?',
        context: 'We need monthly breakdown.',
      })
      expect(result.question).toContain('breakdown')
    })
  })

  describe('Topic override', () => {
    it('should use topic instead of query when provided', () => {
      const result = draftQAQuestion({
        query: 'Some random query',
        topic: 'revenue',
      })
      expect(result.isTemplated).toBe(true)
      expect(result.question).toContain('revenue')
    })
  })
})

describe('enhanceQuestion', () => {
  it('should add question mark if missing', () => {
    const result = enhanceQuestion('What is the revenue')
    expect(result).toMatch(/\?$/)
  })

  it('should not add question mark if already present', () => {
    const result = enhanceQuestion('What is the revenue?')
    expect(result).not.toContain('??')
  })

  it('should capitalize first letter', () => {
    const result = enhanceQuestion('what is the revenue')
    expect(result[0]).toBe(result[0]!.toUpperCase())
  })

  it('should add professional phrasing when missing', () => {
    const result = enhanceQuestion('send the data')
    expect(result.toLowerCase()).toContain('could')
  })

  it('should not modify questions that already have professional phrasing', () => {
    const original = 'Please provide the revenue data?'
    const result = enhanceQuestion(original)
    // Should start with capital, not add another "Could you"
    expect(result).not.toContain('Could you Please')
  })
})

describe('suggestTimePeriod', () => {
  it('should suggest 3 years for revenue', () => {
    expect(suggestTimePeriod('revenue')).toContain('3 years')
  })

  it('should suggest 3 years for EBITDA', () => {
    expect(suggestTimePeriod('EBITDA')).toContain('3 years')
  })

  it('should suggest 3 years for churn', () => {
    expect(suggestTimePeriod('customer churn')).toContain('3 years')
  })

  it('should suggest 5 years for litigation', () => {
    expect(suggestTimePeriod('litigation')).toContain('5 years')
  })

  it('should suggest 5 years for lawsuits', () => {
    expect(suggestTimePeriod('pending lawsuits')).toContain('5 years')
  })

  it('should return default for unknown topics', () => {
    const result = suggestTimePeriod('random topic')
    expect(result).toContain('current period')
  })
})

describe('Question quality', () => {
  describe('Specificity (AC #2)', () => {
    it('should include time periods in financial questions', () => {
      const result = draftQAQuestion({ query: 'What is the revenue?' })
      expect(result.question).toMatch(/year|month|period|quarter/i)
    })

    it('should include breakdown requests where appropriate', () => {
      const result = draftQAQuestion({ query: 'What is the revenue?' })
      expect(result.question).toMatch(/breakdown|segment|line/i)
    })
  })

  describe('Professionalism', () => {
    it('should use formal language in templates', () => {
      const result = draftQAQuestion({ query: 'What is the revenue?' })
      expect(result.question).toMatch(/Please provide|What is/i)
    })

    it('should not use casual language', () => {
      const result = draftQAQuestion({ query: 'What is the revenue?' })
      expect(result.question).not.toMatch(/hey|gonna|wanna|kinda/i)
    })
  })

  describe('Actionability', () => {
    it('should ask for concrete deliverables', () => {
      const result = draftQAQuestion({ query: 'What are the contracts?' })
      expect(result.question).toMatch(/provide|include|summary|details/i)
    })
  })
})
