/**
 * Tests for Supervisor State Types and Factory Functions
 *
 * Story: E13.4 - Supervisor Agent Pattern (AC: #1, #3)
 *
 * Tests state creation, validation, and type safety.
 */

import { describe, it, expect } from 'vitest'
import {
  createInitialState,
  createSpecialistResult,
  createSupervisorDecision,
  isValidSpecialistResult,
  isValidSynthesizedResponse,
  SpecialistResultSchema,
  SupervisorDecisionSchema,
  SynthesizedResponseSchema,
  SourceReferenceSchema,
} from '@/lib/agent/supervisor/state'

// =============================================================================
// createInitialState Tests
// =============================================================================

describe('createInitialState', () => {
  it('creates valid initial state with required fields', () => {
    const state = createInitialState('What is EBITDA?', 'deal-123', 'user-456')

    expect(state.query).toBe('What is EBITDA?')
    expect(state.dealId).toBe('deal-123')
    expect(state.userId).toBe('user-456')
    expect(state.specialistResults).toEqual([])
    expect(state.messages).toEqual([])
    expect(state.metrics?.startTime).toBeDefined()
  })

  it('includes organizationId when provided', () => {
    const state = createInitialState('Query', 'deal-1', 'user-1', 'org-1')

    expect(state.organizationId).toBe('org-1')
  })

  it('leaves organizationId undefined when not provided', () => {
    const state = createInitialState('Query', 'deal-1', 'user-1')

    expect(state.organizationId).toBeUndefined()
  })

  it('initializes undefined fields', () => {
    const state = createInitialState('Query', 'deal-1', 'user-1')

    expect(state.intent).toBeUndefined()
    expect(state.decision).toBeUndefined()
    expect(state.synthesizedResponse).toBeUndefined()
    expect(state.error).toBeUndefined()
  })
})

// =============================================================================
// createSpecialistResult Tests (AC: #3)
// =============================================================================

describe('createSpecialistResult', () => {
  it('creates valid specialist result with required fields', () => {
    const result = createSpecialistResult(
      'financial_analyst',
      'EBITDA is $5M',
      0.9,
      []
    )

    expect(result.specialistId).toBe('financial_analyst')
    expect(result.output).toBe('EBITDA is $5M')
    expect(result.confidence).toBe(0.9)
    expect(result.sources).toEqual([])
  })

  it('includes optional timing', () => {
    const result = createSpecialistResult(
      'financial_analyst',
      'Output',
      0.8,
      [],
      { timing: 150 }
    )

    expect(result.timing).toBe(150)
  })

  it('includes stub flag', () => {
    const result = createSpecialistResult(
      'financial_analyst',
      'Output',
      0.8,
      [],
      { stub: true }
    )

    expect(result.stub).toBe(true)
  })

  it('includes error message', () => {
    const result = createSpecialistResult(
      'financial_analyst',
      '',
      0.3,
      [],
      { error: 'Analysis failed' }
    )

    expect(result.error).toBe('Analysis failed')
  })

  it('includes sources', () => {
    const sources = [
      { documentId: 'doc-1', documentName: 'Report.pdf', relevanceScore: 0.9 },
    ]
    const result = createSpecialistResult(
      'financial_analyst',
      'Output',
      0.8,
      sources
    )

    expect(result.sources).toEqual(sources)
  })
})

// =============================================================================
// createSupervisorDecision Tests
// =============================================================================

describe('createSupervisorDecision', () => {
  it('creates valid decision with required fields', () => {
    const decision = createSupervisorDecision(
      ['financial_analyst'],
      'Financial query detected',
      false
    )

    expect(decision.selectedSpecialists).toEqual(['financial_analyst'])
    expect(decision.rationale).toBe('Financial query detected')
    expect(decision.isParallel).toBe(false)
    expect(decision.timestamp).toBeDefined()
  })

  it('includes intent signals when provided', () => {
    const decision = createSupervisorDecision(
      ['financial_analyst', 'knowledge_graph'],
      'Cross-domain query',
      true,
      {
        type: 'analytical',
        complexity: 'complex',
        keywords: ['revenue', 'entity'],
      }
    )

    expect(decision.intentSignals?.type).toBe('analytical')
    expect(decision.intentSignals?.complexity).toBe('complex')
    expect(decision.intentSignals?.keywords).toEqual(['revenue', 'entity'])
  })

  it('has valid ISO timestamp', () => {
    const decision = createSupervisorDecision(['general'], 'Fallback', false)

    expect(() => new Date(decision.timestamp!)).not.toThrow()
  })
})

