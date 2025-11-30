/**
 * RelatedFindings Component Tests
 * Story: E4.9 - Implement Finding Detail View with Full Context (AC: 5)
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { RelatedFindings } from '@/components/knowledge-explorer/findings/RelatedFindings'
import type { RelatedFindingWithSimilarity } from '@/components/knowledge-explorer/findings/RelatedFindings'

const createMockFinding = (
  overrides: Partial<RelatedFindingWithSimilarity> = {}
): RelatedFindingWithSimilarity => ({
  id: 'finding-1',
  dealId: 'deal-1',
  documentId: 'doc-1',
  chunkId: 'chunk-1',
  userId: 'user-1',
  text: 'This is a test finding text',
  sourceDocument: 'report.pdf',
  pageNumber: 5,
  confidence: 0.85,
  findingType: 'fact',
  domain: 'financial',
  status: 'pending',
  validationHistory: [],
  metadata: null,
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: null,
  similarity: 0.78,
  ...overrides,
})

describe('RelatedFindings', () => {
  describe('Empty State', () => {
    it('displays empty state when no findings', () => {
      const onSelect = vi.fn()
      render(<RelatedFindings findings={[]} onSelectFinding={onSelect} />)

      expect(screen.getByText('No related findings found')).toBeInTheDocument()
      expect(
        screen.getByText(/Related findings are discovered using semantic similarity/)
      ).toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    it('displays loading skeleton when isLoading is true', () => {
      const onSelect = vi.fn()
      render(<RelatedFindings findings={[]} onSelectFinding={onSelect} isLoading={true} />)

      // Should have the header
      expect(screen.getByText('Related Findings')).toBeInTheDocument()

      // Skeleton elements should be present (animate-pulse class containers)
      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  describe('Findings List', () => {
    it('displays findings with similarity scores', () => {
      const onSelect = vi.fn()
      const findings = [
        createMockFinding({ id: 'f1', similarity: 0.85, confidence: 0.5 }),
        createMockFinding({ id: 'f2', similarity: 0.72, confidence: 0.5 }),
      ]

      render(<RelatedFindings findings={findings} onSelectFinding={onSelect} />)

      // Find by the aria-label to distinguish from confidence badges
      expect(screen.getByLabelText('85% similar')).toBeInTheDocument()
      expect(screen.getByLabelText('72% similar')).toBeInTheDocument()
    })

    it('displays finding count in header', () => {
      const onSelect = vi.fn()
      const findings = [
        createMockFinding({ id: 'f1' }),
        createMockFinding({ id: 'f2' }),
        createMockFinding({ id: 'f3' }),
      ]

      render(<RelatedFindings findings={findings} onSelectFinding={onSelect} />)

      expect(screen.getByText('(3)')).toBeInTheDocument()
    })

    it('displays domain badge for each finding', () => {
      const onSelect = vi.fn()
      const findings = [createMockFinding({ domain: 'financial' })]

      render(<RelatedFindings findings={findings} onSelectFinding={onSelect} />)

      expect(screen.getByText('Financial')).toBeInTheDocument()
    })

    it('displays confidence badge for each finding', () => {
      const onSelect = vi.fn()
      const findings = [createMockFinding({ confidence: 0.85 })]

      render(<RelatedFindings findings={findings} onSelectFinding={onSelect} />)

      // Look for confidence indicator (percentage)
      const confidenceEl = screen.getByText('85%', { exact: false })
      expect(confidenceEl).toBeInTheDocument()
    })

    it('truncates long finding text', () => {
      const onSelect = vi.fn()
      const longText = 'A'.repeat(200)
      const findings = [createMockFinding({ text: longText })]

      render(<RelatedFindings findings={findings} onSelectFinding={onSelect} />)

      // Should be truncated (150 chars + ...)
      expect(screen.getByText(/A{150}\.\.\./)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument()
    })

    it('expands truncated text on click', () => {
      const onSelect = vi.fn()
      const longText = 'A'.repeat(200)
      const findings = [createMockFinding({ text: longText })]

      render(<RelatedFindings findings={findings} onSelectFinding={onSelect} />)

      fireEvent.click(screen.getByRole('button', { name: /show more/i }))

      expect(screen.getByText(longText)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /show less/i })).toBeInTheDocument()
    })
  })

  describe('Click Behavior', () => {
    it('calls onSelectFinding when finding is clicked', () => {
      const onSelect = vi.fn()
      const findings = [createMockFinding({ id: 'finding-123' })]

      render(<RelatedFindings findings={findings} onSelectFinding={onSelect} />)

      // Click on the finding button
      const findingButton = screen.getByRole('button', { name: /view related finding/i })
      fireEvent.click(findingButton)

      expect(onSelect).toHaveBeenCalledWith('finding-123')
    })

    it('calls onSelectFinding with Enter key', () => {
      const onSelect = vi.fn()
      const findings = [createMockFinding({ id: 'finding-456' })]

      render(<RelatedFindings findings={findings} onSelectFinding={onSelect} />)

      const findingButton = screen.getByRole('button', { name: /view related finding/i })
      fireEvent.keyDown(findingButton, { key: 'Enter' })

      expect(onSelect).toHaveBeenCalledWith('finding-456')
    })

    it('calls onSelectFinding with Space key', () => {
      const onSelect = vi.fn()
      const findings = [createMockFinding({ id: 'finding-789' })]

      render(<RelatedFindings findings={findings} onSelectFinding={onSelect} />)

      const findingButton = screen.getByRole('button', { name: /view related finding/i })
      fireEvent.keyDown(findingButton, { key: ' ' })

      expect(onSelect).toHaveBeenCalledWith('finding-789')
    })
  })

  describe('Similarity Badge Colors', () => {
    it('uses green color for high similarity (>= 80%)', () => {
      const onSelect = vi.fn()
      const findings = [createMockFinding({ similarity: 0.85, confidence: 0.5 })]

      render(<RelatedFindings findings={findings} onSelectFinding={onSelect} />)

      // Find the similarity badge specifically by aria-label
      const badge = screen.getByLabelText('85% similar')
      expect(badge.className).toContain('green')
    })

    it('uses yellow color for medium similarity (60-79%)', () => {
      const onSelect = vi.fn()
      const findings = [createMockFinding({ similarity: 0.65, confidence: 0.5 })]

      render(<RelatedFindings findings={findings} onSelectFinding={onSelect} />)

      const badge = screen.getByLabelText('65% similar')
      expect(badge.className).toContain('yellow')
    })

    it('uses gray color for low similarity (< 60%)', () => {
      const onSelect = vi.fn()
      const findings = [createMockFinding({ similarity: 0.45, confidence: 0.5 })]

      render(<RelatedFindings findings={findings} onSelectFinding={onSelect} />)

      const badge = screen.getByLabelText('45% similar')
      expect(badge.className).toContain('gray')
    })
  })

  describe('Accessibility', () => {
    it('has proper list role and label', () => {
      const onSelect = vi.fn()
      const findings = [createMockFinding()]

      render(<RelatedFindings findings={findings} onSelectFinding={onSelect} />)

      const list = screen.getByRole('list', { name: /related findings/i })
      expect(list).toBeInTheDocument()
    })
  })
})
