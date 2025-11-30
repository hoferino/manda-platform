/**
 * Tests for useContradictionsRealtime hook
 * Story: E4.13 - Build Real-Time Knowledge Graph Updates (AC: #1, #3, #7)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  useContradictionsRealtime,
  didContradictionStatusChange,
  didContradictionGetResolved,
  isContradictionUnresolved,
} from '@/lib/hooks/useContradictionsRealtime'
import { createMockSupabaseClient } from '@/__tests__/utils/supabase-mock'
import type { Contradiction } from '@/lib/types/contradictions'

// Mock the supabase client module
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}))

describe('useContradictionsRealtime', () => {
  let mockClient: ReturnType<typeof createMockSupabaseClient>['client']
  let mockChannel: ReturnType<typeof createMockSupabaseClient>['channel']
  let createClientMock: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mocks = createMockSupabaseClient()
    mockClient = mocks.client
    mockChannel = mocks.channel

    // Get the createClient mock and set its return value
    createClientMock = (await import('@/lib/supabase/client')).createClient as ReturnType<typeof vi.fn>
    createClientMock.mockReturnValue(mockClient)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with disconnected status when no projectId', () => {
    const { result } = renderHook(() => useContradictionsRealtime(null))

    expect(result.current.status).toBe('disconnected')
    expect(result.current.counts.total).toBe(0)
    expect(result.current.counts.unresolved).toBe(0)
  })

  it('should subscribe to contradictions channel with correct filter', async () => {
    const projectId = 'project-123'

    mockChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
      callback('SUBSCRIBED')
      return mockChannel
    })

    const { result } = renderHook(() => useContradictionsRealtime(projectId))

    await waitFor(() => {
      expect(result.current.status).toBe('connected')
    })

    expect(mockClient.channel).toHaveBeenCalledWith(`contradictions:project=${projectId}`)

    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: '*',
        schema: 'public',
        table: 'contradictions',
        filter: `deal_id=eq.${projectId}`,
      }),
      expect.any(Function)
    )
  })

  it('should handle INSERT event and update unresolved count', async () => {
    const projectId = 'project-123'
    const onUpdate = vi.fn()
    let eventHandler: ((payload: unknown) => void) | null = null

    mockChannel.on.mockImplementation((_event: string, _filter: unknown, handler: (payload: unknown) => void) => {
      eventHandler = handler
      return mockChannel
    })

    mockChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
      callback('SUBSCRIBED')
      return mockChannel
    })

    const { result } = renderHook(() =>
      useContradictionsRealtime(projectId, {
        onUpdate,
        debounceMs: 0,
      })
    )

    await waitFor(() => {
      expect(eventHandler).not.toBeNull()
    })

    const mockContradictionRecord = {
      id: 'contradiction-1',
      deal_id: projectId,
      finding_a_id: 'finding-1',
      finding_b_id: 'finding-2',
      confidence: 0.9,
      status: 'unresolved',
      resolution: null,
      resolution_note: null,
      detected_at: new Date().toISOString(),
      resolved_at: null,
      resolved_by: null,
      metadata: null,
    }

    act(() => {
      eventHandler?.({
        eventType: 'INSERT',
        new: mockContradictionRecord,
        old: {},
      })
    })

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'INSERT',
          contradiction: expect.objectContaining({
            id: 'contradiction-1',
            status: 'unresolved',
          }),
        })
      )
    })

    // Check counts were updated
    expect(result.current.counts.total).toBe(1)
    expect(result.current.counts.unresolved).toBe(1)
  })

  it('should handle UPDATE event for resolution', async () => {
    const projectId = 'project-123'
    const onUpdate = vi.fn()
    let eventHandler: ((payload: unknown) => void) | null = null

    mockChannel.on.mockImplementation((_event: string, _filter: unknown, handler: (payload: unknown) => void) => {
      eventHandler = handler
      return mockChannel
    })

    mockChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
      callback('SUBSCRIBED')
      return mockChannel
    })

    const { result } = renderHook(() =>
      useContradictionsRealtime(projectId, {
        onUpdate,
        debounceMs: 0,
      })
    )

    await waitFor(() => {
      expect(eventHandler).not.toBeNull()
    })

    // First add a contradiction
    const insertRecord = {
      id: 'contradiction-1',
      deal_id: projectId,
      finding_a_id: 'finding-1',
      finding_b_id: 'finding-2',
      status: 'unresolved',
      detected_at: new Date().toISOString(),
    }

    act(() => {
      eventHandler?.({
        eventType: 'INSERT',
        new: insertRecord,
        old: {},
      })
    })

    expect(result.current.counts.unresolved).toBe(1)

    // Now resolve it
    const updateRecord = {
      ...insertRecord,
      status: 'resolved',
      resolution: 'accept_a',
      resolved_at: new Date().toISOString(),
    }

    act(() => {
      eventHandler?.({
        eventType: 'UPDATE',
        new: updateRecord,
        old: insertRecord,
      })
    })

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'UPDATE',
          contradiction: expect.objectContaining({
            status: 'resolved',
          }),
          oldContradiction: expect.objectContaining({
            status: 'unresolved',
          }),
        })
      )
    })

    // Counts should reflect the change
    expect(result.current.counts.unresolved).toBe(0)
    expect(result.current.counts.resolved).toBe(1)
  })

  it('should track different status counts correctly', async () => {
    const projectId = 'project-123'
    let eventHandler: ((payload: unknown) => void) | null = null

    mockChannel.on.mockImplementation((_event: string, _filter: unknown, handler: (payload: unknown) => void) => {
      eventHandler = handler
      return mockChannel
    })

    mockChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
      callback('SUBSCRIBED')
      return mockChannel
    })

    const { result } = renderHook(() =>
      useContradictionsRealtime(projectId, {
        debounceMs: 0,
      })
    )

    await waitFor(() => {
      expect(eventHandler).not.toBeNull()
    })

    // Add contradictions with different statuses
    const statuses = ['unresolved', 'investigating', 'noted', 'resolved']
    statuses.forEach((status, index) => {
      act(() => {
        eventHandler?.({
          eventType: 'INSERT',
          new: {
            id: `contradiction-${index}`,
            deal_id: projectId,
            status,
            detected_at: new Date().toISOString(),
          },
          old: {},
        })
      })
    })

    expect(result.current.counts.total).toBe(4)
    expect(result.current.counts.unresolved).toBe(1)
    expect(result.current.counts.investigating).toBe(1)
    expect(result.current.counts.noted).toBe(1)
    expect(result.current.counts.resolved).toBe(1)
  })

  it('should clean up subscription on unmount', async () => {
    const projectId = 'project-123'

    mockChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
      callback('SUBSCRIBED')
      return mockChannel
    })

    const { unmount } = renderHook(() => useContradictionsRealtime(projectId))

    await waitFor(() => {
      expect(mockClient.channel).toHaveBeenCalled()
    })

    unmount()

    expect(mockChannel.unsubscribe).toHaveBeenCalled()
  })

  it('should provide manual reconnect function', async () => {
    const projectId = 'project-123'

    mockChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
      callback('SUBSCRIBED')
      return mockChannel
    })

    const { result } = renderHook(() => useContradictionsRealtime(projectId))

    await waitFor(() => {
      expect(result.current.status).toBe('connected')
    })

    mockClient.channel.mockClear()

    act(() => {
      result.current.reconnect()
    })

    expect(mockClient.channel).toHaveBeenCalled()
  })
})

describe('Helper functions', () => {
  const createContradiction = (overrides: Partial<Contradiction> = {}): Contradiction => ({
    id: 'contradiction-1',
    dealId: 'project-123',
    findingAId: 'finding-1',
    findingBId: 'finding-2',
    confidence: 0.9,
    status: 'unresolved',
    resolution: null,
    resolutionNote: null,
    detectedAt: new Date().toISOString(),
    resolvedAt: null,
    resolvedBy: null,
    metadata: null,
    ...overrides,
  })

  describe('didContradictionStatusChange', () => {
    it('should return true when status changes', () => {
      const oldContradiction = createContradiction({ status: 'unresolved' })
      const newContradiction = createContradiction({ status: 'resolved' })

      expect(didContradictionStatusChange(oldContradiction, newContradiction)).toBe(true)
    })

    it('should return false when status is the same', () => {
      const oldContradiction = createContradiction({ status: 'unresolved' })
      const newContradiction = createContradiction({ status: 'unresolved' })

      expect(didContradictionStatusChange(oldContradiction, newContradiction)).toBe(false)
    })

    it('should return false when oldContradiction is undefined', () => {
      const newContradiction = createContradiction({ status: 'resolved' })

      expect(didContradictionStatusChange(undefined, newContradiction)).toBe(false)
    })
  })

  describe('didContradictionGetResolved', () => {
    it('should return true when contradiction becomes resolved', () => {
      const oldContradiction = createContradiction({ status: 'unresolved' })
      const newContradiction = createContradiction({ status: 'resolved' })

      expect(didContradictionGetResolved(oldContradiction, newContradiction)).toBe(true)
    })

    it('should return false when already resolved', () => {
      const oldContradiction = createContradiction({ status: 'resolved' })
      const newContradiction = createContradiction({ status: 'resolved' })

      expect(didContradictionGetResolved(oldContradiction, newContradiction)).toBe(false)
    })

    it('should return false when changing to investigating', () => {
      const oldContradiction = createContradiction({ status: 'unresolved' })
      const newContradiction = createContradiction({ status: 'investigating' })

      expect(didContradictionGetResolved(oldContradiction, newContradiction)).toBe(false)
    })
  })

  describe('isContradictionUnresolved', () => {
    it('should return true for unresolved', () => {
      const contradiction = createContradiction({ status: 'unresolved' })
      expect(isContradictionUnresolved(contradiction)).toBe(true)
    })

    it('should return false for resolved', () => {
      const contradiction = createContradiction({ status: 'resolved' })
      expect(isContradictionUnresolved(contradiction)).toBe(false)
    })

    it('should return false for investigating', () => {
      const contradiction = createContradiction({ status: 'investigating' })
      expect(isContradictionUnresolved(contradiction)).toBe(false)
    })

    it('should return false for noted', () => {
      const contradiction = createContradiction({ status: 'noted' })
      expect(isContradictionUnresolved(contradiction)).toBe(false)
    })
  })
})
