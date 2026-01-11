/**
 * Agent System v2.0 - Uncertainty Handling Utilities Tests
 *
 * Story: 3-3 Implement Honest Uncertainty Handling (AC: #1-#5)
 *
 * Tests cover:
 * - detectUncertainty: uncertainty level detection from sources
 * - generateNextSteps: actionable next steps by scenario
 * - validateResponseHonesty: prohibited phrase detection
 * - buildUncertaintyContext: context injection strings
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  detectUncertainty,
  generateNextSteps,
  validateResponseHonesty,
  buildUncertaintyContext,
  type UncertaintyLevel,
} from '../uncertainty'
import type { SourceCitation } from '../../types'

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a mock source citation with specified relevance score.
 */
function createSource(relevanceScore: number, id = 'doc-1'): SourceCitation {
  return {
    documentId: id,
    documentName: `Document ${id}`,
    snippet: 'Test snippet',
    relevanceScore,
    retrievedAt: new Date().toISOString(),
  }
}

/**
 * Create an array of sources with specified scores.
 */
function createSources(scores: number[]): SourceCitation[] {
  return scores.map((score, i) => createSource(score, `doc-${i + 1}`))
}

// =============================================================================
// detectUncertainty Tests (Task 6.2-6.5)
// =============================================================================

describe('detectUncertainty', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleWarnSpy.mockRestore()
  })

  // Test 6.2: detectUncertainty returns 'complete' for empty sources array
  it('returns "complete" for empty sources array', () => {
    const result = detectUncertainty([], 'test query')

    expect(result.level).toBe('complete')
    expect(result.avgScore).toBeNull()
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('[uncertainty] detected level=complete')
    )
  })

  // Test 6.3: detectUncertainty returns 'high' for sources with avgScore < 0.3
  it('returns "high" for sources with avgScore < 0.3', () => {
    const sources = createSources([0.1, 0.2, 0.3])
    const result = detectUncertainty(sources, 'test query')

    expect(result.level).toBe('high')
    expect(result.avgScore).toBeCloseTo(0.2, 3)
  })

  // Test 6.4: detectUncertainty returns 'none' for sources with avgScore > 0.7
  it('returns "none" for sources with avgScore > 0.7', () => {
    const sources = createSources([0.8, 0.9, 0.85])
    const result = detectUncertainty(sources, 'test query')

    expect(result.level).toBe('none')
    expect(result.avgScore).toBeCloseTo(0.85, 3)
  })

  // Test 6.5: detectUncertainty calculates correct average across multiple sources
  it('calculates correct average across multiple sources', () => {
    // Scores: 0.4, 0.5, 0.6 -> avg = 0.5 -> medium
    const sources = createSources([0.4, 0.5, 0.6])
    const result = detectUncertainty(sources, 'test query')

    expect(result.avgScore).toBeCloseTo(0.5, 3)
    expect(result.level).toBe('medium')
  })

  it('returns "medium" for avgScore between 0.3 and 0.5', () => {
    const sources = createSources([0.35, 0.4, 0.45])
    const result = detectUncertainty(sources, 'test query')

    expect(result.level).toBe('medium')
    expect(result.avgScore).toBeCloseTo(0.4, 3)
  })

  it('returns "low" for avgScore between 0.5 and 0.7', () => {
    const sources = createSources([0.55, 0.6, 0.65])
    const result = detectUncertainty(sources, 'test query')

    expect(result.level).toBe('low')
    expect(result.avgScore).toBeCloseTo(0.6, 3)
  })

  it('handles single source correctly', () => {
    const sources = [createSource(0.75)]
    const result = detectUncertainty(sources, 'test query')

    expect(result.level).toBe('none')
    expect(result.avgScore).toBe(0.75)
  })

  it('logs detected uncertainty level', () => {
    const sources = createSources([0.5, 0.6])
    detectUncertainty(sources, 'test query')

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('[uncertainty] detected level=low sources=2')
    )
  })

  // Boundary threshold tests (Code Review: Issue #10)
  describe('boundary thresholds', () => {
    it('returns "high" for avgScore exactly at 0.3 (threshold uses >)', () => {
      const sources = [createSource(0.3)]
      const result = detectUncertainty(sources, 'test query')

      // 0.3 is NOT > 0.3, so it falls through to 'high'
      expect(result.level).toBe('high')
      expect(result.avgScore).toBe(0.3)
    })

    it('returns "medium" for avgScore exactly at 0.5 (threshold uses >)', () => {
      const sources = [createSource(0.5)]
      const result = detectUncertainty(sources, 'test query')

      // 0.5 is NOT > 0.5, so it falls through to 'medium'
      expect(result.level).toBe('medium')
      expect(result.avgScore).toBe(0.5)
    })

    it('returns "low" for avgScore exactly at 0.7 (threshold uses >)', () => {
      const sources = [createSource(0.7)]
      const result = detectUncertainty(sources, 'test query')

      // 0.7 is NOT > 0.7, so it falls through to 'low'
      expect(result.level).toBe('low')
      expect(result.avgScore).toBe(0.7)
    })

    it('returns "none" for avgScore just above 0.7', () => {
      const sources = [createSource(0.701)]
      const result = detectUncertainty(sources, 'test query')

      expect(result.level).toBe('none')
      expect(result.avgScore).toBeCloseTo(0.701, 3)
    })
  })
})

