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
 *
 * Story: E9.8 - Wireframe Preview Renderer
 * AC: #1 (Component Rendering), #2 (Stable IDs), #3 (Wireframe Styling), #5 (Reactive Updates)
 */

import * as React from 'react'
import { memo, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { ComponentRenderer } from './ComponentRenderer'
import type { Slide, SlideComponent, ComponentType } from '@/lib/types/cim'

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

  return (
    <div
      className={cn(
        // 16:9 aspect ratio with responsive scaling
        'aspect-[16/9] w-full',
        // Wireframe styling: white/dark background, subtle shadow
        'bg-white dark:bg-slate-900 rounded-lg border shadow-sm',
        // Internal layout
        'p-6 flex flex-col overflow-hidden',
        className
      )}
      data-testid="slide-preview"
      data-slide-id={slide.id}
    >
      {/* Slide header with title */}
      <div className="flex-shrink-0 mb-4">
        <h2 className="text-xl font-bold text-foreground leading-tight">
          {slide.title || 'Untitled Slide'}
        </h2>
      </div>

      {/* Slide components */}
      <div className="flex-1 space-y-2 overflow-auto min-h-0">
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

      {/* Footer with status and timestamp */}
      <div className="flex-shrink-0 mt-4 pt-3 border-t border-muted-foreground/10 flex items-center justify-between">
        <StatusBadge status={slide.status} />
        <span className="text-xs text-muted-foreground">
          {new Date(slide.updated_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  )
})

export default SlidePreview
