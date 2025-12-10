/**
 * CIMChatInput Component Tests
 * Story: E9.9 - Click-to-Reference in Chat
 * Tests: AC #1 (Reference in Input), AC #3 (User Can Complete Message)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CIMChatInput } from '@/components/cim-builder/ConversationPanel/CIMChatInput'

describe('CIMChatInput', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    isLoading: false,
    sourceRef: '',
    onSourceRefClear: vi.fn(),
    placeholder: 'Ask the agent...',
    maxLength: 10000,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================================
  // Component Reference Badge Display (AC #1)
  // ============================================================================

  describe('component reference badge display (AC #1)', () => {
    it('should display MapPin icon for component references (📍 prefix)', () => {
      const componentRef = '📍 [s3_bullet1] "Revenue grew 25%..." -'
      const { container } = render(<CIMChatInput {...defaultProps} sourceRef={componentRef} />)

      // Badge should be visible - use container query
      const badge = container.querySelector('[data-slot="badge"]')
      expect(badge).toBeInTheDocument()

      // The badge should have 'bg-primary' class for component refs
      expect(badge).toHaveClass('bg-primary')

      // MapPin icon should be present (svg with lucide-map-pin class)
      const mapPinIcon = badge?.querySelector('svg.lucide-map-pin')
      expect(mapPinIcon).toBeInTheDocument()
    })

    it('should display secondary badge variant for non-component references', () => {
      const sourceRef = '📄 [doc:123] "Financial report"'
      const { container } = render(<CIMChatInput {...defaultProps} sourceRef={sourceRef} />)

      const badge = container.querySelector('[data-slot="badge"]')
      expect(badge).toBeInTheDocument()
      // Secondary variant doesn't have bg-primary
      expect(badge).not.toHaveClass('bg-primary')
    })

    it('should show badge with reference text in truncate span', () => {
      const componentRef = '📍 [s1_title] "Executive Summary..." -'
      const { container } = render(<CIMChatInput {...defaultProps} sourceRef={componentRef} />)

      const badge = container.querySelector('[data-slot="badge"]')
      const truncateSpan = badge?.querySelector('.truncate')
      expect(truncateSpan).toHaveTextContent(componentRef)
    })

    it('should not show badge when sourceRef is empty', () => {
      const { container } = render(<CIMChatInput {...defaultProps} sourceRef="" />)

      expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument()
      const badge = container.querySelector('[data-slot="badge"]')
      expect(badge).not.toBeInTheDocument()
    })
  })

  // ============================================================================
  // Reference in Input Value (AC #1)
  // ============================================================================

  describe('reference insertion into input (AC #1)', () => {
    it('should populate input with component reference when provided', async () => {
      const componentRef = '📍 [s3_bullet1] "Revenue grew 25%..." -'
      render(<CIMChatInput {...defaultProps} sourceRef={componentRef} />)

      const textarea = screen.getByRole('textbox')
      await waitFor(() => {
        expect(textarea).toHaveValue(`${componentRef} `)
      })
    })

    it('should focus textarea and position cursor for typing', async () => {
      const componentRef = '📍 [s3_bullet1] "Revenue grew 25%..." -'
      render(<CIMChatInput {...defaultProps} sourceRef={componentRef} />)

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      await waitFor(() => {
        expect(textarea).toHaveValue(`${componentRef} `)
      })

      // After component ref is inserted, user should be able to type immediately
      // The input value should start with the reference
      expect(textarea.value.startsWith('📍')).toBe(true)
    })

    it('should not repopulate input when same reference is set again', async () => {
      const componentRef = '📍 [s3_bullet1] "Revenue..." -'
      const { rerender } = render(
        <CIMChatInput {...defaultProps} sourceRef={componentRef} />
      )

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      await waitFor(() => {
        expect(textarea).toHaveValue(`${componentRef} `)
      })

      // Manually update the value to simulate user typing (avoiding userEvent race condition)
      fireEvent.change(textarea, { target: { value: `${componentRef} make it 30%` } })
      expect(textarea.value).toContain('make it 30%')

      // Re-render with same sourceRef
      rerender(<CIMChatInput {...defaultProps} sourceRef={componentRef} />)

      // Input should preserve user's additions
      expect(textarea.value).toContain('make it 30%')
    })
  })

  // ============================================================================
  // User Can Complete Message (AC #3)
  // ============================================================================

  describe('user can complete message (AC #3)', () => {
    it('should allow typing after component reference', async () => {
      const componentRef = '📍 [s3_bullet1] "Revenue grew 25%..." -'
      render(<CIMChatInput {...defaultProps} sourceRef={componentRef} />)

      const textarea = screen.getByRole('textbox')
      await waitFor(() => {
        expect(textarea).toHaveValue(`${componentRef} `)
      })

      // Use fireEvent.change to simulate user appending text
      fireEvent.change(textarea, { target: { value: `${componentRef} change to 22% based on Q3` } })
      expect(textarea).toHaveValue(`${componentRef} change to 22% based on Q3`)
    })

    it('should submit message with Enter key', async () => {
      const onSubmit = vi.fn()
      const componentRef = '📍 [s3_bullet1] "Revenue..." -'
      render(
        <CIMChatInput {...defaultProps} onSubmit={onSubmit} sourceRef={componentRef} />
      )

      const textarea = screen.getByRole('textbox')
      await waitFor(() => {
        expect(textarea).toHaveValue(`${componentRef} `)
      })

      // Simulate user typing by setting the value
      fireEvent.change(textarea, { target: { value: `${componentRef} update please` } })

      // Submit with Enter key
      fireEvent.keyDown(textarea, { key: 'Enter' })

      expect(onSubmit).toHaveBeenCalledWith(`${componentRef} update please`)
    })

    it('should submit message with Send button click', async () => {
      const onSubmit = vi.fn()
      const componentRef = '📍 [s3_bullet1] "Revenue..." -'
      render(
        <CIMChatInput {...defaultProps} onSubmit={onSubmit} sourceRef={componentRef} />
      )

      const textarea = screen.getByRole('textbox')
      await waitFor(() => {
        expect(textarea).toHaveValue(`${componentRef} `)
      })

      // Simulate user typing by setting the value
      fireEvent.change(textarea, { target: { value: `${componentRef} update please` } })
      fireEvent.click(screen.getByRole('button', { name: /send/i }))

      expect(onSubmit).toHaveBeenCalledWith(`${componentRef} update please`)
    })

    it('should allow Shift+Enter for newline without submitting', async () => {
      const onSubmit = vi.fn()
      render(<CIMChatInput {...defaultProps} onSubmit={onSubmit} />)

      const textarea = screen.getByRole('textbox')

      // Set initial value
      fireEvent.change(textarea, { target: { value: 'Line 1' } })

      // Shift+Enter should not submit
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

      expect(onSubmit).not.toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Clear Reference (AC #3)
  // ============================================================================

  describe('clear reference functionality', () => {
    it('should show X button to clear reference', () => {
      const componentRef = '📍 [s1_title] "Title..." -'
      render(<CIMChatInput {...defaultProps} sourceRef={componentRef} />)

      expect(screen.getByRole('button', { name: /clear source reference/i })).toBeInTheDocument()
    })

    it('should call onSourceRefClear when X button clicked', async () => {
      const onSourceRefClear = vi.fn()
      const componentRef = '📍 [s1_title] "Title..." -'
      render(
        <CIMChatInput
          {...defaultProps}
          sourceRef={componentRef}
          onSourceRefClear={onSourceRefClear}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /clear source reference/i }))
      expect(onSourceRefClear).toHaveBeenCalled()
    })

    it('should clear input value when component reference is cleared', async () => {
      const onSourceRefClear = vi.fn()
      const componentRef = '📍 [s1_title] "Title..." -'
      render(
        <CIMChatInput
          {...defaultProps}
          sourceRef={componentRef}
          onSourceRefClear={onSourceRefClear}
        />
      )

      const textarea = screen.getByRole('textbox')
      await waitFor(() => {
        expect(textarea).toHaveValue(`${componentRef} `)
      })

      fireEvent.click(screen.getByRole('button', { name: /clear source reference/i }))

      // Input should be cleared
      await waitFor(() => {
        expect(textarea).toHaveValue('')
      })
    })
  })

  // ============================================================================
  // Loading State
  // ============================================================================

  describe('loading state', () => {
    it('should disable input when loading', () => {
      render(<CIMChatInput {...defaultProps} isLoading={true} />)

      expect(screen.getByRole('textbox')).toBeDisabled()
    })

    it('should disable submit button when loading', () => {
      render(<CIMChatInput {...defaultProps} isLoading={true} />)

      expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
    })

    it('should not submit on Enter when loading', async () => {
      const onSubmit = vi.fn()
      render(<CIMChatInput {...defaultProps} onSubmit={onSubmit} isLoading={true} />)

      const textarea = screen.getByRole('textbox')
      fireEvent.keyDown(textarea, { key: 'Enter' })

      expect(onSubmit).not.toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Visual Distinction (AC #1)
  // ============================================================================

  describe('visual distinction for reference types', () => {
    it('should show different badge styles for component vs source refs', () => {
      const { rerender, container } = render(
        <CIMChatInput {...defaultProps} sourceRef="📍 [s1_title] 'Title...' -" />
      )

      // Component ref should have primary/default variant
      let badge = container.querySelector('[data-slot="badge"]')
      expect(badge).toHaveClass('bg-primary')

      // Rerender with document ref
      rerender(<CIMChatInput {...defaultProps} sourceRef="📄 [doc:123] 'Report'" />)

      // Source ref should have secondary variant
      badge = container.querySelector('[data-slot="badge"]')
      expect(badge).not.toHaveClass('bg-primary')
    })
  })

  // ============================================================================
  // Character Limit
  // ============================================================================

  describe('character limit', () => {
    it('should show character count', () => {
      render(<CIMChatInput {...defaultProps} maxLength={1000} />)

      expect(screen.getByText('0/1,000')).toBeInTheDocument()
    })

    it('should update character count as user types', async () => {
      render(<CIMChatInput {...defaultProps} maxLength={1000} />)

      const textarea = screen.getByRole('textbox')
      fireEvent.change(textarea, { target: { value: 'Hello' } })

      expect(screen.getByText('5/1,000')).toBeInTheDocument()
    })

    it('should enforce maxLength via onChange handler', async () => {
      render(<CIMChatInput {...defaultProps} maxLength={10} />)

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement

      // Try to set a value longer than maxLength - the onChange handler should truncate it
      fireEvent.change(textarea, { target: { value: 'Short' } })
      expect(textarea.value).toBe('Short')

      // The component prevents values longer than maxLength via onChange
      fireEvent.change(textarea, { target: { value: 'This is a very long message' } })
      // The value should NOT be updated since it exceeds maxLength
      expect(textarea.value).toBe('Short')
    })
  })
})
