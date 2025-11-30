/**
 * SelectionToolbar Component Tests
 * Story: E4.11 - Build Bulk Actions for Finding Management (AC: 3, 4, 5)
 *
 * Tests:
 * - Renders when items are selected
 * - Does not render when nothing selected
 * - Shows correct selection count
 * - Validate button triggers callback
 * - Reject button triggers callback
 * - Clear button triggers callback
 * - Buttons are disabled when processing
 * - Accessibility attributes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SelectionToolbar } from '@/components/knowledge-explorer/findings/SelectionToolbar'

describe('SelectionToolbar', () => {
  const defaultProps = {
    selectedCount: 5,
    onClearSelection: vi.fn(),
    onBulkValidate: vi.fn(),
    onBulkReject: vi.fn(),
    isProcessing: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders when items are selected', () => {
      render(<SelectionToolbar {...defaultProps} />)

      expect(screen.getByRole('toolbar')).toBeInTheDocument()
    })

    it('does not render when selectedCount is 0', () => {
      render(<SelectionToolbar {...defaultProps} selectedCount={0} />)

      expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
    })

    it('shows correct selection count', () => {
      render(<SelectionToolbar {...defaultProps} selectedCount={10} />)

      expect(screen.getByText('10')).toBeInTheDocument()
      expect(screen.getByText('findings selected')).toBeInTheDocument()
    })

    it('shows singular "finding" for count of 1', () => {
      render(<SelectionToolbar {...defaultProps} selectedCount={1} />)

      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('finding selected')).toBeInTheDocument()
    })
  })

  describe('Button Actions (AC: 4, 5)', () => {
    it('calls onBulkValidate when Validate button clicked', () => {
      render(<SelectionToolbar {...defaultProps} />)

      const validateButton = screen.getByRole('button', { name: /validate.*selected/i })
      fireEvent.click(validateButton)

      expect(defaultProps.onBulkValidate).toHaveBeenCalledTimes(1)
    })

    it('calls onBulkReject when Reject button clicked', () => {
      render(<SelectionToolbar {...defaultProps} />)

      const rejectButton = screen.getByRole('button', { name: /reject.*selected/i })
      fireEvent.click(rejectButton)

      expect(defaultProps.onBulkReject).toHaveBeenCalledTimes(1)
    })

    it('calls onClearSelection when Clear button clicked', () => {
      render(<SelectionToolbar {...defaultProps} />)

      const clearButton = screen.getByRole('button', { name: /clear selection/i })
      fireEvent.click(clearButton)

      expect(defaultProps.onClearSelection).toHaveBeenCalledTimes(1)
    })
  })

  describe('Processing State', () => {
    it('disables all buttons when processing', () => {
      render(<SelectionToolbar {...defaultProps} isProcessing={true} />)

      const validateButton = screen.getByRole('button', { name: /validate.*selected/i })
      const rejectButton = screen.getByRole('button', { name: /reject.*selected/i })
      const clearButton = screen.getByRole('button', { name: /clear selection/i })

      expect(validateButton).toBeDisabled()
      expect(rejectButton).toBeDisabled()
      expect(clearButton).toBeDisabled()
    })

    it('does not call callbacks when buttons are disabled', () => {
      render(<SelectionToolbar {...defaultProps} isProcessing={true} />)

      const validateButton = screen.getByRole('button', { name: /validate.*selected/i })
      fireEvent.click(validateButton)

      expect(defaultProps.onBulkValidate).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('has correct toolbar role', () => {
      render(<SelectionToolbar {...defaultProps} />)

      expect(screen.getByRole('toolbar')).toBeInTheDocument()
    })

    it('has aria-label describing the toolbar', () => {
      render(<SelectionToolbar {...defaultProps} selectedCount={5} />)

      const toolbar = screen.getByRole('toolbar')
      expect(toolbar).toHaveAttribute('aria-label', expect.stringContaining('5'))
      expect(toolbar).toHaveAttribute('aria-label', expect.stringContaining('selected'))
    })

    it('buttons have descriptive aria-labels', () => {
      render(<SelectionToolbar {...defaultProps} selectedCount={3} />)

      expect(screen.getByLabelText(/validate 3 selected finding/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/reject 3 selected finding/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/clear selection/i)).toBeInTheDocument()
    })
  })
})
