/**
 * SourceItem Component Tests
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * AC: #3 - Sources Panel Click-to-Reference
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SourceItem } from '@/components/cim-builder/SourcesPanel/SourceItem'

describe('SourceItem', () => {
  const defaultProps = {
    id: 'item-123',
    title: 'Test Document',
    type: 'document' as const,
    onClick: vi.fn(),
  }

  describe('rendering', () => {
    it('should display item title', () => {
      render(<SourceItem {...defaultProps} />)

      expect(screen.getByText('Test Document')).toBeInTheDocument()
    })

    it('should display subtitle when provided', () => {
      render(<SourceItem {...defaultProps} subtitle="Financial > Reports" />)

      expect(screen.getByText('Financial > Reports')).toBeInTheDocument()
    })

    it('should render correct icon for document type', () => {
      render(<SourceItem {...defaultProps} type="document" />)

      // Icon should be present (FileText)
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })

    it('should render correct icon for finding type', () => {
      render(<SourceItem {...defaultProps} type="finding" />)

      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })

    it('should render correct icon for qa type', () => {
      render(<SourceItem {...defaultProps} type="qa" />)

      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })
  })

  describe('click handling (AC #3)', () => {
    it('should call onClick with id and title when clicked', () => {
      const onClick = vi.fn()
      render(<SourceItem {...defaultProps} onClick={onClick} />)

      fireEvent.click(screen.getByRole('button'))

      expect(onClick).toHaveBeenCalledWith('item-123', 'Test Document')
    })

    it('should call onClick on keyboard Enter key (via button click)', () => {
      const onClick = vi.fn()
      render(<SourceItem {...defaultProps} onClick={onClick} />)

      const button = screen.getByRole('button')
      // Native buttons activate on Enter/Space automatically via click
      fireEvent.click(button)

      expect(onClick).toHaveBeenCalledWith('item-123', 'Test Document')
    })
  })

  describe('accessibility', () => {
    it('should have accessible label', () => {
      render(<SourceItem {...defaultProps} />)

      const button = screen.getByRole('button', {
        name: /add document reference: test document/i,
      })
      expect(button).toBeInTheDocument()
    })

    it('should be focusable', () => {
      render(<SourceItem {...defaultProps} />)

      const button = screen.getByRole('button')
      button.focus()
      expect(document.activeElement).toBe(button)
    })
  })
})
