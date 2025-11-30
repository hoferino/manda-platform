/**
 * Tests for useKnowledgeExplorerRealtime composite hook
 * Story: E4.13 - Build Real-Time Knowledge Graph Updates (AC: #1, #4, #6, #8)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useKnowledgeExplorerRealtime } from '@/lib/hooks/useKnowledgeExplorerRealtime'

// Mock the child hooks
vi.mock('@/lib/hooks/useFindingsRealtime', () => ({
  useFindingsRealtime: vi.fn(() => ({
    status: 'connected',
    reconnect: vi.fn(),
    counts: { total: 10, pending: 5, validated: 3, rejected: 2 },
  })),
}))

vi.mock('@/lib/hooks/useContradictionsRealtime', () => ({
  useContradictionsRealtime: vi.fn(() => ({
    status: 'connected',
    reconnect: vi.fn(),
    counts: { total: 3, unresolved: 2, resolved: 1, investigating: 0, noted: 0 },
  })),
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('useKnowledgeExplorerRealtime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should return connected status when both hooks are connected', async () => {
    const { useFindingsRealtime } = await import('@/lib/hooks/useFindingsRealtime')
    const { useContradictionsRealtime } = await import('@/lib/hooks/useContradictionsRealtime')

    ;(useFindingsRealtime as ReturnType<typeof vi.fn>).mockReturnValue({
      status: 'connected',
      reconnect: vi.fn(),
      counts: { total: 10, pending: 5, validated: 3, rejected: 2 },
    })

    ;(useContradictionsRealtime as ReturnType<typeof vi.fn>).mockReturnValue({
      status: 'connected',
      reconnect: vi.fn(),
      counts: { total: 3, unresolved: 2, resolved: 1, investigating: 0, noted: 0 },
    })

    const { result } = renderHook(() =>
      useKnowledgeExplorerRealtime('project-123')
    )

    expect(result.current.status).toBe('connected')
    expect(result.current.detailedStatus.findings).toBe('connected')
    expect(result.current.detailedStatus.contradictions).toBe('connected')
  })

  it('should return partial status when one is disconnected', async () => {
    const { useFindingsRealtime } = await import('@/lib/hooks/useFindingsRealtime')
    const { useContradictionsRealtime } = await import('@/lib/hooks/useContradictionsRealtime')

    ;(useFindingsRealtime as ReturnType<typeof vi.fn>).mockReturnValue({
      status: 'connected',
      reconnect: vi.fn(),
      counts: { total: 10, pending: 5, validated: 3, rejected: 2 },
    })

    ;(useContradictionsRealtime as ReturnType<typeof vi.fn>).mockReturnValue({
      status: 'disconnected',
      reconnect: vi.fn(),
      counts: { total: 0, unresolved: 0, resolved: 0, investigating: 0, noted: 0 },
    })

    const { result } = renderHook(() =>
      useKnowledgeExplorerRealtime('project-123')
    )

    expect(result.current.status).toBe('partial')
  })

  it('should return disconnected when both are disconnected', async () => {
    const { useFindingsRealtime } = await import('@/lib/hooks/useFindingsRealtime')
    const { useContradictionsRealtime } = await import('@/lib/hooks/useContradictionsRealtime')

    ;(useFindingsRealtime as ReturnType<typeof vi.fn>).mockReturnValue({
      status: 'disconnected',
      reconnect: vi.fn(),
      counts: { total: 0, pending: 0, validated: 0, rejected: 0 },
    })

    ;(useContradictionsRealtime as ReturnType<typeof vi.fn>).mockReturnValue({
      status: 'disconnected',
      reconnect: vi.fn(),
      counts: { total: 0, unresolved: 0, resolved: 0, investigating: 0, noted: 0 },
    })

    const { result } = renderHook(() =>
      useKnowledgeExplorerRealtime('project-123')
    )

    expect(result.current.status).toBe('disconnected')
  })

  it('should return error status if either has error', async () => {
    const { useFindingsRealtime } = await import('@/lib/hooks/useFindingsRealtime')
    const { useContradictionsRealtime } = await import('@/lib/hooks/useContradictionsRealtime')

    ;(useFindingsRealtime as ReturnType<typeof vi.fn>).mockReturnValue({
      status: 'error',
      reconnect: vi.fn(),
      counts: { total: 0, pending: 0, validated: 0, rejected: 0 },
    })

    ;(useContradictionsRealtime as ReturnType<typeof vi.fn>).mockReturnValue({
      status: 'connected',
      reconnect: vi.fn(),
      counts: { total: 3, unresolved: 2, resolved: 1, investigating: 0, noted: 0 },
    })

    const { result } = renderHook(() =>
      useKnowledgeExplorerRealtime('project-123')
    )

    expect(result.current.status).toBe('error')
  })

  it('should initialize autoRefresh from localStorage', () => {
    localStorageMock.getItem.mockReturnValue('false')

    const { result } = renderHook(() =>
      useKnowledgeExplorerRealtime('project-123')
    )

    expect(result.current.autoRefresh).toBe(false)
  })

  it('should default autoRefresh to true when no stored preference', () => {
    localStorageMock.getItem.mockReturnValue(null)

    const { result } = renderHook(() =>
      useKnowledgeExplorerRealtime('project-123')
    )

    expect(result.current.autoRefresh).toBe(true)
  })

  it('should persist autoRefresh to localStorage when changed', () => {
    const { result } = renderHook(() =>
      useKnowledgeExplorerRealtime('project-123')
    )

    act(() => {
      result.current.setAutoRefresh(false)
    })

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'knowledge-explorer-auto-refresh:project-123',
      'false'
    )
    expect(result.current.autoRefresh).toBe(false)
  })

  it('should toggle autoRefresh', () => {
    const { result } = renderHook(() =>
      useKnowledgeExplorerRealtime('project-123')
    )

    expect(result.current.autoRefresh).toBe(true)

    act(() => {
      result.current.toggleAutoRefresh()
    })

    expect(result.current.autoRefresh).toBe(false)

    act(() => {
      result.current.toggleAutoRefresh()
    })

    expect(result.current.autoRefresh).toBe(true)
  })

  it('should call both reconnect functions', async () => {
    const findingsReconnect = vi.fn()
    const contradictionsReconnect = vi.fn()

    const { useFindingsRealtime } = await import('@/lib/hooks/useFindingsRealtime')
    const { useContradictionsRealtime } = await import('@/lib/hooks/useContradictionsRealtime')

    ;(useFindingsRealtime as ReturnType<typeof vi.fn>).mockReturnValue({
      status: 'disconnected',
      reconnect: findingsReconnect,
      counts: { total: 0, pending: 0, validated: 0, rejected: 0 },
    })

    ;(useContradictionsRealtime as ReturnType<typeof vi.fn>).mockReturnValue({
      status: 'disconnected',
      reconnect: contradictionsReconnect,
      counts: { total: 0, unresolved: 0, resolved: 0, investigating: 0, noted: 0 },
    })

    const { result } = renderHook(() =>
      useKnowledgeExplorerRealtime('project-123')
    )

    act(() => {
      result.current.reconnect()
    })

    expect(findingsReconnect).toHaveBeenCalled()
    expect(contradictionsReconnect).toHaveBeenCalled()
  })

  it('should expose findings and contradictions counts', async () => {
    const { useFindingsRealtime } = await import('@/lib/hooks/useFindingsRealtime')
    const { useContradictionsRealtime } = await import('@/lib/hooks/useContradictionsRealtime')

    ;(useFindingsRealtime as ReturnType<typeof vi.fn>).mockReturnValue({
      status: 'connected',
      reconnect: vi.fn(),
      counts: { total: 10, pending: 5, validated: 3, rejected: 2 },
    })

    ;(useContradictionsRealtime as ReturnType<typeof vi.fn>).mockReturnValue({
      status: 'connected',
      reconnect: vi.fn(),
      counts: { total: 3, unresolved: 2, resolved: 1, investigating: 0, noted: 0 },
    })

    const { result } = renderHook(() =>
      useKnowledgeExplorerRealtime('project-123')
    )

    expect(result.current.findingsCounts).toEqual({
      total: 10,
      pending: 5,
      validated: 3,
      rejected: 2,
    })

    expect(result.current.contradictionsCounts).toEqual({
      total: 3,
      unresolved: 2,
      resolved: 1,
      investigating: 0,
      noted: 0,
    })
  })

  it('should queue updates when autoRefresh is off', async () => {
    const onFindingsUpdate = vi.fn()
    let findingOnUpdate: ((update: unknown) => void) | undefined

    const { useFindingsRealtime } = await import('@/lib/hooks/useFindingsRealtime')
    const { useContradictionsRealtime } = await import('@/lib/hooks/useContradictionsRealtime')

    ;(useFindingsRealtime as ReturnType<typeof vi.fn>).mockImplementation((_projectId, options) => {
      findingOnUpdate = options?.onUpdate
      return {
        status: 'connected',
        reconnect: vi.fn(),
        counts: { total: 10, pending: 5, validated: 3, rejected: 2 },
      }
    })

    ;(useContradictionsRealtime as ReturnType<typeof vi.fn>).mockReturnValue({
      status: 'connected',
      reconnect: vi.fn(),
      counts: { total: 3, unresolved: 2, resolved: 1, investigating: 0, noted: 0 },
    })

    const { result } = renderHook(() =>
      useKnowledgeExplorerRealtime('project-123', {
        onFindingsUpdate,
      })
    )

    // Turn off auto-refresh
    act(() => {
      result.current.setAutoRefresh(false)
    })

    // Simulate an update
    act(() => {
      findingOnUpdate?.({
        type: 'INSERT',
        finding: { id: 'finding-1', text: 'Test' },
      })
    })

    // Callback should not have been called
    expect(onFindingsUpdate).not.toHaveBeenCalled()

    // Should have pending updates
    expect(result.current.hasPendingUpdates).toBe(true)
    expect(result.current.pendingUpdateCount).toBe(1)
  })

  it('should apply pending updates when applyPendingUpdates is called', async () => {
    const onFindingsUpdate = vi.fn()
    let findingOnUpdate: ((update: unknown) => void) | undefined

    const { useFindingsRealtime } = await import('@/lib/hooks/useFindingsRealtime')
    const { useContradictionsRealtime } = await import('@/lib/hooks/useContradictionsRealtime')

    ;(useFindingsRealtime as ReturnType<typeof vi.fn>).mockImplementation((_projectId, options) => {
      findingOnUpdate = options?.onUpdate
      return {
        status: 'connected',
        reconnect: vi.fn(),
        counts: { total: 10, pending: 5, validated: 3, rejected: 2 },
      }
    })

    ;(useContradictionsRealtime as ReturnType<typeof vi.fn>).mockReturnValue({
      status: 'connected',
      reconnect: vi.fn(),
      counts: { total: 3, unresolved: 2, resolved: 1, investigating: 0, noted: 0 },
    })

    const { result } = renderHook(() =>
      useKnowledgeExplorerRealtime('project-123', {
        onFindingsUpdate,
      })
    )

    // Turn off auto-refresh
    act(() => {
      result.current.setAutoRefresh(false)
    })

    // Simulate updates
    act(() => {
      findingOnUpdate?.({
        type: 'INSERT',
        finding: { id: 'finding-1', text: 'Test 1' },
      })
      findingOnUpdate?.({
        type: 'INSERT',
        finding: { id: 'finding-2', text: 'Test 2' },
      })
    })

    expect(result.current.pendingUpdateCount).toBe(2)

    // Apply pending updates
    act(() => {
      result.current.applyPendingUpdates()
    })

    // Callbacks should have been called
    expect(onFindingsUpdate).toHaveBeenCalledTimes(2)
    expect(result.current.hasPendingUpdates).toBe(false)
    expect(result.current.pendingUpdateCount).toBe(0)
  })

  it('should auto-apply pending updates when autoRefresh is turned back on', async () => {
    const onFindingsUpdate = vi.fn()
    let findingOnUpdate: ((update: unknown) => void) | undefined

    const { useFindingsRealtime } = await import('@/lib/hooks/useFindingsRealtime')
    const { useContradictionsRealtime } = await import('@/lib/hooks/useContradictionsRealtime')

    ;(useFindingsRealtime as ReturnType<typeof vi.fn>).mockImplementation((_projectId, options) => {
      findingOnUpdate = options?.onUpdate
      return {
        status: 'connected',
        reconnect: vi.fn(),
        counts: { total: 10, pending: 5, validated: 3, rejected: 2 },
      }
    })

    ;(useContradictionsRealtime as ReturnType<typeof vi.fn>).mockReturnValue({
      status: 'connected',
      reconnect: vi.fn(),
      counts: { total: 3, unresolved: 2, resolved: 1, investigating: 0, noted: 0 },
    })

    const { result } = renderHook(() =>
      useKnowledgeExplorerRealtime('project-123', {
        onFindingsUpdate,
      })
    )

    // Turn off auto-refresh
    act(() => {
      result.current.setAutoRefresh(false)
    })

    // Simulate an update
    act(() => {
      findingOnUpdate?.({
        type: 'INSERT',
        finding: { id: 'finding-1', text: 'Test' },
      })
    })

    expect(result.current.pendingUpdateCount).toBe(1)
    expect(onFindingsUpdate).not.toHaveBeenCalled()

    // Turn auto-refresh back on
    act(() => {
      result.current.setAutoRefresh(true)
    })

    // Pending updates should be automatically applied
    await waitFor(() => {
      expect(onFindingsUpdate).toHaveBeenCalled()
    })
    expect(result.current.hasPendingUpdates).toBe(false)
  })

  it('should respond to keyboard shortcut for toggle', () => {
    const { result } = renderHook(() =>
      useKnowledgeExplorerRealtime('project-123')
    )

    expect(result.current.autoRefresh).toBe(true)

    // Simulate Ctrl+Shift+R
    act(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'R',
        ctrlKey: true,
        shiftKey: true,
      })
      window.dispatchEvent(event)
    })

    expect(result.current.autoRefresh).toBe(false)
  })
})
