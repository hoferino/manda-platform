/**
 * Unit tests for useProcessingQueue hook
 * Story: E3.7 - Implement Processing Queue Visibility (AC: #3, #5)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useProcessingQueue } from '@/lib/hooks/useProcessingQueue'
import * as processingApi from '@/lib/api/processing'

// Mock the processing API module
vi.mock('@/lib/api/processing', () => ({
  fetchQueueJobs: vi.fn(),
}))

const mockJobs = [
  {
    id: 'job-1',
    documentId: 'doc-1',
    documentName: 'test.pdf',
    fileType: 'application/pdf',
    status: 'queued' as const,
    processingStage: null,
    createdAt: new Date().toISOString(),
    startedAt: null,
    timeInQueue: 30,
    estimatedCompletion: null,
    retryCount: 0,
    error: null,
  },
]

describe('useProcessingQueue Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Initial Fetch', () => {
    it('fetches jobs on mount', async () => {
      vi.mocked(processingApi.fetchQueueJobs).mockResolvedValue({
        jobs: mockJobs,
        total: 1,
        hasMore: false,
      })

      const { result } = renderHook(() =>
        useProcessingQueue('project-1')
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(processingApi.fetchQueueJobs).toHaveBeenCalledWith('project-1', {
        limit: 20,
        offset: 0,
      })
      expect(result.current.jobs).toEqual(mockJobs)
      expect(result.current.total).toBe(1)
    })

    it('does not fetch when projectId is null', () => {
      renderHook(() => useProcessingQueue(null))

      expect(processingApi.fetchQueueJobs).not.toHaveBeenCalled()
    })

    it('does not fetch when disabled', () => {
      renderHook(() =>
        useProcessingQueue('project-1', { enabled: false })
      )

      expect(processingApi.fetchQueueJobs).not.toHaveBeenCalled()
    })
  })

  describe('Loading State', () => {
    it('sets loading state during fetch', async () => {
      let resolvePromise: (value: unknown) => void
      vi.mocked(processingApi.fetchQueueJobs).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve
          })
      )

      const { result } = renderHook(() =>
        useProcessingQueue('project-1')
      )

      // Should be loading initially
      expect(result.current.isLoading).toBe(true)

      // Resolve the promise
      await act(async () => {
        resolvePromise!({ jobs: [], total: 0, hasMore: false })
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })
  })

  describe('Error Handling', () => {
    it('captures fetch errors', async () => {
      const error = new Error('Network error')
      vi.mocked(processingApi.fetchQueueJobs).mockRejectedValue(error)

      const { result } = renderHook(() =>
        useProcessingQueue('project-1')
      )

      await waitFor(() => {
        expect(result.current.error).toEqual(error)
      })

      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('Refetch', () => {
    it('provides refetch function', async () => {
      vi.mocked(processingApi.fetchQueueJobs).mockResolvedValue({
        jobs: mockJobs,
        total: 1,
        hasMore: false,
      })

      const { result } = renderHook(() =>
        useProcessingQueue('project-1')
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Clear mock calls
      vi.mocked(processingApi.fetchQueueJobs).mockClear()

      // Call refetch
      await act(async () => {
        await result.current.refetch()
      })

      expect(processingApi.fetchQueueJobs).toHaveBeenCalledTimes(1)
    })
  })

  describe('Pagination', () => {
    it('provides loadMore function', async () => {
      vi.mocked(processingApi.fetchQueueJobs).mockResolvedValue({
        jobs: mockJobs,
        total: 5,
        hasMore: true,
      })

      const { result } = renderHook(() =>
        useProcessingQueue('project-1')
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.hasMore).toBe(true)

      // Prepare next page
      vi.mocked(processingApi.fetchQueueJobs).mockResolvedValue({
        jobs: [{ ...mockJobs[0], id: 'job-2' }],
        total: 5,
        hasMore: false,
      })

      await act(async () => {
        await result.current.loadMore()
      })

      // Should have appended new jobs
      expect(result.current.jobs).toHaveLength(2)
    })

    it('does not load more when no more available', async () => {
      vi.mocked(processingApi.fetchQueueJobs).mockResolvedValue({
        jobs: mockJobs,
        total: 1,
        hasMore: false,
      })

      const { result } = renderHook(() =>
        useProcessingQueue('project-1')
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      vi.mocked(processingApi.fetchQueueJobs).mockClear()

      await act(async () => {
        await result.current.loadMore()
      })

      // Should not have made another call
      expect(processingApi.fetchQueueJobs).not.toHaveBeenCalled()
    })
  })

  describe('Polling', () => {
    it('polls at specified interval', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      vi.mocked(processingApi.fetchQueueJobs).mockResolvedValue({
        jobs: mockJobs,
        total: 1,
        hasMore: false,
      })

      renderHook(() =>
        useProcessingQueue('project-1', { pollingInterval: 5000 })
      )

      // Initial fetch happens immediately
      // Wait a microtask for the promise to resolve
      await Promise.resolve()
      await Promise.resolve()

      // Should have initial fetch
      expect(processingApi.fetchQueueJobs).toHaveBeenCalled()
      const initialCallCount = vi.mocked(processingApi.fetchQueueJobs).mock.calls.length

      // Advance timer by polling interval
      vi.advanceTimersByTime(5000)
      await Promise.resolve()
      await Promise.resolve()

      // Should have polled at least once more
      expect(vi.mocked(processingApi.fetchQueueJobs).mock.calls.length).toBeGreaterThan(initialCallCount)
    })

    it('does not poll when disabled', async () => {
      vi.useFakeTimers()

      vi.mocked(processingApi.fetchQueueJobs).mockResolvedValue({
        jobs: mockJobs,
        total: 1,
        hasMore: false,
      })

      renderHook(() =>
        useProcessingQueue('project-1', {
          pollingInterval: 5000,
          enabled: false,
        })
      )

      // Should not have fetched at all
      expect(processingApi.fetchQueueJobs).not.toHaveBeenCalled()

      // Advance timer
      await vi.advanceTimersByTimeAsync(10000)

      // Still should not have fetched
      expect(processingApi.fetchQueueJobs).not.toHaveBeenCalled()
    })
  })

  describe('Custom Options', () => {
    it('respects custom limit', async () => {
      vi.mocked(processingApi.fetchQueueJobs).mockResolvedValue({
        jobs: [],
        total: 0,
        hasMore: false,
      })

      renderHook(() =>
        useProcessingQueue('project-1', { limit: 50 })
      )

      await waitFor(() => {
        expect(processingApi.fetchQueueJobs).toHaveBeenCalledWith('project-1', {
          limit: 50,
          offset: 0,
        })
      })
    })
  })
})
