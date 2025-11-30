/**
 * ContradictionCard Component Tests
 * Story: E4.6 - Build Contradictions View (AC: #3)
 *
 * Tests:
 * - Renders both findings side-by-side
 * - Shows Finding A and Finding B with correct labels
 * - Displays domain tags, confidence badges, status
 * - Expand/collapse for long text
 * - Source attribution links are clickable
 * - Resolution note is shown when present
 * - Actions trigger handlers correctly
 * - Accessible: ARIA labels and keyboard navigation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContradictionCard, type ContradictionCardProps } from '@/components/knowledge-explorer/contradictions/ContradictionCard'
import type { ContradictionWithFindings } from '@/lib/types/contradictions'
import type { Finding } from '@/lib/types/findings'

// Mock date-fns to have consistent test output
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '2 days ago'),
}))

// Mock SourceAttributionLink since it has complex dependencies
vi.mock('@/components/knowledge-explorer/shared', () => ({
  ConfidenceBadge: ({ confidence, showPercentage }: { confidence: number | null; showPercentage?: boolean }) => (
    <span data-testid="confidence-badge">{showPercentage && confidence ? `${Math.round(confidence * 100)}%` : 'confidence'}</span>
  ),
  DomainTag: ({ domain }: { domain: string | null }) => (
    <span data-testid="domain-tag">{domain || 'Unknown'}</span>
  ),
  SourceAttributionLink: ({ documentName, pageNumber }: { documentName: string; pageNumber: number | null }) => (
    <button data-testid="source-link">{documentName}{pageNumber ? `, p.${pageNumber}` : ''}</button>
  ),
}))

describe('ContradictionCard', () => {
  const mockFindingA: Finding = {
    id: 'finding-a-123',
    dealId: 'deal-456',
    documentId: 'doc-789',
    chunkId: 'chunk-001',
    userId: 'user-001',
    text: 'Revenue was $50 million in Q1 2024, showing strong growth.',
    sourceDocument: 'Financial Report Q1 2024.pdf',
    pageNumber: 12,
    confidence: 0.92,
    findingType: 'metric',
    domain: 'financial',
    status: 'pending',
    validationHistory: [],
    metadata: null,
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: null,
  }

  const mockFindingB: Finding = {
    id: 'finding-b-456',
    dealId: 'deal-456',
    documentId: 'doc-790',
    chunkId: 'chunk-002',
    userId: 'user-001',
    text: 'Q1 2024 revenue declined to $45 million due to market conditions.',
    sourceDocument: 'Investor Memo March 2024.pdf',
    pageNumber: 3,
    confidence: 0.88,
    findingType: 'metric',
    domain: 'financial',
    status: 'pending',
    validationHistory: [],
    metadata: null,
    createdAt: '2024-01-16T09:00:00Z',
    updatedAt: null,
  }

  const mockContradiction: ContradictionWithFindings = {
    id: 'contradiction-123',
    dealId: 'deal-456',
    findingAId: 'finding-a-123',
    findingBId: 'finding-b-456',
    confidence: 0.85,
    status: 'unresolved',
    resolution: null,
    resolutionNote: null,
    detectedAt: '2024-01-17T12:00:00Z',
    resolvedAt: null,
    resolvedBy: null,
    metadata: null,
    findingA: mockFindingA,
    findingB: mockFindingB,
  }

  const defaultProps: ContradictionCardProps = {
    contradiction: mockContradiction,
    onResolve: vi.fn().mockResolvedValue(undefined),
    projectId: 'test-project-id',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Side-by-side Rendering (AC3)', () => {
    it('renders both findings side by side', () => {
      render(<ContradictionCard {...defaultProps} />)

      // Check Finding A content
      expect(screen.getByText(/Revenue was \$50 million/)).toBeInTheDocument()

      // Check Finding B content
      expect(screen.getByText(/Q1 2024 revenue declined/)).toBeInTheDocument()
    })

    it('shows Finding A and Finding B labels', () => {
      render(<ContradictionCard {...defaultProps} />)

      expect(screen.getByText('A')).toBeInTheDocument()
      expect(screen.getByText('B')).toBeInTheDocument()
    })

    it('shows VS separator between findings', () => {
      render(<ContradictionCard {...defaultProps} />)

      expect(screen.getByText('VS')).toBeInTheDocument()
    })

    it('renders card with article role', () => {
      render(<ContradictionCard {...defaultProps} />)

      expect(screen.getByRole('article')).toBeInTheDocument()
    })
  })

  describe('Finding Details Display', () => {
    it('renders domain tags for both findings', () => {
      render(<ContradictionCard {...defaultProps} />)

      const domainTags = screen.getAllByTestId('domain-tag')
      expect(domainTags).toHaveLength(2)
      expect(domainTags[0]).toHaveTextContent('financial')
      expect(domainTags[1]).toHaveTextContent('financial')
    })

    it('renders confidence badges for both findings', () => {
      render(<ContradictionCard {...defaultProps} />)

      const confidenceBadges = screen.getAllByTestId('confidence-badge')
      expect(confidenceBadges.length).toBeGreaterThanOrEqual(2)
    })

    it('renders source attribution links for both findings', () => {
      render(<ContradictionCard {...defaultProps} />)

      const sourceLinks = screen.getAllByTestId('source-link')
      expect(sourceLinks).toHaveLength(2)
      expect(sourceLinks[0]).toHaveTextContent('Financial Report Q1 2024.pdf, p.12')
      expect(sourceLinks[1]).toHaveTextContent('Investor Memo March 2024.pdf, p.3')
    })
  })

  describe('Status Display (AC2)', () => {
    it('shows unresolved status badge', () => {
      render(<ContradictionCard {...defaultProps} />)

      expect(screen.getByText('Unresolved')).toBeInTheDocument()
    })

    it('shows resolved status badge for resolved contradictions', () => {
      const resolvedContradiction = {
        ...mockContradiction,
        status: 'resolved' as const,
        resolution: 'accept_a' as const,
      }
      render(<ContradictionCard {...defaultProps} contradiction={resolvedContradiction} />)

      // Status badge in header
      const resolvedBadges = screen.getAllByText('Resolved')
      expect(resolvedBadges.length).toBeGreaterThanOrEqual(1)
    })

    it('shows investigating status badge', () => {
      const investigatingContradiction = {
        ...mockContradiction,
        status: 'investigating' as const,
      }
      render(<ContradictionCard {...defaultProps} contradiction={investigatingContradiction} />)

      expect(screen.getByText('Investigating')).toBeInTheDocument()
    })

    it('shows detection confidence', () => {
      render(<ContradictionCard {...defaultProps} />)

      expect(screen.getByText('Detection confidence:')).toBeInTheDocument()
    })
  })

  describe('Text Truncation and Expand/Collapse', () => {
    const longText = 'A'.repeat(200) // More than 150 chars

    it('truncates text longer than 150 characters', () => {
      const longFindingA = { ...mockFindingA, text: longText }
      const contradictionWithLongText = {
        ...mockContradiction,
        findingA: longFindingA,
      }
      render(<ContradictionCard {...defaultProps} contradiction={contradictionWithLongText} />)

      // Should show truncated text with ellipsis
      expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument()
    })

    it('shows "Show more" button for long text', () => {
      const longFindingA = { ...mockFindingA, text: longText }
      const contradictionWithLongText = {
        ...mockContradiction,
        findingA: longFindingA,
      }
      render(<ContradictionCard {...defaultProps} contradiction={contradictionWithLongText} />)

      expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument()
    })

    it('expands text on "Show more" click', async () => {
      const user = userEvent.setup()
      const longFindingA = { ...mockFindingA, text: longText }
      const contradictionWithLongText = {
        ...mockContradiction,
        findingA: longFindingA,
      }
      render(<ContradictionCard {...defaultProps} contradiction={contradictionWithLongText} />)

      await user.click(screen.getByRole('button', { name: /show more/i }))

      // After expand, should show "Show less"
      expect(screen.getByRole('button', { name: /show less/i })).toBeInTheDocument()
    })

    it('collapses text on "Show less" click', async () => {
      const user = userEvent.setup()
      const longFindingA = { ...mockFindingA, text: longText }
      const contradictionWithLongText = {
        ...mockContradiction,
        findingA: longFindingA,
      }
      render(<ContradictionCard {...defaultProps} contradiction={contradictionWithLongText} />)

      // Expand
      await user.click(screen.getByRole('button', { name: /show more/i }))
      // Collapse
      await user.click(screen.getByRole('button', { name: /show less/i }))

      expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument()
    })
  })

  describe('Resolution Note Display', () => {
    it('shows resolution note when present', () => {
      const contradictionWithNote = {
        ...mockContradiction,
        status: 'noted' as const,
        resolutionNote: 'This needs further verification from the finance team.',
      }
      render(<ContradictionCard {...defaultProps} contradiction={contradictionWithNote} />)

      expect(screen.getByText('Note')).toBeInTheDocument()
      expect(screen.getByText('This needs further verification from the finance team.')).toBeInTheDocument()
    })

    it('does not show note section when no note is present', () => {
      render(<ContradictionCard {...defaultProps} />)

      expect(screen.queryByText('Note')).not.toBeInTheDocument()
    })
  })

  describe('Detection Date Display', () => {
    it('shows relative detection date', () => {
      render(<ContradictionCard {...defaultProps} />)

      expect(screen.getByText('Detected 2 days ago')).toBeInTheDocument()
    })
  })

  describe('Actions Integration', () => {
    it('renders action buttons', () => {
      render(<ContradictionCard {...defaultProps} />)

      expect(screen.getByRole('button', { name: /accept finding a/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /accept finding b/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /mark for investigation/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /add a note/i })).toBeInTheDocument()
    })

    it('calls onResolve with accept_a when Accept A is clicked', async () => {
      const user = userEvent.setup()
      const onResolve = vi.fn().mockResolvedValue(undefined)
      render(<ContradictionCard {...defaultProps} onResolve={onResolve} />)

      await user.click(screen.getByRole('button', { name: /accept finding a/i }))

      await waitFor(() => {
        expect(onResolve).toHaveBeenCalledWith('contradiction-123', 'accept_a', undefined)
      })
    })

    it('calls onResolve with accept_b when Accept B is clicked', async () => {
      const user = userEvent.setup()
      const onResolve = vi.fn().mockResolvedValue(undefined)
      render(<ContradictionCard {...defaultProps} onResolve={onResolve} />)

      await user.click(screen.getByRole('button', { name: /accept finding b/i }))

      await waitFor(() => {
        expect(onResolve).toHaveBeenCalledWith('contradiction-123', 'accept_b', undefined)
      })
    })
  })

  describe('Accessibility', () => {
    it('card has correct aria-label', () => {
      render(<ContradictionCard {...defaultProps} />)

      const card = screen.getByRole('article')
      expect(card).toHaveAttribute('aria-label', expect.stringContaining('Contradiction'))
    })

    it('finding labels have aria-label attributes', () => {
      render(<ContradictionCard {...defaultProps} />)

      expect(screen.getByLabelText('Finding A')).toBeInTheDocument()
      expect(screen.getByLabelText('Finding B')).toBeInTheDocument()
    })
  })

  describe('Hover and Focus States', () => {
    it('has hover transition classes', () => {
      render(<ContradictionCard {...defaultProps} />)

      const card = screen.getByRole('article')
      expect(card).toHaveClass('hover:shadow-md')
    })

    it('has focus-within ring for accessibility', () => {
      render(<ContradictionCard {...defaultProps} />)

      const card = screen.getByRole('article')
      expect(card).toHaveClass('focus-within:ring-2')
    })
  })
})
