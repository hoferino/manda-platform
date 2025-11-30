/**
 * ConfidenceReasoning Component
 * Displays confidence score with visual bar and reasoning explanation
 * Story: E4.9 - Implement Finding Detail View with Full Context (AC: 3)
 *
 * Features:
 * - Visual confidence bar with percentage
 * - Expandable/collapsible reasoning text (>200 chars)
 * - Graceful handling of missing reasoning
 * - Accessible with ARIA attributes
 */

'use client'

import { useState, useCallback } from 'react'
import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const TRUNCATE_LENGTH = 200

export interface ConfidenceReasoningProps {
  confidence: number | null
  reasoning: string | null | undefined
  className?: string
}

/**
 * Get confidence level configuration
 */
function getConfidenceConfig(confidence: number | null) {
  if (confidence === null) {
    return {
      label: 'Unknown',
      color: 'bg-gray-400',
      textColor: 'text-gray-600',
    }
  }

  if (confidence >= 0.8) {
    return {
      label: 'High',
      color: 'bg-green-500',
      textColor: 'text-green-700',
    }
  }

  if (confidence >= 0.6) {
    return {
      label: 'Medium',
      color: 'bg-yellow-500',
      textColor: 'text-yellow-700',
    }
  }

  return {
    label: 'Low',
    color: 'bg-red-500',
    textColor: 'text-red-700',
  }
}

export function ConfidenceReasoning({
  confidence,
  reasoning,
  className,
}: ConfidenceReasoningProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const config = getConfidenceConfig(confidence)
  const percentage = confidence !== null ? Math.round(confidence * 100) : null

  const hasReasoning = reasoning && reasoning.trim().length > 0
  const shouldTruncate = hasReasoning && reasoning.length > TRUNCATE_LENGTH
  const displayReasoning = shouldTruncate && !isExpanded
    ? `${reasoning.slice(0, TRUNCATE_LENGTH)}...`
    : reasoning

  const toggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev)
  }, [])

  return (
    <div className={cn('space-y-3', className)}>
      {/* Confidence Score Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            Confidence Score
          </span>
          <span className={cn('text-sm font-semibold', config.textColor)}>
            {percentage !== null ? `${percentage}%` : 'N/A'} ({config.label})
          </span>
        </div>

        {/* Visual Bar */}
        <div
          className="h-2 w-full rounded-full bg-muted overflow-hidden"
          role="progressbar"
          aria-valuenow={percentage ?? undefined}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Confidence: ${percentage !== null ? `${percentage}%` : 'unknown'}`}
        >
          <div
            className={cn('h-full rounded-full transition-all duration-300', config.color)}
            style={{ width: percentage !== null ? `${percentage}%` : '0%' }}
          />
        </div>
      </div>

      {/* Reasoning Section */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-1.5">
          <Info className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Confidence Reasoning
        </h4>

        {hasReasoning ? (
          <div className="space-y-2">
            <p
              className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap"
              aria-expanded={shouldTruncate ? isExpanded : undefined}
            >
              {displayReasoning}
            </p>

            {shouldTruncate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleExpand}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                aria-label={isExpanded ? 'Show less reasoning' : 'Show more reasoning'}
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="mr-1 h-3 w-3" aria-hidden="true" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1 h-3 w-3" aria-hidden="true" />
                    Show more
                  </>
                )}
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No reasoning available
          </p>
        )}
      </div>
    </div>
  )
}
