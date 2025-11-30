/**
 * RealtimeToastHandler Component
 * Listens to realtime events and dispatches toast notifications
 * Story: E4.13 - Build Real-Time Knowledge Graph Updates (AC: #5)
 *
 * Features:
 * - Toast notification for new finding extracted
 * - Toast for new contradiction detected
 * - Toast for processing completion
 * - Toast queue with max 3 visible
 * - Click handler to navigate to item
 * - Auto-hide after 5 seconds
 */

'use client'

import { useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { RealtimeEvent } from '@/lib/hooks/useKnowledgeExplorerRealtime'
import type { FindingUpdate } from '@/lib/hooks/useFindingsRealtime'
import type { ContradictionUpdate } from '@/lib/hooks/useContradictionsRealtime'

/**
 * Maximum number of simultaneous toasts
 */
const MAX_VISIBLE_TOASTS = 3

/**
 * Toast queue entry
 */
interface QueuedToast {
  id: string
  type: 'finding' | 'contradiction' | 'processing'
  message: string
  timestamp: number
}

export interface RealtimeToastHandlerProps {
  /** Project ID for navigation */
  projectId: string
  /** Whether toast notifications are enabled */
  enabled?: boolean
  /** Callback when user clicks a toast to navigate */
  onNavigateToFinding?: (findingId: string) => void
  /** Callback when user clicks a toast to navigate to contradictions */
  onNavigateToContradiction?: (contradictionId: string) => void
}

/**
 * Get document name from finding update
 */
function getDocumentName(update: FindingUpdate): string {
  const finding = update.finding
  return finding.sourceDocument || 'a document'
}

/**
 * Truncate text for display
 */
function truncateText(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

/**
 * RealtimeToastHandler - Render this component to enable realtime toast notifications
 * It doesn't render any visible UI, just listens to events and dispatches toasts
 */
export function RealtimeToastHandler({
  projectId,
  enabled = true,
  onNavigateToFinding,
  onNavigateToContradiction,
}: RealtimeToastHandlerProps) {
  const router = useRouter()
  const queueRef = useRef<QueuedToast[]>([])
  const activeToastsRef = useRef<Set<string>>(new Set())

  // Process queue - show next toast if under limit
  const processQueue = useCallback(() => {
    if (activeToastsRef.current.size >= MAX_VISIBLE_TOASTS) return
    if (queueRef.current.length === 0) return

    const nextToast = queueRef.current.shift()
    if (!nextToast) return

    activeToastsRef.current.add(nextToast.id)

    // Show toast based on type
    const toastId = toast(nextToast.message, {
      duration: 5000,
      onDismiss: () => {
        activeToastsRef.current.delete(nextToast.id)
        // Process next in queue
        processQueue()
      },
      onAutoClose: () => {
        activeToastsRef.current.delete(nextToast.id)
        // Process next in queue
        processQueue()
      },
    })

    return toastId
  }, [])

  // Queue a toast notification
  const queueToast = useCallback(
    (toast: Omit<QueuedToast, 'timestamp'>) => {
      queueRef.current.push({
        ...toast,
        timestamp: Date.now(),
      })
      processQueue()
    },
    [processQueue]
  )

  // Handle finding update
  const handleFindingUpdate = useCallback(
    (update: FindingUpdate) => {
      if (!enabled) return

      const { type, finding } = update

      if (type === 'INSERT') {
        const documentName = getDocumentName(update)
        const message = `New finding extracted from ${documentName}`

        // Show toast with click action
        toast.success(message, {
          duration: 5000,
          action: {
            label: 'View',
            onClick: () => {
              if (onNavigateToFinding) {
                onNavigateToFinding(finding.id)
              } else {
                // Navigate using URL
                router.push(
                  `/projects/${projectId}/knowledge?findingId=${finding.id}`
                )
              }
            },
          },
        })
      }
    },
    [enabled, projectId, router, onNavigateToFinding]
  )

  // Handle contradiction update
  const handleContradictionUpdate = useCallback(
    (update: ContradictionUpdate) => {
      if (!enabled) return

      const { type, contradiction } = update

      if (type === 'INSERT') {
        const message = `New contradiction detected`

        toast.warning(message, {
          duration: 5000,
          action: {
            label: 'View',
            onClick: () => {
              if (onNavigateToContradiction) {
                onNavigateToContradiction(contradiction.id)
              } else {
                // Navigate to contradictions tab
                router.push(`/projects/${projectId}/knowledge?tab=contradictions`)
              }
            },
          },
        })
      }
    },
    [enabled, projectId, router, onNavigateToContradiction]
  )

  // Return handlers for external use
  return {
    handleFindingUpdate,
    handleContradictionUpdate,
    queueToast,
  }
}

/**
 * Hook version for use in components that manage their own event handling
 */
export function useRealtimeToasts({
  projectId,
  enabled = true,
  onNavigateToFinding,
  onNavigateToContradiction,
}: RealtimeToastHandlerProps) {
  const router = useRouter()
  const queueRef = useRef<QueuedToast[]>([])
  const activeToastsRef = useRef<Set<string>>(new Set())

  // Process queue - show next toast if under limit
  const processQueue = useCallback(() => {
    if (activeToastsRef.current.size >= MAX_VISIBLE_TOASTS) return
    if (queueRef.current.length === 0) return

    const nextToast = queueRef.current.shift()
    if (!nextToast) return

    activeToastsRef.current.add(nextToast.id)

    // Show toast
    toast(nextToast.message, {
      duration: 5000,
      onDismiss: () => {
        activeToastsRef.current.delete(nextToast.id)
        processQueue()
      },
      onAutoClose: () => {
        activeToastsRef.current.delete(nextToast.id)
        processQueue()
      },
    })
  }, [])

  // Queue a toast
  const queueToast = useCallback(
    (toastData: Omit<QueuedToast, 'timestamp'>) => {
      queueRef.current.push({
        ...toastData,
        timestamp: Date.now(),
      })
      processQueue()
    },
    [processQueue]
  )

  // Handle finding update
  const handleFindingUpdate = useCallback(
    (update: FindingUpdate) => {
      if (!enabled) return

      const { type, finding } = update

      if (type === 'INSERT') {
        const documentName = finding.sourceDocument || 'a document'
        const message = `New finding extracted from ${documentName}`

        toast.success(message, {
          duration: 5000,
          action: {
            label: 'View',
            onClick: () => {
              if (onNavigateToFinding) {
                onNavigateToFinding(finding.id)
              } else {
                router.push(
                  `/projects/${projectId}/knowledge?findingId=${finding.id}`
                )
              }
            },
          },
        })
      }
    },
    [enabled, projectId, router, onNavigateToFinding]
  )

  // Handle contradiction update
  const handleContradictionUpdate = useCallback(
    (update: ContradictionUpdate) => {
      if (!enabled) return

      const { type, contradiction } = update

      if (type === 'INSERT') {
        toast.warning('New contradiction detected', {
          duration: 5000,
          action: {
            label: 'View',
            onClick: () => {
              if (onNavigateToContradiction) {
                onNavigateToContradiction(contradiction.id)
              } else {
                router.push(`/projects/${projectId}/knowledge?tab=contradictions`)
              }
            },
          },
        })
      }
    },
    [enabled, projectId, router, onNavigateToContradiction]
  )

  // Handle generic realtime event
  const handleRealtimeEvent = useCallback(
    (event: RealtimeEvent) => {
      if (!enabled) return

      if (event.source === 'findings') {
        handleFindingUpdate(event.update)
      } else if (event.source === 'contradictions') {
        handleContradictionUpdate(event.update)
      }
    },
    [enabled, handleFindingUpdate, handleContradictionUpdate]
  )

  // Show processing complete toast
  const showProcessingComplete = useCallback(
    (documentName: string, findingsCount: number) => {
      if (!enabled) return

      const message =
        findingsCount > 0
          ? `${documentName} processing complete - ${findingsCount} findings extracted`
          : `${documentName} processing complete`

      toast.success(message, {
        duration: 5000,
      })
    },
    [enabled]
  )

  return {
    handleFindingUpdate,
    handleContradictionUpdate,
    handleRealtimeEvent,
    showProcessingComplete,
    queueToast,
  }
}
