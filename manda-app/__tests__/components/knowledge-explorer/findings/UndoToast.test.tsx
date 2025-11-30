/**
 * UndoToast Component Tests
 * Story: E4.11 - Build Bulk Actions for Finding Management (AC: 9)
 *
 * Tests:
 * - Renders with correct action type
 * - Shows correct finding count
 * - Shows countdown timer
 * - Undo button triggers callback
 * - Dismiss button triggers callback
 * - Does not render when remainingTime is 0
 * - Progress bar updates with time
 * - Accessibility attributes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UndoToast } from '@/components/knowledge-explorer/findings/UndoToast'

describe('UndoToast', () => {
  const defaultProps = {
    action: 'validate' as const,
    count: 5,
    remainingTime: 5,
    totalTime: 5,
    isUndoing: false,
    onUndo: vi.fn(),
    onDismiss: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders when remainingTime > 0', () => {
      render(<UndoToast {...defaultProps} />)

      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('does not render when remainingTime is 0', () => {
      render(<UndoToast {...defaultProps} remainingTime={0} />)

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('does not render when remainingTime is negative', () => {
      render(<UndoToast {...defaultProps} remainingTime={-1} />)

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('Validate Action', () => {
    it('shows validated message', () => {
      render(<UndoToast {...defaultProps} action="validate" />)

      expect(screen.getByText(/validated/i)).toBeInTheDocument()
    })

    it('shows correct count', () => {
      render(<UndoToast {...defaultProps} action="validate" count={10} />)

      expect(screen.getByText('10')).toBeInTheDocument()
      expect(screen.getByText(/findings validated/i)).toBeInTheDocument()
    })

    it('shows singular for count of 1', () => {
      render(<UndoToast {...defaultProps} action="validate" count={1} />)

      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText(/finding validated/i)).toBeInTheDocument()
    })
  })

  describe('Reject Action', () => {
    it('shows rejected message', () => {
      render(<UndoToast {...defaultProps} action="reject" />)

      expect(screen.getByText(/rejected/i)).toBeInTheDocument()
    })

    it('shows correct count', () => {
      render(<UndoToast {...defaultProps} action="reject" count={3} />)

      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText(/findings rejected/i)).toBeInTheDocument()
    })
  })

  describe('Countdown Timer', () => {
    it('shows remaining time in undo button', () => {
      render(<UndoToast {...defaultProps} remainingTime={3} />)

      expect(screen.getByRole('button', { name: /undo/i })).toHaveTextContent('3s')
    })

    it('updates display when remainingTime changes', () => {
      const { rerender } = render(<UndoToast {...defaultProps} remainingTime={5} />)

      expect(screen.getByRole('button', { name: /undo/i })).toHaveTextContent('5s')

      rerender(<UndoToast {...defaultProps} remainingTime={2} />)

      expect(screen.getByRole('button', { name: /undo/i })).toHaveTextContent('2s')
    })
  })

  describe('Button Actions', () => {
    it('calls onUndo when undo button clicked', () => {
      render(<UndoToast {...defaultProps} />)

      const undoButton = screen.getByRole('button', { name: /undo/i })
      fireEvent.click(undoButton)

      expect(defaultProps.onUndo).toHaveBeenCalledTimes(1)
    })

    it('calls onDismiss when dismiss button clicked', () => {
      render(<UndoToast {...defaultProps} />)

      const dismissButton = screen.getByRole('button', { name: /dismiss/i })
      fireEvent.click(dismissButton)

      expect(defaultProps.onDismiss).toHaveBeenCalledTimes(1)
    })
  })

  describe('Undoing State', () => {
    it('disables undo button when undoing', () => {
      render(<UndoToast {...defaultProps} isUndoing={true} />)

      const undoButton = screen.getByRole('button', { name: /undo/i })
      expect(undoButton).toBeDisabled()
    })

    it('disables dismiss button when undoing', () => {
      render(<UndoToast {...defaultProps} isUndoing={true} />)

      const dismissButton = screen.getByRole('button', { name: /dismiss/i })
      expect(dismissButton).toBeDisabled()
    })

    it('shows undoing state text', () => {
      render(<UndoToast {...defaultProps} isUndoing={true} />)

      expect(screen.getByText(/undoing/i)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has alert role', () => {
      render(<UndoToast {...defaultProps} />)

      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('has aria-live polite for screen readers', () => {
      render(<UndoToast {...defaultProps} />)

      const alert = screen.getByRole('alert')
      expect(alert).toHaveAttribute('aria-live', 'polite')
    })

    it('has aria-atomic true', () => {
      render(<UndoToast {...defaultProps} />)

      const alert = screen.getByRole('alert')
      expect(alert).toHaveAttribute('aria-atomic', 'true')
    })

    it('undo button has descriptive aria-label', () => {
      render(<UndoToast {...defaultProps} action="validate" />)

      expect(screen.getByLabelText(/undo validate action/i)).toBeInTheDocument()
    })

    it('dismiss button has aria-label', () => {
      render(<UndoToast {...defaultProps} />)

      expect(screen.getByLabelText(/dismiss/i)).toBeInTheDocument()
    })
  })

  describe('Progress Bar', () => {
    it('renders progress bar element', () => {
      render(<UndoToast {...defaultProps} />)

      // Progress bar is a div with dynamic width
      const alert = screen.getByRole('alert')
      expect(alert.querySelector('.bg-green-500, .bg-red-500')).toBeInTheDocument()
    })

    it('uses green color for validate action', () => {
      const { container } = render(<UndoToast {...defaultProps} action="validate" />)

      expect(container.querySelector('.bg-green-500')).toBeInTheDocument()
    })

    it('uses red color for reject action', () => {
      const { container } = render(<UndoToast {...defaultProps} action="reject" />)

      expect(container.querySelector('.bg-red-500')).toBeInTheDocument()
    })
  })
})
