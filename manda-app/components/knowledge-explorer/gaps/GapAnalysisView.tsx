/**
 * GapAnalysisView Component
 * Main view for displaying and managing gap analysis
 * Story: E4.8 - Build Gap Analysis View (AC: #1, #2, #3, #4, #8)
 *
 * Features:
 * - Filter bar with category, status, and priority dropdowns
 * - Gap statistics display (IRL gaps, info gaps, resolved count)
 * - List of GapCard components
 * - Loading skeleton state
 * - Error state with retry button
 * - Empty state for no gaps
 * - URL state management for filters
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { GapCard } from './GapCard'
import {
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  FileQuestion,
  Filter,
  AlertCircle,
  BarChart3,
} from 'lucide-react'
import { getProjectGaps, resolveGap, undoGapResolution } from '@/lib/api/gaps'
import {
  GAP_CATEGORY_FILTER_OPTIONS,
  GAP_STATUS_FILTER_OPTIONS,
  GAP_PRIORITY_FILTER_OPTIONS,
  type Gap,
  type GapCategory,
  type GapStatus,
  type GapPriority,
} from '@/lib/types/gaps'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export interface GapAnalysisViewProps {
  projectId: string
  className?: string
}

/**
 * Loading skeleton for gap cards
 */
function GapSkeleton() {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>

      {/* Content skeleton */}
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-32" />

      {/* Actions skeleton */}
      <div className="flex items-center gap-2 pt-2 border-t">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
    </div>
  )
}

/**
 * Empty state component
 */
function EmptyState({ status, category }: { status: GapStatus | 'all'; category: GapCategory | 'all' }) {
  const isAllResolved = status === 'active' && category === 'all'

  const message = isAllResolved
    ? 'Excellent! All gaps have been addressed.'
    : status !== 'all'
      ? `No ${status} gaps found.`
      : category !== 'all'
        ? `No ${category.replace('_', ' ')} gaps found.`
        : 'No gaps have been detected in this project yet.'

  const Icon = isAllResolved ? CheckCircle2 : FileQuestion

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon
        className={cn(
          'h-12 w-12 mb-4',
          isAllResolved ? 'text-green-500' : 'text-muted-foreground'
        )}
        aria-hidden="true"
      />
      <h3 className="text-lg font-medium mb-2">
        {isAllResolved ? 'All Caught Up!' : 'No Gaps Found'}
      </h3>
      <p className="text-muted-foreground max-w-md">{message}</p>
      {category === 'all' && status === 'all' && (
        <p className="text-sm text-muted-foreground mt-2">
          Gaps are detected from IRL checklist items and domain coverage analysis.
        </p>
      )}
    </div>
  )
}

/**
 * Error state component
 */
function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <Alert variant="destructive" className="my-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>{error}</span>
        <Button variant="outline" size="sm" onClick={onRetry} className="ml-4">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  )
}

/**
 * Statistics bar component
 */
function StatsBar({
  irlGaps,
  infoGaps,
  total,
  resolved,
  isLoading,
}: {
  irlGaps: number
  infoGaps: number
  total: number
  resolved: number
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
      </div>
    )
  }

  const active = total - resolved

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{total}</span>
        <span className="text-muted-foreground">total</span>
      </div>
      <div className="text-muted-foreground">|</div>
      <div className="flex items-center gap-1">
        <FileQuestion className="h-4 w-4 text-red-500" />
        <span>{irlGaps}</span>
        <span className="text-muted-foreground">IRL items</span>
      </div>
      <div className="text-muted-foreground">|</div>
      <div className="flex items-center gap-1">
        <AlertCircle className="h-4 w-4 text-orange-500" />
        <span>{infoGaps}</span>
        <span className="text-muted-foreground">info gaps</span>
      </div>
      <div className="text-muted-foreground">|</div>
      <div className="flex items-center gap-1">
        <span className={cn('font-medium', active > 0 ? 'text-orange-600' : 'text-green-600')}>
          {active}
        </span>
        <span className="text-muted-foreground">active</span>
      </div>
    </div>
  )
}

