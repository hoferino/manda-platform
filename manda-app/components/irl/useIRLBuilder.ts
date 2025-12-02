'use client'

/**
 * useIRLBuilder Hook
 *
 * State management for the IRL Builder component with optimistic updates.
 * Story: E6.2 - Implement IRL Creation and Editing
 *
 * Features:
 * - Load IRL with items
 * - Add/edit/delete items and categories
 * - Drag-and-drop reordering
 * - Status updates
 * - Optimistic updates with rollback
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  IRLWithItems,
  IRLItem,
  IRLProgress,
  UpdateIRLItemRequest,
  calculateIRLProgress,
  IRLPriority,
} from '@/lib/types/irl'

/** Simplified item creation input for the hook */
interface AddItemInput {
  itemName: string
  description?: string
  priority?: IRLPriority
  subcategory?: string
  notes?: string
}

interface UseIRLBuilderOptions {
  projectId: string
  irlId: string
  onError?: (error: string) => void
}

interface UseIRLBuilderReturn {
  // State
  irl: IRLWithItems | null
  items: IRLItem[]
  itemsByCategory: Record<string, IRLItem[]>
  categories: string[]
  progress: IRLProgress | null
  isLoading: boolean
  isSaving: boolean
  error: string | null
  hasUnsavedChanges: boolean

  // Actions
  loadIRL: () => Promise<void>
  updateTitle: (title: string) => Promise<void>
  addCategory: (name: string) => Promise<void>
  renameCategory: (oldName: string, newName: string) => Promise<void>
  deleteCategory: (name: string) => Promise<void>
  addItem: (category: string, item: AddItemInput) => Promise<void>
  updateItem: (itemId: string, updates: UpdateIRLItemRequest) => Promise<void>
  deleteItem: (itemId: string) => Promise<void>
  updateItemStatus: (itemId: string, status: IRLItem['status']) => Promise<void>
  reorderItems: (items: Array<{ id: string; sortOrder: number; category?: string }>) => Promise<void>
  discardChanges: () => void
}

