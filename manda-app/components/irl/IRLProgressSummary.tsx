'use client'

/**
 * IRL Progress Summary Component
 *
 * Dashboard-style summary showing fulfilled/unfulfilled counts
 * with overall progress visualization.
 * Story: E6.7 - Build IRL Checklist Progress Visualization
 *
 * Features:
 * - Overall progress bar with percentage
 * - Fulfilled/unfulfilled breakdown
 * - Category count summary
 * - Responsive layout
 */

import { CheckCircle, Circle } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

export interface IRLProgressSummaryProps {
  /** Number of fulfilled items */
  fulfilled: number
  /** Number of unfulfilled items */
  unfulfilled: number
  /** Total number of items */
  total: number
  /** Completion percentage (0-100) */
  percentComplete: number
  /** Number of categories (optional) */
  categoryCount?: number
  /** Compact mode - reduces spacing */
  compact?: boolean
  /** Additional class names */
  className?: string
}

export function IRLProgressSummary({
  fulfilled,
  unfulfilled,
  total,
  percentComplete,
  categoryCount,
  compact = false,
  className,
}: IRLProgressSummaryProps) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4',
        compact && 'p-3',
        className
      )}
      data-testid="irl-progress-summary"
    >
      {/* Header with count and percentage */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={cn('font-semibold', compact ? 'text-lg' : 'text-xl')}>
            {fulfilled}/{total}
          </span>
          <span className="text-muted-foreground text-sm">items fulfilled</span>
        </div>
        <span className={cn('font-bold', compact ? 'text-lg' : 'text-2xl')}>
          {percentComplete}%
        </span>
      </div>

      {/* Progress bar */}
      <Progress
        value={percentComplete}
        className={cn('mb-3', compact ? 'h-2' : 'h-3')}
        aria-label={`${percentComplete}% complete`}
      />

      {/* Stats row */}
      <div className={cn(
        'flex gap-4 text-sm',
        compact ? 'flex-wrap gap-2' : 'flex-wrap gap-4'
      )}>
        {/* Fulfilled count */}
        <div className="flex items-center gap-1.5">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="font-medium">{fulfilled}</span>
          <span className="text-muted-foreground">fulfilled</span>
        </div>

        {/* Unfulfilled count */}
        <div className="flex items-center gap-1.5">
          <Circle className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{unfulfilled}</span>
          <span className="text-muted-foreground">unfulfilled</span>
        </div>

        {/* Category count (optional) */}
        {categoryCount !== undefined && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="font-medium text-foreground">{categoryCount}</span>
            <span>{categoryCount === 1 ? 'category' : 'categories'}</span>
          </div>
        )}
      </div>
    </div>
  )
}
