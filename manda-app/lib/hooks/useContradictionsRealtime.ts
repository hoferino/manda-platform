/**
 * Contradictions Realtime Updates Hook
 * Subscribes to Supabase Realtime for contradictions table changes
 * Story: E4.13 - Build Real-Time Knowledge Graph Updates (AC: #1, #3, #7)
 *
 * Features:
 * - Subscribe to contradictions table changes filtered by project_id (deal_id)
 * - Handle INSERT, UPDATE events (contradictions typically not deleted)
 * - Transform database records to Contradiction types
 * - Track resolved/unresolved counts
 * - Debounced callbacks (100ms) to prevent UI thrashing
 * - Reconnection logic with exponential backoff
 * - Clean up subscription on component unmount
 */

'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type {
  Contradiction,
  ContradictionStatus,
  ContradictionResolutionAction,
} from '@/lib/types/contradictions'

/**
 * Raw contradiction record from database
 */
interface ContradictionRecord {
  id: string
  deal_id: string
  finding_a_id: string
  finding_b_id: string
  confidence: number | null
  status: string | null
  resolution: string | null
  resolution_note: string | null
  detected_at: string
  resolved_at: string | null
  resolved_by: string | null
  metadata: Record<string, unknown> | null
}

/**
 * Contradiction update event types
 */
export type ContradictionUpdateType = 'INSERT' | 'UPDATE' | 'DELETE'

/**
 * Contradiction update payload
 */
export interface ContradictionUpdate {
  type: ContradictionUpdateType
  contradiction: Contradiction
  oldContradiction?: Contradiction
}

/**
 * Connection status for the realtime subscription
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

/**
 * Options for the useContradictionsRealtime hook
 */
export interface UseContradictionsRealtimeOptions {
  /** Callback when a contradiction is updated */
  onUpdate?: (update: ContradictionUpdate) => void
  /** Callback when connection status changes */
  onConnectionChange?: (status: ConnectionStatus) => void
  /** Enable/disable the subscription (default: true) */
  enabled?: boolean
  /** Debounce delay in milliseconds (default: 100) */
  debounceMs?: number
}

/**
 * Transform database record to Contradiction type
 */
function transformToContradiction(record: ContradictionRecord): Contradiction {
  return {
    id: record.id,
    dealId: record.deal_id,
    findingAId: record.finding_a_id,
    findingBId: record.finding_b_id,
    confidence: record.confidence,
    status: (record.status as ContradictionStatus) || 'unresolved',
    resolution: record.resolution as ContradictionResolutionAction | null,
    resolutionNote: record.resolution_note,
    detectedAt: record.detected_at,
    resolvedAt: record.resolved_at,
    resolvedBy: record.resolved_by,
    metadata: record.metadata,
  }
}

/**
 * Hook for subscribing to contradictions realtime updates
 *
 * @param projectId - The project ID to filter updates for
 * @param options - Hook options including callbacks
 * @returns Connection status, reconnect function, and counts
 *
 * @example
 * ```tsx
 * const { status, reconnect, counts } = useContradictionsRealtime(projectId, {
 *   onUpdate: (update) => {
 *     if (update.type === 'INSERT') {
 *       toast.warning('New contradiction detected!')
 *     }
 *   },
 *   onConnectionChange: (status) => {
 *     console.log('Contradictions realtime status:', status)
 *   }
 * })
 * ```
 */
