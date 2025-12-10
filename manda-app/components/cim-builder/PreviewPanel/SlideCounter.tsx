'use client'

/**
 * Slide Counter - "Slide X of Y" display
 *
 * Shows the current slide position in the presentation.
 *
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * AC: #5 - Slide counter showing "Slide X of Y" format
 */

import * as React from 'react'
import { cn } from '@/lib/utils'

interface SlideCounterProps {
  current: number
  total: number
  className?: string
}

export function SlideCounter({ current, total, className }: SlideCounterProps) {
  return (
    <span className={cn('text-sm text-muted-foreground', className)}>
      Slide {current} of {total}
    </span>
  )
}
