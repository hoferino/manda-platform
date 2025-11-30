/**
 * useSelectionState Hook Tests
 * Story: E4.11 - Build Bulk Actions for Finding Management (AC: 1, 2, 3)
 *
 * Tests:
 * - Toggle selection of individual findings
 * - Select all findings on current page
 * - Clear all selections
 * - Selection count tracking
 * - areAllSelected and areSomeSelected helpers
 */

import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSelectionState } from '@/components/knowledge-explorer/findings/useSelectionState'

describe('useSelectionState', () => {
  describe('Initial State', () => {
    it('starts with empty selection', () => {
      const { result } = renderHook(() => useSelectionState())

      expect(result.current.selectedIds.size).toBe(0)
      expect(result.current.selectedIdsArray).toEqual([])
      expect(result.current.count).toBe(0)
    })

    it('isSelected returns false for any id initially', () => {
      const { result } = renderHook(() => useSelectionState())

      expect(result.current.isSelected('finding-1')).toBe(false)
      expect(result.current.isSelected('finding-2')).toBe(false)
    })
  })

  describe('toggle (AC: 1)', () => {
    it('adds id when not selected', () => {
      const { result } = renderHook(() => useSelectionState())

      act(() => {
        result.current.toggle('finding-1')
      })

      expect(result.current.isSelected('finding-1')).toBe(true)
      expect(result.current.count).toBe(1)
    })

    it('removes id when already selected', () => {
      const { result } = renderHook(() => useSelectionState())

      act(() => {
        result.current.toggle('finding-1')
      })

      expect(result.current.isSelected('finding-1')).toBe(true)

      act(() => {
        result.current.toggle('finding-1')
      })

      expect(result.current.isSelected('finding-1')).toBe(false)
      expect(result.current.count).toBe(0)
    })

    it('can toggle multiple findings independently', () => {
      const { result } = renderHook(() => useSelectionState())

      act(() => {
        result.current.toggle('finding-1')
        result.current.toggle('finding-2')
        result.current.toggle('finding-3')
      })

      expect(result.current.count).toBe(3)

      act(() => {
        result.current.toggle('finding-2')
      })

      expect(result.current.isSelected('finding-1')).toBe(true)
      expect(result.current.isSelected('finding-2')).toBe(false)
      expect(result.current.isSelected('finding-3')).toBe(true)
      expect(result.current.count).toBe(2)
    })
  })

  describe('select and deselect', () => {
    it('select adds id to selection', () => {
      const { result } = renderHook(() => useSelectionState())

      act(() => {
        result.current.select('finding-1')
      })

      expect(result.current.isSelected('finding-1')).toBe(true)
    })

    it('select is idempotent (does not duplicate)', () => {
      const { result } = renderHook(() => useSelectionState())

      act(() => {
        result.current.select('finding-1')
        result.current.select('finding-1')
        result.current.select('finding-1')
      })

      expect(result.current.count).toBe(1)
    })

    it('deselect removes id from selection', () => {
      const { result } = renderHook(() => useSelectionState())

      act(() => {
        result.current.select('finding-1')
        result.current.select('finding-2')
      })

      act(() => {
        result.current.deselect('finding-1')
      })

      expect(result.current.isSelected('finding-1')).toBe(false)
      expect(result.current.isSelected('finding-2')).toBe(true)
      expect(result.current.count).toBe(1)
    })

    it('deselect is idempotent (no error on non-existent)', () => {
      const { result } = renderHook(() => useSelectionState())

      act(() => {
        result.current.deselect('finding-1')
        result.current.deselect('non-existent')
      })

      expect(result.current.count).toBe(0)
    })
  })

  describe('selectAll (AC: 2)', () => {
    it('selects all provided IDs', () => {
      const { result } = renderHook(() => useSelectionState())
      const ids = ['finding-1', 'finding-2', 'finding-3']

      act(() => {
        result.current.selectAll(ids)
      })

      expect(result.current.count).toBe(3)
      expect(result.current.isSelected('finding-1')).toBe(true)
      expect(result.current.isSelected('finding-2')).toBe(true)
      expect(result.current.isSelected('finding-3')).toBe(true)
    })

    it('adds to existing selection without removing others', () => {
      const { result } = renderHook(() => useSelectionState())

      act(() => {
        result.current.select('existing-1')
        result.current.selectAll(['finding-1', 'finding-2'])
      })

      expect(result.current.count).toBe(3)
      expect(result.current.isSelected('existing-1')).toBe(true)
      expect(result.current.isSelected('finding-1')).toBe(true)
      expect(result.current.isSelected('finding-2')).toBe(true)
    })

    it('handles empty array gracefully', () => {
      const { result } = renderHook(() => useSelectionState())

      act(() => {
        result.current.selectAll([])
      })

      expect(result.current.count).toBe(0)
    })

    it('does not duplicate already selected IDs', () => {
      const { result } = renderHook(() => useSelectionState())

      act(() => {
        result.current.select('finding-1')
        result.current.selectAll(['finding-1', 'finding-2'])
      })

      expect(result.current.count).toBe(2)
    })
  })

  describe('clearAll (AC: 3)', () => {
    it('clears all selections', () => {
      const { result } = renderHook(() => useSelectionState())

      act(() => {
        result.current.selectAll(['finding-1', 'finding-2', 'finding-3'])
      })

      expect(result.current.count).toBe(3)

      act(() => {
        result.current.clearAll()
      })

      expect(result.current.count).toBe(0)
      expect(result.current.isSelected('finding-1')).toBe(false)
      expect(result.current.isSelected('finding-2')).toBe(false)
      expect(result.current.isSelected('finding-3')).toBe(false)
    })

    it('is safe to call on empty selection', () => {
      const { result } = renderHook(() => useSelectionState())

      act(() => {
        result.current.clearAll()
      })

      expect(result.current.count).toBe(0)
    })
  })

  describe('areAllSelected', () => {
    it('returns true when all provided IDs are selected', () => {
      const { result } = renderHook(() => useSelectionState())
      const ids = ['finding-1', 'finding-2', 'finding-3']

      act(() => {
        result.current.selectAll(ids)
      })

      expect(result.current.areAllSelected(ids)).toBe(true)
    })

    it('returns false when some IDs are not selected', () => {
      const { result } = renderHook(() => useSelectionState())

      act(() => {
        result.current.select('finding-1')
        result.current.select('finding-2')
      })

      expect(result.current.areAllSelected(['finding-1', 'finding-2', 'finding-3'])).toBe(false)
    })

    it('returns false for empty array', () => {
      const { result } = renderHook(() => useSelectionState())

      expect(result.current.areAllSelected([])).toBe(false)
    })

    it('returns true when selection includes more than provided IDs', () => {
      const { result } = renderHook(() => useSelectionState())

      act(() => {
        result.current.selectAll(['finding-1', 'finding-2', 'finding-3', 'finding-4'])
      })

      // Subset check
      expect(result.current.areAllSelected(['finding-1', 'finding-2'])).toBe(true)
    })
  })

  describe('areSomeSelected', () => {
    it('returns true when some but not all IDs are selected', () => {
      const { result } = renderHook(() => useSelectionState())

      act(() => {
        result.current.select('finding-1')
      })

      expect(result.current.areSomeSelected(['finding-1', 'finding-2', 'finding-3'])).toBe(true)
    })

    it('returns false when all IDs are selected', () => {
      const { result } = renderHook(() => useSelectionState())
      const ids = ['finding-1', 'finding-2', 'finding-3']

      act(() => {
        result.current.selectAll(ids)
      })

      expect(result.current.areSomeSelected(ids)).toBe(false)
    })

    it('returns false when no IDs are selected', () => {
      const { result } = renderHook(() => useSelectionState())

      expect(result.current.areSomeSelected(['finding-1', 'finding-2'])).toBe(false)
    })

    it('returns false for empty array', () => {
      const { result } = renderHook(() => useSelectionState())

      expect(result.current.areSomeSelected([])).toBe(false)
    })
  })

  describe('selectedIdsArray', () => {
    it('returns array of selected IDs', () => {
      const { result } = renderHook(() => useSelectionState())

      act(() => {
        result.current.select('finding-1')
        result.current.select('finding-2')
      })

      expect(result.current.selectedIdsArray).toHaveLength(2)
      expect(result.current.selectedIdsArray).toContain('finding-1')
      expect(result.current.selectedIdsArray).toContain('finding-2')
    })

    it('updates when selection changes', () => {
      const { result } = renderHook(() => useSelectionState())

      act(() => {
        result.current.select('finding-1')
      })

      const arrayAfterSelect = result.current.selectedIdsArray
      expect(arrayAfterSelect).toEqual(['finding-1'])

      act(() => {
        result.current.clearAll()
      })

      expect(result.current.selectedIdsArray).toEqual([])
    })
  })
})
