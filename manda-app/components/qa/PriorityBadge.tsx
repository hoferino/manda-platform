'use client'

/**
 * Priority Badge Component
 * Displays Q&A item priority with color coding
 * Story: E8.2 - Q&A Management UI with Collaborative Editing (AC: 2)
 *
 * Colors:
 * - High: Red
 * - Medium: Yellow/Amber
 * - Low: Gray
 */

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { QAPriority, getPriorityInfo } from '@/lib/types/qa'

interface PriorityBadgeProps {
  priority: QAPriority
  size?: 'sm' | 'default'
  className?: string
}

export function PriorityBadge({ priority, size = 'default', className }: PriorityBadgeProps) {
  const info = getPriorityInfo(priority)

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0',
    default: 'text-xs px-2 py-0.5',
  }

  return (
    <Badge
      variant="secondary"
      className={cn(
        sizeClasses[size],
        'font-medium',
        // Override default badge colors based on priority
        priority === 'high' && 'bg-red-100 text-red-700 hover:bg-red-100',
        priority === 'medium' && 'bg-amber-100 text-amber-700 hover:bg-amber-100',
        priority === 'low' && 'bg-gray-100 text-gray-600 hover:bg-gray-100',
        className
      )}
    >
      {info.label}
    </Badge>
  )
}
