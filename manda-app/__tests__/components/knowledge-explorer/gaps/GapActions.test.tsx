/**
 * GapActions Component Tests
 * Story: E4.8 - Build Gap Analysis View (AC: #5, #6, #7)
 *
 * Tests:
 * - Mark Resolved button works
 * - Mark N/A button opens dialog
 * - Add to IRL button shows for info gaps
 * - Add Finding button opens dialog
 * - Undo button shows for resolved gaps
 * - Loading states during actions
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GapActions, type GapActionsProps } from '@/components/knowledge-explorer/gaps/GapActions'
import * as gapsApi from '@/lib/api/gaps'
import type { Gap } from '@/lib/types/gaps'
import { toast } from 'sonner'

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

// Mock the API
vi.mock('@/lib/api/gaps', () => ({
  createIrlFromGap: vi.fn(),
  createManualFinding: vi.fn(),
}))

describe('GapActions', () => {
  const mockActiveGap: Gap = {
    id: 'gap-123',
    dealId: 'deal-456',
    category: 'irl_missing',
    description: 'Financial statements not received',
    priority: 'high',
    status: 'active',
    domain: 'financial',
    relatedIrlItemId: null,
    relatedIrlItem: null,
    source: 'IRL Checklist',
    detectedAt: '2024-01-17T12:00:00Z',
    metadata: null,
  }

  const mockInfoGap: Gap = {
    ...mockActiveGap,
    id: 'info-gap-456',
    category: 'information_gap',
    description: 'Sparse coverage in Legal domain',
    domain: 'legal',
    source: 'Domain Coverage Analysis',
  }

  const mockResolvedGap: Gap = {
    ...mockActiveGap,
    id: 'resolved-gap-789',
    status: 'resolved',
    resolvedAt: '2024-01-18T10:00:00Z',
  }

  const mockNAGap: Gap = {
    ...mockActiveGap,
    id: 'na-gap-101',
    status: 'not_applicable',
    resolvedAt: '2024-01-18T10:00:00Z',
  }

  const mockOnResolve = vi.fn()
  const mockOnUndo = vi.fn()

  const defaultProps: GapActionsProps = {
    gap: mockActiveGap,
    projectId: 'test-project-id',
    onResolve: mockOnResolve,
    onUndo: mockOnUndo,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnResolve.mockResolvedValue(undefined)
    mockOnUndo.mockResolvedValue(undefined)
    vi.mocked(gapsApi.createManualFinding).mockResolvedValue({} as never)
  })

  describe('Active Gap Buttons', () => {
    it('renders Mark Resolved button', () => {
      render(<GapActions {...defaultProps} />)

      expect(screen.getByRole('button', { name: /mark as resolved/i })).toBeInTheDocument()
    })

    it('renders Mark N/A button', () => {
      render(<GapActions {...defaultProps} />)

      expect(screen.getByRole('button', { name: /mark as not applicable/i })).toBeInTheDocument()
    })

    it('calls onResolve with "resolved" when Mark Resolved is clicked', async () => {
      const user = userEvent.setup()
      render(<GapActions {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /mark as resolved/i }))

      await waitFor(() => {
        expect(mockOnResolve).toHaveBeenCalledWith('resolved')
      })
    })
  })

  describe('Information Gap Buttons', () => {
    it('renders Add to IRL button for information gaps', () => {
      render(<GapActions {...defaultProps} gap={mockInfoGap} />)

      expect(screen.getByRole('button', { name: /add to irl/i })).toBeInTheDocument()
    })

    it('renders Add Finding button for information gaps', () => {
      render(<GapActions {...defaultProps} gap={mockInfoGap} />)

      expect(screen.getByRole('button', { name: /add manual finding/i })).toBeInTheDocument()
    })

    it('does not render Add to IRL button for IRL gaps', () => {
      render(<GapActions {...defaultProps} gap={mockActiveGap} />)

      expect(screen.queryByRole('button', { name: /add to irl/i })).not.toBeInTheDocument()
    })

    it('does not render Add Finding button for IRL gaps', () => {
      render(<GapActions {...defaultProps} gap={mockActiveGap} />)

      expect(screen.queryByRole('button', { name: /add manual finding/i })).not.toBeInTheDocument()
    })
  })

  describe('Mark N/A Dialog', () => {
    it('opens dialog when N/A button is clicked', async () => {
      const user = userEvent.setup()
      render(<GapActions {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /mark as not applicable/i }))

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText('Mark as Not Applicable')).toBeInTheDocument()
      })
    })

    it('shows reason textarea in dialog', async () => {
      const user = userEvent.setup()
      render(<GapActions {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /mark as not applicable/i }))

      await waitFor(() => {
        expect(screen.getByLabelText(/reason/i)).toBeInTheDocument()
      })
    })

    it('calls onResolve with note when submitted', async () => {
      const user = userEvent.setup()
      render(<GapActions {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /mark as not applicable/i }))

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      await user.type(screen.getByLabelText(/reason/i), 'Not relevant to this deal')
      await user.click(screen.getByRole('button', { name: /^mark as n\/a$/i }))

      await waitFor(() => {
        expect(mockOnResolve).toHaveBeenCalledWith('not_applicable', 'Not relevant to this deal')
      })
    })

    it('closes dialog when Cancel is clicked', async () => {
      const user = userEvent.setup()
      render(<GapActions {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /mark as not applicable/i }))

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /cancel/i }))

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })
  })

  describe('Add Finding Dialog', () => {
    it('opens dialog when Add Finding is clicked', async () => {
      const user = userEvent.setup()
      render(<GapActions {...defaultProps} gap={mockInfoGap} />)

      await user.click(screen.getByRole('button', { name: /add manual finding/i }))

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText('Add Manual Finding')).toBeInTheDocument()
      })
    })

    it('shows finding text textarea', async () => {
      const user = userEvent.setup()
      render(<GapActions {...defaultProps} gap={mockInfoGap} />)

      await user.click(screen.getByRole('button', { name: /add manual finding/i }))

      await waitFor(() => {
        expect(screen.getByLabelText(/finding text/i)).toBeInTheDocument()
      })
    })

    it('shows domain select', async () => {
      const user = userEvent.setup()
      render(<GapActions {...defaultProps} gap={mockInfoGap} />)

      await user.click(screen.getByRole('button', { name: /add manual finding/i }))

      await waitFor(() => {
        expect(screen.getByLabelText(/domain/i)).toBeInTheDocument()
      })
    })

    it('shows source notes input', async () => {
      const user = userEvent.setup()
      render(<GapActions {...defaultProps} gap={mockInfoGap} />)

      await user.click(screen.getByRole('button', { name: /add manual finding/i }))

      await waitFor(() => {
        expect(screen.getByLabelText(/source notes/i)).toBeInTheDocument()
      })
    })

    it('calls API and shows success toast when submitted', async () => {
      const user = userEvent.setup()
      render(<GapActions {...defaultProps} gap={mockInfoGap} />)

      await user.click(screen.getByRole('button', { name: /add manual finding/i }))

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      await user.type(screen.getByLabelText(/finding text/i), 'Legal compliance verified')
      await user.click(screen.getByRole('button', { name: /create finding/i }))

      await waitFor(() => {
        expect(gapsApi.createManualFinding).toHaveBeenCalledWith(
          'test-project-id',
          'info-gap-456',
          expect.objectContaining({
            text: 'Legal compliance verified',
            domain: 'legal',
          })
        )
        expect(toast.success).toHaveBeenCalledWith('Manual finding created')
      })
    })

    it('disables Create Finding button when text is empty', async () => {
      const user = userEvent.setup()
      render(<GapActions {...defaultProps} gap={mockInfoGap} />)

      await user.click(screen.getByRole('button', { name: /add manual finding/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create finding/i })).toBeDisabled()
      })
    })
  })

  describe('Resolved Gap Actions', () => {
    it('shows Undo button for resolved gaps', () => {
      render(<GapActions {...defaultProps} gap={mockResolvedGap} />)

      expect(screen.getByRole('button', { name: /undo resolution/i })).toBeInTheDocument()
    })

    it('shows Undo button for N/A gaps', () => {
      render(<GapActions {...defaultProps} gap={mockNAGap} />)

      expect(screen.getByRole('button', { name: /undo resolution/i })).toBeInTheDocument()
    })

    it('shows Resolved text for resolved gaps', () => {
      render(<GapActions {...defaultProps} gap={mockResolvedGap} />)

      expect(screen.getByText('Resolved')).toBeInTheDocument()
    })

    it('shows Not Applicable text for N/A gaps', () => {
      render(<GapActions {...defaultProps} gap={mockNAGap} />)

      expect(screen.getByText('Not Applicable')).toBeInTheDocument()
    })

    it('does not show Mark Resolved button for resolved gaps', () => {
      render(<GapActions {...defaultProps} gap={mockResolvedGap} />)

      expect(screen.queryByRole('button', { name: /mark as resolved/i })).not.toBeInTheDocument()
    })

    it('does not show Mark N/A button for resolved gaps', () => {
      render(<GapActions {...defaultProps} gap={mockResolvedGap} />)

      expect(screen.queryByRole('button', { name: /mark as not applicable/i })).not.toBeInTheDocument()
    })

    it('calls onUndo when Undo button is clicked', async () => {
      const user = userEvent.setup()
      render(<GapActions {...defaultProps} gap={mockResolvedGap} />)

      await user.click(screen.getByRole('button', { name: /undo resolution/i }))

      await waitFor(() => {
        expect(mockOnUndo).toHaveBeenCalled()
      })
    })
  })

  describe('Loading States', () => {
    it('disables buttons when isLoading is true', () => {
      render(<GapActions {...defaultProps} isLoading={true} />)

      expect(screen.getByRole('button', { name: /mark as resolved/i })).toBeDisabled()
    })

    it('disables Undo button when isLoading is true', () => {
      render(<GapActions {...defaultProps} gap={mockResolvedGap} isLoading={true} />)

      expect(screen.getByRole('button', { name: /undo resolution/i })).toBeDisabled()
    })
  })

  describe('Error Handling', () => {
    it('shows error toast when API call fails', async () => {
      const user = userEvent.setup()
      vi.mocked(gapsApi.createManualFinding).mockRejectedValue(new Error('API Error'))

      render(<GapActions {...defaultProps} gap={mockInfoGap} />)

      await user.click(screen.getByRole('button', { name: /add manual finding/i }))

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      await user.type(screen.getByLabelText(/finding text/i), 'Test finding')
      await user.click(screen.getByRole('button', { name: /create finding/i }))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('API Error')
      })
    })
  })
})
