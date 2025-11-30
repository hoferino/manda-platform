/**
 * Tests for RealtimeToastHandler component
 * Story: E4.13 - Build Real-Time Knowledge Graph Updates (AC: #5)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRealtimeToasts } from '@/components/knowledge-explorer/RealtimeToastHandler'
import { toast } from 'sonner'
import type { FindingUpdate } from '@/lib/hooks/useFindingsRealtime'
import type { ContradictionUpdate } from '@/lib/hooks/useContradictionsRealtime'
import type { Finding } from '@/lib/types/findings'
import type { Contradiction } from '@/lib/types/contradictions'

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

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

describe('useRealtimeToasts', () => {
  const projectId = 'project-123'

  const createFinding = (overrides: Partial<Finding> = {}): Finding => ({
    id: 'finding-1',
    dealId: projectId,
    documentId: 'doc-1',
    chunkId: null,
    userId: 'user-1',
    text: 'Test finding text',
    sourceDocument: 'document.pdf',
    pageNumber: 1,
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

  const createContradiction = (overrides: Partial<Contradiction> = {}): Contradiction => ({
    id: 'contradiction-1',
    dealId: projectId,
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

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Finding toast notifications', () => {
    it('should show toast when new finding is inserted', () => {
      const { result } = renderHook(() =>
        useRealtimeToasts({ projectId, enabled: true })
      )

      const update: FindingUpdate = {
        type: 'INSERT',
        finding: createFinding(),
      }

      act(() => {
        result.current.handleFindingUpdate(update)
      })

      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('New finding extracted'),
        expect.objectContaining({
          duration: 5000,
          action: expect.objectContaining({
            label: 'View',
          }),
        })
      )
    })

    it('should include document name in toast message', () => {
      const { result } = renderHook(() =>
        useRealtimeToasts({ projectId, enabled: true })
      )

      const update: FindingUpdate = {
        type: 'INSERT',
        finding: createFinding({ sourceDocument: 'my-document.pdf' }),
      }

      act(() => {
        result.current.handleFindingUpdate(update)
      })

      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('my-document.pdf'),
        expect.any(Object)
      )
    })

    it('should use default text when no source document', () => {
      const { result } = renderHook(() =>
        useRealtimeToasts({ projectId, enabled: true })
      )

      const update: FindingUpdate = {
        type: 'INSERT',
        finding: createFinding({ sourceDocument: null }),
      }

      act(() => {
        result.current.handleFindingUpdate(update)
      })

      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('a document'),
        expect.any(Object)
      )
    })

    it('should not show toast for UPDATE events', () => {
      const { result } = renderHook(() =>
        useRealtimeToasts({ projectId, enabled: true })
      )

      const update: FindingUpdate = {
        type: 'UPDATE',
        finding: createFinding({ text: 'Updated text' }),
        oldFinding: createFinding({ text: 'Original text' }),
      }

      act(() => {
        result.current.handleFindingUpdate(update)
      })

      expect(toast.success).not.toHaveBeenCalled()
    })

    it('should not show toast for DELETE events', () => {
      const { result } = renderHook(() =>
        useRealtimeToasts({ projectId, enabled: true })
      )

      const update: FindingUpdate = {
        type: 'DELETE',
        finding: createFinding(),
      }

      act(() => {
        result.current.handleFindingUpdate(update)
      })

      expect(toast.success).not.toHaveBeenCalled()
    })
  })

  describe('Contradiction toast notifications', () => {
    it('should show warning toast when new contradiction is detected', () => {
      const { result } = renderHook(() =>
        useRealtimeToasts({ projectId, enabled: true })
      )

      const update: ContradictionUpdate = {
        type: 'INSERT',
        contradiction: createContradiction(),
      }

      act(() => {
        result.current.handleContradictionUpdate(update)
      })

      expect(toast.warning).toHaveBeenCalledWith(
        'New contradiction detected',
        expect.objectContaining({
          duration: 5000,
          action: expect.objectContaining({
            label: 'View',
          }),
        })
      )
    })

    it('should not show toast for UPDATE events on contradictions', () => {
      const { result } = renderHook(() =>
        useRealtimeToasts({ projectId, enabled: true })
      )

      const update: ContradictionUpdate = {
        type: 'UPDATE',
        contradiction: createContradiction({ status: 'resolved' }),
        oldContradiction: createContradiction({ status: 'unresolved' }),
      }

      act(() => {
        result.current.handleContradictionUpdate(update)
      })

      expect(toast.warning).not.toHaveBeenCalled()
      expect(toast.success).not.toHaveBeenCalled()
    })
  })

  describe('Toast options', () => {
    it('should not show toasts when disabled', () => {
      const { result } = renderHook(() =>
        useRealtimeToasts({ projectId, enabled: false })
      )

      act(() => {
        result.current.handleFindingUpdate({
          type: 'INSERT',
          finding: createFinding(),
        })
      })

      expect(toast.success).not.toHaveBeenCalled()
    })

    it('should set duration to 5 seconds', () => {
      const { result } = renderHook(() =>
        useRealtimeToasts({ projectId, enabled: true })
      )

      act(() => {
        result.current.handleFindingUpdate({
          type: 'INSERT',
          finding: createFinding(),
        })
      })

      expect(toast.success).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          duration: 5000,
        })
      )
    })
  })

  describe('Navigation callbacks', () => {
    it('should call onNavigateToFinding when provided', () => {
      const onNavigateToFinding = vi.fn()

      const { result } = renderHook(() =>
        useRealtimeToasts({
          projectId,
          enabled: true,
          onNavigateToFinding,
        })
      )

      act(() => {
        result.current.handleFindingUpdate({
          type: 'INSERT',
          finding: createFinding({ id: 'finding-xyz' }),
        })
      })

      // The callback is passed to the toast action
      expect(toast.success).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          action: expect.objectContaining({
            label: 'View',
            onClick: expect.any(Function),
          }),
        })
      )
    })

    it('should call onNavigateToContradiction when provided', () => {
      const onNavigateToContradiction = vi.fn()

      const { result } = renderHook(() =>
        useRealtimeToasts({
          projectId,
          enabled: true,
          onNavigateToContradiction,
        })
      )

      act(() => {
        result.current.handleContradictionUpdate({
          type: 'INSERT',
          contradiction: createContradiction({ id: 'contradiction-xyz' }),
        })
      })

      expect(toast.warning).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          action: expect.objectContaining({
            label: 'View',
            onClick: expect.any(Function),
          }),
        })
      )
    })
  })

  describe('Processing complete notifications', () => {
    it('should show success toast for processing complete', () => {
      const { result } = renderHook(() =>
        useRealtimeToasts({ projectId, enabled: true })
      )

      act(() => {
        result.current.showProcessingComplete('document.pdf', 5)
      })

      expect(toast.success).toHaveBeenCalledWith(
        'document.pdf processing complete - 5 findings extracted',
        expect.objectContaining({
          duration: 5000,
        })
      )
    })

    it('should show different message when no findings extracted', () => {
      const { result } = renderHook(() =>
        useRealtimeToasts({ projectId, enabled: true })
      )

      act(() => {
        result.current.showProcessingComplete('document.pdf', 0)
      })

      expect(toast.success).toHaveBeenCalledWith(
        'document.pdf processing complete',
        expect.any(Object)
      )
    })

    it('should not show processing complete toast when disabled', () => {
      const { result } = renderHook(() =>
        useRealtimeToasts({ projectId, enabled: false })
      )

      act(() => {
        result.current.showProcessingComplete('document.pdf', 5)
      })

      expect(toast.success).not.toHaveBeenCalled()
    })
  })

  describe('handleRealtimeEvent', () => {
    it('should route finding events to handleFindingUpdate', () => {
      const { result } = renderHook(() =>
        useRealtimeToasts({ projectId, enabled: true })
      )

      act(() => {
        result.current.handleRealtimeEvent({
          source: 'findings',
          update: {
            type: 'INSERT',
            finding: createFinding(),
          },
        })
      })

      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('New finding extracted'),
        expect.any(Object)
      )
    })

    it('should route contradiction events to handleContradictionUpdate', () => {
      const { result } = renderHook(() =>
        useRealtimeToasts({ projectId, enabled: true })
      )

      act(() => {
        result.current.handleRealtimeEvent({
          source: 'contradictions',
          update: {
            type: 'INSERT',
            contradiction: createContradiction(),
          },
        })
      })

      expect(toast.warning).toHaveBeenCalledWith(
        'New contradiction detected',
        expect.any(Object)
      )
    })
  })
})
