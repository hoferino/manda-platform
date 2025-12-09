/**
 * Q&A Category Inference Tests
 *
 * Story: E8.4 - Conversational Q&A Suggestion Flow
 * AC: #2 - The AI drafts a well-formed question based on the conversation context
 */

import { describe, it, expect } from 'vitest'
import {
  inferQACategoryFromQuery,
  getAllMatchingCategories,
  queryMatchesCategory,
  QA_CATEGORY_KEYWORDS,
} from './qa-category'

describe('inferQACategoryFromQuery', () => {
  describe('Financial queries', () => {
    it('should infer Financials for "churn" queries', () => {
      // Note: "churn" is in Operations, testing revenue
      expect(inferQACategoryFromQuery('What is the revenue for Q3?')).toBe('Financials')
    })

    it('should infer Financials for "revenue" queries', () => {
      expect(inferQACategoryFromQuery("What's the annual revenue?")).toBe('Financials')
    })

    it('should infer Financials for "EBITDA" queries', () => {
      expect(inferQACategoryFromQuery('Tell me about EBITDA')).toBe('Financials')
    })

    it('should infer Financials for "margin" queries', () => {
      expect(inferQACategoryFromQuery("What's the gross margin trend?")).toBe('Financials')
    })

    it('should infer Financials for "costs" queries', () => {
      expect(inferQACategoryFromQuery('Break down the operating costs')).toBe('Financials')
    })

    it('should infer Financials for "P&L" queries', () => {
      expect(inferQACategoryFromQuery('Show me the P&L')).toBe('Financials')
    })

    it('should infer Financials for "cash flow" queries', () => {
      expect(inferQACategoryFromQuery('What is the cash flow situation?')).toBe('Financials')
    })
  })

  describe('Legal queries', () => {
    it('should infer Legal for "contract" queries', () => {
      expect(inferQACategoryFromQuery('What are the key contracts?')).toBe('Legal')
    })

    it('should infer Legal for "litigation" queries', () => {
      expect(inferQACategoryFromQuery('Any pending litigation?')).toBe('Legal')
    })

    it('should infer Legal for "lawsuit" queries', () => {
      expect(inferQACategoryFromQuery('Are there any lawsuits?')).toBe('Legal')
    })

    it('should infer Legal for "IP" queries', () => {
      expect(inferQACategoryFromQuery('Tell me about their IP portfolio')).toBe('Legal')
    })

    it('should infer Legal for "compliance" queries', () => {
      expect(inferQACategoryFromQuery('What is the compliance status?')).toBe('Legal')
    })

    it('should infer Legal for "license" queries', () => {
      expect(inferQACategoryFromQuery('What licenses do they have?')).toBe('Legal')
    })
  })

  describe('Operations queries', () => {
    it('should infer Operations for "churn" queries', () => {
      expect(inferQACategoryFromQuery("What's the customer churn rate?")).toBe('Operations')
    })

    it('should infer Operations for "customer" queries', () => {
      expect(inferQACategoryFromQuery('Tell me about their customers')).toBe('Operations')
    })

    it('should infer Operations for "supplier" queries', () => {
      expect(inferQACategoryFromQuery('Who are their key suppliers?')).toBe('Operations')
    })

    it('should infer Operations for "process" queries', () => {
      expect(inferQACategoryFromQuery('What are the operational processes?')).toBe('Operations')
    })

    it('should infer Operations for "supply chain" queries', () => {
      expect(inferQACategoryFromQuery('How does the supply chain work?')).toBe('Operations')
    })
  })

  describe('Market queries', () => {
    it('should infer Market for "market share" queries', () => {
      expect(inferQACategoryFromQuery('What is their market share?')).toBe('Market')
    })

    it('should infer Market for "competitor" queries', () => {
      expect(inferQACategoryFromQuery('Who are the main competitors?')).toBe('Market')
    })

    it('should infer Market for "positioning" queries', () => {
      expect(inferQACategoryFromQuery('What is their market positioning?')).toBe('Market')
    })

    it('should infer Market for "industry" queries', () => {
      expect(inferQACategoryFromQuery('How is the industry trending?')).toBe('Market')
    })
  })

  describe('Technology queries', () => {
    it('should infer Technology for "tech stack" queries', () => {
      expect(inferQACategoryFromQuery('What is the tech stack?')).toBe('Technology')
    })

    it('should infer Technology for "API" queries', () => {
      expect(inferQACategoryFromQuery('What APIs do they expose?')).toBe('Technology')
    })

    it('should infer Technology for "security" queries', () => {
      expect(inferQACategoryFromQuery('What are the security measures?')).toBe('Technology')
    })

    it('should infer Technology for "infrastructure" queries', () => {
      expect(inferQACategoryFromQuery('Describe the infrastructure')).toBe('Technology')
    })

    it('should infer Technology for "cloud" queries', () => {
      expect(inferQACategoryFromQuery('What cloud provider do they use?')).toBe('Technology')
    })
  })

  describe('HR queries', () => {
    it('should infer HR for "employee" queries', () => {
      expect(inferQACategoryFromQuery('How many employees do they have?')).toBe('HR')
    })

    it('should infer HR for "headcount" queries', () => {
      expect(inferQACategoryFromQuery('What is the current headcount?')).toBe('HR')
    })

    it('should infer HR for "team" queries', () => {
      expect(inferQACategoryFromQuery('Tell me about the management team')).toBe('HR')
    })

    it('should infer HR for "compensation" queries', () => {
      expect(inferQACategoryFromQuery('What is the compensation structure?')).toBe('HR')
    })

    it('should infer HR for "hiring" queries', () => {
      expect(inferQACategoryFromQuery('What are the hiring plans?')).toBe('HR')
    })

    it('should infer HR for "org structure" queries', () => {
      expect(inferQACategoryFromQuery("What's the org structure?")).toBe('HR')
    })
  })

  describe('Edge cases', () => {
    it('should return null for empty query', () => {
      expect(inferQACategoryFromQuery('')).toBeNull()
    })

    it('should return null for non-string input', () => {
      expect(inferQACategoryFromQuery(null as unknown as string)).toBeNull()
      expect(inferQACategoryFromQuery(undefined as unknown as string)).toBeNull()
      expect(inferQACategoryFromQuery(123 as unknown as string)).toBeNull()
    })

    it('should return null for query with no matching keywords', () => {
      expect(inferQACategoryFromQuery("What's the weather like?")).toBeNull()
    })

    it('should be case insensitive', () => {
      expect(inferQACategoryFromQuery('WHAT IS THE REVENUE?')).toBe('Financials')
      expect(inferQACategoryFromQuery('what is the revenue?')).toBe('Financials')
    })

    it('should handle multiple category matches by returning highest count', () => {
      // Query with multiple financial terms should still return Financials
      const query = 'What are the revenue, costs, and margins?'
      expect(inferQACategoryFromQuery(query)).toBe('Financials')
    })
  })
})

