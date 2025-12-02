/**
 * IRL Template Modal Component Tests
 *
 * Story: E6.1 - Build IRL Builder UI with Template Selection (AC7)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { IRLTemplateModal } from '@/components/irl/IRLTemplateModal'
import type { IRLTemplate } from '@/lib/types/irl'

const mockTemplate: IRLTemplate = {
  id: 'tech-ma',
  name: 'Tech M&A',
  description: 'Comprehensive IRL template for technology company acquisitions',
  dealType: 'tech_ma',
  categories: [
    {
      name: 'Financial',
      items: [
        {
          name: 'Financial Statements',
          description: 'Annual audited financial statements',
          priority: 'high',
        },
        {
          name: 'Revenue Analysis',
          description: 'Revenue breakdown by segment',
          priority: 'medium',
        },
      ],
    },
    {
      name: 'Legal',
      items: [
        { name: 'Contracts', description: 'Material contracts', priority: 'high' },
        { name: 'Litigation', priority: 'low' },
      ],
    },
  ],
}

describe('IRLTemplateModal', () => {
  const defaultProps = {
    template: mockTemplate,
    isOpen: true,
    onClose: vi.fn(),
    onUseTemplate: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render when isOpen is true', () => {
      render(<IRLTemplateModal {...defaultProps} />)

      expect(screen.getByTestId('irl-template-modal')).toBeInTheDocument()
    })

    it('should not render when isOpen is false', () => {
      render(<IRLTemplateModal {...defaultProps} isOpen={false} />)

      expect(screen.queryByTestId('irl-template-modal')).not.toBeInTheDocument()
    })

    it('should not render when template is null', () => {
      render(<IRLTemplateModal {...defaultProps} template={null} />)

      expect(screen.queryByTestId('irl-template-modal')).not.toBeInTheDocument()
    })

    it('should display template name and description', () => {
      render(<IRLTemplateModal {...defaultProps} />)

      // Tech M&A appears in title and badge
      expect(screen.getAllByText('Tech M&A').length).toBeGreaterThanOrEqual(1)
      expect(
        screen.getByText('Comprehensive IRL template for technology company acquisitions')
      ).toBeInTheDocument()
    })

    it('should display deal type badge', () => {
      render(<IRLTemplateModal {...defaultProps} />)

      // Deal type badge shows "Tech M&A"
      const badges = screen.getAllByText('Tech M&A')
      expect(badges.length).toBeGreaterThanOrEqual(1)
    })

    it('should display item count and category count', () => {
      render(<IRLTemplateModal {...defaultProps} />)

      expect(screen.getByText('4 items')).toBeInTheDocument()
      expect(screen.getByText('2 categories')).toBeInTheDocument()
    })

    it('should display both action buttons', () => {
      render(<IRLTemplateModal {...defaultProps} />)

      expect(screen.getByTestId('cancel-button')).toBeInTheDocument()
      expect(screen.getByTestId('use-template-button')).toBeInTheDocument()
    })
  })

  describe('collapsible categories (AC7)', () => {
    it('should display all categories', () => {
      render(<IRLTemplateModal {...defaultProps} />)

      expect(screen.getByTestId('category-financial')).toBeInTheDocument()
      expect(screen.getByTestId('category-legal')).toBeInTheDocument()
    })

    it('should show item count for each category', () => {
      render(<IRLTemplateModal {...defaultProps} />)

      // Financial has 2 items, Legal has 2 items
      const itemBadges = screen.getAllByText(/\d+ items/)
      // One for the summary + one per category
      expect(itemBadges.length).toBeGreaterThanOrEqual(3)
    })

    it('should start with categories expanded', () => {
      render(<IRLTemplateModal {...defaultProps} />)

      // Check that items are visible
      const items = screen.getAllByTestId('template-item')
      expect(items.length).toBe(4)
    })

    it('should collapse category when clicked', async () => {
      render(<IRLTemplateModal {...defaultProps} />)

      const financialCategory = screen.getByTestId('category-financial')
      fireEvent.click(financialCategory)

      // After collapsing Financial, only Legal items should be visible (2 items)
      const items = screen.getAllByTestId('template-item')
      expect(items.length).toBe(2)
    })

    it('should expand category when clicked again', async () => {
      render(<IRLTemplateModal {...defaultProps} />)

      const financialCategory = screen.getByTestId('category-financial')

      // Collapse
      fireEvent.click(financialCategory)
      expect(screen.getAllByTestId('template-item').length).toBe(2)

      // Expand again
      fireEvent.click(financialCategory)
      expect(screen.getAllByTestId('template-item').length).toBe(4)
    })
  })

  describe('item details (AC7)', () => {
    it('should display item names', () => {
      render(<IRLTemplateModal {...defaultProps} />)

      expect(screen.getByText('Financial Statements')).toBeInTheDocument()
      expect(screen.getByText('Revenue Analysis')).toBeInTheDocument()
      expect(screen.getByText('Contracts')).toBeInTheDocument()
      expect(screen.getByText('Litigation')).toBeInTheDocument()
    })

    it('should display item descriptions when available', () => {
      render(<IRLTemplateModal {...defaultProps} />)

      expect(screen.getByText('Annual audited financial statements')).toBeInTheDocument()
      expect(screen.getByText('Revenue breakdown by segment')).toBeInTheDocument()
    })

    it('should display priority badges', () => {
      render(<IRLTemplateModal {...defaultProps} />)

      const priorityBadges = screen.getAllByTestId('priority-badge')
      expect(priorityBadges.length).toBe(4)

      // Check for different priority levels
      expect(screen.getAllByText('High').length).toBe(2)
      expect(screen.getByText('Medium')).toBeInTheDocument()
      expect(screen.getByText('Low')).toBeInTheDocument()
    })
  })

  describe('expand/collapse all', () => {
    it('should have Expand All button', () => {
      render(<IRLTemplateModal {...defaultProps} />)

      expect(screen.getByTestId('expand-all')).toBeInTheDocument()
    })

    it('should have Collapse All button', () => {
      render(<IRLTemplateModal {...defaultProps} />)

      expect(screen.getByTestId('collapse-all')).toBeInTheDocument()
    })

    it('should collapse all categories when Collapse All is clicked', () => {
      render(<IRLTemplateModal {...defaultProps} />)

      fireEvent.click(screen.getByTestId('collapse-all'))

      // No items should be visible
      expect(screen.queryAllByTestId('template-item')).toHaveLength(0)
    })

    it('should expand all categories when Expand All is clicked', () => {
      render(<IRLTemplateModal {...defaultProps} />)

      // First collapse all
      fireEvent.click(screen.getByTestId('collapse-all'))
      expect(screen.queryAllByTestId('template-item')).toHaveLength(0)

      // Then expand all
      fireEvent.click(screen.getByTestId('expand-all'))
      expect(screen.getAllByTestId('template-item')).toHaveLength(4)
    })
  })

  describe('button actions', () => {
    it('should call onClose when Cancel button is clicked', () => {
      const onClose = vi.fn()
      render(<IRLTemplateModal {...defaultProps} onClose={onClose} />)

      fireEvent.click(screen.getByTestId('cancel-button'))

      expect(onClose).toHaveBeenCalled()
    })

    it('should call onUseTemplate with template when Use This Template is clicked', () => {
      const onUseTemplate = vi.fn()
      render(<IRLTemplateModal {...defaultProps} onUseTemplate={onUseTemplate} />)

      fireEvent.click(screen.getByTestId('use-template-button'))

      expect(onUseTemplate).toHaveBeenCalledWith(mockTemplate)
    })
  })

  describe('keyboard dismiss (Escape)', () => {
    it('should call onClose when Escape is pressed', () => {
      const onClose = vi.fn()
      render(<IRLTemplateModal {...defaultProps} onClose={onClose} />)

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(onClose).toHaveBeenCalled()
    })

    it('should not respond to Escape when closed', () => {
      const onClose = vi.fn()
      render(<IRLTemplateModal {...defaultProps} isOpen={false} onClose={onClose} />)

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('should have accessible modal structure', () => {
      render(<IRLTemplateModal {...defaultProps} />)

      const modal = screen.getByRole('dialog')
      expect(modal).toBeInTheDocument()
    })

    it('should have accessible buttons', () => {
      render(<IRLTemplateModal {...defaultProps} />)

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /use this template/i })).toBeInTheDocument()
    })
  })
})
