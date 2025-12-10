'use client'

/**
 * useCIMs Hook
 * Fetches and manages CIMs for a project with CRUD operations
 * Story: E9.2 - CIM List & Entry UI
 * AC: #2-5 - Data fetching, create, delete operations
 *
 * Features:
 * - Fetches CIM list on mount
 * - Create CIM with optimistic UI
 * - Delete CIM with optimistic UI and rollback on error
 * - Refresh capability
 * - Loading and error states
 * - Toast notifications for success/error
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { CIMListItem } from '@/lib/types/cim'

interface CIMListResponse {
  items: CIMListItem[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

interface UseCIMsReturn {
  items: CIMListItem[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  isRefreshing: boolean
  createCIM: (title: string) => Promise<CIMListItem | null>
  deleteCIM: (cimId: string) => Promise<boolean>
  isCreating: boolean
  isDeleting: boolean
}

export function useCIMs(projectId: string): UseCIMsReturn {
  const [items, setItems] = useState<CIMListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Store original items for rollback on delete failure
  const originalItemsRef = useRef<CIMListItem[]>([])

  // Fetch CIMs
  const fetchCIMs = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) {
          setIsLoading(true)
        } else {
          setIsRefreshing(true)
        }
        setError(null)

        const response = await fetch(`/api/projects/${projectId}/cims`)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to load CIMs')
        }

        const data: CIMListResponse = await response.json()
        setItems(data.items)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load CIMs'
        setError(message)
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [projectId]
  )

  // Initial fetch
  useEffect(() => {
    fetchCIMs()
  }, [fetchCIMs])

  // Manual refresh
  const refresh = useCallback(async () => {
    await fetchCIMs(false)
  }, [fetchCIMs])

  // Create CIM
  const createCIM = useCallback(
    async (title: string): Promise<CIMListItem | null> => {
      try {
        setIsCreating(true)
        setError(null)

        const response = await fetch(`/api/projects/${projectId}/cims`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to create CIM')
        }

        const data = await response.json()
        const newCIM = data.cim as CIMListItem

        // Add to list (at the beginning since sorted by updated_at desc)
        setItems((prev) => [newCIM, ...prev])

        toast.success('CIM created successfully')
        return newCIM
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create CIM'
        toast.error(message)
        setError(message)
        return null
      } finally {
        setIsCreating(false)
      }
    },
    [projectId]
  )

  // Delete CIM with optimistic update
  const deleteCIM = useCallback(
    async (cimId: string): Promise<boolean> => {
      try {
        setIsDeleting(true)
        setError(null)

        // Store original items for rollback
        originalItemsRef.current = [...items]

        // Optimistic update - remove from list immediately
        setItems((prev) => prev.filter((item) => item.id !== cimId))

        const response = await fetch(`/api/projects/${projectId}/cims/${cimId}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to delete CIM')
        }

        toast.success('CIM deleted successfully')
        return true
      } catch (err) {
        // Rollback on error
        setItems(originalItemsRef.current)
        originalItemsRef.current = []

        const message = err instanceof Error ? err.message : 'Failed to delete CIM'
        toast.error(message)
        setError(message)
        return false
      } finally {
        setIsDeleting(false)
      }
    },
    [projectId, items]
  )

  return {
    items,
    isLoading,
    error,
    refresh,
    isRefreshing,
    createCIM,
    deleteCIM,
    isCreating,
    isDeleting,
  }
}
