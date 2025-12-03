/**
 * Unit tests for IRL Checklist Panel component
 * Story: E6.5 - Implement IRL-Document Linking and Progress Tracking
 * Tests: AC1 (Panel Display), AC2 (Hierarchical), AC3 (Checkbox), AC4 (Progress), AC6 (Collapsible), AC7 (Filter)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IRLChecklistPanel } from '@/components/data-room/irl-checklist-panel'
import * as irlApi from '@/lib/api/irl'

// Mock the IRL API
vi.mock('@/lib/api/irl', () => ({
  getProjectIRL: vi.fn(),
  toggleIRLItemFulfilled: vi.fn(),
  groupItemsByCategory: vi.fn((items) => {
    const categoryMap = new Map<string, typeof items>()
    for (const item of items) {
      const existing = categoryMap.get(item.category) || []
      existing.push(item)
      categoryMap.set(item.category, existing)
    }
    return Array.from(categoryMap.entries()).map(([name, categoryItems]) => ({
      name,
      items: categoryItems,
      completedCount: categoryItems.filter((item: { fulfilled: boolean }) => item.fulfilled).length,
      totalCount: categoryItems.length,
    }))
  }),
}))

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver

// Sample IRL data with fulfilled field
const mockIRLWithItems = {
  irl: {
    id: 'irl-1',
    dealId: 'project-1',
    name: 'Standard IRL',
    templateType: 'standard',
    progressPercent: 33,
    items: [
      {
        id: 'item-1',
        irlId: 'irl-1',
        category: 'Financial',
        name: 'Annual Report 2023',
        description: 'Latest annual report',
        required: true,
        fulfilled: true,
        sortOrder: 1,
        documentId: null,
        documentName: null,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
      {
        id: 'item-2',
        irlId: 'irl-1',
        category: 'Financial',
        name: 'Q1 Financials',
        description: 'Q1 2024 financials',
        required: true,
        fulfilled: false,
        sortOrder: 2,
        documentId: null,
        documentName: null,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
      {
        id: 'item-3',
        irlId: 'irl-1',
        category: 'Legal',
        name: 'Corporate Documents',
        description: 'Incorporation docs',
        required: false,
        fulfilled: false,
        sortOrder: 1,
        documentId: null,
        documentName: null,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
    ],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
}

describe('IRLChecklistPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('Panel Display (AC1)', () => {
    it('renders panel with IRL checklist header', async () => {
      vi.mocked(irlApi.getProjectIRL).mockResolvedValue(mockIRLWithItems)

      render(<IRLChecklistPanel projectId="project-1" />)

      await waitFor(() => {
        expect(screen.getByText('IRL Checklist')).toBeInTheDocument()
      })
    })

    it('shows loading state while fetching IRL', () => {
      vi.mocked(irlApi.getProjectIRL).mockImplementation(
        () => new Promise(() => {})
      )

      render(<IRLChecklistPanel projectId="project-1" />)

      // Should show loading spinner (identified by animate-spin class)
      expect(document.querySelector('.animate-spin')).toBeTruthy()
    })

    it('shows error state when IRL fetch fails', async () => {
      vi.mocked(irlApi.getProjectIRL).mockResolvedValue({
        irl: null,
        error: 'Failed to fetch IRL',
      })

      render(<IRLChecklistPanel projectId="project-1" />)

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch IRL')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      })
    })
  })

  describe('Hierarchical Checklist (AC2)', () => {
    it('groups items by category', async () => {
      vi.mocked(irlApi.getProjectIRL).mockResolvedValue(mockIRLWithItems)

      render(<IRLChecklistPanel projectId="project-1" />)

      await waitFor(() => {
        expect(screen.getByText('Financial')).toBeInTheDocument()
        expect(screen.getByText('Legal')).toBeInTheDocument()
      })
    })

    it('shows items under their category', async () => {
      vi.mocked(irlApi.getProjectIRL).mockResolvedValue(mockIRLWithItems)

      render(<IRLChecklistPanel projectId="project-1" />)

      await waitFor(() => {
        expect(screen.getByText('Annual Report 2023')).toBeInTheDocument()
        expect(screen.getByText('Q1 Financials')).toBeInTheDocument()
        expect(screen.getByText('Corporate Documents')).toBeInTheDocument()
      })
    })

    it('allows collapsing categories', async () => {
      vi.mocked(irlApi.getProjectIRL).mockResolvedValue(mockIRLWithItems)
      const user = userEvent.setup()

      render(<IRLChecklistPanel projectId="project-1" />)

      await waitFor(() => {
        expect(screen.getByText('Annual Report 2023')).toBeInTheDocument()
      })

      // Click to collapse Financial category
      const financialHeader = screen.getByText('Financial')
      await user.click(financialHeader)

      // Items should be hidden (but category still visible)
      expect(screen.queryByText('Annual Report 2023')).not.toBeInTheDocument()
    })
  })

  describe('Checkbox Toggle (AC3)', () => {
    it('shows checkbox for each item', async () => {
      vi.mocked(irlApi.getProjectIRL).mockResolvedValue(mockIRLWithItems)

      render(<IRLChecklistPanel projectId="project-1" />)

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox')
        expect(checkboxes.length).toBe(3) // 3 items
      })
    })

    it('shows fulfilled items as checked', async () => {
      vi.mocked(irlApi.getProjectIRL).mockResolvedValue(mockIRLWithItems)

      render(<IRLChecklistPanel projectId="project-1" />)

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox')
        // First item is fulfilled
        expect(checkboxes[0]).toBeChecked()
        // Second and third are not
        expect(checkboxes[1]).not.toBeChecked()
        expect(checkboxes[2]).not.toBeChecked()
      })
    })

    it('toggles item fulfilled status on click', async () => {
      vi.mocked(irlApi.getProjectIRL).mockResolvedValue(mockIRLWithItems)
      vi.mocked(irlApi.toggleIRLItemFulfilled).mockResolvedValue({ success: true })
      const user = userEvent.setup()

      render(<IRLChecklistPanel projectId="project-1" />)

      await waitFor(() => {
        expect(screen.getByText('Q1 Financials')).toBeInTheDocument()
      })

      // Click on unfulfilled item's checkbox
      const checkboxes = screen.getAllByRole('checkbox')
      const targetCheckbox = checkboxes[1]
      if (targetCheckbox) {
        await user.click(targetCheckbox) // Q1 Financials
      }

      expect(irlApi.toggleIRLItemFulfilled).toHaveBeenCalledWith('item-2', true)
    })
  })

  describe('Progress Bar (AC4)', () => {
    it('shows progress text', async () => {
      vi.mocked(irlApi.getProjectIRL).mockResolvedValue(mockIRLWithItems)

      render(<IRLChecklistPanel projectId="project-1" />)

      await waitFor(() => {
        expect(screen.getByText('Progress')).toBeInTheDocument()
        // 1 of 3 items fulfilled = 33%
        expect(screen.getByText(/1\/3/)).toBeInTheDocument()
      })
    })

    it('shows category progress counts', async () => {
      vi.mocked(irlApi.getProjectIRL).mockResolvedValue(mockIRLWithItems)

      render(<IRLChecklistPanel projectId="project-1" />)

      await waitFor(() => {
        // Financial: 1/2 fulfilled
        expect(screen.getByText('1/2')).toBeInTheDocument()
        // Legal: 0/1 fulfilled
        expect(screen.getByText('0/1')).toBeInTheDocument()
      })
    })
  })

  describe('Collapsible Panel (AC6)', () => {
    it('collapses panel when collapse button is clicked', async () => {
      vi.mocked(irlApi.getProjectIRL).mockResolvedValue(mockIRLWithItems)
      const user = userEvent.setup()

      render(<IRLChecklistPanel projectId="project-1" />)

      await waitFor(() => {
        expect(screen.getByText('IRL Checklist')).toBeInTheDocument()
      })

      // Click collapse button
      const collapseButton = screen.getByRole('button', { name: /collapse/i })
      await user.click(collapseButton)

      // Header should be hidden in collapsed state
      expect(screen.queryByText('IRL Checklist')).not.toBeInTheDocument()
    })

    it('persists collapse state to localStorage', async () => {
      vi.mocked(irlApi.getProjectIRL).mockResolvedValue(mockIRLWithItems)
      const user = userEvent.setup()

      render(<IRLChecklistPanel projectId="project-1" />)

      await waitFor(() => {
        expect(screen.getByText('IRL Checklist')).toBeInTheDocument()
      })

      const collapseButton = screen.getByRole('button', { name: /collapse/i })
      await user.click(collapseButton)

      expect(localStorage.getItem('manda-irl-panel-collapsed')).toBe('true')
    })

    it('restores collapsed state from localStorage', async () => {
      localStorage.setItem('manda-irl-panel-collapsed', 'true')
      vi.mocked(irlApi.getProjectIRL).mockResolvedValue(mockIRLWithItems)

      render(<IRLChecklistPanel projectId="project-1" />)

      // Should not see full header in collapsed mode
      await waitFor(() => {
        expect(screen.queryByText('IRL Checklist')).not.toBeInTheDocument()
      })
    })
  })

  describe('Filter Toggle (AC7)', () => {
    it('shows filter button', async () => {
      vi.mocked(irlApi.getProjectIRL).mockResolvedValue(mockIRLWithItems)

      render(<IRLChecklistPanel projectId="project-1" />)

      await waitFor(() => {
        expect(screen.getByLabelText(/unfulfilled/i)).toBeInTheDocument()
      })
    })

    it('filters to show only unfulfilled items when toggled', async () => {
      vi.mocked(irlApi.getProjectIRL).mockResolvedValue(mockIRLWithItems)
      const user = userEvent.setup()

      render(<IRLChecklistPanel projectId="project-1" />)

      await waitFor(() => {
        expect(screen.getByText('Annual Report 2023')).toBeInTheDocument() // fulfilled
      })

      // Click filter button (find by aria-label, take first match)
      const filterButtons = screen.getAllByLabelText(/unfulfilled/i)
      const filterButton = filterButtons[0]
      if (filterButton) {
        await user.click(filterButton)
      }

      // Fulfilled item should be hidden
      await waitFor(() => {
        expect(screen.queryByText('Annual Report 2023')).not.toBeInTheDocument()
        // Unfulfilled items should still be visible
        expect(screen.getByText('Q1 Financials')).toBeInTheDocument()
      })
    })

    it('shows all items message when filter is on and all fulfilled', async () => {
      const allFulfilledData = {
        irl: {
          ...mockIRLWithItems.irl,
          items: mockIRLWithItems.irl.items.map(item => ({
            ...item,
            fulfilled: true,
          })),
        },
      }
      vi.mocked(irlApi.getProjectIRL).mockResolvedValue(allFulfilledData)
      const user = userEvent.setup()

      render(<IRLChecklistPanel projectId="project-1" />)

      await waitFor(() => {
        expect(screen.getByText('Annual Report 2023')).toBeInTheDocument()
      })

      // Click filter button (find by aria-label)
      const filterButtons = screen.getAllByLabelText(/unfulfilled/i)
      const filterButton = filterButtons[0]
      if (filterButton) {
        await user.click(filterButton)
      }

      await waitFor(() => {
        expect(screen.getByText('All items are fulfilled!')).toBeInTheDocument()
      })
    })
  })

  describe('Empty State (AC7)', () => {
    it('shows empty state when no IRL exists', async () => {
      vi.mocked(irlApi.getProjectIRL).mockResolvedValue({ irl: null })

      render(<IRLChecklistPanel projectId="project-1" />)

      await waitFor(() => {
        // Should show empty state component
        expect(screen.getByText(/no irl/i) || screen.getByText(/create/i)).toBeTruthy()
      })
    })
  })
})
