/**
 * ContradictionActions Component Tests
 * Story: E4.6 - Build Contradictions View (AC: #4, #5, #6, #7)
 *
 * Tests:
 * - Accept A button triggers correct handler
 * - Accept B button triggers correct handler
 * - Investigate button opens note dialog
 * - Add Note button opens note dialog
 * - Note dialog requires text before submission
 * - Loading states disable buttons
 * - Resolved status shows only status indicator
 * - Status indicators for investigating/noted
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContradictionActions, type ContradictionActionsProps } from '@/components/knowledge-explorer/contradictions/ContradictionActions'

describe('ContradictionActions', () => {
  const defaultProps: ContradictionActionsProps = {
    status: 'unresolved',
    onAcceptA: vi.fn().mockResolvedValue(undefined),
    onAcceptB: vi.fn().mockResolvedValue(undefined),
    onInvestigate: vi.fn().mockResolvedValue(undefined),
    onAddNote: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Button Rendering (AC4)', () => {
    it('renders all four action buttons for unresolved status', () => {
      render(<ContradictionActions {...defaultProps} />)

      expect(screen.getByRole('button', { name: /accept finding a/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /accept finding b/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /mark for investigation/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /add a note/i })).toBeInTheDocument()
    })

    it('shows Accept A with checkmark icon', () => {
      render(<ContradictionActions {...defaultProps} />)

      const acceptAButton = screen.getByRole('button', { name: /accept finding a/i })
      expect(acceptAButton).toHaveTextContent('Accept A')
    })

    it('shows Accept B with checkmark icon', () => {
      render(<ContradictionActions {...defaultProps} />)

      const acceptBButton = screen.getByRole('button', { name: /accept finding b/i })
      expect(acceptBButton).toHaveTextContent('Accept B')
    })
  })

  describe('Accept A Action (AC4)', () => {
    it('calls onAcceptA when Accept A button is clicked', async () => {
      const user = userEvent.setup()
      const onAcceptA = vi.fn().mockResolvedValue(undefined)
      render(<ContradictionActions {...defaultProps} onAcceptA={onAcceptA} />)

      await user.click(screen.getByRole('button', { name: /accept finding a/i }))

      await waitFor(() => {
        expect(onAcceptA).toHaveBeenCalledTimes(1)
      })
    })

    it('shows loading state during Accept A action', async () => {
      const user = userEvent.setup()
      // Create a promise that doesn't resolve immediately
      let resolvePromise: () => void
      const slowPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve
      })
      const onAcceptA = vi.fn().mockReturnValue(slowPromise)

      render(<ContradictionActions {...defaultProps} onAcceptA={onAcceptA} />)

      // Click the button
      await user.click(screen.getByRole('button', { name: /accept finding a/i }))

      // Button should be disabled during loading
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /accept finding a/i })).toBeDisabled()
      })

      // Resolve the promise
      resolvePromise!()
    })
  })

  describe('Accept B Action (AC5)', () => {
    it('calls onAcceptB when Accept B button is clicked', async () => {
      const user = userEvent.setup()
      const onAcceptB = vi.fn().mockResolvedValue(undefined)
      render(<ContradictionActions {...defaultProps} onAcceptB={onAcceptB} />)

      await user.click(screen.getByRole('button', { name: /accept finding b/i }))

      await waitFor(() => {
        expect(onAcceptB).toHaveBeenCalledTimes(1)
      })
    })

    it('shows loading state during Accept B action', async () => {
      const user = userEvent.setup()
      let resolvePromise: () => void
      const slowPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve
      })
      const onAcceptB = vi.fn().mockReturnValue(slowPromise)

      render(<ContradictionActions {...defaultProps} onAcceptB={onAcceptB} />)

      await user.click(screen.getByRole('button', { name: /accept finding b/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /accept finding b/i })).toBeDisabled()
      })

      resolvePromise!()
    })
  })

  describe('Investigate Action (AC6)', () => {
    it('opens note dialog when Investigate is clicked', async () => {
      const user = userEvent.setup()
      render(<ContradictionActions {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /mark for investigation/i }))

      await waitFor(() => {
        // Look for dialog by role
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByLabelText('Note')).toBeInTheDocument()
      })
    })

    it('calls onInvestigate with note text when submitted', async () => {
      const user = userEvent.setup()
      const onInvestigate = vi.fn().mockResolvedValue(undefined)
      render(<ContradictionActions {...defaultProps} onInvestigate={onInvestigate} />)

      // Open dialog
      await user.click(screen.getByRole('button', { name: /mark for investigation/i }))

      // Type note
      const textarea = screen.getByPlaceholderText('Enter your note...')
      await user.type(textarea, 'Need to verify with finance team')

      // Find buttons in footer - look for button that has "Mark for Investigation" text
      const dialog = screen.getByRole('dialog')
      const submitButton = Array.from(dialog.querySelectorAll('button')).find(
        (btn) => btn.textContent?.includes('Mark for Investigation')
      )
      await user.click(submitButton!)

      await waitFor(() => {
        expect(onInvestigate).toHaveBeenCalledWith('Need to verify with finance team')
      })
    })

    it('requires note text before submission', async () => {
      const user = userEvent.setup()
      render(<ContradictionActions {...defaultProps} />)

      // Open dialog
      await user.click(screen.getByRole('button', { name: /mark for investigation/i }))

      // Try to submit without entering text - button should be disabled
      await waitFor(() => {
        const dialog = screen.getByRole('dialog')
        const submitButton = Array.from(dialog.querySelectorAll('button')).find(
          (btn) => btn.textContent?.includes('Mark for Investigation')
        )
        expect(submitButton).toBeDisabled()
      })
    })

    it('closes dialog after successful submission', async () => {
      const user = userEvent.setup()
      const onInvestigate = vi.fn().mockResolvedValue(undefined)
      render(<ContradictionActions {...defaultProps} onInvestigate={onInvestigate} />)

      // Open dialog
      await user.click(screen.getByRole('button', { name: /mark for investigation/i }))

      // Type note and submit
      await user.type(screen.getByPlaceholderText('Enter your note...'), 'Test note')

      // Find submit button inside dialog
      const dialog = screen.getByRole('dialog')
      const submitButton = Array.from(dialog.querySelectorAll('button')).find(
        (btn) => btn.textContent?.includes('Mark for Investigation')
      )
      await user.click(submitButton!)

      await waitFor(() => {
        // Dialog should no longer be present
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })
  })

  describe('Add Note Action (AC7)', () => {
    it('opens note dialog when Add Note is clicked', async () => {
      const user = userEvent.setup()
      render(<ContradictionActions {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /add a note/i }))

      await waitFor(() => {
        // Look for dialog by role
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByLabelText('Note')).toBeInTheDocument()
      })
    })

    it('calls onAddNote with note text when submitted', async () => {
      const user = userEvent.setup()
      const onAddNote = vi.fn().mockResolvedValue(undefined)
      render(<ContradictionActions {...defaultProps} onAddNote={onAddNote} />)

      // Open dialog
      await user.click(screen.getByRole('button', { name: /add a note/i }))

      // Type note
      await user.type(screen.getByPlaceholderText('Enter your note...'), 'Acknowledged discrepancy')

      // Find the submit button in the dialog by looking for button with "Add Note" text
      const dialog = screen.getByRole('dialog')
      const submitButton = Array.from(dialog.querySelectorAll('button')).find(
        (btn) => btn.textContent === 'Add Note'
      )
      await user.click(submitButton!)

      await waitFor(() => {
        expect(onAddNote).toHaveBeenCalledWith('Acknowledged discrepancy')
      })
    })

    it('shows cancel button in note dialog', async () => {
      const user = userEvent.setup()
      render(<ContradictionActions {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /add a note/i }))

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('closes dialog on cancel', async () => {
      const user = userEvent.setup()
      render(<ContradictionActions {...defaultProps} />)

      // Open dialog
      await user.click(screen.getByRole('button', { name: /add a note/i }))

      // Cancel
      await user.click(screen.getByRole('button', { name: /cancel/i }))

      await waitFor(() => {
        // Dialog should no longer be present
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })
  })

  describe('Resolved Status', () => {
    it('shows only "Resolved" status when status is resolved', () => {
      render(<ContradictionActions {...defaultProps} status="resolved" />)

      expect(screen.getByText('Resolved')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /accept finding a/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /accept finding b/i })).not.toBeInTheDocument()
    })

    it('shows checkmark icon for resolved status', () => {
      render(<ContradictionActions {...defaultProps} status="resolved" />)

      const resolvedContainer = screen.getByText('Resolved').closest('div')
      expect(resolvedContainer).toHaveClass('text-green-600')
    })
  })

  describe('Status Indicators', () => {
    it('shows "Under investigation" for investigating status', () => {
      render(<ContradictionActions {...defaultProps} status="investigating" />)

      expect(screen.getByText('Under investigation')).toBeInTheDocument()
    })

    it('shows "Noted" for noted status', () => {
      render(<ContradictionActions {...defaultProps} status="noted" />)

      expect(screen.getByText('Noted')).toBeInTheDocument()
    })

    it('still shows action buttons for investigating status', () => {
      render(<ContradictionActions {...defaultProps} status="investigating" />)

      expect(screen.getByRole('button', { name: /accept finding a/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /accept finding b/i })).toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    it('disables all buttons when isLoading is true', () => {
      render(<ContradictionActions {...defaultProps} isLoading={true} />)

      expect(screen.getByRole('button', { name: /accept finding a/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /accept finding b/i })).toBeDisabled()
    })

    it('disables buttons during individual action loading', async () => {
      const user = userEvent.setup()
      let resolvePromise: () => void
      const slowPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve
      })
      const onAcceptA = vi.fn().mockReturnValue(slowPromise)

      render(<ContradictionActions {...defaultProps} onAcceptA={onAcceptA} />)

      await user.click(screen.getByRole('button', { name: /accept finding a/i }))

      // All buttons should be disabled
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /accept finding a/i })).toBeDisabled()
        expect(screen.getByRole('button', { name: /accept finding b/i })).toBeDisabled()
      })

      resolvePromise!()
    })
  })

  describe('Accessibility', () => {
    it('action buttons have appropriate aria labels', () => {
      render(<ContradictionActions {...defaultProps} />)

      expect(screen.getByRole('button', { name: /accept finding a/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /accept finding b/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /mark for investigation/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /add a note/i })).toBeInTheDocument()
    })

    it('note dialog has label for textarea', async () => {
      const user = userEvent.setup()
      render(<ContradictionActions {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /mark for investigation/i }))

      expect(screen.getByLabelText('Note')).toBeInTheDocument()
    })

    it('shows keyboard shortcut hint in dialog', async () => {
      const user = userEvent.setup()
      render(<ContradictionActions {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /add a note/i }))

      expect(screen.getByText(/ctrl\+enter/i)).toBeInTheDocument()
    })
  })

  describe('Button Styling', () => {
    it('Accept A button has blue styling', () => {
      render(<ContradictionActions {...defaultProps} />)

      const button = screen.getByRole('button', { name: /accept finding a/i })
      expect(button).toHaveClass('text-blue-600')
    })

    it('Accept B button has purple styling', () => {
      render(<ContradictionActions {...defaultProps} />)

      const button = screen.getByRole('button', { name: /accept finding b/i })
      expect(button).toHaveClass('text-purple-600')
    })

    it('Investigate button has amber styling', () => {
      render(<ContradictionActions {...defaultProps} />)

      const button = screen.getByRole('button', { name: /mark for investigation/i })
      expect(button).toHaveClass('text-amber-600')
    })
  })
})