// =============================================================================
// generateNextSteps Tests (Task 6.6-6.8)
// =============================================================================

describe('generateNextSteps', () => {
  // Test 6.6: generateNextSteps excludes "search" when hasDocuments=false
  it('excludes "search" when hasDocuments=false', () => {
    const steps = generateNextSteps('complete', false)

    // Should suggest uploading documents, NOT searching
    expect(steps.some((s) => s.toLowerCase().includes('search'))).toBe(false)
    expect(steps).toContain('Upload documents to the Data Room to get started')
  })

  // Test 6.7: generateNextSteps includes Q&A option for complete uncertainty with docs
  it('includes Q&A option for complete uncertainty with docs', () => {
    const steps = generateNextSteps('complete', true)

    expect(steps).toContain(
      'Add this question to the Q&A list for client follow-up'
    )
    // Should NOT suggest uploading since docs exist
    expect(steps.some((s) => s.toLowerCase().includes('upload'))).toBe(false)
  })

  // Test 6.8: generateNextSteps treats undefined hasDocuments as false
  it('treats undefined hasDocuments as false', () => {
    const steps = generateNextSteps('complete', undefined)

    // Should behave as if hasDocuments=false
    expect(steps).toContain('Upload documents to the Data Room to get started')
  })

  it('returns empty array for "none" uncertainty', () => {
    expect(generateNextSteps('none', true)).toEqual([])
    expect(generateNextSteps('none', false)).toEqual([])
  })

  it('returns empty array for "low" uncertainty', () => {
    expect(generateNextSteps('low', true)).toEqual([])
    expect(generateNextSteps('low', false)).toEqual([])
  })

  it('returns request info and Q&A for high uncertainty', () => {
    const steps = generateNextSteps('high', true)

    expect(steps).toContain(
      'Request additional information from the target company'
    )
    expect(steps).toContain('Add to Q&A list')
  })

  it('returns request info and Q&A for medium uncertainty', () => {
    const steps = generateNextSteps('medium', false)

    expect(steps).toContain(
      'Request additional information from the target company'
    )
    expect(steps).toContain('Add to Q&A list')
  })
})

// =============================================================================
// validateResponseHonesty Tests (Task 6.9-6.13)
// =============================================================================

