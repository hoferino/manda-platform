/**
 * CIMCard Component Tests
 * Story: E9.2 - CIM List & Entry UI
 * AC: #2 - CIM cards display name, last updated timestamp, and progress indicator
 * AC: #4 - Click CIM card navigates to builder
 * AC: #5 - Delete CIM with kebab menu
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CIMCard } from '@/components/cim-builder/CIMCard'
import { CIMListItem, WorkflowState } from '@/lib/types/cim'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe('CIMCard', () => {
  const mockWorkflowState: WorkflowState = {
    current_phase: 'outline',
    current_section_index: null,
    current_slide_index: null,
    completed_phases: ['persona', 'thesis'],
    is_complete: false,
  }

  const mockCIM: CIMListItem = {
    id: 'cim-123',
    dealId: 'deal-456',
    title: 'Q4 2024 Investment Opportunity',
    workflowState: mockWorkflowState,
    slideCount: 5,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
  }

  const defaultProps = {
    cim: mockCIM,
    projectId: 'project-789',
    onDelete: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering (AC #2)', () => {
    it('should display CIM title', () => {
      render(<CIMCard {...defaultProps} />)

      expect(screen.getByText('Q4 2024 Investment Opportunity')).toBeInTheDocument()
    })

    it('should display formatted updated timestamp', () => {
      render(<CIMCard {...defaultProps} />)

      // Should show relative time (e.g., "Updated 2 weeks ago")
      const timestampElement = screen.getByText(/Updated/i)
      expect(timestampElement).toBeInTheDocument()
    })

    it('should display progress indicator', () => {
      render(<CIMCard {...defaultProps} />)

      // Progress indicator should show phase description
      expect(screen.getByText('Building Outline')).toBeInTheDocument()
    })

    it('should display slide count when slides exist', () => {
      render(<CIMCard {...defaultProps} />)

      expect(screen.getByText('5 slides')).toBeInTheDocument()
    })

    it('should display singular "slide" for count of 1', () => {
      const cimWithOneSlide = { ...mockCIM, slideCount: 1 }
      render(<CIMCard {...defaultProps} cim={cimWithOneSlide} />)

      expect(screen.getByText('1 slide')).toBeInTheDocument()
    })

    it('should not display slide count when zero slides', () => {
      const cimWithNoSlides = { ...mockCIM, slideCount: 0 }
      render(<CIMCard {...defaultProps} cim={cimWithNoSlides} />)

      expect(screen.queryByText(/slides?/)).not.toBeInTheDocument()
    })
  })

  describe('card click navigation (AC #4)', () => {
    it('should navigate to CIM builder on click', async () => {
      render(<CIMCard {...defaultProps} />)

      const card = screen.getByRole('button', { name: /open cim/i })
      fireEvent.click(card)

      expect(mockPush).toHaveBeenCalledWith('/projects/project-789/cim-builder/cim-123')
    })

    it('should navigate on Enter key press', async () => {
      render(<CIMCard {...defaultProps} />)

      const card = screen.getByRole('button', { name: /open cim/i })
      fireEvent.keyDown(card, { key: 'Enter' })

      expect(mockPush).toHaveBeenCalledWith('/projects/project-789/cim-builder/cim-123')
    })

    it('should navigate on Space key press', async () => {
      render(<CIMCard {...defaultProps} />)

      const card = screen.getByRole('button', { name: /open cim/i })
      fireEvent.keyDown(card, { key: ' ' })

      expect(mockPush).toHaveBeenCalledWith('/projects/project-789/cim-builder/cim-123')
    })
  })

  describe('kebab menu and delete (AC #5)', () => {
    it('should show kebab menu button on hover', async () => {
      render(<CIMCard {...defaultProps} />)

      const menuButton = screen.getByRole('button', { name: /cim options/i })
      expect(menuButton).toBeInTheDocument()
    })

    it('should open dropdown menu when kebab button is clicked', async () => {
      const user = userEvent.setup()
      render(<CIMCard {...defaultProps} />)

      const menuButton = screen.getByRole('button', { name: /cim options/i })
      await user.click(menuButton)

      expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument()
    })

    it('should call onDelete when delete menu item is clicked', async () => {
      const user = userEvent.setup()
      const onDelete = vi.fn()
      render(<CIMCard {...defaultProps} onDelete={onDelete} />)

      const menuButton = screen.getByRole('button', { name: /cim options/i })
      await user.click(menuButton)

      const deleteItem = screen.getByRole('menuitem', { name: /delete/i })
      await user.click(deleteItem)

      expect(onDelete).toHaveBeenCalledTimes(1)
    })

    it('should not navigate when clicking kebab menu', async () => {
      const user = userEvent.setup()
      render(<CIMCard {...defaultProps} />)

      const menuButton = screen.getByRole('button', { name: /cim options/i })
      await user.click(menuButton)

      expect(mockPush).not.toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('should have proper role and aria-label', () => {
      render(<CIMCard {...defaultProps} />)

      const card = screen.getByRole('button', { name: /open cim: q4 2024 investment opportunity/i })
      expect(card).toBeInTheDocument()
    })

    it('should be focusable', () => {
      render(<CIMCard {...defaultProps} />)

      const card = screen.getByRole('button', { name: /open cim/i })
      expect(card).toHaveAttribute('tabIndex', '0')
    })
  })
})
