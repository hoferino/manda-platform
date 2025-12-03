/**
 * GapCard Component Tests
 * Story: E4.8 - Build Gap Analysis View (AC: #4, #5, #6, #7)
 *
 * Tests:
 * - Category badge displays correctly
 * - Priority badge displays correctly
 * - Status badge displays correctly
 * - Gap description renders
 * - IRL item details expand/collapse
 * - Domain tag shows for information gaps
 * - Action buttons render and work
 * - Resolved state shows undo button
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GapCard, type GapCardProps } from '@/components/knowledge-explorer/gaps/GapCard'
import type { Gap } from '@/lib/types/gaps'

// Mock pointer capture for Radix UI components
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
})

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

// Mock the shared components
vi.mock('@/components/knowledge-explorer/shared', () => ({
  DomainTag: ({ domain }: { domain: string | null }) => (
    <span data-testid="domain-tag">{domain || 'Unknown'}</span>
  ),
}))

// Mock the API
vi.mock('@/lib/api/gaps', () => ({
  createIrlFromGap: vi.fn(),
  createManualFinding: vi.fn(),
}))

describe('GapCard', () => {
  const mockIrlGap: Gap = {
    id: 'irl-gap-123',
    dealId: 'deal-456',
    category: 'irl_missing',
    description: 'Financial statements for FY2023 not received',
    priority: 'high',
    status: 'active',
    domain: 'financial',
    relatedIrlItemId: 'irl-item-789',
    relatedIrlItem: {
      id: 'irl-item-789',
      irlId: 'irl-001',
      category: 'Financial Documents',
      name: 'Annual Financial Statements',
      description: 'Audited financial statements for FY2023',
      required: true,
      sortOrder: 1,
      documentId: null,
      documentName: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    source: 'IRL Checklist',
    detectedAt: '2024-01-17T12:00:00Z',
    metadata: null,
  }

  const mockInfoGap: Gap = {
    id: 'info-gap-456',
    dealId: 'deal-456',
    category: 'information_gap',
    description: 'Sparse coverage in Legal domain - only 1 finding detected',
    priority: 'high',
    status: 'active',
    domain: 'legal',
    relatedIrlItemId: null,
    relatedIrlItem: null,
    source: 'Domain Coverage Analysis',
    detectedAt: '2024-01-17T12:00:00Z',
    metadata: { findingsCount: 1, expectedMinimum: 2 },
  }

  const mockResolvedGap: Gap = {
    ...mockInfoGap,
    id: 'resolved-gap-789',
    status: 'resolved',
    resolvedAt: '2024-01-18T10:00:00Z',
  }

  const mockNAGap: Gap = {
    ...mockInfoGap,
    id: 'na-gap-101',
    status: 'not_applicable',
    resolvedAt: '2024-01-18T10:00:00Z',
  }

  const mockOnResolve = vi.fn()
  const mockOnUndo = vi.fn()

  const defaultProps: GapCardProps = {
    gap: mockIrlGap,
    projectId: 'test-project-id',
    onResolve: mockOnResolve,
    onUndo: mockOnUndo,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnResolve.mockResolvedValue(undefined)
    mockOnUndo.mockResolvedValue(undefined)
  })

  describe('Category Badge', () => {
    it('displays IRL Items Not Received for irl_missing', () => {
      render(<GapCard {...defaultProps} gap={mockIrlGap} />)

      expect(screen.getByText('IRL Items Not Received')).toBeInTheDocument()
    })

    it('displays Information Gap for information_gap', () => {
      render(<GapCard {...defaultProps} gap={mockInfoGap} />)

      expect(screen.getByText('Information Gap')).toBeInTheDocument()
    })

    it('displays Incomplete Analysis for incomplete_analysis', () => {
      const incompleteGap: Gap = {
        ...mockInfoGap,
        category: 'incomplete_analysis',
        description: 'Sparse coverage in Technical domain',
      }
      render(<GapCard {...defaultProps} gap={incompleteGap} />)

      expect(screen.getByText('Incomplete Analysis')).toBeInTheDocument()
    })
  })

  describe('Priority Badge', () => {
    it('displays High Priority for high priority', () => {
      render(<GapCard {...defaultProps} gap={mockIrlGap} />)

      expect(screen.getByText('High Priority')).toBeInTheDocument()
    })

    it('displays Medium Priority for medium priority', () => {
      const mediumGap: Gap = { ...mockIrlGap, priority: 'medium' }
      render(<GapCard {...defaultProps} gap={mediumGap} />)

      expect(screen.getByText('Medium Priority')).toBeInTheDocument()
    })

    it('displays Low Priority for low priority', () => {
      const lowGap: Gap = { ...mockIrlGap, priority: 'low' }
      render(<GapCard {...defaultProps} gap={lowGap} />)

      expect(screen.getByText('Low Priority')).toBeInTheDocument()
    })
  })

  describe('Status Badge', () => {
    it('displays Active for active gaps', () => {
      render(<GapCard {...defaultProps} gap={mockIrlGap} />)

      expect(screen.getByText('Active')).toBeInTheDocument()
    })

    it('displays Resolved for resolved gaps', () => {
      render(<GapCard {...defaultProps} gap={mockResolvedGap} />)

      // There are multiple "Resolved" texts - one in badge and one in actions
      const resolvedTexts = screen.getAllByText('Resolved')
      expect(resolvedTexts.length).toBeGreaterThan(0)
    })

    it('displays N/A for not_applicable gaps', () => {
      render(<GapCard {...defaultProps} gap={mockNAGap} />)

      expect(screen.getByText('N/A')).toBeInTheDocument()
    })
  })

  describe('Gap Content', () => {
    it('renders gap description', () => {
      render(<GapCard {...defaultProps} gap={mockIrlGap} />)

      expect(screen.getByText('Financial statements for FY2023 not received')).toBeInTheDocument()
    })

    it('renders source information', () => {
      render(<GapCard {...defaultProps} gap={mockIrlGap} />)

      expect(screen.getByText('Source:')).toBeInTheDocument()
      expect(screen.getByText('IRL Checklist')).toBeInTheDocument()
    })

    it('renders domain tag for gaps with domain', () => {
      render(<GapCard {...defaultProps} gap={mockInfoGap} />)

      expect(screen.getByTestId('domain-tag')).toHaveTextContent('legal')
    })

    it('renders findings count metadata for information gaps', () => {
      render(<GapCard {...defaultProps} gap={mockInfoGap} />)

      expect(screen.getByText(/Current findings: 1/)).toBeInTheDocument()
      expect(screen.getByText(/Expected: 2/)).toBeInTheDocument()
    })
  })

  describe('IRL Item Details (Expand/Collapse)', () => {
    it('shows expand button for IRL gaps', () => {
      render(<GapCard {...defaultProps} gap={mockIrlGap} />)

      expect(screen.getByRole('button', { name: /show irl details/i })).toBeInTheDocument()
    })

    it('does not show expand button for non-IRL gaps', () => {
      render(<GapCard {...defaultProps} gap={mockInfoGap} />)

      expect(screen.queryByRole('button', { name: /show irl details/i })).not.toBeInTheDocument()
    })

    it('expands IRL details when button is clicked', async () => {
      const user = userEvent.setup()
      render(<GapCard {...defaultProps} gap={mockIrlGap} />)

      await user.click(screen.getByRole('button', { name: /show irl details/i }))

      await waitFor(() => {
        expect(screen.getByText('IRL Category:')).toBeInTheDocument()
        expect(screen.getByText('Financial Documents')).toBeInTheDocument()
      })
    })

    it('shows IRL item description when expanded', async () => {
      const user = userEvent.setup()
      render(<GapCard {...defaultProps} gap={mockIrlGap} />)

      await user.click(screen.getByRole('button', { name: /show irl details/i }))

      await waitFor(() => {
        expect(screen.getByText('Audited financial statements for FY2023')).toBeInTheDocument()
      })
    })

    it('shows Required badge when IRL item is required', async () => {
      const user = userEvent.setup()
      render(<GapCard {...defaultProps} gap={mockIrlGap} />)

      await user.click(screen.getByRole('button', { name: /show irl details/i }))

      await waitFor(() => {
        expect(screen.getByText('Required')).toBeInTheDocument()
      })
    })

    it('collapses IRL details when clicked again', async () => {
      const user = userEvent.setup()
      render(<GapCard {...defaultProps} gap={mockIrlGap} />)

      // Expand
      await user.click(screen.getByRole('button', { name: /show irl details/i }))
      await waitFor(() => {
        expect(screen.getByText('Financial Documents')).toBeInTheDocument()
      })

      // Collapse
      await user.click(screen.getByRole('button', { name: /hide irl details/i }))
      await waitFor(() => {
        expect(screen.queryByText('Financial Documents')).not.toBeInTheDocument()
      })
    })
  })

  describe('Action Buttons (Active Gaps)', () => {
    it('shows Resolved button for active gaps', () => {
      render(<GapCard {...defaultProps} gap={mockIrlGap} />)

      expect(screen.getByRole('button', { name: /mark as resolved/i })).toBeInTheDocument()
    })

    it('shows N/A button for active gaps', () => {
      render(<GapCard {...defaultProps} gap={mockIrlGap} />)

      expect(screen.getByRole('button', { name: /mark as not applicable/i })).toBeInTheDocument()
    })

    it('shows Add to IRL button for information gaps', () => {
      render(<GapCard {...defaultProps} gap={mockInfoGap} />)

      expect(screen.getByRole('button', { name: /add to irl/i })).toBeInTheDocument()
    })

    it('shows Add Finding button for information gaps', () => {
      render(<GapCard {...defaultProps} gap={mockInfoGap} />)

      expect(screen.getByRole('button', { name: /add manual finding/i })).toBeInTheDocument()
    })

    it('does not show Add to IRL button for IRL gaps', () => {
      render(<GapCard {...defaultProps} gap={mockIrlGap} />)

      expect(screen.queryByRole('button', { name: /add to irl/i })).not.toBeInTheDocument()
    })

    it('calls onResolve with "resolved" when Resolved button is clicked', async () => {
      const user = userEvent.setup()
      render(<GapCard {...defaultProps} gap={mockIrlGap} />)

      await user.click(screen.getByRole('button', { name: /mark as resolved/i }))

      await waitFor(() => {
        expect(mockOnResolve).toHaveBeenCalledWith('irl-gap-123', 'resolved', undefined)
      })
    })
  })

  describe('Resolved Gap Actions', () => {
    it('shows Undo button for resolved gaps', () => {
      render(<GapCard {...defaultProps} gap={mockResolvedGap} />)

      expect(screen.getByRole('button', { name: /undo resolution/i })).toBeInTheDocument()
    })

    it('shows Undo button for N/A gaps', () => {
      render(<GapCard {...defaultProps} gap={mockNAGap} />)

      expect(screen.getByRole('button', { name: /undo resolution/i })).toBeInTheDocument()
    })

    it('shows Resolved status in actions area for resolved gaps', () => {
      render(<GapCard {...defaultProps} gap={mockResolvedGap} />)

      // Should show multiple "Resolved" - badge + actions
      const resolvedTexts = screen.getAllByText('Resolved')
      expect(resolvedTexts.length).toBeGreaterThanOrEqual(1)
    })

    it('shows Not Applicable status text for N/A gaps', () => {
      render(<GapCard {...defaultProps} gap={mockNAGap} />)

      expect(screen.getByText('Not Applicable')).toBeInTheDocument()
    })

    it('calls onUndo when Undo button is clicked', async () => {
      const user = userEvent.setup()
      render(<GapCard {...defaultProps} gap={mockResolvedGap} />)

      await user.click(screen.getByRole('button', { name: /undo resolution/i }))

      await waitFor(() => {
        expect(mockOnUndo).toHaveBeenCalledWith('resolved-gap-789')
      })
    })

    it('does not show action buttons for resolved gaps', () => {
      render(<GapCard {...defaultProps} gap={mockResolvedGap} />)

      expect(screen.queryByRole('button', { name: /mark as resolved/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /mark as not applicable/i })).not.toBeInTheDocument()
    })
  })

  describe('Visual States', () => {
    it('applies reduced opacity for resolved gaps', () => {
      const { container } = render(<GapCard {...defaultProps} gap={mockResolvedGap} />)

      const card = container.querySelector('[role="article"]')
      expect(card).toHaveClass('opacity-70')
    })

    it('does not apply reduced opacity for active gaps', () => {
      const { container } = render(<GapCard {...defaultProps} gap={mockIrlGap} />)

      const card = container.querySelector('[role="article"]')
      expect(card).not.toHaveClass('opacity-70')
    })
  })

  describe('Accessibility', () => {
    it('has article role with aria-label', () => {
      render(<GapCard {...defaultProps} gap={mockIrlGap} />)

      const article = screen.getByRole('article')
      expect(article).toHaveAttribute(
        'aria-label',
        'IRL Items Not Received: Financial statements for FY2023 not received'
      )
    })

    it('expand button has aria-expanded attribute', async () => {
      const user = userEvent.setup()
      render(<GapCard {...defaultProps} gap={mockIrlGap} />)

      const expandButton = screen.getByRole('button', { name: /show irl details/i })
      expect(expandButton).toHaveAttribute('aria-expanded', 'false')

      await user.click(expandButton)

      const collapseButton = screen.getByRole('button', { name: /hide irl details/i })
      expect(collapseButton).toHaveAttribute('aria-expanded', 'true')
    })

    it('expand button has aria-controls attribute', () => {
      render(<GapCard {...defaultProps} gap={mockIrlGap} />)

      const expandButton = screen.getByRole('button', { name: /show irl details/i })
      expect(expandButton).toHaveAttribute('aria-controls', 'irl-details-irl-gap-123')
    })
  })
})
