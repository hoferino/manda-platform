'use client'

/**
 * Slide Thumbnail - Mini preview for thumbnail strip
 *
 * Renders a small clickable thumbnail of a slide.
 * Section dividers (title-only slides) are styled differently.
 *
 * Story 8: Preview Panel - Slide Thumbnails
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import type { Slide } from '@/lib/types/cim'

export interface SlideThumbnailProps {
  slide: Slide
  index: number
  isSelected: boolean
  onClick: () => void
}

/**
 * Detect if a slide is a section divider
 * Section dividers have only a title component or layoutType === 'title-only'
 */
function isSectionDivider(slide: Slide): boolean {
  // Check for layoutType on extended slide type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extendedSlide = slide as any
  if (extendedSlide.layoutType === 'title-only' || extendedSlide.layoutType === 'section-divider') {
    return true
  }

  // Check if slide has only a title component
  if (slide.components?.length === 1) {
    const comp = slide.components[0]
    if (comp && comp.type === 'subtitle') {
      // subtitle as header indicates section divider
      return true
    }
  }

  // Check if slide has no components (just a title)
  if (!slide.components || slide.components.length === 0) {
    return true
  }

  return false
}

export function SlideThumbnail({
  slide,
  index,
  isSelected,
  onClick,
}: SlideThumbnailProps) {
  const isDivider = isSectionDivider(slide)

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-shrink-0 w-24 h-16 rounded border-2 overflow-hidden transition-all',
        'hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
        isSelected
          ? 'border-primary ring-2 ring-primary/30 scale-105'
          : 'border-border hover:border-primary/50',
        isDivider && 'bg-muted'
      )}
      aria-label={`Slide ${index + 1}: ${slide.title}${isSelected ? ' (Current)' : ''}`}
      aria-current={isSelected ? 'true' : undefined}
    >
      <div className="w-full h-full p-1 flex items-center justify-center">
        {isDivider ? (
          // Section divider - show title prominently
          <span className="text-[8px] font-semibold text-center line-clamp-2 px-1">
            {slide.title}
          </span>
        ) : (
          // Regular slide - show mini preview
          <div className="w-full h-full bg-background rounded-sm flex flex-col p-0.5 overflow-hidden">
            <div className="text-[6px] font-medium truncate text-foreground">
              {slide.title}
            </div>
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[8px] text-muted-foreground">
                {slide.components?.length || 0} items
              </span>
            </div>
          </div>
        )}
      </div>
    </button>
  )
}
