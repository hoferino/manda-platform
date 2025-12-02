/**
 * ChatUploadStatus Component Tests
 *
 * Tests for the upload status display component.
 * Story: E5.9 - Implement Document Upload via Chat Interface
 * AC: #4 (Status Updates via Chat Messages)
 * AC: #5 (Post-Processing Notification)
 * AC: #6 (Error Handling)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatUploadStatus, ChatUploadStatusList } from '@/components/chat/ChatUploadStatus'
import type { ChatUploadItem } from '@/lib/hooks/useChatUpload'

describe('ChatUploadStatus', () => {
  const createUpload = (overrides: Partial<ChatUploadItem> = {}): ChatUploadItem => ({
    id: 'upload-1',
    fileName: 'test.pdf',
    fileSize: 1024 * 1024, // 1MB
    stage: 'uploading',
    uploadProgress: 50,
    startedAt: new Date(),
    ...overrides,
  })

  const mockOnRetry = vi.fn()
  const mockOnDismiss = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders upload status card', () => {
      render(<ChatUploadStatus upload={createUpload()} />)

      expect(screen.getByTestId('chat-upload-status')).toBeInTheDocument()
    })

    it('displays file name', () => {
      render(<ChatUploadStatus upload={createUpload({ fileName: 'financials.xlsx' })} />)

      expect(screen.getByText('financials.xlsx')).toBeInTheDocument()
    })

    it('displays file size', () => {
      render(<ChatUploadStatus upload={createUpload({ fileSize: 2.5 * 1024 * 1024 })} />)

      expect(screen.getByText('(2.5 MB)')).toBeInTheDocument()
    })

    it('has status role for accessibility', () => {
      render(<ChatUploadStatus upload={createUpload()} />)

      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })

  describe('uploading stage (AC: #4)', () => {
    it('shows uploading label', () => {
      render(<ChatUploadStatus upload={createUpload({ stage: 'uploading' })} />)

      // "Uploading" appears with percentage, so use regex
      expect(screen.getByText(/Uploading/)).toBeInTheDocument()
    })

    it('shows upload progress percentage', () => {
      render(
        <ChatUploadStatus upload={createUpload({ stage: 'uploading', uploadProgress: 75 })} />
      )

      expect(screen.getByText(/75%/)).toBeInTheDocument()
    })

    it('renders progress bar', () => {
      render(<ChatUploadStatus upload={createUpload({ stage: 'uploading' })} />)

      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('progress bar has correct aria-label', () => {
      render(
        <ChatUploadStatus upload={createUpload({ stage: 'uploading', uploadProgress: 60 })} />
      )

      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-label', 'Upload progress: 60%')
    })
  })

  describe('processing stages (AC: #4)', () => {
    it('shows parsing stage', () => {
      render(<ChatUploadStatus upload={createUpload({ stage: 'parsing' })} />)

      expect(screen.getByText('Parsing document')).toBeInTheDocument()
    })

    it('shows embedding stage', () => {
      render(<ChatUploadStatus upload={createUpload({ stage: 'embedding' })} />)

      expect(screen.getByText('Generating embeddings')).toBeInTheDocument()
    })

    it('shows analyzing stage', () => {
      render(<ChatUploadStatus upload={createUpload({ stage: 'analyzing' })} />)

      expect(screen.getByText('Analyzing content')).toBeInTheDocument()
    })

    it('shows processing pipeline indicators', () => {
      render(<ChatUploadStatus upload={createUpload({ stage: 'embedding' })} />)

      expect(screen.getByText('Parse')).toBeInTheDocument()
      expect(screen.getByText('Embed')).toBeInTheDocument()
      expect(screen.getByText('Analyze')).toBeInTheDocument()
    })

    it('highlights current and completed stages in pipeline', () => {
      render(<ChatUploadStatus upload={createUpload({ stage: 'embedding' })} />)

      const parseLabel = screen.getByText('Parse')
      const embedLabel = screen.getByText('Embed')
      const analyzeLabel = screen.getByText('Analyze')

      // Parse and Embed should be highlighted, Analyze should not
      expect(parseLabel).toHaveClass('text-primary')
      expect(embedLabel).toHaveClass('text-primary')
      expect(analyzeLabel).not.toHaveClass('text-primary')
    })

    it('shows loading spinner during processing', () => {
      render(<ChatUploadStatus upload={createUpload({ stage: 'analyzing' })} />)

      const card = screen.getByTestId('chat-upload-status')
      const spinner = card.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('complete stage (AC: #5)', () => {
    it('shows completion message', () => {
      render(<ChatUploadStatus upload={createUpload({ stage: 'complete' })} />)

      expect(screen.getByText('Analysis complete')).toBeInTheDocument()
    })

    it('shows findings count', () => {
      render(
        <ChatUploadStatus
          upload={createUpload({ stage: 'complete', findingsCount: 12 })}
        />
      )

      expect(screen.getByText(/12 findings extracted/)).toBeInTheDocument()
    })

    it('applies success styling', () => {
      render(<ChatUploadStatus upload={createUpload({ stage: 'complete' })} />)

      const card = screen.getByTestId('chat-upload-status')
      expect(card).toHaveClass('bg-green-50')
    })

    it('shows check mark icon', () => {
      render(<ChatUploadStatus upload={createUpload({ stage: 'complete' })} />)

      const card = screen.getByTestId('chat-upload-status')
      // CheckCircle2 icon should be present
      const checkIcon = card.querySelector('svg.text-green-500')
      expect(checkIcon).toBeInTheDocument()
    })
  })

  describe('failed stage (AC: #6)', () => {
    it('shows error message', () => {
      render(
        <ChatUploadStatus
          upload={createUpload({ stage: 'failed', error: 'Network error during upload' })}
        />
      )

      expect(screen.getByText('Network error during upload')).toBeInTheDocument()
    })

    it('applies error styling', () => {
      render(<ChatUploadStatus upload={createUpload({ stage: 'failed' })} />)

      const card = screen.getByTestId('chat-upload-status')
      expect(card).toHaveClass('bg-destructive/5')
    })

    it('shows error icon', () => {
      render(<ChatUploadStatus upload={createUpload({ stage: 'failed' })} />)

      const card = screen.getByTestId('chat-upload-status')
      const errorIcon = card.querySelector('svg.text-destructive')
      expect(errorIcon).toBeInTheDocument()
    })

    it('shows suggestion for size error', () => {
      render(
        <ChatUploadStatus
          upload={createUpload({
            stage: 'failed',
            error: 'File exceeds maximum size (500MB)',
          })}
        />
      )

      expect(screen.getByText(/smaller file/i)).toBeInTheDocument()
    })

    it('shows suggestion for format error', () => {
      render(
        <ChatUploadStatus
          upload={createUpload({
            stage: 'failed',
            error: 'File type not supported',
          })}
        />
      )

      expect(screen.getByText(/Supported formats/i)).toBeInTheDocument()
    })

    it('shows suggestion for network error', () => {
      render(
        <ChatUploadStatus
          upload={createUpload({
            stage: 'failed',
            error: 'Network error during upload',
          })}
        />
      )

      expect(screen.getByText(/internet connection/i)).toBeInTheDocument()
    })

    it('shows retry button when onRetry provided', () => {
      render(
        <ChatUploadStatus
          upload={createUpload({ stage: 'failed' })}
          onRetry={mockOnRetry}
        />
      )

      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    it('calls onRetry when retry button clicked', async () => {
      const user = userEvent.setup()
      render(
        <ChatUploadStatus
          upload={createUpload({ stage: 'failed' })}
          onRetry={mockOnRetry}
        />
      )

      await user.click(screen.getByRole('button', { name: /retry/i }))

      expect(mockOnRetry).toHaveBeenCalledTimes(1)
    })

    it('shows dismiss button when onDismiss provided', () => {
      render(
        <ChatUploadStatus
          upload={createUpload({ stage: 'failed' })}
          onDismiss={mockOnDismiss}
        />
      )

      // There are multiple dismiss buttons (one in the error actions, one in the card)
      const dismissButtons = screen.getAllByRole('button', { name: /dismiss/i })
      expect(dismissButtons.length).toBeGreaterThan(0)
    })

    it('calls onDismiss when dismiss button clicked', async () => {
      const user = userEvent.setup()
      render(
        <ChatUploadStatus
          upload={createUpload({ stage: 'failed' })}
          onDismiss={mockOnDismiss}
        />
      )

      // Click the first dismiss button found
      const dismissButtons = screen.getAllByRole('button', { name: /dismiss/i })
      await user.click(dismissButtons[0])

      expect(mockOnDismiss).toHaveBeenCalledTimes(1)
    })
  })

  describe('dismiss button', () => {
    it('shows dismiss button on completed uploads', () => {
      render(
        <ChatUploadStatus
          upload={createUpload({ stage: 'complete' })}
          onDismiss={mockOnDismiss}
        />
      )

      const card = screen.getByTestId('chat-upload-status')
      const dismissButton = within(card).getAllByRole('button')[0]
      expect(dismissButton).toBeInTheDocument()
    })

    it('hides dismiss button during processing', () => {
      render(
        <ChatUploadStatus
          upload={createUpload({ stage: 'parsing' })}
          onDismiss={mockOnDismiss}
        />
      )

      // No dismiss button during processing
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })
})

describe('ChatUploadStatusList', () => {
  const createUpload = (overrides: Partial<ChatUploadItem> = {}): ChatUploadItem => ({
    id: `upload-${Math.random()}`,
    fileName: 'test.pdf',
    fileSize: 1024 * 1024,
    stage: 'uploading',
    uploadProgress: 50,
    startedAt: new Date(),
    ...overrides,
  })

  const mockOnRetry = vi.fn()
  const mockOnDismiss = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when uploads array is empty', () => {
    render(<ChatUploadStatusList uploads={[]} />)

    expect(screen.queryByTestId('chat-upload-status-list')).not.toBeInTheDocument()
  })

  it('renders list of upload statuses', () => {
    const uploads = [
      createUpload({ id: 'upload-1', fileName: 'file1.pdf' }),
      createUpload({ id: 'upload-2', fileName: 'file2.xlsx' }),
    ]

    render(<ChatUploadStatusList uploads={uploads} />)

    expect(screen.getByTestId('chat-upload-status-list')).toBeInTheDocument()
    expect(screen.getByText('file1.pdf')).toBeInTheDocument()
    expect(screen.getByText('file2.xlsx')).toBeInTheDocument()
  })

  it('passes onRetry callback to items', async () => {
    const user = userEvent.setup()
    const uploads = [createUpload({ id: 'upload-1', stage: 'failed' })]

    render(
      <ChatUploadStatusList
        uploads={uploads}
        onRetry={mockOnRetry}
      />
    )

    await user.click(screen.getByRole('button', { name: /retry/i }))

    expect(mockOnRetry).toHaveBeenCalledWith('upload-1')
  })

  it('passes onDismiss callback to items', async () => {
    const user = userEvent.setup()
    const uploads = [createUpload({ id: 'upload-1', stage: 'complete' })]

    render(
      <ChatUploadStatusList
        uploads={uploads}
        onDismiss={mockOnDismiss}
      />
    )

    // Find the dismiss button in the completed upload card
    const dismissButton = screen.getByRole('button', { name: /dismiss/i })
    await user.click(dismissButton)

    expect(mockOnDismiss).toHaveBeenCalledWith('upload-1')
  })
})
