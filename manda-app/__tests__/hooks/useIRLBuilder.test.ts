/**
 * useIRLBuilder Hook Tests
 *
 * Tests for the IRL Builder state management hook.
 * Story: E6.2 - Implement IRL Creation and Editing
 *
 * Tests:
 * - Loading state management
 * - CRUD operations
 * - Optimistic updates
 * - Error handling with rollback
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useIRLBuilder } from '@/components/irl/useIRLBuilder'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Sample data
const mockIRLWithItems = {
  id: 'irl-123',
  dealId: 'deal-456',
  title: 'Test IRL',
  templateType: 'general',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  items: [
    {
      id: 'item-1',
      irlId: 'irl-123',
      category: 'Financial',
      itemName: 'Annual Reports',
      description: 'Last 3 years',
      priority: 'high',
      status: 'not_started',
      sortOrder: 0,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 'item-2',
      irlId: 'irl-123',
      category: 'Financial',
      itemName: 'Tax Returns',
      description: 'Last 5 years',
      priority: 'medium',
      status: 'pending',
      sortOrder: 1,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
  ],
}

describe('useIRLBuilder', () => {
  const defaultOptions = {
    projectId: 'proj-123',
    irlId: 'irl-123',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockIRLWithItems),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initial load', () => {
    it('starts in loading state', () => {
      const { result } = renderHook(() => useIRLBuilder(defaultOptions))

      expect(result.current.isLoading).toBe(true)
      expect(result.current.irl).toBeNull()
    })

    it('loads IRL data on mount', async () => {
      const { result } = renderHook(() => useIRLBuilder(defaultOptions))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.irl).toEqual(mockIRLWithItems)
      expect(result.current.items).toHaveLength(2)
    })

    it('computes categories from items', async () => {
      const { result } = renderHook(() => useIRLBuilder(defaultOptions))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.categories).toEqual(['Financial'])
    })

    it('groups items by category', async () => {
      const { result } = renderHook(() => useIRLBuilder(defaultOptions))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.itemsByCategory).toEqual({
        Financial: [mockIRLWithItems.items[0], mockIRLWithItems.items[1]],
      })
    })

    it('calculates progress', async () => {
      const { result } = renderHook(() => useIRLBuilder(defaultOptions))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.progress).not.toBeNull()
      expect(result.current.progress?.totalItems).toBe(2)
    })
  })

  describe('error handling', () => {
    it('sets error on fetch failure', async () => {
      const mockOnError = vi.fn()
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Not found' }),
      })

      const { result } = renderHook(() =>
        useIRLBuilder({ ...defaultOptions, onError: mockOnError })
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBe('Not found')
      expect(mockOnError).toHaveBeenCalledWith('Not found')
    })

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useIRLBuilder(defaultOptions))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBe('Network error')
    })
  })

  describe('updateTitle', () => {
    it('updates title optimistically', async () => {
      const { result } = renderHook(() => useIRLBuilder(defaultOptions))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockIRLWithItems, title: 'New Title' }),
      })

      act(() => {
        result.current.updateTitle('New Title')
      })

      // Optimistic update
      expect(result.current.irl?.title).toBe('New Title')
    })

    it('rolls back on error', async () => {
      const { result } = renderHook(() => useIRLBuilder(defaultOptions))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Update failed' }),
      })

      await act(async () => {
        await result.current.updateTitle('New Title')
      })

      // Should rollback to original
      expect(result.current.irl?.title).toBe('Test IRL')
      expect(result.current.error).toBe('Update failed')
    })
  })

  describe('addCategory', () => {
    it('calls API to add category', async () => {
      const { result } = renderHook(() => useIRLBuilder(defaultOptions))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            firstItem: {
              id: 'item-new',
              irlId: 'irl-123',
              category: 'Legal',
              itemName: 'New Item',
              priority: 'medium',
              status: 'not_started',
              sortOrder: 2,
              createdAt: '2025-01-01T00:00:00Z',
              updatedAt: '2025-01-01T00:00:00Z',
            },
          }),
      })

      await act(async () => {
        await result.current.addCategory('Legal')
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/projects/proj-123/irls/irl-123/categories',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Legal' }),
        })
      )

      expect(result.current.items).toHaveLength(3)
      expect(result.current.categories).toContain('Legal')
    })
  })

  describe('addItem', () => {
    it('adds item to list after API call', async () => {
      const { result } = renderHook(() => useIRLBuilder(defaultOptions))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const newItem = {
        id: 'item-new',
        irlId: 'irl-123',
        category: 'Financial',
        itemName: 'Bank Statements',
        priority: 'high',
        status: 'not_started',
        sortOrder: 2,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(newItem),
      })

      await act(async () => {
        await result.current.addItem('Financial', {
          itemName: 'Bank Statements',
          priority: 'high',
        })
      })

      expect(result.current.items).toHaveLength(3)
      expect(result.current.items[2].itemName).toBe('Bank Statements')
    })
  })

  describe('updateItem', () => {
    it('updates item optimistically', async () => {
      const { result } = renderHook(() => useIRLBuilder(defaultOptions))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const updatedItem = { ...mockIRLWithItems.items[0], status: 'received' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(updatedItem),
      })

      act(() => {
        result.current.updateItem('item-1', { status: 'received' })
      })

      // Optimistic update
      expect(result.current.items[0].status).toBe('received')
    })

    it('rolls back item on error', async () => {
      const { result } = renderHook(() => useIRLBuilder(defaultOptions))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Update failed' }),
      })

      await act(async () => {
        await result.current.updateItem('item-1', { status: 'received' })
      })

      // Should rollback
      expect(result.current.items[0].status).toBe('not_started')
    })
  })

  describe('deleteItem', () => {
    it('removes item optimistically', async () => {
      const { result } = renderHook(() => useIRLBuilder(defaultOptions))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })

      act(() => {
        result.current.deleteItem('item-1')
      })

      expect(result.current.items).toHaveLength(1)
      expect(result.current.items[0].id).toBe('item-2')
    })

    it('rolls back on delete error', async () => {
      const { result } = renderHook(() => useIRLBuilder(defaultOptions))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Delete failed' }),
      })

      await act(async () => {
        await result.current.deleteItem('item-1')
      })

      expect(result.current.items).toHaveLength(2)
    })
  })

  describe('reorderItems', () => {
    it('updates sort order optimistically', async () => {
      const { result } = renderHook(() => useIRLBuilder(defaultOptions))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })

      act(() => {
        result.current.reorderItems([
          { id: 'item-2', sortOrder: 0 },
          { id: 'item-1', sortOrder: 1 },
        ])
      })

      // Items should be reordered
      expect(result.current.items[0].id).toBe('item-2')
      expect(result.current.items[1].id).toBe('item-1')
    })
  })

  describe('discardChanges', () => {
    it('reverts to original state', async () => {
      const { result } = renderHook(() => useIRLBuilder(defaultOptions))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Make a change (won't persist due to mock)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockIRLWithItems, title: 'Changed' }),
      })

      act(() => {
        result.current.updateTitle('Changed')
      })

      expect(result.current.irl?.title).toBe('Changed')

      // Discard changes
      act(() => {
        result.current.discardChanges()
      })

      expect(result.current.irl?.title).toBe('Test IRL')
      expect(result.current.hasUnsavedChanges).toBe(false)
    })
  })
})
