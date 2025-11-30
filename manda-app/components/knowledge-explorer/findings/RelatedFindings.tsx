/**
 * RelatedFindings Component
 * Displays list of semantically related findings
 * Story: E4.9 - Implement Finding Detail View with Full Context (AC: 5)
 *
 * Features:
 * - List of related findings with similarity score
 * - Truncated text with expand option
 * - Clickable to navigate to finding detail
 * - Domain and confidence badges
 * - Empty state handling
 * - Accessible with ARIA attributes
 */

'use client'

import { useState, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Link2, ChevronRight, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfidenceBadge, DomainTag } from '../shared'
import type { Finding } from '@/lib/types/findings'
import { cn } from '@/lib/utils'

const MAX_TEXT_LENGTH = 150

export interface RelatedFindingWithSimilarity extends Finding {
  similarity?: number
}

export interface RelatedFindingsProps {
  findings: RelatedFindingWithSimilarity[]
  onSelectFinding: (findingId: string) => void
  isLoading?: boolean
  className?: string
}

/**
 * Similarity badge for related findings
 */
function SimilarityBadge({ similarity }: { similarity: number }) {
  const percent = Math.round(similarity * 100)
  const colorClass =
    percent >= 80
      ? 'bg-green-100 text-green-800 border-green-200'
      : percent >= 60
        ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
        : 'bg-gray-100 text-gray-800 border-gray-200'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border',
        colorClass
      )}
      title={`${percent}% similarity`}
      aria-label={`${percent}% similar`}
    >
      {percent}%
    </span>
  )
}

/**
 * Single related finding item
 */
function RelatedFindingItem({
  finding,
  onSelect,
}: {
  finding: RelatedFindingWithSimilarity
  onSelect: () => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  const shouldTruncate = finding.text.length > MAX_TEXT_LENGTH
  const displayText = shouldTruncate && !isExpanded
    ? `${finding.text.slice(0, MAX_TEXT_LENGTH)}...`
    : finding.text

  const relativeDate = formatDistanceToNow(new Date(finding.createdAt), {
    addSuffix: true,
  })

  const handleClick = useCallback(() => {
    onSelect()
  }, [onSelect])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onSelect()
      }
    },
    [onSelect]
  )

  const handleExpandClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setIsExpanded(prev => !prev)
    },
    []
  )

  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-full text-left rounded-lg border bg-card p-3',
          'transition-all duration-200',
          'hover:border-primary/50 hover:shadow-sm',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1'
        )}
        aria-label={`View related finding: ${finding.text.slice(0, 50)}...`}
      >
        {/* Header with badges */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <DomainTag domain={finding.domain} size="sm" />
            {finding.similarity !== undefined && (
              <SimilarityBadge similarity={finding.similarity} />
            )}
          </div>
          <div className="flex items-center gap-2">
            <ConfidenceBadge confidence={finding.confidence} size="sm" />
            <ChevronRight
              className="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Finding text */}
        <p className="text-sm text-foreground leading-relaxed">
          {displayText}
        </p>

        {/* Expand/collapse for long text */}
        {shouldTruncate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExpandClick}
            className="mt-1 h-6 px-1 text-xs text-muted-foreground hover:text-foreground"
            aria-label={isExpanded ? 'Show less' : 'Show more'}
          >
            {isExpanded ? 'Show less' : 'Show more'}
          </Button>
        )}

        {/* Date and source */}
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{relativeDate}</span>
          {finding.sourceDocument && (
            <span className="truncate max-w-[150px]" title={finding.sourceDocument}>
              {finding.sourceDocument}
            </span>
          )}
        </div>
      </button>
    </li>
  )
}

/**
 * Loading skeleton
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div
          key={i}
          className="rounded-lg border bg-card p-3 animate-pulse"
          aria-hidden="true"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="h-5 w-16 bg-muted rounded" />
            <div className="h-5 w-12 bg-muted rounded" />
          </div>
          <div className="h-4 w-full bg-muted rounded mb-1" />
          <div className="h-4 w-3/4 bg-muted rounded" />
        </div>
      ))}
    </div>
  )
}

export function RelatedFindings({
  findings,
  onSelectFinding,
  isLoading = false,
  className,
}: RelatedFindingsProps) {
  if (isLoading) {
    return (
      <div className={className}>
        <h4 className="mb-4 text-sm font-medium text-foreground flex items-center gap-1.5">
          <Link2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Related Findings
        </h4>
        <LoadingSkeleton />
      </div>
    )
  }

  if (findings.length === 0) {
    return (
      <div className={cn('py-6 text-center', className)}>
        <Search className="mx-auto h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
        <p className="mt-2 text-sm text-muted-foreground">
          No related findings found
        </p>
        <p className="text-xs text-muted-foreground/70">
          Related findings are discovered using semantic similarity
        </p>
      </div>
    )
  }

  return (
    <div className={className}>
      <h4 className="mb-4 text-sm font-medium text-foreground flex items-center gap-1.5">
        <Link2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        Related Findings
        <span className="ml-1 text-xs text-muted-foreground font-normal">
          ({findings.length})
        </span>
      </h4>

      <ul
        className="space-y-3"
        role="list"
        aria-label="Related findings"
      >
        {findings.map(finding => (
          <RelatedFindingItem
            key={finding.id}
            finding={finding}
            onSelect={() => onSelectFinding(finding.id)}
          />
        ))}
      </ul>
    </div>
  )
}
