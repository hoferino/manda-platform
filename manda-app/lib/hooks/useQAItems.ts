'use client'

/**
 * useQAItems Hook
 * Fetches and manages Q&A items with optimistic updates and refresh
 * Story: E8.2 - Q&A Management UI with Collaborative Editing (AC: 1, 3, 5)
 *
 * Features:
 * - Fetches Q&A items with filters
 * - Optimistic updates for fast UI feedback
 * - Rollback on error
 * - Manual refresh
 * - Loading and error states
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { QAItem, QAFilters } from '@/lib/types/qa'
import { getQAItems, QAListResponse } from '@/lib/api/qa'

interface UseQAItemsReturn {
  items: QAItem[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  isRefreshing: boolean
  updateItem: (item: QAItem) => void
  optimisticUpdate: (itemId: string, changes: Partial<QAItem>) => void
  rollbackUpdate: (itemId: string) => void
}

export function useQAItems(projectId: string, filters?: QAFilters): UseQAItemsReturn {
  const [items, setItems] = useState<QAItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Store original items for rollback
  const originalItemsRef = useRef<Map<string, QAItem>>(new Map())

  // Fetch items
  const fetchItems = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) {
          setIsLoading(true)
        } else {
          setIsRefreshing(true)
        }
        setError(null)

        const response: QAListResponse = await getQAItems(projectId, filters)
        setItems(response.items)

        // Clear rollback cache on fresh fetch
        originalItemsRef.current.clear()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Q&A items')
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [projectId, filters]
  )

  // Initial fetch
  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // Manual refresh
  const refresh = useCallback(async () => {
    await fetchItems(false)
  }, [fetchItems])

  // Update a single item in the list (after successful API call)
  const updateItem = useCallback((updatedItem: QAItem) => {
    setItems(prev =>
      prev.map(item => (item.id === updatedItem.id ? updatedItem : item))
    )
    // Clear from rollback cache
    originalItemsRef.current.delete(updatedItem.id)
  }, [])

  // Optimistic update - apply changes immediately before API call
  const optimisticUpdate = useCallback((itemId: string, changes: Partial<QAItem>) => {
    setItems(prev => {
      const currentItem = prev.find(item => item.id === itemId)
      if (!currentItem) return prev

      // Store original for potential rollback (only if not already stored)
      if (!originalItemsRef.current.has(itemId)) {
        originalItemsRef.current.set(itemId, { ...currentItem })
      }

      // Apply changes
      return prev.map(item =>
        item.id === itemId ? { ...item, ...changes } : item
      )
    })
  }, [])

  // Rollback an optimistic update
  const rollbackUpdate = useCallback((itemId: string) => {
    const originalItem = originalItemsRef.current.get(itemId)
    if (!originalItem) return

    setItems(prev =>
      prev.map(item => (item.id === itemId ? originalItem : item))
    )
    originalItemsRef.current.delete(itemId)
  }, [])

  return {
    items,
    isLoading,
    error,
    refresh,
    isRefreshing,
    updateItem,
    optimisticUpdate,
    rollbackUpdate,
  }
}
