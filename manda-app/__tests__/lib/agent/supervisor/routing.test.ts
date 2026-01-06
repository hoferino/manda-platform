/**
 * Tests for Supervisor Routing Logic
 *
 * Story: E13.4 - Supervisor Agent Pattern (AC: #2, #6)
 *
 * Tests routing decisions based on intent classification and keyword matching.
 */

import { describe, it, expect } from 'vitest'
import {
  routeToSpecialists,
  shouldRouteToSpecialist,
  getRoutingRationale,
  createDecisionFromRouting,
  getSpecialistKeywords,
  SPECIALIST_IDS,
  SPECIALIST_ROUTING,
  type RoutingResult,
} from '@/lib/agent/supervisor/routing'
import type { EnhancedIntentResult } from '@/lib/agent/intent'

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockIntent(overrides: Partial<EnhancedIntentResult> = {}): EnhancedIntentResult {
  return {
    intent: 'factual',
    confidence: 0.85,
    complexity: 'complex',
    method: 'regex',
    ...overrides,
  }
}

// =============================================================================
// routeToSpecialists Tests (AC: #2)
// =============================================================================

describe('routeToSpecialists', () => {
  describe('Financial Analyst Routing', () => {
    it('routes EBITDA queries to financial_analyst', () => {
      const intent = createMockIntent()
      const result = routeToSpecialists(intent, 'What is the company EBITDA?')

      expect(result.specialists).toContain(SPECIALIST_IDS.FINANCIAL_ANALYST)
      expect(result.matchedKeywords).toContain('ebitda')
    })

    it('routes revenue queries to financial_analyst', () => {
      const intent = createMockIntent()
      const result = routeToSpecialists(intent, 'Show me the revenue trends for Q3')

      expect(result.specialists).toContain(SPECIALIST_IDS.FINANCIAL_ANALYST)
      expect(result.matchedKeywords).toContain('revenue')
    })

    it('routes margin queries to financial_analyst', () => {
      const intent = createMockIntent()
      const result = routeToSpecialists(intent, 'What is the gross margin percentage?')

      expect(result.specialists).toContain(SPECIALIST_IDS.FINANCIAL_ANALYST)
      expect(result.matchedKeywords).toContain('gross margin')
    })

    it('routes valuation queries to financial_analyst', () => {
      const intent = createMockIntent()
      const result = routeToSpecialists(intent, 'Calculate the DCF valuation')

      expect(result.specialists).toContain(SPECIALIST_IDS.FINANCIAL_ANALYST)
      expect(result.matchedKeywords).toContain('valuation')
    })

    it('routes working capital queries to financial_analyst', () => {
      const intent = createMockIntent()
      const result = routeToSpecialists(intent, 'Analyze the working capital requirements')

      expect(result.specialists).toContain(SPECIALIST_IDS.FINANCIAL_ANALYST)
      expect(result.matchedKeywords).toContain('working capital')
    })
  })

  describe('Knowledge Graph Routing', () => {
    it('routes entity queries to knowledge_graph', () => {
      const intent = createMockIntent()
      const result = routeToSpecialists(intent, 'Find all entity information related to the CEO')

      expect(result.specialists).toContain(SPECIALIST_IDS.KNOWLEDGE_GRAPH)
      expect(result.matchedKeywords).toContain('entity')
    })

    it('routes relationship queries to knowledge_graph', () => {
      const intent = createMockIntent()
      const result = routeToSpecialists(intent, 'Show the relationship between subsidiaries')

      expect(result.specialists).toContain(SPECIALIST_IDS.KNOWLEDGE_GRAPH)
      expect(result.matchedKeywords).toContain('relationship')
    })

    it('routes contradiction queries to knowledge_graph', () => {
      const intent = createMockIntent()
      const result = routeToSpecialists(intent, 'Is there a contradiction in the data?')

      expect(result.specialists).toContain(SPECIALIST_IDS.KNOWLEDGE_GRAPH)
      expect(result.matchedKeywords).toContain('contradiction')
    })

    it('routes organizational queries to knowledge_graph', () => {
      const intent = createMockIntent()
      const result = routeToSpecialists(intent, 'Show me the company structure')

      expect(result.specialists).toContain(SPECIALIST_IDS.KNOWLEDGE_GRAPH)
      expect(result.matchedKeywords).toContain('company structure')
    })

    it('routes timeline queries to knowledge_graph', () => {
      const intent = createMockIntent()
      const result = routeToSpecialists(intent, 'What is the acquisition timeline?')

      expect(result.specialists).toContain(SPECIALIST_IDS.KNOWLEDGE_GRAPH)
      expect(result.matchedKeywords).toContain('timeline')
    })
  })

  describe('Multi-Specialist Routing', () => {
    it('routes cross-domain queries to multiple specialists', () => {
      const intent = createMockIntent()
      const result = routeToSpecialists(
        intent,
        'Analyze the revenue impact of the CEO change and subsidiary relationships'
      )

      expect(result.specialists.length).toBeGreaterThan(1)
      expect(result.specialists).toContain(SPECIALIST_IDS.FINANCIAL_ANALYST)
      expect(result.specialists).toContain(SPECIALIST_IDS.KNOWLEDGE_GRAPH)
      expect(result.isParallel).toBe(true)
    })

    it('sets isParallel to true for multi-specialist routing', () => {
      const intent = createMockIntent()
      const result = routeToSpecialists(
        intent,
        'How does the EBITDA relate to the entity structure changes?'
      )

      if (result.specialists.length > 1) {
        expect(result.isParallel).toBe(true)
      }
    })
  })

  describe('Fallback Routing (AC: #6)', () => {
    it('falls back to general agent when no keywords match and intent is greeting', () => {
      // Use an intent type that doesn't have affinity
      const intent = createMockIntent({ intent: 'greeting' })
      const result = routeToSpecialists(intent, 'Hello, how are you today?')

      expect(result.specialists).toEqual([SPECIALIST_IDS.GENERAL])
      expect(result.isParallel).toBe(false)
    })

    it('uses intent affinity when no keywords match', () => {
      // With 'factual' intent, it should fall back to knowledge_graph
      const intent = createMockIntent({ intent: 'factual' })
      const result = routeToSpecialists(intent, 'Hello, how are you today?')

      // Intent-based affinity kicks in when no keywords match
      expect(result.specialists).toContain(SPECIALIST_IDS.KNOWLEDGE_GRAPH)
    })

    it('falls back to general when query is empty', () => {
      const intent = createMockIntent()
      const result = routeToSpecialists(intent, '')

      expect(result.specialists).toEqual([SPECIALIST_IDS.GENERAL])
    })

    it('includes rationale for fallback when no keywords AND no intent affinity', () => {
      const intent = createMockIntent({ intent: 'greeting' })
      const result = routeToSpecialists(intent, 'Generic question without keywords')

      expect(result.rationale).toContain('Falling back to general agent')
    })
  })

  describe('Rationale Generation', () => {
    it('includes matched keywords in rationale', () => {
      const intent = createMockIntent()
      const result = routeToSpecialists(intent, 'What is the EBITDA margin?')

      expect(result.rationale).toContain('ebitda')
      expect(result.rationale).toContain('margin')
    })

    it('indicates parallel routing in rationale', () => {
      const intent = createMockIntent()
      const result = routeToSpecialists(
        intent,
        'Analyze revenue and entity relationships'
      )

      if (result.isParallel) {
        expect(result.rationale).toContain('Multi-specialist')
      }
    })
  })
})

