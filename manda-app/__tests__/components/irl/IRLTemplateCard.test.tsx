/**
 * IRL Template Card Component Tests
 *
 * Story: E6.1 - Build IRL Builder UI with Template Selection (AC6)
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IRLTemplateCard, BlankIRLCard } from '@/components/irl/IRLTemplateCard'
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
        { name: 'Financial Statements', description: 'Annual statements', priority: 'high' },
        { name: 'Revenue Analysis', description: 'Revenue breakdown', priority: 'medium' },
      ],
    },
    {
      name: 'Legal',
      items: [
        { name: 'Contracts', description: 'Material contracts', priority: 'high' },
      ],
    },
  ],
}

describe('IRLTemplateCard', () => {
  describe('rendering', () => {
    it('should display template name (AC6)', () => {
      render(<IRLTemplateCard template={mockTemplate} />)

      // Template name appears in card title and badge
      const techMaElements = screen.getAllByText('Tech M&A')
      expect(techMaElements.length).toBeGreaterThanOrEqual(1)
    })

    it('should display template description (AC6)', () => {
      render(<IRLTemplateCard template={mockTemplate} />)

      expect(
        screen.getByText('Comprehensive IRL template for technology company acquisitions')
      ).toBeInTheDocument()
    })

    it('should display total item count (AC6)', () => {
      render(<IRLTemplateCard template={mockTemplate} />)

      // 2 items in Financial + 1 item in Legal = 3 items
      expect(screen.getByTestId('item-count')).toHaveTextContent('3 items')
    })

    it('should display category count', () => {
      render(<IRLTemplateCard template={mockTemplate} />)

      expect(screen.getByText('2 categories')).toBeInTheDocument()
    })

    it('should display deal type badge', () => {
      render(<IRLTemplateCard template={mockTemplate} />)

      // The badge should contain Tech M&A (deal type label)
      const techMaElements = screen.getAllByText('Tech M&A')
      expect(techMaElements.length).toBeGreaterThanOrEqual(1)
    })

    it('should display preview button', () => {
      render(<IRLTemplateCard template={mockTemplate} />)

      expect(screen.getByTestId('preview-button')).toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    it('should call onSelect when card is clicked', () => {
      const onSelect = vi.fn()
      render(<IRLTemplateCard template={mockTemplate} onSelect={onSelect} />)

      fireEvent.click(screen.getByTestId('irl-template-card-tech-ma'))

      expect(onSelect).toHaveBeenCalledWith(mockTemplate)
    })

    it('should call onPreview when preview button is clicked', () => {
      const onSelect = vi.fn()
      const onPreview = vi.fn()
      render(
        <IRLTemplateCard
          template={mockTemplate}
          onSelect={onSelect}
          onPreview={onPreview}
        />
      )

      fireEvent.click(screen.getByTestId('preview-button'))

      expect(onPreview).toHaveBeenCalledWith(mockTemplate)
      expect(onSelect).not.toHaveBeenCalled() // Should not trigger selection
    })

    it('should handle keyboard navigation with Enter', () => {
      const onSelect = vi.fn()
      render(<IRLTemplateCard template={mockTemplate} onSelect={onSelect} />)

      const card = screen.getByTestId('irl-template-card-tech-ma')
      fireEvent.keyDown(card, { key: 'Enter' })

      expect(onSelect).toHaveBeenCalledWith(mockTemplate)
    })

    it('should handle keyboard navigation with Space', () => {
      const onSelect = vi.fn()
      render(<IRLTemplateCard template={mockTemplate} onSelect={onSelect} />)

      const card = screen.getByTestId('irl-template-card-tech-ma')
      fireEvent.keyDown(card, { key: ' ' })

      expect(onSelect).toHaveBeenCalledWith(mockTemplate)
    })
  })

  describe('selection state', () => {
    it('should show selected state when isSelected is true', () => {
      render(<IRLTemplateCard template={mockTemplate} isSelected={true} />)

      const card = screen.getByTestId('irl-template-card-tech-ma')
      expect(card).toHaveAttribute('aria-pressed', 'true')
      expect(card.className).toContain('ring-2')
    })

    it('should not show selected state when isSelected is false', () => {
      render(<IRLTemplateCard template={mockTemplate} isSelected={false} />)

      const card = screen.getByTestId('irl-template-card-tech-ma')
      expect(card).toHaveAttribute('aria-pressed', 'false')
    })
  })

  describe('accessibility', () => {
    it('should have proper role and aria-label', () => {
      render(<IRLTemplateCard template={mockTemplate} />)

      const card = screen.getByTestId('irl-template-card-tech-ma')
      expect(card).toHaveAttribute('role', 'button')
      expect(card).toHaveAttribute('aria-label', 'Select Tech M&A template with 3 items')
    })

    it('should be focusable', () => {
      render(<IRLTemplateCard template={mockTemplate} />)

      const card = screen.getByTestId('irl-template-card-tech-ma')
      expect(card).toHaveAttribute('tabIndex', '0')
    })

    it('should have accessible preview button', () => {
      render(<IRLTemplateCard template={mockTemplate} />)

      const button = screen.getByTestId('preview-button')
      expect(button).toHaveAttribute('aria-label', 'Preview Tech M&A template')
    })
  })

  describe('hover state', () => {
    it('should have hover styles defined', () => {
      render(<IRLTemplateCard template={mockTemplate} />)

      const card = screen.getByTestId('irl-template-card-tech-ma')
      // Check that hover classes are present
      expect(card.className).toContain('hover:shadow-md')
      expect(card.className).toContain('hover:border-primary/50')
    })
  })

  describe('different deal types', () => {
    it.each([
      ['industrial', 'Industrial'],
      ['pharma', 'Pharma'],
      ['financial', 'Financial Services'],
    ])('should display correct badge for %s deal type', (dealType, expectedLabel) => {
      const template = {
        ...mockTemplate,
        id: dealType,
        dealType: dealType as IRLTemplate['dealType'],
      }

      render(<IRLTemplateCard template={template} />)

      expect(screen.getByText(expectedLabel)).toBeInTheDocument()
    })
  })
})

describe('BlankIRLCard', () => {
  describe('rendering', () => {
    it('should display Custom (Blank) title', () => {
      render(<BlankIRLCard />)

      expect(screen.getByText('Custom (Blank)')).toBeInTheDocument()
    })

    it('should display description', () => {
      render(<BlankIRLCard />)

      expect(
        screen.getByText('Start with an empty IRL and add your own categories and items')
      ).toBeInTheDocument()
    })

    it('should display 0 items', () => {
      render(<BlankIRLCard />)

      expect(screen.getByText('0 items')).toBeInTheDocument()
    })

    it('should display Custom badge', () => {
      render(<BlankIRLCard />)

      expect(screen.getByText('Custom')).toBeInTheDocument()
    })

    it('should have dashed border style', () => {
      render(<BlankIRLCard />)

      const card = screen.getByTestId('blank-irl-card')
      expect(card.className).toContain('border-dashed')
    })
  })

  describe('interactions', () => {
    it('should call onSelect when clicked', () => {
      const onSelect = vi.fn()
      render(<BlankIRLCard onSelect={onSelect} />)

      fireEvent.click(screen.getByTestId('blank-irl-card'))

      expect(onSelect).toHaveBeenCalled()
    })

    it('should handle keyboard navigation', () => {
      const onSelect = vi.fn()
      render(<BlankIRLCard onSelect={onSelect} />)

      const card = screen.getByTestId('blank-irl-card')
      fireEvent.keyDown(card, { key: 'Enter' })

      expect(onSelect).toHaveBeenCalled()
    })
  })

  describe('selection state', () => {
    it('should show selected state when isSelected is true', () => {
      render(<BlankIRLCard isSelected={true} />)

      const card = screen.getByTestId('blank-irl-card')
      expect(card).toHaveAttribute('aria-pressed', 'true')
      expect(card.className).toContain('ring-2')
      expect(card.className).toContain('border-solid')
    })
  })

  describe('accessibility', () => {
    it('should have proper role and aria-label', () => {
      render(<BlankIRLCard />)

      const card = screen.getByTestId('blank-irl-card')
      expect(card).toHaveAttribute('role', 'button')
      expect(card).toHaveAttribute('aria-label', 'Create blank IRL')
    })
  })
})
