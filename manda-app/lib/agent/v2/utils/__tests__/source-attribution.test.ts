/**
 * Agent System v2.0 - Source Attribution Tests
 *
 * Story: 3-2 Implement Source Attribution (AC: #1-#5)
 *
 * Tests for formatCitation, deduplicateSources, and rankSourcesByRelevance.
 */

import { describe, it, expect } from 'vitest'
import type { SourceCitation } from '../../types'
import {
  formatCitation,
  deduplicateSources,
  rankSourcesByRelevance,
} from '../source-attribution'

// =============================================================================
// Test Helpers
// =============================================================================

function createMockSource(
  overrides: Partial<SourceCitation> = {}
): SourceCitation {
  return {
    documentId: 'doc-123',
    documentName: 'Test Document',
    snippet: 'Test snippet text',
    relevanceScore: 0.8,
    retrievedAt: '2026-01-11T12:00:00.000Z',
    ...overrides,
  }
}

// =============================================================================
// formatCitation Tests (AC: #2)
// =============================================================================

describe('formatCitation', () => {
  it('formats citation with page location', () => {
    // Test: 4.2 - formatCitation produces readable citation string (page)
    const source = createMockSource({
      documentName: 'Management Presentation',
      location: { page: 12 },
    })

    expect(formatCitation(source)).toBe('(Management Presentation, page 12)')
  })

  it('formats citation with section location', () => {
    // Test: 4.2 - formatCitation produces readable citation string (section)
    const source = createMockSource({
      documentName: 'CIM Draft',
      location: { section: 'Executive Summary' },
    })

    expect(formatCitation(source)).toBe('(CIM Draft, Executive Summary)')
  })

  it('formats citation with no location', () => {
    // Test: 4.2 - formatCitation produces readable citation string (no location)
    const source = createMockSource({
      documentName: 'Financial Model',
      location: undefined,
    })

    expect(formatCitation(source)).toBe('(Financial Model, document)')
  })

  it('shows both page and section when both present', () => {
    const source = createMockSource({
      documentName: 'Report',
      location: { page: 5, section: 'Chapter 1' },
    })

    expect(formatCitation(source)).toBe('(Report, page 5, Chapter 1)')
  })
})

// =============================================================================
// deduplicateSources Tests (AC: #5)
// =============================================================================

describe('deduplicateSources', () => {
  it('removes duplicates by documentId+location', () => {
    // Test: 4.3 - deduplicateSources removes duplicates by documentId+location
    const sources = [
      createMockSource({
        documentId: 'doc-1',
        location: { page: 1 },
        relevanceScore: 0.8,
      }),
      createMockSource({
        documentId: 'doc-1',
        location: { page: 1 },
        relevanceScore: 0.7,
      }),
      createMockSource({
        documentId: 'doc-2',
        location: { page: 1 },
        relevanceScore: 0.6,
      }),
    ]

    const deduplicated = deduplicateSources(sources)

    expect(deduplicated).toHaveLength(2)
    expect(deduplicated.map((s) => s.documentId)).toEqual(['doc-1', 'doc-2'])
  })

  it('keeps highest relevance score for duplicates', () => {
    // Test: 4.4 - deduplicateSources keeps highest relevance score for duplicates
    const sources = [
      createMockSource({
        documentId: 'doc-1',
        location: { page: 1 },
        relevanceScore: 0.5,
        snippet: 'Lower relevance',
      }),
      createMockSource({
        documentId: 'doc-1',
        location: { page: 1 },
        relevanceScore: 0.9,
        snippet: 'Higher relevance',
      }),
      createMockSource({
        documentId: 'doc-1',
        location: { page: 1 },
        relevanceScore: 0.7,
        snippet: 'Medium relevance',
      }),
    ]

    const deduplicated = deduplicateSources(sources)

    expect(deduplicated).toHaveLength(1)
    expect(deduplicated[0]!.relevanceScore).toBe(0.9)
    expect(deduplicated[0]!.snippet).toBe('Higher relevance')
  })

  it('treats different pages as different sources', () => {
    const sources = [
      createMockSource({
        documentId: 'doc-1',
        location: { page: 1 },
        relevanceScore: 0.8,
      }),
      createMockSource({
        documentId: 'doc-1',
        location: { page: 2 },
        relevanceScore: 0.7,
      }),
    ]

    const deduplicated = deduplicateSources(sources)

    expect(deduplicated).toHaveLength(2)
  })

  it('treats different sections as different sources', () => {
    const sources = [
      createMockSource({
        documentId: 'doc-1',
        location: { section: 'Overview' },
        relevanceScore: 0.8,
      }),
      createMockSource({
        documentId: 'doc-1',
        location: { section: 'Financials' },
        relevanceScore: 0.7,
      }),
    ]

    const deduplicated = deduplicateSources(sources)

    expect(deduplicated).toHaveLength(2)
  })

  it('treats different documents with same location as different sources', () => {
    // Edge case: same page number but different documents should NOT be deduplicated
    const sources = [
      createMockSource({
        documentId: 'doc-1',
        documentName: 'CIM',
        location: { page: 5 },
        relevanceScore: 0.9,
      }),
      createMockSource({
        documentId: 'doc-2',
        documentName: 'Management Presentation',
        location: { page: 5 },
        relevanceScore: 0.8,
      }),
    ]

    const deduplicated = deduplicateSources(sources)

    expect(deduplicated).toHaveLength(2)
    expect(deduplicated.map((s) => s.documentId).sort()).toEqual(['doc-1', 'doc-2'])
  })

  it('handles sources without location', () => {
    const sources = [
      createMockSource({
        documentId: 'doc-1',
        location: undefined,
        relevanceScore: 0.8,
      }),
      createMockSource({
        documentId: 'doc-1',
        location: undefined,
        relevanceScore: 0.9,
      }),
    ]

    const deduplicated = deduplicateSources(sources)

    expect(deduplicated).toHaveLength(1)
    expect(deduplicated[0]!.relevanceScore).toBe(0.9)
  })

  it('returns empty array for empty input', () => {
    expect(deduplicateSources([])).toEqual([])
  })
})

