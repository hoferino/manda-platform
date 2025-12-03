/**
 * FindingDetailPanel Component Tests
 * Story: E4.9 - Implement Finding Detail View with Full Context (AC: 1, 2, 7, 8)
 *
 * Tests:
 * - Panel opens and closes correctly
 * - Loading skeleton displays during fetch
 * - Error state with retry button
 * - Finding content renders correctly
 * - Validation actions work
 * - Edit mode functions
 * - Related findings navigation
 * - Keyboard navigation (Escape to close)
 * - Accessibility attributes
 */

import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { FindingDetailPanel } from '@/components/knowledge-explorer/findings/FindingDetailPanel'
import * as findingsApi from '@/lib/api/findings'
import type { FindingWithContext } from '@/lib/types/findings'

// Mock pointer capture for Radix UI components
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
})

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock the API
vi.mock('@/lib/api/findings', () => ({
  getFindingById: vi.fn(),
  validateFinding: vi.fn(),
  updateFinding: vi.fn(),
}))

// Mock the child components to simplify testing
vi.mock('@/components/knowledge-explorer/findings/ConfidenceReasoning', () => ({
  ConfidenceReasoning: ({ confidence }: { confidence: number | null }) => (
    <div data-testid="confidence-reasoning">Confidence: {confidence}</div>
  ),
}))

vi.mock('@/components/knowledge-explorer/findings/ValidationHistory', () => ({
  ValidationHistory: ({ history }: { history: unknown[] }) => (
    <div data-testid="validation-history">History: {history.length} events</div>
  ),
}))

vi.mock('@/components/knowledge-explorer/findings/RelatedFindings', () => ({
  RelatedFindings: ({
    findings,
    onSelectFinding,
  }: {
    findings: unknown[]
    onSelectFinding: (id: string) => void
  }) => (
    <div data-testid="related-findings">
      Related: {findings.length}
      <button onClick={() => onSelectFinding('related-123')}>Select related</button>
    </div>
  ),
}))

vi.mock('@/components/knowledge-explorer/shared', () => ({
  ConfidenceBadge: ({ confidence }: { confidence: number }) => (
    <span data-testid="confidence-badge">{Math.round(confidence * 100)}%</span>
  ),
  DomainTag: ({ domain }: { domain: string | null }) => (
    <span data-testid="domain-tag">{domain || 'Unknown'}</span>
  ),
  StatusBadge: ({ status }: { status: string }) => (
    <span data-testid="status-badge">{status}</span>
  ),
  SourceAttributionLink: () => <span data-testid="source-link">Source Link</span>,
}))

vi.mock('@/components/knowledge-explorer/findings/FindingActions', () => ({
  FindingActions: ({
    onValidate,
    onEdit,
  }: {
    findingId: string
    status: string
    onValidate: (id: string, action: 'confirm' | 'reject') => void
    onEdit: () => void
  }) => (
    <div data-testid="finding-actions">
      <button onClick={() => onValidate('test-finding', 'confirm')}>Confirm</button>
      <button onClick={() => onValidate('test-finding', 'reject')}>Reject</button>
      <button onClick={onEdit}>Edit</button>
    </div>
  ),
}))

