/**
 * Document Realtime Updates Hook
 * Subscribes to Supabase Realtime for document status changes
 * Story: E3.6 - Create Processing Status Tracking and WebSocket Updates (AC: #2)
 *
 * Features:
 * - Subscribe to documents table changes filtered by project_id
 * - Handle INSERT, UPDATE, DELETE events
 * - Reconnection logic on connection loss
 * - Clean up subscription on component unmount
 */

'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { Document, ProcessingStatus } from '@/lib/api/documents'
import type { DocumentCategory } from '@/lib/gcs/client'

/**
 * Raw document record from database
 */
interface DocumentRecord {
  id: string
  deal_id: string
  name: string
  file_size: number | null
  mime_type: string | null
  category: string | null
  folder_path: string | null
  upload_status: string
  processing_status: string
  processing_error: string | null
  findings_count: number | null
  created_at: string
  updated_at: string | null
}

/**
 * Document update event types
 */
export type DocumentUpdateType = 'INSERT' | 'UPDATE' | 'DELETE'

/**
 * Document update payload
 */
export interface DocumentUpdate {
  type: DocumentUpdateType
  document: Document
  oldDocument?: Document
}

/**
 * Connection status for the realtime subscription
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

/**
 * Options for the useDocumentUpdates hook
 */
export interface UseDocumentUpdatesOptions {
  /** Callback when a document is updated */
  onUpdate?: (update: DocumentUpdate) => void
  /** Callback when connection status changes */
  onConnectionChange?: (status: ConnectionStatus) => void
  /** Enable/disable the subscription (default: true) */
  enabled?: boolean
}

/**
 * Transform database record to Document type
 */
function transformToDocument(record: DocumentRecord): Document {
  return {
    id: record.id,
    projectId: record.deal_id,
    name: record.name,
    size: record.file_size,
    mimeType: record.mime_type,
    category: (record.category as DocumentCategory) || null,
    folderPath: record.folder_path || null,
    uploadStatus: record.upload_status as Document['uploadStatus'],
    processingStatus: record.processing_status as ProcessingStatus,
    processingError: record.processing_error || null,
    findingsCount: record.findings_count || null,
    createdAt: record.created_at,
    updatedAt: record.updated_at || undefined,
  }
}

/**
 * Hook for subscribing to document realtime updates
 *
 * @param projectId - The project ID to filter updates for
 * @param options - Hook options including callbacks
 * @returns Connection status and manual reconnect function
 *
 * @example
 * ```tsx
 * const { status, reconnect } = useDocumentUpdates(projectId, {
 *   onUpdate: (update) => {
 *     if (update.type === 'UPDATE') {
 *       // Handle document update
 *       queryClient.invalidateQueries(['documents', projectId])
 *     }
 *   },
 *   onConnectionChange: (status) => {
 *     console.log('Connection status:', status)
 *   }
 * })
 * ```
 */
export function useDocumentUpdates(
  projectId: string | null | undefined,
  options: UseDocumentUpdatesOptions = {}
): {
  status: ConnectionStatus
  reconnect: () => void
} {
  const { onUpdate, onConnectionChange, enabled = true } = options

  const channelRef = useRef<RealtimeChannel | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  // Update status and notify callback
  const updateStatus = useCallback(
    (newStatus: ConnectionStatus) => {
      setStatus(newStatus)
      onConnectionChange?.(newStatus)
    },
    [onConnectionChange]
  )

  // Handle payload from realtime subscription
  const handlePayload = useCallback(
    (payload: RealtimePostgresChangesPayload<DocumentRecord>) => {
      const eventType = payload.eventType as DocumentUpdateType

      // For DELETE events, the record is in 'old', for others it's in 'new'
      const record =
        eventType === 'DELETE'
          ? (payload.old as DocumentRecord)
          : (payload.new as DocumentRecord)

      if (!record || !record.id) {
        return
      }

      const document = transformToDocument(record)
      const oldDocument =
        eventType === 'UPDATE' && payload.old
          ? transformToDocument(payload.old as DocumentRecord)
          : undefined

      onUpdate?.({
        type: eventType,
        document,
        oldDocument,
      })
    },
    [onUpdate]
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
    const channelName = `documents:project=${projectId}`

    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
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
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        channelRef.current = null
      }
    }
  }, [subscribe])

  return { status, reconnect }
}

/**
 * Check if a processing status changed between old and new document
 */
export function didProcessingStatusChange(
  oldDoc: Document | undefined,
  newDoc: Document
): boolean {
  if (!oldDoc) return false
  return oldDoc.processingStatus !== newDoc.processingStatus
}

/**
 * Check if processing just completed (status changed to 'complete')
 */
export function didProcessingComplete(
  oldDoc: Document | undefined,
  newDoc: Document
): boolean {
  if (!oldDoc) return false
  return (
    oldDoc.processingStatus !== 'complete' && newDoc.processingStatus === 'complete'
  )
}

/**
 * Check if processing just failed
 */
export function didProcessingFail(
  oldDoc: Document | undefined,
  newDoc: Document
): boolean {
  if (!oldDoc) return false
  const failedStatuses = ['failed', 'analysis_failed']
  return (
    !failedStatuses.includes(oldDoc.processingStatus) &&
    failedStatuses.includes(newDoc.processingStatus)
  )
}
