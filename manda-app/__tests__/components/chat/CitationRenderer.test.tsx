/**
 * CitationRenderer Component Tests
 *
 * Tests for the citation renderer that embeds clickable citations in text.
 * Story: E5.4 - Implement Source Citation Display in Messages
 * AC: #1, #4, #6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CitationRenderer, CitationFallback } from '@/components/chat/CitationRenderer'

// Mock SourceCitationLink
vi.mock('@/components/chat/SourceCitationLink', () => ({
  SourceCitationLink: ({
    documentName,
    location,
    documentId,
    isUnavailable,
  }: {
    documentName: string
    location: string
    documentId?: string | null
    isUnavailable?: boolean
  }) => (
    <span
      data-testid="source-citation-link"
      data-document={documentName}
      data-location={location}
      data-id={documentId || 'none'}
      data-unavailable={isUnavailable ? 'true' : 'false'}
    >
      [{documentName}: {location}]
    </span>
  ),
}))

describe('CitationRenderer', () => {
  const defaultProps = {
    projectId: 'project-123',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('parsing citations (AC: #1)', () => {
    it('renders text with embedded citations', () => {
      render(
        <CitationRenderer
          {...defaultProps}
          text="Revenue was €5.2M (source: Q3_Report.pdf, p.12) showing growth"
        />
      )

      // Should have surrounding text
      expect(screen.getByText(/Revenue was €5.2M/)).toBeInTheDocument()
      expect(screen.getByText(/showing growth/)).toBeInTheDocument()

      // Should have citation link
      const citation = screen.getByTestId('source-citation-link')
      expect(citation).toHaveAttribute('data-document', 'Q3_Report.pdf')
      expect(citation).toHaveAttribute('data-location', 'p.12')
    })

    it('renders plain text without citations', () => {
      render(
        <CitationRenderer {...defaultProps} text="Plain text without citations" />
      )

      expect(screen.getByText('Plain text without citations')).toBeInTheDocument()
      expect(screen.queryByTestId('source-citation-link')).not.toBeInTheDocument()
    })
  })

  describe('multiple citations (AC: #4)', () => {
    it('renders multiple citations in text', () => {
      render(
        <CitationRenderer
          {...defaultProps}
          text="Data from (source: doc1.pdf, p.1) and (source: doc2.xlsx, B15)"
        />
      )

      const citations = screen.getAllByTestId('source-citation-link')
      expect(citations).toHaveLength(2)
      expect(citations[0]).toHaveAttribute('data-document', 'doc1.pdf')
      expect(citations[1]).toHaveAttribute('data-document', 'doc2.xlsx')
    })

    it('preserves text between citations', () => {
      render(
        <CitationRenderer
          {...defaultProps}
          text="A (source: a.pdf, p.1) middle text (source: b.pdf, p.2) end"
        />
      )

      expect(screen.getByText(/middle text/)).toBeInTheDocument()
      expect(screen.getByText(/end/)).toBeInTheDocument()
    })
  })

  describe('document lookup integration', () => {
    it('passes documentId from lookup to SourceCitationLink', () => {
      const documentLookup = {
        'report.pdf': { documentId: 'doc-456', chunkId: 'chunk-789' },
      }

      render(
        <CitationRenderer
          {...defaultProps}
          text="Data from (source: report.pdf, p.15)"
          documentLookup={documentLookup}
        />
      )

      const citation = screen.getByTestId('source-citation-link')
      expect(citation).toHaveAttribute('data-id', 'doc-456')
      expect(citation).toHaveAttribute('data-unavailable', 'false')
    })

    it('marks citation as unavailable when not in lookup', () => {
      const documentLookup = {
        'other.pdf': { documentId: 'doc-999' },
      }

      render(
        <CitationRenderer
          {...defaultProps}
          text="Data from (source: missing.pdf, p.1)"
          documentLookup={documentLookup}
        />
      )

      const citation = screen.getByTestId('source-citation-link')
      expect(citation).toHaveAttribute('data-id', 'none')
      expect(citation).toHaveAttribute('data-unavailable', 'true')
    })

    it('handles citations without documentLookup', () => {
      render(
        <CitationRenderer
          {...defaultProps}
          text="Data from (source: report.pdf, p.15)"
        />
      )

      const citation = screen.getByTestId('source-citation-link')
      // Should not be marked unavailable when no lookup provided
      expect(citation).toHaveAttribute('data-unavailable', 'false')
    })
  })

  describe('edge cases', () => {
    it('handles empty text', () => {
      const { container } = render(<CitationRenderer {...defaultProps} text="" />)
      expect(container.firstChild).toBeEmptyDOMElement()
    })

    it('handles text starting with citation', () => {
      render(
        <CitationRenderer
          {...defaultProps}
          text="(source: doc.pdf, p.1) at the start"
        />
      )

      const citation = screen.getByTestId('source-citation-link')
      expect(citation).toBeInTheDocument()
      expect(screen.getByText(/at the start/)).toBeInTheDocument()
    })

    it('handles text ending with citation', () => {
      render(
        <CitationRenderer {...defaultProps} text="Ending (source: doc.pdf, p.1)" />
      )

      expect(screen.getByText(/Ending/)).toBeInTheDocument()
      expect(screen.getByTestId('source-citation-link')).toBeInTheDocument()
    })

    it('handles adjacent citations without text between', () => {
      render(
        <CitationRenderer
          {...defaultProps}
          text="(source: a.pdf, p.1)(source: b.pdf, p.2)"
        />
      )

      const citations = screen.getAllByTestId('source-citation-link')
      expect(citations).toHaveLength(2)
    })
  })

  describe('className prop', () => {
    it('applies custom className', () => {
      const { container } = render(
        <CitationRenderer
          {...defaultProps}
          text="Some text"
          className="custom-class"
        />
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })
  })
})

describe('CitationFallback', () => {
  it('renders document name and location', () => {
    render(<CitationFallback documentName="report.pdf" location="p.15" />)

    expect(screen.getByText('report.pdf, p.15')).toBeInTheDocument()
  })

  it('renders just document name when no location', () => {
    render(<CitationFallback documentName="report.pdf" location="" />)

    expect(screen.getByText('report.pdf')).toBeInTheDocument()
  })

  it('has fallback styling', () => {
    render(<CitationFallback documentName="report.pdf" location="p.15" />)

    const element = screen.getByTestId('citation-fallback')
    expect(element).toHaveClass('font-mono')
    expect(element.className).toMatch(/text-muted-foreground/)
  })

  it('has title for tooltip', () => {
    render(<CitationFallback documentName="report.pdf" location="p.15" />)

    const element = screen.getByTestId('citation-fallback')
    expect(element).toHaveAttribute('title', 'Document not found')
  })
})
