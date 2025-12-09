'use client'

/**
 * Q&A Page Client Component
 * Main client-side wrapper for Q&A management with collaborative editing
 * Story: E8.2 - Q&A Management UI with Collaborative Editing (AC: all)
 *
 * Features:
 * - Table with category grouping and collapsible sections
 * - Inline editing with optimistic updates
 * - Conflict resolution for concurrent edits
 * - Filter controls with URL state persistence
 */

import { useState, useCallback } from 'react'
import { Plus, RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useQAItems } from '@/lib/hooks/useQAItems'
import { QATable } from './QATable'
import { QAFilterBar } from './QAFilterBar'
import { ConflictResolutionModal } from './ConflictResolutionModal'
import { QAItem, QAConflictError, QAFilters, isQAConflictError } from '@/lib/types/qa'
import { updateQAItem as apiUpdateQAItem } from '@/lib/api/qa'

interface QAPageClientProps {
  projectId: string
}

export function QAPageClient({ projectId }: QAPageClientProps) {
  // Filter state synced with URL params
  const [filters, setFilters] = useState<QAFilters>({})

  // Conflict resolution state
  const [conflictData, setConflictData] = useState<{
    conflict: QAConflictError
    pendingChanges: Partial<QAItem>
    itemId: string
  } | null>(null)

  // Data fetching hook
  const {
    items,
    isLoading,
    error,
    refresh,
    isRefreshing,
    updateItem,
    optimisticUpdate,
    rollbackUpdate,
  } = useQAItems(projectId, filters)

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: QAFilters) => {
    setFilters(newFilters)
  }, [])

  // Handle refresh button click
  const handleRefresh = useCallback(async () => {
    await refresh()
    toast.success('Q&A list refreshed')
  }, [refresh])

  // Handle inline save with conflict detection
  const handleSave = useCallback(
    async (itemId: string, changes: Partial<QAItem>) => {
      // Find the current item to get updatedAt
      const currentItem = items.find(item => item.id === itemId)
      if (!currentItem) {
        toast.error('Item not found')
        return
      }

      // Optimistic update
      optimisticUpdate(itemId, changes)

      try {
        const result = await apiUpdateQAItem(projectId, itemId, {
          ...changes,
          updatedAt: currentItem.updatedAt,
        })

        // Check for conflict
        if (isQAConflictError(result)) {
          // Rollback optimistic update
          rollbackUpdate(itemId)

          // Show conflict modal
          setConflictData({
            conflict: result,
            pendingChanges: changes,
            itemId,
          })
          return
        }

        // Update successful - refresh to get latest data
        updateItem(result)
        toast.success('Changes saved')
      } catch (err) {
        // Rollback on error
        rollbackUpdate(itemId)
        toast.error(err instanceof Error ? err.message : 'Failed to save changes')
      }
    },
    [items, projectId, optimisticUpdate, rollbackUpdate, updateItem]
  )

  // Handle conflict resolution - Keep Mine
  const handleKeepMine = useCallback(async () => {
    if (!conflictData) return

    const { itemId, pendingChanges, conflict } = conflictData

    try {
      // Force update with current server timestamp
      const result = await apiUpdateQAItem(projectId, itemId, {
        ...pendingChanges,
        updatedAt: conflict.currentItem.updatedAt,
      })

      if (isQAConflictError(result)) {
        toast.error('Failed to save - another conflict occurred')
        return
      }

      updateItem(result)
      setConflictData(null)
      toast.success('Your changes have been saved')
    } catch (err) {
      toast.error('Failed to save changes')
    }
  }, [conflictData, projectId, updateItem])

  // Handle conflict resolution - Keep Theirs
  const handleKeepTheirs = useCallback(async () => {
    if (!conflictData) return

    // Update local state with server version
    updateItem(conflictData.conflict.currentItem)
    setConflictData(null)
    toast.success('Loaded latest version')
  }, [conflictData, updateItem])

  // Handle conflict resolution - Merge
  const handleMerge = useCallback(
    async (mergedItem: Partial<QAItem>) => {
      if (!conflictData) return

      const { itemId, conflict } = conflictData

      try {
        const result = await apiUpdateQAItem(projectId, itemId, {
          ...mergedItem,
          updatedAt: conflict.currentItem.updatedAt,
        })

        if (isQAConflictError(result)) {
          toast.error('Failed to save merged changes - another conflict occurred')
          return
        }

        updateItem(result)
        setConflictData(null)
        toast.success('Merged changes saved')
      } catch (err) {
        toast.error('Failed to save merged changes')
      }
    },
    [conflictData, projectId, updateItem]
  )

  // Close conflict modal without action
  const handleCloseConflict = useCallback(() => {
    setConflictData(null)
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Q&A Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage questions for client due diligence. Track pending and answered items.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Question
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <QAFilterBar filters={filters} onFilterChange={handleFilterChange} />

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          <p className="font-medium">Failed to load Q&A items</p>
          <p className="text-sm mt-1">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={handleRefresh}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Table */}
      {!error && (
        <QATable
          items={items}
          isLoading={isLoading}
          onSave={handleSave}
          projectId={projectId}
        />
      )}

      {/* Conflict Resolution Modal */}
      {conflictData && (
        <ConflictResolutionModal
          open={!!conflictData}
          onOpenChange={(open) => !open && handleCloseConflict()}
          yourVersion={conflictData.pendingChanges}
          theirVersion={conflictData.conflict.currentItem}
          onKeepMine={handleKeepMine}
          onKeepTheirs={handleKeepTheirs}
          onMerge={handleMerge}
        />
      )}
    </div>
  )
}