export function useIRLBuilder({
  projectId,
  irlId,
  onError,
}: UseIRLBuilderOptions): UseIRLBuilderReturn {
  const [irl, setIRL] = useState<IRLWithItems | null>(null)
  const [items, setItems] = useState<IRLItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Track original state for discard
  const originalIRL = useRef<IRLWithItems | null>(null)

  // Compute derived state
  const itemsByCategory: Record<string, IRLItem[]> = {}
  for (const item of items) {
    if (!itemsByCategory[item.category]) {
      itemsByCategory[item.category] = []
    }
    itemsByCategory[item.category]!.push(item)
  }

  // Get unique categories preserving order
  const categories = Object.keys(itemsByCategory)

  // Calculate progress
  const progress = items.length > 0 ? calculateIRLProgress(items) : null

  // Handle errors
  const handleError = useCallback((message: string) => {
    setError(message)
    onError?.(message)
  }, [onError])

  // Load IRL from API
  const loadIRL = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/irls/${irlId}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to load IRL')
      }

      const data: IRLWithItems = await response.json()
      setIRL(data)
      setItems(data.items || [])
      originalIRL.current = data
      setHasUnsavedChanges(false)
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to load IRL')
    } finally {
      setIsLoading(false)
    }
  }, [projectId, irlId, handleError])

  // Initial load
  useEffect(() => {
    loadIRL()
  }, [loadIRL])

  // Update IRL title
  const updateTitle = useCallback(async (title: string) => {
    if (!irl) return

    const previousTitle = irl.title
    setIRL({ ...irl, title })
    setHasUnsavedChanges(true)
    setIsSaving(true)

    try {
      const response = await fetch(`/api/projects/${projectId}/irls/${irlId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update title')
      }

      setHasUnsavedChanges(false)
    } catch (err) {
      // Rollback
      setIRL({ ...irl, title: previousTitle })
      handleError(err instanceof Error ? err.message : 'Failed to update title')
    } finally {
      setIsSaving(false)
    }
  }, [irl, projectId, irlId, handleError])

  // Add category
  const addCategory = useCallback(async (name: string) => {
    setIsSaving(true)

    try {
      const response = await fetch(`/api/projects/${projectId}/irls/${irlId}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add category')
      }

      const data = await response.json()
      // Add the placeholder item
      if (data.firstItem) {
        setItems(prev => [...prev, data.firstItem])
      }
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to add category')
    } finally {
      setIsSaving(false)
    }
  }, [projectId, irlId, handleError])

  // Rename category
  const renameCategory = useCallback(async (oldName: string, newName: string) => {
    const previousItems = [...items]
    // Optimistically update
    setItems(items.map(item =>
      item.category === oldName ? { ...item, category: newName } : item
    ))
    setIsSaving(true)

    try {
      const response = await fetch(`/api/projects/${projectId}/irls/${irlId}/categories`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName, newName }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to rename category')
      }
    } catch (err) {
      // Rollback
      setItems(previousItems)
      handleError(err instanceof Error ? err.message : 'Failed to rename category')
    } finally {
      setIsSaving(false)
    }
  }, [items, projectId, irlId, handleError])

  // Delete category
  const deleteCategory = useCallback(async (name: string) => {
    const previousItems = [...items]
    // Optimistically remove items in this category
    setItems(items.filter(item => item.category !== name))
    setIsSaving(true)

    try {
      const response = await fetch(
        `/api/projects/${projectId}/irls/${irlId}/categories?name=${encodeURIComponent(name)}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete category')
      }
    } catch (err) {
      // Rollback
      setItems(previousItems)
      handleError(err instanceof Error ? err.message : 'Failed to delete category')
    } finally {
      setIsSaving(false)
    }
  }, [items, projectId, irlId, handleError])

  // Add item
  const addItem = useCallback(async (
    category: string,
    item: AddItemInput
  ) => {
    setIsSaving(true)

    try {
      const response = await fetch(`/api/projects/${projectId}/irls/${irlId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          itemName: item.itemName,
          description: item.description,
          priority: item.priority || 'medium',
          subcategory: item.subcategory,
          notes: item.notes,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add item')
      }

      const newItem: IRLItem = await response.json()
      setItems(prev => [...prev, newItem])
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to add item')
    } finally {
      setIsSaving(false)
    }
  }, [projectId, irlId, handleError])

  // Update item
  const updateItem = useCallback(async (itemId: string, updates: UpdateIRLItemRequest) => {
    const previousItems = [...items]
    const itemIndex = items.findIndex(i => i.id === itemId)
    if (itemIndex === -1) return

    // Optimistically update - convert null to undefined for compatibility
    const updatedItems = [...items]
    const existingItem = updatedItems[itemIndex]!
    const optimisticItem: IRLItem = {
      id: existingItem.id,
      irlId: existingItem.irlId,
      category: updates.category !== undefined ? updates.category : existingItem.category,
      subcategory: updates.subcategory !== undefined ? (updates.subcategory ?? undefined) : existingItem.subcategory,
      itemName: updates.itemName !== undefined ? updates.itemName : existingItem.itemName,
      description: updates.description !== undefined ? (updates.description ?? undefined) : existingItem.description,
      priority: updates.priority !== undefined ? updates.priority : existingItem.priority,
      status: updates.status !== undefined ? updates.status : existingItem.status,
      notes: updates.notes !== undefined ? (updates.notes ?? undefined) : existingItem.notes,
      sortOrder: updates.sortOrder !== undefined ? updates.sortOrder : existingItem.sortOrder,
      createdAt: existingItem.createdAt,
      updatedAt: existingItem.updatedAt,
    }
    updatedItems[itemIndex] = optimisticItem
    setItems(updatedItems)
    setHasUnsavedChanges(true)
    setIsSaving(true)

    try {
      const response = await fetch(
        `/api/projects/${projectId}/irls/${irlId}/items/${itemId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update item')
      }

      const updatedItem: IRLItem = await response.json()
      setItems(prev =>
        prev.map(i => i.id === itemId ? updatedItem : i)
      )
      setHasUnsavedChanges(false)
    } catch (err) {
      // Rollback
      setItems(previousItems)
      handleError(err instanceof Error ? err.message : 'Failed to update item')
    } finally {
      setIsSaving(false)
    }
  }, [items, projectId, irlId, handleError])

  // Delete item
  const deleteItem = useCallback(async (itemId: string) => {
    const previousItems = [...items]
    // Optimistically remove
    setItems(items.filter(i => i.id !== itemId))
    setIsSaving(true)

    try {
      const response = await fetch(
        `/api/projects/${projectId}/irls/${irlId}/items/${itemId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete item')
      }
    } catch (err) {
      // Rollback
      setItems(previousItems)
      handleError(err instanceof Error ? err.message : 'Failed to delete item')
    } finally {
      setIsSaving(false)
    }
  }, [items, projectId, irlId, handleError])

  // Update item status (shorthand)
  const updateItemStatus = useCallback(async (
    itemId: string,
    status: IRLItem['status']
  ) => {
    await updateItem(itemId, { status })
  }, [updateItem])

  // Reorder items
  const reorderItems = useCallback(async (
    reorderData: Array<{ id: string; sortOrder: number; category?: string }>
  ) => {
    const previousItems = [...items]

    // Optimistically update order
    const updatedItems = items.map(item => {
      const update = reorderData.find(r => r.id === item.id)
      if (update) {
        return {
          ...item,
          sortOrder: update.sortOrder,
          category: update.category ?? item.category,
        }
      }
      return item
    }).sort((a, b) => a.sortOrder - b.sortOrder)

    setItems(updatedItems)
    setIsSaving(true)

    try {
      const response = await fetch(`/api/projects/${projectId}/irls/${irlId}/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: reorderData }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to reorder items')
      }
    } catch (err) {
      // Rollback
      setItems(previousItems)
      handleError(err instanceof Error ? err.message : 'Failed to reorder items')
    } finally {
      setIsSaving(false)
    }
  }, [items, projectId, irlId, handleError])

  // Discard changes
  const discardChanges = useCallback(() => {
    if (originalIRL.current) {
      setIRL(originalIRL.current)
      setItems(originalIRL.current.items || [])
      setHasUnsavedChanges(false)
    }
  }, [])

  return {
    // State
    irl,
    items,
    itemsByCategory,
    categories,
    progress,
    isLoading,
    isSaving,
    error,
    hasUnsavedChanges,

    // Actions
    loadIRL,
    updateTitle,
    addCategory,
    renameCategory,
    deleteCategory,
    addItem,
    updateItem,
    deleteItem,
    updateItemStatus,
    reorderItems,
    discardChanges,
  }
}
