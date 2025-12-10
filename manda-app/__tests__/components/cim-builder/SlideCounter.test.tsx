/**
 * SlideCounter Component Tests
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * AC: #5 - Preview Panel with slide counter
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SlideCounter } from '@/components/cim-builder/PreviewPanel/SlideCounter'

describe('SlideCounter', () => {
  describe('rendering (AC #5)', () => {
    it('should display "Slide X of Y" format', () => {
      render(<SlideCounter current={3} total={10} />)

      expect(screen.getByText('Slide 3 of 10')).toBeInTheDocument()
    })

    it('should display correct count for first slide', () => {
      render(<SlideCounter current={1} total={5} />)

      expect(screen.getByText('Slide 1 of 5')).toBeInTheDocument()
    })

    it('should display correct count for last slide', () => {
      render(<SlideCounter current={5} total={5} />)

      expect(screen.getByText('Slide 5 of 5')).toBeInTheDocument()
    })

    it('should display single slide correctly', () => {
      render(<SlideCounter current={1} total={1} />)

      expect(screen.getByText('Slide 1 of 1')).toBeInTheDocument()
    })
  })

  describe('styling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <SlideCounter current={1} total={5} className="custom-class" />
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })
  })
})
