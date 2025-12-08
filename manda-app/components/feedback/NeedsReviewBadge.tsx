'use client'

/**
 * NeedsReviewBadge Component
 *
 * Visual indicator for items flagged for review due to correction propagation.
 * Story: E7.6 - Propagate Corrections to Related Insights (AC: #3)
 *
 * Features:
 * - Yellow/orange badge indicating review needed
 * - Tooltip showing the review reason
 * - Optional count display for aggregate views
 */

import React from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface NeedsReviewBadgeProps {
  /** Whether to show the badge */
  show?: boolean
  /** The reason this item needs review */
  reason?: string
  /** Optional count for aggregate displays */
  count?: number
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Whether to show the refresh icon (indicates regeneration available) */
  showRefreshIcon?: boolean
  /** Custom className */
  className?: string
  /** Click handler */
  onClick?: () => void
}

const sizeStyles = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xs px-2 py-0.5',
  lg: 'text-sm px-2.5 py-1',
}

const iconSizes = {
  sm: 10,
  md: 12,
  lg: 14,
}

export function NeedsReviewBadge({
  show = true,
  reason,
  count,
  size = 'md',
  showRefreshIcon = false,
  className,
  onClick,
}: NeedsReviewBadgeProps) {
  if (!show) return null

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        'border-amber-500 bg-amber-50 text-amber-700 hover:bg-amber-100',
        'dark:border-amber-400 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900',
        'cursor-default inline-flex items-center gap-1',
        sizeStyles[size],
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      <AlertTriangle size={iconSizes[size]} className="shrink-0" />
      <span>
        {count !== undefined ? `${count} need${count === 1 ? 's' : ''} review` : 'Needs Review'}
      </span>
      {showRefreshIcon && (
        <RefreshCw size={iconSizes[size]} className="shrink-0 ml-0.5" />
      )}
    </Badge>
  )

  if (!reason) return badge

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-sm">{reason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Review count badge for navigation/headers
 * Shows total count of items needing review
 */
export interface ReviewCountBadgeProps {
  /** Total count of items needing review */
  count: number
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Custom className */
  className?: string
  /** Click handler */
  onClick?: () => void
}

export function ReviewCountBadge({
  count,
  size = 'sm',
  className,
  onClick,
}: ReviewCountBadgeProps) {
  if (count === 0) return null

  return (
    <Badge
      variant="destructive"
      className={cn(
        'bg-amber-500 hover:bg-amber-600 text-white',
        'rounded-full min-w-[1.25rem] h-5 flex items-center justify-center',
        sizeStyles[size],
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {count > 99 ? '99+' : count}
    </Badge>
  )
}

export default NeedsReviewBadge
