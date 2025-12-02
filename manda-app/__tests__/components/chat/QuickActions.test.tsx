/**
 * QuickActions Component Tests
 *
 * Tests for the quick action buttons component.
 * Story: E5.5 - Implement Quick Actions and Suggested Follow-ups
 * AC: #1 (Buttons Visible), #2 (Triggers Tool Call), #3 (Loading States), #4 (Disabled States), #8 (Responsive)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickActions, QUICK_ACTIONS } from '@/components/chat/QuickActions'

describe('QuickActions', () => {
  const mockOnAction = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering (AC: #1)', () => {
    it('renders all 4 quick action buttons', () => {
      render(<QuickActions onAction={mockOnAction} />)

      expect(screen.getByTestId('quick-action-find-contradictions')).toBeInTheDocument()
      expect(screen.getByTestId('quick-action-generate-qa')).toBeInTheDocument()
      expect(screen.getByTestId('quick-action-summarize-findings')).toBeInTheDocument()
      expect(screen.getByTestId('quick-action-identify-gaps')).toBeInTheDocument()
    })

    it('renders buttons with correct labels', () => {
      render(<QuickActions onAction={mockOnAction} />)

      expect(screen.getByText('Find Contradictions')).toBeInTheDocument()
      expect(screen.getByText('Generate Q&A')).toBeInTheDocument()
      expect(screen.getByText('Summarize Findings')).toBeInTheDocument()
      expect(screen.getByText('Identify Gaps')).toBeInTheDocument()
    })

    it('renders buttons with icons', () => {
      render(<QuickActions onAction={mockOnAction} />)

      // Each button should have an svg icon
      QUICK_ACTIONS.forEach((action) => {
        const button = screen.getByTestId(`quick-action-${action.id}`)
        const icon = button.querySelector('svg')
        expect(icon).toBeInTheDocument()
      })
    })

    it('has toolbar role for accessibility', () => {
      render(<QuickActions onAction={mockOnAction} />)

      expect(screen.getByRole('toolbar')).toBeInTheDocument()
    })

    it('has aria-label on toolbar', () => {
      render(<QuickActions onAction={mockOnAction} />)

      const toolbar = screen.getByRole('toolbar')
      expect(toolbar).toHaveAttribute('aria-label', 'Quick actions')
    })

    it('buttons have aria-labels', () => {
      render(<QuickActions onAction={mockOnAction} />)

      QUICK_ACTIONS.forEach((action) => {
        const button = screen.getByTestId(`quick-action-${action.id}`)
        expect(button).toHaveAttribute('aria-label', action.label)
      })
    })
  })

  describe('click handling (AC: #2)', () => {
    it('calls onAction with correct prompt when Find Contradictions is clicked', async () => {
      const user = userEvent.setup()
      render(<QuickActions onAction={mockOnAction} />)

      const button = screen.getByTestId('quick-action-find-contradictions')
      await user.click(button)

      expect(mockOnAction).toHaveBeenCalledTimes(1)
      expect(mockOnAction).toHaveBeenCalledWith(
        'Please scan for any contradictions or conflicting information in the documents.'
      )
    })

    it('calls onAction with correct prompt when Generate Q&A is clicked', async () => {
      const user = userEvent.setup()
      render(<QuickActions onAction={mockOnAction} />)

      const button = screen.getByTestId('quick-action-generate-qa')
      await user.click(button)

      expect(mockOnAction).toHaveBeenCalledWith(
        'Generate Q&A suggestions based on the current deal context.'
      )
    })

    it('calls onAction with correct prompt when Summarize Findings is clicked', async () => {
      const user = userEvent.setup()
      render(<QuickActions onAction={mockOnAction} />)

      const button = screen.getByTestId('quick-action-summarize-findings')
      await user.click(button)

      expect(mockOnAction).toHaveBeenCalledWith(
        'Please summarize the key findings from the uploaded documents.'
      )
    })

    it('calls onAction with correct prompt when Identify Gaps is clicked', async () => {
      const user = userEvent.setup()
      render(<QuickActions onAction={mockOnAction} />)

      const button = screen.getByTestId('quick-action-identify-gaps')
      await user.click(button)

      expect(mockOnAction).toHaveBeenCalledWith(
        'What information gaps exist against the IRL checklist?'
      )
    })
  })

  describe('loading state (AC: #3)', () => {
    it('disables all buttons when isLoading is true', () => {
      render(<QuickActions onAction={mockOnAction} isLoading />)

      QUICK_ACTIONS.forEach((action) => {
        const button = screen.getByTestId(`quick-action-${action.id}`)
        expect(button).toBeDisabled()
      })
    })

    it('shows loading spinner on all buttons when isLoading is true', () => {
      render(<QuickActions onAction={mockOnAction} isLoading />)

      QUICK_ACTIONS.forEach((action) => {
        const button = screen.getByTestId(`quick-action-${action.id}`)
        const spinner = button.querySelector('.animate-spin')
        expect(spinner).toBeInTheDocument()
      })
    })

    it('does not call onAction when button clicked during loading', async () => {
      const user = userEvent.setup()
      render(<QuickActions onAction={mockOnAction} isLoading />)

      const button = screen.getByTestId('quick-action-find-contradictions')
      await user.click(button)

      expect(mockOnAction).not.toHaveBeenCalled()
    })
  })

  describe('disabled state with reasons (AC: #4)', () => {
    it('disables specific button based on availability', () => {
      render(
        <QuickActions
          onAction={mockOnAction}
          availability={{
            'find-contradictions': { enabled: false, reason: 'Upload documents first' },
            'generate-qa': { enabled: true },
            'summarize-findings': { enabled: true },
            'identify-gaps': { enabled: true },
          }}
        />
      )

      expect(screen.getByTestId('quick-action-find-contradictions')).toBeDisabled()
      expect(screen.getByTestId('quick-action-generate-qa')).not.toBeDisabled()
    })

    it('shows tooltip with reason when button is disabled', async () => {
      const user = userEvent.setup()
      render(
        <QuickActions
          onAction={mockOnAction}
          availability={{
            'find-contradictions': { enabled: false, reason: 'Upload documents first' },
            'generate-qa': { enabled: true },
            'summarize-findings': { enabled: true },
            'identify-gaps': { enabled: true },
          }}
        />
      )

      // Find the TooltipTrigger (span wrapping the button)
      const button = screen.getByTestId('quick-action-find-contradictions')
      const tooltipTrigger = button.closest('[data-state]')

      if (tooltipTrigger) {
        await user.hover(tooltipTrigger)
      }

      // Wait for tooltip to appear - Radix may render multiple for accessibility
      await waitFor(
        () => {
          const tooltips = screen.getAllByText('Upload documents first')
          expect(tooltips.length).toBeGreaterThan(0)
        },
        { timeout: 1000 }
      )
    })

    it('does not call onAction when disabled button clicked', async () => {
      const user = userEvent.setup()
      render(
        <QuickActions
          onAction={mockOnAction}
          availability={{
            'find-contradictions': { enabled: false, reason: 'Upload documents first' },
            'generate-qa': { enabled: true },
            'summarize-findings': { enabled: true },
            'identify-gaps': { enabled: true },
          }}
        />
      )

      const button = screen.getByTestId('quick-action-find-contradictions')
      await user.click(button)

      expect(mockOnAction).not.toHaveBeenCalled()
    })

    it('applies opacity class to disabled buttons', () => {
      render(
        <QuickActions
          onAction={mockOnAction}
          availability={{
            'find-contradictions': { enabled: false, reason: 'Upload documents first' },
            'generate-qa': { enabled: true },
            'summarize-findings': { enabled: true },
            'identify-gaps': { enabled: true },
          }}
        />
      )

      const disabledButton = screen.getByTestId('quick-action-find-contradictions')
      expect(disabledButton).toHaveClass('opacity-50')
    })
  })

  describe('responsive layout (AC: #8)', () => {
    it('has flex-wrap class for responsive wrapping', () => {
      render(<QuickActions onAction={mockOnAction} />)

      const toolbar = screen.getByRole('toolbar')
      expect(toolbar).toHaveClass('flex-wrap')
    })

    it('buttons hide labels on small screens via className', () => {
      render(<QuickActions onAction={mockOnAction} />)

      const button = screen.getByTestId('quick-action-find-contradictions')
      const label = within(button).getByText('Find Contradictions')
      expect(label).toHaveClass('sm:inline')
      expect(label).toHaveClass('hidden')
    })
  })

  describe('QUICK_ACTIONS configuration', () => {
    it('has correct number of actions', () => {
      expect(QUICK_ACTIONS).toHaveLength(4)
    })

    it('each action has required properties', () => {
      QUICK_ACTIONS.forEach((action) => {
        expect(action.id).toBeDefined()
        expect(action.label).toBeDefined()
        expect(action.icon).toBeDefined()
        expect(action.prompt).toBeDefined()
        expect(action.toolName).toBeDefined()
      })
    })

    it('actions have unique IDs', () => {
      const ids = QUICK_ACTIONS.map((a) => a.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })
  })
})
