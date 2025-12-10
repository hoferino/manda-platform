/**
 * CIMEmptyState Component Tests
 * Story: E9.2 - CIM List & Entry UI
 * AC: #6 - Empty state displays when no CIMs exist with helpful messaging
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CIMEmptyState } from '@/components/cim-builder/CIMEmptyState'

describe('CIMEmptyState', () => {
  const defaultProps = {
    onCreateClick: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should display "No CIMs yet" heading', () => {
      render(<CIMEmptyState {...defaultProps} />)

      expect(screen.getByRole('heading', { name: /no cims yet/i })).toBeInTheDocument()
    })

    it('should display helpful description about CIMs', () => {
      render(<CIMEmptyState {...defaultProps} />)

      expect(screen.getByText(/confidential information memorandum/i)).toBeInTheDocument()
      expect(screen.getByText(/ai-guided workflow/i)).toBeInTheDocument()
    })

    it('should have illustration placeholder (FileText icon)', () => {
      render(<CIMEmptyState {...defaultProps} />)

      // The icon is in a container with bg-muted
      const iconContainer = document.querySelector('.rounded-full.bg-muted')
      expect(iconContainer).toBeInTheDocument()
    })

    it('should display "Create your first CIM" button', () => {
      render(<CIMEmptyState {...defaultProps} />)

      expect(screen.getByRole('button', { name: /create your first cim/i })).toBeInTheDocument()
    })
  })

  describe('button click', () => {
    it('should call onCreateClick when button is clicked', async () => {
      const user = userEvent.setup()
      render(<CIMEmptyState {...defaultProps} />)

      const button = screen.getByRole('button', { name: /create your first cim/i })
      await user.click(button)

      expect(defaultProps.onCreateClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('styling', () => {
    it('should have dashed border on card', () => {
      render(<CIMEmptyState {...defaultProps} />)

      // The card has border-dashed class
      const card = document.querySelector('.border-dashed')
      expect(card).toBeInTheDocument()
    })

    it('should center content', () => {
      render(<CIMEmptyState {...defaultProps} />)

      const contentContainer = document.querySelector('.text-center')
      expect(contentContainer).toBeInTheDocument()
    })

    it('should have large button size', () => {
      render(<CIMEmptyState {...defaultProps} />)

      const button = screen.getByRole('button', { name: /create your first cim/i })
      // Large buttons have specific classes
      expect(button).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('should have semantic heading structure', () => {
      render(<CIMEmptyState {...defaultProps} />)

      const heading = screen.getByRole('heading', { level: 3 })
      expect(heading).toHaveTextContent(/no cims yet/i)
    })

    it('should have button with clear action text', () => {
      render(<CIMEmptyState {...defaultProps} />)

      const button = screen.getByRole('button')
      expect(button).toHaveAccessibleName(/create your first cim/i)
    })
  })
})
