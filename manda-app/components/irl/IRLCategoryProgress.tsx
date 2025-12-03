'use client'

/**
 * IRL Category Progress Component
 *
 * Inline progress indicator for category headers.
 * Story: E6.7 - Build IRL Checklist Progress Visualization
 *
 * Features:
 * - Compact "X/Y" display
 * - Optional mini progress bar
 * - Badge variant option
 * - Visual distinction for completion states
 */

import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface IRLCategoryProgressProps {
  /** Number of fulfilled items in category */
  fulfilled: number
  /** Total number of items in category */
  total: number
  /** Completion percentage (0-100) */
  percentComplete: number
  /** Display variant */
  variant?: 'text' | 'badge' | 'bar'
  /** Whether to show percentage */
  showPercent?: boolean
  /** Additional class names */
  className?: string
}

export function IRLCategoryProgress({
  fulfilled,
  total,
  percentComplete,
  variant = 'text',
  showPercent = false,
  className,
}: IRLCategoryProgressProps) {
  const isComplete = fulfilled === total && total > 0
  const isEmpty = total === 0

  // Text-only variant
  if (variant === 'text') {
    return (
      <span
        className={cn(
          'text-xs font-medium',
          isComplete ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground',
          isEmpty && 'opacity-50',
          className
        )}
        data-testid="irl-category-progress"
      >
        {fulfilled}/{total}
        {showPercent && total > 0 && ` (${percentComplete}%)`}
      </span>
    )
  }

  // Badge variant
  if (variant === 'badge') {
    return (
      <Badge
        variant={isComplete ? 'default' : 'secondary'}
        className={cn(
          'text-xs',
          isComplete && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
          className
        )}
        data-testid="irl-category-progress"
      >
        {fulfilled}/{total}
        {showPercent && total > 0 && ` (${percentComplete}%)`}
      </Badge>
    )
  }

  // Bar variant with mini progress bar
  return (
    <div
      className={cn('flex items-center gap-2', className)}
      data-testid="irl-category-progress"
    >
      <span
        className={cn(
          'text-xs font-medium',
          isComplete ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
        )}
      >
        {fulfilled}/{total}
      </span>
      <Progress
        value={percentComplete}
        className="w-16 h-1.5"
        aria-label={`${fulfilled} of ${total} items fulfilled in category`}
      />
    </div>
  )
}
