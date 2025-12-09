/**
 * PriorityBadge Component Tests
 * Story: E8.2 - Q&A Management UI with Collaborative Editing (AC: 2)
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PriorityBadge } from '@/components/qa/PriorityBadge'

describe('PriorityBadge', () => {
  describe('rendering', () => {
    it('should render high priority badge with correct label and color', () => {
      render(<PriorityBadge priority="high" />)

      const badge = screen.getByText('High')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('bg-red-100', 'text-red-700')
    })

    it('should render medium priority badge with correct label and color', () => {
      render(<PriorityBadge priority="medium" />)

      const badge = screen.getByText('Medium')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('bg-amber-100', 'text-amber-700')
    })

    it('should render low priority badge with correct label and color', () => {
      render(<PriorityBadge priority="low" />)

      const badge = screen.getByText('Low')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('bg-gray-100', 'text-gray-600')
    })
  })

  describe('size variants', () => {
    it('should apply default size classes', () => {
      render(<PriorityBadge priority="high" />)

      const badge = screen.getByText('High')
      expect(badge).toHaveClass('px-2', 'py-0.5')
    })

    it('should apply small size classes', () => {
      render(<PriorityBadge priority="high" size="sm" />)

      const badge = screen.getByText('High')
      expect(badge).toHaveClass('px-1.5', 'py-0')
    })
  })

  describe('className prop', () => {
    it('should apply custom className', () => {
      render(<PriorityBadge priority="high" className="custom-class" />)

      const badge = screen.getByText('High')
      expect(badge).toHaveClass('custom-class')
    })

    it('should merge custom className with existing classes', () => {
      render(<PriorityBadge priority="medium" className="my-margin" />)

      const badge = screen.getByText('Medium')
      expect(badge).toHaveClass('bg-amber-100')
      expect(badge).toHaveClass('my-margin')
    })
  })
})
