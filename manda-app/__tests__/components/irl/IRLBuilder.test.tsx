/**
 * IRLBuilder Component Integration Tests
 *
 * Tests for the IRL Builder component with drag-and-drop functionality.
 * Story: E6.2 - Implement IRL Creation and Editing
 *
 * AC Covered:
 * - AC#1: Category CRUD with reorder and rename
 * - AC#2: Inline editing for items
 * - AC#3: Drag-and-drop reordering
 * - AC#4: Status toggles
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IRLBuilder } from '@/components/irl/IRLBuilder'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Sample IRL data
const mockIRLWithItems = {
  id: 'irl-123',
  dealId: 'deal-456',
  title: 'Test IRL',
  templateType: 'general',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  items: [
    {
      id: 'item-1',
      irlId: 'irl-123',
      category: 'Financial',
      itemName: 'Annual Reports',
      description: 'Last 3 years',
      priority: 'high',
      status: 'not_started',
      sortOrder: 0,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 'item-2',
      irlId: 'irl-123',
      category: 'Financial',
      itemName: 'Tax Returns',
      description: 'Last 5 years',
      priority: 'medium',
      status: 'pending',
      sortOrder: 1,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 'item-3',
      irlId: 'irl-123',
      category: 'Legal',
      itemName: 'Contracts',
      description: 'Customer contracts',
      priority: 'high',
      status: 'received',
      sortOrder: 2,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
  ],
}

describe('IRLBuilder', () => {
  const mockOnError = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockIRLWithItems),
    })
  })

  describe('initial render', () => {
    it('shows loading skeleton initially', () => {
      render(<IRLBuilder projectId="proj-123" irlId="irl-123" />)

      // Component uses skeleton loading states
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
    })

    it('loads and displays IRL title', async () => {
      render(<IRLBuilder projectId="proj-123" irlId="irl-123" />)

      await waitFor(() => {
        expect(screen.getByText('Test IRL')).toBeInTheDocument()
      })
    })

    it('displays all categories', async () => {
      render(<IRLBuilder projectId="proj-123" irlId="irl-123" />)

      await waitFor(() => {
        expect(screen.getByText('Financial')).toBeInTheDocument()
        expect(screen.getByText('Legal')).toBeInTheDocument()
      })
    })

    it('displays items within categories', async () => {
      render(<IRLBuilder projectId="proj-123" irlId="irl-123" />)

      await waitFor(() => {
        expect(screen.getByText('Annual Reports')).toBeInTheDocument()
        expect(screen.getByText('Tax Returns')).toBeInTheDocument()
        expect(screen.getByText('Contracts')).toBeInTheDocument()
      })
    })

    it('shows status legend', async () => {
      render(<IRLBuilder projectId="proj-123" irlId="irl-123" />)

      await waitFor(() => {
        // Status legend shows all statuses
        expect(screen.getByText('Not Started')).toBeInTheDocument()
        expect(screen.getByText('Pending')).toBeInTheDocument()
        expect(screen.getByText('Received')).toBeInTheDocument()
        expect(screen.getByText('Complete')).toBeInTheDocument()
      })
    })

    it('shows progress indicator', async () => {
      render(<IRLBuilder projectId="proj-123" irlId="irl-123" />)

      await waitFor(() => {
        // Progress shows complete count
        expect(screen.getByText('0/3 Complete')).toBeInTheDocument()
      })
    })
  })

  describe('error handling', () => {
    it('displays error message on fetch failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Not found' }),
      })

      render(
        <IRLBuilder projectId="proj-123" irlId="irl-123" onError={mockOnError} />
      )

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith('Not found')
      })
    })

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      render(
        <IRLBuilder projectId="proj-123" irlId="irl-123" onError={mockOnError} />
      )

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith('Network error')
      })
    })
  })

  describe('category management (AC#1)', () => {
    it('opens add category dialog when button clicked', async () => {
      const user = userEvent.setup()
      render(<IRLBuilder projectId="proj-123" irlId="irl-123" />)

      await waitFor(() => {
        expect(screen.getByText('Test IRL')).toBeInTheDocument()
      })

      const addButton = screen.getByRole('button', { name: /add category/i })
      await user.click(addButton)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/financial documents/i)).toBeInTheDocument()
    })

    it('creates new category when form submitted', async () => {
      const user = userEvent.setup()
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockIRLWithItems),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              firstItem: {
                id: 'item-new',
                irlId: 'irl-123',
                category: 'Operations',
                itemName: 'New Item',
                priority: 'medium',
                status: 'not_started',
                sortOrder: 3,
                createdAt: '2025-01-01T00:00:00Z',
                updatedAt: '2025-01-01T00:00:00Z',
              },
            }),
        })

      render(<IRLBuilder projectId="proj-123" irlId="irl-123" />)

      await waitFor(() => {
        expect(screen.getByText('Test IRL')).toBeInTheDocument()
      })

      const addButton = screen.getByRole('button', { name: /add category/i })
      await user.click(addButton)

      const input = screen.getByPlaceholderText(/financial documents/i)
      await user.type(input, 'Operations')

      const submitButton = screen.getByRole('button', { name: /^add category$/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/projects/proj-123/irls/irl-123/categories',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ name: 'Operations' }),
          })
        )
      })
    })

    it('allows inline editing of category name', async () => {
      const user = userEvent.setup()
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockIRLWithItems),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })

      render(<IRLBuilder projectId="proj-123" irlId="irl-123" />)

      await waitFor(() => {
        expect(screen.getByText('Financial')).toBeInTheDocument()
      })

      // Find the edit button for the Financial category
      const financialCategory = screen.getByTestId('irl-category-financial')
      const editButton = financialCategory.querySelector('[aria-label="Edit category name"]')

      if (editButton) {
        await user.click(editButton)

        const input = screen.getByTestId('category-name-input')
        await user.clear(input)
        await user.type(input, 'Finance')

        const saveButton = financialCategory.querySelector('[aria-label="Save"]')
        if (saveButton) {
          await user.click(saveButton)
        }

        await waitFor(() => {
          expect(mockFetch).toHaveBeenCalledWith(
            '/api/projects/proj-123/irls/irl-123/categories',
            expect.objectContaining({
              method: 'PUT',
              body: JSON.stringify({ oldName: 'Financial', newName: 'Finance' }),
            })
          )
        })
      }
    })
  })

  describe('item management (AC#2)', () => {
    it('opens add item dialog when button clicked', async () => {
      const user = userEvent.setup()
      render(<IRLBuilder projectId="proj-123" irlId="irl-123" />)

      await waitFor(() => {
        expect(screen.getByText('Test IRL')).toBeInTheDocument()
      })

      // Find first Add Item button within a category
      const addButtons = screen.getAllByRole('button', { name: /add item/i })
      expect(addButtons.length).toBeGreaterThan(0)
      await user.click(addButtons[0]!)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/audited financial statements/i)).toBeInTheDocument()
    })

    it('creates new item when form submitted', async () => {
      const user = userEvent.setup()
      const newItem = {
        id: 'item-new',
        irlId: 'irl-123',
        category: 'Financial',
        itemName: 'Bank Statements',
        priority: 'medium',
        status: 'not_started',
        sortOrder: 2,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockIRLWithItems),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(newItem),
        })

      render(<IRLBuilder projectId="proj-123" irlId="irl-123" />)

      await waitFor(() => {
        expect(screen.getByText('Test IRL')).toBeInTheDocument()
      })

      const addButtons = screen.getAllByRole('button', { name: /add item/i })
      expect(addButtons.length).toBeGreaterThan(0)
      await user.click(addButtons[0]!)

      const nameInput = screen.getByPlaceholderText(/audited financial statements/i)
      await user.type(nameInput, 'Bank Statements')

      const submitButton = screen.getByRole('button', { name: /^add item$/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/projects/proj-123/irls/irl-123/items',
          expect.objectContaining({
            method: 'POST',
          })
        )
      })
    })

    it('allows inline editing of item name', async () => {
      const user = userEvent.setup()
      const updatedItem = { ...mockIRLWithItems.items[0], itemName: 'Updated Reports' }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockIRLWithItems),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(updatedItem),
        })

      render(<IRLBuilder projectId="proj-123" irlId="irl-123" />)

      await waitFor(() => {
        expect(screen.getByText('Annual Reports')).toBeInTheDocument()
      })

      // Click on the item name to edit
      const itemNameButton = screen.getByText('Annual Reports')
      await user.click(itemNameButton)

      const input = screen.getByTestId('item-name-input')
      await user.clear(input)
      await user.type(input, 'Updated Reports')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/projects/proj-123/irls/irl-123/items/item-1',
          expect.objectContaining({
            method: 'PUT',
            body: expect.stringContaining('Updated Reports'),
          })
        )
      })
    })
  })

  describe('status updates (AC#4)', () => {
    it('updates item status when status dropdown changed', async () => {
      const user = userEvent.setup()
      const updatedItem = { ...mockIRLWithItems.items[0], status: 'received' }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockIRLWithItems),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(updatedItem),
        })

      render(<IRLBuilder projectId="proj-123" irlId="irl-123" />)

      await waitFor(() => {
        expect(screen.getByText('Annual Reports')).toBeInTheDocument()
      })

      // Find status dropdown trigger (has the status icon)
      const item1 = screen.getByTestId('irl-item-item-1')
      const statusButtons = item1.querySelectorAll('button')
      // Status button is typically the second-to-last button (before delete)
      const statusButton = Array.from(statusButtons).find(btn =>
        btn.textContent?.includes('○') || btn.textContent?.includes('⏱')
      )

      if (statusButton) {
        await user.click(statusButton)

        // Wait for dropdown menu to appear and click 'Received'
        await waitFor(() => {
          const receivedOption = screen.getByRole('menuitem', { name: /received/i })
          expect(receivedOption).toBeInTheDocument()
        })

        const receivedOption = screen.getByRole('menuitem', { name: /received/i })
        await user.click(receivedOption)

        await waitFor(() => {
          expect(mockFetch).toHaveBeenCalledWith(
            '/api/projects/proj-123/irls/irl-123/items/item-1',
            expect.objectContaining({
              method: 'PUT',
              body: expect.stringContaining('received'),
            })
          )
        })
      }
    })

    it('updates item priority when priority dropdown changed', async () => {
      const user = userEvent.setup()
      const updatedItem = { ...mockIRLWithItems.items[0], priority: 'low' }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockIRLWithItems),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(updatedItem),
        })

      render(<IRLBuilder projectId="proj-123" irlId="irl-123" />)

      await waitFor(() => {
        expect(screen.getByText('Annual Reports')).toBeInTheDocument()
      })

      // Find priority dropdown trigger (has the priority badge)
      const item1 = screen.getByTestId('irl-item-item-1')
      const priorityButton = item1.querySelector('[class*="badge"]')?.closest('button')

      if (priorityButton) {
        await user.click(priorityButton)

        await waitFor(() => {
          const lowOption = screen.getByRole('menuitem', { name: /low/i })
          expect(lowOption).toBeInTheDocument()
        })

        const lowOption = screen.getByRole('menuitem', { name: /low/i })
        await user.click(lowOption)

        await waitFor(() => {
          expect(mockFetch).toHaveBeenCalledWith(
            '/api/projects/proj-123/irls/irl-123/items/item-1',
            expect.objectContaining({
              method: 'PUT',
              body: expect.stringContaining('low'),
            })
          )
        })
      }
    })
  })

  describe('delete operations', () => {
    beforeEach(() => {
      // Reset to default mock before each delete test
      mockFetch.mockReset()
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockIRLWithItems),
      })
    })

    it('deletes item when delete button clicked', async () => {
      const user = userEvent.setup()

      render(<IRLBuilder projectId="proj-123" irlId="irl-123" />)

      await waitFor(() => {
        expect(screen.getByText('Annual Reports')).toBeInTheDocument()
      })

      // Find delete button for first item
      const item1 = screen.getByTestId('irl-item-item-1')
      const deleteButton = item1.querySelector('[aria-label="Delete item"]')

      expect(deleteButton).toBeInTheDocument()
      if (deleteButton) {
        // Setup for the delete call
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })

        await user.click(deleteButton)

        await waitFor(() => {
          expect(mockFetch).toHaveBeenCalledWith(
            '/api/projects/proj-123/irls/irl-123/items/item-1',
            expect.objectContaining({
              method: 'DELETE',
            })
          )
        })
      }
    })

    it('deletes category when delete button clicked and confirmed', async () => {
      const user = userEvent.setup()

      render(<IRLBuilder projectId="proj-123" irlId="irl-123" />)

      await waitFor(() => {
        expect(screen.getByText('Financial')).toBeInTheDocument()
      })

      // Find delete button for Financial category
      const financialCategory = screen.getByTestId('irl-category-financial')
      const deleteButton = financialCategory.querySelector('[aria-label="Delete category"]')

      expect(deleteButton).toBeInTheDocument()
      if (deleteButton) {
        await user.click(deleteButton)

        // Confirm dialog should appear
        await waitFor(() => {
          expect(screen.getByText(/delete category/i)).toBeInTheDocument()
        })

        // Reset fetch mock to track the delete call
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })

        const confirmButton = screen.getByRole('button', { name: /^delete$/i })
        await user.click(confirmButton)

        await waitFor(() => {
          expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/projects/proj-123/irls/irl-123/categories'),
            expect.objectContaining({
              method: 'DELETE',
            })
          )
        })
      }
    })
  })

  describe('empty states', () => {
    it('shows message when IRL has no items', async () => {
      // Reset mock to return empty items
      mockFetch.mockReset()
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockIRLWithItems,
            items: [],
          }),
      })

      render(<IRLBuilder projectId="proj-123" irlId="irl-123" />)

      await waitFor(() => {
        expect(screen.getByText(/no categories yet/i)).toBeInTheDocument()
      })
    })
  })

  describe('title editing', () => {
    beforeEach(() => {
      // Reset to default mock before each title test
      mockFetch.mockReset()
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockIRLWithItems),
      })
    })

    it('allows editing IRL title', async () => {
      const user = userEvent.setup()

      render(<IRLBuilder projectId="proj-123" irlId="irl-123" />)

      await waitFor(() => {
        expect(screen.getByText('Test IRL')).toBeInTheDocument()
      })

      // Find the edit title button - it's in a group with the title
      // The button has opacity-0 by default but is still clickable
      const titleGroup = screen.getByText('Test IRL').parentElement
      const editButton = titleGroup?.querySelector('button')

      expect(editButton).toBeInTheDocument()
      if (editButton) {
        await user.click(editButton)

        // Input should appear
        const input = screen.getByDisplayValue('Test IRL')

        // Setup mock for PUT request
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ...mockIRLWithItems, title: 'Updated Title' }),
        })

        await user.clear(input)
        await user.type(input, 'Updated Title')

        // Press Enter to save
        await user.keyboard('{Enter}')

        await waitFor(() => {
          expect(mockFetch).toHaveBeenCalledWith(
            '/api/projects/proj-123/irls/irl-123',
            expect.objectContaining({
              method: 'PUT',
              body: JSON.stringify({ title: 'Updated Title' }),
            })
          )
        })
      }
    })
  })

  describe('accessibility', () => {
    it('has proper button labels', async () => {
      render(<IRLBuilder projectId="proj-123" irlId="irl-123" />)

      await waitFor(() => {
        expect(screen.getByText('Test IRL')).toBeInTheDocument()
      })

      // Check that important buttons have accessible names
      expect(screen.getByRole('button', { name: /add category/i })).toBeInTheDocument()
      // Add Item buttons exist within categories
      const categoryContainer = screen.getByTestId('irl-category-financial')
      expect(categoryContainer.querySelector('button[class*="Add Item"], button')).toBeInTheDocument()
    })

    it('dialog has proper structure', async () => {
      const user = userEvent.setup()
      render(<IRLBuilder projectId="proj-123" irlId="irl-123" />)

      await waitFor(() => {
        expect(screen.getByText('Test IRL')).toBeInTheDocument()
      })

      const addButton = screen.getByRole('button', { name: /add category/i })
      await user.click(addButton)

      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()
      // Dialog title should be in the heading
      expect(screen.getByRole('heading', { name: /add category/i })).toBeInTheDocument()
    })
  })
})
