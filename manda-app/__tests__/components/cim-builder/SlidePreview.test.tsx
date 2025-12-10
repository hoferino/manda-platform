/**
 * SlidePreview Component Tests
 * Story: E9.8 - Wireframe Preview Renderer
 * Tests: AC #1 (Component Rendering), AC #2 (Stable IDs), AC #3 (Wireframe Styling),
 *        AC #5 (Reactive Updates), AC #6 (Slide Navigation integration)
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SlidePreview } from '@/components/cim-builder/PreviewPanel/SlidePreview'
import type { Slide, SlideComponent } from '@/lib/types/cim'

// ============================================================================
// Test Fixtures
// ============================================================================

function createSlide(
  overrides: Partial<Slide> = {},
  components: SlideComponent[] = []
): Slide {
  return {
    id: 'slide-1',
    section_id: 'section-1',
    title: 'Test Slide',
    components,
    visual_concept: null,
    status: 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function createComponent(
  type: 'title' | 'subtitle' | 'text' | 'bullet' | 'chart' | 'image' | 'table',
  content: string,
  id?: string
): SlideComponent {
  return {
    id: id || `component-${type}-${Date.now()}`,
    type,
    content,
    metadata: type === 'chart' ? { chartType: 'bar' } : undefined,
    source_refs: [],
  }
}

// ============================================================================
// Empty State Tests
// ============================================================================

describe('SlidePreview', () => {
  describe('empty state (AC #6)', () => {
    it('should show empty state when slide is null', () => {
      render(<SlidePreview slide={null} />)

      expect(screen.getByTestId('slide-preview-empty')).toBeInTheDocument()
      expect(screen.getByText('No slide selected')).toBeInTheDocument()
    })

    it('should apply 16:9 aspect ratio to empty state', () => {
      render(<SlidePreview slide={null} />)

      const emptyState = screen.getByTestId('slide-preview-empty')
      expect(emptyState).toHaveClass('aspect-[16/9]')
    })
  })

  describe('slide rendering (AC #1, #3)', () => {
    it('should render slide title', () => {
      const slide = createSlide({ title: 'Executive Summary' })
      render(<SlidePreview slide={slide} />)

      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Executive Summary')
    })

    it('should show Untitled Slide for empty title', () => {
      const slide = createSlide({ title: '' })
      render(<SlidePreview slide={slide} />)

      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Untitled Slide')
    })

    it('should apply 16:9 aspect ratio (AC #3)', () => {
      const slide = createSlide()
      render(<SlidePreview slide={slide} />)

      const preview = screen.getByTestId('slide-preview')
      expect(preview).toHaveClass('aspect-[16/9]')
    })

    it('should apply wireframe background styling (AC #3)', () => {
      const slide = createSlide()
      render(<SlidePreview slide={slide} />)

      const preview = screen.getByTestId('slide-preview')
      expect(preview).toHaveClass('bg-white')
      expect(preview).toHaveClass('dark:bg-slate-900')
      expect(preview).toHaveClass('shadow-sm')
    })

    it('should set data-slide-id attribute', () => {
      const slide = createSlide({ id: 'slide-42' })
      render(<SlidePreview slide={slide} />)

      expect(screen.getByTestId('slide-preview')).toHaveAttribute('data-slide-id', 'slide-42')
    })
  })

  describe('component rendering (AC #1)', () => {
    it('should render all component types', () => {
      const components: SlideComponent[] = [
        createComponent('title', 'Main Title'),
        createComponent('subtitle', 'Sub heading'),
        createComponent('text', 'Body text'),
        createComponent('bullet', 'List item'),
      ]
      const slide = createSlide({}, components)
      render(<SlidePreview slide={slide} />)

      expect(screen.getByText('Main Title')).toBeInTheDocument()
      expect(screen.getByText('Sub heading')).toBeInTheDocument()
      expect(screen.getByText('Body text')).toBeInTheDocument()
      expect(screen.getByText('List item')).toBeInTheDocument()
    })

    it('should show empty content message when no components', () => {
      const slide = createSlide({}, [])
      render(<SlidePreview slide={slide} />)

      expect(screen.getByText(/No content yet/i)).toBeInTheDocument()
    })

    it('should pass correct index to ComponentRenderer for stable IDs (AC #2)', () => {
      // Two bullets should get different indices
      const components: SlideComponent[] = [
        createComponent('bullet', 'First bullet', 'bullet-1'),
        createComponent('bullet', 'Second bullet', 'bullet-2'),
      ]
      const slide = createSlide({ id: 'slide-1' }, components)
      render(<SlidePreview slide={slide} />)

      // First bullet should be s1_bullet (index 0), second should be s1_bullet1 (index 1)
      expect(screen.getByTestId('component-s1_bullet')).toBeInTheDocument()
      expect(screen.getByTestId('component-s1_bullet1')).toBeInTheDocument()
    })
  })

  describe('status indicator (AC #3)', () => {
    it('should show Draft badge for draft status', () => {
      const slide = createSlide({ status: 'draft' })
      render(<SlidePreview slide={slide} />)

      expect(screen.getByText('Draft')).toBeInTheDocument()
    })

    it('should show Approved badge for approved status', () => {
      const slide = createSlide({ status: 'approved' })
      render(<SlidePreview slide={slide} />)

      expect(screen.getByText('Approved')).toBeInTheDocument()
    })

    it('should show Locked badge for locked status', () => {
      const slide = createSlide({ status: 'locked' })
      render(<SlidePreview slide={slide} />)

      expect(screen.getByText('Locked')).toBeInTheDocument()
    })

    it('should display updated date', () => {
      const slide = createSlide({ updated_at: '2025-12-10T12:00:00Z' })
      render(<SlidePreview slide={slide} />)

      // Date formatting depends on locale, just check it's rendered
      const preview = screen.getByTestId('slide-preview')
      expect(preview.textContent).toMatch(/\d+/)
    })
  })

  describe('click handler (AC #4)', () => {
    it('should pass onComponentClick to ComponentRenderer', () => {
      const onClick = vi.fn()
      const components = [createComponent('title', 'Clickable')]
      const slide = createSlide({ id: 'slide-2' }, components)
      render(<SlidePreview slide={slide} onComponentClick={onClick} />)

      fireEvent.click(screen.getByTestId('component-s2_title'))

      expect(onClick).toHaveBeenCalledWith('s2_title', 'Clickable')
    })

    it('should not throw when onComponentClick is undefined', () => {
      const components = [createComponent('text', 'Not clickable')]
      const slide = createSlide({}, components)
      render(<SlidePreview slide={slide} />)

      expect(() => {
        fireEvent.click(screen.getByTestId('component-s1_text'))
      }).not.toThrow()
    })
  })

  describe('reactive updates (AC #5)', () => {
    it('should re-render when slide prop changes', () => {
      const slide1 = createSlide({ title: 'First Slide' })
      const slide2 = createSlide({ title: 'Second Slide' })

      const { rerender } = render(<SlidePreview slide={slide1} />)
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('First Slide')

      rerender(<SlidePreview slide={slide2} />)
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Second Slide')
    })

    it('should update components when slide.components changes', () => {
      const initialSlide = createSlide({}, [createComponent('text', 'Original')])
      const updatedSlide = createSlide({}, [
        createComponent('text', 'Original'),
        createComponent('bullet', 'New bullet'),
      ])

      const { rerender } = render(<SlidePreview slide={initialSlide} />)
      expect(screen.getByText('Original')).toBeInTheDocument()
      expect(screen.queryByText('New bullet')).not.toBeInTheDocument()

      rerender(<SlidePreview slide={updatedSlide} />)
      expect(screen.getByText('Original')).toBeInTheDocument()
      expect(screen.getByText('New bullet')).toBeInTheDocument()
    })

    it('should update status badge when slide.status changes', () => {
      const draftSlide = createSlide({ status: 'draft' })
      const approvedSlide = createSlide({ status: 'approved' })

      const { rerender } = render(<SlidePreview slide={draftSlide} />)
      expect(screen.getByText('Draft')).toBeInTheDocument()

      rerender(<SlidePreview slide={approvedSlide} />)
      expect(screen.getByText('Approved')).toBeInTheDocument()
    })
  })

  describe('className prop', () => {
    it('should apply custom className to slide preview', () => {
      const slide = createSlide()
      render(<SlidePreview slide={slide} className="custom-class" />)

      expect(screen.getByTestId('slide-preview')).toHaveClass('custom-class')
    })

    it('should apply custom className to empty state', () => {
      render(<SlidePreview slide={null} className="custom-empty" />)

      expect(screen.getByTestId('slide-preview-empty')).toHaveClass('custom-empty')
    })
  })
})