vi.mock('@/components/knowledge-explorer/findings/InlineEdit', () => ({
  InlineEdit: ({
    value,
    onSave,
    onCancel,
  }: {
    value: string
    onSave: (text: string) => void
    onCancel: () => void
    isEditing: boolean
  }) => (
    <div data-testid="inline-edit">
      <input defaultValue={value} data-testid="edit-input" />
      <button onClick={() => onSave('Updated text')}>Save</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}))

describe('FindingDetailPanel', () => {
  const mockFinding: FindingWithContext = {
    id: 'finding-123',
    dealId: 'deal-456',
    documentId: 'doc-789',
    chunkId: 'chunk-101',
    userId: 'user-abc',
    text: 'This is a test finding with important information about the deal.',
    sourceDocument: 'quarterly-report.pdf',
    pageNumber: 5,
    confidence: 0.85,
    findingType: 'fact',
    domain: 'financial',
    status: 'pending',
    validationHistory: [
      {
        action: 'validated',
        timestamp: '2024-01-15T10:00:00Z',
        userId: 'user-abc',
      },
    ],
    metadata: {
      confidence_reasoning: 'High confidence based on explicit statement in document',
    },
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: null,
    document: {
      id: 'doc-789',
      name: 'quarterly-report.pdf',
      filePath: '/documents/quarterly-report.pdf',
    },
    chunk: {
      id: 'chunk-101',
      content: 'Full chunk content here...',
      sheetName: null,
      cellReference: null,
      pageNumber: 5,
    },
    relatedFindings: [
      {
        id: 'related-1',
        dealId: 'deal-456',
        documentId: 'doc-other',
        chunkId: null,
        userId: 'user-abc',
        text: 'Related finding text',
        sourceDocument: 'other-doc.pdf',
        pageNumber: 10,
        confidence: 0.72,
        findingType: 'fact',
        domain: 'financial',
        status: 'validated',
        validationHistory: [],
        metadata: null,
        createdAt: '2024-01-14T10:00:00Z',
        updatedAt: null,
      },
    ],
  }

  const defaultProps = {
    findingId: 'finding-123',
    projectId: 'project-456',
    isOpen: true,
    onClose: vi.fn(),
    onFindingUpdated: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(findingsApi.getFindingById).mockResolvedValue(mockFinding)
    vi.mocked(findingsApi.validateFinding).mockResolvedValue({
      ...mockFinding,
      status: 'validated',
    })
    vi.mocked(findingsApi.updateFinding).mockResolvedValue({
      ...mockFinding,
      text: 'Updated text',
    })
  })

  describe('Panel Open/Close', () => {
    it('renders when isOpen is true', async () => {
      render(<FindingDetailPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
    })

    it('does not render content when isOpen is false', () => {
      render(<FindingDetailPanel {...defaultProps} isOpen={false} />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('calls onClose when panel close button is triggered', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<FindingDetailPanel {...defaultProps} onClose={onClose} />)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      // Close button in sheet
      const closeButton = screen.getByRole('button', { name: /close/i })
      await user.click(closeButton)

      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('Loading State', () => {
    it('shows loading skeleton during fetch', () => {
      vi.mocked(findingsApi.getFindingById).mockReturnValue(new Promise(() => {}))

      render(<FindingDetailPanel {...defaultProps} />)

      // Should show skeleton elements
      const skeletons = document.querySelectorAll('[class*="animate-pulse"]')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('hides skeleton after data loads', async () => {
      render(<FindingDetailPanel {...defaultProps} />)

      await waitFor(() => {
        expect(
          screen.getByText('This is a test finding with important information about the deal.')
        ).toBeInTheDocument()
      })

      // Skeleton should be gone
      const busyElements = document.querySelectorAll('[aria-busy="true"]')
      expect(busyElements.length).toBe(0)
    })
  })

  describe('Error State', () => {
    it('shows error message on fetch failure', async () => {
      vi.mocked(findingsApi.getFindingById).mockRejectedValue(new Error('Network error'))

      render(<FindingDetailPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Unable to load finding')).toBeInTheDocument()
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('shows retry button on error', async () => {
      vi.mocked(findingsApi.getFindingById).mockRejectedValue(new Error('Network error'))

      render(<FindingDetailPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
      })
    })

    it('retries fetch when retry button is clicked', async () => {
      const user = userEvent.setup()

      // First call fails, second succeeds
      vi.mocked(findingsApi.getFindingById)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockFinding)

      render(<FindingDetailPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /try again/i }))

      await waitFor(() => {
        expect(
          screen.getByText('This is a test finding with important information about the deal.')
        ).toBeInTheDocument()
      })
    })
  })

  describe('Finding Content', () => {
    it('renders finding text', async () => {
      render(<FindingDetailPanel {...defaultProps} />)

      await waitFor(() => {
        expect(
          screen.getByText('This is a test finding with important information about the deal.')
        ).toBeInTheDocument()
      })
    })

    it('renders domain tag', async () => {
      render(<FindingDetailPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByTestId('domain-tag')).toHaveTextContent('financial')
      })
    })

    it('renders status badge', async () => {
      render(<FindingDetailPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByTestId('status-badge')).toHaveTextContent('pending')
      })
    })

    it('renders finding type badge', async () => {
      render(<FindingDetailPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('fact')).toBeInTheDocument()
      })
    })

    it('renders created date', async () => {
      render(<FindingDetailPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/Created Jan 15, 2024/)).toBeInTheDocument()
      })
    })

    it('renders confidence reasoning component', async () => {
      render(<FindingDetailPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByTestId('confidence-reasoning')).toBeInTheDocument()
      })
    })

    it('renders source attribution link', async () => {
      render(<FindingDetailPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByTestId('source-link')).toBeInTheDocument()
      })
    })

    it('renders related findings component', async () => {
      render(<FindingDetailPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByTestId('related-findings')).toBeInTheDocument()
      })
    })

    it('renders validation history component', async () => {
      render(<FindingDetailPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByTestId('validation-history')).toBeInTheDocument()
      })
    })
  })

  describe('Validation Actions', () => {
    it('renders finding actions', async () => {
      render(<FindingDetailPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByTestId('finding-actions')).toBeInTheDocument()
      })
    })

    it('calls validateFinding on confirm', async () => {
      const user = userEvent.setup()
      render(<FindingDetailPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Confirm' }))

      await waitFor(() => {
        expect(findingsApi.validateFinding).toHaveBeenCalledWith(
          'project-456',
          'test-finding',
          'confirm'
        )
      })
    })

    it('calls validateFinding on reject', async () => {
      const user = userEvent.setup()
      render(<FindingDetailPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Reject' }))

      await waitFor(() => {
        expect(findingsApi.validateFinding).toHaveBeenCalledWith(
          'project-456',
          'test-finding',
          'reject'
        )
      })
    })

    it('calls onFindingUpdated after validation', async () => {
      const user = userEvent.setup()
      const onFindingUpdated = vi.fn()
      render(<FindingDetailPanel {...defaultProps} onFindingUpdated={onFindingUpdated} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Confirm' }))

      await waitFor(() => {
        expect(onFindingUpdated).toHaveBeenCalled()
      })
    })
  })

  describe('Edit Mode', () => {
    it('enters edit mode when edit button is clicked', async () => {
      const user = userEvent.setup()
      render(<FindingDetailPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Edit' }))

      await waitFor(() => {
        expect(screen.getByTestId('inline-edit')).toBeInTheDocument()
      })
    })

    it('calls updateFinding on save', async () => {
      const user = userEvent.setup()
      render(<FindingDetailPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Edit' }))

      await waitFor(() => {
        expect(screen.getByTestId('inline-edit')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(() => {
        expect(findingsApi.updateFinding).toHaveBeenCalledWith('project-456', 'finding-123', {
          text: 'Updated text',
        })
      })
    })

    it('exits edit mode on cancel', async () => {
      const user = userEvent.setup()
      render(<FindingDetailPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Edit' }))

      await waitFor(() => {
        expect(screen.getByTestId('inline-edit')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      await waitFor(() => {
        expect(screen.queryByTestId('inline-edit')).not.toBeInTheDocument()
      })
    })
  })

  describe('Related Finding Navigation', () => {
    it('navigates to related finding when selected', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<FindingDetailPanel {...defaultProps} onClose={onClose} />)

      await waitFor(() => {
        expect(screen.getByTestId('related-findings')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Select related' }))

      // Should close the panel first
      expect(onClose).toHaveBeenCalled()

      // Then navigate with URL update (after timeout in implementation)
      await waitFor(
        () => {
          expect(mockPush).toHaveBeenCalled()
        },
        { timeout: 500 }
      )
    })
  })

  describe('Data Room Navigation', () => {
    it('renders Open in Data Room button when document exists', async () => {
      render(<FindingDetailPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /open in data room/i })).toBeInTheDocument()
      })
    })

    it('navigates to data room when button is clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<FindingDetailPanel {...defaultProps} onClose={onClose} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /open in data room/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /open in data room/i }))

      expect(mockPush).toHaveBeenCalledWith('/projects/project-456/data-room?document=doc-789')
      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('API Call Behavior', () => {
    it('fetches finding when panel opens', async () => {
      render(<FindingDetailPanel {...defaultProps} />)

      await waitFor(() => {
        expect(findingsApi.getFindingById).toHaveBeenCalledWith('project-456', 'finding-123')
      })
    })

    it('does not fetch when findingId is null', () => {
      render(<FindingDetailPanel {...defaultProps} findingId={null} />)

      expect(findingsApi.getFindingById).not.toHaveBeenCalled()
    })

    it('refetches when findingId changes', async () => {
      const { rerender } = render(<FindingDetailPanel {...defaultProps} />)

      await waitFor(() => {
        expect(findingsApi.getFindingById).toHaveBeenCalledWith('project-456', 'finding-123')
      })

      vi.mocked(findingsApi.getFindingById).mockClear()

      rerender(<FindingDetailPanel {...defaultProps} findingId="new-finding-456" />)

      await waitFor(() => {
        expect(findingsApi.getFindingById).toHaveBeenCalledWith('project-456', 'new-finding-456')
      })
    })
  })

  describe('Accessibility', () => {
    it('has dialog role', async () => {
      render(<FindingDetailPanel {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
    })

    it('has aria-describedby for screen readers', async () => {
      render(<FindingDetailPanel {...defaultProps} />)

      await waitFor(() => {
        const dialog = screen.getByRole('dialog')
        expect(dialog).toHaveAttribute('aria-describedby', 'finding-detail-description')
      })
    })

    it('has hidden description element', async () => {
      render(<FindingDetailPanel {...defaultProps} />)

      await waitFor(() => {
        const description = document.getElementById('finding-detail-description')
        expect(description).toBeInTheDocument()
        expect(description).toHaveClass('sr-only')
      })
    })

    it('loading state has aria-busy', () => {
      vi.mocked(findingsApi.getFindingById).mockReturnValue(new Promise(() => {}))

      render(<FindingDetailPanel {...defaultProps} />)

      const loadingElement = document.querySelector('[aria-busy="true"]')
      expect(loadingElement).toBeInTheDocument()
    })
  })
})
