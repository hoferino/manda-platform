/**
 * ChatUploadButton Component Tests
 *
 * Tests for the chat upload button component.
 * Story: E5.9 - Implement Document Upload via Chat Interface
 * AC: #1 (File Picker Button in Chat Input)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatUploadButton } from '@/components/chat/ChatUploadButton'

describe('ChatUploadButton', () => {
  const mockOnFilesSelected = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering (AC: #1)', () => {
    it('renders upload button with paperclip icon', () => {
      render(<ChatUploadButton onFilesSelected={mockOnFilesSelected} />)

      const button = screen.getByTestId('chat-upload-button')
      expect(button).toBeInTheDocument()

      // Check for paperclip icon (SVG)
      const icon = button.querySelector('svg')
      expect(icon).toBeInTheDocument()
    })

    it('renders hidden file input', () => {
      render(<ChatUploadButton onFilesSelected={mockOnFilesSelected} />)

      const input = screen.getByTestId('chat-upload-file-input')
      expect(input).toBeInTheDocument()
      expect(input).toHaveClass('hidden')
      expect(input).toHaveAttribute('type', 'file')
    })

    it('file input accepts multiple files', () => {
      render(<ChatUploadButton onFilesSelected={mockOnFilesSelected} />)

      const input = screen.getByTestId('chat-upload-file-input')
      expect(input).toHaveAttribute('multiple')
    })

    it('file input accepts correct file types', () => {
      render(<ChatUploadButton onFilesSelected={mockOnFilesSelected} />)

      const input = screen.getByTestId('chat-upload-file-input')
      const accept = input.getAttribute('accept')

      // Should accept PDF
      expect(accept).toContain('.pdf')
      // Should accept Excel
      expect(accept).toContain('.xlsx')
      expect(accept).toContain('.xls')
      // Should accept Word
      expect(accept).toContain('.docx')
      expect(accept).toContain('.doc')
      // Should accept images
      expect(accept).toContain('.jpg')
      expect(accept).toContain('.png')
    })

    it('has accessible aria-label', () => {
      render(<ChatUploadButton onFilesSelected={mockOnFilesSelected} />)

      const button = screen.getByTestId('chat-upload-button')
      expect(button).toHaveAttribute('aria-label', 'Attach files')
    })

    it('button is type button (not submit)', () => {
      render(<ChatUploadButton onFilesSelected={mockOnFilesSelected} />)

      const button = screen.getByTestId('chat-upload-button')
      expect(button).toHaveAttribute('type', 'button')
    })
  })

  describe('file selection', () => {
    it('opens file picker when button is clicked', async () => {
      const user = userEvent.setup()
      render(<ChatUploadButton onFilesSelected={mockOnFilesSelected} />)

      const input = screen.getByTestId('chat-upload-file-input')
      const clickSpy = vi.spyOn(input, 'click')

      const button = screen.getByTestId('chat-upload-button')
      await user.click(button)

      expect(clickSpy).toHaveBeenCalled()
    })

    it('calls onFilesSelected when files are selected', async () => {
      render(<ChatUploadButton onFilesSelected={mockOnFilesSelected} />)

      const input = screen.getByTestId('chat-upload-file-input') as HTMLInputElement

      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })

      // Simulate file selection
      await userEvent.upload(input, file)

      expect(mockOnFilesSelected).toHaveBeenCalledTimes(1)
      expect(mockOnFilesSelected).toHaveBeenCalledWith([file])
    })

    it('calls onFilesSelected with multiple files', async () => {
      render(<ChatUploadButton onFilesSelected={mockOnFilesSelected} />)

      const input = screen.getByTestId('chat-upload-file-input') as HTMLInputElement

      const file1 = new File(['test1'], 'test1.pdf', { type: 'application/pdf' })
      const file2 = new File(['test2'], 'test2.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      await userEvent.upload(input, [file1, file2])

      expect(mockOnFilesSelected).toHaveBeenCalledWith([file1, file2])
    })
  })

  describe('loading state', () => {
    it('shows loading spinner when isLoading is true', () => {
      render(<ChatUploadButton onFilesSelected={mockOnFilesSelected} isLoading />)

      const button = screen.getByTestId('chat-upload-button')
      const spinner = button.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('updates aria-label when loading', () => {
      render(<ChatUploadButton onFilesSelected={mockOnFilesSelected} isLoading />)

      const button = screen.getByTestId('chat-upload-button')
      expect(button).toHaveAttribute('aria-label', 'Uploading files...')
    })

    it('disables button when loading', () => {
      render(<ChatUploadButton onFilesSelected={mockOnFilesSelected} isLoading />)

      const button = screen.getByTestId('chat-upload-button')
      expect(button).toBeDisabled()
    })

    it('disables file input when loading', () => {
      render(<ChatUploadButton onFilesSelected={mockOnFilesSelected} isLoading />)

      const input = screen.getByTestId('chat-upload-file-input')
      expect(input).toBeDisabled()
    })
  })

  describe('disabled state', () => {
    it('disables button when disabled prop is true', () => {
      render(<ChatUploadButton onFilesSelected={mockOnFilesSelected} disabled />)

      const button = screen.getByTestId('chat-upload-button')
      expect(button).toBeDisabled()
    })

    it('disables file input when disabled prop is true', () => {
      render(<ChatUploadButton onFilesSelected={mockOnFilesSelected} disabled />)

      const input = screen.getByTestId('chat-upload-file-input')
      expect(input).toBeDisabled()
    })

    it('applies opacity class when disabled', () => {
      render(<ChatUploadButton onFilesSelected={mockOnFilesSelected} disabled />)

      const button = screen.getByTestId('chat-upload-button')
      expect(button).toHaveClass('opacity-50')
    })
  })
})
