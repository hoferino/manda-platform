'use client'

/**
 * IRL Progress Bar Component
 *
 * Enhanced progress bar with percentage label and counts.
 * Story: E6.7 - Build IRL Checklist Progress Visualization
 *
 * Features:
 * - Visual progress bar
 * - Percentage label
 * - Fulfilled/total count display
 * - Responsive design
 */

import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

export interface IRLProgressBarProps {
  /** Number of fulfilled items */
  fulfilled: number
  /** Total number of items */
  total: number
  /** Completion percentage (0-100) */
  percentComplete: number
  /** Whether to show the count label */
  showCount?: boolean
  /** Whether to show the percentage label */
  showPercent?: boolean
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Additional class names */
  className?: string
}

export function IRLProgressBar({
  fulfilled,
  total,
  percentComplete,
  showCount = true,
  showPercent = true,
  size = 'md',
  className,
}: IRLProgressBarProps) {
  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  }

  const textClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      data-testid="irl-progress-bar"
    >
      <Progress
        value={percentComplete}
        className={cn('flex-1', heightClasses[size])}
        aria-label={`${fulfilled} of ${total} items fulfilled (${percentComplete}%)`}
      />
      {(showCount || showPercent) && (
        <div className={cn('text-muted-foreground whitespace-nowrap', textClasses[size])}>
          {showCount && (
            <span className="font-medium text-foreground">
              {fulfilled}/{total}
            </span>
          )}
          {showCount && showPercent && <span> - </span>}
          {showPercent && (
            <span>{percentComplete}%</span>
          )}
        </div>
      )}
    </div>
  )
}
