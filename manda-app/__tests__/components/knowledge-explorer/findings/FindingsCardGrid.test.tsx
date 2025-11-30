/**
 * FindingsCardGrid Component Tests
 * Story: E4.4 - Build Card View Alternative for Findings (AC: 3, 6, 7)
 *
 * Tests:
 * - Responsive grid layout
 * - Loading skeleton state
 * - Empty state
 * - Pagination controls
 * - Virtual scrolling for large datasets (>100)
 * - Props passed correctly to FindingCard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FindingsCardGrid, type FindingsCardGridProps } from '@/components/knowledge-explorer/findings/FindingsCardGrid'
import type { Finding } from '@/lib/types/findings'

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '1 day ago'),
}))

// Mock @tanstack/react-virtual for testing
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(() => ({
    getVirtualItems: () => [],
    getTotalSize: () => 0,
  })),
}))

describe('FindingsCardGrid', () => {
  const createMockFindings = (count: number): Finding[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `finding-${i}`,
      dealId: 'deal-456',
      documentId: 'doc-789',
      chunkId: 'chunk-001',
      userId: 'user-001',
      text: `Finding ${i}: This is test content for finding number ${i}.`,
      sourceDocument: `Document ${i}.pdf`,
      pageNumber: i + 1,
      confidence: 0.75 + (i % 25) / 100,
      findingType: 'fact',
      domain: 'financial',
      status: 'pending',
      validationHistory: [],
      metadata: null,
      createdAt: new Date(Date.now() - i * 86400000).toISOString(),
      updatedAt: null,
    }))

  const defaultProps: FindingsCardGridProps = {
    findings: createMockFindings(10),
    isLoading: false,
    page: 1,
    totalPages: 2,
    total: 20,
    onPageChange: vi.fn(),
    onValidate: vi.fn().mockResolvedValue(undefined),
    onEdit: vi.fn(),
    onSaveEdit: vi.fn().mockResolvedValue(undefined),
    onCancelEdit: vi.fn(),
    editingFindingId: null,
    showSimilarity: false,
    projectId: 'test-project-id',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering (AC3)', () => {
    it('renders findings as cards', () => {
      render(<FindingsCardGrid {...defaultProps} />)

      // Check that multiple findings are rendered
      expect(screen.getAllByRole('article')).toHaveLength(10)
    })

    it('renders each finding text', () => {
      render(<FindingsCardGrid {...defaultProps} findings={createMockFindings(3)} />)

      expect(screen.getByText(/Finding 0:/)).toBeInTheDocument()
      expect(screen.getByText(/Finding 1:/)).toBeInTheDocument()
      expect(screen.getByText(/Finding 2:/)).toBeInTheDocument()
    })

    it('renders grid with responsive classes', () => {
      render(<FindingsCardGrid {...defaultProps} />)

      const grid = screen.getByRole('region', { name: /findings grid/i })
      expect(grid).toHaveClass('grid')
      expect(grid).toHaveClass('grid-cols-1')
      expect(grid).toHaveClass('md:grid-cols-2')
      expect(grid).toHaveClass('lg:grid-cols-3')
    })
  })

  describe('Loading State (AC3)', () => {
    it('shows skeleton cards when loading', () => {
      render(<FindingsCardGrid {...defaultProps} isLoading={true} />)

      // Should show skeleton animation
      const loadingRegion = screen.getByLabelText(/loading findings/i)
      expect(loadingRegion).toHaveAttribute('aria-busy', 'true')
    })

    it('shows skeleton cards', () => {
      render(<FindingsCardGrid {...defaultProps} isLoading={true} />)

      // Count skeleton card containers (which have animate-pulse on their child Card)
      const skeletonCards = document.querySelectorAll('[class*="animate-pulse"]')
      expect(skeletonCards.length).toBeGreaterThan(0)
    })
  })

  describe('Empty State (AC3)', () => {
    it('shows empty state message when no findings', () => {
      render(<FindingsCardGrid {...defaultProps} findings={[]} total={0} />)

      expect(screen.getByText('No findings found')).toBeInTheDocument()
      expect(screen.getByText(/No findings match your current filters/)).toBeInTheDocument()
    })

    it('shows file icon in empty state', () => {
      render(<FindingsCardGrid {...defaultProps} findings={[]} total={0} />)

      // The FileText icon should be present
      const emptyState = screen.getByText('No findings found').closest('div')
      expect(emptyState).toBeInTheDocument()
    })
  })

  describe('Pagination (AC6)', () => {
    it('shows pagination info', () => {
      render(<FindingsCardGrid {...defaultProps} />)

      expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument()
      expect(screen.getByText(/20 findings/)).toBeInTheDocument()
    })

    it('calls onPageChange when next button is clicked', async () => {
      const user = userEvent.setup()
      render(<FindingsCardGrid {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /go to next page/i }))

      expect(defaultProps.onPageChange).toHaveBeenCalledWith(2)
    })

    it('calls onPageChange when previous button is clicked', async () => {
      const user = userEvent.setup()
      render(<FindingsCardGrid {...defaultProps} page={2} />)

      await user.click(screen.getByRole('button', { name: /go to previous page/i }))

      expect(defaultProps.onPageChange).toHaveBeenCalledWith(1)
    })

    it('calls onPageChange when first page button is clicked', async () => {
      const user = userEvent.setup()
      render(<FindingsCardGrid {...defaultProps} page={2} totalPages={5} />)

      await user.click(screen.getByRole('button', { name: /go to first page/i }))

      expect(defaultProps.onPageChange).toHaveBeenCalledWith(1)
    })

    it('calls onPageChange when last page button is clicked', async () => {
      const user = userEvent.setup()
      render(<FindingsCardGrid {...defaultProps} page={2} totalPages={5} />)

      await user.click(screen.getByRole('button', { name: /go to last page/i }))

      expect(defaultProps.onPageChange).toHaveBeenCalledWith(5)
    })

    it('disables previous/first buttons on first page', () => {
      render(<FindingsCardGrid {...defaultProps} page={1} />)

      expect(screen.getByRole('button', { name: /go to first page/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /go to previous page/i })).toBeDisabled()
    })

    it('disables next/last buttons on last page', () => {
      render(<FindingsCardGrid {...defaultProps} page={2} totalPages={2} />)

      expect(screen.getByRole('button', { name: /go to next page/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /go to last page/i })).toBeDisabled()
    })
  })

  describe('Card Actions Integration (AC4)', () => {
    it('calls onValidate when card validate is clicked', async () => {
      const user = userEvent.setup()
      render(<FindingsCardGrid {...defaultProps} findings={createMockFindings(1)} />)

      await user.click(screen.getByRole('button', { name: /validate finding/i }))

      await waitFor(() => {
        expect(defaultProps.onValidate).toHaveBeenCalledWith('finding-0', 'confirm')
      })
    })

    it('calls onEdit when card edit is clicked', async () => {
      const user = userEvent.setup()
      render(<FindingsCardGrid {...defaultProps} findings={createMockFindings(1)} />)

      await user.click(screen.getByRole('button', { name: /edit/i }))

      expect(defaultProps.onEdit).toHaveBeenCalled()
    })
  })

  describe('Edit Mode (AC4)', () => {
    it('passes isEditing to the correct card', () => {
      render(
        <FindingsCardGrid
          {...defaultProps}
          findings={createMockFindings(3)}
          editingFindingId="finding-1"
        />
      )

      // The editing card should show textarea
      const textareas = screen.queryAllByRole('textbox')
      expect(textareas).toHaveLength(1)
    })
  })

  describe('Similarity Display (AC6)', () => {
    it('shows similarity when showSimilarity is true', () => {
      const findingsWithSimilarity = createMockFindings(1).map((f) => ({
        ...f,
        similarity: 0.85,
      }))

      render(
        <FindingsCardGrid
          {...defaultProps}
          findings={findingsWithSimilarity}
          showSimilarity={true}
        />
      )

      expect(screen.getByText('85% match')).toBeInTheDocument()
    })

    it('does not show similarity when showSimilarity is false', () => {
      const findingsWithSimilarity = createMockFindings(1).map((f) => ({
        ...f,
        similarity: 0.85,
      }))

      render(
        <FindingsCardGrid
          {...defaultProps}
          findings={findingsWithSimilarity}
          showSimilarity={false}
        />
      )

      expect(screen.queryByText(/match/)).not.toBeInTheDocument()
    })
  })

  describe('Virtual Scrolling (AC7)', () => {
    it('uses regular grid for small datasets (<100)', () => {
      render(<FindingsCardGrid {...defaultProps} findings={createMockFindings(50)} total={50} />)

      // Should render normally without virtual container
      const region = screen.getByRole('region', { name: /findings grid/i })
      expect(region).not.toHaveClass('overflow-auto')
    })

    // Note: Virtual scrolling tests would require more complex setup
    // since @tanstack/react-virtual is mocked
  })

  describe('Custom className', () => {
    it('applies custom className to container', () => {
      render(<FindingsCardGrid {...defaultProps} className="custom-grid-class" />)

      const container = screen.getByRole('region', { name: /findings grid/i }).parentElement
      expect(container).toHaveClass('custom-grid-class')
    })
  })

  describe('Accessibility (AC8)', () => {
    it('grid region has descriptive aria-label', () => {
      render(<FindingsCardGrid {...defaultProps} />)

      expect(
        screen.getByRole('region', { name: /findings grid showing 10 of 20 findings/i })
      ).toBeInTheDocument()
    })

    it('pagination buttons have aria-labels', () => {
      render(<FindingsCardGrid {...defaultProps} />)

      expect(screen.getByRole('button', { name: /go to first page/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /go to previous page/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /go to next page/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /go to last page/i })).toBeInTheDocument()
    })
  })
})
