/**
 * ChatDropZone Component Tests
 *
 * Tests for the drag-and-drop upload zone.
 * Story: E5.9 - Implement Document Upload via Chat Interface
 * AC: #2 (Drag-and-Drop Support)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChatDropZone, validateFile } from '@/components/chat/ChatDropZone'
import { MAX_FILE_SIZE } from '@/components/data-room/upload-zone'

describe('ChatDropZone', () => {
  const mockOnFilesDropped = vi.fn()
  const projectId = 'project-123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders children content', () => {
      render(
        <ChatDropZone projectId={projectId} onFilesDropped={mockOnFilesDropped}>
          <div data-testid="child-content">Chat Content</div>
        </ChatDropZone>
      )

      expect(screen.getByTestId('child-content')).toBeInTheDocument()
    })

    it('renders drop zone wrapper', () => {
      render(
        <ChatDropZone projectId={projectId} onFilesDropped={mockOnFilesDropped}>
          <div>Content</div>
        </ChatDropZone>
      )

      expect(screen.getByTestId('chat-drop-zone')).toBeInTheDocument()
    })

    it('does not show overlay initially', () => {
      render(
        <ChatDropZone projectId={projectId} onFilesDropped={mockOnFilesDropped}>
          <div>Content</div>
        </ChatDropZone>
      )

      expect(screen.queryByTestId('chat-drop-overlay')).not.toBeInTheDocument()
    })
  })

  describe('drag and drop (AC: #2)', () => {
    it('shows overlay when dragging files over', () => {
      render(
        <ChatDropZone projectId={projectId} onFilesDropped={mockOnFilesDropped}>
          <div>Content</div>
        </ChatDropZone>
      )

      const dropZone = screen.getByTestId('chat-drop-zone')

      fireEvent.dragEnter(dropZone, {
        dataTransfer: {
          items: [{ kind: 'file' }],
        },
      })

      expect(screen.getByTestId('chat-drop-overlay')).toBeInTheDocument()
    })

    it('shows drop instructions in overlay', () => {
      render(
        <ChatDropZone projectId={projectId} onFilesDropped={mockOnFilesDropped}>
          <div>Content</div>
        </ChatDropZone>
      )

      const dropZone = screen.getByTestId('chat-drop-zone')

      fireEvent.dragEnter(dropZone, {
        dataTransfer: {
          items: [{ kind: 'file' }],
        },
      })

      expect(screen.getByText('Drop files to upload')).toBeInTheDocument()
      expect(screen.getByText(/PDF, Excel, Word/)).toBeInTheDocument()
    })

    it('hides overlay when drag leaves', () => {
      render(
        <ChatDropZone projectId={projectId} onFilesDropped={mockOnFilesDropped}>
          <div>Content</div>
        </ChatDropZone>
      )

      const dropZone = screen.getByTestId('chat-drop-zone')

      // Enter then leave
      fireEvent.dragEnter(dropZone, {
        dataTransfer: { items: [{ kind: 'file' }] },
      })
      fireEvent.dragLeave(dropZone)

      expect(screen.queryByTestId('chat-drop-overlay')).not.toBeInTheDocument()
    })

    it('hides overlay after drop', () => {
      render(
        <ChatDropZone projectId={projectId} onFilesDropped={mockOnFilesDropped}>
          <div>Content</div>
        </ChatDropZone>
      )

      const dropZone = screen.getByTestId('chat-drop-zone')
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })

      fireEvent.dragEnter(dropZone, {
        dataTransfer: { items: [{ kind: 'file' }] },
      })
      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file] },
      })

      expect(screen.queryByTestId('chat-drop-overlay')).not.toBeInTheDocument()
    })

    it('calls onFilesDropped with valid files', () => {
      render(
        <ChatDropZone projectId={projectId} onFilesDropped={mockOnFilesDropped}>
          <div>Content</div>
        </ChatDropZone>
      )

      const dropZone = screen.getByTestId('chat-drop-zone')
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file] },
      })

      expect(mockOnFilesDropped).toHaveBeenCalledWith([file])
    })

    it('handles multiple files dropped at once', () => {
      render(
        <ChatDropZone projectId={projectId} onFilesDropped={mockOnFilesDropped}>
          <div>Content</div>
        </ChatDropZone>
      )

      const dropZone = screen.getByTestId('chat-drop-zone')
      const file1 = new File(['test1'], 'test1.pdf', { type: 'application/pdf' })
      const file2 = new File(['test2'], 'test2.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file1, file2] },
      })

      expect(mockOnFilesDropped).toHaveBeenCalledWith([file1, file2])
    })
  })

  describe('file validation', () => {
    it('rejects files exceeding max size', async () => {
      render(
        <ChatDropZone projectId={projectId} onFilesDropped={mockOnFilesDropped}>
          <div>Content</div>
        </ChatDropZone>
      )

      const dropZone = screen.getByTestId('chat-drop-zone')
      // Create a mock large file
      const largeFile = new File(['x'.repeat(100)], 'large.pdf', {
        type: 'application/pdf',
      })
      Object.defineProperty(largeFile, 'size', { value: MAX_FILE_SIZE + 1 })

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [largeFile] },
      })

      // Should show error
      await waitFor(() => {
        expect(screen.getByTestId('chat-drop-errors')).toBeInTheDocument()
      })

      // Should not call onFilesDropped with invalid file
      expect(mockOnFilesDropped).not.toHaveBeenCalled()
    })

    it('rejects unsupported file types', async () => {
      render(
        <ChatDropZone projectId={projectId} onFilesDropped={mockOnFilesDropped}>
          <div>Content</div>
        </ChatDropZone>
      )

      const dropZone = screen.getByTestId('chat-drop-zone')
      const unsupportedFile = new File(['test'], 'test.exe', {
        type: 'application/x-msdownload',
      })

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [unsupportedFile] },
      })

      await waitFor(() => {
        expect(screen.getByTestId('chat-drop-errors')).toBeInTheDocument()
      })

      expect(mockOnFilesDropped).not.toHaveBeenCalled()
    })

    it('accepts valid files and rejects invalid ones in same drop', async () => {
      render(
        <ChatDropZone projectId={projectId} onFilesDropped={mockOnFilesDropped}>
          <div>Content</div>
        </ChatDropZone>
      )

      const dropZone = screen.getByTestId('chat-drop-zone')
      const validFile = new File(['test'], 'valid.pdf', { type: 'application/pdf' })
      const invalidFile = new File(['test'], 'invalid.exe', {
        type: 'application/x-msdownload',
      })

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [validFile, invalidFile] },
      })

      // Should call with only valid file
      expect(mockOnFilesDropped).toHaveBeenCalledWith([validFile])

      // Should show error for invalid file
      await waitFor(() => {
        expect(screen.getByTestId('chat-drop-errors')).toBeInTheDocument()
      })
    })

    it('dismisses error messages when close button clicked', async () => {
      render(
        <ChatDropZone projectId={projectId} onFilesDropped={mockOnFilesDropped}>
          <div>Content</div>
        </ChatDropZone>
      )

      const dropZone = screen.getByTestId('chat-drop-zone')
      const invalidFile = new File(['test'], 'test.exe', {
        type: 'application/x-msdownload',
      })

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [invalidFile] },
      })

      await waitFor(() => {
        expect(screen.getByTestId('chat-drop-errors')).toBeInTheDocument()
      })

      // Click dismiss button
      const dismissButton = screen.getByRole('button', { name: /dismiss/i })
      fireEvent.click(dismissButton)

      expect(screen.queryByTestId('chat-drop-errors')).not.toBeInTheDocument()
    })
  })

  describe('disabled state', () => {
    it('does not show overlay when disabled', () => {
      render(
        <ChatDropZone projectId={projectId} onFilesDropped={mockOnFilesDropped} disabled>
          <div>Content</div>
        </ChatDropZone>
      )

      const dropZone = screen.getByTestId('chat-drop-zone')

      fireEvent.dragEnter(dropZone, {
        dataTransfer: { items: [{ kind: 'file' }] },
      })

      expect(screen.queryByTestId('chat-drop-overlay')).not.toBeInTheDocument()
    })

    it('does not process files when disabled', () => {
      render(
        <ChatDropZone projectId={projectId} onFilesDropped={mockOnFilesDropped} disabled>
          <div>Content</div>
        </ChatDropZone>
      )

      const dropZone = screen.getByTestId('chat-drop-zone')
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file] },
      })

      expect(mockOnFilesDropped).not.toHaveBeenCalled()
    })
  })

  describe('validateFile function', () => {
    it('validates PDF files', () => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })
      expect(validateFile(file).valid).toBe(true)
    })

    it('validates Excel files', () => {
      const file = new File(['test'], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      expect(validateFile(file).valid).toBe(true)
    })

    it('validates Word files', () => {
      const file = new File(['test'], 'test.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
      expect(validateFile(file).valid).toBe(true)
    })

    it('validates images', () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      expect(validateFile(file).valid).toBe(true)
    })

    it('rejects executable files', () => {
      const file = new File(['test'], 'test.exe', { type: 'application/x-msdownload' })
      const result = validateFile(file)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('file type not supported')
    })

    it('rejects files by extension when MIME type is empty', () => {
      const file = new File(['test'], 'test.bat', { type: '' })
      const result = validateFile(file)
      expect(result.valid).toBe(false)
    })

    it('accepts files by extension when MIME type is empty but extension is valid', () => {
      const file = new File(['test'], 'test.pdf', { type: '' })
      expect(validateFile(file).valid).toBe(true)
    })
  })
})
