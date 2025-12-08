'use client'

/**
 * ReviewQueuePanel Component
 *
 * Panel displaying items that need review due to correction propagation.
 * Story: E7.6 - Propagate Corrections to Related Insights (AC: #3)
 *
 * Features:
 * - List of all items flagged for review (findings, Q&A answers, CIM sections)
 * - Filter by item type
 * - Dismiss (clear review flag) action
 * - Regenerate action for Q&A and CIM
 * - Link to source item for context
 */

import React, { useState, useEffect, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertTriangle,
  RefreshCw,
  X,
  FileText,
  MessageSquare,
  BookOpen,
  Lightbulb,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReviewQueueItem, ReviewQueueCount } from '@/lib/services/correction-propagation'

export interface ReviewQueuePanelProps {
  projectId: string
  className?: string
  /** Maximum items to show (default 10) */
  maxItems?: number
  /** Whether to show "View All" link */
  showViewAll?: boolean
  /** Callback when "View All" is clicked */
  onViewAll?: () => void
}

type ItemType = 'all' | 'finding' | 'qa_answer' | 'cim_section' | 'insight'

const typeIcons: Record<string, React.ElementType> = {
  finding: FileText,
  qa_answer: MessageSquare,
  cim_section: BookOpen,
  insight: Lightbulb,
}

const typeLabels: Record<string, string> = {
  finding: 'Finding',
  qa_answer: 'Q&A Answer',
  cim_section: 'CIM Section',
  insight: 'Insight',
}

/**
 * Single review queue item card
 */
function ReviewQueueItemCard({
  item,
  projectId,
  onDismiss,
  onRegenerate,
  isLoading,
}: {
  item: ReviewQueueItem
  projectId: string
  onDismiss: (item: ReviewQueueItem) => void
  onRegenerate?: (item: ReviewQueueItem) => void
  isLoading?: boolean
}) {
  const Icon = typeIcons[item.type] || FileText
  const canRegenerate = item.type === 'qa_answer' || item.type === 'cim_section'

  return (
    <Card className="mb-3 last:mb-0">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Type Icon */}
          <div
            className={cn(
              'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
              'bg-amber-100 text-amber-600'
            )}
          >
            <Icon className="h-4 w-4" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs">
                {typeLabels[item.type]}
              </Badge>
              {item.domain && (
                <Badge variant="secondary" className="text-xs">
                  {item.domain}
                </Badge>
              )}
            </div>

            <p className="text-sm font-medium text-foreground line-clamp-2">
              {item.title}
            </p>

            <p className="text-xs text-muted-foreground mt-1">
              {item.reviewReason}
            </p>

            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {canRegenerate && onRegenerate && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onRegenerate(item)}
                    disabled={isLoading}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Regenerate
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => onDismiss(item)}
                  disabled={isLoading}
                >
                  <X className="h-3 w-3 mr-1" />
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Loading skeleton for review queue
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/**
 * Empty state when no items need review
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
        <AlertTriangle className="h-6 w-6 text-green-600" />
      </div>
      <h3 className="text-sm font-medium text-foreground mb-1">All Clear!</h3>
      <p className="text-xs text-muted-foreground">
        No items currently need review.
      </p>
    </div>
  )
}

export function ReviewQueuePanel({
  projectId,
  className,
  maxItems = 10,
  showViewAll = true,
  onViewAll,
}: ReviewQueuePanelProps) {
  const [items, setItems] = useState<ReviewQueueItem[]>([])
  const [counts, setCounts] = useState<ReviewQueueCount | null>(null)
  const [filter, setFilter] = useState<ItemType>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [isActionLoading, setIsActionLoading] = useState(false)

  // Fetch review queue items
  const fetchItems = useCallback(async () => {
    setIsLoading(true)
    try {
      const typeParam = filter !== 'all' ? `&type=${filter}` : ''
      const response = await fetch(
        `/api/projects/${projectId}/review-queue?limit=${maxItems}${typeParam}`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch review queue')
      }

      const data = await response.json()
      setItems(data.items || [])

      // Also fetch counts
      const countsResponse = await fetch(
        `/api/projects/${projectId}/review-queue?countOnly=true`
      )
      if (countsResponse.ok) {
        const countsData = await countsResponse.json()
        setCounts(countsData.counts)
      }
    } catch (error) {
      console.error('Error fetching review queue:', error)
    } finally {
      setIsLoading(false)
    }
  }, [projectId, filter, maxItems])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // Handle dismiss action
  const handleDismiss = async (item: ReviewQueueItem) => {
    setIsActionLoading(true)
    try {
      const response = await fetch(
        `/api/projects/${projectId}/review-queue/${item.id}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: item.type }),
        }
      )

      if (response.ok) {
        // Remove item from list
        setItems((prev) => prev.filter((i) => i.id !== item.id))
        // Update counts
        if (counts) {
          setCounts({
            ...counts,
            [item.type === 'qa_answer' ? 'qaAnswers' : item.type === 'cim_section' ? 'cimSections' : item.type === 'insight' ? 'insights' : 'findings']:
              Math.max(0, (counts[item.type === 'qa_answer' ? 'qaAnswers' : item.type === 'cim_section' ? 'cimSections' : item.type === 'insight' ? 'insights' : 'findings'] || 0) - 1),
            total: Math.max(0, counts.total - 1),
          })
        }
      }
    } catch (error) {
      console.error('Error dismissing item:', error)
    } finally {
      setIsActionLoading(false)
    }
  }

  // Handle regenerate action
  const handleRegenerate = async (item: ReviewQueueItem) => {
    setIsActionLoading(true)
    try {
      const response = await fetch(
        `/api/projects/${projectId}/review-queue/${item.id}/regenerate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: item.type, autoApply: true }),
        }
      )

      if (response.ok) {
        // Remove item from list after regeneration
        setItems((prev) => prev.filter((i) => i.id !== item.id))
        // Update counts
        if (counts) {
          const countKey = item.type === 'qa_answer' ? 'qaAnswers' : 'cimSections'
          setCounts({
            ...counts,
            [countKey]: Math.max(0, (counts[countKey] || 0) - 1),
            total: Math.max(0, counts.total - 1),
          })
        }
      }
    } catch (error) {
      console.error('Error regenerating item:', error)
    } finally {
      setIsActionLoading(false)
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Review Queue
            {counts && counts.total > 0 && (
              <Badge
                variant="destructive"
                className="bg-amber-500 hover:bg-amber-600 ml-1"
              >
                {counts.total}
              </Badge>
            )}
          </CardTitle>

          <Select
            value={filter}
            onValueChange={(value) => setFilter(value as ItemType)}
          >
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="finding">Findings</SelectItem>
              <SelectItem value="qa_answer">Q&A</SelectItem>
              <SelectItem value="cim_section">CIM</SelectItem>
              <SelectItem value="insight">Insights</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {isLoading ? (
          <LoadingSkeleton />
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <ScrollArea className="max-h-[400px]">
              {items.map((item) => (
                <ReviewQueueItemCard
                  key={`${item.type}-${item.id}`}
                  item={item}
                  projectId={projectId}
                  onDismiss={handleDismiss}
                  onRegenerate={handleRegenerate}
                  isLoading={isActionLoading}
                />
              ))}
            </ScrollArea>

            {showViewAll && counts && counts.total > maxItems && (
              <Button
                variant="ghost"
                className="w-full mt-3 text-sm"
                onClick={onViewAll}
              >
                View all {counts.total} items
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default ReviewQueuePanel
