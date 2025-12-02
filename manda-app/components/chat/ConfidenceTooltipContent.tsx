/**
 * ConfidenceTooltipContent Component
 *
 * Rich tooltip content for confidence badges.
 * Shows contributing factors and range explanations in natural language.
 *
 * Story: E5.7 - Implement Confidence Indicators and Uncertainty Handling
 * AC: #3 (Badge Tooltip with Reasoning), #7 (P2 Compliance - No Raw Scores)
 *
 * Reference: docs/agent-behavior-spec.md P2 Confidence Factor table
 */

'use client'

import { cn } from '@/lib/utils'
import { Info, FileText, AlertTriangle } from 'lucide-react'
import type { ConfidenceReasoning } from '@/lib/utils/confidence-reasoning'

interface ConfidenceTooltipContentProps {
  /**
   * Pre-computed reasoning from confidence-reasoning utilities
   */
  reasoning: ConfidenceReasoning
  /**
   * Additional CSS classes for the container
   */
  className?: string
}

/**
 * Level indicator colors for the small colored bar
 */
const LEVEL_INDICATOR_COLORS: Record<string, string> = {
  high: 'bg-green-500',
  medium: 'bg-yellow-500',
  low: 'bg-red-500',
  unknown: 'bg-gray-400',
}

/**
 * Rich tooltip content component for confidence badges
 *
 * Displays:
 * - Main confidence label (High/Medium/Low)
 * - Brief description
 * - Contributing factors as a list
 * - Range explanation if multiple sources
 *
 * @example
 * <ConfidenceTooltipContent
 *   reasoning={{
 *     label: "High confidence",
 *     description: "Based on authoritative sources...",
 *     factors: ["from the audited financials", "corroborated by 3 sources"],
 *     level: "high"
 *   }}
 * />
 */
export function ConfidenceTooltipContent({
  reasoning,
  className,
}: ConfidenceTooltipContentProps) {
  const { label, description, factors, rangeExplanation, level } = reasoning

  return (
    <div
      className={cn(
        'p-3 text-sm max-w-[280px]',
        className
      )}
      role="tooltip"
      aria-label={`${label}: ${description}`}
    >
      {/* Header with level indicator */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn(
            'w-2 h-2 rounded-full flex-shrink-0',
            LEVEL_INDICATOR_COLORS[level]
          )}
          aria-hidden="true"
        />
        <span className="font-semibold">{label}</span>
      </div>

      {/* Description */}
      <p className="text-muted-foreground text-xs mb-2">
        {description}
      </p>

      {/* Contributing factors */}
      {factors && factors.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Info className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            <span>Contributing factors:</span>
          </div>
          <ul className="space-y-1 ml-4" aria-label="Contributing factors">
            {factors.map((factor, index) => (
              <li
                key={index}
                className="text-xs text-foreground flex items-start gap-1.5"
              >
                <span className="text-muted-foreground mt-1.5" aria-hidden="true">•</span>
                <span>{factor}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Range explanation for multiple sources */}
      {rangeExplanation && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <div className="flex items-start gap-1.5">
            <FileText
              className="h-3 w-3 flex-shrink-0 mt-0.5 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-xs text-muted-foreground">
              {rangeExplanation}
            </p>
          </div>
        </div>
      )}

      {/* Low confidence warning */}
      {level === 'low' && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <div className="flex items-start gap-1.5 text-amber-600 dark:text-amber-400">
            <AlertTriangle
              className="h-3 w-3 flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <p className="text-xs">
              This information may require additional verification.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
