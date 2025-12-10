'use client'

/**
 * Slide Navigation - Prev/Next navigation buttons
 *
 * Navigation controls for the slide preview panel.
 *
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * AC: #5 - Prev/Next navigation buttons
 */

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface SlideNavigationProps {
  onPrevious: () => void
  onNext: () => void
  canGoPrevious: boolean
  canGoNext: boolean
}

export function SlideNavigation({
  onPrevious,
  onNext,
  canGoPrevious,
  canGoNext,
}: SlideNavigationProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onPrevious}
        disabled={!canGoPrevious}
        aria-label="Previous slide"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Prev
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onNext}
        disabled={!canGoNext}
        aria-label="Next slide"
      >
        Next
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  )
}