// =============================================================================
// Zod Schema Validation Tests
// =============================================================================

describe('SourceReferenceSchema', () => {
  it('validates complete source reference', () => {
    const source = {
      documentId: 'doc-1',
      documentName: 'Report.pdf',
      chunkId: 'chunk-1',
      relevanceScore: 0.9,
      snippet: 'Sample text',
    }

    const result = SourceReferenceSchema.safeParse(source)
    expect(result.success).toBe(true)
  })

  it('validates minimal source reference', () => {
    const source = {}

    const result = SourceReferenceSchema.safeParse(source)
    expect(result.success).toBe(true)
  })

  it('rejects invalid relevance score', () => {
    const source = { relevanceScore: 1.5 }

    const result = SourceReferenceSchema.safeParse(source)
    expect(result.success).toBe(false)
  })
})

describe('SpecialistResultSchema', () => {
  it('validates complete specialist result', () => {
    const result = {
      specialistId: 'financial_analyst',
      output: 'Analysis output',
      confidence: 0.85,
      sources: [],
      timing: 150,
      stub: false,
    }

    const parsed = SpecialistResultSchema.safeParse(result)
    expect(parsed.success).toBe(true)
  })

  it('rejects missing required fields', () => {
    const result = {
      specialistId: 'financial_analyst',
      // missing output, confidence, sources
    }

    const parsed = SpecialistResultSchema.safeParse(result)
    expect(parsed.success).toBe(false)
  })

  it('rejects invalid confidence range', () => {
    const result = {
      specialistId: 'financial_analyst',
      output: 'Test',
      confidence: 1.5, // Invalid - should be 0-1
      sources: [],
    }

    const parsed = SpecialistResultSchema.safeParse(result)
    expect(parsed.success).toBe(false)
  })
})

describe('SupervisorDecisionSchema', () => {
  it('validates complete decision', () => {
    const decision = {
      selectedSpecialists: ['financial_analyst', 'knowledge_graph'],
      rationale: 'Cross-domain query',
      isParallel: true,
      timestamp: new Date().toISOString(),
      intentSignals: {
        type: 'analytical',
        complexity: 'complex',
        keywords: ['revenue'],
      },
    }

    const result = SupervisorDecisionSchema.safeParse(decision)
    expect(result.success).toBe(true)
  })

  it('validates minimal decision', () => {
    const decision = {
      selectedSpecialists: ['general'],
      rationale: 'Fallback',
      isParallel: false,
    }

    const result = SupervisorDecisionSchema.safeParse(decision)
    expect(result.success).toBe(true)
  })
})

describe('SynthesizedResponseSchema', () => {
  it('validates complete response', () => {
    const response = {
      content: 'Synthesized response',
      confidence: 0.87,
      sources: [],
      specialists: ['financial_analyst'],
      wasSynthesized: false,
      totalLatencyMs: 250,
    }

    const result = SynthesizedResponseSchema.safeParse(response)
    expect(result.success).toBe(true)
  })
})

// =============================================================================
// Type Guard Tests
// =============================================================================

describe('isValidSpecialistResult', () => {
  it('returns true for valid result', () => {
    const result = createSpecialistResult('financial_analyst', 'Output', 0.8, [])
    expect(isValidSpecialistResult(result)).toBe(true)
  })

  it('returns false for invalid result', () => {
    const invalid = { specialistId: 'test' } // missing required fields
    expect(isValidSpecialistResult(invalid)).toBe(false)
  })

  it('returns false for non-object', () => {
    expect(isValidSpecialistResult('string')).toBe(false)
    expect(isValidSpecialistResult(123)).toBe(false)
    expect(isValidSpecialistResult(null)).toBe(false)
  })
})

describe('isValidSynthesizedResponse', () => {
  it('returns true for valid response', () => {
    const response = {
      content: 'Test',
      confidence: 0.9,
      sources: [],
      specialists: ['general'],
      wasSynthesized: false,
    }
    expect(isValidSynthesizedResponse(response)).toBe(true)
  })

  it('returns false for invalid response', () => {
    const invalid = { content: 'Test' } // missing required fields
    expect(isValidSynthesizedResponse(invalid)).toBe(false)
  })
})
