/**
 * useCIMs Hook Tests
 * Story: E9.2 - CIM List & Entry UI
 * AC: #2-5 - Data fetching, create, delete operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useCIMs } from '@/lib/hooks/useCIMs'
import { CIMListItem, WorkflowState } from '@/lib/types/cim'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('useCIMs', () => {
  const mockWorkflowState: WorkflowState = {
    current_phase: 'persona',
    current_section_index: null,
    current_slide_index: null,
    completed_phases: [],
    is_complete: false,
  }

  const mockCIMItems: CIMListItem[] = [
    {
      id: 'cim-1',
      dealId: 'deal-1',
      title: 'First CIM',
      workflowState: mockWorkflowState,
      slideCount: 0,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-10T00:00:00Z',
    },
    {
      id: 'cim-2',
      dealId: 'deal-1',
      title: 'Second CIM',
      workflowState: { ...mockWorkflowState, current_phase: 'outline', completed_phases: ['persona', 'thesis'] },
      slideCount: 5,
      createdAt: '2024-01-05T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initial fetch', () => {
    it('should fetch CIMs on mount', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: mockCIMItems,
          total: 2,
          limit: 50,
          offset: 0,
          hasMore: false,
        }),
      })

      const { result } = renderHook(() => useCIMs('project-123'))

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.items).toHaveLength(2)
      expect(result.current.items[0]?.title).toBe('First CIM')
      expect(result.current.error).toBeNull()
    })

    it('should handle fetch error', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to load CIMs' }),
      })

      const { result } = renderHook(() => useCIMs('project-123'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBe('Failed to load CIMs')
      expect(result.current.items).toHaveLength(0)
    })

    it('should handle network error', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useCIMs('project-123'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBe('Network error')
    })
  })

  describe('refresh', () => {
    it('should refresh CIMs without loading state', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: mockCIMItems,
            total: 2,
            limit: 50,
            offset: 0,
            hasMore: false,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [...mockCIMItems, {
              id: 'cim-3',
              dealId: 'deal-1',
              title: 'Third CIM',
              workflowState: mockWorkflowState,
              slideCount: 0,
              createdAt: '2024-01-20T00:00:00Z',
              updatedAt: '2024-01-20T00:00:00Z',
            }],
            total: 3,
            limit: 50,
            offset: 0,
            hasMore: false,
          }),
        })

      const { result } = renderHook(() => useCIMs('project-123'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.items).toHaveLength(2)

      await act(async () => {
        await result.current.refresh()
      })

      expect(result.current.items).toHaveLength(3)
      expect(result.current.isRefreshing).toBe(false)
    })
  })

  describe('createCIM', () => {
    it('should create CIM and add to list', async () => {
      const newCIM: CIMListItem = {
        id: 'cim-new',
        dealId: 'deal-1',
        title: 'New CIM',
        workflowState: mockWorkflowState,
        slideCount: 0,
        createdAt: '2024-01-25T00:00:00Z',
        updatedAt: '2024-01-25T00:00:00Z',
      }

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: mockCIMItems,
            total: 2,
            limit: 50,
            offset: 0,
            hasMore: false,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cim: newCIM }),
        })

      const { result } = renderHook(() => useCIMs('project-123'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.items).toHaveLength(2)

      let createdCIM: CIMListItem | null = null
      await act(async () => {
        createdCIM = await result.current.createCIM('New CIM')
      })

      expect(createdCIM).not.toBeNull()
      expect(createdCIM!.title).toBe('New CIM')
      expect(result.current.items).toHaveLength(3)
      expect(result.current.items[0]?.title).toBe('New CIM') // Added at beginning
    })

    it('should handle create error', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: mockCIMItems,
            total: 2,
            limit: 50,
            offset: 0,
            hasMore: false,
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Failed to create CIM' }),
        })

      const { result } = renderHook(() => useCIMs('project-123'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      let createdCIM: CIMListItem | null = null
      await act(async () => {
        createdCIM = await result.current.createCIM('New CIM')
      })

      expect(createdCIM).toBeNull()
      expect(result.current.error).toBe('Failed to create CIM')
      expect(result.current.items).toHaveLength(2) // Original items unchanged
    })

  })
})