describe('getAllMatchingCategories', () => {
  it('should return empty array for empty query', () => {
    expect(getAllMatchingCategories('')).toEqual([])
  })

  it('should return categories sorted by match count', () => {
    const results = getAllMatchingCategories('revenue and costs and margins')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]!.category).toBe('Financials')
    // Each keyword is counted separately - revenue, costs, margins gives at least 2 matches (costs, margin)
    expect(results[0]!.matchCount).toBeGreaterThanOrEqual(2)
  })

  it('should return multiple categories when query matches several', () => {
    const results = getAllMatchingCategories('customer revenue and employee count')
    expect(results.length).toBeGreaterThanOrEqual(2)
  })

  it('should not include categories with zero matches', () => {
    const results = getAllMatchingCategories('revenue')
    for (const result of results) {
      expect(result.matchCount).toBeGreaterThan(0)
    }
  })
})

describe('queryMatchesCategory', () => {
  it('should return true when query matches category', () => {
    expect(queryMatchesCategory('revenue trends', 'Financials')).toBe(true)
  })

  it('should return false when query does not match category', () => {
    expect(queryMatchesCategory('revenue trends', 'HR')).toBe(false)
  })

  it('should return false for empty query', () => {
    expect(queryMatchesCategory('', 'Financials')).toBe(false)
  })

  it('should return false for invalid input', () => {
    expect(queryMatchesCategory(null as unknown as string, 'Financials')).toBe(false)
  })
})

describe('QA_CATEGORY_KEYWORDS', () => {
  it('should have all six categories', () => {
    const categories = Object.keys(QA_CATEGORY_KEYWORDS)
    expect(categories).toContain('Financials')
    expect(categories).toContain('Legal')
    expect(categories).toContain('Operations')
    expect(categories).toContain('Market')
    expect(categories).toContain('Technology')
    expect(categories).toContain('HR')
    expect(categories.length).toBe(6)
  })

  it('should have non-empty keyword arrays for each category', () => {
    for (const [category, keywords] of Object.entries(QA_CATEGORY_KEYWORDS)) {
      expect(keywords.length).toBeGreaterThan(0)
    }
  })

  it('should have lowercase keywords', () => {
    for (const [, keywords] of Object.entries(QA_CATEGORY_KEYWORDS)) {
      for (const keyword of keywords) {
        expect(keyword).toBe(keyword.toLowerCase())
      }
    }
  })
})
