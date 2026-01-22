'use client'

/**
 * Preview Panel - Right panel of CIM Builder
 *
 * Shows slide preview with navigation controls.
 * Features:
 * - Slide preview area with wireframe rendering (E9.8)
 * - Prev/Next navigation buttons
 * - Slide counter ("Slide X of Y")
 * - Component click handler for chat reference (E9.9)
 * - Horizontal thumbnail strip (Story 8)
 *
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * Updated: E9.8 - Wireframe Preview Renderer
 * Updated: Story 8 - Slide Thumbnails
 * AC: #5 - Preview panel with navigation buttons and slide counter
 * AC: #4 (E9.8) - Click-to-select components
 */

import * as React from 'react'
import { useRef, useEffect, useState, useCallback } from 'react'
import { SlidePreview } from './SlidePreview'
import { SlideNavigation } from './SlideNavigation'
import { SlideCounter } from './SlideCounter'
import { SlideThumbnail } from './SlideThumbnail'
import { WireframeRenderer } from './WireframeRenderer'
import { useSlideNavigation } from '@/lib/hooks/useSlideNavigation'
import type { Slide } from '@/lib/types/cim'
import type { SlideUpdate } from '@/lib/agent/cim-mvp'
import { Presentation } from 'lucide-react'

/**
 * Scaled Slide Canvas - mimics PowerPoint slide sizing
 *
 * Uses a fixed internal canvas (960x540 = 16:9) and CSS transform
 * to scale the entire slide proportionally. When you resize the panel,
 * the slide zooms in/out rather than reflowing content.
 */
function ScaledSlideCanvas({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  // PowerPoint standard slide size (16:9 aspect ratio)
  const SLIDE_WIDTH = 960
  const SLIDE_HEIGHT = 540

  const updateScale = useCallback(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight

    // Calculate scale to fit slide into container with some padding
    const padding = 32 // 16px on each side
    const availableWidth = containerWidth - padding
    const availableHeight = containerHeight - padding

    const scaleX = availableWidth / SLIDE_WIDTH
    const scaleY = availableHeight / SLIDE_HEIGHT
    const newScale = Math.min(scaleX, scaleY, 1) // Never scale up beyond 100%

    setScale(newScale)
  }, [])

  useEffect(() => {
    updateScale()

    const observer = new ResizeObserver(updateScale)
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [updateScale])

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center"
    >
      <div
        style={{
          width: SLIDE_WIDTH,
          height: SLIDE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
        className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 flex-shrink-0"
      >
        {children}
      </div>
    </div>
  )
}

export interface PreviewPanelProps {
  slides: Slide[]
  currentIndex: number
  onIndexChange: (index: number) => void
  /** Callback when a component is clicked for chat reference (E9.9 integration) */
  onComponentSelect?: (componentId: string, content: string) => void
  /** Story 9: Optional MVP-style slides with layout support */
  mvpSlides?: SlideUpdate[]
}

export function PreviewPanel({
  slides,
  currentIndex,
  onIndexChange,
  onComponentSelect,
  mvpSlides,
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

  // Story 9: Determine if we have MVP slides and find the matching one by ID
  // MVP slides have layout information that DB slides don't preserve
  const currentMVPSlide = React.useMemo(() => {
    if (!mvpSlides || mvpSlides.length === 0 || !currentSlide) return null
    return mvpSlides.find(s => s.slideId === currentSlide.id) || null
  }, [mvpSlides, currentSlide])

  // Story 8: Ref for thumbnail strip to scroll selected into view
  const thumbnailsRef = useRef<HTMLDivElement>(null)

  // Story 8: Scroll selected thumbnail into view when currentIndex changes
  useEffect(() => {
    const container = thumbnailsRef.current
    if (container && slides.length > 0) {
      const selectedThumb = container.children[currentIndex] as HTMLElement
      if (selectedThumb) {
        selectedThumb.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest',
        })
      }
    }
  }, [currentIndex, slides.length])

  // Empty state when no slides exist
  if (slides.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6" data-testid="preview-panel-empty">
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
    <div className="h-full flex flex-col" data-testid="preview-panel">
      {/* Story 8: Thumbnail strip */}
      <div
        ref={thumbnailsRef}
        className="flex gap-2 p-2 overflow-x-auto border-b bg-muted/30 flex-shrink-0"
        role="tablist"
        aria-label="Slide thumbnails"
      >
        {slides.map((slide, index) => (
          <SlideThumbnail
            key={slide.id}
            slide={slide}
            index={index}
            isSelected={index === currentIndex}
            onClick={() => onIndexChange(index)}
          />
        ))}
      </div>

      {/* Slide preview area - uses fixed canvas with CSS transform scaling */}
      <div className="flex-1 overflow-hidden">
        {/* Story 9: Use WireframeRenderer for MVP slides, SlidePreview for legacy */}
        {currentMVPSlide ? (
          <ScaledSlideCanvas>
            <div
              className="w-full h-full"
              data-testid="wireframe-preview"
              data-slide-id={currentMVPSlide.slideId}
            >
              <WireframeRenderer
                layoutType={currentMVPSlide.layoutType}
                components={currentMVPSlide.components}
                title={currentMVPSlide.title}
                slideId={currentMVPSlide.slideId}
                onComponentClick={onComponentSelect}
              />
            </div>
          </ScaledSlideCanvas>
        ) : (
          <SlidePreview slide={currentSlide} onComponentClick={onComponentSelect} />
        )}
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
