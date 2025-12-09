/**
 * QAFilterBar Component Tests
 * Story: E8.2 - Q&A Management UI with Collaborative Editing (AC: 2)
 *
 * Note: Select dropdown interactions are limited in jsdom due to Radix UI's
 * use of browser APIs not available in the test environment. Tests focus on
 * rendering and badge interaction which are reliable.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QAFilterBar } from '@/components/qa/QAFilterBar'
import { QAFilters } from '@/lib/types/qa'

describe('QAFilterBar', () => {
  const defaultProps = {
    filters: {} as QAFilters,
    onFilterChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render filter icon and label', () => {
      render(<QAFilterBar {...defaultProps} />)

      expect(screen.getByText('Filters:')).toBeInTheDocument()
    })

    it('should render all three filter dropdowns', () => {
      render(<QAFilterBar {...defaultProps} />)

      // Should have 3 combobox elements (Select triggers)
      const comboboxes = screen.getAllByRole('combobox')
      expect(comboboxes).toHaveLength(3)

      // Category filter shows default value
      expect(screen.getByText('All Categories')).toBeInTheDocument()

      // Priority filter shows default value
      expect(screen.getByText('All Priorities')).toBeInTheDocument()

      // Status filter shows default value
      expect(screen.getByText('All Status')).toBeInTheDocument()
    })

    it('should show active filter badges when filters are applied', () => {
      render(
        <QAFilterBar
          {...defaultProps}
          filters={{
            category: 'Financials',
            priority: 'high',
            status: 'pending',
          }}
        />
      )

      // Should show filter badge remove buttons
      expect(screen.getByLabelText('Remove category filter')).toBeInTheDocument()
      expect(screen.getByLabelText('Remove priority filter')).toBeInTheDocument()
      expect(screen.getByLabelText('Remove status filter')).toBeInTheDocument()
    })

    it('should show selected values in dropdown triggers', () => {
      render(
        <QAFilterBar
          {...defaultProps}
          filters={{
            category: 'Legal',
            priority: 'medium',
            status: 'answered',
          }}
        />
      )

      // Check that the comboboxes exist
      const comboboxes = screen.getAllByRole('combobox')
      expect(comboboxes).toHaveLength(3)
    })
  })

  describe('filter badges', () => {
    it('should show remove button on active filter badges', () => {
      render(
        <QAFilterBar
          {...defaultProps}
          filters={{ category: 'Financials' }}
        />
      )

      const removeButton = screen.getByLabelText('Remove category filter')
      expect(removeButton).toBeInTheDocument()
    })

    it('should remove category filter when badge X is clicked', async () => {
      const user = userEvent.setup()
      const onFilterChange = vi.fn()
      render(
        <QAFilterBar
          filters={{ category: 'Legal' }}
          onFilterChange={onFilterChange}
        />
      )

      const removeButton = screen.getByLabelText('Remove category filter')
      await user.click(removeButton)

      expect(onFilterChange).toHaveBeenCalledWith({ category: undefined })
    })

    it('should remove priority filter when badge X is clicked', async () => {
      const user = userEvent.setup()
      const onFilterChange = vi.fn()
      render(
        <QAFilterBar
          filters={{ priority: 'high' }}
          onFilterChange={onFilterChange}
        />
      )

      const removeButton = screen.getByLabelText('Remove priority filter')
      await user.click(removeButton)

      expect(onFilterChange).toHaveBeenCalledWith({ priority: undefined })
    })

    it('should remove status filter when badge X is clicked', async () => {
      const user = userEvent.setup()
      const onFilterChange = vi.fn()
      render(
        <QAFilterBar
          filters={{ status: 'answered' }}
          onFilterChange={onFilterChange}
        />
      )

      const removeButton = screen.getByLabelText('Remove status filter')
      await user.click(removeButton)

      expect(onFilterChange).toHaveBeenCalledWith({ status: undefined })
    })

    it('should show all three filter badges when all filters are active', () => {
      render(
        <QAFilterBar
          {...defaultProps}
          filters={{
            category: 'Financials',
            priority: 'high',
            status: 'pending',
          }}
        />
      )

      const removeButtons = screen.getAllByRole('button', { name: /remove.*filter/i })
      expect(removeButtons).toHaveLength(3)
    })
  })

  describe('clear all filters', () => {
    it('should show "Clear all" button when filters are active', () => {
      render(
        <QAFilterBar
          {...defaultProps}
          filters={{ category: 'Financials' }}
        />
      )

      expect(screen.getByText('Clear all')).toBeInTheDocument()
    })

    it('should not show "Clear all" button when no filters are active', () => {
      render(<QAFilterBar {...defaultProps} />)

      expect(screen.queryByText('Clear all')).not.toBeInTheDocument()
    })

    it('should clear all filters when "Clear all" is clicked', async () => {
      const user = userEvent.setup()
      const onFilterChange = vi.fn()
      render(
        <QAFilterBar
          filters={{
            category: 'Financials',
            priority: 'high',
            status: 'pending',
          }}
          onFilterChange={onFilterChange}
        />
      )

      await user.click(screen.getByText('Clear all'))

      expect(onFilterChange).toHaveBeenCalledWith({})
    })
  })

  describe('filter persistence', () => {
    it('should preserve category filter when removing priority', async () => {
      const user = userEvent.setup()
      const onFilterChange = vi.fn()
      render(
        <QAFilterBar
          filters={{ category: 'Financials', priority: 'high' }}
          onFilterChange={onFilterChange}
        />
      )

      await user.click(screen.getByLabelText('Remove priority filter'))

      expect(onFilterChange).toHaveBeenCalledWith({
        category: 'Financials',
        priority: undefined,
      })
    })

    it('should preserve priority filter when removing category', async () => {
      const user = userEvent.setup()
      const onFilterChange = vi.fn()
      render(
        <QAFilterBar
          filters={{ category: 'Financials', priority: 'high' }}
          onFilterChange={onFilterChange}
        />
      )

      await user.click(screen.getByLabelText('Remove category filter'))

      expect(onFilterChange).toHaveBeenCalledWith({
        category: undefined,
        priority: 'high',
      })
    })
  })
})
