/**
 * Processing Status Badge Component
 * Displays document processing status with color-coded badges and icons
 * Story: E3.6 - Create Processing Status Tracking and WebSocket Updates (AC: #1)
 *
 * Features:
 * - Color-coded badges: gray (pending), blue/animated (processing), green (complete), red (failed)
 * - Animated pulse/spin for in-progress states
 * - Different sizes (sm, md) for list vs card views
 * - Supports all pipeline statuses: pending, parsing, parsed, embedding, analyzing, analyzed, complete, failed, analysis_failed
 */

'use client'

import { Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { ProcessingStatus } from '@/lib/api/documents'

export interface ProcessingStatusBadgeProps {
  status: ProcessingStatus
  size?: 'sm' | 'md'
  showLabel?: boolean
  className?: string
}

/**
 * Configuration for each processing status
 * Defines label, colors, icon, and animation
 */
const statusConfig: Record<
  ProcessingStatus,
  {
    label: string
    color: string
    icon: typeof Loader2
    animate?: boolean
    badgeVariant: 'outline' | 'secondary' | 'destructive'
  }
> = {
  pending: {
    label: 'Pending',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: Clock,
    badgeVariant: 'outline',
  },
  parsing: {
    label: 'Parsing',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: Loader2,
    animate: true,
    badgeVariant: 'secondary',
  },
  parsed: {
    label: 'Parsed',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: CheckCircle2,
    badgeVariant: 'secondary',
  },
  embedding: {
    label: 'Embedding',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: Loader2,
    animate: true,
    badgeVariant: 'secondary',
  },
  analyzing: {
    label: 'Analyzing',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: Loader2,
    animate: true,
    badgeVariant: 'secondary',
  },
  analyzed: {
    label: 'Analyzed',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: CheckCircle2,
    badgeVariant: 'secondary',
  },
  complete: {
    label: 'Complete',
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: CheckCircle2,
    badgeVariant: 'secondary',
  },
  failed: {
    label: 'Failed',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: AlertCircle,
    badgeVariant: 'destructive',
  },
  analysis_failed: {
    label: 'Analysis Failed',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: AlertCircle,
    badgeVariant: 'destructive',
  },
}

/**
 * Size configurations
 */
const sizeConfig = {
  sm: {
    iconSize: 'h-3 w-3',
    badgeClass: 'text-xs px-1.5 py-0',
    gap: 'gap-1',
  },
  md: {
    iconSize: 'h-4 w-4',
    badgeClass: 'text-sm px-2 py-0.5',
    gap: 'gap-1.5',
  },
}

/**
 * Processing Status Badge Component
 * Displays processing status with appropriate styling
 */
export function ProcessingStatusBadge({
  status,
  size = 'sm',
  showLabel = true,
  className,
}: ProcessingStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending
  const sizeStyles = sizeConfig[size]
  const Icon = config.icon

  return (
    <Badge
      variant={config.badgeVariant}
      className={cn(
        'flex items-center',
        sizeStyles.badgeClass,
        sizeStyles.gap,
        config.color,
        className
      )}
    >
      <Icon
        className={cn(
          sizeStyles.iconSize,
          config.animate && 'animate-spin'
        )}
      />
      {showLabel && <span>{config.label}</span>}
    </Badge>
  )
}

/**
 * Check if a status is an in-progress status (for filtering/display logic)
 */
export function isProcessingInProgress(status: ProcessingStatus): boolean {
  return ['parsing', 'embedding', 'analyzing'].includes(status)
}

/**
 * Check if a status is a completed status
 */
export function isProcessingComplete(status: ProcessingStatus): boolean {
  return status === 'complete'
}

/**
 * Check if a status is a failed status
 */
export function isProcessingFailed(status: ProcessingStatus): boolean {
  return status === 'failed' || status === 'analysis_failed'
}

/**
 * Get user-friendly status description
 */
export function getStatusDescription(status: ProcessingStatus): string {
  const descriptions: Record<ProcessingStatus, string> = {
    pending: 'Waiting to start processing',
    parsing: 'Extracting text and structure from document',
    parsed: 'Document parsed, waiting for embedding',
    embedding: 'Generating semantic embeddings',
    analyzing: 'AI analyzing document content',
    analyzed: 'Analysis complete, finalizing',
    complete: 'All processing complete',
    failed: 'Processing failed',
    analysis_failed: 'AI analysis failed',
  }
  return descriptions[status] || 'Unknown status'
}