describe('validateResponseHonesty', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
  })

  // Test 6.9: validateResponseHonesty detects "I think" (case insensitive)
  it('detects "I think" (case insensitive)', () => {
    const result1 = validateResponseHonesty('I think the revenue is $5M.')
    expect(result1.isValid).toBe(false)
    expect(result1.issues).toContainEqual(
      expect.stringContaining('I think')
    )

    const result2 = validateResponseHonesty('I THINK this is correct.')
    expect(result2.isValid).toBe(false)

    const result3 = validateResponseHonesty('i think maybe...')
    expect(result3.isValid).toBe(false)
  })

  // Test 6.10: validateResponseHonesty detects standalone "I don't know"
  it('detects standalone "I don\'t know"', () => {
    const result = validateResponseHonesty("I don't know.")

    expect(result.isValid).toBe(false)
    expect(result.issues).toContainEqual(
      expect.stringContaining("I don't know")
    )
  })

  // Test 6.11: validateResponseHonesty allows "I don't know if this applies" (not standalone)
  it('allows "I don\'t know if this applies" (not standalone)', () => {
    const result = validateResponseHonesty(
      "I don't know if this applies to all cases."
    )

    expect(result.isValid).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  // Test 6.12: validateResponseHonesty detects currency without source attribution
  it('detects currency without source attribution', () => {
    const result = validateResponseHonesty('The revenue was $5.2M last quarter.')

    expect(result.isValid).toBe(false)
    expect(result.issues).toContainEqual(
      expect.stringContaining('Currency amount without source attribution')
    )
    expect(result.issues).toContainEqual(expect.stringContaining('$5.2M'))
  })

  // Test 6.13: validateResponseHonesty allows currency WITH source attribution
  it('allows currency WITH source attribution', () => {
    const result = validateResponseHonesty(
      'The revenue was $5.2M (source: Q3_Report.pdf, p.12).'
    )

    expect(result.isValid).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('detects "Maybe" at sentence start', () => {
    const result1 = validateResponseHonesty('Maybe the company should expand.')
    expect(result1.isValid).toBe(false)
    expect(result1.issues).toContainEqual(
      expect.stringContaining('Maybe (sentence start)')
    )

    // After a period
    const result2 = validateResponseHonesty(
      'The revenue is high. Maybe they expanded.'
    )
    expect(result2.isValid).toBe(false)
  })

  it('allows "maybe" mid-sentence', () => {
    const result = validateResponseHonesty(
      'They could expand or maybe consider acquisition.'
    )

    expect(result.isValid).toBe(true)
  })

  it('detects multiple currency amounts without sources', () => {
    const result = validateResponseHonesty(
      'Revenue was $5M and EBITDA was $1.2M.'
    )

    expect(result.isValid).toBe(false)
    expect(result.issues.length).toBeGreaterThanOrEqual(2)
  })

  it('handles mixed valid and invalid currency references', () => {
    const result = validateResponseHonesty(
      'Revenue was $5M (source: Report.pdf). EBITDA was $1.2M.'
    )

    // First has source, second doesn't
    expect(result.isValid).toBe(false)
    expect(result.issues).toContainEqual(
      expect.stringContaining('$1.2M')
    )
  })

  it('returns valid for clean response', () => {
    const result = validateResponseHonesty(
      'Based on available data, revenue was $5M (source: Q3.pdf, p.5). The EBITDA margin improved (source: Annual.pdf).'
    )

    expect(result.isValid).toBe(true)
    expect(result.issues).toHaveLength(0)
    expect(result.suggestions).toHaveLength(0)
  })

  it('logs when validation issues found', () => {
    validateResponseHonesty('I think this is wrong.')

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('[uncertainty] validation issues=')
    )
  })

  it('handles "I don\'t know whether" as non-standalone', () => {
    const result = validateResponseHonesty(
      "I don't know whether this is accurate."
    )

    expect(result.isValid).toBe(true)
  })

  it('handles "I don\'t know what" as non-standalone', () => {
    const result = validateResponseHonesty("I don't know what that means.")

    expect(result.isValid).toBe(true)
  })
})

// =============================================================================
// buildUncertaintyContext Tests (Task 6.14-6.15)
// =============================================================================

describe('buildUncertaintyContext', () => {
  // Test 6.14: buildUncertaintyContext returns empty string for 'none'/'low' uncertainty
  it('returns empty string for "none" uncertainty', () => {
    expect(buildUncertaintyContext('none', true)).toBe('')
    expect(buildUncertaintyContext('none', false)).toBe('')
  })

  it('returns empty string for "low" uncertainty', () => {
    expect(buildUncertaintyContext('low', true)).toBe('')
    expect(buildUncertaintyContext('low', false)).toBe('')
  })

  // Test 6.15: buildUncertaintyContext returns context for 'complete' uncertainty
  it('returns context for "complete" uncertainty without docs', () => {
    const context = buildUncertaintyContext('complete', false)

    expect(context).toContain('**CONTEXT:**')
    expect(context).toContain('No documents in the Data Room')
    expect(context).toContain('suggest uploading documents')
  })

  it('returns context for "complete" uncertainty with docs', () => {
    const context = buildUncertaintyContext('complete', true)

    expect(context).toContain('**CONTEXT:**')
    expect(context).toContain('No relevant information found')
    expect(context).toContain('Q&A list')
  })

  it('returns context for "high" uncertainty', () => {
    const context = buildUncertaintyContext('high', true)

    expect(context).toContain('**CONTEXT:**')
    expect(context).toContain('Limited relevant information')
    expect(context).toContain('Based on limited information')
  })

  it('returns context for "medium" uncertainty', () => {
    const context = buildUncertaintyContext('medium', true)

    expect(context).toContain('**CONTEXT:**')
    expect(context).toContain('Partial information available')
    expect(context).toContain("what's missing")
  })

  it('treats undefined hasDocuments as false', () => {
    const context = buildUncertaintyContext('complete', undefined)

    expect(context).toContain('No documents in the Data Room')
  })
})
