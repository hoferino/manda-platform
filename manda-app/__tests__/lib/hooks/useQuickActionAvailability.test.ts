/**
 * useQuickActionAvailability Hook Tests
 *
 * Tests for the quick action availability checking hook.
 * Story: E5.5 - Implement Quick Actions and Suggested Follow-ups
 * AC: #4 (Disabled Button States)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import {
  useQuickActionAvailability,
  getAvailabilityMap,
} from '@/lib/hooks/useQuickActionAvailability'

// Mock Supabase client
const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockLimit = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}))

describe('useQuickActionAvailability', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default chain
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ limit: mockLimit })
    mockLimit.mockResolvedValue({ count: 0, error: null })
  })

  describe('initial state', () => {
    it('starts with isLoading true', async () => {
      // Make the query hang
      mockLimit.mockReturnValue(new Promise(() => {}))

      const { result } = renderHook(() =>
        useQuickActionAvailability({ projectId: 'test-project' })
      )

      expect(result.current.isLoading).toBe(true)
    })
  })

  describe('with no data', () => {
    beforeEach(() => {
      // Setup all queries to return 0 count
      mockLimit.mockResolvedValue({ count: 0, error: null })
    })

    it('disables findContradictions when no documents', async () => {
      const { result } = renderHook(() =>
        useQuickActionAvailability({ projectId: 'test-project' })
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.findContradictions.enabled).toBe(false)
      expect(result.current.findContradictions.reason).toBe(
        'Upload documents to detect contradictions'
      )
    })

    it('disables generateQA when no documents', async () => {
      const { result } = renderHook(() =>
        useQuickActionAvailability({ projectId: 'test-project' })
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.generateQA.enabled).toBe(false)
      expect(result.current.generateQA.reason).toBe('Upload documents to generate Q&A')
    })

    it('disables summarizeFindings when no findings', async () => {
      const { result } = renderHook(() =>
        useQuickActionAvailability({ projectId: 'test-project' })
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.summarizeFindings.enabled).toBe(false)
      expect(result.current.summarizeFindings.reason).toBe(
        'Process documents to see findings summary'
      )
    })

    it('disables identifyGaps when no documents', async () => {
      const { result } = renderHook(() =>
        useQuickActionAvailability({ projectId: 'test-project' })
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.identifyGaps.enabled).toBe(false)
      expect(result.current.identifyGaps.reason).toBe('Upload documents to identify gaps')
    })
  })

  describe('with documents', () => {
    beforeEach(() => {
      // Documents query returns count > 0
      let callCount = 0
      mockLimit.mockImplementation(() => {
        callCount++
        // First call is documents, second is findings, third is irls
        if (callCount === 1) {
          return Promise.resolve({ count: 5, error: null })
        }
        return Promise.resolve({ count: 0, error: null })
      })
    })

    it('enables findContradictions when documents exist', async () => {
      const { result } = renderHook(() =>
        useQuickActionAvailability({ projectId: 'test-project' })
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.findContradictions.enabled).toBe(true)
      expect(result.current.findContradictions.reason).toBeUndefined()
    })

    it('enables generateQA when documents exist', async () => {
      const { result } = renderHook(() =>
        useQuickActionAvailability({ projectId: 'test-project' })
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.generateQA.enabled).toBe(true)
    })

    it('enables identifyGaps when documents exist', async () => {
      const { result } = renderHook(() =>
        useQuickActionAvailability({ projectId: 'test-project' })
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.identifyGaps.enabled).toBe(true)
    })
  })

  describe('with findings', () => {
    beforeEach(() => {
      let callCount = 0
      mockLimit.mockImplementation(() => {
        callCount++
        // Second call is findings
        if (callCount === 2) {
          return Promise.resolve({ count: 10, error: null })
        }
        return Promise.resolve({ count: 0, error: null })
      })
    })

    it('enables summarizeFindings when findings exist', async () => {
      const { result } = renderHook(() =>
        useQuickActionAvailability({ projectId: 'test-project' })
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.summarizeFindings.enabled).toBe(true)
      expect(result.current.summarizeFindings.reason).toBeUndefined()
    })
  })

  describe('error handling', () => {
    it('handles errors gracefully', async () => {
      mockLimit.mockRejectedValue(new Error('Database error'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { result } = renderHook(() =>
        useQuickActionAvailability({ projectId: 'test-project' })
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should still return availability state (all disabled by default)
      expect(result.current.findContradictions.enabled).toBe(false)

      consoleSpy.mockRestore()
    })
  })

  describe('empty projectId', () => {
    it('returns disabled state for empty projectId', async () => {
      const { result } = renderHook(() =>
        useQuickActionAvailability({ projectId: '' })
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockFrom).not.toHaveBeenCalled()
      expect(result.current.findContradictions.enabled).toBe(false)
    })
  })

  describe('getAvailabilityMap', () => {
    it('maps state to action IDs correctly', () => {
      const state = {
        findContradictions: { enabled: true },
        generateQA: { enabled: false, reason: 'No docs' },
        summarizeFindings: { enabled: true },
        identifyGaps: { enabled: false, reason: 'No IRL' },
        isLoading: false,
      }

      const map = getAvailabilityMap(state)

      expect(map['find-contradictions']).toEqual({ enabled: true })
      expect(map['generate-qa']).toEqual({ enabled: false, reason: 'No docs' })
      expect(map['summarize-findings']).toEqual({ enabled: true })
      expect(map['identify-gaps']).toEqual({ enabled: false, reason: 'No IRL' })
    })
  })
})