// =============================================================================
// shouldRouteToSpecialist Tests
// =============================================================================

describe('shouldRouteToSpecialist', () => {
  it('returns true when query contains specialist keywords', () => {
    expect(shouldRouteToSpecialist(SPECIALIST_IDS.FINANCIAL_ANALYST, 'revenue analysis'))
      .toBe(true)
    expect(shouldRouteToSpecialist(SPECIALIST_IDS.KNOWLEDGE_GRAPH, 'entity resolution'))
      .toBe(true)
  })

  it('returns false when query does not contain specialist keywords', () => {
    expect(shouldRouteToSpecialist(SPECIALIST_IDS.FINANCIAL_ANALYST, 'entity resolution'))
      .toBe(false)
    expect(shouldRouteToSpecialist(SPECIALIST_IDS.KNOWLEDGE_GRAPH, 'EBITDA calculation'))
      .toBe(false)
  })

  it('is case insensitive', () => {
    expect(shouldRouteToSpecialist(SPECIALIST_IDS.FINANCIAL_ANALYST, 'REVENUE ANALYSIS'))
      .toBe(true)
    expect(shouldRouteToSpecialist(SPECIALIST_IDS.FINANCIAL_ANALYST, 'Revenue Analysis'))
      .toBe(true)
  })
})

// =============================================================================
// getRoutingRationale Tests
// =============================================================================

