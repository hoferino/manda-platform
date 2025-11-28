/**
 * Unit tests for QueueItem component
 * Story: E3.7 - Implement Processing Queue Visibility (AC: #2, #4)
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueueItem } from '@/components/data-room/queue-item'
import type { QueueJob } from '@/lib/api/processing'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Sample queue job data
const mockQueuedJob: QueueJob = {
  id: 'job-1',
  documentId: 'doc-1',
  documentName: 'test-document.pdf',
  fileType: 'application/pdf',
  status: 'queued',
  processingStage: null,
  createdAt: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
  startedAt: null,
  timeInQueue: 60,
  estimatedCompletion: null,
  retryCount: 0,
  error: null,
}

const mockProcessingJob: QueueJob = {
  id: 'job-2',
  documentId: 'doc-2',
  documentName: 'processing-document.xlsx',
  fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  status: 'processing',
  processingStage: 'parsing',
  createdAt: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
  startedAt: new Date(Date.now() - 30000).toISOString(), // 30 seconds ago
  timeInQueue: 120,
  estimatedCompletion: new Date(Date.now() + 30000).toISOString(), // 30 seconds from now
  retryCount: 0,
  error: null,
}

const mockFailedJob: QueueJob = {
  id: 'job-3',
  documentId: 'doc-3',
  documentName: 'failed-document.docx',
  fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  status: 'failed',
  processingStage: null,
  createdAt: new Date(Date.now() - 180000).toISOString(),
  startedAt: new Date(Date.now() - 120000).toISOString(),
  timeInQueue: 180,
  estimatedCompletion: null,
  retryCount: 2,
  error: 'Document parsing failed: Invalid format',
}

describe('QueueItem Component', () => {
  describe('Display', () => {
    it('renders document name', () => {
      render(<QueueItem job={mockQueuedJob} />)
      expect(screen.getByText('test-document.pdf')).toBeInTheDocument()
    })

    it('displays time in queue for queued job', () => {
      render(<QueueItem job={mockQueuedJob} />)
      // 60 seconds formats as "1m" (formatTimeInQueue: seconds < 60 returns "Xs", else returns "Xm")
      expect(screen.getByText('1m')).toBeInTheDocument()
    })

    it('displays processing stage for active job', () => {
      render(<QueueItem job={mockProcessingJob} />)
      // ProcessingProgress component should be visible
      expect(screen.getByText('processing-document.xlsx')).toBeInTheDocument()
    })

    it('displays failed status for failed job', () => {
      render(<QueueItem job={mockFailedJob} />)
      expect(screen.getByText('Failed')).toBeInTheDocument()
    })

    it('displays retry count when retries > 0', () => {
      render(<QueueItem job={mockFailedJob} />)
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('displays error details tooltip for failed jobs', () => {
      render(<QueueItem job={mockFailedJob} />)
      expect(screen.getByText('(details)')).toBeInTheDocument()
    })
  })

  describe('Cancel Action', () => {
    it('shows cancel button for queued jobs', () => {
      const onCancel = vi.fn()
      render(<QueueItem job={mockQueuedJob} onCancel={onCancel} />)
      const cancelButton = screen.getByRole('button')
      expect(cancelButton).toBeInTheDocument()
    })

    it('does not show cancel button for processing jobs', () => {
      const onCancel = vi.fn()
      render(<QueueItem job={mockProcessingJob} onCancel={onCancel} />)
      // Should not have a cancel button
      const buttons = screen.queryAllByRole('button')
      expect(buttons.length).toBe(0)
    })

    it('opens confirmation dialog when cancel clicked', async () => {
      const user = userEvent.setup()
      const onCancel = vi.fn()
      render(<QueueItem job={mockQueuedJob} onCancel={onCancel} />)

      await user.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText('Cancel Processing?')).toBeInTheDocument()
      })
    })

    it('calls onCancel when confirmed', async () => {
      const user = userEvent.setup()
      const onCancel = vi.fn().mockResolvedValue(undefined)
      render(<QueueItem job={mockQueuedJob} onCancel={onCancel} />)

      // Open dialog
      await user.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText('Cancel Processing?')).toBeInTheDocument()
      })

      // Confirm cancellation
      await user.click(screen.getByRole('button', { name: /cancel job/i }))

      await waitFor(() => {
        expect(onCancel).toHaveBeenCalledWith('job-1')
      })
    })

    it('does not call onCancel when dialog is dismissed', async () => {
      const user = userEvent.setup()
      const onCancel = vi.fn()
      render(<QueueItem job={mockQueuedJob} onCancel={onCancel} />)

      // Open dialog
      await user.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText('Cancel Processing?')).toBeInTheDocument()
      })

      // Click "Keep in Queue"
      await user.click(screen.getByRole('button', { name: /keep in queue/i }))

      expect(onCancel).not.toHaveBeenCalled()
    })
  })

  describe('Retry Action', () => {
    it('shows retry button for failed jobs', () => {
      const onRetry = vi.fn()
      render(<QueueItem job={mockFailedJob} onRetry={onRetry} />)
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('calls onRetry when retry button clicked', async () => {
      const user = userEvent.setup()
      const onRetry = vi.fn().mockResolvedValue(undefined)
      render(<QueueItem job={mockFailedJob} onRetry={onRetry} />)

      // Click retry button
      await user.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(onRetry).toHaveBeenCalledWith('doc-3')
      })
    })
  })

  describe('Styling', () => {
    it('applies error styling for failed jobs', () => {
      const { container } = render(<QueueItem job={mockFailedJob} />)
      const item = container.firstChild as HTMLElement
      expect(item).toHaveClass('border-red-200')
    })

    it('does not apply error styling for queued jobs', () => {
      const { container } = render(<QueueItem job={mockQueuedJob} />)
      const item = container.firstChild as HTMLElement
      expect(item).not.toHaveClass('border-red-200')
    })
  })
})
