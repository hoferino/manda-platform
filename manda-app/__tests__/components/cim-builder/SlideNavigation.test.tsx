/**
 * SlideNavigation Component Tests
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * AC: #5 - Preview Panel with Navigation
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SlideNavigation } from '@/components/cim-builder/PreviewPanel/SlideNavigation'

describe('SlideNavigation', () => {
  const defaultProps = {
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    canGoPrevious: true,
    canGoNext: true,
  }

  describe('rendering (AC #5)', () => {
    it('should render Prev button', () => {
      render(<SlideNavigation {...defaultProps} />)

      expect(screen.getByRole('button', { name: /previous slide/i })).toBeInTheDocument()
      expect(screen.getByText('Prev')).toBeInTheDocument()
    })

    it('should render Next button', () => {
      render(<SlideNavigation {...defaultProps} />)

      expect(screen.getByRole('button', { name: /next slide/i })).toBeInTheDocument()
      expect(screen.getByText('Next')).toBeInTheDocument()
    })
  })

  describe('navigation functionality (AC #5)', () => {
    it('should call onPrevious when Prev button clicked', () => {
      const onPrevious = vi.fn()
      render(<SlideNavigation {...defaultProps} onPrevious={onPrevious} />)

      fireEvent.click(screen.getByRole('button', { name: /previous slide/i }))

      expect(onPrevious).toHaveBeenCalledTimes(1)
    })

    it('should call onNext when Next button clicked', () => {
      const onNext = vi.fn()
      render(<SlideNavigation {...defaultProps} onNext={onNext} />)

      fireEvent.click(screen.getByRole('button', { name: /next slide/i }))

      expect(onNext).toHaveBeenCalledTimes(1)
    })
  })

  describe('disabled states', () => {
    it('should disable Prev button when canGoPrevious is false', () => {
      render(<SlideNavigation {...defaultProps} canGoPrevious={false} />)

      expect(screen.getByRole('button', { name: /previous slide/i })).toBeDisabled()
    })

    it('should disable Next button when canGoNext is false', () => {
      render(<SlideNavigation {...defaultProps} canGoNext={false} />)

      expect(screen.getByRole('button', { name: /next slide/i })).toBeDisabled()
    })

    it('should enable both buttons when both can navigate', () => {
      render(<SlideNavigation {...defaultProps} canGoPrevious={true} canGoNext={true} />)

      expect(screen.getByRole('button', { name: /previous slide/i })).not.toBeDisabled()
      expect(screen.getByRole('button', { name: /next slide/i })).not.toBeDisabled()
    })
  })
})
