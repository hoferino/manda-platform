/**
 * FindingCard Component Tests
 * Story: E4.4 - Build Card View Alternative for Findings (AC: 1, 4, 5, 8)
 *
 * Tests:
 * - Renders finding data correctly (text, domain, confidence, status, date)
 * - Truncates text at 200 characters with "show more"
 * - Shows relative date format
 * - Expand/collapse functionality
 * - Actions trigger handlers correctly
 * - Accessible: ARIA labels and keyboard navigation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FindingCard, type FindingCardProps } from '@/components/knowledge-explorer/findings/FindingCard'
import type { Finding } from '@/lib/types/findings'

// Mock date-fns to have consistent test output
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '2 days ago'),
}))

describe('FindingCard', () => {
  const mockFinding: Finding = {
    id: 'finding-123',
    dealId: 'deal-456',
    documentId: 'doc-789',
    chunkId: 'chunk-001',
    userId: 'user-001',
    text: 'This is a test finding with important information about the company revenue.',
    sourceDocument: 'Financial Report Q1 2024.pdf',
    pageNumber: 42,
    confidence: 0.85,
    findingType: 'metric',
    domain: 'financial',
    status: 'pending',
    validationHistory: [],
    metadata: null,
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: null,
  }

  const defaultProps: FindingCardProps = {
    finding: mockFinding,
    onValidate: vi.fn().mockResolvedValue(undefined),
    onEdit: vi.fn(),
    onSaveEdit: vi.fn().mockResolvedValue(undefined),
    onCancelEdit: vi.fn(),
    isEditing: false,
    showSimilarity: false,
    projectId: 'test-project-id',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering (AC1)', () => {
    it('renders finding text correctly', () => {
      render(<FindingCard {...defaultProps} />)
      expect(screen.getByText(/This is a test finding/)).toBeInTheDocument()
    })

    it('renders domain tag', () => {
      render(<FindingCard {...defaultProps} />)
      expect(screen.getByText('Financial')).toBeInTheDocument()
    })

    it('renders confidence badge with percentage', () => {
      render(<FindingCard {...defaultProps} />)
      expect(screen.getByText('85%')).toBeInTheDocument()
    })

    it('renders status badge', () => {
      render(<FindingCard {...defaultProps} />)
      expect(screen.getByText('Pending')).toBeInTheDocument()
    })

    it('renders relative date', () => {
      render(<FindingCard {...defaultProps} />)
      expect(screen.getByText('2 days ago')).toBeInTheDocument()
    })

    it('renders card with article role', () => {
      render(<FindingCard {...defaultProps} />)
      expect(screen.getByRole('article')).toBeInTheDocument()
    })
  })

  describe('Text Truncation (AC1)', () => {
    const longText = 'A'.repeat(250) // More than 200 chars

    it('truncates text longer than 200 characters', () => {
      const longFinding = { ...mockFinding, text: longText }
      render(<FindingCard {...defaultProps} finding={longFinding} />)

      // Should show truncated text with ellipsis
      expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument()
    })

    it('shows "Show more" button for long text', () => {
      const longFinding = { ...mockFinding, text: longText }
      render(<FindingCard {...defaultProps} finding={longFinding} />)

      expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument()
    })

    it('does not show "Show more" for short text', () => {
      render(<FindingCard {...defaultProps} />)

      expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument()
    })
  })

  describe('Expand/Collapse (AC5)', () => {
    const longText = 'A'.repeat(250)
    const longFinding = { ...mockFinding, text: longText }

    it('expands card to show full text on click', async () => {
      const user = userEvent.setup()
      render(<FindingCard {...defaultProps} finding={longFinding} />)

      await user.click(screen.getByRole('button', { name: /show more/i }))

      // After expand, should show "Show less"
      expect(screen.getByRole('button', { name: /show less/i })).toBeInTheDocument()
    })

    it('collapses card on second click', async () => {
      const user = userEvent.setup()
      render(<FindingCard {...defaultProps} finding={longFinding} />)

      // Expand
      await user.click(screen.getByRole('button', { name: /show more/i }))
      // Collapse
      await user.click(screen.getByRole('button', { name: /show less/i }))

      expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument()
    })

    it('shows source attribution when expanded', async () => {
      const user = userEvent.setup()
      render(<FindingCard {...defaultProps} finding={longFinding} />)

      await user.click(screen.getByRole('button', { name: /show more/i }))

      // SourceAttributionLink renders a button with the document name and page reference
      // Format: "Financial Report Q1 2024.pdf, p.42"
      expect(screen.getByText(/Financial Report Q1 2024\.pdf, p\.42/)).toBeInTheDocument()
    })

    it('expands on Enter key press', async () => {
      const user = userEvent.setup()
      render(<FindingCard {...defaultProps} finding={longFinding} />)

      const card = screen.getByRole('article')
      card.focus()
      await user.keyboard('{Enter}')

      // After expand, should show "Show less"
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /show less/i })).toBeInTheDocument()
      })
    })

    it('collapses on Escape key press when expanded', async () => {
      const user = userEvent.setup()
      render(<FindingCard {...defaultProps} finding={longFinding} />)

      // First expand
      await user.click(screen.getByRole('button', { name: /show more/i }))

      // Then press Escape on the card
      const card = screen.getByRole('article')
      card.focus()
      await user.keyboard('{Escape}')

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument()
      })
    })
  })

  describe('Card Actions (AC4)', () => {
    it('calls onValidate with confirm when validate is clicked', async () => {
      const user = userEvent.setup()
      render(<FindingCard {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /validate finding/i }))

      await waitFor(() => {
        expect(defaultProps.onValidate).toHaveBeenCalledWith('finding-123', 'confirm')
      })
    })

    it('calls onValidate with reject when reject is clicked', async () => {
      const user = userEvent.setup()
      render(<FindingCard {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /reject finding/i }))

      await waitFor(() => {
        expect(defaultProps.onValidate).toHaveBeenCalledWith('finding-123', 'reject')
      })
    })

    it('calls onEdit when edit is clicked', async () => {
      const user = userEvent.setup()
      render(<FindingCard {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /edit/i }))

      expect(defaultProps.onEdit).toHaveBeenCalledWith(mockFinding)
    })
  })

  describe('Edit Mode (AC4)', () => {
    it('shows InlineEdit component when isEditing is true', () => {
      render(<FindingCard {...defaultProps} isEditing={true} />)

      expect(screen.getByRole('textbox', { name: /edit finding text/i })).toBeInTheDocument()
    })

    it('shows textarea for editing when in edit mode', () => {
      render(<FindingCard {...defaultProps} isEditing={true} />)

      // Text is shown in the textarea for editing
      const textarea = screen.getByRole('textbox', { name: /edit finding text/i })
      expect(textarea).toHaveValue(mockFinding.text)
    })
  })

  describe('Similarity Badge (AC6)', () => {
    const findingWithSimilarity = {
      ...mockFinding,
      similarity: 0.92,
    }

    it('shows similarity badge when showSimilarity is true', () => {
      render(
        <FindingCard
          {...defaultProps}
          finding={findingWithSimilarity}
          showSimilarity={true}
        />
      )

      expect(screen.getByText('92% match')).toBeInTheDocument()
    })

    it('does not show similarity badge when showSimilarity is false', () => {
      render(
        <FindingCard
          {...defaultProps}
          finding={findingWithSimilarity}
          showSimilarity={false}
        />
      )

      expect(screen.queryByText(/match/)).not.toBeInTheDocument()
    })
  })

  describe('Status Display', () => {
    it('shows validated status correctly', () => {
      const validatedFinding = { ...mockFinding, status: 'validated' as const }
      render(<FindingCard {...defaultProps} finding={validatedFinding} />)

      expect(screen.getByText('Validated')).toBeInTheDocument()
    })

    it('shows rejected status correctly', () => {
      const rejectedFinding = { ...mockFinding, status: 'rejected' as const }
      render(<FindingCard {...defaultProps} finding={rejectedFinding} />)

      expect(screen.getByText('Rejected')).toBeInTheDocument()
    })
  })

  describe('Accessibility (AC8)', () => {
    it('card has correct aria-label', () => {
      render(<FindingCard {...defaultProps} />)

      const card = screen.getByRole('article')
      expect(card).toHaveAttribute('aria-label', expect.stringContaining('Finding:'))
    })

    it('card is focusable', () => {
      render(<FindingCard {...defaultProps} />)

      const card = screen.getByRole('article')
      expect(card).toHaveAttribute('tabIndex', '0')
    })

    it('date has datetime attribute', () => {
      render(<FindingCard {...defaultProps} />)

      const timeElement = screen.getByText('2 days ago').closest('time')
      expect(timeElement).toHaveAttribute('dateTime', '2024-01-15T10:30:00Z')
    })

    it('action buttons have appropriate aria labels', () => {
      render(<FindingCard {...defaultProps} />)

      expect(screen.getByRole('button', { name: /validate finding/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /reject finding/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /edit finding/i })).toBeInTheDocument()
    })
  })

  describe('Hover State', () => {
    it('has hover transition classes', () => {
      render(<FindingCard {...defaultProps} />)

      const card = screen.getByRole('article')
      expect(card).toHaveClass('hover:shadow-md')
      expect(card).toHaveClass('hover:-translate-y-0.5')
    })
  })
})
