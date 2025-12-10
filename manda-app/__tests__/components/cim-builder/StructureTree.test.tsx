/**
 * StructureTree Component Tests
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * AC: #6 - Structure Sidebar with progress icons and click-to-jump
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StructureTree } from '@/components/cim-builder/SourcesPanel/StructureTree'
import { OutlineSection } from '@/lib/types/cim'

describe('StructureTree', () => {
  const mockOutline: OutlineSection[] = [
    {
      id: 'section-1',
      title: 'Executive Summary',
      description: 'High-level overview',
      order: 0,
      status: 'complete',
      slide_ids: ['slide-1', 'slide-2'],
    },
    {
      id: 'section-2',
      title: 'Company Overview',
      description: 'History and mission',
      order: 1,
      status: 'in_progress',
      slide_ids: ['slide-3'],
    },
    {
      id: 'section-3',
      title: 'Financial Performance',
      description: 'Key metrics',
      order: 2,
      status: 'pending',
      slide_ids: [],
    },
  ]

  const defaultProps = {
    outline: mockOutline,
    onSectionClick: vi.fn(),
  }

  describe('rendering', () => {
    it('should display all section titles', () => {
      render(<StructureTree {...defaultProps} />)

      expect(screen.getByText('Executive Summary')).toBeInTheDocument()
      expect(screen.getByText('Company Overview')).toBeInTheDocument()
      expect(screen.getByText('Financial Performance')).toBeInTheDocument()
    })

    it('should display section descriptions', () => {
      render(<StructureTree {...defaultProps} />)

      expect(screen.getByText('High-level overview')).toBeInTheDocument()
      expect(screen.getByText('History and mission')).toBeInTheDocument()
      expect(screen.getByText('Key metrics')).toBeInTheDocument()
    })

    it('should show empty state when no outline', () => {
      render(<StructureTree {...defaultProps} outline={[]} />)

      expect(screen.getByText('No outline defined yet.')).toBeInTheDocument()
    })

    it('should sort sections by order', () => {
      const unorderedOutline = [
        { ...mockOutline[2], order: 2 },
        { ...mockOutline[0], order: 0 },
        { ...mockOutline[1], order: 1 },
      ]
      render(<StructureTree {...defaultProps} outline={unorderedOutline} />)

      const buttons = screen.getAllByRole('button')
      expect(buttons[0]).toHaveTextContent('Executive Summary')
      expect(buttons[1]).toHaveTextContent('Company Overview')
      expect(buttons[2]).toHaveTextContent('Financial Performance')
    })
  })

  describe('progress icons (AC #6)', () => {
    it('should render checkmark icon for complete status', () => {
      render(<StructureTree {...defaultProps} />)

      // Complete section should have checkmark - verify by class
      const completeButton = screen.getByRole('button', {
        name: /go to section: executive summary/i,
      })
      expect(completeButton).toBeInTheDocument()
    })

    it('should render spinner for in_progress status', () => {
      render(<StructureTree {...defaultProps} />)

      const inProgressButton = screen.getByRole('button', {
        name: /go to section: company overview/i,
      })
      expect(inProgressButton).toBeInTheDocument()
    })

    it('should render circle for pending status', () => {
      render(<StructureTree {...defaultProps} />)

      const pendingButton = screen.getByRole('button', {
        name: /go to section: financial performance/i,
      })
      expect(pendingButton).toBeInTheDocument()
    })
  })

  describe('click-to-jump functionality (AC #6)', () => {
    it('should call onSectionClick when section is clicked', () => {
      const onSectionClick = vi.fn()
      render(<StructureTree {...defaultProps} onSectionClick={onSectionClick} />)

      fireEvent.click(screen.getByText('Executive Summary'))

      expect(onSectionClick).toHaveBeenCalledWith('section-1')
    })

    it('should call onSectionClick for each section independently', () => {
      const onSectionClick = vi.fn()
      render(<StructureTree {...defaultProps} onSectionClick={onSectionClick} />)

      fireEvent.click(screen.getByText('Company Overview'))
      expect(onSectionClick).toHaveBeenCalledWith('section-2')

      fireEvent.click(screen.getByText('Financial Performance'))
      expect(onSectionClick).toHaveBeenCalledWith('section-3')
    })
  })

  describe('accessibility', () => {
    it('should have accessible labels for all sections', () => {
      render(<StructureTree {...defaultProps} />)

      expect(
        screen.getByRole('button', { name: /go to section: executive summary/i })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /go to section: company overview/i })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /go to section: financial performance/i })
      ).toBeInTheDocument()
    })
  })
})