export function useContradictionsRealtime(
  projectId: string | null | undefined,
  options: UseContradictionsRealtimeOptions = {}
): {
  status: ConnectionStatus
  reconnect: () => void
  counts: {
    total: number
    unresolved: number
    resolved: number
    investigating: number
    noted: number
  }
} {
  const {
    onUpdate,
    onConnectionChange,
    enabled = true,
    debounceMs = 100,
  } = options

  const channelRef = useRef<RealtimeChannel | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [counts, setCounts] = useState({
    total: 0,
    unresolved: 0,
    resolved: 0,
    investigating: 0,
    noted: 0,
  })
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  // Debounce buffer for batching rapid updates
  const pendingUpdatesRef = useRef<ContradictionUpdate[]>([])
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Update status and notify callback
  const updateStatus = useCallback(
    (newStatus: ConnectionStatus) => {
      setStatus(newStatus)
      onConnectionChange?.(newStatus)
    },
    [onConnectionChange]
  )

  // Process debounced updates
  const flushUpdates = useCallback(() => {
    if (pendingUpdatesRef.current.length === 0) return

    const updates = [...pendingUpdatesRef.current]
    pendingUpdatesRef.current = []

    // Process each update
    updates.forEach((update) => {
      onUpdate?.(update)
    })
  }, [onUpdate])

  // Queue an update with debouncing
  const queueUpdate = useCallback(
    (update: ContradictionUpdate) => {
      pendingUpdatesRef.current.push(update)

      // Clear existing timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }

      // Set new timeout
      debounceTimeoutRef.current = setTimeout(() => {
        flushUpdates()
      }, debounceMs)
    },
    [debounceMs, flushUpdates]
  )

  // Helper to get count key from status
  const getCountKey = (contradictionStatus: ContradictionStatus): keyof typeof counts => {
    switch (contradictionStatus) {
      case 'unresolved':
        return 'unresolved'
      case 'resolved':
        return 'resolved'
      case 'investigating':
        return 'investigating'
      case 'noted':
        return 'noted'
      default:
        return 'unresolved'
    }
  }

  // Handle payload from realtime subscription
  const handlePayload = useCallback(
    (payload: RealtimePostgresChangesPayload<ContradictionRecord>) => {
      const eventType = payload.eventType as ContradictionUpdateType

      // For DELETE events, the record is in 'old', for others it's in 'new'
      const record =
        eventType === 'DELETE'
          ? (payload.old as ContradictionRecord)
          : (payload.new as ContradictionRecord)

      if (!record || !record.id) {
        return
      }

      const contradiction = transformToContradiction(record)
      const oldContradiction =
        eventType === 'UPDATE' && payload.old
          ? transformToContradiction(payload.old as ContradictionRecord)
          : undefined

      // Update counts
      setCounts((prev) => {
        const newCounts = { ...prev }

        if (eventType === 'INSERT') {
          newCounts.total += 1
          const key = getCountKey(contradiction.status)
          newCounts[key] += 1
        } else if (eventType === 'DELETE') {
          newCounts.total -= 1
          const key = getCountKey(contradiction.status)
          newCounts[key] -= 1
        } else if (eventType === 'UPDATE' && oldContradiction) {
          // Status changed - adjust counts
          if (oldContradiction.status !== contradiction.status) {
            // Decrement old status count
            const oldKey = getCountKey(oldContradiction.status)
            newCounts[oldKey] -= 1

            // Increment new status count
            const newKey = getCountKey(contradiction.status)
            newCounts[newKey] += 1
          }
        }

        return newCounts
      })

      // Queue the update (debounced)
      queueUpdate({
        type: eventType,
        contradiction,
        oldContradiction,
      })
    },
    [queueUpdate]
  )

  // Subscribe to realtime updates
  const subscribe = useCallback(() => {
    if (!projectId || !enabled) {
      return
    }

    // Clean up existing subscription
    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
    }

    updateStatus('connecting')

    const supabase = createClient()
    const channelName = `contradictions:project=${projectId}`

    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contradictions',
          filter: `deal_id=eq.${projectId}`,
        },
        handlePayload
      )
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === 'SUBSCRIBED') {
          updateStatus('connected')
          reconnectAttempts.current = 0
        } else if (subscriptionStatus === 'CLOSED') {
          updateStatus('disconnected')
          // Attempt to reconnect with exponential backoff
          if (reconnectAttempts.current < maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttempts.current++
              subscribe()
            }, delay)
          }
        } else if (subscriptionStatus === 'CHANNEL_ERROR') {
          updateStatus('error')
        }
      })
  }, [projectId, enabled, handlePayload, updateStatus])

  // Manual reconnect function
  const reconnect = useCallback(() => {
    reconnectAttempts.current = 0
    subscribe()
  }, [subscribe])

  // Set up subscription on mount and when projectId changes
  useEffect(() => {
    subscribe()

    return () => {
      // Clean up on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        channelRef.current = null
      }
    }
  }, [subscribe])

  return { status, reconnect, counts }
}

/**
 * Check if a contradiction status changed
 */
export function didContradictionStatusChange(
  oldContradiction: Contradiction | undefined,
  newContradiction: Contradiction
): boolean {
  if (!oldContradiction) return false
  return oldContradiction.status !== newContradiction.status
}

/**
 * Check if a contradiction was resolved
 */
export function didContradictionGetResolved(
  oldContradiction: Contradiction | undefined,
  newContradiction: Contradiction
): boolean {
  if (!oldContradiction) return false
  return oldContradiction.status !== 'resolved' && newContradiction.status === 'resolved'
}

/**
 * Check if contradiction is unresolved
 */
export function isContradictionUnresolved(contradiction: Contradiction): boolean {
  return contradiction.status === 'unresolved'
}
