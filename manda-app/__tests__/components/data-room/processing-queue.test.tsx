/**
 * Unit tests for ProcessingQueue component
 * Story: E3.7 - Implement Processing Queue Visibility (AC: #1, #5)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProcessingQueue } from '@/components/data-room/processing-queue'
import * as processingApi from '@/lib/api/processing'
import * as hooks from '@/lib/hooks'

// Mock the hooks module
vi.mock('@/lib/hooks', () => ({
  useProcessingQueue: vi.fn(),
  useDocumentUpdates: vi.fn(),
}))

// Mock the processing API
vi.mock('@/lib/api/processing', async () => {
  const actual = await vi.importActual('@/lib/api/processing')
  return {
    ...actual,
    fetchQueueJobs: vi.fn(),
    cancelQueueJob: vi.fn(),
  }
})

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock fetch for retry endpoint
global.fetch = vi.fn()

const mockJobs = [
  {
    id: 'job-1',
    documentId: 'doc-1',
    documentName: 'queued-doc.pdf',
    fileType: 'application/pdf',
    status: 'queued' as const,
    processingStage: null,
    createdAt: new Date().toISOString(),
    startedAt: null,
    timeInQueue: 30,
    estimatedCompletion: null,
    retryCount: 0,
    error: null,
  },
  {
    id: 'job-2',
    documentId: 'doc-2',
    documentName: 'processing-doc.xlsx',
    fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    status: 'processing' as const,
    processingStage: 'parsing' as const,
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    timeInQueue: 60,
    estimatedCompletion: new Date(Date.now() + 30000).toISOString(),
    retryCount: 0,
    error: null,
  },
]

describe('ProcessingQueue Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementations
    vi.mocked(hooks.useProcessingQueue).mockReturnValue({
      jobs: [],
      total: 0,
      hasMore: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      loadMore: vi.fn(),
    })

    vi.mocked(hooks.useDocumentUpdates).mockReturnValue({
      status: 'connected',
      reconnect: vi.fn(),
    })
  })

  describe('Empty State', () => {
    it('renders nothing when queue is empty and not loading', () => {
      const { container } = render(<ProcessingQueue projectId="project-1" />)
      expect(container.firstChild).toBeNull()
    })
  })

  describe('Loading State', () => {
    it('shows loading state', () => {
      vi.mocked(hooks.useProcessingQueue).mockReturnValue({
        jobs: [],
        total: 0,
        hasMore: false,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
        loadMore: vi.fn(),
      })

      render(<ProcessingQueue projectId="project-1" />)
      expect(screen.getByText('Processing Queue')).toBeInTheDocument()
    })
  })

  describe('Error State', () => {
    it('shows error message with retry button', () => {
      vi.mocked(hooks.useProcessingQueue).mockReturnValue({
        jobs: [],
        total: 0,
        hasMore: false,
        isLoading: false,
        error: new Error('Failed to load'),
        refetch: vi.fn(),
        loadMore: vi.fn(),
      })

      render(<ProcessingQueue projectId="project-1" />)
      expect(screen.getByText('Failed to load queue')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    it('calls refetch when retry clicked', async () => {
      const refetch = vi.fn()
      vi.mocked(hooks.useProcessingQueue).mockReturnValue({
        jobs: [],
        total: 0,
        hasMore: false,
        isLoading: false,
        error: new Error('Failed to load'),
        refetch,
        loadMore: vi.fn(),
      })

      const user = userEvent.setup()
      render(<ProcessingQueue projectId="project-1" />)

      await user.click(screen.getByRole('button', { name: /retry/i }))
      expect(refetch).toHaveBeenCalled()
    })
  })

  describe('Queue Display', () => {
    it('shows queue header with item count', () => {
      vi.mocked(hooks.useProcessingQueue).mockReturnValue({
        jobs: mockJobs,
        total: 2,
        hasMore: false,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        loadMore: vi.fn(),
      })

      render(<ProcessingQueue projectId="project-1" />)
      expect(screen.getByText('Processing Queue')).toBeInTheDocument()
      expect(screen.getByText('(2 items)')).toBeInTheDocument()
    })

    it('renders queue items', () => {
      vi.mocked(hooks.useProcessingQueue).mockReturnValue({
        jobs: mockJobs,
        total: 2,
        hasMore: false,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        loadMore: vi.fn(),
      })

      render(<ProcessingQueue projectId="project-1" />)
      expect(screen.getByText('queued-doc.pdf')).toBeInTheDocument()
      expect(screen.getByText('processing-doc.xlsx')).toBeInTheDocument()
    })

    it('shows status badges in header', () => {
      vi.mocked(hooks.useProcessingQueue).mockReturnValue({
        jobs: mockJobs,
        total: 2,
        hasMore: false,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        loadMore: vi.fn(),
      })

      render(<ProcessingQueue projectId="project-1" />)
      expect(screen.getByText('1 processing')).toBeInTheDocument()
      expect(screen.getByText('1 queued')).toBeInTheDocument()
    })
  })

  describe('Collapsible Behavior', () => {
    it('is expanded by default', () => {
      vi.mocked(hooks.useProcessingQueue).mockReturnValue({
        jobs: mockJobs,
        total: 2,
        hasMore: false,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        loadMore: vi.fn(),
      })

      render(<ProcessingQueue projectId="project-1" />)
      // Items should be visible when expanded
      expect(screen.getByText('queued-doc.pdf')).toBeVisible()
    })

    it('can be collapsed', async () => {
      vi.mocked(hooks.useProcessingQueue).mockReturnValue({
        jobs: mockJobs,
        total: 2,
        hasMore: false,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        loadMore: vi.fn(),
      })

      const user = userEvent.setup()
      render(<ProcessingQueue projectId="project-1" />)

      // Click to collapse
      await user.click(screen.getByText('Processing Queue'))

      // Content should be hidden
      await waitFor(() => {
        expect(screen.queryByText('queued-doc.pdf')).not.toBeVisible()
      })
    })
  })

  describe('Cancel Functionality', () => {
    it('calls cancelQueueJob when job is cancelled', async () => {
      const refetch = vi.fn()
      vi.mocked(hooks.useProcessingQueue).mockReturnValue({
        jobs: [mockJobs[0]],
        total: 1,
        hasMore: false,
        isLoading: false,
        error: null,
        refetch,
        loadMore: vi.fn(),
      })
      vi.mocked(processingApi.cancelQueueJob).mockResolvedValue({
        success: true,
        message: 'Job cancelled',
      })

      const user = userEvent.setup()
      render(<ProcessingQueue projectId="project-1" />)

      // Find and click cancel button
      const cancelButtons = screen.getAllByRole('button')
      const cancelButton = cancelButtons.find((b) => b.querySelector('svg'))
      if (cancelButton) {
        await user.click(cancelButton)

        // Confirm in dialog
        await waitFor(() => {
          expect(screen.getByText('Cancel Processing?')).toBeInTheDocument()
        })

        await user.click(screen.getByRole('button', { name: /cancel job/i }))

        await waitFor(() => {
          expect(processingApi.cancelQueueJob).toHaveBeenCalledWith('job-1', 'project-1')
        })
      }
    })
  })

  describe('Retry Functionality', () => {
    it('calls retry endpoint when retry clicked', async () => {
      const failedJob = {
        ...mockJobs[0],
        id: 'job-failed',
        status: 'failed' as const,
        error: 'Processing failed',
      }

      const refetch = vi.fn()
      vi.mocked(hooks.useProcessingQueue).mockReturnValue({
        jobs: [failedJob],
        total: 1,
        hasMore: false,
        isLoading: false,
        error: null,
        refetch,
        loadMore: vi.fn(),
      })

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response)

      const user = userEvent.setup()
      render(<ProcessingQueue projectId="project-1" />)

      // Find and click retry button
      const retryButton = screen.getByRole('button')
      await user.click(retryButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/documents/doc-1/retry',
          expect.objectContaining({ method: 'POST' })
        )
      })
    })
  })

  describe('Real-time Updates', () => {
    it('subscribes to document updates', () => {
      vi.mocked(hooks.useProcessingQueue).mockReturnValue({
        jobs: mockJobs,
        total: 2,
        hasMore: false,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        loadMore: vi.fn(),
      })

      render(<ProcessingQueue projectId="project-1" />)

      expect(hooks.useDocumentUpdates).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({
          onUpdate: expect.any(Function),
        })
      )
    })
  })
})
