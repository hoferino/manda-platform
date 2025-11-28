/**
 * FindingsTable Component Tests
 * Story: E4.1 - Build Knowledge Explorer UI Main Interface (AC: #9)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { FindingsTable } from '@/components/knowledge-explorer/findings/FindingsTable'
import type { Finding } from '@/lib/types/findings'

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  ChevronLeft: () => <span data-testid="icon-chevron-left" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  ChevronsLeft: () => <span data-testid="icon-chevrons-left" />,
  ChevronsRight: () => <span data-testid="icon-chevrons-right" />,
  ArrowUpDown: () => <span data-testid="icon-arrow-updown" />,
  ArrowUp: () => <span data-testid="icon-arrow-up" />,
  ArrowDown: () => <span data-testid="icon-arrow-down" />,
  FileText: () => <span data-testid="icon-file-text" />,
  Check: () => <span data-testid="icon-check" />,
  X: () => <span data-testid="icon-x" />,
  Pencil: () => <span data-testid="icon-pencil" />,
  CheckCircle2: () => <span data-testid="icon-check-circle" />,
  AlertCircle: () => <span data-testid="icon-alert-circle" />,
  HelpCircle: () => <span data-testid="icon-help-circle" />,
  DollarSign: () => <span data-testid="icon-dollar" />,
  Settings: () => <span data-testid="icon-settings" />,
  TrendingUp: () => <span data-testid="icon-trending-up" />,
  Scale: () => <span data-testid="icon-scale" />,
  Cpu: () => <span data-testid="icon-cpu" />,
  Clock: () => <span data-testid="icon-clock" />,
  CheckCircle: () => <span data-testid="icon-check-circle-status" />,
  XCircle: () => <span data-testid="icon-x-circle" />,
}))

// Sample test data
const mockFindings: Finding[] = [
  {
    id: '1',
    dealId: 'deal-1',
    documentId: 'doc-1',
    chunkId: 'chunk-1',
    userId: 'user-1',
    text: 'Revenue increased by 15% year over year',
    sourceDocument: 'annual_report.pdf',
    pageNumber: 42,
    confidence: 0.92,
    findingType: 'metric',
    domain: 'financial',
    status: 'pending',
    validationHistory: [],
    metadata: null,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: null,
  },
  {
    id: '2',
    dealId: 'deal-1',
    documentId: 'doc-2',
    chunkId: 'chunk-2',
    userId: 'user-1',
    text: 'Company operates in 5 different markets across EMEA',
    sourceDocument: 'company_profile.docx',
    pageNumber: 8,
    confidence: 0.78,
    findingType: 'fact',
    domain: 'market',
    status: 'validated',
    validationHistory: [],
    metadata: null,
    createdAt: '2024-01-14T09:00:00Z',
    updatedAt: null,
  },
  {
    id: '3',
    dealId: 'deal-1',
    documentId: null,
    chunkId: null,
    userId: 'user-1',
    text: 'Potential regulatory risk in key markets',
    sourceDocument: null,
    pageNumber: null,
    confidence: 0.65,
    findingType: 'risk',
    domain: 'legal',
    status: 'rejected',
    validationHistory: [],
    metadata: null,
    createdAt: '2024-01-13T08:00:00Z',
    updatedAt: null,
  },
]

const defaultProps = {
  findings: mockFindings,
  isLoading: false,
  page: 1,
  totalPages: 3,
  total: 150,
  sortBy: 'createdAt',
  sortOrder: 'desc' as const,
  onPageChange: vi.fn(),
  onSortChange: vi.fn(),
  onValidate: vi.fn(),
  onEdit: vi.fn(),
}

describe('FindingsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders the table with findings', () => {
      render(<FindingsTable {...defaultProps} />)

      // Check table headers are present
      expect(screen.getByText('Finding')).toBeInTheDocument()
      expect(screen.getByText('Source')).toBeInTheDocument()

      // Check finding content is rendered
      expect(screen.getByText(/Revenue increased by 15%/)).toBeInTheDocument()
      expect(screen.getByText(/Company operates in 5 different markets/)).toBeInTheDocument()
    })

    it('renders loading skeleton when isLoading is true', () => {
      render(<FindingsTable {...defaultProps} isLoading={true} />)

      // Should not show actual data
      expect(screen.queryByText(/Revenue increased/)).not.toBeInTheDocument()
    })

    it('renders empty state when no findings', () => {
      render(<FindingsTable {...defaultProps} findings={[]} />)

      expect(screen.getByText('No findings found')).toBeInTheDocument()
      expect(screen.getByText(/No findings match your current filters/)).toBeInTheDocument()
    })

    it('displays source document with page number', () => {
      render(<FindingsTable {...defaultProps} />)

      expect(screen.getByText('annual_report.pdf')).toBeInTheDocument()
      expect(screen.getByText('p.42')).toBeInTheDocument()
    })

    it('shows dash for findings without source', () => {
      render(<FindingsTable {...defaultProps} />)

      // The finding without source should show a dash
      const dashElements = screen.getAllByText('—')
      expect(dashElements.length).toBeGreaterThan(0)
    })
  })

  describe('Pagination', () => {
    it('displays correct pagination info', () => {
      render(<FindingsTable {...defaultProps} />)

      expect(screen.getByText('Page 1 of 3 (150 findings)')).toBeInTheDocument()
    })

    it('calls onPageChange when next page button is clicked', () => {
      render(<FindingsTable {...defaultProps} />)

      const nextButton = screen.getByLabelText('Go to next page')
      fireEvent.click(nextButton)

      expect(defaultProps.onPageChange).toHaveBeenCalledWith(2)
    })

    it('calls onPageChange when previous page button is clicked', () => {
      render(<FindingsTable {...defaultProps} page={2} />)

      const prevButton = screen.getByLabelText('Go to previous page')
      fireEvent.click(prevButton)

      expect(defaultProps.onPageChange).toHaveBeenCalledWith(1)
    })

    it('disables previous button on first page', () => {
      render(<FindingsTable {...defaultProps} page={1} />)

      const prevButton = screen.getByLabelText('Go to previous page')
      expect(prevButton).toBeDisabled()
    })

    it('disables next button on last page', () => {
      render(<FindingsTable {...defaultProps} page={3} />)

      const nextButton = screen.getByLabelText('Go to next page')
      expect(nextButton).toBeDisabled()
    })

    it('goes to first page when first page button is clicked', () => {
      render(<FindingsTable {...defaultProps} page={2} />)

      const firstButton = screen.getByLabelText('Go to first page')
      fireEvent.click(firstButton)

      expect(defaultProps.onPageChange).toHaveBeenCalledWith(1)
    })

    it('goes to last page when last page button is clicked', () => {
      render(<FindingsTable {...defaultProps} />)

      const lastButton = screen.getByLabelText('Go to last page')
      fireEvent.click(lastButton)

      expect(defaultProps.onPageChange).toHaveBeenCalledWith(3)
    })
  })

  describe('Sorting', () => {
    it('calls onSortChange when confidence header is clicked', () => {
      render(<FindingsTable {...defaultProps} />)

      const confidenceButton = screen.getByRole('button', { name: /Confidence/i })
      fireEvent.click(confidenceButton)

      expect(defaultProps.onSortChange).toHaveBeenCalledWith('confidence', 'desc')
    })

    it('calls onSortChange when domain header is clicked', () => {
      render(<FindingsTable {...defaultProps} />)

      const domainButton = screen.getByRole('button', { name: /Domain/i })
      fireEvent.click(domainButton)

      expect(defaultProps.onSortChange).toHaveBeenCalledWith('domain', 'desc')
    })

    it('toggles sort order when clicking same column', () => {
      render(<FindingsTable {...defaultProps} sortBy="confidence" sortOrder="desc" />)

      const confidenceButton = screen.getByRole('button', { name: /Confidence/i })
      fireEvent.click(confidenceButton)

      expect(defaultProps.onSortChange).toHaveBeenCalledWith('confidence', 'asc')
    })
  })

  describe('Actions', () => {
    it('calls onValidate with confirm when validate button is clicked', () => {
      render(<FindingsTable {...defaultProps} />)

      const validateButtons = screen.getAllByLabelText('Validate finding')
      fireEvent.click(validateButtons[0]!)

      expect(defaultProps.onValidate).toHaveBeenCalledWith('1', 'confirm')
    })

    it('calls onValidate with reject when reject button is clicked', () => {
      render(<FindingsTable {...defaultProps} />)

      const rejectButtons = screen.getAllByLabelText('Reject finding')
      fireEvent.click(rejectButtons[0]!)

      expect(defaultProps.onValidate).toHaveBeenCalledWith('1', 'reject')
    })

    it('calls onEdit when edit button is clicked', () => {
      render(<FindingsTable {...defaultProps} />)

      const editButtons = screen.getAllByLabelText('Edit finding')
      fireEvent.click(editButtons[0]!)

      expect(defaultProps.onEdit).toHaveBeenCalledWith(mockFindings[0])
    })

    it('disables validate button for validated findings', () => {
      render(<FindingsTable {...defaultProps} />)

      // Find the row with validated status (second finding)
      const rows = screen.getAllByRole('row')
      // First row is header, second row is first finding, third is validated
      const validatedRow = rows[2]!
      const validateButton = within(validatedRow).getByLabelText('Validate finding')

      expect(validateButton).toBeDisabled()
    })

    it('disables reject button for rejected findings', () => {
      render(<FindingsTable {...defaultProps} />)

      // Find the row with rejected status (third finding)
      const rows = screen.getAllByRole('row')
      // First row is header, fourth row is rejected finding
      const rejectedRow = rows[3]!
      const rejectButton = within(rejectedRow).getByLabelText('Reject finding')

      expect(rejectButton).toBeDisabled()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels for pagination buttons', () => {
      render(<FindingsTable {...defaultProps} />)

      expect(screen.getByLabelText('Go to first page')).toBeInTheDocument()
      expect(screen.getByLabelText('Go to previous page')).toBeInTheDocument()
      expect(screen.getByLabelText('Go to next page')).toBeInTheDocument()
      expect(screen.getByLabelText('Go to last page')).toBeInTheDocument()
    })

    it('has proper ARIA labels for action buttons', () => {
      render(<FindingsTable {...defaultProps} />)

      expect(screen.getAllByLabelText('Validate finding').length).toBe(3)
      expect(screen.getAllByLabelText('Reject finding').length).toBe(3)
      expect(screen.getAllByLabelText('Edit finding').length).toBe(3)
    })
  })
})
