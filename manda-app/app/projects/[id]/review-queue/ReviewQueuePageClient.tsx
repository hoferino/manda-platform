'use client'

/**
 * Review Queue Page Client Component
 *
 * Full page view of items flagged for review due to correction propagation.
 * Story: E7.6 - Propagate Corrections to Related Insights (AC: #3)
 *
 * Features:
 * - Full list of all review items with pagination
 * - Filter by type
 * - Bulk dismiss/regenerate actions
 * - Detailed view of each item
 */

import React, { useState, useEffect, useCallback } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertTriangle,
  RefreshCw,
  X,
  FileText,
  MessageSquare,
  BookOpen,
  Lightbulb,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReviewQueueItem, ReviewQueueCount } from '@/lib/services/correction-propagation'

interface ReviewQueuePageClientProps {
  projectId: string
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

const typeBadgeColors: Record<string, string> = {
  finding: 'bg-blue-100 text-blue-800 border-blue-200',
  qa_answer: 'bg-purple-100 text-purple-800 border-purple-200',
  cim_section: 'bg-green-100 text-green-800 border-green-200',
  insight: 'bg-amber-100 text-amber-800 border-amber-200',
}

/**
 * Stats summary cards
 */
function StatCards({ counts }: { counts: ReviewQueueCount }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <Card>
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-amber-600">{counts.total}</div>
          <p className="text-xs text-muted-foreground">Total Items</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" />
            <span className="text-2xl font-bold">{counts.findings}</span>
          </div>
          <p className="text-xs text-muted-foreground">Findings</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-purple-500" />
            <span className="text-2xl font-bold">{counts.qaAnswers}</span>
          </div>
          <p className="text-xs text-muted-foreground">Q&A Answers</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-green-500" />
            <span className="text-2xl font-bold">{counts.cimSections}</span>
          </div>
          <p className="text-xs text-muted-foreground">CIM Sections</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <span className="text-2xl font-bold">{counts.insights}</span>
          </div>
          <p className="text-xs text-muted-foreground">Insights</p>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Loading skeleton
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-[400px]" />
    </div>
  )
}

/**
 * Empty state
 */
function EmptyState() {
  return (
    <Card className="mt-6">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">All Clear!</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          No items currently need review. When findings are corrected, any dependent
          Q&A answers, CIM sections, or insights will appear here for review.
        </p>
      </CardContent>
    </Card>
  )
}

export function ReviewQueuePageClient({ projectId }: ReviewQueuePageClientProps) {
  const [items, setItems] = useState<ReviewQueueItem[]>([])
  const [counts, setCounts] = useState<ReviewQueueCount | null>(null)
  const [filter, setFilter] = useState<ItemType>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20

  // Fetch review queue items
  const fetchItems = useCallback(async () => {
    setIsLoading(true)
    try {
      const typeParam = filter !== 'all' ? `&type=${filter}` : ''
      const offset = (page - 1) * pageSize
      const response = await fetch(
        `/api/projects/${projectId}/review-queue?limit=${pageSize}&offset=${offset}${typeParam}`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch review queue')
      }

      const data = await response.json()
      setItems(data.items || [])
      setTotal(data.total || 0)

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
  }, [projectId, filter, page])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // Reset page when filter changes
  useEffect(() => {
    setPage(1)
  }, [filter])

  // Handle dismiss action
  const handleDismiss = async (item: ReviewQueueItem) => {
    setIsActionLoading(item.id)
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
        // Refresh list
        fetchItems()
      }
    } catch (error) {
      console.error('Error dismissing item:', error)
    } finally {
      setIsActionLoading(null)
    }
  }

  // Handle regenerate action
  const handleRegenerate = async (item: ReviewQueueItem) => {
    setIsActionLoading(item.id)
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
        // Refresh list
        fetchItems()
      }
    } catch (error) {
      console.error('Error regenerating item:', error)
    } finally {
      setIsActionLoading(null)
    }
  }

  const totalPages = Math.ceil(total / pageSize)
  const canRegenerate = (type: string) => type === 'qa_answer' || type === 'cim_section'

  if (isLoading && !counts) {
    return (
      <div className="container mx-auto py-6 px-4">
        <LoadingSkeleton />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            Review Queue
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Items flagged for review due to finding corrections
          </p>
        </div>

        <Select
          value={filter}
          onValueChange={(value) => setFilter(value as ItemType)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="finding">Findings</SelectItem>
            <SelectItem value="qa_answer">Q&A Answers</SelectItem>
            <SelectItem value="cim_section">CIM Sections</SelectItem>
            <SelectItem value="insight">Insights</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      {counts && <StatCards counts={counts} />}

      {/* Empty state */}
      {!isLoading && items.length === 0 && counts?.total === 0 && <EmptyState />}

      {/* Items table */}
      {(items.length > 0 || isLoading) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Review Items</CardTitle>
            <CardDescription>
              {total} item{total !== 1 ? 's' : ''} need{total === 1 ? 's' : ''} review
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Type</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-48">Reason</TableHead>
                  <TableHead className="w-32">Date</TableHead>
                  <TableHead className="w-40 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-12 w-full" />
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => {
                    const Icon = typeIcons[item.type] || FileText
                    const isItemLoading = isActionLoading === item.id

                    return (
                      <TableRow key={`${item.type}-${item.id}`}>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs flex items-center gap-1 w-fit',
                              typeBadgeColors[item.type]
                            )}
                          >
                            <Icon className="h-3 w-3" />
                            {typeLabels[item.type]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium line-clamp-2">{item.title}</p>
                          {item.documentName && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              From: {item.documentName}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {item.reviewReason}
                          </p>
                        </TableCell>
                        <TableCell>
                          <time
                            dateTime={item.createdAt}
                            title={format(new Date(item.createdAt), 'PPpp')}
                            className="text-sm text-muted-foreground"
                          >
                            {formatDistanceToNow(new Date(item.createdAt), {
                              addSuffix: true,
                            })}
                          </time>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canRegenerate(item.type) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRegenerate(item)}
                                disabled={isItemLoading}
                              >
                                <RefreshCw
                                  className={cn(
                                    'h-4 w-4 mr-1',
                                    isItemLoading && 'animate-spin'
                                  )}
                                />
                                Regenerate
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDismiss(item)}
                              disabled={isItemLoading}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Dismiss
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
