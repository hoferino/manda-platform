/**
 * Knowledge Explorer Realtime Composite Hook
 * Combines findings and contradictions realtime hooks
 * Story: E4.13 - Build Real-Time Knowledge Graph Updates (AC: #1, #4, #6, #8)
 *
 * Features:
 * - Aggregate connection status from both subscriptions
 * - Auto-refresh toggle state with localStorage persistence
 * - Combined counts for findings and contradictions
 * - Manual refresh/reconnect functionality
 * - Unified event callbacks
 */

'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  useFindingsRealtime,
  type FindingUpdate,
  type ConnectionStatus,
} from './useFindingsRealtime'
import {
  useContradictionsRealtime,
  type ContradictionUpdate,
} from './useContradictionsRealtime'

/**
 * Storage key for auto-refresh preference
 */
const AUTO_REFRESH_STORAGE_KEY = 'knowledge-explorer-auto-refresh'

/**
 * Realtime event - union of finding and contradiction updates
 */
export type RealtimeEvent =
  | { source: 'findings'; update: FindingUpdate }
  | { source: 'contradictions'; update: ContradictionUpdate }

/**
 * Aggregate connection status
 */
export type AggregateConnectionStatus =
  | 'connected'
  | 'connecting'
  | 'partial' // One connected, one not
  | 'disconnected'
  | 'error'

/**
 * Options for the useKnowledgeExplorerRealtime hook
 */
export interface UseKnowledgeExplorerRealtimeOptions {
  /** Callback when any realtime event occurs */
  onEvent?: (event: RealtimeEvent) => void
  /** Callback when aggregate connection status changes */
  onConnectionChange?: (status: AggregateConnectionStatus) => void
  /** Callback when findings update */
  onFindingsUpdate?: (update: FindingUpdate) => void
  /** Callback when contradictions update */
  onContradictionsUpdate?: (update: ContradictionUpdate) => void
  /** Initial auto-refresh state (default: true) */
  initialAutoRefresh?: boolean
  /** Debounce delay in milliseconds (default: 100) */
  debounceMs?: number
}

/**
 * Result from the useKnowledgeExplorerRealtime hook
 */
export interface UseKnowledgeExplorerRealtimeResult {
  /** Aggregate connection status */
  status: AggregateConnectionStatus
  /** Detailed connection status for each subscription */
  detailedStatus: {
    findings: ConnectionStatus
    contradictions: ConnectionStatus
  }
  /** Whether auto-refresh is enabled */
  autoRefresh: boolean
  /** Toggle auto-refresh on/off */
  setAutoRefresh: (enabled: boolean) => void
  /** Toggle auto-refresh */
  toggleAutoRefresh: () => void
  /** Manually reconnect both subscriptions */
  reconnect: () => void
  /** Findings counts */
  findingsCounts: {
    total: number
    pending: number
    validated: number
    rejected: number
  }
  /** Contradictions counts */
  contradictionsCounts: {
    total: number
    unresolved: number
    resolved: number
    investigating: number
    noted: number
  }
  /** Whether there are pending updates (when auto-refresh is off) */
  hasPendingUpdates: boolean
  /** Number of pending updates (when auto-refresh is off) */
  pendingUpdateCount: number
  /** Apply pending updates */
  applyPendingUpdates: () => void
  /** Clear pending updates without applying */
  clearPendingUpdates: () => void
}

/**
 * Compute aggregate status from individual statuses
 */
function computeAggregateStatus(
  findingsStatus: ConnectionStatus,
  contradictionsStatus: ConnectionStatus
): AggregateConnectionStatus {
  // If both have errors, show error
  if (findingsStatus === 'error' || contradictionsStatus === 'error') {
    return 'error'
  }

  // If both connected, show connected
  if (findingsStatus === 'connected' && contradictionsStatus === 'connected') {
    return 'connected'
  }

  // If both disconnected, show disconnected
  if (findingsStatus === 'disconnected' && contradictionsStatus === 'disconnected') {
    return 'disconnected'
  }

  // If one is connecting, show connecting
  if (findingsStatus === 'connecting' || contradictionsStatus === 'connecting') {
    return 'connecting'
  }

  // One connected, one disconnected
  return 'partial'
}

/**
 * Get auto-refresh preference from localStorage
 */
function getAutoRefreshPreference(projectId: string): boolean {
  if (typeof window === 'undefined') return true

  try {
    const stored = localStorage.getItem(`${AUTO_REFRESH_STORAGE_KEY}:${projectId}`)
    if (stored === null) return true
    return stored === 'true'
  } catch {
    return true
  }
}

/**
 * Save auto-refresh preference to localStorage
 */
function saveAutoRefreshPreference(projectId: string, enabled: boolean): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(`${AUTO_REFRESH_STORAGE_KEY}:${projectId}`, String(enabled))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Composite hook for Knowledge Explorer realtime updates
 *
 * Combines findings and contradictions realtime subscriptions,
 * manages auto-refresh toggle, and provides unified counts.
 *
 * @param projectId - The project ID to subscribe to
 * @param options - Hook options
 * @returns Realtime state and controls
 *
 * @example
 * ```tsx
 * const {
 *   status,
 *   autoRefresh,
 *   toggleAutoRefresh,
 *   findingsCounts,
 *   contradictionsCounts,
 * } = useKnowledgeExplorerRealtime(projectId, {
 *   onFindingsUpdate: (update) => {
 *     if (update.type === 'INSERT') {
 *       toast.success('New finding extracted!')
 *     }
 *   },
 * })
 * ```
 */
