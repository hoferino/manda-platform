/**
 * Processing Queue Hook
 * Story: E3.7 - Implement Processing Queue Visibility (AC: #3, #5)
 *
 * React hook for fetching and managing the processing queue.
 * Features:
 * - Fetch queue jobs with pagination
 * - Automatic polling as backup for realtime
 * - Manual refetch capability
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { QueueJob, QueueResponse } from '@/lib/api/processing'
import { fetchQueueJobs } from '@/lib/api/processing'

export interface UseProcessingQueueOptions {
  /** Polling interval in milliseconds (default: 10000 - 10s) */
  pollingInterval?: number
  /** Maximum jobs to fetch (default: 20) */
  limit?: number
  /** Enable/disable the hook (default: true) */
  enabled?: boolean
}

export interface UseProcessingQueueResult {
  /** List of jobs in the queue */
  jobs: QueueJob[]
  /** Total number of jobs in queue */
  total: number
  /** Whether more jobs are available */
  hasMore: boolean
  /** Loading state */
  isLoading: boolean
  /** Error state */
  error: Error | null
  /** Manual refetch function */
  refetch: () => Promise<void>
  /** Load more jobs (pagination) */
  loadMore: () => Promise<void>
}

/**
 * Hook for fetching and managing the processing queue
 *
 * @param projectId - The project ID to fetch queue jobs for
 * @param options - Hook options
 * @returns Queue state and control functions
 *
 * @example
 * ```tsx
 * const { jobs, isLoading, refetch } = useProcessingQueue(projectId, {
 *   pollingInterval: 10000,
 * })
 * ```
 */
export function useProcessingQueue(
  projectId: string | null | undefined,
  options: UseProcessingQueueOptions = {}
): UseProcessingQueueResult {
  const {
    pollingInterval = 10000,
    limit = 20,
    enabled = true,
  } = options

  const [jobs, setJobs] = useState<QueueJob[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const offsetRef = useRef(0)
  const isMountedRef = useRef(true)

  // Fetch queue jobs
  const fetchJobs = useCallback(async (reset = true) => {
    if (!projectId || !enabled) return

    if (reset) {
      offsetRef.current = 0
    }

    setIsLoading(true)
    setError(null)

    try {
      const response: QueueResponse = await fetchQueueJobs(projectId, {
        limit,
        offset: offsetRef.current,
      })

      if (!isMountedRef.current) return

      if (reset) {
        setJobs(response.jobs)
      } else {
        // Append for pagination
        setJobs((prev) => [...prev, ...response.jobs])
      }
      setTotal(response.total)
      setHasMore(response.hasMore)
      offsetRef.current += response.jobs.length
    } catch (err) {
      if (!isMountedRef.current) return
      setError(err instanceof Error ? err : new Error('Failed to fetch queue'))
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [projectId, enabled, limit])

  // Refetch (reset and fetch)
  const refetch = useCallback(async () => {
    await fetchJobs(true)
  }, [fetchJobs])

  // Load more (pagination)
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return
    await fetchJobs(false)
  }, [fetchJobs, hasMore, isLoading])

  // Initial fetch
  useEffect(() => {
    isMountedRef.current = true
    fetchJobs(true)

    return () => {
      isMountedRef.current = false
    }
  }, [fetchJobs])

  // Polling for updates
  useEffect(() => {
    if (!projectId || !enabled || pollingInterval <= 0) return

    const interval = setInterval(() => {
      // Silent refetch - don't show loading state for polling
      fetchQueueJobs(projectId, { limit, offset: 0 })
        .then((response) => {
          if (isMountedRef.current) {
            setJobs(response.jobs)
            setTotal(response.total)
            setHasMore(response.hasMore)
          }
        })
        .catch((err) => {
          // Silent fail for polling - only log
          console.error('Queue polling error:', err)
        })
    }, pollingInterval)

    return () => clearInterval(interval)
  }, [projectId, enabled, pollingInterval, limit])

  return {
    jobs,
    total,
    hasMore,
    isLoading,
    error,
    refetch,
    loadMore,
  }
}
