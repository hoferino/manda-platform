/**
 * ConfidenceBadge Component
 * Displays confidence score with color-coded visual indicator
 * Story: E4.1 - Build Knowledge Explorer UI Main Interface (AC: #2, #8)
 *
 * Accessibility: Uses text + percentage (not color-only) per WCAG 2.1 AA
 */

'use client'

import { cn } from '@/lib/utils'
import { getConfidenceLevel } from '@/lib/types/findings'
import { CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ConfidenceBadgeProps {
  confidence: number | null
  showIcon?: boolean
  showPercentage?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function ConfidenceBadge({
  confidence,
  showIcon = true,
  showPercentage = true,
  size = 'md',
  className,
}: ConfidenceBadgeProps) {
  const { level, label, color } = getConfidenceLevel(confidence)

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-0.5',
    lg: 'text-base px-2.5 py-1',
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }

  const Icon = level === 'high'
    ? CheckCircle2
    : level === 'medium'
      ? AlertCircle
      : level === 'low'
        ? AlertCircle
        : HelpCircle

  const percentage = confidence !== null ? Math.round(confidence * 100) : null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full font-medium',
              color,
              sizeClasses[size],
              className
            )}
            role="status"
            aria-label={`Confidence: ${label}${percentage !== null ? ` (${percentage}%)` : ''}`}
          >
            {showIcon && (
              <Icon className={cn(iconSizes[size], 'flex-shrink-0')} aria-hidden="true" />
            )}
            {showPercentage && percentage !== null ? (
              <span>{percentage}%</span>
            ) : (
              <span>{label}</span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            <strong>Confidence:</strong> {label}
            {percentage !== null && ` (${percentage}%)`}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {level === 'high' && 'High confidence - extracted with strong certainty'}
            {level === 'medium' && 'Medium confidence - may need verification'}
            {level === 'low' && 'Low confidence - requires review'}
            {level === 'unknown' && 'Confidence level not determined'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
