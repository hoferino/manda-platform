'use client'

/**
 * CitationRenderer Component
 *
 * Renders text content with embedded clickable source citations.
 * Replaces citation patterns with interactive SourceCitationLink components.
 * Story: E5.4 - Implement Source Citation Display in Messages
 * AC: #1 (Parse Citations), #4 (Multiple Citations), #6 (Fallback)
 *
 * Features:
 * - Parses (source: filename, location) patterns
 * - Renders citations as clickable links
 * - Handles multiple citations in single text
 * - Fallback for unparseable/unavailable citations
 * - Preserves surrounding text
 */

import { memo, useMemo } from 'react'
import { splitTextWithCitations, type ParsedCitation } from '@/lib/utils/citation-parser'
import { SourceCitationLink } from './SourceCitationLink'

/**
 * Document lookup result for mapping filenames to IDs
 */
export interface DocumentLookup {
  [documentName: string]: {
    documentId: string
    chunkId?: string | null
  } | undefined
}

export interface CitationRendererProps {
  /** Text content that may contain citations */
  text: string
  /** Project ID for document access */
  projectId: string
  /** Optional lookup map for document name → document ID resolution */
  documentLookup?: DocumentLookup
  /** Additional CSS classes for text wrapper */
  className?: string
}

/**
 * Render a single citation with lookup resolution
 */
function renderCitation(
  citation: ParsedCitation,
  projectId: string,
  documentLookup?: DocumentLookup,
  key?: string | number
): React.ReactNode {
  const lookup = documentLookup?.[citation.documentName]

  return (
    <SourceCitationLink
      key={key}
      documentId={lookup?.documentId}
      documentName={citation.documentName}
      location={citation.location}
      chunkId={lookup?.chunkId}
      pageNumber={citation.pageNumber}
      sheetName={citation.sheetName}
      cellReference={citation.cellReference}
      projectId={projectId}
      isUnavailable={documentLookup !== undefined && !lookup}
    />
  )
}

export const CitationRenderer = memo(function CitationRenderer({
  text,
  projectId,
  documentLookup,
  className,
}: CitationRendererProps) {
  const segments = useMemo(() => splitTextWithCitations(text), [text])

  // If no citations, just return the text
  if (segments.length === 1 && segments[0]?.type === 'text') {
    return <span className={className}>{text}</span>
  }

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <span key={index}>{segment.content}</span>
        }

        if (segment.type === 'citation' && segment.citation) {
          return renderCitation(
            segment.citation,
            projectId,
            documentLookup,
            index
          )
        }

        return null
      })}
    </span>
  )
})

/**
 * CitationFallback Component
 *
 * Displays a citation in fallback mode when document is unavailable.
 * Story: E5.4 - AC: #6 (Fallback)
 */
export interface CitationFallbackProps {
  /** Document filename */
  documentName: string
  /** Location string */
  location: string
  /** Additional CSS classes */
  className?: string
}

export const CitationFallback = memo(function CitationFallback({
  documentName,
  location,
  className,
}: CitationFallbackProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-mono bg-muted/50 text-muted-foreground rounded px-1.5 py-0.5 mx-0.5 ${className || ''}`}
      title="Document not found"
      data-testid="citation-fallback"
    >
      {documentName}
      {location && `, ${location}`}
    </span>
  )
})
