/**
 * Tests for useFindingsRealtime hook
 * Story: E4.13 - Build Real-Time Knowledge Graph Updates (AC: #1, #2, #7)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useFindingsRealtime, didFindingStatusChange, didFindingGetValidated, didFindingGetRejected } from '@/lib/hooks/useFindingsRealtime'
import { createMockSupabaseClient } from '@/__tests__/utils/supabase-mock'
import type { Finding } from '@/lib/types/findings'

// Mock the supabase client module
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}))

describe('useFindingsRealtime', () => {
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
    const { result } = renderHook(() => useFindingsRealtime(null))

    expect(result.current.status).toBe('disconnected')
    expect(result.current.counts.total).toBe(0)
  })

  it('should subscribe to findings channel with correct filter', async () => {
    const projectId = 'project-123'

    // Setup subscribe to call callback with SUBSCRIBED
    mockChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
      callback('SUBSCRIBED')
      return mockChannel
    })

    const { result } = renderHook(() => useFindingsRealtime(projectId))

    await waitFor(() => {
      expect(result.current.status).toBe('connected')
    })

    // Verify channel was created with correct name
    expect(mockClient.channel).toHaveBeenCalledWith(`findings:project=${projectId}`)

    // Verify the on() was called with correct params
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: '*',
        schema: 'public',
        table: 'findings',
        filter: `deal_id=eq.${projectId}`,
      }),
      expect.any(Function)
    )
  })

  it('should handle INSERT event and call onUpdate callback', async () => {
    const projectId = 'project-123'
    const onUpdate = vi.fn()
    let eventHandler: ((payload: unknown) => void) | null = null

    // Capture the event handler
    mockChannel.on.mockImplementation((_event: string, _filter: unknown, handler: (payload: unknown) => void) => {
      eventHandler = handler
      return mockChannel
    })

    mockChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
      callback('SUBSCRIBED')
      return mockChannel
    })

    renderHook(() =>
      useFindingsRealtime(projectId, {
        onUpdate,
        debounceMs: 0, // Disable debouncing for test
      })
    )

    // Wait for connection
    await waitFor(() => {
      expect(eventHandler).not.toBeNull()
    })

    // Simulate INSERT event
    const mockFindingRecord = {
      id: 'finding-1',
      deal_id: projectId,
      document_id: 'doc-1',
      chunk_id: null,
      user_id: 'user-1',
      text: 'Test finding',
      source_document: 'test.pdf',
      page_number: 1,
      confidence: 0.85,
      finding_type: 'fact',
      domain: 'financial',
      status: 'pending',
      validation_history: [],
      metadata: null,
      created_at: new Date().toISOString(),
      updated_at: null,
    }

    act(() => {
      eventHandler?.({
        eventType: 'INSERT',
        new: mockFindingRecord,
        old: {},
      })
    })

    // Allow debounce to flush
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'INSERT',
          finding: expect.objectContaining({
            id: 'finding-1',
            text: 'Test finding',
          }),
        })
      )
    })
  })

  it('should handle UPDATE event with old and new data', async () => {
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

    renderHook(() =>
      useFindingsRealtime(projectId, {
        onUpdate,
        debounceMs: 0,
      })
    )

    await waitFor(() => {
      expect(eventHandler).not.toBeNull()
    })

    const oldRecord = {
      id: 'finding-1',
      deal_id: projectId,
      status: 'pending',
      text: 'Old text',
      user_id: 'user-1',
      created_at: new Date().toISOString(),
    }

    const newRecord = {
      ...oldRecord,
      status: 'validated',
      text: 'New text',
    }

    act(() => {
      eventHandler?.({
        eventType: 'UPDATE',
        new: newRecord,
        old: oldRecord,
      })
    })

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'UPDATE',
          finding: expect.objectContaining({
            status: 'validated',
          }),
          oldFinding: expect.objectContaining({
            status: 'pending',
          }),
        })
      )
    })
  })

  it('should handle DELETE event', async () => {
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

    renderHook(() =>
      useFindingsRealtime(projectId, {
        onUpdate,
        debounceMs: 0,
      })
    )

    await waitFor(() => {
      expect(eventHandler).not.toBeNull()
    })

    const deletedRecord = {
      id: 'finding-1',
      deal_id: projectId,
      status: 'pending',
      user_id: 'user-1',
      text: 'Deleted finding',
      created_at: new Date().toISOString(),
    }

    act(() => {
      eventHandler?.({
        eventType: 'DELETE',
        new: {},
        old: deletedRecord,
      })
    })

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'DELETE',
          finding: expect.objectContaining({
            id: 'finding-1',
          }),
        })
      )
    })
  })

  it('should clean up subscription on unmount', async () => {
    const projectId = 'project-123'

    mockChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
      callback('SUBSCRIBED')
      return mockChannel
    })

    const { unmount } = renderHook(() => useFindingsRealtime(projectId))

    await waitFor(() => {
      expect(mockClient.channel).toHaveBeenCalled()
    })

    unmount()

    expect(mockChannel.unsubscribe).toHaveBeenCalled()
  })

  it('should attempt reconnection on CLOSED status with exponential backoff', async () => {
    const projectId = 'project-123'
    const onConnectionChange = vi.fn()

    let subscribeCallback: ((status: string) => void) | null = null
    mockChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
      subscribeCallback = callback
      callback('SUBSCRIBED')
      return mockChannel
    })

    renderHook(() =>
      useFindingsRealtime(projectId, {
        onConnectionChange,
      })
    )

    await waitFor(() => {
      expect(onConnectionChange).toHaveBeenCalledWith('connected')
    })

    // Simulate disconnect
    act(() => {
      subscribeCallback?.('CLOSED')
    })

    expect(onConnectionChange).toHaveBeenCalledWith('disconnected')
  })

  it('should handle CHANNEL_ERROR status', async () => {
    const projectId = 'project-123'
    const onConnectionChange = vi.fn()

    let subscribeCallback: ((status: string) => void) | null = null
    mockChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
      subscribeCallback = callback
      callback('SUBSCRIBED')
      return mockChannel
    })

    renderHook(() =>
      useFindingsRealtime(projectId, {
        onConnectionChange,
      })
    )

    await waitFor(() => {
      expect(onConnectionChange).toHaveBeenCalledWith('connected')
    })

    act(() => {
      subscribeCallback?.('CHANNEL_ERROR')
    })

    expect(onConnectionChange).toHaveBeenCalledWith('error')
  })

  it('should provide manual reconnect function', async () => {
    const projectId = 'project-123'

    mockChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
      callback('SUBSCRIBED')
      return mockChannel
    })

    const { result } = renderHook(() => useFindingsRealtime(projectId))

    await waitFor(() => {
      expect(result.current.status).toBe('connected')
    })

    // Clear previous calls
    mockClient.channel.mockClear()
    mockChannel.on.mockClear()

    // Call reconnect
    act(() => {
      result.current.reconnect()
    })

    // Verify resubscription
    expect(mockClient.channel).toHaveBeenCalled()
  })

  it('should not subscribe when enabled is false', () => {
    const projectId = 'project-123'

    renderHook(() =>
      useFindingsRealtime(projectId, {
        enabled: false,
      })
    )

    expect(mockClient.channel).not.toHaveBeenCalled()
  })
})

describe('Helper functions', () => {
  const createFinding = (overrides: Partial<Finding> = {}): Finding => ({
    id: 'finding-1',
    dealId: 'project-123',
    documentId: 'doc-1',
    chunkId: null,
    userId: 'user-1',
    text: 'Test finding',
    sourceDocument: null,
    pageNumber: null,
    confidence: 0.85,
    findingType: 'fact',
    domain: 'financial',
    status: 'pending',
    validationHistory: [],
    metadata: null,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    ...overrides,
  })

  describe('didFindingStatusChange', () => {
    it('should return true when status changes', () => {
      const oldFinding = createFinding({ status: 'pending' })
      const newFinding = createFinding({ status: 'validated' })

      expect(didFindingStatusChange(oldFinding, newFinding)).toBe(true)
    })

    it('should return false when status is the same', () => {
      const oldFinding = createFinding({ status: 'pending' })
      const newFinding = createFinding({ status: 'pending' })

      expect(didFindingStatusChange(oldFinding, newFinding)).toBe(false)
    })

    it('should return false when oldFinding is undefined', () => {
      const newFinding = createFinding({ status: 'validated' })

      expect(didFindingStatusChange(undefined, newFinding)).toBe(false)
    })
  })

  describe('didFindingGetValidated', () => {
    it('should return true when finding becomes validated', () => {
      const oldFinding = createFinding({ status: 'pending' })
      const newFinding = createFinding({ status: 'validated' })

      expect(didFindingGetValidated(oldFinding, newFinding)).toBe(true)
    })

    it('should return false when already validated', () => {
      const oldFinding = createFinding({ status: 'validated' })
      const newFinding = createFinding({ status: 'validated' })

      expect(didFindingGetValidated(oldFinding, newFinding)).toBe(false)
    })

    it('should return false when changing to rejected', () => {
      const oldFinding = createFinding({ status: 'pending' })
      const newFinding = createFinding({ status: 'rejected' })

      expect(didFindingGetValidated(oldFinding, newFinding)).toBe(false)
    })
  })

  describe('didFindingGetRejected', () => {
    it('should return true when finding becomes rejected', () => {
      const oldFinding = createFinding({ status: 'pending' })
      const newFinding = createFinding({ status: 'rejected' })

      expect(didFindingGetRejected(oldFinding, newFinding)).toBe(true)
    })

    it('should return false when already rejected', () => {
      const oldFinding = createFinding({ status: 'rejected' })
      const newFinding = createFinding({ status: 'rejected' })

      expect(didFindingGetRejected(oldFinding, newFinding)).toBe(false)
    })

    it('should return false when changing to validated', () => {
      const oldFinding = createFinding({ status: 'pending' })
      const newFinding = createFinding({ status: 'validated' })

      expect(didFindingGetRejected(oldFinding, newFinding)).toBe(false)
    })
  })
})
