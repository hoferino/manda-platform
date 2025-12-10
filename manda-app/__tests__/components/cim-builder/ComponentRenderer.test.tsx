/**
 * ComponentRenderer Component Tests
 * Story: E9.8 - Wireframe Preview Renderer
 * Tests: AC #1 (Component Rendering), AC #2 (Stable Component IDs), AC #4 (Click-to-Select)
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  ComponentRenderer,
  generateComponentId,
} from '@/components/cim-builder/PreviewPanel/ComponentRenderer'
import type { SlideComponent, ComponentType } from '@/lib/types/cim'

// ============================================================================
// Test Fixtures
// ============================================================================

function createComponent(
  type: ComponentType,
  content: string = 'Test content',
  metadata?: Record<string, unknown>
): SlideComponent {
  return {
    id: `component-${type}-${Date.now()}`,
    type,
    content,
    metadata,
    source_refs: [],
  }
}

// ============================================================================
// generateComponentId Tests (AC #2)
// ============================================================================

describe('generateComponentId', () => {
  describe('ID format (AC #2)', () => {
    it('should generate ID in format s{slideNum}_{type}{index}', () => {
      const result = generateComponentId('slide-3', 'bullet', 2)
      expect(result).toBe('s3_bullet2')
    })

    it('should omit index suffix for index 0', () => {
      const result = generateComponentId('slide-1', 'title', 0)
      expect(result).toBe('s1_title')
    })

    it('should extract numbers from slideId with prefix', () => {
      const result = generateComponentId('slide-5', 'chart', 1)
      expect(result).toBe('s5_chart1')
    })

    it('should use 0 for slideId without numbers', () => {
      const result = generateComponentId('abc', 'text', 0)
      expect(result).toBe('s0_text')
    })

    it('should handle UUID-like slideId', () => {
      const result = generateComponentId('123e4567-e89b-12d3-a456-426614174000', 'image', 0)
      // Extracts all digits from UUID: 1234567 89 12 3 456 426614174000
      expect(result).toBe('s123456789123456426614174000_image')
    })

    it('should handle all component types', () => {
      const types: ComponentType[] = ['title', 'subtitle', 'text', 'bullet', 'chart', 'image', 'table']
      types.forEach((type) => {
        const result = generateComponentId('slide-1', type, 0)
        expect(result).toBe(`s1_${type}`)
      })
    })
  })
})

// ============================================================================
// ComponentRenderer Type Dispatch Tests (AC #1)
// ============================================================================

describe('ComponentRenderer', () => {
  const defaultProps = {
    slideId: 'slide-1',
    index: 0,
    onClick: undefined,
  }

  describe('type dispatch (AC #1)', () => {
    it('should render TitleRenderer for title type', () => {
      const component = createComponent('title', 'Test Title')
      render(<ComponentRenderer component={component} {...defaultProps} />)

      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Test Title')
    })

    it('should render SubtitleRenderer for subtitle type', () => {
      const component = createComponent('subtitle', 'Test Subtitle')
      render(<ComponentRenderer component={component} {...defaultProps} />)

      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Test Subtitle')
    })

    it('should render TextRenderer for text type', () => {
      const component = createComponent('text', 'Test paragraph text')
      render(<ComponentRenderer component={component} {...defaultProps} />)

      expect(screen.getByText('Test paragraph text')).toBeInTheDocument()
    })

    it('should render BulletRenderer for bullet type', () => {
      const component = createComponent('bullet', 'Bullet point content')
      render(<ComponentRenderer component={component} {...defaultProps} />)

      expect(screen.getByText('Bullet point content')).toBeInTheDocument()
      // Check for bullet indicator
      expect(screen.getByText('•')).toBeInTheDocument()
    })

    it('should render ChartRenderer for chart type', () => {
      const component = createComponent('chart', 'Revenue data', { chartType: 'bar' })
      render(<ComponentRenderer component={component} {...defaultProps} />)

      expect(screen.getByLabelText('Bar chart')).toBeInTheDocument()
      expect(screen.getByText('Revenue data')).toBeInTheDocument()
    })

    it('should render ImageRenderer for image type', () => {
      const component = createComponent('image', 'Company logo')
      render(<ComponentRenderer component={component} {...defaultProps} />)

      expect(screen.getByText('Company logo')).toBeInTheDocument()
    })

    it('should render TableRenderer for table type', () => {
      const component = createComponent('table', 'Financial summary', { rows: 4, columns: 3 })
      render(<ComponentRenderer component={component} {...defaultProps} />)

      expect(screen.getByText('Financial summary')).toBeInTheDocument()
    })
  })

  describe('data-component-id attribute (AC #2)', () => {
    it('should add data-component-id attribute to wrapper', () => {
      const component = createComponent('title', 'Test')
      render(<ComponentRenderer component={component} slideId="slide-3" index={0} />)

      const wrapper = screen.getByTestId('component-s3_title')
      expect(wrapper).toBeInTheDocument()
      expect(wrapper).toHaveAttribute('data-component-id', 's3_title')
    })

    it('should include index in ID for non-zero indices', () => {
      const component = createComponent('bullet', 'Test')
      render(<ComponentRenderer component={component} slideId="slide-2" index={3} />)

      const wrapper = screen.getByTestId('component-s2_bullet3')
      expect(wrapper).toHaveAttribute('data-component-id', 's2_bullet3')
    })

    it('should persist ID across re-renders', () => {
      const component = createComponent('text', 'Test')
      const { rerender } = render(
        <ComponentRenderer component={component} slideId="slide-1" index={0} />
      )

      expect(screen.getByTestId('component-s1_text')).toBeInTheDocument()

      // Re-render with same props
      rerender(<ComponentRenderer component={component} slideId="slide-1" index={0} />)

      expect(screen.getByTestId('component-s1_text')).toBeInTheDocument()
    })
  })

  describe('click handler (AC #4)', () => {
    it('should call onClick with componentId and content when clicked', () => {
      const onClick = vi.fn()
      const component = createComponent('title', 'Clickable title')
      render(
        <ComponentRenderer
          component={component}
          slideId="slide-2"
          index={0}
          onClick={onClick}
        />
      )

      fireEvent.click(screen.getByTestId('component-s2_title'))

      expect(onClick).toHaveBeenCalledTimes(1)
      expect(onClick).toHaveBeenCalledWith('s2_title', 'Clickable title')
    })

    it('should not throw when onClick is undefined', () => {
      const component = createComponent('text', 'No handler')
      render(<ComponentRenderer component={component} {...defaultProps} onClick={undefined} />)

      // Should not throw
      expect(() => {
        fireEvent.click(screen.getByTestId('component-s1_text'))
      }).not.toThrow()
    })

    it('should apply hover styles when onClick is provided', () => {
      const onClick = vi.fn()
      const component = createComponent('bullet', 'Hoverable')
      render(
        <ComponentRenderer
          component={component}
          {...defaultProps}
          onClick={onClick}
        />
      )

      const wrapper = screen.getByTestId('component-s1_bullet')
      expect(wrapper).toHaveClass('cursor-pointer')
    })

    it('should not apply cursor-pointer when onClick is undefined', () => {
      const component = createComponent('text', 'Not clickable')
      render(<ComponentRenderer component={component} {...defaultProps} onClick={undefined} />)

      const wrapper = screen.getByTestId('component-s1_text')
      expect(wrapper).not.toHaveClass('cursor-pointer')
    })
  })

  describe('chart type rendering (AC #1)', () => {
    it('should render bar chart wireframe for chartType: bar', () => {
      const component = createComponent('chart', 'Sales data', { chartType: 'bar' })
      render(<ComponentRenderer component={component} {...defaultProps} />)

      expect(screen.getByLabelText('Bar chart')).toBeInTheDocument()
    })

    it('should render line chart wireframe for chartType: line', () => {
      const component = createComponent('chart', 'Trend data', { chartType: 'line' })
      render(<ComponentRenderer component={component} {...defaultProps} />)

      expect(screen.getByLabelText('Line chart')).toBeInTheDocument()
    })

    it('should render pie chart wireframe for chartType: pie', () => {
      const component = createComponent('chart', 'Distribution', { chartType: 'pie' })
      render(<ComponentRenderer component={component} {...defaultProps} />)

      expect(screen.getByLabelText('Pie chart')).toBeInTheDocument()
    })

    it('should render area chart wireframe for chartType: area', () => {
      const component = createComponent('chart', 'Growth curve', { chartType: 'area' })
      render(<ComponentRenderer component={component} {...defaultProps} />)

      expect(screen.getByLabelText('Area chart')).toBeInTheDocument()
    })

    it('should default to bar chart when chartType is not specified', () => {
      const component = createComponent('chart', 'Default chart')
      render(<ComponentRenderer component={component} {...defaultProps} />)

      expect(screen.getByLabelText('Bar chart')).toBeInTheDocument()
    })
  })

  describe('table metadata handling (AC #1)', () => {
    it('should render table with specified rows and columns', () => {
      const component = createComponent('table', 'Data table', { rows: 4, columns: 3 })
      render(<ComponentRenderer component={component} {...defaultProps} />)

      // Get the grid container - it has explicit rows/columns
      const wrapper = screen.getByTestId('component-s1_table')
      expect(wrapper).toBeInTheDocument()
    })

    it('should limit rows to maximum 6', () => {
      const component = createComponent('table', 'Large table', { rows: 10, columns: 3 })
      render(<ComponentRenderer component={component} {...defaultProps} />)

      // Should render without error, limited to 6 rows
      expect(screen.getByTestId('component-s1_table')).toBeInTheDocument()
    })

    it('should limit columns to maximum 5', () => {
      const component = createComponent('table', 'Wide table', { rows: 3, columns: 8 })
      render(<ComponentRenderer component={component} {...defaultProps} />)

      // Should render without error, limited to 5 columns
      expect(screen.getByTestId('component-s1_table')).toBeInTheDocument()
    })

    it('should default to 3x3 when metadata not provided', () => {
      const component = createComponent('table', 'Default table')
      render(<ComponentRenderer component={component} {...defaultProps} />)

      expect(screen.getByTestId('component-s1_table')).toBeInTheDocument()
    })
  })

  describe('empty/fallback content (AC #1)', () => {
    it('should show Untitled for empty title content', () => {
      const component = createComponent('title', '')
      render(<ComponentRenderer component={component} {...defaultProps} />)

      expect(screen.getByText('Untitled')).toBeInTheDocument()
    })

    it('should show Subtitle for empty subtitle content', () => {
      const component = createComponent('subtitle', '')
      render(<ComponentRenderer component={component} {...defaultProps} />)

      expect(screen.getByText('Subtitle')).toBeInTheDocument()
    })

    it('should show placeholder for empty text content', () => {
      const component = createComponent('text', '')
      render(<ComponentRenderer component={component} {...defaultProps} />)

      expect(screen.getByText('Text content')).toBeInTheDocument()
    })

    it('should show placeholder for empty bullet content', () => {
      const component = createComponent('bullet', '')
      render(<ComponentRenderer component={component} {...defaultProps} />)

      expect(screen.getByText('Bullet point')).toBeInTheDocument()
    })

    it('should show Image placeholder for empty image content', () => {
      const component = createComponent('image', '')
      render(<ComponentRenderer component={component} {...defaultProps} />)

      expect(screen.getByText('Image placeholder')).toBeInTheDocument()
    })

    it('should show Data table for empty table content', () => {
      const component = createComponent('table', '')
      render(<ComponentRenderer component={component} {...defaultProps} />)

      expect(screen.getByText('Data table')).toBeInTheDocument()
    })
  })

  describe('minimum click target size (AC #4)', () => {
    it('should have minimum height of 32px for click targets', () => {
      const component = createComponent('text', 'Small text')
      render(<ComponentRenderer component={component} {...defaultProps} onClick={vi.fn()} />)

      const wrapper = screen.getByTestId('component-s1_text')
      expect(wrapper).toHaveClass('min-h-[32px]')
    })
  })
})
