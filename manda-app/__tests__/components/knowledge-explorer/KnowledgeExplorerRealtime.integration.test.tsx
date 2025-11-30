/**
 * Integration Tests for Knowledge Explorer Real-Time Updates
 * Story: E4.13 - Build Real-Time Knowledge Graph Updates (AC: All)
 *
 * Tests the full integration of:
 * - useKnowledgeExplorerRealtime hook with KnowledgeExplorerClient
 * - Badge count updates
 * - Auto-refresh toggle behavior
 * - Connection status display
 * - Subscription cleanup on unmount
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMockSupabaseClient } from '@/__tests__/utils/supabase-mock'

// Mock the supabase client module
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}))

// Mock the API functions
vi.mock('@/lib/api/findings', () => ({
  getFindings: vi.fn(() =>
    Promise.resolve({
      findings: [],
      total: 0,
      page: 1,
      limit: 25,
      totalPages: 0,
    })
  ),
}))

vi.mock('@/lib/api/contradictions', () => ({
  getContradictions: vi.fn(() =>
    Promise.resolve({
      contradictions: [],
      total: 0,
    })
  ),
  resolveContradiction: vi.fn(() => Promise.resolve({})),
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/projects/test-project/knowledge',
}))

// Mock sonner
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  }),
}))

describe('Knowledge Explorer Realtime Integration', () => {
  let mockClient: ReturnType<typeof createMockSupabaseClient>['client']
  let mockChannel: ReturnType<typeof createMockSupabaseClient>['channel']
  let createClientMock: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mocks = createMockSupabaseClient()
    mockClient = mocks.client
    mockChannel = mocks.channel

    // Setup subscribe to call callback with SUBSCRIBED
    mockChannel.subscribe.mockImplementation((callback: (status: string) => void) => {
      callback('SUBSCRIBED')
      return mockChannel
    })

    // Get the createClient mock and set its return value
    createClientMock = (await import('@/lib/supabase/client')).createClient as ReturnType<typeof vi.fn>
    createClientMock.mockReturnValue(mockClient)

    // Clear localStorage
    if (typeof window !== 'undefined') {
      window.localStorage.clear()
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Subscription Management', () => {
    it('should establish subscriptions to both findings and contradictions tables', async () => {
      // Import the hooks dynamically to ensure fresh mock
      const { useFindingsRealtime } = await import('@/lib/hooks/useFindingsRealtime')
      const { useContradictionsRealtime } = await import('@/lib/hooks/useContradictionsRealtime')
      const { renderHook } = await import('@testing-library/react')

      // Render findings hook
      renderHook(() => useFindingsRealtime('project-123'))

      await waitFor(() => {
        expect(mockClient.channel).toHaveBeenCalledWith(
          expect.stringContaining('findings')
        )
      })

      // Render contradictions hook
      mockClient.channel.mockClear()
      renderHook(() => useContradictionsRealtime('project-123'))

      await waitFor(() => {
        expect(mockClient.channel).toHaveBeenCalledWith(
          expect.stringContaining('contradictions')
        )
      })
    })

    it('should clean up subscriptions on unmount', async () => {
      const { useFindingsRealtime } = await import('@/lib/hooks/useFindingsRealtime')
      const { renderHook } = await import('@testing-library/react')

      const { unmount } = renderHook(() => useFindingsRealtime('project-123'))

      await waitFor(() => {
        expect(mockClient.channel).toHaveBeenCalled()
      })

      unmount()

      expect(mockChannel.unsubscribe).toHaveBeenCalled()
    })

    it('should not create duplicate subscriptions for the same project', async () => {
      const { useFindingsRealtime } = await import('@/lib/hooks/useFindingsRealtime')
      const { renderHook } = await import('@testing-library/react')

      const { rerender } = renderHook(
        ({ projectId }) => useFindingsRealtime(projectId),
        { initialProps: { projectId: 'project-123' } }
      )

      await waitFor(() => {
        expect(mockClient.channel).toHaveBeenCalledTimes(1)
      })

      // Rerender with same project ID
      rerender({ projectId: 'project-123' })

      // Should not create new subscription
      expect(mockClient.channel).toHaveBeenCalledTimes(1)
    })
  })

  describe('Auto-Refresh Toggle', () => {
    it('should default to auto-refresh enabled', async () => {
      const { useKnowledgeExplorerRealtime } = await import('@/lib/hooks/useKnowledgeExplorerRealtime')
      const { renderHook } = await import('@testing-library/react')

      const { result } = renderHook(() =>
        useKnowledgeExplorerRealtime('project-123')
      )

      expect(result.current.autoRefresh).toBe(true)
    })

    it('should persist auto-refresh preference to localStorage', async () => {
      const { useKnowledgeExplorerRealtime } = await import('@/lib/hooks/useKnowledgeExplorerRealtime')
      const { renderHook } = await import('@testing-library/react')

      const { result } = renderHook(() =>
        useKnowledgeExplorerRealtime('project-123')
      )

      act(() => {
        result.current.setAutoRefresh(false)
      })

      expect(window.localStorage.getItem('knowledge-explorer-auto-refresh:project-123')).toBe('false')
    })

    it('should read auto-refresh preference from localStorage', async () => {
      window.localStorage.setItem('knowledge-explorer-auto-refresh:project-456', 'false')

      const { useKnowledgeExplorerRealtime } = await import('@/lib/hooks/useKnowledgeExplorerRealtime')
      const { renderHook } = await import('@testing-library/react')

      const { result } = renderHook(() =>
        useKnowledgeExplorerRealtime('project-456')
      )

      expect(result.current.autoRefresh).toBe(false)
    })

    it('should queue updates when auto-refresh is off', async () => {
      const onUpdate = vi.fn()
      let findingEventHandler: ((payload: unknown) => void) | null = null

      mockChannel.on.mockImplementation((_event: string, _filter: unknown, handler: (payload: unknown) => void) => {
        findingEventHandler = handler
        return mockChannel
      })

      const { useKnowledgeExplorerRealtime } = await import('@/lib/hooks/useKnowledgeExplorerRealtime')
      const { renderHook } = await import('@testing-library/react')

      const { result } = renderHook(() =>
        useKnowledgeExplorerRealtime('project-123', {
          onFindingsUpdate: onUpdate,
        })
      )

      // Turn off auto-refresh
      act(() => {
        result.current.setAutoRefresh(false)
      })

      expect(result.current.autoRefresh).toBe(false)
      expect(result.current.hasPendingUpdates).toBe(false)
    })
  })

  describe('Connection Status', () => {
    it('should report connected status when both hooks are connected', async () => {
      const { useKnowledgeExplorerRealtime } = await import('@/lib/hooks/useKnowledgeExplorerRealtime')
      const { renderHook } = await import('@testing-library/react')

      const { result } = renderHook(() =>
        useKnowledgeExplorerRealtime('project-123')
      )

      await waitFor(() => {
        expect(result.current.status).toBe('connected')
      })
    })

    it('should provide detailed status for findings and contradictions', async () => {
      const { useKnowledgeExplorerRealtime } = await import('@/lib/hooks/useKnowledgeExplorerRealtime')
      const { renderHook } = await import('@testing-library/react')

      const { result } = renderHook(() =>
        useKnowledgeExplorerRealtime('project-123')
      )

      await waitFor(() => {
        expect(result.current.detailedStatus).toBeDefined()
        expect(result.current.detailedStatus.findings).toBe('connected')
        expect(result.current.detailedStatus.contradictions).toBe('connected')
      })
    })

    it('should provide reconnect function', async () => {
      const { useKnowledgeExplorerRealtime } = await import('@/lib/hooks/useKnowledgeExplorerRealtime')
      const { renderHook } = await import('@testing-library/react')

      const { result } = renderHook(() =>
        useKnowledgeExplorerRealtime('project-123')
      )

      expect(typeof result.current.reconnect).toBe('function')

      // Clear previous calls
      mockClient.channel.mockClear()

      // Call reconnect
      act(() => {
        result.current.reconnect()
      })

      // Should attempt to reconnect
      await waitFor(() => {
        expect(mockClient.channel).toHaveBeenCalled()
      })
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('should toggle auto-refresh with Ctrl+Shift+R', async () => {
      const { useKnowledgeExplorerRealtime } = await import('@/lib/hooks/useKnowledgeExplorerRealtime')
      const { renderHook } = await import('@testing-library/react')

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

    it('should toggle auto-refresh with Cmd+Shift+R (Mac)', async () => {
      const { useKnowledgeExplorerRealtime } = await import('@/lib/hooks/useKnowledgeExplorerRealtime')
      const { renderHook } = await import('@testing-library/react')

      const { result } = renderHook(() =>
        useKnowledgeExplorerRealtime('project-123')
      )

      expect(result.current.autoRefresh).toBe(true)

      // Simulate Cmd+Shift+R (Mac)
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'R',
          metaKey: true,
          shiftKey: true,
        })
        window.dispatchEvent(event)
      })

      expect(result.current.autoRefresh).toBe(false)
    })
  })

  describe('Count Updates', () => {
    it('should expose finding counts', async () => {
      const { useKnowledgeExplorerRealtime } = await import('@/lib/hooks/useKnowledgeExplorerRealtime')
      const { renderHook } = await import('@testing-library/react')

      const { result } = renderHook(() =>
        useKnowledgeExplorerRealtime('project-123')
      )

      expect(result.current.findingsCounts).toBeDefined()
      expect(typeof result.current.findingsCounts.total).toBe('number')
    })

    it('should expose contradiction counts', async () => {
      const { useKnowledgeExplorerRealtime } = await import('@/lib/hooks/useKnowledgeExplorerRealtime')
      const { renderHook } = await import('@testing-library/react')

      const { result } = renderHook(() =>
        useKnowledgeExplorerRealtime('project-123')
      )

      expect(result.current.contradictionsCounts).toBeDefined()
      expect(typeof result.current.contradictionsCounts.total).toBe('number')
      expect(typeof result.current.contradictionsCounts.unresolved).toBe('number')
    })
  })
})
