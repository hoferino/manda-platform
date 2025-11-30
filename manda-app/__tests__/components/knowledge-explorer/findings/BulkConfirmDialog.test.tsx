/**
 * BulkConfirmDialog Component Tests
 * Story: E4.11 - Build Bulk Actions for Finding Management (AC: 5, 6)
 *
 * Tests:
 * - Opens and closes correctly
 * - Shows correct action type (validate/reject)
 * - Shows correct finding count
 * - Confirm button triggers callback
 * - Cancel button triggers callback
 * - Processing state disables buttons
 * - Shows undo information
 * - Accessibility attributes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BulkConfirmDialog } from '@/components/knowledge-explorer/findings/BulkConfirmDialog'

describe('BulkConfirmDialog', () => {
  const defaultProps = {
    isOpen: true,
    action: 'validate' as const,
    count: 5,
    isProcessing: false,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders when isOpen is true', () => {
      render(<BulkConfirmDialog {...defaultProps} />)

      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })

    it('does not render when isOpen is false', () => {
      render(<BulkConfirmDialog {...defaultProps} isOpen={false} />)

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
  })

  describe('Validate Action', () => {
    it('shows validate title', () => {
      render(<BulkConfirmDialog {...defaultProps} action="validate" />)

      expect(screen.getByText('Validate findings')).toBeInTheDocument()
    })

    it('shows validate description with count', () => {
      render(<BulkConfirmDialog {...defaultProps} action="validate" count={5} />)

      // Description is in a paragraph, button has different text format
      const description = screen.getByText(/Are you sure you want to validate 5 finding/i)
      expect(description).toBeInTheDocument()
    })

    it('shows singular for count of 1', () => {
      render(<BulkConfirmDialog {...defaultProps} action="validate" count={1} />)

      const description = screen.getByText(/Are you sure you want to validate 1 finding\?/i)
      expect(description).toBeInTheDocument()
    })

    it('shows Validate confirm button text', () => {
      render(<BulkConfirmDialog {...defaultProps} action="validate" count={3} />)

      expect(screen.getByRole('button', { name: /validate 3 finding/i })).toBeInTheDocument()
    })
  })

  describe('Reject Action', () => {
    it('shows reject title', () => {
      render(<BulkConfirmDialog {...defaultProps} action="reject" />)

      expect(screen.getByText('Reject findings')).toBeInTheDocument()
    })

    it('shows reject description with count', () => {
      render(<BulkConfirmDialog {...defaultProps} action="reject" count={10} />)

      // Description is in a paragraph, button has different text format
      const description = screen.getByText(/Are you sure you want to reject 10 finding/i)
      expect(description).toBeInTheDocument()
    })

    it('shows Reject confirm button text', () => {
      render(<BulkConfirmDialog {...defaultProps} action="reject" count={3} />)

      expect(screen.getByRole('button', { name: /reject 3 finding/i })).toBeInTheDocument()
    })
  })

  describe('Undo Information (AC: 6)', () => {
    it('shows undo information message', () => {
      render(<BulkConfirmDialog {...defaultProps} />)

      expect(screen.getByText(/undo this action within 5 seconds/i)).toBeInTheDocument()
    })
  })

  describe('Button Actions', () => {
    it('calls onConfirm when confirm button clicked', () => {
      render(<BulkConfirmDialog {...defaultProps} />)

      const confirmButton = screen.getByRole('button', { name: /validate 5 finding/i })
      fireEvent.click(confirmButton)

      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1)
    })

    it('calls onCancel when cancel button clicked', () => {
      render(<BulkConfirmDialog {...defaultProps} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1)
    })

    it('calls onCancel when dialog is closed via escape or overlay', async () => {
      render(<BulkConfirmDialog {...defaultProps} />)

      // Press escape key
      fireEvent.keyDown(document, { key: 'Escape' })

      await waitFor(() => {
        expect(defaultProps.onCancel).toHaveBeenCalled()
      })
    })
  })

  describe('Processing State', () => {
    it('disables confirm button when processing', () => {
      render(<BulkConfirmDialog {...defaultProps} isProcessing={true} />)

      const confirmButton = screen.getByRole('button', { name: /processing/i })
      expect(confirmButton).toBeDisabled()
    })

    it('disables cancel button when processing', () => {
      render(<BulkConfirmDialog {...defaultProps} isProcessing={true} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      expect(cancelButton).toBeDisabled()
    })

    it('shows processing state in button', () => {
      render(<BulkConfirmDialog {...defaultProps} isProcessing={true} />)

      expect(screen.getByText(/processing/i)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has alertdialog role', () => {
      render(<BulkConfirmDialog {...defaultProps} />)

      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })

    it('focuses cancel button when opened', async () => {
      render(<BulkConfirmDialog {...defaultProps} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })

      await waitFor(() => {
        expect(cancelButton).toHaveFocus()
      })
    })
  })
})
