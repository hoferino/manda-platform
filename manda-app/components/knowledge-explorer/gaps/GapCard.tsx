/**
 * GapCard Component
 * Displays a single gap with its details and actions
 * Story: E4.8 - Build Gap Analysis View (AC: #4, #5, #6, #7)
 *
 * Features:
 * - Category badge (IRL Missing, Information Gap, Incomplete Analysis)
 * - Priority indicator (High, Medium, Low with colors)
 * - Status badge (Active, Resolved, N/A)
 * - Gap description
 * - Source information (IRL category or domain)
 * - Domain tag for information gaps
 * - Action buttons for resolution
 * - Expand/collapse for IRL item details
 */

'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GapActions } from './GapActions'
import { DomainTag } from '../shared'
import {
  FileQuestion,
  AlertCircle,
  BarChart3,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Folder,
} from 'lucide-react'
import type { Gap, GapCategory, GapStatus } from '@/lib/types/gaps'
import { getGapCategoryInfo, getGapPriorityInfo, getGapStatusInfo } from '@/lib/types/gaps'
import { cn } from '@/lib/utils'

export interface GapCardProps {
  gap: Gap
  projectId: string
  onResolve: (gapId: string, status: GapStatus, note?: string) => Promise<void>
  onUndo: (gapId: string) => Promise<void>
  className?: string
}

/**
 * Get icon for gap category
 */
function getCategoryIcon(category: GapCategory) {
  switch (category) {
    case 'irl_missing':
      return FileQuestion
    case 'information_gap':
      return AlertCircle
    case 'incomplete_analysis':
      return BarChart3
    default:
      return AlertCircle
  }
}

/**
 * IRL Item details panel
 */
function IrlItemDetails({
  irlItem,
  isExpanded,
}: {
  irlItem: NonNullable<Gap['relatedIrlItem']>
  isExpanded: boolean
}) {
  if (!isExpanded) return null

  return (
    <div className="mt-3 p-3 bg-muted rounded-lg">
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <Folder className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">IRL Category:</span>
          <span className="font-medium">{irlItem.category}</span>
        </div>
        {irlItem.description && (
          <div className="pl-6">
            <span className="text-muted-foreground">Description:</span>{' '}
            <span>{irlItem.description}</span>
          </div>
        )}
        <div className="pl-6">
          <span className="text-muted-foreground">Required:</span>{' '}
          <Badge variant={irlItem.required ? 'destructive' : 'secondary'} className="text-xs">
            {irlItem.required ? 'Required' : 'Optional'}
          </Badge>
        </div>
      </div>
    </div>
  )
}

export function GapCard({ gap, projectId, onResolve, onUndo, className }: GapCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const categoryInfo = getGapCategoryInfo(gap.category)
  const priorityInfo = getGapPriorityInfo(gap.priority)
  const statusInfo = getGapStatusInfo(gap.status)
  const CategoryIcon = getCategoryIcon(gap.category)

  const isResolved = gap.status === 'resolved' || gap.status === 'not_applicable'

  // Handle resolution
  const handleResolve = useCallback(
    async (newStatus: GapStatus, note?: string) => {
      setIsLoading(true)
      try {
        await onResolve(gap.id, newStatus, note)
      } finally {
        setIsLoading(false)
      }
    },
    [gap.id, onResolve]
  )

  // Handle undo
  const handleUndo = useCallback(async () => {
    setIsLoading(true)
    try {
      await onUndo(gap.id)
    } finally {
      setIsLoading(false)
    }
  }, [gap.id, onUndo])

  return (
    <Card
      className={cn(
        'transition-all duration-200',
        isResolved && 'opacity-70',
        'hover:shadow-md',
        'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        className
      )}
      role="article"
      aria-label={`${categoryInfo.label}: ${gap.description}`}
    >
      {/* Header with badges */}
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* Left side: Category and Priority */}
          <div className="flex items-center gap-3">
            <CategoryIcon
              className={cn('h-5 w-5', categoryInfo.color)}
              aria-hidden="true"
            />
            <Badge
              variant="outline"
              className={cn('text-xs', categoryInfo.color, categoryInfo.bgColor)}
            >
              {categoryInfo.label}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                'text-xs font-medium',
                priorityInfo.textColor,
                priorityInfo.bgColor
              )}
            >
              {priorityInfo.label} Priority
            </Badge>
          </div>

          {/* Right side: Status */}
          <Badge
            variant="secondary"
            className={cn('text-xs', statusInfo.color, statusInfo.bgColor)}
          >
            {gap.status === 'resolved' && <CheckCircle className="mr-1 h-3 w-3" />}
            {gap.status === 'not_applicable' && <XCircle className="mr-1 h-3 w-3" />}
            {statusInfo.label}
          </Badge>
        </div>
      </CardHeader>

      {/* Content */}
      <CardContent className="px-4 py-3">
        {/* Gap description */}
        <p className="text-sm leading-relaxed mb-2">{gap.description}</p>

        {/* Source info */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Source:</span>
          <span className="font-medium">{gap.source}</span>
        </div>

        {/* Domain tag for information gaps */}
        {gap.domain && (
          <div className="mt-2">
            <DomainTag domain={gap.domain} size="sm" />
          </div>
        )}

        {/* Metadata for information gaps */}
        {gap.metadata && 'findingsCount' in gap.metadata && (
          <div className="mt-2 text-xs text-muted-foreground">
            <span>
              Current findings: {String(gap.metadata.findingsCount)} / Expected:{' '}
              {String(gap.metadata.expectedMinimum)}
            </span>
          </div>
        )}

        {/* IRL item expand/collapse */}
        {gap.relatedIrlItem && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setIsExpanded((prev) => !prev)}
              aria-expanded={isExpanded}
              aria-controls={`irl-details-${gap.id}`}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="mr-1 h-3 w-3" />
                  Hide IRL Details
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1 h-3 w-3" />
                  Show IRL Details
                </>
              )}
            </Button>

            <div id={`irl-details-${gap.id}`}>
              <IrlItemDetails irlItem={gap.relatedIrlItem} isExpanded={isExpanded} />
            </div>
          </>
        )}
      </CardContent>

      {/* Footer with actions */}
      <CardFooter className="px-4 py-3 border-t">
        <GapActions
          gap={gap}
          projectId={projectId}
          onResolve={handleResolve}
          onUndo={handleUndo}
          isLoading={isLoading}
        />
      </CardFooter>
    </Card>
  )
}
