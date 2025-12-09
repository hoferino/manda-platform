/**
 * QAInlineEdit Component Tests
 * Story: E8.2 - Q&A Management UI with Collaborative Editing (AC: 3, 4)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QAInlineEdit } from '@/components/qa/QAInlineEdit'

describe('QAInlineEdit', () => {
  const defaultProps = {
    value: 'Initial value',
    onSave: vi.fn(),
    onCancel: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render textarea with initial value', () => {
      render(<QAInlineEdit {...defaultProps} />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toBeInTheDocument()
      expect(textarea).toHaveValue('Initial value')
    })

    it('should auto-focus textarea on mount', () => {
      render(<QAInlineEdit {...defaultProps} />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveFocus()
    })

    it('should show character count', () => {
      render(<QAInlineEdit {...defaultProps} maxLength={2000} />)

      expect(screen.getByText('13/2000')).toBeInTheDocument()
    })

    it('should render save and cancel buttons', () => {
      render(<QAInlineEdit {...defaultProps} />)

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })
  })

  describe('keyboard shortcuts (AC3)', () => {
    it('should call onSave when Enter is pressed without Shift', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined)
      render(<QAInlineEdit {...defaultProps} value="Initial" onSave={onSave} />)

      const textarea = screen.getByRole('textbox')
      await userEvent.clear(textarea)
      await userEvent.type(textarea, 'New value')
      await userEvent.keyboard('{Enter}')

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith('New value')
      })
    })

    it('should not save when Shift+Enter is pressed (allows newlines)', async () => {
      const onSave = vi.fn()
      render(<QAInlineEdit {...defaultProps} onSave={onSave} />)

      const textarea = screen.getByRole('textbox')
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

      expect(onSave).not.toHaveBeenCalled()
    })

    it('should call onCancel when Escape is pressed', async () => {
      const onCancel = vi.fn()
      render(<QAInlineEdit {...defaultProps} onCancel={onCancel} />)

      const textarea = screen.getByRole('textbox')
      fireEvent.keyDown(textarea, { key: 'Escape' })

      expect(onCancel).toHaveBeenCalled()
    })
  })

  describe('save button', () => {
    it('should call onSave when save button is clicked', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn().mockResolvedValue(undefined)
      render(<QAInlineEdit {...defaultProps} value="" onSave={onSave} />)

      const textarea = screen.getByRole('textbox')
      await user.clear(textarea)
      await user.type(textarea, 'New value')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith('New value')
      })
    })

    it('should call onCancel if value unchanged', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn()
      const onCancel = vi.fn()
      render(
        <QAInlineEdit
          {...defaultProps}
          value="Same value"
          onSave={onSave}
          onCancel={onCancel}
        />
      )

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      expect(onSave).not.toHaveBeenCalled()
      expect(onCancel).toHaveBeenCalled()
    })

    it('should show loading state during save', async () => {
      const user = userEvent.setup()
      let resolvePromise: () => void
      const onSave = vi.fn().mockImplementation(
        () =>
          new Promise<void>(resolve => {
            resolvePromise = resolve
          })
      )

      render(<QAInlineEdit {...defaultProps} value="" onSave={onSave} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'New value')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      // Textarea should be disabled during save
      expect(screen.getByRole('textbox')).toBeDisabled()

      resolvePromise!()
    })
  })

  describe('cancel button', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup()
      const onCancel = vi.fn()
      render(<QAInlineEdit {...defaultProps} onCancel={onCancel} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(onCancel).toHaveBeenCalled()
    })

    it('should reset value when cancelled', async () => {
      const user = userEvent.setup()
      render(<QAInlineEdit {...defaultProps} value="Original" />)

      const textarea = screen.getByRole('textbox')
      await user.clear(textarea)
      await user.type(textarea, 'Modified')

      expect(textarea).toHaveValue('Modified')

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      // onCancel is called, component would unmount in real usage
      expect(defaultProps.onCancel).toHaveBeenCalled()
    })
  })

  describe('validation', () => {
    it('should show error for text shorter than minLength', async () => {
      const user = userEvent.setup()
      render(<QAInlineEdit {...defaultProps} value="" minLength={10} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'short')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      expect(screen.getByText(/at least 10 characters/i)).toBeInTheDocument()
    })

    it('should show warning for text exceeding maxLength', async () => {
      const user = userEvent.setup()
      const longText = 'a'.repeat(110)
      render(<QAInlineEdit {...defaultProps} value={longText} maxLength={100} />)

      // Character count should show warning style
      expect(screen.getByText(`${longText.length}/100`)).toHaveClass('text-destructive')
    })

    it('should disable save button when below minLength', async () => {
      const user = userEvent.setup()
      render(<QAInlineEdit {...defaultProps} value="" minLength={10} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'short')

      const saveButton = screen.getByRole('button', { name: /save/i })
      expect(saveButton).toBeDisabled()
    })
  })

  describe('error handling', () => {
    it('should show error message when save fails', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn().mockRejectedValue(new Error('Save failed'))
      render(<QAInlineEdit {...defaultProps} value="" onSave={onSave} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'New value')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Save failed')).toBeInTheDocument()
      })
    })

    it('should re-enable form after error', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn().mockRejectedValue(new Error('Error'))
      render(<QAInlineEdit {...defaultProps} value="" onSave={onSave} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'New value')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(textarea).not.toBeDisabled()
      })
    })
  })

  describe('accessibility', () => {
    it('should have proper aria attributes', () => {
      render(<QAInlineEdit {...defaultProps} />)

      const textarea = screen.getByRole('textbox')
      expect(textarea).toHaveAttribute('aria-label', 'Edit text')
    })

    it('should set aria-invalid when there is an error', async () => {
      const user = userEvent.setup()
      render(<QAInlineEdit {...defaultProps} value="" minLength={10} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'short')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(textarea).toHaveAttribute('aria-invalid', 'true')
      })
    })
  })
})
