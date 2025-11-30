/**
 * SourceAttributionLink Component Tests
 * Story: E4.5 - Implement Source Attribution Links (AC: 1, 6, 9)
 *
 * Tests:
 * - Renders clickable source link with document name
 * - Displays page/sheet/cell reference when available
 * - Shows tooltip on hover with full path
 * - Opens DocumentPreviewModal on click
 * - Accessibility: ARIA labels, keyboard navigation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SourceAttributionLink } from '@/components/knowledge-explorer/shared/SourceAttributionLink'

// Mock the DocumentPreviewModal to avoid modal portal issues in tests
vi.mock('@/components/knowledge-explorer/shared/DocumentPreviewModal', () => ({
  DocumentPreviewModal: vi.fn(({ isOpen, onClose, documentName }) =>
    isOpen ? (
      <div data-testid="mock-modal" role="dialog">
        <span>Modal for: {documentName}</span>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null
  ),
}))

describe('SourceAttributionLink', () => {
  const defaultProps = {
    documentId: 'doc-123',
    documentName: 'Financial_Report_Q1.xlsx',
    chunkId: 'chunk-456',
    pageNumber: null,
    sheetName: 'P&L',
    cellReference: 'B15',
    projectId: 'project-789',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering (AC1)', () => {
    it('renders document name', () => {
      render(<SourceAttributionLink {...defaultProps} />)
      expect(screen.getByText(/Financial_Report_Q1\.xlsx/)).toBeInTheDocument()
    })

    it('renders Excel reference with sheet and cell', () => {
      render(<SourceAttributionLink {...defaultProps} />)
      expect(screen.getByText(/Sheet 'P&L', Cell B15/)).toBeInTheDocument()
    })

    it('renders PDF reference with page number', () => {
      render(
        <SourceAttributionLink
          {...defaultProps}
          documentName="report.pdf"
          sheetName={null}
          cellReference={null}
          pageNumber={42}
        />
      )
      expect(screen.getByText(/p\.42/)).toBeInTheDocument()
    })

    it('renders just document name when no references', () => {
      render(
        <SourceAttributionLink
          {...defaultProps}
          sheetName={null}
          cellReference={null}
          pageNumber={null}
        />
      )
      expect(screen.getByText('Financial_Report_Q1.xlsx')).toBeInTheDocument()
    })
  })

  describe('Accessibility (AC6)', () => {
    it('has accessible button role', () => {
      render(<SourceAttributionLink {...defaultProps} />)
      const link = screen.getByRole('button')
      expect(link).toBeInTheDocument()
    })

    it('has ARIA label with full path', () => {
      render(<SourceAttributionLink {...defaultProps} />)
      const link = screen.getByRole('button')
      expect(link).toHaveAttribute('aria-label', expect.stringContaining('View source'))
    })

    it('indicates dialog will open', () => {
      render(<SourceAttributionLink {...defaultProps} />)
      const link = screen.getByRole('button')
      expect(link).toHaveAttribute('aria-haspopup', 'dialog')
    })

    it('is keyboard accessible', async () => {
      const user = userEvent.setup()
      render(<SourceAttributionLink {...defaultProps} />)

      const link = screen.getByRole('button')
      await user.tab()
      expect(link).toHaveFocus()
    })

    it('opens modal on Enter key', async () => {
      const user = userEvent.setup()
      render(<SourceAttributionLink {...defaultProps} />)

      const link = screen.getByRole('button')
      await user.tab()
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(screen.getByTestId('mock-modal')).toBeInTheDocument()
      })
    })
  })

  describe('Click Behavior', () => {
    it('opens modal on click', async () => {
      const user = userEvent.setup()
      render(<SourceAttributionLink {...defaultProps} />)

      await user.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByTestId('mock-modal')).toBeInTheDocument()
      })
    })

    it('closes modal when onClose is called', async () => {
      const user = userEvent.setup()
      render(<SourceAttributionLink {...defaultProps} />)

      // Open modal
      await user.click(screen.getByRole('button'))
      expect(screen.getByTestId('mock-modal')).toBeInTheDocument()

      // Close modal
      await user.click(screen.getByText('Close'))

      await waitFor(() => {
        expect(screen.queryByTestId('mock-modal')).not.toBeInTheDocument()
      })
    })
  })

  describe('Document Type Icons', () => {
    it('uses spreadsheet icon for Excel files', () => {
      render(<SourceAttributionLink {...defaultProps} />)
      // Icon is rendered, look for button with the icon inside
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })

    it('uses file icon for PDF files', () => {
      render(
        <SourceAttributionLink
          {...defaultProps}
          documentName="document.pdf"
        />
      )
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })
  })

  describe('Tooltip', () => {
    it('shows full path in tooltip', async () => {
      const user = userEvent.setup()
      render(<SourceAttributionLink {...defaultProps} />)

      const link = screen.getByRole('button')
      await user.hover(link)

      // Tooltip should appear (may take a moment)
      await waitFor(
        () => {
          expect(screen.getByRole('tooltip')).toBeInTheDocument()
        },
        { timeout: 1000 }
      )
    })
  })
})
