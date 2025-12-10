'use client'

/**
 * SlidePreview - Wireframe renderer for slide content
 *
 * Displays a wireframe representation of the slide with all component types.
 * Features:
 * - Type-specific component rendering via ComponentRenderer
 * - 16:9 aspect ratio with responsive scaling
 * - Stable component IDs for click-to-reference (E9.9)
 * - Visual status indicators (draft/approved/locked)
 * - Click handler support for component selection
 * - Visual concept-driven layout rendering (E9.10)
 *
 * Story: E9.8 - Wireframe Preview Renderer
 * Story: E9.10 - Visual Concept Generation (AC #6: Preview Rendering)
 * AC: #1 (Component Rendering), #2 (Stable IDs), #3 (Wireframe Styling), #5 (Reactive Updates)
 */

import * as React from 'react'
import { memo, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Layout, BarChart3, Image, Columns2, FileText } from 'lucide-react'
import { ComponentRenderer } from './ComponentRenderer'
import type { Slide, SlideComponent, ComponentType, VisualConcept, LayoutType, ChartType } from '@/lib/types/cim'

// ============================================================================
// Types
// ============================================================================

export interface SlidePreviewProps {
  slide: Slide | null
  className?: string
  onComponentClick?: (componentId: string, content: string) => void
}

// ============================================================================
// Status Badge
// ============================================================================

interface StatusBadgeProps {
  status: 'draft' | 'approved' | 'locked'
}

const statusStyles = {
  draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  locked: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const statusLabels = {
  draft: 'Draft',
  approved: 'Approved',
  locked: 'Locked',
}

const StatusBadge = memo(function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'px-2 py-0.5 rounded-full text-xs font-medium',
        statusStyles[status]
      )}
    >
      {statusLabels[status]}
    </span>
  )
})

// ============================================================================
// Layout Badge (E9.10)
// ============================================================================

const layoutIcons: Record<LayoutType, React.ReactNode> = {
  title_slide: <Layout className="h-3 w-3" />,
  content: <FileText className="h-3 w-3" />,
  two_column: <Columns2 className="h-3 w-3" />,
  chart_focus: <BarChart3 className="h-3 w-3" />,
  image_focus: <Image className="h-3 w-3" />,
}

const layoutLabels: Record<LayoutType, string> = {
  title_slide: 'Title',
  content: 'Content',
  two_column: '2-Col',
  chart_focus: 'Chart',
  image_focus: 'Image',
}

interface LayoutBadgeProps {
  layoutType: LayoutType
}

const LayoutBadge = memo(function LayoutBadge({ layoutType }: LayoutBadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      data-testid="layout-badge"
    >
      {layoutIcons[layoutType]}
      {layoutLabels[layoutType]}
    </span>
  )
})

// ============================================================================
// Chart Recommendations Display (E9.10)
// ============================================================================

interface ChartRecommendationsProps {
  recommendations: VisualConcept['chart_recommendations']
}

const ChartRecommendations = memo(function ChartRecommendations({ recommendations }: ChartRecommendationsProps) {
  if (!recommendations || recommendations.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 mt-2" data-testid="chart-recommendations">
      {recommendations.map((rec, idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground"
          title={rec.purpose}
        >
          <BarChart3 className="h-2.5 w-2.5" />
          {rec.type}
        </span>
      ))}
    </div>
  )
})

// ============================================================================
// Component Index Tracking
// ============================================================================

/**
 * Track component indices by type for stable ID generation
 * Returns a map of component ID to its type-specific index
 */
function buildComponentIndices(components: SlideComponent[]): Map<string, number> {
  const typeCounters: Partial<Record<ComponentType, number>> = {}
  const indices = new Map<string, number>()

  for (const component of components) {
    const currentCount = typeCounters[component.type] || 0
    indices.set(component.id, currentCount)
    typeCounters[component.type] = currentCount + 1
  }

  return indices
}

// ============================================================================
// SlidePreview Component
// ============================================================================

export const SlidePreview = memo(function SlidePreview({
  slide,
  className,
  onComponentClick,
}: SlidePreviewProps) {
  // Build component indices for stable ID generation
  const componentIndices = useMemo(
    () => (slide ? buildComponentIndices(slide.components) : new Map()),
    [slide]
  )

  // Empty state when no slide
  if (!slide) {
    return (
      <div
        className={cn(
          'aspect-[16/9] bg-muted rounded-lg border-2 border-dashed',
          'flex items-center justify-center',
          className
        )}
        data-testid="slide-preview-empty"
      >
        <p className="text-sm text-muted-foreground">No slide selected</p>
      </div>
    )
  }

  // Determine if visual concept is set
  const hasVisualConcept = slide.visual_concept !== null

  // Get layout-specific classes for the content area
  const layoutContentClass = useMemo(() => {
    if (!slide.visual_concept) return ''
    switch (slide.visual_concept.layout_type) {
      case 'two_column':
        return 'grid grid-cols-2 gap-4'
      case 'chart_focus':
        return 'flex flex-col'
      case 'image_focus':
        return 'flex flex-col'
      default:
        return ''
    }
  }, [slide.visual_concept])

  return (
    <div
      className={cn(
        // 16:9 aspect ratio with responsive scaling
        'aspect-[16/9] w-full',
        // Wireframe styling: white/dark background, subtle shadow
        'bg-white dark:bg-slate-900 rounded-lg border shadow-sm',
        // Internal layout
        'p-6 flex flex-col overflow-hidden',
        // Visual concept border indicator
        hasVisualConcept && 'border-blue-300 dark:border-blue-700',
        className
      )}
      data-testid="slide-preview"
      data-slide-id={slide.id}
      data-layout-type={slide.visual_concept?.layout_type}
    >
      {/* Slide header with title and layout badge */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-xl font-bold text-foreground leading-tight flex-1">
            {slide.title || 'Untitled Slide'}
          </h2>
          {slide.visual_concept && (
            <LayoutBadge layoutType={slide.visual_concept.layout_type} />
          )}
        </div>
        {/* Show chart recommendations if present */}
        {slide.visual_concept?.chart_recommendations && slide.visual_concept.chart_recommendations.length > 0 && (
          <ChartRecommendations recommendations={slide.visual_concept.chart_recommendations} />
        )}
      </div>

      {/* Slide components with layout-aware rendering */}
      <div className={cn('flex-1 space-y-2 overflow-auto min-h-0', layoutContentClass)}>
        {slide.components.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-muted-foreground italic">
              No content yet - continue the conversation to add content
            </p>
          </div>
        ) : (
          slide.components.map((component) => {
            const index = componentIndices.get(component.id) ?? 0
            return (
              <ComponentRenderer
                key={component.id}
                component={component}
                slideId={slide.id}
                index={index}
                onClick={onComponentClick}
              />
            )
          })
        )}
      </div>

      {/* Image suggestions indicator (E9.10) */}
      {slide.visual_concept?.image_suggestions && slide.visual_concept.image_suggestions.length > 0 && (
        <div className="flex-shrink-0 py-2 border-b border-muted-foreground/10">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Image className="h-3 w-3" />
            <span className="italic">
              {slide.visual_concept.image_suggestions.join(', ')}
            </span>
          </div>
        </div>
      )}

      {/* Footer with status and timestamp */}
      <div className="flex-shrink-0 mt-4 pt-3 border-t border-muted-foreground/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusBadge status={slide.status} />
          {hasVisualConcept && (
            <span className="text-xs text-blue-600 dark:text-blue-400" data-testid="visual-concept-indicator">
              Visual ✓
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {new Date(slide.updated_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  )
})

export default SlidePreview
