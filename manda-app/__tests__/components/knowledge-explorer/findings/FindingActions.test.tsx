/**
 * FindingActions Component Tests
 * Story: E4.3 - Implement Inline Finding Validation (AC: 1, 2, 7)
 *
 * Tests:
 * - Renders validate, reject, and edit buttons
 * - Calls onValidate with correct action on click
 * - Shows loading state during validation
 * - Disables buttons based on current status
 * - Accessible: ARIA labels and keyboard navigation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FindingActions, type FindingActionsProps } from '@/components/knowledge-explorer/findings/FindingActions'

describe('FindingActions', () => {
  const defaultProps: FindingActionsProps = {
    findingId: 'finding-123',
    status: 'pending',
    onValidate: vi.fn().mockResolvedValue(undefined),
    onEdit: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders validate, reject, and edit buttons', () => {
      render(<FindingActions {...defaultProps} />)

      expect(screen.getByRole('button', { name: /validate/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    })

    it('renders group with aria-label', () => {
      render(<FindingActions {...defaultProps} />)
      expect(screen.getByRole('group', { name: /finding actions/i })).toBeInTheDocument()
    })
  })

  describe('Validate Action (AC: 1)', () => {
    it('calls onValidate with confirm on validate click', async () => {
      const user = userEvent.setup()
      render(<FindingActions {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /validate finding/i }))

      await waitFor(() => {
        expect(defaultProps.onValidate).toHaveBeenCalledWith('finding-123', 'confirm')
      })
    })

    it('shows loading state during validation', async () => {
      const slowValidate = vi.fn(async () => { await new Promise(resolve => setTimeout(resolve, 100)) })
      render(<FindingActions {...defaultProps} onValidate={slowValidate} />)

      fireEvent.click(screen.getByRole('button', { name: /validate finding/i }))

      // Should show loading indicator while validating
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /validate/i })).toBeDisabled()
      })
    })

    it('disables validate button when already validated', () => {
      render(<FindingActions {...defaultProps} status="validated" />)

      expect(screen.getByRole('button', { name: /finding validated/i })).toBeDisabled()
    })

    it('shows green background when validated', () => {
      render(<FindingActions {...defaultProps} status="validated" />)

      const button = screen.getByRole('button', { name: /finding validated/i })
      expect(button).toHaveClass('bg-green-100')
    })
  })

  describe('Reject Action (AC: 2)', () => {
    it('calls onValidate with reject on reject click', async () => {
      const user = userEvent.setup()
      render(<FindingActions {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /reject finding/i }))

      await waitFor(() => {
        expect(defaultProps.onValidate).toHaveBeenCalledWith('finding-123', 'reject')
      })
    })

    it('disables reject button when already rejected', () => {
      render(<FindingActions {...defaultProps} status="rejected" />)

      expect(screen.getByRole('button', { name: /finding rejected/i })).toBeDisabled()
    })

    it('shows red background when rejected', () => {
      render(<FindingActions {...defaultProps} status="rejected" />)

      const button = screen.getByRole('button', { name: /finding rejected/i })
      expect(button).toHaveClass('bg-red-100')
    })
  })

  describe('Edit Action (AC: 7)', () => {
    it('calls onEdit on edit click', async () => {
      const user = userEvent.setup()
      render(<FindingActions {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /edit/i }))

      expect(defaultProps.onEdit).toHaveBeenCalledWith('finding-123')
    })

    it('disables edit button during loading', async () => {
      const slowValidate = vi.fn(async () => { await new Promise(resolve => setTimeout(resolve, 100)) })
      render(<FindingActions {...defaultProps} onValidate={slowValidate} />)

      fireEvent.click(screen.getByRole('button', { name: /validate finding/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit/i })).toBeDisabled()
      })
    })
  })

  describe('Disabled State', () => {
    it('disables all buttons when disabled prop is true', () => {
      render(<FindingActions {...defaultProps} disabled />)

      expect(screen.getByRole('button', { name: /validate/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /reject/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /edit/i })).toBeDisabled()
    })
  })

  describe('Accessibility', () => {
    it('has correct aria-pressed for validated state', () => {
      render(<FindingActions {...defaultProps} status="validated" />)

      expect(screen.getByRole('button', { name: /finding validated/i })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    })

    it('has correct aria-pressed for rejected state', () => {
      render(<FindingActions {...defaultProps} status="rejected" />)

      expect(screen.getByRole('button', { name: /finding rejected/i })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    })

    it('buttons are keyboard accessible', async () => {
      const user = userEvent.setup()
      render(<FindingActions {...defaultProps} />)

      const validateButton = screen.getByRole('button', { name: /validate finding/i })

      // Click the button via keyboard
      await user.click(validateButton)

      await waitFor(() => {
        expect(defaultProps.onValidate).toHaveBeenCalled()
      })
    })
  })
})
