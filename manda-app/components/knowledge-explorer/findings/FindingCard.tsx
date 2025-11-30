/**
 * FindingCard Component
 * Card view alternative for displaying findings
 * Story: E4.4 - Build Card View Alternative for Findings (AC: 1, 4, 5)
 * Story: E4.5 - Implement Source Attribution Links (AC: 7)
 *
 * Features:
 * - Card layout with finding text, domain, confidence, status, source
 * - Truncated text display (200 chars) with expand capability
 * - Relative date formatting using date-fns
 * - Hover elevation effect
 * - Integration with FindingActions for validate/reject/edit
 * - Keyboard navigation (Enter expand, Escape collapse)
 * - ARIA labels and screen reader support
 * - Clickable source attribution links with preview modal
 */

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConfidenceBadge, DomainTag, StatusBadge, SourceAttributionLink } from '../shared'
import { FindingActions } from './FindingActions'
import { InlineEdit } from './InlineEdit'
import { ChevronDown, ChevronUp, FileText, Calendar } from 'lucide-react'
import type { Finding, FindingWithSimilarity } from '@/lib/types/findings'
import { cn } from '@/lib/utils'

const MAX_TEXT_LENGTH = 200

export interface FindingCardProps {
  finding: Finding | FindingWithSimilarity
  onValidate: (findingId: string, action: 'confirm' | 'reject') => Promise<void>
  onEdit: (finding: Finding) => void
  onSaveEdit: (newText: string) => Promise<void>
  onCancelEdit: () => void
  isEditing?: boolean
  showSimilarity?: boolean
  className?: string
  projectId: string
}

/**
 * Similarity badge for search results (matching FindingsTable pattern)
 */
function SimilarityBadge({ similarity }: { similarity: number }) {
  const percent = Math.round(similarity * 100)
  const colorClass =
    percent >= 80
      ? 'bg-green-100 text-green-800'
      : percent >= 60
        ? 'bg-yellow-100 text-yellow-800'
        : 'bg-gray-100 text-gray-800'

  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', colorClass)}
      title={`${percent}% match`}
      aria-label={`${percent}% relevance match`}
    >
      {percent}% match
    </span>
  )
}

/**
 * Source attribution component for card view - uses SourceAttributionLink for clickable links
 */
function SourceAttributionCell({
  finding,
  projectId,
  className,
}: {
  finding: Finding | FindingWithSimilarity
  projectId: string
  className?: string
}) {
  if (!finding.sourceDocument && !finding.documentId) {
    return null
  }

  // If we have a documentId, use the clickable SourceAttributionLink
  if (finding.documentId) {
    return (
      <div className={className}>
        <SourceAttributionLink
          documentId={finding.documentId}
          documentName={finding.sourceDocument || 'Unknown document'}
          chunkId={finding.chunkId}
          pageNumber={finding.pageNumber}
          sheetName={null} // Will be fetched from chunk API if needed
          cellReference={null} // Will be fetched from chunk API if needed
          projectId={projectId}
        />
      </div>
    )
  }

  // Fallback: show plain text if no documentId (e.g., manually created findings)
  return (
    <div className={cn('flex items-center gap-1.5 text-sm text-muted-foreground', className)}>
      <FileText className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
      <span className="truncate" title={finding.sourceDocument || undefined}>
        {finding.sourceDocument}
      </span>
      {finding.pageNumber && (
        <span className="text-xs whitespace-nowrap">p.{finding.pageNumber}</span>
      )}
    </div>
  )
}

export function FindingCard({
  finding,
  onValidate,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  isEditing = false,
  showSimilarity = false,
  className,
  projectId,
}: FindingCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const shouldTruncate = finding.text.length > MAX_TEXT_LENGTH
  const displayText = !shouldTruncate || isExpanded
    ? finding.text
    : `${finding.text.slice(0, MAX_TEXT_LENGTH)}...`

  const similarity = 'similarity' in finding ? finding.similarity : undefined
  const showSimilarityBadge = showSimilarity && similarity !== undefined

  // Format relative date
  const relativeDate = formatDistanceToNow(new Date(finding.createdAt), { addSuffix: true })

  // Toggle expand/collapse
  const toggleExpand = useCallback(() => {
    if (shouldTruncate) {
      setIsExpanded((prev) => !prev)
    }
  }, [shouldTruncate])

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.target !== cardRef.current && e.target !== e.currentTarget) {
        // Don't handle if the event is from a child element like a button
        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        toggleExpand()
      }
      if (e.key === 'Escape' && isExpanded) {
        e.preventDefault()
        setIsExpanded(false)
      }
    },
    [toggleExpand, isExpanded]
  )

  // Handle edit click wrapper
  const handleEditClick = useCallback(() => {
    onEdit(finding)
  }, [finding, onEdit])

  return (
    <Card
      ref={cardRef}
      className={cn(
        'group relative transition-all duration-200',
        'hover:shadow-md hover:-translate-y-0.5',
        'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        isExpanded && 'ring-2 ring-primary/20',
        className
      )}
      tabIndex={0}
      role="article"
      aria-label={`Finding: ${finding.text.slice(0, 50)}...`}
      aria-expanded={shouldTruncate ? isExpanded : undefined}
      onKeyDown={handleKeyDown}
    >
      {/* Header with badges */}
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <DomainTag domain={finding.domain} size="sm" />
            <StatusBadge status={finding.status} size="sm" />
            {showSimilarityBadge && <SimilarityBadge similarity={similarity!} />}
          </div>
          <ConfidenceBadge confidence={finding.confidence} size="sm" showPercentage />
        </div>
      </CardHeader>

      {/* Content */}
      <CardContent className="px-4 py-2">
        {isEditing ? (
          <InlineEdit
            value={finding.text}
            onSave={onSaveEdit}
            onCancel={onCancelEdit}
            isEditing={true}
          />
        ) : (
          <div
            className={cn(
              'cursor-pointer',
              shouldTruncate && 'hover:text-foreground/80'
            )}
            onClick={toggleExpand}
            role={shouldTruncate ? 'button' : undefined}
            aria-label={shouldTruncate ? (isExpanded ? 'Collapse text' : 'Expand text') : undefined}
          >
            <p className="text-sm leading-relaxed">{displayText}</p>

            {/* Expand/collapse indicator */}
            {shouldTruncate && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleExpand()
                }}
                aria-label={isExpanded ? 'Show less' : 'Show more'}
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="mr-1 h-3 w-3" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1 h-3 w-3" />
                    Show more
                  </>
                )}
              </Button>
            )}

            {/* Source attribution (shown when expanded) */}
            {isExpanded && (
              <div className="mt-3 pt-3 border-t">
                <SourceAttributionCell
                  finding={finding}
                  projectId={projectId}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Footer with metadata and actions */}
      <CardFooter className="px-4 py-3 border-t flex items-center justify-between">
        {/* Date */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" aria-hidden="true" />
          <time dateTime={finding.createdAt} title={new Date(finding.createdAt).toLocaleString()}>
            {relativeDate}
          </time>
        </div>

        {/* Actions - always visible on mobile, hover on desktop */}
        <div
          className={cn(
            'transition-opacity duration-200',
            'md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100'
          )}
        >
          <FindingActions
            findingId={finding.id}
            status={finding.status}
            onValidate={onValidate}
            onEdit={handleEditClick}
          />
        </div>
      </CardFooter>
    </Card>
  )
}