export function GapAnalysisView({ projectId, className }: GapAnalysisViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Get initial filters from URL or defaults
  const initialCategory = (searchParams.get('gap_category') as GapCategory | 'all') || 'all'
  const initialStatus = (searchParams.get('gap_status') as GapStatus | 'all') || 'active'
  const initialPriority = (searchParams.get('gap_priority') as GapPriority | 'all') || 'all'

  const [gaps, setGaps] = useState<Gap[]>([])
  const [stats, setStats] = useState({ irlGaps: 0, infoGaps: 0, total: 0, resolved: 0 })
  const [category, setCategory] = useState<GapCategory | 'all'>(initialCategory)
  const [status, setStatus] = useState<GapStatus | 'all'>(initialStatus)
  const [priority, setPriority] = useState<GapPriority | 'all'>(initialPriority)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch gaps
  const fetchGaps = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await getProjectGaps(projectId, {
        category,
        status,
        priority,
        sortBy: 'priority',
        sortOrder: 'asc',
      })
      setGaps(response.gaps)
      setStats({
        irlGaps: response.irlGaps,
        infoGaps: response.infoGaps,
        total: response.total,
        resolved: response.resolved,
      })
    } catch (err) {
      console.error('[GapAnalysisView] Error fetching gaps:', err)
      setError(err instanceof Error ? err.message : 'Failed to load gaps')
    } finally {
      setIsLoading(false)
    }
  }, [projectId, category, status, priority])

  // Initial fetch and refetch on filter change
  useEffect(() => {
    fetchGaps()
  }, [fetchGaps])

  // Update URL when filters change
  const updateUrl = useCallback(
    (newCategory: GapCategory | 'all', newStatus: GapStatus | 'all', newPriority: GapPriority | 'all') => {
      const params = new URLSearchParams(searchParams.toString())

      // Set or remove category
      if (newCategory === 'all') {
        params.delete('gap_category')
      } else {
        params.set('gap_category', newCategory)
      }

      // Set or remove status (default is 'active')
      if (newStatus === 'active') {
        params.delete('gap_status')
      } else {
        params.set('gap_status', newStatus)
      }

      // Set or remove priority
      if (newPriority === 'all') {
        params.delete('gap_priority')
      } else {
        params.set('gap_priority', newPriority)
      }

      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
      router.replace(newUrl, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const handleCategoryChange = useCallback(
    (newCategory: GapCategory | 'all') => {
      setCategory(newCategory)
      updateUrl(newCategory, status, priority)
    },
    [status, priority, updateUrl]
  )

  const handleStatusChange = useCallback(
    (newStatus: GapStatus | 'all') => {
      setStatus(newStatus)
      updateUrl(category, newStatus, priority)
    },
    [category, priority, updateUrl]
  )

  const handlePriorityChange = useCallback(
    (newPriority: GapPriority | 'all') => {
      setPriority(newPriority)
      updateUrl(category, status, newPriority)
    },
    [category, status, updateUrl]
  )

  // Handle gap resolution
  const handleResolve = useCallback(
    async (gapId: string, newStatus: GapStatus, note?: string) => {
      try {
        await resolveGap(projectId, gapId, { status: newStatus, note })

        const statusMessages: Record<GapStatus, string> = {
          resolved: 'Gap marked as resolved',
          not_applicable: 'Gap marked as not applicable',
          active: 'Gap reactivated',
        }
        toast.success(statusMessages[newStatus])

        // Refresh the list
        await fetchGaps()
      } catch (err) {
        console.error('[GapAnalysisView] Error resolving gap:', err)
        toast.error(err instanceof Error ? err.message : 'Failed to update gap')
        throw err
      }
    },
    [projectId, fetchGaps]
  )

  // Handle undo resolution
  const handleUndo = useCallback(
    async (gapId: string) => {
      try {
        await undoGapResolution(projectId, gapId)
        toast.success('Gap resolution undone')
        await fetchGaps()
      } catch (err) {
        console.error('[GapAnalysisView] Error undoing resolution:', err)
        toast.error(err instanceof Error ? err.message : 'Failed to undo resolution')
        throw err
      }
    },
    [projectId, fetchGaps]
  )

  return (
    <div className={cn('space-y-4', className)}>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Category filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Select value={category} onValueChange={handleCategoryChange}>
              <SelectTrigger className="w-[180px]" aria-label="Filter by category">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                {GAP_CATEGORY_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status filter */}
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[140px]" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {GAP_STATUS_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Priority filter */}
          <Select value={priority} onValueChange={handlePriorityChange}>
            <SelectTrigger className="w-[140px]" aria-label="Filter by priority">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              {GAP_PRIORITY_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Refresh button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchGaps}
          disabled={isLoading}
          aria-label="Refresh gaps"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        </Button>
      </div>

      {/* Statistics bar */}
      <StatsBar
        irlGaps={stats.irlGaps}
        infoGaps={stats.infoGaps}
        total={stats.total}
        resolved={stats.resolved}
        isLoading={isLoading}
      />

      {/* Error state */}
      {error && <ErrorState error={error} onRetry={fetchGaps} />}

      {/* Loading state */}
      {isLoading && !error && (
        <div className="space-y-4">
          <GapSkeleton />
          <GapSkeleton />
          <GapSkeleton />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && gaps.length === 0 && <EmptyState status={status} category={category} />}

      {/* Gaps list */}
      {!isLoading && !error && gaps.length > 0 && (
        <div className="space-y-4">
          {gaps.map((gap) => (
            <GapCard
              key={gap.id}
              gap={gap}
              projectId={projectId}
              onResolve={handleResolve}
              onUndo={handleUndo}
            />
          ))}
        </div>
      )}
    </div>
  )
}
