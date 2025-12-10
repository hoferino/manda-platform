'use client'

/**
 * Slide Preview - Wireframe placeholder for slide content
 *
 * Displays a wireframe representation of the slide.
 * Full renderer will be implemented in E9.8.
 *
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * AC: #5 - Preview panel shows slide preview area
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import type { Slide, SlideComponent, ComponentType } from '@/lib/types/cim'

interface SlidePreviewProps {
  slide: Slide | null
  className?: string
}

export function SlidePreview({ slide, className }: SlidePreviewProps) {
  if (!slide) {
    return (
      <div
        className={cn(
          'aspect-[16/9] bg-muted rounded-lg border-2 border-dashed',
          'flex items-center justify-center',
          className
        )}
      >
        <p className="text-sm text-muted-foreground">No slide selected</p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'aspect-[16/9] bg-white dark:bg-slate-900 rounded-lg border shadow-sm',
        'p-6 flex flex-col overflow-hidden',
        className
      )}
    >
      {/* Slide title */}
      <h2 className="text-xl font-bold mb-4 text-foreground">{slide.title}</h2>

      {/* Slide components (wireframe representation) */}
      <div className="flex-1 space-y-3 overflow-auto">
        {slide.components.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-muted-foreground italic">
              No content yet - continue the conversation to add content
            </p>
          </div>
        ) : (
          slide.components.map((component) => (
            <ComponentPreview key={component.id} component={component} />
          ))
        )}
      </div>

      {/* Status indicator */}
      <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
        <span>{slide.status === 'draft' ? 'Draft' : slide.status === 'approved' ? 'Approved' : 'Locked'}</span>
        <span>{new Date(slide.updated_at).toLocaleDateString()}</span>
      </div>
    </div>
  )
}

// Component preview sub-component
interface ComponentPreviewProps {
  component: SlideComponent
}

const componentStyles: Record<ComponentType, string> = {
  title: 'text-lg font-bold',
  subtitle: 'text-base font-semibold text-muted-foreground',
  text: 'text-sm',
  bullet: 'text-sm pl-4 border-l-2 border-primary',
  chart: 'bg-muted/50 rounded p-4 text-center text-xs text-muted-foreground',
  image: 'bg-muted/50 rounded p-8 text-center text-xs text-muted-foreground',
  table: 'bg-muted/50 rounded p-4 text-center text-xs text-muted-foreground',
}

function ComponentPreview({ component }: ComponentPreviewProps) {
  const style = componentStyles[component.type] || componentStyles.text

  // Placeholder for visual components
  if (component.type === 'chart') {
    return (
      <div className={style}>
        <div className="h-24 flex items-center justify-center border border-dashed rounded">
          [Chart: {component.content || 'Placeholder'}]
        </div>
      </div>
    )
  }

  if (component.type === 'image') {
    return (
      <div className={style}>
        <div className="h-32 flex items-center justify-center border border-dashed rounded">
          [Image: {component.content || 'Placeholder'}]
        </div>
      </div>
    )
  }

  if (component.type === 'table') {
    return (
      <div className={style}>
        <div className="h-24 flex items-center justify-center border border-dashed rounded">
          [Table: {component.content || 'Placeholder'}]
        </div>
      </div>
    )
  }

  // Text-based components
  return <p className={style}>{component.content}</p>
}