export function useKnowledgeExplorerRealtime(
  projectId: string | null | undefined,
  options: UseKnowledgeExplorerRealtimeOptions = {}
): UseKnowledgeExplorerRealtimeResult {
  const {
    onEvent,
    onConnectionChange,
    onFindingsUpdate,
    onContradictionsUpdate,
    initialAutoRefresh = true,
    debounceMs = 100,
  } = options

  // Auto-refresh state with localStorage persistence
  const [autoRefresh, setAutoRefreshState] = useState<boolean>(() => {
    if (!projectId) return initialAutoRefresh
    return getAutoRefreshPreference(projectId)
  })

  // Pending updates queue (when auto-refresh is off)
  const [pendingUpdates, setPendingUpdates] = useState<RealtimeEvent[]>([])
  const pendingUpdatesRef = useRef<RealtimeEvent[]>([])

  // Set auto-refresh with persistence
  const setAutoRefresh = useCallback(
    (enabled: boolean) => {
      setAutoRefreshState(enabled)
      if (projectId) {
        saveAutoRefreshPreference(projectId, enabled)
      }
    },
    [projectId]
  )

  // Toggle auto-refresh
  const toggleAutoRefresh = useCallback(() => {
    setAutoRefresh(!autoRefresh)
  }, [autoRefresh, setAutoRefresh])

  // Handle finding update
  const handleFindingUpdate = useCallback(
    (update: FindingUpdate) => {
      const event: RealtimeEvent = { source: 'findings', update }

      if (autoRefresh) {
        // Immediately dispatch events
        onEvent?.(event)
        onFindingsUpdate?.(update)
      } else {
        // Queue update for later
        pendingUpdatesRef.current.push(event)
        setPendingUpdates([...pendingUpdatesRef.current])
      }
    },
    [autoRefresh, onEvent, onFindingsUpdate]
  )

  // Handle contradiction update
  const handleContradictionUpdate = useCallback(
    (update: ContradictionUpdate) => {
      const event: RealtimeEvent = { source: 'contradictions', update }

      if (autoRefresh) {
        // Immediately dispatch events
        onEvent?.(event)
        onContradictionsUpdate?.(update)
      } else {
        // Queue update for later
        pendingUpdatesRef.current.push(event)
        setPendingUpdates([...pendingUpdatesRef.current])
      }
    },
    [autoRefresh, onEvent, onContradictionsUpdate]
  )

  // Use individual realtime hooks
  const {
    status: findingsStatus,
    reconnect: reconnectFindings,
    counts: findingsCounts,
  } = useFindingsRealtime(projectId, {
    onUpdate: handleFindingUpdate,
    enabled: true, // Always enabled, auto-refresh controls event dispatch
    debounceMs,
  })

  const {
    status: contradictionsStatus,
    reconnect: reconnectContradictions,
    counts: contradictionsCounts,
  } = useContradictionsRealtime(projectId, {
    onUpdate: handleContradictionUpdate,
    enabled: true,
    debounceMs,
  })

  // Compute aggregate status
  const status = useMemo(
    () => computeAggregateStatus(findingsStatus, contradictionsStatus),
    [findingsStatus, contradictionsStatus]
  )

  // Notify connection change
  useEffect(() => {
    onConnectionChange?.(status)
  }, [status, onConnectionChange])

  // Reconnect both subscriptions
  const reconnect = useCallback(() => {
    reconnectFindings()
    reconnectContradictions()
  }, [reconnectFindings, reconnectContradictions])

  // Apply pending updates
  const applyPendingUpdates = useCallback(() => {
    const updates = pendingUpdatesRef.current
    pendingUpdatesRef.current = []
    setPendingUpdates([])

    // Dispatch all queued events
    updates.forEach((event) => {
      onEvent?.(event)
      if (event.source === 'findings') {
        onFindingsUpdate?.(event.update)
      } else {
        onContradictionsUpdate?.(event.update)
      }
    })
  }, [onEvent, onFindingsUpdate, onContradictionsUpdate])

  // Clear pending updates without applying
  const clearPendingUpdates = useCallback(() => {
    pendingUpdatesRef.current = []
    setPendingUpdates([])
  }, [])

  // When auto-refresh is re-enabled, apply pending updates
  useEffect(() => {
    if (autoRefresh && pendingUpdatesRef.current.length > 0) {
      applyPendingUpdates()
    }
  }, [autoRefresh, applyPendingUpdates])

  // Register keyboard shortcut for toggle (Ctrl/Cmd+Shift+R)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
        e.preventDefault()
        toggleAutoRefresh()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleAutoRefresh])

  return {
    status,
    detailedStatus: {
      findings: findingsStatus,
      contradictions: contradictionsStatus,
    },
    autoRefresh,
    setAutoRefresh,
    toggleAutoRefresh,
    reconnect,
    findingsCounts,
    contradictionsCounts,
    hasPendingUpdates: pendingUpdates.length > 0,
    pendingUpdateCount: pendingUpdates.length,
    applyPendingUpdates,
    clearPendingUpdates,
  }
}
