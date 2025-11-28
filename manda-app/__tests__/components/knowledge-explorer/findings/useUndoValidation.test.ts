/**
 * useUndoValidation Hook Tests
 * Story: E4.3 - Implement Inline Finding Validation (AC: 4)
 *
 * Tests:
 * - Saves undo state for validation actions
 * - Performs undo by calling onUndo callback
 * - Clears undo state after timeout
 * - Tracks remaining time
 * - Clears undo when new action performed
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useUndoValidation } from '@/components/knowledge-explorer/findings/useUndoValidation'
import type { Finding } from '@/lib/types/findings'

describe('useUndoValidation', () => {
  const mockFinding: Finding = {
    id: 'finding-123',
    dealId: 'deal-456',
    documentId: 'doc-789',
    chunkId: null,
    userId: 'user-abc',
    text: 'Original finding text',
    sourceDocument: 'document.pdf',
    pageNumber: 5,
    confidence: 0.85,
    findingType: 'fact',
    domain: 'financial',
    status: 'pending',
    validationHistory: [],
    metadata: null,
    createdAt: '2025-11-28T10:00:00Z',
    updatedAt: null,
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Initial State', () => {
    it('starts with no undo state', () => {
      const onUndo = vi.fn()
      const { result } = renderHook(() =>
        useUndoValidation({ onUndo })
      )

      expect(result.current.undoState).toBeNull()
      expect(result.current.canUndo).toBe(false)
      expect(result.current.remainingTime).toBe(0)
    })
  })

  describe('saveUndoState', () => {
    it('saves undo state for validate action', () => {
      const onUndo = vi.fn()
      const { result } = renderHook(() =>
        useUndoValidation({ onUndo })
      )

      act(() => {
        result.current.saveUndoState(mockFinding, 'validate')
      })

      expect(result.current.undoState).not.toBeNull()
      expect(result.current.undoState?.findingId).toBe('finding-123')
      expect(result.current.undoState?.previousStatus).toBe('pending')
      expect(result.current.undoState?.previousConfidence).toBe(0.85)
      expect(result.current.undoState?.action).toBe('validate')
      expect(result.current.canUndo).toBe(true)
    })

    it('saves undo state for reject action', () => {
      const onUndo = vi.fn()
      const { result } = renderHook(() =>
        useUndoValidation({ onUndo })
      )

      act(() => {
        result.current.saveUndoState(mockFinding, 'reject')
      })

      expect(result.current.undoState?.action).toBe('reject')
    })

    it('saves undo state for edit action with previous text', () => {
      const onUndo = vi.fn()
      const { result } = renderHook(() =>
        useUndoValidation({ onUndo })
      )

      act(() => {
        result.current.saveUndoState(mockFinding, 'edit', 'Original finding text')
      })

      expect(result.current.undoState?.action).toBe('edit')
      expect(result.current.undoState?.previousText).toBe('Original finding text')
    })

    it('sets remaining time to timeout in seconds', () => {
      const onUndo = vi.fn()
      const { result } = renderHook(() =>
        useUndoValidation({ timeout: 5000, onUndo })
      )

      act(() => {
        result.current.saveUndoState(mockFinding, 'validate')
      })

      expect(result.current.remainingTime).toBe(5)
    })

    it('clears previous undo state when saving new one', () => {
      const onUndo = vi.fn()
      const { result } = renderHook(() =>
        useUndoValidation({ onUndo })
      )

      act(() => {
        result.current.saveUndoState(mockFinding, 'validate')
      })

      const validatedFinding = { ...mockFinding, status: 'validated' as const }

      act(() => {
        result.current.saveUndoState(validatedFinding, 'reject')
      })

      expect(result.current.undoState?.action).toBe('reject')
      expect(result.current.undoState?.previousStatus).toBe('validated')
    })
  })

  describe('performUndo', () => {
    it('calls onUndo with saved state', async () => {
      const onUndo = vi.fn().mockResolvedValue(undefined)
      const { result } = renderHook(() =>
        useUndoValidation({ onUndo })
      )

      act(() => {
        result.current.saveUndoState(mockFinding, 'validate')
      })

      await act(async () => {
        await result.current.performUndo()
      })

      expect(onUndo).toHaveBeenCalledWith(expect.objectContaining({
        findingId: 'finding-123',
        previousStatus: 'pending',
        previousConfidence: 0.85,
        action: 'validate',
      }))
    })

    it('clears undo state after successful undo', async () => {
      const onUndo = vi.fn().mockResolvedValue(undefined)
      const { result } = renderHook(() =>
        useUndoValidation({ onUndo })
      )

      act(() => {
        result.current.saveUndoState(mockFinding, 'validate')
      })

      await act(async () => {
        await result.current.performUndo()
      })

      expect(result.current.undoState).toBeNull()
      expect(result.current.canUndo).toBe(false)
    })

    it('throws error and does not restore state if onUndo fails', async () => {
      const onUndo = vi.fn().mockRejectedValue(new Error('Undo failed'))
      const { result } = renderHook(() =>
        useUndoValidation({ onUndo })
      )

      act(() => {
        result.current.saveUndoState(mockFinding, 'validate')
      })

      await expect(act(async () => {
        await result.current.performUndo()
      })).rejects.toThrow('Undo failed')
    })

    it('does nothing if no undo state', async () => {
      const onUndo = vi.fn()
      const { result } = renderHook(() =>
        useUndoValidation({ onUndo })
      )

      await act(async () => {
        await result.current.performUndo()
      })

      expect(onUndo).not.toHaveBeenCalled()
    })
  })

  describe('Timeout Behavior (AC: 4)', () => {
    it('clears undo state after timeout', () => {
      const onUndo = vi.fn()
      const { result } = renderHook(() =>
        useUndoValidation({ timeout: 5000, onUndo })
      )

      act(() => {
        result.current.saveUndoState(mockFinding, 'validate')
      })

      expect(result.current.canUndo).toBe(true)

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(result.current.undoState).toBeNull()
      expect(result.current.canUndo).toBe(false)
    })

    it('decrements remaining time every second', () => {
      const onUndo = vi.fn()
      const { result } = renderHook(() =>
        useUndoValidation({ timeout: 5000, onUndo })
      )

      act(() => {
        result.current.saveUndoState(mockFinding, 'validate')
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
      const onUndo = vi.fn()
      const { result } = renderHook(() =>
        useUndoValidation({ timeout: 5000, onUndo })
      )

      act(() => {
        result.current.saveUndoState(mockFinding, 'validate')
      })

      act(() => {
        vi.advanceTimersByTime(3000)
      })

      expect(result.current.remainingTime).toBe(2)

      const validatedFinding = { ...mockFinding, status: 'validated' as const }
      act(() => {
        result.current.saveUndoState(validatedFinding, 'reject')
      })

      expect(result.current.remainingTime).toBe(5)
    })
  })

  describe('clearUndo', () => {
    it('clears undo state immediately', () => {
      const onUndo = vi.fn()
      const { result } = renderHook(() =>
        useUndoValidation({ onUndo })
      )

      act(() => {
        result.current.saveUndoState(mockFinding, 'validate')
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
      const onUndo = vi.fn()
      const { result } = renderHook(() =>
        useUndoValidation({ timeout: 5000, onUndo })
      )

      act(() => {
        result.current.saveUndoState(mockFinding, 'validate')
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
      const onUndo = vi.fn()
      const { result, unmount } = renderHook(() =>
        useUndoValidation({ timeout: 5000, onUndo })
      )

      act(() => {
        result.current.saveUndoState(mockFinding, 'validate')
      })

      unmount()

      // Should not throw or cause issues
      act(() => {
        vi.advanceTimersByTime(10000)
      })
    })
  })
})
