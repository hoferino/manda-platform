'use client'

/**
 * useSlideNavigation Hook
 *
 * Manages slide navigation state for the Preview panel.
 *
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * AC: #5 - Slide navigation functionality
 */

import { useCallback, useMemo } from 'react'
import type { Slide } from '@/lib/types/cim'

interface UseSlideNavigationOptions {
  slides: Slide[]
  currentIndex: number
  onIndexChange: (index: number) => void
}

interface UseSlideNavigationReturn {
  currentSlide: Slide | null
  currentIndex: number
  totalSlides: number
  goToSlide: (index: number) => void
  goToNext: () => void
  goToPrevious: () => void
  canGoNext: boolean
  canGoPrevious: boolean
}

export function useSlideNavigation({
  slides,
  currentIndex,
  onIndexChange,
}: UseSlideNavigationOptions): UseSlideNavigationReturn {
  const totalSlides = slides.length

  // Current slide (with bounds checking)
  const currentSlide = useMemo(() => {
    if (slides.length === 0) return null
    const safeIndex = Math.max(0, Math.min(currentIndex, slides.length - 1))
    return slides[safeIndex] ?? null
  }, [slides, currentIndex])

  // Navigation state
  const canGoNext = currentIndex < totalSlides - 1
  const canGoPrevious = currentIndex > 0

  // Go to specific slide
  const goToSlide = useCallback(
    (index: number) => {
      if (index >= 0 && index < totalSlides) {
        onIndexChange(index)
      }
    },
    [totalSlides, onIndexChange]
  )

  // Go to next slide
  const goToNext = useCallback(() => {
    if (canGoNext) {
      onIndexChange(currentIndex + 1)
    }
  }, [canGoNext, currentIndex, onIndexChange])

  // Go to previous slide
  const goToPrevious = useCallback(() => {
    if (canGoPrevious) {
      onIndexChange(currentIndex - 1)
    }
  }, [canGoPrevious, currentIndex, onIndexChange])

  return {
    currentSlide,
    currentIndex,
    totalSlides,
    goToSlide,
    goToNext,
    goToPrevious,
    canGoNext,
    canGoPrevious,
  }
}
