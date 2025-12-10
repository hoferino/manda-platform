'use client'

/**
 * Preview Panel - Right panel of CIM Builder
 *
 * Shows slide preview with navigation controls.
 * Features:
 * - Slide preview area (wireframe placeholder for E9.8)
 * - Prev/Next navigation buttons
 * - Slide counter ("Slide X of Y")
 *
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * AC: #5 - Preview panel with navigation buttons and slide counter
 */

import * as React from 'react'
import { SlidePreview } from './SlidePreview'
import { SlideNavigation } from './SlideNavigation'
import { SlideCounter } from './SlideCounter'
import { useSlideNavigation } from '@/lib/hooks/useSlideNavigation'
import type { Slide } from '@/lib/types/cim'
import { Presentation } from 'lucide-react'

interface PreviewPanelProps {
  slides: Slide[]
  currentIndex: number
  onIndexChange: (index: number) => void
}

export function PreviewPanel({
  slides,
  currentIndex,
  onIndexChange,
}: PreviewPanelProps) {
  const {
    currentSlide,
    totalSlides,
    goToNext,
    goToPrevious,
    canGoNext,
    canGoPrevious,
  } = useSlideNavigation({
    slides,
    currentIndex,
    onIndexChange,
  })

  // Empty state when no slides exist
  if (slides.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6">
        <div className="rounded-full bg-muted p-6 mb-6">
          <Presentation className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">No slides yet</h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Start a conversation to create your CIM outline and generate slide content.
        </p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Slide preview area */}
      <div className="flex-1 p-4 overflow-auto">
        <SlidePreview slide={currentSlide} />
      </div>

      {/* Navigation controls */}
      <div className="flex-shrink-0 border-t p-3 flex items-center justify-between">
        <SlideNavigation
          onPrevious={goToPrevious}
          onNext={goToNext}
          canGoPrevious={canGoPrevious}
          canGoNext={canGoNext}
        />
        <SlideCounter
          current={currentIndex + 1}
          total={totalSlides}
        />
      </div>
    </div>
  )
}
