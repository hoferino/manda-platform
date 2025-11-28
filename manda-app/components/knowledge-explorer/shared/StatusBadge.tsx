/**
 * StatusBadge Component
 * Displays finding validation status
 * Story: E4.1 - Build Knowledge Explorer UI Main Interface (AC: #2)
 */

'use client'

import { cn } from '@/lib/utils'
import { getStatusInfo, type FindingStatus } from '@/lib/types/findings'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, Clock } from 'lucide-react'

interface StatusBadgeProps {
  status: FindingStatus
  showIcon?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const StatusIcons: Record<FindingStatus, typeof Clock> = {
  pending: Clock,
  validated: CheckCircle,
  rejected: XCircle,
}

const StatusColors: Record<FindingStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  validated: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
}

export function StatusBadge({
  status,
  showIcon = true,
  size = 'md',
  className,
}: StatusBadgeProps) {
  const { label } = getStatusInfo(status)
  const Icon = StatusIcons[status]
  const colorClass = StatusColors[status]

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0',
    md: 'text-sm px-2 py-0.5',
    lg: 'text-base px-2.5 py-1',
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1 font-medium border',
        colorClass,
        sizeClasses[size],
        className
      )}
    >
      {showIcon && Icon && (
        <Icon className={cn(iconSizes[size], 'flex-shrink-0')} aria-hidden="true" />
      )}
      <span>{label}</span>
    </Badge>
  )
}
