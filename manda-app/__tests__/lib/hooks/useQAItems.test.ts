/**
 * useQAItems Hook Tests
 * Story: E8.2 - Q&A Management UI with Collaborative Editing (AC: 1, 3, 5)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useQAItems } from '@/lib/hooks/useQAItems'
import type { QAItem } from '@/lib/types/qa'
import * as qaApi from '@/lib/api/qa'

// Mock the API module
vi.mock('@/lib/api/qa', () => ({
  getQAItems: vi.fn(),
}))

const mockItem1: QAItem = {
  id: 'qa-1',
  dealId: 'deal-1',
  question: 'What is the revenue?',
  answer: null,
  comment: null,
  category: 'Financials',
  priority: 'high',
  sourceFindingId: null,
  createdBy: 'user-1',
  dateAdded: '2025-01-01T00:00:00Z',
  dateAnswered: null,
  updatedAt: '2025-01-01T00:00:00Z',
}

const mockItem2: QAItem = {
  id: 'qa-2',
  dealId: 'deal-1',
  question: 'Are there any pending lawsuits?',
  answer: 'No pending lawsuits',
  comment: 'Verified by legal team',
  category: 'Legal',
  priority: 'medium',
  sourceFindingId: null,
  createdBy: 'user-1',
  dateAdded: '2025-01-01T00:00:00Z',
  dateAnswered: '2025-01-02T00:00:00Z',
  updatedAt: '2025-01-02T00:00:00Z',
}

const mockItems: QAItem[] = [mockItem1, mockItem2]

describe('useQAItems', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('initial fetch', () => {
    it('should fetch items on mount', async () => {
      const mockGetQAItems = vi.mocked(qaApi.getQAItems)
      mockGetQAItems.mockResolvedValue({
        items: mockItems,
        total: 2,
        limit: 50,
        offset: 0,
        hasMore: false,
      })

      const { result } = renderHook(() => useQAItems('project-1'))

      // Initially loading
      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.items).toEqual(mockItems)
      expect(mockGetQAItems).toHaveBeenCalledWith('project-1', undefined)
    })

    it('should pass filters to API', async () => {
      const mockGetQAItems = vi.mocked(qaApi.getQAItems)
      mockGetQAItems.mockResolvedValue({
        items: [mockItems[0]!],
        total: 1,
        limit: 50,
        offset: 0,
        hasMore: false,
      })

      const filters = { category: 'Financials' as const, status: 'pending' as const }

      renderHook(() => useQAItems('project-1', filters))

      await waitFor(() => {
        expect(mockGetQAItems).toHaveBeenCalledWith('project-1', filters)
      })
    })

    it('should set error state on fetch failure', async () => {
      const mockGetQAItems = vi.mocked(qaApi.getQAItems)
      mockGetQAItems.mockRejectedValue(new Error('Failed to fetch'))

      const { result } = renderHook(() => useQAItems('project-1'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBe('Failed to fetch')
      expect(result.current.items).toEqual([])
    })
  })

  describe('refresh', () => {
    it('should refetch items when refresh is called', async () => {
      const mockGetQAItems = vi.mocked(qaApi.getQAItems)
      mockGetQAItems.mockResolvedValue({
        items: mockItems,
        total: 2,
        limit: 50,
        offset: 0,
        hasMore: false,
      })

      const { result } = renderHook(() => useQAItems('project-1'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Clear mock to track refresh call
      mockGetQAItems.mockClear()
      mockGetQAItems.mockResolvedValue({
        items: [...mockItems, { ...mockItem1, id: 'qa-3' }],
        total: 3,
        limit: 50,
        offset: 0,
        hasMore: false,
      })

      await act(async () => {
        await result.current.refresh()
      })

      expect(mockGetQAItems).toHaveBeenCalledTimes(1)
      expect(result.current.items.length).toBe(3)
    })

    it('should set isRefreshing during refresh', async () => {
      const mockGetQAItems = vi.mocked(qaApi.getQAItems)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let resolveRefresh: (value: any) => void
      mockGetQAItems
        .mockResolvedValueOnce({
          items: mockItems,
          total: 2,
          limit: 50,
          offset: 0,
          hasMore: false,
        })
        .mockImplementationOnce(
          () =>
            new Promise(resolve => {
              resolveRefresh = resolve
            })
        )

      const { result } = renderHook(() => useQAItems('project-1'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Start refresh
      let refreshPromise: Promise<void>
      act(() => {
        refreshPromise = result.current.refresh()
      })

      // Should be refreshing
      expect(result.current.isRefreshing).toBe(true)
      expect(result.current.isLoading).toBe(false)

      // Complete refresh
      act(() => {
        resolveRefresh({
          items: mockItems,
          total: 2,
          limit: 50,
          offset: 0,
          hasMore: false,
        })
      })

      await refreshPromise!

      // Wait for state to update
      await waitFor(() => {
        expect(result.current.isRefreshing).toBe(false)
      })
    })
  })

  describe('updateItem', () => {
    it('should update a single item in the list', async () => {
      const mockGetQAItems = vi.mocked(qaApi.getQAItems)
      mockGetQAItems.mockResolvedValue({
        items: mockItems,
        total: 2,
        limit: 50,
        offset: 0,
        hasMore: false,
      })

      const { result } = renderHook(() => useQAItems('project-1'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const updatedItem: QAItem = {
        ...mockItem1,
        answer: 'New answer',
        updatedAt: '2025-01-03T00:00:00Z',
      }

      act(() => {
        result.current.updateItem(updatedItem)
      })

      expect(result.current.items[0]!.answer).toBe('New answer')
      expect(result.current.items[1]).toEqual(mockItem2)
    })
  })

  describe('optimistic updates', () => {
    it('should apply optimistic update immediately', async () => {
      const mockGetQAItems = vi.mocked(qaApi.getQAItems)
      mockGetQAItems.mockResolvedValue({
        items: mockItems,
        total: 2,
        limit: 50,
        offset: 0,
        hasMore: false,
      })

      const { result } = renderHook(() => useQAItems('project-1'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      act(() => {
        result.current.optimisticUpdate('qa-1', { answer: 'Optimistic answer' })
      })

      expect(result.current.items[0]!.answer).toBe('Optimistic answer')
    })

    it('should rollback on error', async () => {
      const mockGetQAItems = vi.mocked(qaApi.getQAItems)
      mockGetQAItems.mockResolvedValue({
        items: mockItems,
        total: 2,
        limit: 50,
        offset: 0,
        hasMore: false,
      })

      const { result } = renderHook(() => useQAItems('project-1'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Apply optimistic update
      act(() => {
        result.current.optimisticUpdate('qa-1', { answer: 'Failed answer' })
      })

      expect(result.current.items[0]!.answer).toBe('Failed answer')

      // Rollback
      act(() => {
        result.current.rollbackUpdate('qa-1')
      })

      expect(result.current.items[0]!.answer).toBe(null) // Original value
    })

    it('should preserve original for multiple updates to same item', async () => {
      const mockGetQAItems = vi.mocked(qaApi.getQAItems)
      mockGetQAItems.mockResolvedValue({
        items: mockItems,
        total: 2,
        limit: 50,
        offset: 0,
        hasMore: false,
      })

      const { result } = renderHook(() => useQAItems('project-1'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // First optimistic update
      act(() => {
        result.current.optimisticUpdate('qa-1', { answer: 'First update' })
      })

      // Second optimistic update
      act(() => {
        result.current.optimisticUpdate('qa-1', { answer: 'Second update' })
      })

      expect(result.current.items[0]!.answer).toBe('Second update')

      // Rollback should restore original, not first update
      act(() => {
        result.current.rollbackUpdate('qa-1')
      })

      expect(result.current.items[0]!.answer).toBe(null) // Original value
    })
  })

  describe('filter changes', () => {
    it('should refetch when filters change', async () => {
      const mockGetQAItems = vi.mocked(qaApi.getQAItems)
      mockGetQAItems.mockResolvedValue({
        items: mockItems,
        total: 2,
        limit: 50,
        offset: 0,
        hasMore: false,
      })

      type FilterProps = { filters?: { category: 'Financials' | 'Legal' } }
      const { result, rerender } = renderHook(
        ({ filters }: FilterProps) => useQAItems('project-1', filters),
        { initialProps: { filters: undefined } as FilterProps }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Change filters
      mockGetQAItems.mockClear()
      mockGetQAItems.mockResolvedValue({
        items: [mockItem1],
        total: 1,
        limit: 50,
        offset: 0,
        hasMore: false,
      })

      rerender({ filters: { category: 'Financials' } })

      await waitFor(() => {
        expect(mockGetQAItems).toHaveBeenCalledWith('project-1', {
          category: 'Financials',
        })
      })
    })
  })
})
