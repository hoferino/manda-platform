'use client'

/**
 * Outline Tree - CIM MVP workflow outline with progress indicators
 *
 * Displays the CIM outline from the workflow-based agent with:
 * - Collapsible sections with slides underneath
 * - Progress indicators per section (pending, content_development, building_slides, complete)
 * - Click handlers for section and slide navigation
 *
 * Story 7: CIM Structure Panel (Outline Tree)
 */

import * as React from 'react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ChevronRight, CheckCircle2 } from 'lucide-react'
import type { CIMOutline, CIMSection, SectionProgress, SlideProgress } from '@/lib/agent/cim-mvp'

interface OutlineTreeProps {
  outline: CIMOutline | null
  sectionProgress?: Record<string, SectionProgress>
  currentSectionId?: string
  currentSlideId?: string
  onSectionClick?: (sectionId: string) => void
  onSlideClick?: (slideId: string) => void
  className?: string
}

/**
 * Get progress indicator for section status
 */
function getProgressIndicator(status?: string) {
  switch (status) {
    case 'complete':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case 'building_slides':
      return <div className="h-3 w-3 rounded-full bg-blue-500" />
    case 'content_development':
      return <div className="h-3 w-3 rounded-full bg-yellow-500" />
    default: // pending
      return <div className="h-3 w-3 rounded-full bg-gray-300 dark:bg-gray-600" />
  }
}

/**
 * Get slide progress indicator
 */
function getSlideProgressIndicator(slide: SlideProgress) {
  if (slide.visualApproved) {
    return <CheckCircle2 className="h-3 w-3 text-green-500" />
  }
  if (slide.contentApproved) {
    return <div className="h-2 w-2 rounded-full bg-blue-500" />
  }
  return <div className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" />
}

/**
 * Section Item Component
 */
function SectionItem({
  section,
  progress,
  isCurrentSection,
  currentSlideId,
  onSectionClick,
  onSlideClick,
}: {
  section: CIMSection
  progress?: SectionProgress
  isCurrentSection: boolean
  currentSlideId?: string
  onSectionClick?: (id: string) => void
  onSlideClick?: (id: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(isCurrentSection)

  // Update expansion when current section changes
  React.useEffect(() => {
    if (isCurrentSection) {
      setIsExpanded(true)
    }
  }, [isCurrentSection])

  const hasSlides = progress?.slides && progress.slides.length > 0

  return (
    <div>
      {/* Section header */}
      <button
        className={cn(
          'flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-left text-sm',
          'transition-colors',
          isCurrentSection
            ? 'bg-accent text-accent-foreground'
            : 'hover:bg-muted'
        )}
        onClick={() => {
          if (hasSlides) {
            setIsExpanded(!isExpanded)
          }
          onSectionClick?.(section.id)
        }}
        aria-expanded={hasSlides ? isExpanded : undefined}
        aria-label={`${section.title}${isCurrentSection ? ' (Current)' : ''}`}
      >
        {/* Expand/collapse chevron */}
        <ChevronRight
          className={cn(
            'h-4 w-4 transition-transform flex-shrink-0',
            isExpanded && 'rotate-90',
            !hasSlides && 'invisible'
          )}
        />
        {/* Progress indicator */}
        <span className="flex-shrink-0">
          {getProgressIndicator(progress?.status)}
        </span>
        {/* Section title */}
        <span className="truncate flex-1">{section.title}</span>
      </button>

      {/* Slides (when expanded) */}
      {isExpanded && hasSlides && (
        <div className="ml-6 mt-1 space-y-0.5">
          {progress.slides.map((slide, index) => (
            <button
              key={slide.slideId}
              className={cn(
                'flex items-center gap-2 w-full px-2 py-1 rounded text-left text-xs',
                'transition-colors',
                slide.slideId === currentSlideId
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              )}
              onClick={() => onSlideClick?.(slide.slideId)}
              aria-label={`Slide ${index + 1}${slide.slideId === currentSlideId ? ' (Current)' : ''}`}
            >
              {/* Slide progress indicator */}
              <span className="flex-shrink-0">
                {getSlideProgressIndicator(slide)}
              </span>
              {/* Slide label */}
              <span className="truncate">Slide {index + 1}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * OutlineTree Component
 *
 * Displays the CIM outline as a collapsible tree with sections and slides.
 */
export function OutlineTree({
  outline,
  sectionProgress = {},
  currentSectionId,
  currentSlideId,
  onSectionClick,
  onSlideClick,
  className,
}: OutlineTreeProps) {
  // Handle empty state
  if (!outline || outline.sections.length === 0) {
    return (
      <div className={cn('p-4 text-center', className)}>
        <p className="text-sm text-muted-foreground">No outline yet.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Complete the outline stage to see the CIM structure.
        </p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-1', className)}>
      {outline.sections.map((section) => {
        const progress = sectionProgress[section.id]
        const isCurrentSection = section.id === currentSectionId

        return (
          <SectionItem
            key={section.id}
            section={section}
            progress={progress}
            isCurrentSection={isCurrentSection}
            currentSlideId={currentSlideId}
            onSectionClick={onSectionClick}
            onSlideClick={onSlideClick}
          />
        )
      })}
    </div>
  )
}
