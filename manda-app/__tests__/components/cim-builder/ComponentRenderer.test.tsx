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

    it('should show wireframe grid for empty table content', () => {
      const component = createComponent('table', '')
      render(<ComponentRenderer component={component} {...defaultProps} />)

      // Story 4: Empty table now shows wireframe grid instead of "Data table" text
      const wrapper = screen.getByTestId('component-s1_table')
      expect(wrapper).toBeInTheDocument()
      // Should have the dashed border indicating a wireframe placeholder
      expect(wrapper.querySelector('.border-dashed')).toBeInTheDocument()
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

  // ============================================================================
  // Story 4: Extended Component Types for CIM MVP
  // Note: These tests use extended types that the ComponentRenderer handles at runtime
  // but are not part of the strict TypeScript types. We use type assertions to test
  // the component's ability to handle extended content formats.
  // ============================================================================
  describe('Story 4: CIM MVP extended component types', () => {
    describe('metric rendering', () => {
      it('should render metric component with JSON array content', () => {
        const component = {
          id: `component-metric-${Date.now()}`,
          type: 'metric' as ComponentType,
          content: JSON.stringify([
            { label: 'ARR', value: '$28.5M', subtext: '+42% YoY' },
            { label: 'Customers', value: '150+' },
          ]),
        } as SlideComponent
        render(<ComponentRenderer component={component} {...defaultProps} />)

        expect(screen.getByText('ARR')).toBeInTheDocument()
        expect(screen.getByText('$28.5M')).toBeInTheDocument()
        expect(screen.getByText('+42% YoY')).toBeInTheDocument()
        expect(screen.getByText('Customers')).toBeInTheDocument()
        expect(screen.getByText('150+')).toBeInTheDocument()
      })

      it('should render metric_group type', () => {
        const component = {
          id: `component-metric_group-${Date.now()}`,
          type: 'metric_group' as ComponentType,
          content: JSON.stringify([{ label: 'Revenue', value: '$10M' }]),
        } as SlideComponent
        render(<ComponentRenderer component={component} {...defaultProps} />)

        expect(screen.getByText('Revenue')).toBeInTheDocument()
        expect(screen.getByText('$10M')).toBeInTheDocument()
      })
    })

    describe('bullet_list rendering', () => {
      it('should render bullet_list with array content', () => {
        const component = {
          id: `component-bullet_list-${Date.now()}`,
          type: 'bullet_list' as ComponentType,
          content: JSON.stringify(['First point', 'Second point', 'Third point']),
        } as SlideComponent
        render(<ComponentRenderer component={component} {...defaultProps} />)

        expect(screen.getByText('First point')).toBeInTheDocument()
        expect(screen.getByText('Second point')).toBeInTheDocument()
        expect(screen.getByText('Third point')).toBeInTheDocument()
      })

      it('should render bullet_list with JSON string content', () => {
        const component = createComponent(
          'bullet_list' as ComponentType,
          JSON.stringify(['Item A', 'Item B'])
        )
        render(<ComponentRenderer component={component} {...defaultProps} />)

        expect(screen.getByText('Item A')).toBeInTheDocument()
        expect(screen.getByText('Item B')).toBeInTheDocument()
      })
    })

    describe('numbered_list rendering', () => {
      it('should render numbered_list with numbers', () => {
        const component = {
          id: `component-numbered_list-${Date.now()}`,
          type: 'numbered_list' as ComponentType,
          content: JSON.stringify(['Step one', 'Step two']),
        } as SlideComponent
        render(<ComponentRenderer component={component} {...defaultProps} />)

        expect(screen.getByText('1.')).toBeInTheDocument()
        expect(screen.getByText('Step one')).toBeInTheDocument()
        expect(screen.getByText('2.')).toBeInTheDocument()
        expect(screen.getByText('Step two')).toBeInTheDocument()
      })
    })

    describe('timeline rendering', () => {
      it('should render timeline with events', () => {
        const component = {
          id: `component-timeline-${Date.now()}`,
          type: 'timeline' as ComponentType,
          content: JSON.stringify([
            { date: '2020', title: 'Founded', description: 'Company started' },
            { date: '2023', title: 'Series A' },
          ]),
        } as SlideComponent
        render(<ComponentRenderer component={component} {...defaultProps} />)

        expect(screen.getByText('2020')).toBeInTheDocument()
        expect(screen.getByText('Founded')).toBeInTheDocument()
        expect(screen.getByText('Company started')).toBeInTheDocument()
        expect(screen.getByText('2023')).toBeInTheDocument()
        expect(screen.getByText('Series A')).toBeInTheDocument()
      })

      it('should render wireframe for empty timeline', () => {
        const component = createComponent('timeline' as ComponentType, '')
        render(<ComponentRenderer component={component} {...defaultProps} />)

        // Should show wireframe with placeholder circles
        const wrapper = screen.getByTestId('component-s1_timeline')
        expect(wrapper.querySelector('.border-dashed')).toBeInTheDocument()
      })
    })

    describe('callout rendering', () => {
      it('should render callout with content', () => {
        const component = createComponent(
          'callout' as ComponentType,
          'Important information here'
        )
        render(<ComponentRenderer component={component} {...defaultProps} />)

        expect(screen.getByText('Important information here')).toBeInTheDocument()
        // Callouts have left border styling
        const wrapper = screen.getByTestId('component-s1_callout')
        expect(wrapper.querySelector('.border-l-4')).toBeInTheDocument()
      })

      it('should render key_takeaway type', () => {
        const component = createComponent(
          'key_takeaway' as ComponentType,
          'Key insight'
        )
        render(<ComponentRenderer component={component} {...defaultProps} />)

        expect(screen.getByText('Key insight')).toBeInTheDocument()
      })
    })

    describe('chart type variants', () => {
      it('should render bar_chart type', () => {
        const component = createComponent('bar_chart' as ComponentType, 'Revenue by year')
        render(<ComponentRenderer component={component} {...defaultProps} />)

        expect(screen.getByText('Revenue by year')).toBeInTheDocument()
        expect(screen.getByLabelText('Bar chart')).toBeInTheDocument()
      })

      it('should render pie_chart type', () => {
        const component = createComponent('pie_chart' as ComponentType, 'Market share')
        render(<ComponentRenderer component={component} {...defaultProps} />)

        expect(screen.getByText('Market share')).toBeInTheDocument()
        expect(screen.getByLabelText('Pie chart')).toBeInTheDocument()
      })

      it('should render line_chart type', () => {
        const component = createComponent('line_chart' as ComponentType, 'Growth trend')
        render(<ComponentRenderer component={component} {...defaultProps} />)

        expect(screen.getByText('Growth trend')).toBeInTheDocument()
        expect(screen.getByLabelText('Line chart')).toBeInTheDocument()
      })
    })

    describe('process rendering', () => {
      it('should render flowchart with steps', () => {
        const component = {
          id: `component-flowchart-${Date.now()}`,
          type: 'flowchart' as ComponentType,
          content: JSON.stringify(['Step 1', 'Step 2', 'Step 3']),
        } as SlideComponent
        render(<ComponentRenderer component={component} {...defaultProps} />)

        expect(screen.getByText('Step 1')).toBeInTheDocument()
        expect(screen.getByText('Step 2')).toBeInTheDocument()
        expect(screen.getByText('Step 3')).toBeInTheDocument()
        // Should have arrow separators
        const arrows = screen.getAllByText('→')
        expect(arrows.length).toBeGreaterThan(0)
      })
    })

    describe('table with data', () => {
      it('should render table with array of objects', () => {
        const component = {
          id: `component-table-${Date.now()}`,
          type: 'table' as ComponentType,
          content: JSON.stringify([
            { Metric: 'ARR', Value: '$28.5M' },
            { Metric: 'Customers', Value: '150' },
          ]),
        } as SlideComponent
        render(<ComponentRenderer component={component} {...defaultProps} />)

        // Should render headers from object keys
        expect(screen.getByText('Metric')).toBeInTheDocument()
        expect(screen.getByText('Value')).toBeInTheDocument()
        // Should render data
        expect(screen.getByText('ARR')).toBeInTheDocument()
        expect(screen.getByText('$28.5M')).toBeInTheDocument()
      })

      it('should render table with 2D array', () => {
        const component = {
          id: `component-table-${Date.now()}`,
          type: 'table' as ComponentType,
          content: JSON.stringify([
            ['Year', 'Revenue'],
            ['2023', '$10M'],
            ['2024', '$15M'],
          ]),
        } as SlideComponent
        render(<ComponentRenderer component={component} {...defaultProps} />)

        expect(screen.getByText('Year')).toBeInTheDocument()
        expect(screen.getByText('Revenue')).toBeInTheDocument()
        expect(screen.getByText('2023')).toBeInTheDocument()
        expect(screen.getByText('$10M')).toBeInTheDocument()
      })
    })

    describe('fallback rendering', () => {
      it('should render unknown JSON array content as text (JSON string)', () => {
        // Since SlideComponent.content is typed as string, JSON arrays
        // are passed as JSON strings and rendered as text by default
        const component = {
          id: `component-unknown_type-${Date.now()}`,
          type: 'unknown_type' as ComponentType,
          content: JSON.stringify(['Item 1', 'Item 2']),
        } as SlideComponent
        render(<ComponentRenderer component={component} {...defaultProps} />)

        // JSON string content is rendered as-is by TextRenderer
        expect(screen.getByText('["Item 1","Item 2"]')).toBeInTheDocument()
      })

      it('should render unknown string content as text', () => {
        const component = createComponent(
          'unknown_type' as ComponentType,
          'Just some text'
        )
        render(<ComponentRenderer component={component} {...defaultProps} />)

        expect(screen.getByText('Just some text')).toBeInTheDocument()
      })

      it('should render metric-like JSON as metrics for unknown type', () => {
        const component = createComponent(
          'custom_metric' as ComponentType,
          JSON.stringify([{ label: 'Custom', value: '100%' }])
        )
        render(<ComponentRenderer component={component} {...defaultProps} />)

        expect(screen.getByText('Custom')).toBeInTheDocument()
        expect(screen.getByText('100%')).toBeInTheDocument()
      })
    })

    describe('non-string content handling', () => {
      it('should handle object content in title', () => {
        const component = {
          id: `component-title-${Date.now()}`,
          type: 'title' as ComponentType,
          content: JSON.stringify({ text: 'Title Text', style: 'bold' }),
        } as SlideComponent
        render(<ComponentRenderer component={component} {...defaultProps} />)

        // Should stringify the object
        const wrapper = screen.getByTestId('component-s1_title')
        expect(wrapper).toBeInTheDocument()
      })

      it('should handle null content gracefully', () => {
        const component = {
          id: `component-text-${Date.now()}`,
          type: 'text' as ComponentType,
          content: null as unknown as string,
        } as SlideComponent
        render(<ComponentRenderer component={component} {...defaultProps} />)

        // Should render fallback
        expect(screen.getByText('Text content')).toBeInTheDocument()
      })
    })
  })
})
