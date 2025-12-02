/**
 * SourceCitationLink Component Tests
 *
 * Tests for the clickable source citation link component.
 * Story: E5.4 - Implement Source Citation Display in Messages
 * AC: #2, #3, #5, #6, #8
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SourceCitationLink } from '@/components/chat/SourceCitationLink'

// Mock DocumentPreviewModal to avoid complex dependencies
vi.mock('@/components/knowledge-explorer/shared/DocumentPreviewModal', () => ({
  DocumentPreviewModal: ({
    isOpen,
    onClose,
    documentId,
    documentName,
  }: {
    isOpen: boolean
    onClose: () => void
    documentId: string
    documentName: string
  }) =>
    isOpen ? (
      <div data-testid="document-preview-modal" onClick={onClose}>
        <span>Preview: {documentName}</span>
        <span>ID: {documentId}</span>
      </div>
    ) : null,
}))

describe('SourceCitationLink', () => {
  const defaultProps = {
    documentId: 'doc-123',
    documentName: 'financials.xlsx',
    location: "Sheet 'P&L', Cell B15",
    projectId: 'project-456',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders with document name and location', () => {
      render(<SourceCitationLink {...defaultProps} />)

      expect(
        screen.getByText("financials.xlsx, Sheet 'P&L', Cell B15")
      ).toBeInTheDocument()
    })

    it('renders just document name when no location provided', () => {
      render(<SourceCitationLink {...defaultProps} location="" />)

      expect(screen.getByText('financials.xlsx')).toBeInTheDocument()
    })

    it('displays correct icon for Excel files', () => {
      render(<SourceCitationLink {...defaultProps} />)

      // FileSpreadsheet icon should be present
      const icon = screen.getByTestId('source-citation-link').querySelector('svg')
      expect(icon).toBeInTheDocument()
    })

    it('displays correct icon for PDF files', () => {
      render(
        <SourceCitationLink
          {...defaultProps}
          documentName="report.pdf"
          location="p.15"
        />
      )

      const icon = screen.getByTestId('source-citation-link').querySelector('svg')
      expect(icon).toBeInTheDocument()
    })
  })

  describe('styling (AC: #5)', () => {
    it('has monospace font class', () => {
      render(<SourceCitationLink {...defaultProps} />)

      const link = screen.getByTestId('source-citation-link')
      expect(link).toHaveClass('font-mono')
    })

    it('has background color class', () => {
      render(<SourceCitationLink {...defaultProps} />)

      const link = screen.getByTestId('source-citation-link')
      expect(link.className).toMatch(/bg-muted/)
    })

    it('has hover state classes', () => {
      render(<SourceCitationLink {...defaultProps} />)

      const link = screen.getByTestId('source-citation-link')
      expect(link.className).toMatch(/hover:/)
    })

    it('has min-height for mobile tap targets (AC: #8)', () => {
      render(<SourceCitationLink {...defaultProps} />)

      const link = screen.getByTestId('source-citation-link')
      expect(link.className).toMatch(/min-h-/)
    })
  })

  describe('clickable behavior (AC: #2)', () => {
    it('has cursor-pointer when documentId is provided', () => {
      render(<SourceCitationLink {...defaultProps} />)

      const link = screen.getByTestId('source-citation-link')
      expect(link).toHaveClass('cursor-pointer')
    })

    it('does not have cursor-pointer when documentId is null', () => {
      render(<SourceCitationLink {...defaultProps} documentId={null} />)

      const link = screen.getByTestId('source-citation-link')
      expect(link).toHaveClass('cursor-default')
    })

    it('opens modal on click when documentId is provided', async () => {
      const user = userEvent.setup()
      render(<SourceCitationLink {...defaultProps} />)

      const link = screen.getByTestId('source-citation-link')
      await user.click(link)

      await waitFor(() => {
        expect(screen.getByTestId('document-preview-modal')).toBeInTheDocument()
      })
    })

    it('does not open modal on click when documentId is null', async () => {
      const user = userEvent.setup()
      render(<SourceCitationLink {...defaultProps} documentId={null} />)

      const link = screen.getByTestId('source-citation-link')
      await user.click(link)

      expect(screen.queryByTestId('document-preview-modal')).not.toBeInTheDocument()
    })
  })

  describe('keyboard navigation (AC: #2)', () => {
    it('opens modal on Enter key', async () => {
      render(<SourceCitationLink {...defaultProps} />)

      const link = screen.getByTestId('source-citation-link')
      fireEvent.keyDown(link, { key: 'Enter' })

      await waitFor(() => {
        expect(screen.getByTestId('document-preview-modal')).toBeInTheDocument()
      })
    })

    it('opens modal on Space key', async () => {
      render(<SourceCitationLink {...defaultProps} />)

      const link = screen.getByTestId('source-citation-link')
      fireEvent.keyDown(link, { key: ' ' })

      await waitFor(() => {
        expect(screen.getByTestId('document-preview-modal')).toBeInTheDocument()
      })
    })

    it('has tabIndex for keyboard navigation', () => {
      render(<SourceCitationLink {...defaultProps} />)

      const link = screen.getByTestId('source-citation-link')
      expect(link).toHaveAttribute('tabIndex', '0')
    })
  })

  describe('accessibility', () => {
    it('has aria-label with full path', () => {
      render(<SourceCitationLink {...defaultProps} />)

      const link = screen.getByTestId('source-citation-link')
      expect(link).toHaveAttribute('aria-label', expect.stringContaining('financials.xlsx'))
    })

    it('has aria-haspopup for modal trigger', () => {
      render(<SourceCitationLink {...defaultProps} />)

      const link = screen.getByTestId('source-citation-link')
      expect(link).toHaveAttribute('aria-haspopup', 'dialog')
    })

    it('has role="button" for interactive element', () => {
      render(<SourceCitationLink {...defaultProps} />)

      const link = screen.getByTestId('source-citation-link')
      expect(link).toHaveAttribute('role', 'button')
    })
  })

  describe('fallback behavior (AC: #6)', () => {
    it('shows unavailable styling when isUnavailable is true', () => {
      render(<SourceCitationLink {...defaultProps} isUnavailable />)

      const link = screen.getByTestId('source-citation-link')
      expect(link).toHaveClass('cursor-default')
      expect(link.className).toMatch(/text-muted-foreground/)
    })

    it('does not open modal when unavailable', async () => {
      const user = userEvent.setup()
      render(
        <SourceCitationLink {...defaultProps} documentId={null} isUnavailable />
      )

      const link = screen.getByTestId('source-citation-link')
      await user.click(link)

      expect(screen.queryByTestId('document-preview-modal')).not.toBeInTheDocument()
    })
  })

  describe('DocumentPreviewModal integration (AC: #3)', () => {
    it('passes correct props to DocumentPreviewModal', async () => {
      const user = userEvent.setup()
      render(
        <SourceCitationLink
          {...defaultProps}
          chunkId="chunk-789"
          pageNumber={15}
          sheetName="P&L"
          cellReference="B15"
        />
      )

      const link = screen.getByTestId('source-citation-link')
      await user.click(link)

      await waitFor(() => {
        const modal = screen.getByTestId('document-preview-modal')
        expect(modal).toHaveTextContent('Preview: financials.xlsx')
        expect(modal).toHaveTextContent('ID: doc-123')
      })
    })

    it('closes modal when onClose is called', async () => {
      const user = userEvent.setup()
      render(<SourceCitationLink {...defaultProps} />)

      // Open modal
      const link = screen.getByTestId('source-citation-link')
      await user.click(link)

      await waitFor(() => {
        expect(screen.getByTestId('document-preview-modal')).toBeInTheDocument()
      })

      // Close modal by clicking on it (mock implementation)
      await user.click(screen.getByTestId('document-preview-modal'))

      await waitFor(() => {
        expect(screen.queryByTestId('document-preview-modal')).not.toBeInTheDocument()
      })
    })
  })

  describe('tooltip', () => {
    it('renders tooltip with full source path', async () => {
      const user = userEvent.setup()
      render(<SourceCitationLink {...defaultProps} />)

      const link = screen.getByTestId('source-citation-link')
      await user.hover(link)

      // Tooltip should appear after delay - getAllByText because radix duplicates for a11y
      await waitFor(
        () => {
          const tooltips = screen.getAllByText('Click to view source')
          expect(tooltips.length).toBeGreaterThan(0)
        },
        { timeout: 500 }
      )
    })
  })
})
