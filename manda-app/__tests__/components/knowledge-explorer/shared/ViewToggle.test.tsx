/**
 * ViewToggle Component Tests
 * Story: E4.4 - Build Card View Alternative for Findings (AC: 2)
 *
 * Tests:
 * - Toggle switches between table and card views
 * - Persists preference to localStorage
 * - Keyboard shortcut (Ctrl/Cmd+Shift+V) toggles view
 * - Accessible toggle with ARIA labels
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ViewToggle, useViewPreference, type ViewMode } from '@/components/knowledge-explorer/shared/ViewToggle'
import { renderHook, act } from '@testing-library/react'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('ViewToggle', () => {
  const mockOnChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  describe('Rendering', () => {
    it('renders table and card toggle buttons', () => {
      render(<ViewToggle value="table" onChange={mockOnChange} />)

      expect(screen.getByRole('button', { name: /table view/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /card view/i })).toBeInTheDocument()
    })

    it('renders within a group role', () => {
      render(<ViewToggle value="table" onChange={mockOnChange} />)

      expect(screen.getByRole('group', { name: /view mode toggle/i })).toBeInTheDocument()
    })

    it('highlights table button when value is table', () => {
      render(<ViewToggle value="table" onChange={mockOnChange} />)

      const tableButton = screen.getByRole('button', { name: /table view/i })
      expect(tableButton).toHaveClass('bg-background')
    })

    it('highlights card button when value is card', () => {
      render(<ViewToggle value="card" onChange={mockOnChange} />)

      const cardButton = screen.getByRole('button', { name: /card view/i })
      expect(cardButton).toHaveClass('bg-background')
    })
  })

  describe('Toggle Behavior', () => {
    it('calls onChange with card when card button is clicked', async () => {
      const user = userEvent.setup()
      render(<ViewToggle value="table" onChange={mockOnChange} />)

      await user.click(screen.getByRole('button', { name: /card view/i }))

      expect(mockOnChange).toHaveBeenCalledWith('card')
    })

    it('calls onChange with table when table button is clicked', async () => {
      const user = userEvent.setup()
      render(<ViewToggle value="card" onChange={mockOnChange} />)

      await user.click(screen.getByRole('button', { name: /table view/i }))

      expect(mockOnChange).toHaveBeenCalledWith('table')
    })
  })

  describe('Keyboard Shortcut', () => {
    it('toggles view on Ctrl+Shift+V (Windows/Linux)', async () => {
      render(<ViewToggle value="table" onChange={mockOnChange} />)

      // Simulate Ctrl+Shift+V
      fireEvent.keyDown(window, {
        key: 'v',
        ctrlKey: true,
        shiftKey: true,
      })

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('card')
      })
    })

    it('toggles from card to table on shortcut', async () => {
      render(<ViewToggle value="card" onChange={mockOnChange} />)

      fireEvent.keyDown(window, {
        key: 'v',
        ctrlKey: true,
        shiftKey: true,
      })

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('table')
      })
    })

    it('prevents default on shortcut', async () => {
      render(<ViewToggle value="table" onChange={mockOnChange} />)

      const event = new KeyboardEvent('keydown', {
        key: 'v',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

      window.dispatchEvent(event)

      expect(preventDefaultSpy).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('table button has correct aria-pressed when selected', () => {
      render(<ViewToggle value="table" onChange={mockOnChange} />)

      expect(screen.getByRole('button', { name: /table view/i })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      expect(screen.getByRole('button', { name: /card view/i })).toHaveAttribute(
        'aria-pressed',
        'false'
      )
    })

    it('card button has correct aria-pressed when selected', () => {
      render(<ViewToggle value="card" onChange={mockOnChange} />)

      expect(screen.getByRole('button', { name: /card view/i })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      expect(screen.getByRole('button', { name: /table view/i })).toHaveAttribute(
        'aria-pressed',
        'false'
      )
    })

    it('has screen reader text for buttons', () => {
      render(<ViewToggle value="table" onChange={mockOnChange} />)

      // Check for sr-only text (one for each button)
      const tableViewText = screen.getAllByText('Table view')
      const cardViewText = screen.getAllByText('Card view')
      expect(tableViewText.length).toBeGreaterThanOrEqual(1)
      expect(cardViewText.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Custom className', () => {
    it('applies custom className to container', () => {
      render(<ViewToggle value="table" onChange={mockOnChange} className="custom-class" />)

      const group = screen.getByRole('group')
      expect(group).toHaveClass('custom-class')
    })
  })
})

describe('useViewPreference Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  it('returns default mode when localStorage is empty', () => {
    localStorageMock.getItem.mockReturnValue(null)

    const { result } = renderHook(() => useViewPreference('table'))

    expect(result.current[0]).toBe('table')
  })

  it('returns stored mode from localStorage', () => {
    localStorageMock.getItem.mockReturnValue('card')

    const { result } = renderHook(() => useViewPreference('table'))

    // After effect runs, should be card
    expect(result.current[0]).toBe('card')
  })

  it('saves mode to localStorage on change', () => {
    const { result } = renderHook(() => useViewPreference('table'))

    act(() => {
      result.current[1]('card')
    })

    expect(localStorageMock.setItem).toHaveBeenCalledWith('findings-view-preference', 'card')
  })

  it('updates state when setMode is called', () => {
    const { result } = renderHook(() => useViewPreference('table'))

    act(() => {
      result.current[1]('card')
    })

    expect(result.current[0]).toBe('card')
  })

  it('ignores invalid localStorage values', () => {
    localStorageMock.getItem.mockReturnValue('invalid')

    const { result } = renderHook(() => useViewPreference('table'))

    // Should use default since stored value is invalid
    expect(result.current[0]).toBe('table')
  })
})
