/**
 * Chat ConfidenceBadge Component
 *
 * P2-compliant confidence badge that NEVER shows raw scores.
 * Displays High/Medium/Low with color coding and tooltip reasoning.
 *
 * Story: E5.7 - Implement Confidence Indicators and Uncertainty Handling
 * AC: #2 (Visual Confidence Badges), #3 (Badge Tooltip with Reasoning), #7 (P2 Compliance)
 *
 * CRITICAL: Unlike the E4 ConfidenceBadge in knowledge-explorer, this component
 * does NOT show percentages. Per P2 spec, confidence is translated to natural language.
 */

'use client'

import { cn } from '@/lib/utils'
import { CheckCircle2, AlertCircle, HelpCircle, AlertTriangle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { ConfidenceLevel, AggregatedConfidence } from '@/lib/utils/confidence'
import { getConfidenceLevelFromScore } from '@/lib/utils/confidence'
import { ConfidenceTooltipContent } from './ConfidenceTooltipContent'
import type { ConfidenceReasoning } from '@/lib/utils/confidence-reasoning'
import {
  generateConfidenceReasoning,
  generateAggregatedReasoning,
  CONFIDENCE_LEVEL_LABELS,
} from '@/lib/utils/confidence-reasoning'

/**
 * Badge style configuration per confidence level
 */
const LEVEL_STYLES: Record<ConfidenceLevel, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  high: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-400',
    icon: CheckCircle2,
  },
  medium: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-400',
    icon: AlertTriangle,
  },
  low: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-400',
    icon: AlertCircle,
  },
  unknown: {
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-600 dark:text-gray-400',
    icon: HelpCircle,
  },
}

/**
 * Short labels for badge display (P2 compliant - no numbers)
 */
const SHORT_LABELS: Record<ConfidenceLevel, string> = {
  high: 'High',
  medium: 'Moderate',
  low: 'Limited',
  unknown: 'Unknown',
}

interface ConfidenceBadgeProps {
  /**
   * Single confidence score (0-1) OR null
   * Will be converted to level internally
   */
  confidence?: number | null
  /**
   * Pre-computed confidence level
   * Takes precedence over score if provided
   */
  level?: ConfidenceLevel
  /**
   * Aggregated confidence from multiple sources
   * Takes precedence over level and confidence
   */
  aggregated?: AggregatedConfidence
  /**
   * Pre-computed reasoning for tooltip
   * If not provided, will be generated from score/level
   */
  reasoning?: ConfidenceReasoning
  /**
   * Whether to show the icon
   * @default true
   */
  showIcon?: boolean
  /**
   * Badge size variant
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg'
  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * P2-compliant confidence badge for chat messages
 *
 * Displays confidence as High/Medium/Low (never raw numbers).
 * Includes tooltip with natural language reasoning.
 *
 * @example
 * // With raw score
 * <ConfidenceBadge confidence={0.85} />
 *
 * @example
 * // With aggregated confidence
 * <ConfidenceBadge aggregated={aggregatedConfidence} />
 *
 * @example
 * // With pre-computed reasoning
 * <ConfidenceBadge level="high" reasoning={customReasoning} />
 */
export function ConfidenceBadge({
  confidence,
  level: providedLevel,
  aggregated,
  reasoning: providedReasoning,
  showIcon = true,
  size = 'md',
  className,
}: ConfidenceBadgeProps) {
  // Determine confidence level (priority: aggregated > provided level > score)
  let level: ConfidenceLevel
  let reasoning: ConfidenceReasoning

  if (aggregated) {
    level = aggregated.level
    reasoning = providedReasoning || generateAggregatedReasoning(aggregated)
  } else if (providedLevel) {
    level = providedLevel
    reasoning = providedReasoning || generateConfidenceReasoning(
      level === 'high' ? 0.9 :
      level === 'medium' ? 0.7 :
      level === 'low' ? 0.4 : null
    )
  } else {
    level = getConfidenceLevelFromScore(confidence ?? null)
    reasoning = providedReasoning || generateConfidenceReasoning(confidence ?? null)
  }

  const styles = LEVEL_STYLES[level]
  const Icon = styles.icon

  // Size classes
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5 gap-1',
    md: 'text-sm px-2 py-0.5 gap-1.5',
    lg: 'text-base px-2.5 py-1 gap-2',
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center rounded-full font-medium cursor-help',
              styles.bg,
              styles.text,
              sizeClasses[size],
              className
            )}
            role="status"
            aria-label={`${CONFIDENCE_LEVEL_LABELS[level]}: ${reasoning.description}`}
          >
            {showIcon && (
              <Icon
                className={cn(iconSizes[size], 'flex-shrink-0')}
                aria-hidden="true"
              />
            )}
            <span>{SHORT_LABELS[level]}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          className="max-w-xs p-0"
        >
          <ConfidenceTooltipContent reasoning={reasoning} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
