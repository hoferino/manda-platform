/**
 * useBulkUndo Hook Tests
 * Story: E4.11 - Build Bulk Actions for Finding Management (AC: 9)
 *
 * Tests:
 * - Saves undo state for bulk validation actions
 * - Performs undo by calling batch API
 * - Clears undo state after timeout (5 seconds)
 * - Tracks remaining time
 * - Clears undo when new action performed
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBulkUndo } from '@/components/knowledge-explorer/findings/useBulkUndo'
import type { Finding } from '@/lib/types/findings'

// Mock the batch API
vi.mock('@/lib/api/findings', () => ({
  batchValidateFindings: vi.fn(),
}))

import { batchValidateFindings } from '@/lib/api/findings'

const mockBatchValidateFindings = batchValidateFindings as ReturnType<typeof vi.fn>

describe('useBulkUndo', () => {
  const mockFindings: Finding[] = [
    {
      id: 'finding-1',
      dealId: 'deal-456',
      documentId: 'doc-789',
      chunkId: null,
      userId: 'user-abc',
      text: 'Finding 1 text',
      sourceDocument: 'document.pdf',
      pageNumber: 1,
      confidence: 0.85,
      findingType: 'fact',
      domain: 'financial',
      status: 'pending',
      validationHistory: [],
      metadata: null,
      createdAt: '2025-11-28T10:00:00Z',
      updatedAt: null,
    },
    {
      id: 'finding-2',
      dealId: 'deal-456',
      documentId: 'doc-789',
      chunkId: null,
      userId: 'user-abc',
      text: 'Finding 2 text',
      sourceDocument: 'document.pdf',
      pageNumber: 2,
      confidence: 0.75,
      findingType: 'risk',
      domain: 'legal',
      status: 'pending',
      validationHistory: [],
      metadata: null,
      createdAt: '2025-11-28T10:00:00Z',
      updatedAt: null,
    },
    {
      id: 'finding-3',
      dealId: 'deal-456',
      documentId: 'doc-789',
      chunkId: null,
      userId: 'user-abc',
      text: 'Finding 3 text',
      sourceDocument: 'document.pdf',
      pageNumber: 3,
      confidence: 0.9,
      findingType: 'opportunity',
      domain: 'operational',
      status: 'validated',
      validationHistory: [],
      metadata: null,
      createdAt: '2025-11-28T10:00:00Z',
      updatedAt: null,
    },
  ]

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockBatchValidateFindings.mockResolvedValue({
      totalProcessed: 3,
      successful: 3,
      failed: 0,
      results: mockFindings.map((f) => ({
        findingId: f.id,
        success: true,
      })),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Initial State', () => {
    it('starts with no undo state', () => {
      const { result } = renderHook(() =>
        useBulkUndo({ projectId: 'project-123' })
      )

      expect(result.current.undoState).toBeNull()
      expect(result.current.canUndo).toBe(false)
      expect(result.current.remainingTime).toBe(0)
      expect(result.current.isUndoing).toBe(false)
    })
  })

  describe('saveUndoState (AC: 9)', () => {
    it('saves undo state for validate action', () => {
      const { result } = renderHook(() =>
        useBulkUndo({ projectId: 'project-123' })
      )

      act(() => {
        result.current.saveUndoState(mockFindings, 'validate')
      })

      expect(result.current.undoState).not.toBeNull()
      expect(result.current.undoState?.findingIds).toHaveLength(3)
      expect(result.current.undoState?.action).toBe('validate')
      expect(result.current.canUndo).toBe(true)
    })

    it('saves undo state for reject action', () => {
      const { result } = renderHook(() =>
        useBulkUndo({ projectId: 'project-123' })
      )

      act(() => {
        result.current.saveUndoState(mockFindings, 'reject')
      })

      expect(result.current.undoState?.action).toBe('reject')
    })

    it('stores previous states for each finding', () => {
      const { result } = renderHook(() =>
        useBulkUndo({ projectId: 'project-123' })
      )

      act(() => {
        result.current.saveUndoState(mockFindings, 'validate')
      })

      const previousStates = result.current.undoState?.previousStates
      expect(previousStates?.get('finding-1')).toEqual({
        status: 'pending',
        confidence: 0.85,
      })
      expect(previousStates?.get('finding-2')).toEqual({
        status: 'pending',
        confidence: 0.75,
      })
      expect(previousStates?.get('finding-3')).toEqual({
        status: 'validated',
        confidence: 0.9,
      })
    })

    it('sets remaining time to timeout in seconds', () => {
      const { result } = renderHook(() =>
        useBulkUndo({ projectId: 'project-123', timeout: 5000 })
      )

      act(() => {
        result.current.saveUndoState(mockFindings, 'validate')
      })

      expect(result.current.remainingTime).toBe(5)
    })

    it('clears previous undo state when saving new one', () => {
      const { result } = renderHook(() =>
        useBulkUndo({ projectId: 'project-123' })
      )

      const firstFinding = mockFindings[0]!
      act(() => {
        result.current.saveUndoState([firstFinding], 'validate')
      })

      expect(result.current.undoState?.findingIds).toHaveLength(1)

      act(() => {
        result.current.saveUndoState(mockFindings, 'reject')
      })

      expect(result.current.undoState?.findingIds).toHaveLength(3)
      expect(result.current.undoState?.action).toBe('reject')
    })
  })

  describe('performUndo', () => {
    it('calls batchValidateFindings with reverse action for validate', async () => {
      const onUndoComplete = vi.fn()
      const { result } = renderHook(() =>
        useBulkUndo({ projectId: 'project-123', onUndoComplete })
      )

      act(() => {
        result.current.saveUndoState(mockFindings, 'validate')
      })

      await act(async () => {
        await result.current.performUndo()
      })

      expect(mockBatchValidateFindings).toHaveBeenCalledWith(
        'project-123',
        'reject', // Reverse of validate
        ['finding-1', 'finding-2', 'finding-3']
      )
    })

    it('calls batchValidateFindings with reverse action for reject', async () => {
      const { result } = renderHook(() =>
        useBulkUndo({ projectId: 'project-123' })
      )

      act(() => {
        result.current.saveUndoState(mockFindings, 'reject')
      })

      await act(async () => {
        await result.current.performUndo()
      })

      expect(mockBatchValidateFindings).toHaveBeenCalledWith(
        'project-123',
        'confirm', // Reverse of reject
        ['finding-1', 'finding-2', 'finding-3']
      )
    })

    it('clears undo state after successful undo', async () => {
      const { result } = renderHook(() =>
        useBulkUndo({ projectId: 'project-123' })
      )

      act(() => {
        result.current.saveUndoState(mockFindings, 'validate')
      })

      await act(async () => {
        await result.current.performUndo()
      })

      expect(result.current.undoState).toBeNull()
      expect(result.current.canUndo).toBe(false)
    })

    it('calls onUndoComplete callback on success', async () => {
      const onUndoComplete = vi.fn()
      const { result } = renderHook(() =>
        useBulkUndo({ projectId: 'project-123', onUndoComplete })
      )

      act(() => {
        result.current.saveUndoState(mockFindings, 'validate')
      })

      await act(async () => {
        await result.current.performUndo()
      })

      expect(onUndoComplete).toHaveBeenCalled()
    })

    it('calls onUndoError callback on failure', async () => {
      mockBatchValidateFindings.mockRejectedValue(new Error('API Error'))
      const onUndoError = vi.fn()
      const { result } = renderHook(() =>
        useBulkUndo({ projectId: 'project-123', onUndoError })
      )

      act(() => {
        result.current.saveUndoState(mockFindings, 'validate')
      })

      await act(async () => {
        await result.current.performUndo()
      })

      expect(onUndoError).toHaveBeenCalledWith(expect.any(Error))
    })

    it('restores undo state if undo fails', async () => {
      mockBatchValidateFindings.mockRejectedValue(new Error('API Error'))
      const { result } = renderHook(() =>
        useBulkUndo({ projectId: 'project-123' })
      )

      act(() => {
        result.current.saveUndoState(mockFindings, 'validate')
      })

      await act(async () => {
        await result.current.performUndo()
      })

      // State should be restored
      expect(result.current.undoState).not.toBeNull()
      expect(result.current.undoState?.action).toBe('validate')
    })

    it('does nothing if no undo state', async () => {
      const { result } = renderHook(() =>
        useBulkUndo({ projectId: 'project-123' })
      )

      await act(async () => {
        await result.current.performUndo()
      })

      expect(mockBatchValidateFindings).not.toHaveBeenCalled()
    })

    it('sets isUndoing during operation', async () => {
      let resolvePromise: () => void
      const pendingPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve
      })
      mockBatchValidateFindings.mockReturnValue(pendingPromise.then(() => ({
        totalProcessed: 3,
        successful: 3,
        failed: 0,
        results: [],
      })))

      const { result } = renderHook(() =>
        useBulkUndo({ projectId: 'project-123' })
      )

      act(() => {
        result.current.saveUndoState(mockFindings, 'validate')
      })

      // Start undo but don't await
      let undoPromise: Promise<void>
      act(() => {
        undoPromise = result.current.performUndo()
      })

      expect(result.current.isUndoing).toBe(true)
      expect(result.current.canUndo).toBe(false)

      // Resolve the promise
      await act(async () => {
        resolvePromise!()
        await undoPromise!
      })

      expect(result.current.isUndoing).toBe(false)
    })
  })

  describe('Timeout Behavior (AC: 9)', () => {
    it('clears undo state after timeout', () => {
      const { result } = renderHook(() =>
        useBulkUndo({ projectId: 'project-123', timeout: 5000 })
      )

      act(() => {
        result.current.saveUndoState(mockFindings, 'validate')
      })

      expect(result.current.canUndo).toBe(true)

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(result.current.undoState).toBeNull()
      expect(result.current.canUndo).toBe(false)
    })

    it('decrements remaining time every second', () => {
      const { result } = renderHook(() =>
        useBulkUndo({ projectId: 'project-123', timeout: 5000 })
      )

      act(() => {
        result.current.saveUndoState(mockFindings, 'validate')
      })

      expect(result.current.remainingTime).toBe(5)

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(result.current.remainingTime).toBe(4)

      act(() => {
        vi.advanceTimersByTime(2000)
      })

      expect(result.current.remainingTime).toBe(2)
    })

    it('resets timer when saving new undo state', () => {
      const { result } = renderHook(() =>
        useBulkUndo({ projectId: 'project-123', timeout: 5000 })
      )

      const firstFinding = mockFindings[0]!
      act(() => {
        result.current.saveUndoState([firstFinding], 'validate')
      })

      act(() => {
        vi.advanceTimersByTime(3000)
      })

      expect(result.current.remainingTime).toBe(2)

      act(() => {
        result.current.saveUndoState(mockFindings, 'reject')
      })

      expect(result.current.remainingTime).toBe(5)
    })
  })

  describe('clearUndo', () => {
    it('clears undo state immediately', () => {
      const { result } = renderHook(() =>
        useBulkUndo({ projectId: 'project-123' })
      )

      act(() => {
        result.current.saveUndoState(mockFindings, 'validate')
      })

      expect(result.current.canUndo).toBe(true)

      act(() => {
        result.current.clearUndo()
      })

      expect(result.current.undoState).toBeNull()
      expect(result.current.canUndo).toBe(false)
      expect(result.current.remainingTime).toBe(0)
    })

    it('stops countdown timer', () => {
      const { result } = renderHook(() =>
        useBulkUndo({ projectId: 'project-123', timeout: 5000 })
      )

      act(() => {
        result.current.saveUndoState(mockFindings, 'validate')
      })

      act(() => {
        result.current.clearUndo()
      })

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      // Should stay at 0, not go negative
      expect(result.current.remainingTime).toBe(0)
    })
  })

  describe('Cleanup', () => {
    it('clears timers on unmount', () => {
      const { result, unmount } = renderHook(() =>
        useBulkUndo({ projectId: 'project-123', timeout: 5000 })
      )

      act(() => {
        result.current.saveUndoState(mockFindings, 'validate')
      })

      unmount()

      // Should not throw or cause issues
      act(() => {
        vi.advanceTimersByTime(10000)
      })
    })
  })
})
