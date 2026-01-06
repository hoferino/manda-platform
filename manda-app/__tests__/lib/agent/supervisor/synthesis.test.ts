/**
 * Tests for Supervisor Synthesis Logic
 *
 * Story: E13.4 - Supervisor Agent Pattern (AC: #4)
 *
 * Tests result synthesis, source deduplication, and confidence aggregation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  synthesizeResults,
  deduplicateSources,
  calculateAggregateConfidence,
  needsSynthesis,
  getSynthesisStats,
} from '@/lib/agent/supervisor/synthesis'
import type { SpecialistResult, SourceReference } from '@/lib/agent/supervisor/state'

// =============================================================================
// Mock LLM Client
// =============================================================================

vi.mock('@/lib/llm/client', () => ({
  createLLMClient: vi.fn(() => ({
    invoke: vi.fn().mockResolvedValue({
      content: 'Synthesized response combining financial and entity analysis.',
    }),
  })),
}))

// =============================================================================
// Test Fixtures
// =============================================================================

function createSpecialistResult(overrides: Partial<SpecialistResult> = {}): SpecialistResult {
  return {
    specialistId: 'financial_analyst',
    output: 'EBITDA is $5M with a 15% margin.',
    confidence: 0.85,
    sources: [],
    timing: 150,
    ...overrides,
  }
}

function createSource(overrides: Partial<SourceReference> = {}): SourceReference {
  return {
    documentId: 'doc-1',
    documentName: 'Financial Report.pdf',
    chunkId: 'chunk-1',
    relevanceScore: 0.9,
    snippet: 'Revenue was $10M...',
    ...overrides,
  }
}

// =============================================================================
// deduplicateSources Tests (AC: #4)
// =============================================================================

describe('deduplicateSources', () => {
  it('deduplicates sources by documentId', () => {
    const sources: SourceReference[] = [
      createSource({ documentId: 'doc-1', relevanceScore: 0.8 }),
      createSource({ documentId: 'doc-1', relevanceScore: 0.9 }),
      createSource({ documentId: 'doc-2', relevanceScore: 0.7 }),
    ]

    const deduplicated = deduplicateSources(sources)

    expect(deduplicated.length).toBe(2)
    // Should keep the higher relevance score
    const doc1 = deduplicated.find(s => s.documentId === 'doc-1')
    expect(doc1?.relevanceScore).toBe(0.9)
  })

  it('uses documentName + chunkId as fallback key', () => {
    const sources: SourceReference[] = [
      createSource({ documentId: undefined, documentName: 'Report.pdf', chunkId: 'c1' }),
      createSource({ documentId: undefined, documentName: 'Report.pdf', chunkId: 'c1' }),
      createSource({ documentId: undefined, documentName: 'Report.pdf', chunkId: 'c2' }),
    ]

    const deduplicated = deduplicateSources(sources)

    expect(deduplicated.length).toBe(2)
  })

  it('sorts results by relevance score descending', () => {
    const sources: SourceReference[] = [
      createSource({ documentId: 'doc-1', relevanceScore: 0.5 }),
      createSource({ documentId: 'doc-2', relevanceScore: 0.9 }),
      createSource({ documentId: 'doc-3', relevanceScore: 0.7 }),
    ]

    const deduplicated = deduplicateSources(sources)

    expect(deduplicated[0]?.relevanceScore).toBe(0.9)
    expect(deduplicated[1]?.relevanceScore).toBe(0.7)
    expect(deduplicated[2]?.relevanceScore).toBe(0.5)
  })

  it('handles empty source array', () => {
    const deduplicated = deduplicateSources([])
    expect(deduplicated).toEqual([])
  })

  it('handles sources without relevance scores', () => {
    const sources: SourceReference[] = [
      createSource({ documentId: 'doc-1', relevanceScore: undefined }),
      createSource({ documentId: 'doc-2', relevanceScore: undefined }),
    ]

    const deduplicated = deduplicateSources(sources)
    expect(deduplicated.length).toBe(2)
  })
})

// =============================================================================
// calculateAggregateConfidence Tests (AC: #4)
// =============================================================================

describe('calculateAggregateConfidence', () => {
  it('returns weighted average of confidence scores', () => {
    const results: SpecialistResult[] = [
      createSpecialistResult({ confidence: 0.9, output: 'Short' }),
      createSpecialistResult({ confidence: 0.8, output: 'Longer output text' }),
    ]

    const confidence = calculateAggregateConfidence(results)

    expect(confidence).toBeGreaterThan(0.8)
    expect(confidence).toBeLessThanOrEqual(0.9)
  })

  it('returns 0 for empty results', () => {
    const confidence = calculateAggregateConfidence([])
    expect(confidence).toBe(0)
  })

  it('penalizes results with errors', () => {
    const results: SpecialistResult[] = [
      createSpecialistResult({ confidence: 0.9 }),
      createSpecialistResult({ confidence: 0.8, error: 'Some error' }),
    ]

    const confidence = calculateAggregateConfidence(results)

    // Should be lower than if there were no errors
    expect(confidence).toBeLessThan(0.9)
  })

  it('returns low confidence when all results have errors', () => {
    const results: SpecialistResult[] = [
      createSpecialistResult({ confidence: 0.9, error: 'Error 1' }),
      createSpecialistResult({ confidence: 0.8, error: 'Error 2' }),
    ]

    const confidence = calculateAggregateConfidence(results)
    expect(confidence).toBe(0.2)
  })

  it('weights longer outputs more heavily', () => {
    const resultsShortHigh: SpecialistResult[] = [
      createSpecialistResult({ confidence: 0.95, output: 'Short' }),
      createSpecialistResult({ confidence: 0.6, output: 'This is a much longer and more comprehensive output that should have more weight' }),
    ]

    const resultsLongHigh: SpecialistResult[] = [
      createSpecialistResult({ confidence: 0.6, output: 'Short' }),
      createSpecialistResult({ confidence: 0.95, output: 'This is a much longer and more comprehensive output that should have more weight' }),
    ]

    const confidenceShortHigh = calculateAggregateConfidence(resultsShortHigh)
    const confidenceLongHigh = calculateAggregateConfidence(resultsLongHigh)

    // Longer output with higher confidence should result in higher aggregate
    expect(confidenceLongHigh).toBeGreaterThan(confidenceShortHigh)
  })
})

// =============================================================================
// synthesizeResults Tests (AC: #4)
// =============================================================================

describe('synthesizeResults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty response for no results', async () => {
    const response = await synthesizeResults([])

    expect(response.content).toContain('unable to find')
    expect(response.confidence).toBe(0)
    expect(response.specialists).toEqual([])
    expect(response.wasSynthesized).toBe(false)
  })

  it('returns single specialist result directly without synthesis', async () => {
    const result = createSpecialistResult({
      output: 'Direct output from specialist',
      confidence: 0.9,
    })

    const response = await synthesizeResults([result])

    expect(response.content).toBe('Direct output from specialist')
    expect(response.confidence).toBe(0.9)
    expect(response.wasSynthesized).toBe(false)
    expect(response.specialists).toEqual(['financial_analyst'])
  })

  it('synthesizes multiple specialist results', async () => {
    const results: SpecialistResult[] = [
      createSpecialistResult({
        specialistId: 'financial_analyst',
        output: 'EBITDA analysis',
        confidence: 0.9,
      }),
      createSpecialistResult({
        specialistId: 'knowledge_graph',
        output: 'Entity relationships',
        confidence: 0.85,
      }),
    ]

    const response = await synthesizeResults(results)

    expect(response.wasSynthesized).toBe(true)
    expect(response.specialists).toContain('financial_analyst')
    expect(response.specialists).toContain('knowledge_graph')
    expect(response.content).toBeDefined()
  })

  it('deduplicates sources from multiple specialists', async () => {
    const sharedSource = createSource({ documentId: 'shared-doc' })
    const results: SpecialistResult[] = [
      createSpecialistResult({
        specialistId: 'financial_analyst',
        sources: [sharedSource, createSource({ documentId: 'fin-doc' })],
      }),
      createSpecialistResult({
        specialistId: 'knowledge_graph',
        sources: [sharedSource, createSource({ documentId: 'kg-doc' })],
      }),
    ]

    const response = await synthesizeResults(results)

    // Should have 3 unique sources, not 4
    expect(response.sources.length).toBe(3)
  })

  it('handles error message for errored single result', async () => {
    const result = createSpecialistResult({
      error: 'Analysis failed',
      output: '',
    })

    const response = await synthesizeResults([result])

    expect(response.content).toContain('encountered an issue')
    expect(response.content).toContain('Analysis failed')
  })

  it('includes timing metrics', async () => {
    const result = createSpecialistResult({ timing: 200 })
    const response = await synthesizeResults([result])

    expect(response.totalLatencyMs).toBeDefined()
  })
})

// =============================================================================
// needsSynthesis Tests
// =============================================================================

describe('needsSynthesis', () => {
  it('returns false for empty results', () => {
    expect(needsSynthesis([])).toBe(false)
  })

  it('returns false for single result', () => {
    const results = [createSpecialistResult()]
    expect(needsSynthesis(results)).toBe(false)
  })

  it('returns true for multiple valid results', () => {
    const results = [
      createSpecialistResult({ specialistId: 'financial_analyst' }),
      createSpecialistResult({ specialistId: 'knowledge_graph' }),
    ]
    expect(needsSynthesis(results)).toBe(true)
  })

  it('returns false when all but one have errors', () => {
    const results = [
      createSpecialistResult({ specialistId: 'financial_analyst' }),
      createSpecialistResult({ specialistId: 'knowledge_graph', error: 'Failed', output: '' }),
    ]
    expect(needsSynthesis(results)).toBe(false)
  })
})

// =============================================================================
// getSynthesisStats Tests
// =============================================================================

describe('getSynthesisStats', () => {
  it('returns correct statistics', () => {
    const response = {
      content: 'Test content',
      confidence: 0.85,
      sources: [createSource(), createSource({ documentId: 'doc-2' })],
      specialists: ['financial_analyst', 'knowledge_graph'],
      wasSynthesized: true,
      totalLatencyMs: 500,
    }

    const stats = getSynthesisStats(response)

    expect(stats.specialistCount).toBe(2)
    expect(stats.wasSynthesized).toBe(true)
    expect(stats.confidence).toBe(0.85)
    expect(stats.sourceCount).toBe(2)
    expect(stats.contentLength).toBe(12)
    expect(stats.latencyMs).toBe(500)
  })
})
