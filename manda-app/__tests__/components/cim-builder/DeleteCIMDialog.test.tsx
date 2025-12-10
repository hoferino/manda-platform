/**
 * DeleteCIMDialog Component Tests
 * Story: E9.2 - CIM List & Entry UI
 * AC: #5 - Delete CIM shows confirmation dialog, removes from list after confirmation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeleteCIMDialog } from '@/components/cim-builder/DeleteCIMDialog'

describe('DeleteCIMDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    cimTitle: 'Q4 2024 Investment Opportunity',
    onConfirm: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render alert dialog when open', () => {
      render(<DeleteCIMDialog {...defaultProps} />)

      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      // Title is in the heading
      expect(screen.getByRole('heading', { name: 'Delete CIM' })).toBeInTheDocument()
    })

    it('should not render dialog when closed', () => {
      render(<DeleteCIMDialog {...defaultProps} open={false} />)

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })

    it('should display CIM title in confirmation message', () => {
      render(<DeleteCIMDialog {...defaultProps} />)

      expect(screen.getByText(/"Q4 2024 Investment Opportunity"/)).toBeInTheDocument()
    })

    it('should display warning about permanent deletion', () => {
      render(<DeleteCIMDialog {...defaultProps} />)

      expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument()
      expect(screen.getByText(/permanently removed/i)).toBeInTheDocument()
    })

    it('should have Cancel and Delete buttons', () => {
      render(<DeleteCIMDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /delete cim/i })).toBeInTheDocument()
    })
  })

  describe('confirmation flow', () => {
    it('should call onConfirm when delete button is clicked', async () => {
      const user = userEvent.setup()
      render(<DeleteCIMDialog {...defaultProps} />)

      const deleteButton = screen.getByRole('button', { name: /delete cim/i })
      await user.click(deleteButton)

      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1)
    })

    it('should call onOpenChange with false when cancel is clicked', async () => {
      const user = userEvent.setup()
      render(<DeleteCIMDialog {...defaultProps} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe('loading state', () => {
    it('should disable delete button when loading', () => {
      render(<DeleteCIMDialog {...defaultProps} isLoading={true} />)

      const deleteButton = screen.getByRole('button', { name: /deleting/i })
      expect(deleteButton).toBeDisabled()
    })

    it('should show loading spinner when loading', () => {
      render(<DeleteCIMDialog {...defaultProps} isLoading={true} />)

      expect(screen.getByText(/deleting/i)).toBeInTheDocument()
    })

    it('should disable cancel button when loading', () => {
      render(<DeleteCIMDialog {...defaultProps} isLoading={true} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      expect(cancelButton).toBeDisabled()
    })
  })

  describe('styling', () => {
    it('should have destructive styling on delete button', () => {
      render(<DeleteCIMDialog {...defaultProps} />)

      const deleteButton = screen.getByRole('button', { name: /delete cim/i })
      expect(deleteButton).toHaveClass('bg-destructive')
    })
  })

  describe('different CIM titles', () => {
    it('should display different CIM title correctly', () => {
      render(<DeleteCIMDialog {...defaultProps} cimTitle="My Special CIM" />)

      expect(screen.getByText(/"My Special CIM"/)).toBeInTheDocument()
    })

    it('should handle empty CIM title', () => {
      render(<DeleteCIMDialog {...defaultProps} cimTitle="" />)

      expect(screen.getByText(/""/)).toBeInTheDocument()
    })

    it('should handle CIM title with special characters', () => {
      render(<DeleteCIMDialog {...defaultProps} cimTitle='CIM with "quotes" & symbols' />)

      expect(screen.getByText(/CIM with "quotes" & symbols/)).toBeInTheDocument()
    })
  })
})
