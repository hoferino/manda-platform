'use client'

/**
 * useSelectionState Hook
 * Manages selection state for bulk actions on findings
 * Story: E4.11 - Build Bulk Actions for Finding Management (AC: 1, 2, 3, 9)
 *
 * Features:
 * - Track selected finding IDs with Set for O(1) lookup
 * - Select/deselect individual findings
 * - Select all findings on current page
 * - Clear all selections
 * - Selection persists across view toggle (table ↔ card)
 * - Selection state updates don't cause full re-render (useMemo optimized)
 */

import { useState, useCallback, useMemo } from 'react'

export interface UseSelectionStateReturn {
  /** Set of selected finding IDs */
  selectedIds: Set<string>
  /** Array of selected finding IDs (for iteration) */
  selectedIdsArray: string[]
  /** Check if a finding is selected */
  isSelected: (id: string) => boolean
  /** Toggle selection of a single finding */
  toggle: (id: string) => void
  /** Select a single finding */
  select: (id: string) => void
  /** Deselect a single finding */
  deselect: (id: string) => void
  /** Select all findings from provided IDs */
  selectAll: (ids: string[]) => void
  /** Clear all selections */
  clearAll: () => void
  /** Number of selected items */
  count: number
  /** Check if all provided IDs are selected */
  areAllSelected: (ids: string[]) => boolean
  /** Check if some (but not all) provided IDs are selected */
  areSomeSelected: (ids: string[]) => boolean
}

export function useSelectionState(): UseSelectionStateReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Memoized array version for iteration (avoids creating new array on each render)
  const selectedIdsArray = useMemo(() => Array.from(selectedIds), [selectedIds])

  // Check if a finding is selected
  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  )

  // Toggle selection of a single finding
  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // Select a single finding
  const select = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.has(id)) return prev // No change needed
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  // Deselect a single finding
  const deselect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev // No change needed
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  // Select all findings from provided IDs
  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.add(id))
      return next
    })
  }, [])

  // Clear all selections
  const clearAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  // Check if all provided IDs are selected
  const areAllSelected = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return false
      return ids.every((id) => selectedIds.has(id))
    },
    [selectedIds]
  )

  // Check if some (but not all) provided IDs are selected
  const areSomeSelected = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return false
      const selectedCount = ids.filter((id) => selectedIds.has(id)).length
      return selectedCount > 0 && selectedCount < ids.length
    },
    [selectedIds]
  )

  return {
    selectedIds,
    selectedIdsArray,
    isSelected,
    toggle,
    select,
    deselect,
    selectAll,
    clearAll,
    count: selectedIds.size,
    areAllSelected,
    areSomeSelected,
  }
}
