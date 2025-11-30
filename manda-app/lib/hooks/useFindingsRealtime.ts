/**
 * Findings Realtime Updates Hook
 * Subscribes to Supabase Realtime for findings table changes
 * Story: E4.13 - Build Real-Time Knowledge Graph Updates (AC: #1, #2, #7)
 *
 * Features:
 * - Subscribe to findings table changes filtered by project_id (deal_id)
 * - Handle INSERT, UPDATE, DELETE events
 * - Transform database records to Finding types
 * - Debounced callbacks (100ms) to prevent UI thrashing
 * - Reconnection logic with exponential backoff
 * - Clean up subscription on component unmount
 */

'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { Finding, FindingStatus, FindingDomain, FindingType } from '@/lib/types/findings'

/**
 * Raw finding record from database
 */
interface FindingRecord {
  id: string
  deal_id: string
  document_id: string | null
  chunk_id: string | null
  user_id: string
  text: string
  source_document: string | null
  page_number: number | null
  confidence: number | null
  finding_type: string | null
  domain: string | null
  status: string | null
  validation_history: Record<string, unknown>[] | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string | null
}

/**
 * Finding update event types
 */
export type FindingUpdateType = 'INSERT' | 'UPDATE' | 'DELETE'

/**
 * Finding update payload
 */
export interface FindingUpdate {
  type: FindingUpdateType
  finding: Finding
  oldFinding?: Finding
}

/**
 * Connection status for the realtime subscription
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

/**
 * Options for the useFindingsRealtime hook
 */
export interface UseFindingsRealtimeOptions {
  /** Callback when a finding is updated */
  onUpdate?: (update: FindingUpdate) => void
  /** Callback when connection status changes */
  onConnectionChange?: (status: ConnectionStatus) => void
  /** Enable/disable the subscription (default: true) */
  enabled?: boolean
  /** Debounce delay in milliseconds (default: 100) */
  debounceMs?: number
}

/**
 * Transform database record to Finding type
 */
function transformToFinding(record: FindingRecord): Finding {
  return {
    id: record.id,
    dealId: record.deal_id,
    documentId: record.document_id,
    chunkId: record.chunk_id,
    userId: record.user_id,
    text: record.text,
    sourceDocument: record.source_document,
    pageNumber: record.page_number,
    confidence: record.confidence,
    findingType: record.finding_type as FindingType | null,
    domain: record.domain as FindingDomain | null,
    status: (record.status as FindingStatus) || 'pending',
    validationHistory: (record.validation_history || []) as unknown as Finding['validationHistory'],
    metadata: record.metadata,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

/**
 * Hook for subscribing to findings realtime updates
 *
 * @param projectId - The project ID to filter updates for
 * @param options - Hook options including callbacks
 * @returns Connection status, reconnect function, and counts
 *
 * @example
 * ```tsx
 * const { status, reconnect, counts } = useFindingsRealtime(projectId, {
 *   onUpdate: (update) => {
 *     if (update.type === 'INSERT') {
 *       toast.success(`New finding: ${update.finding.text.slice(0, 50)}...`)
 *     }
 *   },
 *   onConnectionChange: (status) => {
 *     console.log('Findings realtime status:', status)
 *   }
 * })
 * ```
 */
export function useFindingsRealtime(
  projectId: string | null | undefined,
  options: UseFindingsRealtimeOptions = {}
): {
  status: ConnectionStatus
  reconnect: () => void
  counts: { total: number; pending: number; validated: number; rejected: number }
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
    pending: 0,
    validated: 0,
    rejected: 0,
  })
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  // Debounce buffer for batching rapid updates
  const pendingUpdatesRef = useRef<FindingUpdate[]>([])
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
    (update: FindingUpdate) => {
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

  // Handle payload from realtime subscription
  const handlePayload = useCallback(
    (payload: RealtimePostgresChangesPayload<FindingRecord>) => {
      const eventType = payload.eventType as FindingUpdateType

      // For DELETE events, the record is in 'old', for others it's in 'new'
      const record =
        eventType === 'DELETE'
          ? (payload.old as FindingRecord)
          : (payload.new as FindingRecord)

      if (!record || !record.id) {
        return
      }

      const finding = transformToFinding(record)
      const oldFinding =
        eventType === 'UPDATE' && payload.old
          ? transformToFinding(payload.old as FindingRecord)
          : undefined

      // Update counts
      setCounts((prev) => {
        const newCounts = { ...prev }

        if (eventType === 'INSERT') {
          newCounts.total += 1
          if (finding.status === 'pending') newCounts.pending += 1
          else if (finding.status === 'validated') newCounts.validated += 1
          else if (finding.status === 'rejected') newCounts.rejected += 1
        } else if (eventType === 'DELETE') {
          newCounts.total -= 1
          if (finding.status === 'pending') newCounts.pending -= 1
          else if (finding.status === 'validated') newCounts.validated -= 1
          else if (finding.status === 'rejected') newCounts.rejected -= 1
        } else if (eventType === 'UPDATE' && oldFinding) {
          // Status changed - adjust counts
          if (oldFinding.status !== finding.status) {
            // Decrement old status count
            if (oldFinding.status === 'pending') newCounts.pending -= 1
            else if (oldFinding.status === 'validated') newCounts.validated -= 1
            else if (oldFinding.status === 'rejected') newCounts.rejected -= 1

            // Increment new status count
            if (finding.status === 'pending') newCounts.pending += 1
            else if (finding.status === 'validated') newCounts.validated += 1
            else if (finding.status === 'rejected') newCounts.rejected += 1
          }
        }

        return newCounts
      })

      // Queue the update (debounced)
      queueUpdate({
        type: eventType,
        finding,
        oldFinding,
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
    const channelName = `findings:project=${projectId}`

    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'findings',
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
 * Check if a finding status changed
 */
export function didFindingStatusChange(
  oldFinding: Finding | undefined,
  newFinding: Finding
): boolean {
  if (!oldFinding) return false
  return oldFinding.status !== newFinding.status
}

/**
 * Check if a finding was validated
 */
export function didFindingGetValidated(
  oldFinding: Finding | undefined,
  newFinding: Finding
): boolean {
  if (!oldFinding) return false
  return oldFinding.status !== 'validated' && newFinding.status === 'validated'
}

/**
 * Check if a finding was rejected
 */
export function didFindingGetRejected(
  oldFinding: Finding | undefined,
  newFinding: Finding
): boolean {
  if (!oldFinding) return false
  return oldFinding.status !== 'rejected' && newFinding.status === 'rejected'
}
