/**
 * Unit tests for UploadZone component
 * Story: E2.7 - Build Upload Progress Indicators and WebSocket Updates
 * Tests: AC1 (Drag-and-Drop), AC2 (File Picker Button)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UploadZone } from '@/components/data-room/upload-zone'
import { useUploadStore } from '@/stores/upload-store'

// Mock ResizeObserver for Radix UI components
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver

// Create a mock file
function createMockFile(
  name: string,
  size: number,
  type: string
): File {
  const blob = new Blob(['x'.repeat(size)], { type })
  return new File([blob], name, { type })
}

// Create mock DataTransfer
function createMockDataTransfer(files: File[]): DataTransfer {
  const dt = new DataTransfer()
  files.forEach((file) => dt.items.add(file))
  return dt
}

describe('UploadZone Component', () => {
  beforeEach(() => {
    // Reset the Zustand store
    useUploadStore.setState({ uploads: [], isProcessing: false })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Rendering', () => {
    it('renders drop zone with instructions', () => {
      render(<UploadZone projectId="test-project" />)

      expect(screen.getByText('Drag & drop files here')).toBeInTheDocument()
      expect(screen.getByText('or click to select files')).toBeInTheDocument()
    })

    it('renders in compact mode with smaller UI', () => {
      render(<UploadZone projectId="test-project" compact />)

      expect(screen.getByText('Drag & drop files here')).toBeInTheDocument()
      // Compact mode hides the file type info
      expect(screen.queryByText(/max 500MB/)).not.toBeInTheDocument()
    })

    it('renders disabled state correctly', () => {
      render(<UploadZone projectId="test-project" disabled />)

      const dropZone = screen.getByRole('button', { name: /drop files here/i })
      expect(dropZone).toHaveClass('opacity-50')
    })
  })

  describe('File Selection (AC2)', () => {
    it('opens file picker on click', async () => {
      const user = userEvent.setup()
      render(<UploadZone projectId="test-project" />)

      const dropZone = screen.getByRole('button', { name: /drop files here/i })

      // Create a spy for the file input click
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const clickSpy = vi.spyOn(fileInput, 'click')

      await user.click(dropZone)

      expect(clickSpy).toHaveBeenCalled()
    })

    it('opens file picker on Upload Files button click', async () => {
      const user = userEvent.setup()
      render(<UploadZone projectId="test-project" />)

      const uploadButton = screen.getByRole('button', { name: /upload files/i })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const clickSpy = vi.spyOn(fileInput, 'click')

      await user.click(uploadButton)

      expect(clickSpy).toHaveBeenCalled()
    })

    it('accepts multiple files', () => {
      render(<UploadZone projectId="test-project" />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      expect(fileInput).toHaveAttribute('multiple')
    })

    it('restricts file types to allowed extensions', () => {
      render(<UploadZone projectId="test-project" />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      expect(fileInput.accept).toContain('.pdf')
      expect(fileInput.accept).toContain('.xlsx')
      expect(fileInput.accept).toContain('.docx')
    })
  })

  describe('Drag and Drop (AC1)', () => {
    it('shows visual feedback on drag enter', () => {
      render(<UploadZone projectId="test-project" />)

      const dropZone = screen.getByRole('button', { name: /drop files here/i })

      const mockDragEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        dataTransfer: {
          items: [{ kind: 'file' }],
        },
      }

      fireEvent.dragEnter(dropZone, mockDragEvent)

      expect(screen.getByText('Drop files here to upload')).toBeInTheDocument()
    })

    it('removes visual feedback on drag leave', async () => {
      render(<UploadZone projectId="test-project" />)

      const dropZone = screen.getByRole('button', { name: /drop files here/i })

      const mockDragEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        dataTransfer: {
          items: [{ kind: 'file' }],
        },
      }

      fireEvent.dragEnter(dropZone, mockDragEvent)
      expect(screen.getByText('Drop files here to upload')).toBeInTheDocument()

      fireEvent.dragLeave(dropZone, mockDragEvent)

      await waitFor(() => {
        expect(screen.queryByText('Drop files here to upload')).not.toBeInTheDocument()
      })
    })

    it('does not respond to drag when disabled', () => {
      render(<UploadZone projectId="test-project" disabled />)

      const dropZone = screen.getByRole('button', { name: /drop files here/i })

      const mockDragEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        dataTransfer: {
          items: [{ kind: 'file' }],
        },
      }

      fireEvent.dragEnter(dropZone, mockDragEvent)

      // Should NOT show the drop message when disabled
      expect(screen.queryByText('Drop files here to upload')).not.toBeInTheDocument()
    })
  })

  describe('File Validation', () => {
    it('shows error for files exceeding 500MB', async () => {
      const onFilesAdded = vi.fn()
      render(
        <UploadZone
          projectId="test-project"
          onFilesAdded={onFilesAdded}
        />
      )

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

      // Create a mock file object with a large size property
      const largeFile = new File(['x'], 'large.pdf', { type: 'application/pdf' })
      // Override the size property to simulate a 600MB file
      Object.defineProperty(largeFile, 'size', { value: 600 * 1024 * 1024 })

      Object.defineProperty(fileInput, 'files', {
        value: [largeFile],
        writable: false,
      })

      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText(/exceeds maximum size/i)).toBeInTheDocument()
      })
    })

    it('shows error for unsupported file types', async () => {
      const onFilesAdded = vi.fn()
      render(
        <UploadZone
          projectId="test-project"
          onFilesAdded={onFilesAdded}
        />
      )

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const invalidFile = createMockFile('script.exe', 1024, 'application/x-msdownload')

      Object.defineProperty(fileInput, 'files', {
        value: [invalidFile],
        writable: false,
      })

      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText(/file type not supported/i)).toBeInTheDocument()
      })
    })

    it('allows dismissing validation errors', async () => {
      const user = userEvent.setup()
      const onFilesAdded = vi.fn()
      render(
        <UploadZone
          projectId="test-project"
          onFilesAdded={onFilesAdded}
        />
      )

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const invalidFile = createMockFile('script.exe', 1024, 'application/x-msdownload')

      Object.defineProperty(fileInput, 'files', {
        value: [invalidFile],
        writable: false,
      })

      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText(/file type not supported/i)).toBeInTheDocument()
      })

      // Find and click dismiss button
      const dismissButton = screen.getByRole('button', { name: /dismiss/i })
      await user.click(dismissButton)

      await waitFor(() => {
        expect(screen.queryByText(/file type not supported/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Queue Integration', () => {
    it('adds valid files to upload queue', async () => {
      const onFilesAdded = vi.fn()
      render(
        <UploadZone
          projectId="test-project"
          folderPath="/docs"
          onFilesAdded={onFilesAdded}
        />
      )

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const validFile = createMockFile('document.pdf', 1024, 'application/pdf')

      Object.defineProperty(fileInput, 'files', {
        value: [validFile],
        writable: false,
      })

      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(onFilesAdded).toHaveBeenCalledWith([validFile])
      })

      // Check Zustand store
      const { uploads } = useUploadStore.getState()
      expect(uploads).toHaveLength(1)
      expect(uploads[0]?.fileName).toBe('document.pdf')
      expect(uploads[0]?.projectId).toBe('test-project')
      expect(uploads[0]?.folderPath).toBe('/docs')
    })

    it('adds multiple valid files to queue', async () => {
      const onFilesAdded = vi.fn()
      render(
        <UploadZone
          projectId="test-project"
          onFilesAdded={onFilesAdded}
        />
      )

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file1 = createMockFile('doc1.pdf', 1024, 'application/pdf')
      const file2 = createMockFile('doc2.xlsx', 2048, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

      Object.defineProperty(fileInput, 'files', {
        value: [file1, file2],
        writable: false,
      })

      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(onFilesAdded).toHaveBeenCalledWith([file1, file2])
      })

      const { uploads } = useUploadStore.getState()
      expect(uploads).toHaveLength(2)
    })
  })

  describe('Keyboard Accessibility', () => {
    it('opens file picker on Enter key', async () => {
      const user = userEvent.setup()
      render(<UploadZone projectId="test-project" />)

      const dropZone = screen.getByRole('button', { name: /drop files here/i })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const clickSpy = vi.spyOn(fileInput, 'click')

      dropZone.focus()
      await user.keyboard('{Enter}')

      expect(clickSpy).toHaveBeenCalled()
    })

    it('opens file picker on Space key', async () => {
      const user = userEvent.setup()
      render(<UploadZone projectId="test-project" />)

      const dropZone = screen.getByRole('button', { name: /drop files here/i })
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const clickSpy = vi.spyOn(fileInput, 'click')

      dropZone.focus()
      await user.keyboard(' ')

      expect(clickSpy).toHaveBeenCalled()
    })
  })
})