describe('getRoutingRationale', () => {
  it('returns readable rationale for financial analyst', () => {
    const result: RoutingResult = {
      specialists: [SPECIALIST_IDS.FINANCIAL_ANALYST],
      isParallel: false,
      rationale: 'test',
      matchedKeywords: ['revenue'],
    }

    const rationale = getRoutingRationale(result)
    expect(rationale).toContain('Financial Analyst')
  })

  it('returns readable rationale for knowledge graph', () => {
    const result: RoutingResult = {
      specialists: [SPECIALIST_IDS.KNOWLEDGE_GRAPH],
      isParallel: false,
      rationale: 'test',
      matchedKeywords: ['entity'],
    }

    const rationale = getRoutingRationale(result)
    expect(rationale).toContain('Knowledge Graph')
  })

  it('indicates parallel routing for multiple specialists', () => {
    const result: RoutingResult = {
      specialists: [SPECIALIST_IDS.FINANCIAL_ANALYST, SPECIALIST_IDS.KNOWLEDGE_GRAPH],
      isParallel: true,
      rationale: 'test',
      matchedKeywords: ['revenue', 'entity'],
    }

    const rationale = getRoutingRationale(result)
    expect(rationale).toContain('Parallel routing')
  })

  it('indicates general fallback', () => {
    const result: RoutingResult = {
      specialists: [SPECIALIST_IDS.GENERAL],
      isParallel: false,
      rationale: 'fallback',
      matchedKeywords: [],
    }

    const rationale = getRoutingRationale(result)
    expect(rationale).toContain('general agent')
  })
})

// =============================================================================
// createDecisionFromRouting Tests
// =============================================================================

describe('createDecisionFromRouting', () => {
  it('creates valid SupervisorDecision', () => {
    const result: RoutingResult = {
      specialists: [SPECIALIST_IDS.FINANCIAL_ANALYST],
      isParallel: false,
      rationale: 'test rationale',
      matchedKeywords: ['revenue'],
    }
    const intent = createMockIntent()

    const decision = createDecisionFromRouting(result, intent)

    expect(decision.selectedSpecialists).toEqual([SPECIALIST_IDS.FINANCIAL_ANALYST])
    expect(decision.rationale).toBe('test rationale')
    expect(decision.isParallel).toBe(false)
    expect(decision.timestamp).toBeDefined()
    expect(decision.intentSignals).toEqual({
      type: 'factual',
      complexity: 'complex',
      keywords: ['revenue'],
    })
  })
})

// =============================================================================
// getSpecialistKeywords Tests
// =============================================================================

describe('getSpecialistKeywords', () => {
  it('returns keywords for financial_analyst', () => {
    const keywords = getSpecialistKeywords(SPECIALIST_IDS.FINANCIAL_ANALYST)
    expect(keywords).toContain('revenue')
    expect(keywords).toContain('ebitda')
    expect(keywords).toContain('valuation')
  })

  it('returns keywords for knowledge_graph', () => {
    const keywords = getSpecialistKeywords(SPECIALIST_IDS.KNOWLEDGE_GRAPH)
    expect(keywords).toContain('entity')
    expect(keywords).toContain('relationship')
    expect(keywords).toContain('contradiction')
  })

  it('returns empty array for general', () => {
    const keywords = getSpecialistKeywords(SPECIALIST_IDS.GENERAL)
    expect(keywords).toEqual([])
  })
})

// =============================================================================
// SPECIALIST_ROUTING Validation
// =============================================================================

describe('SPECIALIST_ROUTING', () => {
  it('has keywords for financial_analyst', () => {
    expect(SPECIALIST_ROUTING[SPECIALIST_IDS.FINANCIAL_ANALYST]).toBeDefined()
    expect(SPECIALIST_ROUTING[SPECIALIST_IDS.FINANCIAL_ANALYST]!.length).toBeGreaterThan(0)
  })

  it('has keywords for knowledge_graph', () => {
    expect(SPECIALIST_ROUTING[SPECIALIST_IDS.KNOWLEDGE_GRAPH]).toBeDefined()
    expect(SPECIALIST_ROUTING[SPECIALIST_IDS.KNOWLEDGE_GRAPH]!.length).toBeGreaterThan(0)
  })

  it('does not have keywords for general (fallback)', () => {
    expect(SPECIALIST_ROUTING[SPECIALIST_IDS.GENERAL]).toBeUndefined()
  })

  it('keywords are all lowercase for matching', () => {
    const allKeywords = [
      ...SPECIALIST_ROUTING[SPECIALIST_IDS.FINANCIAL_ANALYST]!,
      ...SPECIALIST_ROUTING[SPECIALIST_IDS.KNOWLEDGE_GRAPH]!,
    ]

    allKeywords.forEach(keyword => {
      expect(keyword).toBe(keyword.toLowerCase())
    })
  })
})
