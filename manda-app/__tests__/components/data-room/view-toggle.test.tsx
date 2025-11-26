/**
 * Unit tests for ViewToggle component
 * Story: E2.4 - Implement View Toggle and User Preference
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock ResizeObserver for Radix UI components
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
import {
  ViewToggle,
  useViewPreference,
  loadViewPreference,
  saveViewPreference,
  type DataRoomView,
} from '@/components/data-room/view-toggle'
import { renderHook, act } from '@testing-library/react'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get store() {
      return store
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('ViewToggle Component', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Rendering', () => {
    it('renders toggle with folders and buckets options', () => {
      const onChange = vi.fn()
      render(
        <ViewToggle
          projectId="test-project"
          value="folders"
          onChange={onChange}
        />
      )

      // Check for toggle buttons (text hidden on mobile, but aria-label should work)
      expect(screen.getByRole('tab', { name: /switch to folder view/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /switch to buckets view/i })).toBeInTheDocument()
    })

    it('shows folders as selected when value is folders', () => {
      const onChange = vi.fn()
      render(
        <ViewToggle
          projectId="test-project"
          value="folders"
          onChange={onChange}
        />
      )

      const foldersTab = screen.getByRole('tab', { name: /switch to folder view/i })
      expect(foldersTab).toHaveAttribute('aria-selected', 'true')
    })

    it('shows buckets as selected when value is buckets', () => {
      const onChange = vi.fn()
      render(
        <ViewToggle
          projectId="test-project"
          value="buckets"
          onChange={onChange}
        />
      )

      const bucketsTab = screen.getByRole('tab', { name: /switch to buckets view/i })
      expect(bucketsTab).toHaveAttribute('aria-selected', 'true')
    })
  })

  describe('Interaction', () => {
    it('calls onChange when switching to buckets', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      render(
        <ViewToggle
          projectId="test-project"
          value="folders"
          onChange={onChange}
        />
      )

      const bucketsTab = screen.getByRole('tab', { name: /switch to buckets view/i })
      await user.click(bucketsTab)

      expect(onChange).toHaveBeenCalledWith('buckets')
    })

    it('calls onChange when switching to folders', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      render(
        <ViewToggle
          projectId="test-project"
          value="buckets"
          onChange={onChange}
        />
      )

      const foldersTab = screen.getByRole('tab', { name: /switch to folder view/i })
      await user.click(foldersTab)

      expect(onChange).toHaveBeenCalledWith('folders')
    })
  })
})

describe('localStorage Functions', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  describe('loadViewPreference', () => {
    it('returns folders as default when no preference saved', () => {
      const result = loadViewPreference('new-project')
      expect(result).toBe('folders')
    })

    it('returns saved preference when available', () => {
      localStorageMock.store['dataroom-view-project-123'] = 'buckets'
      const result = loadViewPreference('project-123')
      expect(result).toBe('buckets')
    })

    it('returns folders for invalid saved value', () => {
      localStorageMock.store['dataroom-view-project-123'] = 'invalid'
      const result = loadViewPreference('project-123')
      expect(result).toBe('folders')
    })
  })

  describe('saveViewPreference', () => {
    it('saves preference to localStorage', () => {
      saveViewPreference('project-456', 'buckets')
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'dataroom-view-project-456',
        'buckets'
      )
    })

    it('uses project-specific key', () => {
      saveViewPreference('project-a', 'folders')
      saveViewPreference('project-b', 'buckets')

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'dataroom-view-project-a',
        'folders'
      )
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'dataroom-view-project-b',
        'buckets'
      )
    })
  })
})

describe('useViewPreference Hook', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('loads initial value from localStorage', async () => {
    localStorageMock.store['dataroom-view-test-project'] = 'buckets'

    const { result } = renderHook(() => useViewPreference('test-project'))

    // Wait for effect to run
    await waitFor(() => {
      expect(result.current[0]).toBe('buckets')
    })
  })

  it('defaults to folders when no saved preference', async () => {
    const { result } = renderHook(() => useViewPreference('new-project'))

    await waitFor(() => {
      expect(result.current[0]).toBe('folders')
    })
  })

  it('saves preference to localStorage when changed', async () => {
    const { result } = renderHook(() => useViewPreference('test-project'))

    act(() => {
      result.current[1]('buckets')
    })

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'dataroom-view-test-project',
      'buckets'
    )
  })

  it('updates state when setView is called', async () => {
    const { result } = renderHook(() => useViewPreference('test-project'))

    act(() => {
      result.current[1]('buckets')
    })

    expect(result.current[0]).toBe('buckets')
  })
})
