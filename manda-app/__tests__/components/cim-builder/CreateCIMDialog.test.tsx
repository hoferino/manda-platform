/**
 * CreateCIMDialog Component Tests
 * Story: E9.2 - CIM List & Entry UI
 * AC: #3 - "Create New CIM" button opens name input dialog with validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateCIMDialog } from '@/components/cim-builder/CreateCIMDialog'

describe('CreateCIMDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render dialog when open', () => {
      render(<CreateCIMDialog {...defaultProps} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Create New CIM')).toBeInTheDocument()
    })

    it('should not render dialog when closed', () => {
      render(<CreateCIMDialog {...defaultProps} open={false} />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('should display dialog description', () => {
      render(<CreateCIMDialog {...defaultProps} />)

      expect(
        screen.getByText(/give your confidential information memorandum a name/i)
      ).toBeInTheDocument()
    })

    it('should have input field with label', () => {
      render(<CreateCIMDialog {...defaultProps} />)

      expect(screen.getByLabelText(/cim name/i)).toBeInTheDocument()
    })

    it('should have placeholder text', () => {
      render(<CreateCIMDialog {...defaultProps} />)

      expect(screen.getByPlaceholderText(/q4 2024 investment opportunity/i)).toBeInTheDocument()
    })

    it('should have Cancel and Create buttons', () => {
      render(<CreateCIMDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /create cim/i })).toBeInTheDocument()
    })
  })

  describe('validation', () => {
    it('should show error for name less than 3 characters', async () => {
      const user = userEvent.setup()
      render(<CreateCIMDialog {...defaultProps} />)

      const input = screen.getByLabelText(/cim name/i)
      await user.type(input, 'AB')

      const submitButton = screen.getByRole('button', { name: /create cim/i })
      await user.click(submitButton)

      expect(screen.getByText(/cim name must be at least 3 characters/i)).toBeInTheDocument()
      expect(defaultProps.onSubmit).not.toHaveBeenCalled()
    })

    it('should show error for name more than 100 characters', async () => {
      const user = userEvent.setup()
      render(<CreateCIMDialog {...defaultProps} />)

      const input = screen.getByLabelText(/cim name/i)
      const longName = 'A'.repeat(101)
      await user.type(input, longName)

      const submitButton = screen.getByRole('button', { name: /create cim/i })
      await user.click(submitButton)

      expect(screen.getByText(/cim name must be 100 characters or less/i)).toBeInTheDocument()
      expect(defaultProps.onSubmit).not.toHaveBeenCalled()
    })

    it('should accept valid name between 3-100 characters', async () => {
      const user = userEvent.setup()
      render(<CreateCIMDialog {...defaultProps} />)

      const input = screen.getByLabelText(/cim name/i)
      await user.type(input, 'Valid CIM Name')

      const submitButton = screen.getByRole('button', { name: /create cim/i })
      await user.click(submitButton)

      expect(screen.queryByText(/cim name must be/i)).not.toBeInTheDocument()
      expect(defaultProps.onSubmit).toHaveBeenCalledWith('Valid CIM Name')
    })

    it('should trim whitespace from name before validation', async () => {
      const user = userEvent.setup()
      render(<CreateCIMDialog {...defaultProps} />)

      const input = screen.getByLabelText(/cim name/i)
      await user.type(input, '   Valid Name   ')

      const submitButton = screen.getByRole('button', { name: /create cim/i })
      await user.click(submitButton)

      expect(defaultProps.onSubmit).toHaveBeenCalledWith('Valid Name')
    })

    it('should clear error when user starts typing', async () => {
      const user = userEvent.setup()
      render(<CreateCIMDialog {...defaultProps} />)

      const input = screen.getByLabelText(/cim name/i)
      await user.type(input, 'AB')

      const submitButton = screen.getByRole('button', { name: /create cim/i })
      await user.click(submitButton)

      expect(screen.getByText(/cim name must be at least 3 characters/i)).toBeInTheDocument()

      await user.type(input, 'C')

      expect(screen.queryByText(/cim name must be at least 3 characters/i)).not.toBeInTheDocument()
    })
  })

  describe('submission', () => {
    it('should call onSubmit with trimmed name', async () => {
      const user = userEvent.setup()
      render(<CreateCIMDialog {...defaultProps} />)

      const input = screen.getByLabelText(/cim name/i)
      await user.type(input, 'My New CIM')

      const submitButton = screen.getByRole('button', { name: /create cim/i })
      await user.click(submitButton)

      expect(defaultProps.onSubmit).toHaveBeenCalledWith('My New CIM')
    })

    it('should disable submit button when input is empty', () => {
      render(<CreateCIMDialog {...defaultProps} />)

      const submitButton = screen.getByRole('button', { name: /create cim/i })
      expect(submitButton).toBeDisabled()
    })

    it('should enable submit button when input has content', async () => {
      const user = userEvent.setup()
      render(<CreateCIMDialog {...defaultProps} />)

      const input = screen.getByLabelText(/cim name/i)
      await user.type(input, 'Test')

      const submitButton = screen.getByRole('button', { name: /create cim/i })
      expect(submitButton).not.toBeDisabled()
    })
  })

  describe('loading state', () => {
    it('should disable input when loading', () => {
      render(<CreateCIMDialog {...defaultProps} isLoading={true} />)

      const input = screen.getByLabelText(/cim name/i)
      expect(input).toBeDisabled()
    })

    it('should disable submit button when loading', () => {
      render(<CreateCIMDialog {...defaultProps} isLoading={true} />)

      const submitButton = screen.getByRole('button', { name: /creating/i })
      expect(submitButton).toBeDisabled()
    })

    it('should show loading spinner when loading', () => {
      render(<CreateCIMDialog {...defaultProps} isLoading={true} />)

      expect(screen.getByText(/creating/i)).toBeInTheDocument()
    })

    it('should disable cancel button when loading', () => {
      render(<CreateCIMDialog {...defaultProps} isLoading={true} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      expect(cancelButton).toBeDisabled()
    })
  })

  describe('dialog controls', () => {
    it('should call onOpenChange when cancel is clicked', async () => {
      const user = userEvent.setup()
      render(<CreateCIMDialog {...defaultProps} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
    })

    it('should reset form when dialog closes', async () => {
      const { rerender } = render(<CreateCIMDialog {...defaultProps} />)

      // Type something
      const user = userEvent.setup()
      const input = screen.getByLabelText(/cim name/i)
      await user.type(input, 'Test Name')

      expect(input).toHaveValue('Test Name')

      // Close and reopen dialog
      rerender(<CreateCIMDialog {...defaultProps} open={false} />)
      rerender(<CreateCIMDialog {...defaultProps} open={true} />)

      // Input should be reset
      const newInput = screen.getByLabelText(/cim name/i)
      expect(newInput).toHaveValue('')
    })
  })

  describe('accessibility', () => {
    it('should have proper aria-describedby when error exists', async () => {
      const user = userEvent.setup()
      render(<CreateCIMDialog {...defaultProps} />)

      const input = screen.getByLabelText(/cim name/i)
      await user.type(input, 'AB')

      const submitButton = screen.getByRole('button', { name: /create cim/i })
      await user.click(submitButton)

      expect(input).toHaveAttribute('aria-describedby', 'cim-name-error')
    })

    it('should auto-focus input when dialog opens', () => {
      render(<CreateCIMDialog {...defaultProps} />)

      const input = screen.getByLabelText(/cim name/i)
      expect(input).toHaveFocus()
    })
  })
})
