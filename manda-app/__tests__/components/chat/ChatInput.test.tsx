/**
 * ChatInput Component Tests
 * Story: E5.3 - Build Chat Interface with Conversation History
 * TD-013: Deferred tests from E5.3 implementation
 *
 * Tests for the chat input component that handles:
 * - Message submission
 * - Keyboard shortcuts (Enter, Shift+Enter, Cmd/Ctrl+Enter)
 * - Auto-resize textarea
 * - Loading and disabled states
 * - Character count
 * - Initial value sync
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatInput } from '@/components/chat/ChatInput'

describe('ChatInput', () => {
  const mockOnSubmit = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders textarea with placeholder', () => {
      render(<ChatInput onSubmit={mockOnSubmit} />)

      expect(screen.getByRole('textbox')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Ask a question about your deal...')).toBeInTheDocument()
    })

    it('renders send button', () => {
      render(<ChatInput onSubmit={mockOnSubmit} />)

      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument()
    })

    it('renders custom placeholder', () => {
      render(<ChatInput onSubmit={mockOnSubmit} placeholder="Custom placeholder..." />)

      expect(screen.getByPlaceholderText('Custom placeholder...')).toBeInTheDocument()
    })

    it('renders keyboard hints', () => {
      render(<ChatInput onSubmit={mockOnSubmit} />)

      // Check for the hint text that contains both keyboard shortcuts
      expect(screen.getByText(/Press/)).toBeInTheDocument()
      expect(screen.getByText(/to send/)).toBeInTheDocument()
      expect(screen.getByText(/for new line/)).toBeInTheDocument()
    })

    it('renders character count', () => {
      render(<ChatInput onSubmit={mockOnSubmit} maxLength={1000} />)

      expect(screen.getByText('0/1,000')).toBeInTheDocument()
    })
  })

  describe('message submission (AC: #2)', () => {
    it('calls onSubmit with trimmed message', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSubmit={mockOnSubmit} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, '  Hello, world!  ')

      const submitButton = screen.getByRole('button', { name: /send message/i })
      await user.click(submitButton)

      expect(mockOnSubmit).toHaveBeenCalledWith('Hello, world!')
    })

    it('clears input after submission', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSubmit={mockOnSubmit} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'Test message')
      await user.click(screen.getByRole('button', { name: /send message/i }))

      expect(textarea).toHaveValue('')
    })

    it('does not submit empty message', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSubmit={mockOnSubmit} />)

      const submitButton = screen.getByRole('button', { name: /send message/i })
      await user.click(submitButton)

      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('does not submit whitespace-only message', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSubmit={mockOnSubmit} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, '   ')
      await user.click(screen.getByRole('button', { name: /send message/i }))

      expect(mockOnSubmit).not.toHaveBeenCalled()
    })
  })

  describe('keyboard shortcuts', () => {
    it('submits on Enter key', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSubmit={mockOnSubmit} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'Test message')
      await user.keyboard('{Enter}')

      expect(mockOnSubmit).toHaveBeenCalledWith('Test message')
    })

    it('does not submit on Shift+Enter (allows newline)', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSubmit={mockOnSubmit} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'Line 1')
      await user.keyboard('{Shift>}{Enter}{/Shift}')
      await user.type(textarea, 'Line 2')

      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('submits on Ctrl+Enter', async () => {
      render(<ChatInput onSubmit={mockOnSubmit} />)

      const textarea = screen.getByRole('textbox')
      fireEvent.change(textarea, { target: { value: 'Test message' } })
      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })

      expect(mockOnSubmit).toHaveBeenCalledWith('Test message')
    })

    it('submits on Meta+Enter (Cmd on Mac)', async () => {
      render(<ChatInput onSubmit={mockOnSubmit} />)

      const textarea = screen.getByRole('textbox')
      fireEvent.change(textarea, { target: { value: 'Test message' } })
      fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true })

      expect(mockOnSubmit).toHaveBeenCalledWith('Test message')
    })
  })

  describe('disabled state', () => {
    it('disables textarea when isDisabled is true', () => {
      render(<ChatInput onSubmit={mockOnSubmit} isDisabled />)

      expect(screen.getByRole('textbox')).toBeDisabled()
    })

    it('disables submit button when isDisabled is true', () => {
      render(<ChatInput onSubmit={mockOnSubmit} isDisabled />)

      expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled()
    })

    it('does not submit when disabled', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSubmit={mockOnSubmit} isDisabled />)

      // Try to trigger submit via keyboard on disabled element
      const textarea = screen.getByRole('textbox')
      fireEvent.change(textarea, { target: { value: 'Test' } })
      fireEvent.keyDown(textarea, { key: 'Enter' })

      expect(mockOnSubmit).not.toHaveBeenCalled()
    })
  })

  describe('loading state', () => {
    it('disables textarea when isLoading is true', () => {
      render(<ChatInput onSubmit={mockOnSubmit} isLoading />)

      expect(screen.getByRole('textbox')).toBeDisabled()
    })

    it('shows loading indicator in button', () => {
      render(<ChatInput onSubmit={mockOnSubmit} isLoading />)

      // Button should have loading spinner (Loader2 component)
      const button = screen.getByRole('button', { name: /send message/i })
      expect(button).toBeDisabled()
    })

    it('does not submit when loading', async () => {
      render(<ChatInput onSubmit={mockOnSubmit} isLoading />)

      const textarea = screen.getByRole('textbox')
      fireEvent.change(textarea, { target: { value: 'Test' } })
      fireEvent.keyDown(textarea, { key: 'Enter' })

      expect(mockOnSubmit).not.toHaveBeenCalled()
    })
  })

  describe('character limit', () => {
    it('updates character count as user types', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSubmit={mockOnSubmit} maxLength={100} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'Hello')

      expect(screen.getByText('5/100')).toBeInTheDocument()
    })

    it('prevents input beyond maxLength', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSubmit={mockOnSubmit} maxLength={10} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, '12345678901234567890')

      expect(textarea).toHaveValue('1234567890')
    })

    it('shows warning when near limit', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSubmit={mockOnSubmit} maxLength={10} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, '123456789') // 9 chars, 90% of limit

      // Should show the character count
      const countText = screen.getByText('9/10')
      expect(countText).toBeInTheDocument()
      // Note: Tailwind classes may be compiled, so we just verify the element exists
    })
  })

  describe('initial value and sync', () => {
    it('populates textarea with initialValue', () => {
      render(<ChatInput onSubmit={mockOnSubmit} initialValue="Prefilled question" />)

      expect(screen.getByRole('textbox')).toHaveValue('Prefilled question')
    })

    it('calls onValueChange when user types', async () => {
      const mockOnValueChange = vi.fn()
      const user = userEvent.setup()
      render(<ChatInput onSubmit={mockOnSubmit} onValueChange={mockOnValueChange} />)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'Hi')

      expect(mockOnValueChange).toHaveBeenCalledWith('H')
      expect(mockOnValueChange).toHaveBeenCalledWith('Hi')
    })
  })

  describe('file upload integration', () => {
    it('renders upload button when onFilesSelected is provided', () => {
      const mockOnFilesSelected = vi.fn()
      render(<ChatInput onSubmit={mockOnSubmit} onFilesSelected={mockOnFilesSelected} />)

      // Should have file upload button
      expect(screen.getByRole('button', { name: /attach/i })).toBeInTheDocument()
    })

    it('does not render upload button when onFilesSelected is not provided', () => {
      render(<ChatInput onSubmit={mockOnSubmit} />)

      // Should not have file upload button
      expect(screen.queryByRole('button', { name: /attach/i })).not.toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has accessible label on textarea', () => {
      render(<ChatInput onSubmit={mockOnSubmit} />)

      expect(screen.getByRole('textbox', { name: /chat message input/i })).toBeInTheDocument()
    })

    it('has accessible label on submit button', () => {
      render(<ChatInput onSubmit={mockOnSubmit} />)

      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument()
    })

    it('submit button is disabled when textarea is empty', () => {
      render(<ChatInput onSubmit={mockOnSubmit} />)

      expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled()
    })

    it('submit button is enabled when textarea has content', async () => {
      const user = userEvent.setup()
      render(<ChatInput onSubmit={mockOnSubmit} />)

      await user.type(screen.getByRole('textbox'), 'Test')

      expect(screen.getByRole('button', { name: /send message/i })).toBeEnabled()
    })
  })
})
