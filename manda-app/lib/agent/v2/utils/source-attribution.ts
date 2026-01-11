/**
 * Agent System v2.0 - Source Attribution Utilities
 *
 * Story: 3-2 Implement Source Attribution (AC: #2, #5)
 *
 * Utilities for formatting, deduplicating, and ranking source citations.
 *
 * References:
 * - [Source: _bmad-output/planning-artifacts/agent-system-prd.md#FR24]
 * - [Source: lib/agent/v2/types.ts - SourceCitation interface]
 */

import type { SourceCitation } from '../types'

// =============================================================================
// Citation Formatting (FR24)
// =============================================================================

/**
 * Format a source citation for human-readable display.
 *
 * Story: 3-2 (AC: #2)
 *
 * This is a **consumer-facing utility** for UI components to format citations.
 * The agent emits raw `source_added` events with full SourceCitation objects;
 * this function formats them for display in chat messages or source lists.
 *
 * @param source - The source citation to format
 * @returns Human-readable citation string
 *
 * @example
 * ```typescript
 * // In a React component consuming source_added events:
 * formatCitation({ documentName: 'CIM', location: { page: 12 } })
 * // => "(CIM, page 12)"
 *
 * formatCitation({ documentName: 'CIM', location: { section: 'Overview' } })
 * // => "(CIM, Overview)"
 *
 * formatCitation({ documentName: 'CIM', location: { page: 5, section: 'Financials' } })
 * // => "(CIM, page 5, Financials)"
 *
 * formatCitation({ documentName: 'CIM' })
 * // => "(CIM, document)"
 * ```
 *
 * @remarks
 * - When both page and section are present, both are shown
 * - Used by UI components like SourceCitationLink for display formatting
 */
export function formatCitation(source: SourceCitation): string {
  const parts: string[] = []

  if (source.location?.page) {
    parts.push(`page ${source.location.page}`)
  }
  if (source.location?.section) {
    parts.push(source.location.section)
  }

  const location = parts.length > 0 ? parts.join(', ') : 'document'

  return `(${source.documentName}, ${location})`
}

// =============================================================================
// Deduplication (AC: #5)
// =============================================================================

/**
 * Deduplicate sources by documentId + location combination.
 * Keeps the source with the highest relevance score for each unique key.
 *
 * Story: 3-2 (AC: #5)
 *
 * @param sources - Array of source citations to deduplicate
 * @returns Deduplicated array preserving highest relevance for each location
 *
 * @example
 * ```typescript
 * const sources = [
 *   { documentId: 'doc1', location: { page: 1 }, relevanceScore: 0.8 },
 *   { documentId: 'doc1', location: { page: 1 }, relevanceScore: 0.9 },
 * ]
 * deduplicateSources(sources)
 * // => [{ documentId: 'doc1', location: { page: 1 }, relevanceScore: 0.9 }]
 * ```
 */
export function deduplicateSources(sources: SourceCitation[]): SourceCitation[] {
  const seen = new Map<string, SourceCitation>()

  for (const source of sources) {
    const key = `${source.documentId}:${source.location?.page ?? ''}:${source.location?.section ?? ''}`
    const existing = seen.get(key)

    if (!existing || source.relevanceScore > existing.relevanceScore) {
      seen.set(key, source) // Keep highest relevance
    }
  }

  return Array.from(seen.values())
}

// =============================================================================
// Ranking (AC: #5)
// =============================================================================

/**
 * Rank sources by relevance score in descending order.
 * Optionally limits results to top N sources.
 *
 * Story: 3-2 (AC: #5)
 *
 * @param sources - Array of source citations to rank
 * @param limit - Maximum number of sources to return (default: no limit)
 * @returns Sorted array of sources, limited to `limit` if specified
 *
 * @example
 * ```typescript
 * const sources = [
 *   { relevanceScore: 0.5 },
 *   { relevanceScore: 0.9 },
 *   { relevanceScore: 0.7 },
 * ]
 * rankSourcesByRelevance(sources, 2)
 * // => [{ relevanceScore: 0.9 }, { relevanceScore: 0.7 }]
 * ```
 */
export function rankSourcesByRelevance(
  sources: SourceCitation[],
  limit?: number
): SourceCitation[] {
  const sorted = [...sources].sort((a, b) => b.relevanceScore - a.relevanceScore)
  return limit !== undefined ? sorted.slice(0, limit) : sorted
}
