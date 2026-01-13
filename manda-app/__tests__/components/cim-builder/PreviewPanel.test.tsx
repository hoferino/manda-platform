/**
 * PreviewPanel Component Tests
 * Story: E9.8 - Wireframe Preview Renderer
 * Tests: AC #4 (Click-to-Select), AC #6 (Slide Navigation integration)
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'

// Mock scrollIntoView since JSDOM doesn't implement it
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})
import { render, screen, fireEvent } from '@testing-library/react'
import { PreviewPanel } from '@/components/cim-builder/PreviewPanel/PreviewPanel'
import type { Slide, SlideComponent } from '@/lib/types/cim'

// ============================================================================
// Test Fixtures
// ============================================================================

function createSlide(
  id: string,
  title: string,
  components: SlideComponent[] = []
): Slide {
  return {
    id,
    section_id: 'section-1',
    title,
    components,
    visual_concept: null,
    status: 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function createComponent(
  type: 'title' | 'subtitle' | 'text' | 'bullet' | 'chart' | 'image' | 'table',
  content: string
): SlideComponent {
  return {
    id: `component-${type}-${Date.now()}-${Math.random()}`,
    type,
    content,
    metadata: type === 'chart' ? { chartType: 'bar' } : undefined,
    source_refs: [],
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('PreviewPanel', () => {
  const defaultProps = {
    slides: [] as Slide[],
    currentIndex: 0,
    onIndexChange: vi.fn(),
    onComponentSelect: undefined,
  }

  describe('empty state (AC #6)', () => {
    it('should show empty state when no slides', () => {
      render(<PreviewPanel {...defaultProps} slides={[]} />)

      expect(screen.getByTestId('preview-panel-empty')).toBeInTheDocument()
      expect(screen.getByText('No slides yet')).toBeInTheDocument()
    })

    it('should show guidance message in empty state', () => {
      render(<PreviewPanel {...defaultProps} slides={[]} />)

      expect(screen.getByText(/Start a conversation/i)).toBeInTheDocument()
    })
  })

  describe('slide preview rendering (AC #6)', () => {
    it('should render PreviewPanel with slide content', () => {
      const slides = [createSlide('slide-1', 'First Slide')]
      render(<PreviewPanel {...defaultProps} slides={slides} />)

      expect(screen.getByTestId('preview-panel')).toBeInTheDocument()
      // Use getAllByText since title appears in thumbnail strip too
      expect(screen.getAllByText('First Slide').length).toBeGreaterThanOrEqual(1)
    })

    it('should render SlideNavigation', () => {
      const slides = [createSlide('slide-1', 'Test')]
      render(<PreviewPanel {...defaultProps} slides={slides} />)

      // SlideNavigation buttons
      expect(screen.getByRole('button', { name: /previous slide/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /next slide/i })).toBeInTheDocument()
    })

    it('should render SlideCounter', () => {
      const slides = [createSlide('slide-1', 'Test'), createSlide('slide-2', 'Test 2')]
      render(<PreviewPanel {...defaultProps} slides={slides} currentIndex={0} />)

      // SlideCounter displays "Slide X of Y"
      expect(screen.getByText(/Slide 1 of 2/i)).toBeInTheDocument()
    })
  })

  describe('callback wiring (AC #4)', () => {
    it('should pass onComponentSelect to SlidePreview as onComponentClick', () => {
      const onComponentSelect = vi.fn()
      const components = [createComponent('title', 'Clickable Title')]
      const slides = [createSlide('slide-1', 'Test', components)]

      render(
        <PreviewPanel
          {...defaultProps}
          slides={slides}
          onComponentSelect={onComponentSelect}
        />
      )

      // Find the clickable component and click it
      const titleComponent = screen.getByTestId('component-s1_title')
      fireEvent.click(titleComponent)

      expect(onComponentSelect).toHaveBeenCalledWith('s1_title', 'Clickable Title')
    })

    it('should not throw when onComponentSelect is undefined', () => {
      const components = [createComponent('text', 'Text')]
      const slides = [createSlide('slide-1', 'Test', components)]

      render(
        <PreviewPanel
          {...defaultProps}
          slides={slides}
          onComponentSelect={undefined}
        />
      )

      // Should not throw when clicking
      expect(() => {
        fireEvent.click(screen.getByTestId('component-s1_text'))
      }).not.toThrow()
    })
  })

  describe('slide navigation integration (AC #6)', () => {
    it('should display correct slide based on currentIndex', () => {
      const slides = [
        createSlide('slide-1', 'First Slide'),
        createSlide('slide-2', 'Second Slide'),
        createSlide('slide-3', 'Third Slide'),
      ]

      const { rerender } = render(
        <PreviewPanel {...defaultProps} slides={slides} currentIndex={0} />
      )
      // Use getAllByText since title appears in thumbnail strip too
      expect(screen.getAllByText('First Slide').length).toBeGreaterThanOrEqual(1)

      rerender(<PreviewPanel {...defaultProps} slides={slides} currentIndex={1} />)
      expect(screen.getAllByText('Second Slide').length).toBeGreaterThanOrEqual(1)

      rerender(<PreviewPanel {...defaultProps} slides={slides} currentIndex={2} />)
      expect(screen.getAllByText('Third Slide').length).toBeGreaterThanOrEqual(1)
    })

    it('should update slide counter when currentIndex changes', () => {
      const slides = [
        createSlide('slide-1', 'First'),
        createSlide('slide-2', 'Second'),
      ]

      const { rerender } = render(
        <PreviewPanel {...defaultProps} slides={slides} currentIndex={0} />
      )
      expect(screen.getByText(/Slide 1 of 2/i)).toBeInTheDocument()

      rerender(<PreviewPanel {...defaultProps} slides={slides} currentIndex={1} />)
      expect(screen.getByText(/Slide 2 of 2/i)).toBeInTheDocument()
    })

    it('should call onIndexChange when navigation buttons clicked', () => {
      const onIndexChange = vi.fn()
      const slides = [
        createSlide('slide-1', 'First'),
        createSlide('slide-2', 'Second'),
      ]

      render(
        <PreviewPanel
          slides={slides}
          currentIndex={0}
          onIndexChange={onIndexChange}
        />
      )

      // Click next
      fireEvent.click(screen.getByRole('button', { name: /next slide/i }))
      expect(onIndexChange).toHaveBeenCalledWith(1)
    })

    it('should disable Prev button on first slide', () => {
      const slides = [
        createSlide('slide-1', 'First'),
        createSlide('slide-2', 'Second'),
      ]

      render(<PreviewPanel {...defaultProps} slides={slides} currentIndex={0} />)

      expect(screen.getByRole('button', { name: /previous slide/i })).toBeDisabled()
    })

    it('should disable Next button on last slide', () => {
      const slides = [
        createSlide('slide-1', 'First'),
        createSlide('slide-2', 'Second'),
      ]

      render(<PreviewPanel {...defaultProps} slides={slides} currentIndex={1} />)

      expect(screen.getByRole('button', { name: /next slide/i })).toBeDisabled()
    })
  })

  describe('component rendering through SlidePreview (AC #1)', () => {
    it('should render all component types through SlidePreview', () => {
      const components = [
        createComponent('title', 'Title Content'),
        createComponent('subtitle', 'Subtitle Content'),
        createComponent('text', 'Text Content'),
        createComponent('bullet', 'Bullet Content'),
      ]
      const slides = [createSlide('slide-1', 'Test', components)]

      render(<PreviewPanel {...defaultProps} slides={slides} />)

      expect(screen.getByText('Title Content')).toBeInTheDocument()
      expect(screen.getByText('Subtitle Content')).toBeInTheDocument()
      expect(screen.getByText('Text Content')).toBeInTheDocument()
      expect(screen.getByText('Bullet Content')).toBeInTheDocument()
    })
  })
})
