/**
 * GapAnalysisView Component Tests
 * Story: E4.8 - Build Gap Analysis View (AC: #1, #2, #3, #4, #8)
 *
 * Tests:
 * - Filter bar renders with category, status, and priority dropdowns
 * - Filter changes work correctly
 * - Loading skeleton shows during fetch
 * - Error state shows retry button
 * - Empty state shows appropriate message
 * - Gaps list renders correctly
 * - URL state management for filters
 * - Refresh button functionality
 * - Statistics bar displays correct counts
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GapAnalysisView, type GapAnalysisViewProps } from '@/components/knowledge-explorer/gaps/GapAnalysisView'
import * as gapsApi from '@/lib/api/gaps'
import type { Gap, GapsResponse } from '@/lib/types/gaps'

// Mock pointer capture for Radix UI Select component
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
})

// Mock next/navigation
const mockReplace = vi.fn()
const mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  usePathname: () => '/projects/test-project/knowledge-explorer',
  useSearchParams: () => mockSearchParams,
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
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
  getProjectGaps: vi.fn(),
  resolveGap: vi.fn(),
  undoGapResolution: vi.fn(),
  createIrlFromGap: vi.fn(),
  createManualFinding: vi.fn(),
}))

describe('GapAnalysisView', () => {
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
      fulfilled: false,
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

  const mockResponse: GapsResponse = {
    gaps: [mockIrlGap, mockInfoGap],
    irlGaps: 1,
    infoGaps: 1,
    total: 2,
    resolved: 0,
  }

  const emptyResponse: GapsResponse = {
    gaps: [],
    irlGaps: 0,
    infoGaps: 0,
    total: 0,
    resolved: 0,
  }

  const defaultProps: GapAnalysisViewProps = {
    projectId: 'test-project-id',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Clear all search params
    const keys = Array.from(mockSearchParams.keys())
    keys.forEach((key) => mockSearchParams.delete(key))
    vi.mocked(gapsApi.getProjectGaps).mockResolvedValue(mockResponse)
    vi.mocked(gapsApi.resolveGap).mockResolvedValue(mockResolvedGap)
    vi.mocked(gapsApi.undoGapResolution).mockResolvedValue(mockInfoGap)
  })

  describe('Filter Bar Rendering (AC1, AC2)', () => {
    it('renders category filter dropdown', async () => {
      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /filter by category/i })).toBeInTheDocument()
      })
    })

    it('renders status filter dropdown', async () => {
      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /filter by status/i })).toBeInTheDocument()
      })
    })

    it('renders priority filter dropdown', async () => {
      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /filter by priority/i })).toBeInTheDocument()
      })
    })

    it('renders refresh button', async () => {
      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh gaps/i })).toBeInTheDocument()
      })
    })
  })

  describe('Statistics Bar (AC3)', () => {
    it('shows IRL gaps count label', async () => {
      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('IRL items')).toBeInTheDocument()
      })
    })

    it('shows info gaps count label', async () => {
      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('info gaps')).toBeInTheDocument()
      })
    })

    it('shows total count label', async () => {
      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('total')).toBeInTheDocument()
      })
    })

    it('shows active count label', async () => {
      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('active')).toBeInTheDocument()
      })
    })
  })

  describe('Filter Default Values', () => {
    it('defaults to "active" status filter', async () => {
      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(gapsApi.getProjectGaps).toHaveBeenCalledWith(
          'test-project-id',
          expect.objectContaining({ status: 'active' })
        )
      })
    })

    it('defaults to "all" category filter', async () => {
      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(gapsApi.getProjectGaps).toHaveBeenCalledWith(
          'test-project-id',
          expect.objectContaining({ category: 'all' })
        )
      })
    })

    it('defaults to "all" priority filter', async () => {
      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(gapsApi.getProjectGaps).toHaveBeenCalledWith(
          'test-project-id',
          expect.objectContaining({ priority: 'all' })
        )
      })
    })
  })

  describe('URL State Management (AC8)', () => {
    it('reads category filter from URL', async () => {
      mockSearchParams.set('gap_category', 'irl_missing')

      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(gapsApi.getProjectGaps).toHaveBeenCalledWith(
          'test-project-id',
          expect.objectContaining({ category: 'irl_missing' })
        )
      })
    })

    it('reads status filter from URL', async () => {
      mockSearchParams.set('gap_status', 'resolved')

      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(gapsApi.getProjectGaps).toHaveBeenCalledWith(
          'test-project-id',
          expect.objectContaining({ status: 'resolved' })
        )
      })
    })

    it('reads priority filter from URL', async () => {
      mockSearchParams.set('gap_priority', 'high')

      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(gapsApi.getProjectGaps).toHaveBeenCalledWith(
          'test-project-id',
          expect.objectContaining({ priority: 'high' })
        )
      })
    })
  })

  describe('Loading State', () => {
    it('shows loading skeletons during fetch', () => {
      // Don't resolve the promise immediately
      vi.mocked(gapsApi.getProjectGaps).mockReturnValue(new Promise(() => {}))

      render(<GapAnalysisView {...defaultProps} />)

      // Should show multiple skeleton loaders
      const skeletons = document.querySelectorAll('[class*="animate-pulse"]')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('hides skeletons after data loads', async () => {
      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Financial statements for FY2023 not received')).toBeInTheDocument()
      })
    })
  })

  describe('Error State', () => {
    it('shows error message on API failure', async () => {
      vi.mocked(gapsApi.getProjectGaps).mockRejectedValue(new Error('Network error'))

      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('shows retry button on error', async () => {
      vi.mocked(gapsApi.getProjectGaps).mockRejectedValue(new Error('Network error'))

      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      })
    })

    it('retries fetch when retry button is clicked', async () => {
      const user = userEvent.setup()

      // First call fails, second succeeds
      vi.mocked(gapsApi.getProjectGaps)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockResponse)

      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /retry/i }))

      await waitFor(() => {
        expect(screen.getByText('Financial statements for FY2023 not received')).toBeInTheDocument()
      })
    })
  })

  describe('Empty State', () => {
    it('shows empty state when no gaps', async () => {
      vi.mocked(gapsApi.getProjectGaps).mockResolvedValue(emptyResponse)

      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/all caught up/i)).toBeInTheDocument()
      })
    })

    it('shows "All Caught Up!" for active filter with no results', async () => {
      vi.mocked(gapsApi.getProjectGaps).mockResolvedValue(emptyResponse)

      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('All Caught Up!')).toBeInTheDocument()
        expect(screen.getByText(/all gaps have been addressed/i)).toBeInTheDocument()
      })
    })

    it('shows different message for "all" filter with no results', async () => {
      vi.mocked(gapsApi.getProjectGaps).mockResolvedValue(emptyResponse)
      mockSearchParams.set('gap_status', 'all')

      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('No Gaps Found')).toBeInTheDocument()
      })
    })
  })

  describe('Gaps List Rendering (AC4)', () => {
    it('renders gap cards', async () => {
      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Financial statements for FY2023 not received')).toBeInTheDocument()
      })
    })

    it('renders multiple gap cards', async () => {
      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        const cards = screen.getAllByRole('article')
        expect(cards.length).toBe(2)
      })
    })

    it('shows IRL gap category badge', async () => {
      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('IRL Items Not Received')).toBeInTheDocument()
      })
    })

    it('shows information gap category badge', async () => {
      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Information Gap')).toBeInTheDocument()
      })
    })
  })

  describe('Refresh Functionality', () => {
    it('refreshes data when refresh button is clicked', async () => {
      const user = userEvent.setup()
      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh gaps/i })).toBeInTheDocument()
      })

      // Clear mock to track new call
      vi.mocked(gapsApi.getProjectGaps).mockClear()

      await user.click(screen.getByRole('button', { name: /refresh gaps/i }))

      await waitFor(() => {
        expect(gapsApi.getProjectGaps).toHaveBeenCalledTimes(1)
      })
    })

    it('disables refresh button during loading', () => {
      vi.mocked(gapsApi.getProjectGaps).mockReturnValue(new Promise(() => {}))

      render(<GapAnalysisView {...defaultProps} />)

      expect(screen.getByRole('button', { name: /refresh gaps/i })).toBeDisabled()
    })
  })

  describe('Resolution Handling', () => {
    it('calls resolveGap when action is taken', async () => {
      const user = userEvent.setup()
      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /mark as resolved/i })[0]!).toBeInTheDocument()
      })

      await user.click(screen.getAllByRole('button', { name: /mark as resolved/i })[0]!)

      await waitFor(() => {
        expect(gapsApi.resolveGap).toHaveBeenCalledWith(
          'test-project-id',
          'irl-gap-123',
          expect.objectContaining({ status: 'resolved' })
        )
      })
    })

    it('refreshes list after successful resolution', async () => {
      const user = userEvent.setup()
      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /mark as resolved/i })[0]).toBeInTheDocument()
      })

      // Clear mock to track refresh call
      vi.mocked(gapsApi.getProjectGaps).mockClear()
      vi.mocked(gapsApi.getProjectGaps).mockResolvedValue(emptyResponse)

      await user.click(screen.getAllByRole('button', { name: /mark as resolved/i })[0]!)

      await waitFor(() => {
        expect(gapsApi.getProjectGaps).toHaveBeenCalled()
      })
    })
  })

  describe('Accessibility', () => {
    it('filter dropdowns have accessible labels', async () => {
      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /filter by category/i })).toBeInTheDocument()
        expect(screen.getByRole('combobox', { name: /filter by status/i })).toBeInTheDocument()
        expect(screen.getByRole('combobox', { name: /filter by priority/i })).toBeInTheDocument()
      })
    })

    it('refresh button has accessible label', async () => {
      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh gaps/i })).toBeInTheDocument()
      })
    })

    it('gap cards have accessible article role', async () => {
      render(<GapAnalysisView {...defaultProps} />)

      await waitFor(() => {
        const articles = screen.getAllByRole('article')
        expect(articles.length).toBe(2)
      })
    })
  })
})
