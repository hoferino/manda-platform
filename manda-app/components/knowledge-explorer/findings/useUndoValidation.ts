/**
 * useUndoValidation Hook
 * Manages undo state for validation actions with timeout
 * Story: E4.3 - Implement Inline Finding Validation (AC: 4)
 *
 * Features:
 * - Store previous state for undo capability
 * - 5-second timeout for undo window
 * - Clear undo state when new action performed or timeout expires
 * - Handle concurrent undo scenarios
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import type { Finding, FindingStatus } from '@/lib/types/findings'

export interface UndoState {
  findingId: string
  previousStatus: FindingStatus
  previousConfidence: number | null
  previousText?: string
  action: 'validate' | 'reject' | 'edit'
  timestamp: number
}

interface UseUndoValidationOptions {
  timeout?: number // Undo timeout in milliseconds (default: 5000)
  onUndo: (state: UndoState) => Promise<void>
}

interface UseUndoValidationReturn {
  undoState: UndoState | null
  canUndo: boolean
  remainingTime: number // seconds remaining
  saveUndoState: (
    finding: Finding,
    action: 'validate' | 'reject' | 'edit',
    previousText?: string
  ) => void
  performUndo: () => Promise<void>
  clearUndo: () => void
}

const UNDO_TIMEOUT = 5000 // 5 seconds

export function useUndoValidation({
  timeout = UNDO_TIMEOUT,
  onUndo,
}: UseUndoValidationOptions): UseUndoValidationReturn {
  const [undoState, setUndoState] = useState<UndoState | null>(null)
  const [remainingTime, setRemainingTime] = useState(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // Clear undo state
  const clearUndo = useCallback(() => {
    clearTimers()
    setUndoState(null)
    setRemainingTime(0)
  }, [clearTimers])

  // Save undo state
  const saveUndoState = useCallback(
    (finding: Finding, action: 'validate' | 'reject' | 'edit', previousText?: string) => {
      // Clear any existing undo
      clearUndo()

      const newState: UndoState = {
        findingId: finding.id,
        previousStatus: finding.status,
        previousConfidence: finding.confidence,
        previousText,
        action,
        timestamp: Date.now(),
      }

      setUndoState(newState)
      setRemainingTime(Math.ceil(timeout / 1000))

      // Start countdown interval
      intervalRef.current = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1) {
            clearUndo()
            return 0
          }
          return prev - 1
        })
      }, 1000)

      // Set timeout to clear undo state
      timeoutRef.current = setTimeout(() => {
        clearUndo()
      }, timeout)
    },
    [timeout, clearUndo]
  )

  // Perform undo
  const performUndo = useCallback(async () => {
    if (!undoState) return

    const stateToRevert = undoState
    clearUndo()

    try {
      await onUndo(stateToRevert)
    } catch (error) {
      // Restore undo state if undo failed
      console.error('Undo failed:', error)
      throw error
    }
  }, [undoState, clearUndo, onUndo])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers()
    }
  }, [clearTimers])

  return {
    undoState,
    canUndo: undoState !== null,
    remainingTime,
    saveUndoState,
    performUndo,
    clearUndo,
  }
}
