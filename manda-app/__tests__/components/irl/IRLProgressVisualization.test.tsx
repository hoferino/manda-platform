/**
 * IRL Progress Visualization Component Tests
 *
 * Story: E6.7 - Build IRL Checklist Progress Visualization
 * ACs: 1, 2, 4, 5 (Progress display components)
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IRLProgressBar } from '@/components/irl/IRLProgressBar'
import { IRLProgressSummary } from '@/components/irl/IRLProgressSummary'
import { IRLCategoryProgress } from '@/components/irl/IRLCategoryProgress'

describe('IRLProgressBar (AC1, AC4)', () => {
  describe('rendering', () => {
    it('should render progress bar with count and percentage', () => {
      render(
        <IRLProgressBar
          fulfilled={3}
          total={10}
          percentComplete={30}
        />
      )

      expect(screen.getByTestId('irl-progress-bar')).toBeInTheDocument()
      expect(screen.getByText('3/10')).toBeInTheDocument()
      expect(screen.getByText('30%')).toBeInTheDocument()
    })

    it('should render progress bar with aria-label for accessibility', () => {
      render(
        <IRLProgressBar
          fulfilled={5}
          total={20}
          percentComplete={25}
        />
      )

      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-label', '5 of 20 items fulfilled (25%)')
    })

    it('should hide count when showCount is false', () => {
      render(
        <IRLProgressBar
          fulfilled={3}
          total={10}
          percentComplete={30}
          showCount={false}
        />
      )

      expect(screen.queryByText('3/10')).not.toBeInTheDocument()
      expect(screen.getByText('30%')).toBeInTheDocument()
    })

    it('should hide percentage when showPercent is false', () => {
      render(
        <IRLProgressBar
          fulfilled={3}
          total={10}
          percentComplete={30}
          showPercent={false}
        />
      )

      expect(screen.getByText('3/10')).toBeInTheDocument()
      expect(screen.queryByText('30%')).not.toBeInTheDocument()
    })
  })

  describe('size variants', () => {
    it('should render small size variant', () => {
      const { container } = render(
        <IRLProgressBar
          fulfilled={5}
          total={10}
          percentComplete={50}
          size="sm"
        />
      )

      // Small size should use h-1.5 class on progress bar
      const progressBar = container.querySelector('[data-slot="progress"]')
      expect(progressBar).toHaveClass('h-1.5')
    })

    it('should render large size variant', () => {
      const { container } = render(
        <IRLProgressBar
          fulfilled={5}
          total={10}
          percentComplete={50}
          size="lg"
        />
      )

      // Large size should use h-3 class on progress bar
      const progressBar = container.querySelector('[data-slot="progress"]')
      expect(progressBar).toHaveClass('h-3')
    })
  })

  describe('edge cases', () => {
    it('should display 0% correctly', () => {
      render(
        <IRLProgressBar
          fulfilled={0}
          total={10}
          percentComplete={0}
        />
      )

      expect(screen.getByText('0/10')).toBeInTheDocument()
      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('should display 100% correctly (AC5)', () => {
      render(
        <IRLProgressBar
          fulfilled={10}
          total={10}
          percentComplete={100}
        />
      )

      expect(screen.getByText('10/10')).toBeInTheDocument()
      expect(screen.getByText('100%')).toBeInTheDocument()
    })
  })
})

describe('IRLProgressSummary (AC1, AC4, AC5)', () => {
  describe('rendering', () => {
    it('should render summary with all progress details', () => {
      render(
        <IRLProgressSummary
          fulfilled={7}
          unfulfilled={3}
          total={10}
          percentComplete={70}
        />
      )

      expect(screen.getByTestId('irl-progress-summary')).toBeInTheDocument()
      expect(screen.getByText('7/10')).toBeInTheDocument()
      expect(screen.getByText('items fulfilled')).toBeInTheDocument()
      expect(screen.getByText('70%')).toBeInTheDocument()
    })

    it('should show fulfilled and unfulfilled counts (AC4)', () => {
      render(
        <IRLProgressSummary
          fulfilled={7}
          unfulfilled={3}
          total={10}
          percentComplete={70}
        />
      )

      // Fulfilled count with icon
      expect(screen.getByText('7')).toBeInTheDocument()
      expect(screen.getByText('fulfilled')).toBeInTheDocument()

      // Unfulfilled count with icon
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('unfulfilled')).toBeInTheDocument()
    })

    it('should show category count when provided', () => {
      render(
        <IRLProgressSummary
          fulfilled={7}
          unfulfilled={3}
          total={10}
          percentComplete={70}
          categoryCount={5}
        />
      )

      expect(screen.getByText('5')).toBeInTheDocument()
      expect(screen.getByText('categories')).toBeInTheDocument()
    })

    it('should use singular "category" for count of 1', () => {
      render(
        <IRLProgressSummary
          fulfilled={3}
          unfulfilled={2}
          total={5}
          percentComplete={60}
          categoryCount={1}
        />
      )

      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('category')).toBeInTheDocument()
    })
  })

  describe('compact mode', () => {
    it('should render in compact mode with smaller padding', () => {
      const { container } = render(
        <IRLProgressSummary
          fulfilled={5}
          unfulfilled={5}
          total={10}
          percentComplete={50}
          compact
        />
      )

      const summary = container.querySelector('[data-testid="irl-progress-summary"]')
      expect(summary).toHaveClass('p-3')
    })
  })

  describe('100% completion state (AC5)', () => {
    it('should display 100% completion correctly', () => {
      render(
        <IRLProgressSummary
          fulfilled={10}
          unfulfilled={0}
          total={10}
          percentComplete={100}
        />
      )

      expect(screen.getByText('10/10')).toBeInTheDocument()
      expect(screen.getByText('100%')).toBeInTheDocument()
      expect(screen.getByText('0')).toBeInTheDocument() // unfulfilled
    })
  })
})

describe('IRLCategoryProgress (AC2, AC3)', () => {
  describe('text variant', () => {
    it('should render text format with count', () => {
      render(
        <IRLCategoryProgress
          fulfilled={3}
          total={5}
          percentComplete={60}
          variant="text"
        />
      )

      expect(screen.getByTestId('irl-category-progress')).toBeInTheDocument()
      expect(screen.getByText('3/5')).toBeInTheDocument()
    })

    it('should show percentage when showPercent is true', () => {
      render(
        <IRLCategoryProgress
          fulfilled={3}
          total={5}
          percentComplete={60}
          variant="text"
          showPercent
        />
      )

      expect(screen.getByText('3/5 (60%)')).toBeInTheDocument()
    })

    it('should apply green color when category is complete (AC3)', () => {
      const { container } = render(
        <IRLCategoryProgress
          fulfilled={5}
          total={5}
          percentComplete={100}
          variant="text"
        />
      )

      const text = container.querySelector('[data-testid="irl-category-progress"]')
      expect(text).toHaveClass('text-green-600')
    })

    it('should apply muted color when category is not complete', () => {
      const { container } = render(
        <IRLCategoryProgress
          fulfilled={3}
          total={5}
          percentComplete={60}
          variant="text"
        />
      )

      const text = container.querySelector('[data-testid="irl-category-progress"]')
      expect(text).toHaveClass('text-muted-foreground')
    })
  })

  describe('badge variant', () => {
    it('should render as badge', () => {
      render(
        <IRLCategoryProgress
          fulfilled={3}
          total={5}
          percentComplete={60}
          variant="badge"
        />
      )

      const badge = screen.getByTestId('irl-category-progress')
      expect(badge).toHaveAttribute('data-slot', 'badge')
      expect(screen.getByText('3/5')).toBeInTheDocument()
    })

    it('should use green styling for complete category in badge variant', () => {
      const { container } = render(
        <IRLCategoryProgress
          fulfilled={5}
          total={5}
          percentComplete={100}
          variant="badge"
        />
      )

      const badge = container.querySelector('[data-testid="irl-category-progress"]')
      expect(badge).toHaveClass('bg-green-100')
    })
  })

  describe('bar variant', () => {
    it('should render with mini progress bar', () => {
      render(
        <IRLCategoryProgress
          fulfilled={3}
          total={5}
          percentComplete={60}
          variant="bar"
        />
      )

      expect(screen.getByText('3/5')).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('should apply correct aria-label to progress bar', () => {
      render(
        <IRLCategoryProgress
          fulfilled={3}
          total={5}
          percentComplete={60}
          variant="bar"
        />
      )

      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-label', '3 of 5 items fulfilled in category')
    })
  })

  describe('edge cases', () => {
    it('should handle empty category (0 items)', () => {
      render(
        <IRLCategoryProgress
          fulfilled={0}
          total={0}
          percentComplete={0}
          variant="text"
        />
      )

      expect(screen.getByText('0/0')).toBeInTheDocument()
    })

    it('should not show percentage for empty category even with showPercent', () => {
      render(
        <IRLCategoryProgress
          fulfilled={0}
          total={0}
          percentComplete={0}
          variant="text"
          showPercent
        />
      )

      // Should just show "0/0" without percentage since total is 0
      expect(screen.getByText('0/0')).toBeInTheDocument()
      expect(screen.queryByText('(0%)')).not.toBeInTheDocument()
    })
  })
})
