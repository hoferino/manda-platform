/**
 * FollowUpSuggestions Component Tests
 *
 * Tests for the follow-up suggestion chips component.
 * Story: E5.5 - Implement Quick Actions and Suggested Follow-ups
 * AC: #5 (Suggestions Generated), #6 (Click Populates Input), #8 (Responsive)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FollowUpSuggestions } from '@/components/chat/FollowUpSuggestions'

describe('FollowUpSuggestions', () => {
  const mockOnSelect = vi.fn()
  const defaultSuggestions = [
    'What are the key risks identified?',
    'Can you explain the revenue trends?',
    'Are there any missing documents?',
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering (AC: #5)', () => {
    it('renders all suggestions when visible', () => {
      render(
        <FollowUpSuggestions
          suggestions={defaultSuggestions}
          onSelect={mockOnSelect}
          isVisible={true}
        />
      )

      defaultSuggestions.forEach((suggestion) => {
        expect(screen.getByText(suggestion)).toBeInTheDocument()
      })
    })

    it('renders nothing when isVisible is false', () => {
      render(
        <FollowUpSuggestions
          suggestions={defaultSuggestions}
          onSelect={mockOnSelect}
          isVisible={false}
        />
      )

      defaultSuggestions.forEach((suggestion) => {
        expect(screen.queryByText(suggestion)).not.toBeInTheDocument()
      })
    })

    it('renders nothing when suggestions array is empty', () => {
      const { container } = render(
        <FollowUpSuggestions suggestions={[]} onSelect={mockOnSelect} isVisible={true} />
      )

      expect(container.firstChild).toBeNull()
    })

    it('renders "Suggested follow-ups" label', () => {
      render(
        <FollowUpSuggestions
          suggestions={defaultSuggestions}
          onSelect={mockOnSelect}
          isVisible={true}
        />
      )

      expect(screen.getByText('Suggested follow-ups')).toBeInTheDocument()
    })

    it('renders sparkles icon', () => {
      render(
        <FollowUpSuggestions
          suggestions={defaultSuggestions}
          onSelect={mockOnSelect}
          isVisible={true}
        />
      )

      // Check for the icon (svg element)
      const icon = document.querySelector('svg')
      expect(icon).toBeInTheDocument()
    })

    it('renders with data-testid attributes', () => {
      render(
        <FollowUpSuggestions
          suggestions={defaultSuggestions}
          onSelect={mockOnSelect}
          isVisible={true}
        />
      )

      expect(screen.getByTestId('follow-up-suggestion-0')).toBeInTheDocument()
      expect(screen.getByTestId('follow-up-suggestion-1')).toBeInTheDocument()
      expect(screen.getByTestId('follow-up-suggestion-2')).toBeInTheDocument()
    })
  })

  describe('click handling (AC: #6)', () => {
    it('calls onSelect with suggestion text when clicked', async () => {
      const user = userEvent.setup()
      render(
        <FollowUpSuggestions
          suggestions={defaultSuggestions}
          onSelect={mockOnSelect}
          isVisible={true}
        />
      )

      const firstSuggestion = screen.getByTestId('follow-up-suggestion-0')
      await user.click(firstSuggestion)

      expect(mockOnSelect).toHaveBeenCalledTimes(1)
      expect(mockOnSelect).toHaveBeenCalledWith('What are the key risks identified?')
    })

    it('calls onSelect with correct suggestion for each button', async () => {
      const user = userEvent.setup()
      render(
        <FollowUpSuggestions
          suggestions={defaultSuggestions}
          onSelect={mockOnSelect}
          isVisible={true}
        />
      )

      // Click each suggestion and verify the correct text is passed
      for (let i = 0; i < defaultSuggestions.length; i++) {
        const button = screen.getByTestId(`follow-up-suggestion-${i}`)
        await user.click(button)
        expect(mockOnSelect).toHaveBeenLastCalledWith(defaultSuggestions[i])
      }

      expect(mockOnSelect).toHaveBeenCalledTimes(3)
    })
  })

  describe('accessibility', () => {
    it('has region role with aria-label', () => {
      render(
        <FollowUpSuggestions
          suggestions={defaultSuggestions}
          onSelect={mockOnSelect}
          isVisible={true}
        />
      )

      const region = screen.getByRole('region')
      expect(region).toHaveAttribute('aria-label', 'Suggested follow-up questions')
    })

    it('buttons have aria-labels with full suggestion text', () => {
      render(
        <FollowUpSuggestions
          suggestions={defaultSuggestions}
          onSelect={mockOnSelect}
          isVisible={true}
        />
      )

      defaultSuggestions.forEach((suggestion, index) => {
        const button = screen.getByTestId(`follow-up-suggestion-${index}`)
        expect(button).toHaveAttribute(
          'aria-label',
          `Suggested question: ${suggestion}`
        )
      })
    })
  })

  describe('styling (AC: #8)', () => {
    it('has fade-in animation class', () => {
      render(
        <FollowUpSuggestions
          suggestions={defaultSuggestions}
          onSelect={mockOnSelect}
          isVisible={true}
        />
      )

      const region = screen.getByRole('region')
      expect(region).toHaveClass('animate-in')
      expect(region).toHaveClass('fade-in')
    })

    it('suggestion buttons have proper styling classes', () => {
      render(
        <FollowUpSuggestions
          suggestions={defaultSuggestions}
          onSelect={mockOnSelect}
          isVisible={true}
        />
      )

      const button = screen.getByTestId('follow-up-suggestion-0')
      expect(button.className).toMatch(/hover:/)
      expect(button.className).toMatch(/text-sm/)
    })

    it('container has horizontal scroll for mobile responsiveness', () => {
      render(
        <FollowUpSuggestions
          suggestions={defaultSuggestions}
          onSelect={mockOnSelect}
          isVisible={true}
        />
      )

      const buttonsContainer = screen.getByTestId('follow-up-suggestion-0').parentElement
      expect(buttonsContainer).toHaveClass('overflow-x-auto')
    })

    it('buttons have max-width for truncation on mobile', () => {
      render(
        <FollowUpSuggestions
          suggestions={defaultSuggestions}
          onSelect={mockOnSelect}
          isVisible={true}
        />
      )

      const button = screen.getByTestId('follow-up-suggestion-0')
      expect(button.className).toMatch(/max-w-/)
    })
  })

  describe('edge cases', () => {
    it('handles single suggestion', () => {
      render(
        <FollowUpSuggestions
          suggestions={['Single question?']}
          onSelect={mockOnSelect}
          isVisible={true}
        />
      )

      expect(screen.getByText('Single question?')).toBeInTheDocument()
      expect(screen.queryByTestId('follow-up-suggestion-1')).not.toBeInTheDocument()
    })

    it('handles long suggestion text', () => {
      const longSuggestion =
        'This is a very long follow-up suggestion that might need to be truncated or wrapped depending on the viewport size and container constraints'
      render(
        <FollowUpSuggestions
          suggestions={[longSuggestion]}
          onSelect={mockOnSelect}
          isVisible={true}
        />
      )

      expect(screen.getByText(longSuggestion)).toBeInTheDocument()
    })

    it('applies custom className', () => {
      render(
        <FollowUpSuggestions
          suggestions={defaultSuggestions}
          onSelect={mockOnSelect}
          isVisible={true}
          className="custom-class"
        />
      )

      const region = screen.getByRole('region')
      expect(region).toHaveClass('custom-class')
    })
  })
})
