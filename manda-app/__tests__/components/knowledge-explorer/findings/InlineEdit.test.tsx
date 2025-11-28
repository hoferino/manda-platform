/**
 * InlineEdit Component Tests
 * Story: E4.3 - Implement Inline Finding Validation (AC: 3)
 *
 * Tests:
 * - Renders textarea with current value
 * - Calls onSave with new value on save
 * - Calls onCancel on cancel
 * - Keyboard shortcuts: Enter saves, Escape cancels
 * - Validation: empty text shows error
 * - Focus management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InlineEdit, type InlineEditProps } from '@/components/knowledge-explorer/findings/InlineEdit'

describe('InlineEdit', () => {
  const defaultProps: InlineEditProps = {
    value: 'Original finding text',
    onSave: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn(),
    isEditing: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders textarea when isEditing is true', () => {
      render(<InlineEdit {...defaultProps} />)

      expect(screen.getByRole('textbox')).toBeInTheDocument()
      expect(screen.getByRole('textbox')).toHaveValue('Original finding text')
    })

    it('renders nothing when isEditing is false', () => {
      render(<InlineEdit {...defaultProps} isEditing={false} />)

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })

    it('renders save and cancel buttons', () => {
      render(<InlineEdit {...defaultProps} />)

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('shows character count', () => {
      render(<InlineEdit {...defaultProps} maxLength={2000} />)

      expect(screen.getByText(/\d+\/2000/)).toBeInTheDocument()
    })
  })

  describe('Save Action (AC: 3)', () => {
    it('calls onSave with new value when save is clicked', async () => {
      const user = userEvent.setup()
      render(<InlineEdit {...defaultProps} />)

      const textarea = screen.getByRole('textbox')
      await user.clear(textarea)
      await user.type(textarea, 'Updated finding text')
      await user.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalledWith('Updated finding text')
      })
    })

    it('trims whitespace before saving', async () => {
      const user = userEvent.setup()
      render(<InlineEdit {...defaultProps} />)

      const textarea = screen.getByRole('textbox')
      await user.clear(textarea)
      await user.type(textarea, '  Trimmed text  ')
      await user.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalledWith('Trimmed text')
      })
    })

    it('shows loading state during save', async () => {
      const slowSave = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)))
      const user = userEvent.setup()
      render(<InlineEdit {...defaultProps} onSave={slowSave} />)

      const textarea = screen.getByRole('textbox')
      await user.clear(textarea)
      await user.type(textarea, 'New text')
      await user.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() => {
        expect(screen.getByText(/saving/i)).toBeInTheDocument()
      })
    })

    it('calls onCancel when text unchanged', async () => {
      const user = userEvent.setup()
      render(<InlineEdit {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /save/i }))

      expect(defaultProps.onCancel).toHaveBeenCalled()
      expect(defaultProps.onSave).not.toHaveBeenCalled()
    })
  })

  describe('Cancel Action', () => {
    it('calls onCancel when cancel is clicked', async () => {
      const user = userEvent.setup()
      render(<InlineEdit {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /cancel/i }))

      expect(defaultProps.onCancel).toHaveBeenCalled()
    })

    it('resets value on cancel', async () => {
      const user = userEvent.setup()
      render(<InlineEdit {...defaultProps} />)

      const textarea = screen.getByRole('textbox')
      await user.clear(textarea)
      await user.type(textarea, 'Changed text')
      await user.click(screen.getByRole('button', { name: /cancel/i }))

      // onCancel should be called, parent component will handle unmounting
      expect(defaultProps.onCancel).toHaveBeenCalled()
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('saves on Enter key', async () => {
      const user = userEvent.setup()
      render(<InlineEdit {...defaultProps} />)

      const textarea = screen.getByRole('textbox')
      await user.clear(textarea)
      await user.type(textarea, 'Keyboard save test')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalledWith('Keyboard save test')
      })
    })

    it('cancels on Escape key', async () => {
      const user = userEvent.setup()
      render(<InlineEdit {...defaultProps} />)

      await user.keyboard('{Escape}')

      expect(defaultProps.onCancel).toHaveBeenCalled()
    })

    it('allows Shift+Enter for newlines', async () => {
      const user = userEvent.setup()
      render(<InlineEdit {...defaultProps} />)

      const textarea = screen.getByRole('textbox')
      await user.clear(textarea)
      await user.type(textarea, 'Line one{Shift>}{Enter}{/Shift}Line two')

      expect(defaultProps.onSave).not.toHaveBeenCalled()
    })
  })

  describe('Validation', () => {
    it('disables save button for empty text', async () => {
      const user = userEvent.setup()
      render(<InlineEdit {...defaultProps} />)

      const textarea = screen.getByRole('textbox')
      await user.clear(textarea)

      expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
    })
  })

  describe('Error Handling', () => {
    it('shows error message on save failure', async () => {
      const failingSave = vi.fn().mockRejectedValue(new Error('Network error'))
      const user = userEvent.setup()
      render(<InlineEdit {...defaultProps} onSave={failingSave} />)

      const textarea = screen.getByRole('textbox')
      await user.clear(textarea)
      await user.type(textarea, 'New text')
      await user.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('has correct aria-label on textarea', () => {
      render(<InlineEdit {...defaultProps} />)

      expect(screen.getByRole('textbox')).toHaveAttribute('aria-label', 'Edit finding text')
    })

    it('shows keyboard shortcut hint', () => {
      render(<InlineEdit {...defaultProps} />)

      expect(screen.getByText(/enter to save.*esc to cancel/i)).toBeInTheDocument()
    })
  })
})