// =============================================================================
// rankSourcesByRelevance Tests (AC: #5)
// =============================================================================

describe('rankSourcesByRelevance', () => {
  it('sorts by relevance score descending', () => {
    // Test: 4.5 - rankSourcesByRelevance sorts by score descending
    const sources = [
      createMockSource({ relevanceScore: 0.5 }),
      createMockSource({ relevanceScore: 0.9 }),
      createMockSource({ relevanceScore: 0.7 }),
    ]

    const ranked = rankSourcesByRelevance(sources)

    expect(ranked.map((s) => s.relevanceScore)).toEqual([0.9, 0.7, 0.5])
  })

  it('respects limit parameter', () => {
    // Test: 4.6 - rankSourcesByRelevance respects limit parameter
    const sources = [
      createMockSource({ relevanceScore: 0.9 }),
      createMockSource({ relevanceScore: 0.8 }),
      createMockSource({ relevanceScore: 0.7 }),
      createMockSource({ relevanceScore: 0.6 }),
      createMockSource({ relevanceScore: 0.5 }),
    ]

    const ranked = rankSourcesByRelevance(sources, 3)

    expect(ranked).toHaveLength(3)
    expect(ranked.map((s) => s.relevanceScore)).toEqual([0.9, 0.8, 0.7])
  })

  it('returns all sources when limit exceeds array length', () => {
    const sources = [
      createMockSource({ relevanceScore: 0.9 }),
      createMockSource({ relevanceScore: 0.7 }),
    ]

    const ranked = rankSourcesByRelevance(sources, 10)

    expect(ranked).toHaveLength(2)
  })

  it('returns all sources when no limit provided', () => {
    const sources = [
      createMockSource({ relevanceScore: 0.5 }),
      createMockSource({ relevanceScore: 0.9 }),
      createMockSource({ relevanceScore: 0.7 }),
    ]

    const ranked = rankSourcesByRelevance(sources)

    expect(ranked).toHaveLength(3)
  })

  it('does not mutate original array', () => {
    const sources = [
      createMockSource({ relevanceScore: 0.5 }),
      createMockSource({ relevanceScore: 0.9 }),
    ]

    rankSourcesByRelevance(sources)

    expect(sources[0]!.relevanceScore).toBe(0.5)
    expect(sources[1]!.relevanceScore).toBe(0.9)
  })

  it('handles empty array', () => {
    expect(rankSourcesByRelevance([])).toEqual([])
  })

  it('handles limit of 0', () => {
    const sources = [createMockSource({ relevanceScore: 0.9 })]

    const ranked = rankSourcesByRelevance(sources, 0)

    expect(ranked).toHaveLength(0)
  })
})
