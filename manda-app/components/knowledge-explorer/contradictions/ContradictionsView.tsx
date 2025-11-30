/**
 * ContradictionsView Component
 * Main view for displaying and managing contradictions
 * Story: E4.6 - Build Contradictions View (AC: #1, #2, #8, #10)
 *
 * Features:
 * - Filter bar with status dropdown (All, Unresolved, Resolved, Investigating, Noted)
 * - Contradiction count display
 * - List of ContradictionCard components
 * - Loading skeleton state
 * - Error state with retry button
 * - Empty state for no contradictions
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
import { ContradictionCard } from './ContradictionCard'
import { AlertTriangle, RefreshCw, CheckCircle2, Search, MessageSquare, Filter } from 'lucide-react'
import { getContradictions, resolveContradiction } from '@/lib/api/contradictions'
import {
  CONTRADICTION_FILTER_OPTIONS,
  type ContradictionWithFindings,
  type ContradictionStatus,
} from '@/lib/types/contradictions'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export interface ContradictionsViewProps {
  projectId: string
  className?: string
  /** Callback to register refresh function for realtime updates (E4.13) */
  onRegisterRefresh?: (refresh: () => void) => void
}

/**
 * Loading skeleton for contradiction cards
 */
function ContradictionSkeleton() {
  return (
    <div className="border rounded-lg p-4 space-y-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Content skeleton - two panels */}
      <div className="flex gap-4">
        <div className="flex-1 space-y-3 p-4 border rounded-lg">
          <Skeleton className="h-5 w-8" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex items-center px-2">
          <Skeleton className="h-8 w-6" />
        </div>
        <div className="flex-1 space-y-3 p-4 border rounded-lg">
          <Skeleton className="h-5 w-8" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* Footer skeleton */}
      <div className="flex items-center gap-2 pt-3 border-t">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-24" />
      </div>
    </div>
  )
}

/**
 * Empty state component
 */
function EmptyState({ status }: { status: ContradictionStatus | 'all' }) {
  const message =
    status === 'all'
      ? 'No contradictions have been detected in this project yet.'
      : status === 'unresolved'
        ? 'Great job! All contradictions have been resolved.'
        : `No ${status} contradictions found.`

  const Icon = status === 'unresolved' ? CheckCircle2 : AlertTriangle

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon
        className={cn(
          'h-12 w-12 mb-4',
          status === 'unresolved' ? 'text-green-500' : 'text-muted-foreground'
        )}
        aria-hidden="true"
      />
      <h3 className="text-lg font-medium mb-2">
        {status === 'unresolved' ? 'All Caught Up!' : 'No Contradictions Found'}
      </h3>
      <p className="text-muted-foreground max-w-md">{message}</p>
      {status === 'all' && (
        <p className="text-sm text-muted-foreground mt-2">
          Contradictions are detected automatically when conflicting findings are identified.
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
 * Get icon for filter option
 */
function getFilterIcon(status: ContradictionStatus | 'all') {
  switch (status) {
    case 'all':
      return Filter
    case 'unresolved':
      return AlertTriangle
    case 'resolved':
      return CheckCircle2
    case 'investigating':
      return Search
    case 'noted':
      return MessageSquare
    default:
      return Filter
  }
}

export function ContradictionsView({ projectId, className, onRegisterRefresh }: ContradictionsViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Get initial filter from URL or default to 'unresolved'
  const initialStatus = (searchParams.get('contradiction_status') as ContradictionStatus | 'all') || 'unresolved'

  const [contradictions, setContradictions] = useState<ContradictionWithFindings[]>([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<ContradictionStatus | 'all'>(initialStatus)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch contradictions
  const fetchContradictions = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await getContradictions(projectId, {
        status: status,
        limit: 50,
      })
      setContradictions(response.contradictions)
      setTotal(response.total)
    } catch (err) {
      console.error('[ContradictionsView] Error fetching contradictions:', err)
      setError(err instanceof Error ? err.message : 'Failed to load contradictions')
    } finally {
      setIsLoading(false)
    }
  }, [projectId, status])

  // Initial fetch and refetch on status change
  useEffect(() => {
    fetchContradictions()
  }, [fetchContradictions])

  // E4.13: Register refresh function for realtime updates
  useEffect(() => {
    if (onRegisterRefresh) {
      onRegisterRefresh(fetchContradictions)
    }
  }, [onRegisterRefresh, fetchContradictions])

  // Update URL when filter changes
  const handleStatusChange = useCallback(
    (newStatus: ContradictionStatus | 'all') => {
      setStatus(newStatus)

      // Update URL with new filter
      const params = new URLSearchParams(searchParams.toString())
      if (newStatus === 'unresolved') {
        // Default value, remove from URL
        params.delete('contradiction_status')
      } else {
        params.set('contradiction_status', newStatus)
      }

      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
      router.replace(newUrl, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  // Handle resolution action
  const handleResolve = useCallback(
    async (
      contradictionId: string,
      action: 'accept_a' | 'accept_b' | 'investigate' | 'noted',
      note?: string
    ) => {
      try {
        await resolveContradiction(projectId, contradictionId, { action, note })

        // Show success toast
        const actionMessages = {
          accept_a: 'Finding A accepted, Finding B rejected',
          accept_b: 'Finding B accepted, Finding A rejected',
          investigate: 'Marked for investigation',
          noted: 'Note added',
        }
        toast.success(actionMessages[action])

        // Refresh the list
        await fetchContradictions()
      } catch (err) {
        console.error('[ContradictionsView] Error resolving contradiction:', err)
        toast.error(err instanceof Error ? err.message : 'Failed to resolve contradiction')
        throw err // Re-throw to let ContradictionCard handle loading state
      }
    },
    [projectId, fetchContradictions]
  )

  const FilterIcon = getFilterIcon(status)

  return (
    <div className={cn('space-y-4', className)}>
      {/* Filter bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Status filter */}
          <div className="flex items-center gap-2">
            <FilterIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[160px]" aria-label="Filter by status">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {CONTRADICTION_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Count display */}
          <span className="text-sm text-muted-foreground">
            {isLoading ? (
              <Skeleton className="h-4 w-20 inline-block" />
            ) : (
              `${total} ${total === 1 ? 'contradiction' : 'contradictions'}`
            )}
          </span>
        </div>

        {/* Refresh button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchContradictions}
          disabled={isLoading}
          aria-label="Refresh contradictions"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        </Button>
      </div>

      {/* Error state */}
      {error && <ErrorState error={error} onRetry={fetchContradictions} />}

      {/* Loading state */}
      {isLoading && !error && (
        <div className="space-y-4">
          <ContradictionSkeleton />
          <ContradictionSkeleton />
          <ContradictionSkeleton />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && contradictions.length === 0 && <EmptyState status={status} />}

      {/* Contradictions list */}
      {!isLoading && !error && contradictions.length > 0 && (
        <div className="space-y-4">
          {contradictions.map((contradiction) => (
            <ContradictionCard
              key={contradiction.id}
              contradiction={contradiction}
              onResolve={handleResolve}
              projectId={projectId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
