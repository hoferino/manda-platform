/**
 * ExportDropdown Component Tests
 * Story: E4.10 - Implement Export Findings to CSV/Excel
 *
 * Tests:
 * - Renders export button with dropdown menu
 * - Shows CSV and Excel options in dropdown
 * - Displays finding count in dropdown items
 * - Shows loading state during export
 * - Disables button when no findings
 * - Shows warning for large exports
 * - Accessible: ARIA labels and keyboard navigation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExportDropdown, type ExportDropdownProps } from '@/components/knowledge-explorer/findings/ExportDropdown'

// Mock the findings API
vi.mock('@/lib/api/findings', () => ({
  exportFindings: vi.fn(),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { exportFindings } from '@/lib/api/findings'
import { toast } from 'sonner'

describe('ExportDropdown', () => {
  const defaultProps: ExportDropdownProps = {
    projectId: 'project-123',
    filters: {},
    findingCount: 50,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(exportFindings).mockResolvedValue({ filename: 'findings.csv', count: 50 })
  })

  describe('Rendering', () => {
    it('renders export button', () => {
      render(<ExportDropdown {...defaultProps} />)
      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
    })

    it('shows dropdown menu on click', async () => {
      const user = userEvent.setup()
      render(<ExportDropdown {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /export/i }))

      await waitFor(() => {
        expect(screen.getByText(/export to csv/i)).toBeInTheDocument()
        expect(screen.getByText(/export to excel/i)).toBeInTheDocument()
      })
    })

    it('shows finding count in dropdown items', async () => {
      const user = userEvent.setup()
      render(<ExportDropdown {...defaultProps} findingCount={75} />)

      await user.click(screen.getByRole('button', { name: /export/i }))

      await waitFor(() => {
        // Both CSV and Excel options show finding count
        expect(screen.getAllByText(/75 findings/i).length).toBeGreaterThanOrEqual(1)
      })
    })

    it('shows download icon in button', () => {
      render(<ExportDropdown {...defaultProps} />)
      const button = screen.getByRole('button', { name: /export/i })
      expect(button.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('Export Actions (AC: #2)', () => {
    it('calls exportFindings with csv format', async () => {
      const user = userEvent.setup()
      render(<ExportDropdown {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /export/i }))
      await waitFor(() => {
        expect(screen.getByText(/export to csv/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/export to csv/i))

      await waitFor(() => {
        expect(exportFindings).toHaveBeenCalledWith(
          'project-123',
          'csv',
          {},
          undefined
        )
      })
    })

    it('calls exportFindings with xlsx format', async () => {
      const user = userEvent.setup()
      render(<ExportDropdown {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /export/i }))
      await waitFor(() => {
        expect(screen.getByText(/export to excel/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/export to excel/i))

      await waitFor(() => {
        expect(exportFindings).toHaveBeenCalledWith(
          'project-123',
          'xlsx',
          {},
          undefined
        )
      })
    })

    it('passes filters to exportFindings', async () => {
      const user = userEvent.setup()
      const filters = {
        domain: ['financial' as const],
        status: ['validated' as const],
      }
      render(<ExportDropdown {...defaultProps} filters={filters} />)

      await user.click(screen.getByRole('button', { name: /export/i }))
      await waitFor(() => {
        expect(screen.getByText(/export to csv/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/export to csv/i))

      await waitFor(() => {
        expect(exportFindings).toHaveBeenCalledWith(
          'project-123',
          'csv',
          filters,
          undefined
        )
      })
    })

    it('passes searchQuery to exportFindings when provided', async () => {
      const user = userEvent.setup()
      render(<ExportDropdown {...defaultProps} searchQuery="revenue growth" />)

      await user.click(screen.getByRole('button', { name: /export/i }))
      await waitFor(() => {
        expect(screen.getByText(/export to csv/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/export to csv/i))

      await waitFor(() => {
        expect(exportFindings).toHaveBeenCalledWith(
          'project-123',
          'csv',
          {},
          'revenue growth'
        )
      })
    })
  })

  describe('Loading State (AC: #4)', () => {
    it('shows loading spinner during export', async () => {
      vi.mocked(exportFindings).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ filename: 'test.csv', count: 50 }), 100))
      )

      const user = userEvent.setup()
      render(<ExportDropdown {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /export/i }))
      await waitFor(() => {
        expect(screen.getByText(/export to csv/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/export to csv/i))

      // Button should show loading state
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /exporting/i })).toBeInTheDocument()
      })
    })

    it('disables button during export', async () => {
      vi.mocked(exportFindings).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ filename: 'test.csv', count: 50 }), 100))
      )

      const user = userEvent.setup()
      render(<ExportDropdown {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /export/i }))
      await waitFor(() => {
        expect(screen.getByText(/export to csv/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/export to csv/i))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /exporting/i })).toBeDisabled()
      })
    })
  })

  describe('Disabled State (AC: #5)', () => {
    it('disables button when findingCount is 0', () => {
      render(<ExportDropdown {...defaultProps} findingCount={0} />)

      expect(screen.getByRole('button', { name: /no findings to export/i })).toBeDisabled()
    })

    it('disables button when disabled prop is true', () => {
      render(<ExportDropdown {...defaultProps} disabled />)

      expect(screen.getByRole('button', { name: /export/i })).toBeDisabled()
    })
  })

  describe('Large Export Warning (AC: #7)', () => {
    it('shows warning when findingCount exceeds 5000', async () => {
      const user = userEvent.setup()
      render(<ExportDropdown {...defaultProps} findingCount={6000} />)

      await user.click(screen.getByRole('button', { name: /export/i }))

      await waitFor(() => {
        expect(screen.getByText(/only first 5000/i)).toBeInTheDocument()
      })
    })

    it('shows capped count in dropdown items for large exports', async () => {
      const user = userEvent.setup()
      render(<ExportDropdown {...defaultProps} findingCount={10000} />)

      await user.click(screen.getByRole('button', { name: /export/i }))

      await waitFor(() => {
        // Both CSV and Excel show capped count
        expect(screen.getAllByText(/5000 findings/).length).toBeGreaterThanOrEqual(1)
      })
    })
  })

  describe('Success/Error Handling', () => {
    it('shows success toast on successful export', async () => {
      vi.mocked(exportFindings).mockResolvedValue({ filename: 'findings.csv', count: 50 })

      const user = userEvent.setup()
      render(<ExportDropdown {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /export/i }))
      await waitFor(() => {
        expect(screen.getByText(/export to csv/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/export to csv/i))

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          expect.stringContaining('50 findings'),
          expect.any(Object)
        )
      })
    })

    it('shows error toast on export failure', async () => {
      vi.mocked(exportFindings).mockRejectedValue(new Error('Export failed'))

      const user = userEvent.setup()
      render(<ExportDropdown {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /export/i }))
      await waitFor(() => {
        expect(screen.getByText(/export to csv/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/export to csv/i))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Export failed',
          expect.any(Object)
        )
      })
    })
  })

  describe('Accessibility', () => {
    it('has accessible name for export button', () => {
      render(<ExportDropdown {...defaultProps} findingCount={25} />)

      expect(screen.getByRole('button', { name: /export 25 findings/i })).toBeInTheDocument()
    })

    it('has accessible labels for dropdown items', async () => {
      const user = userEvent.setup()
      render(<ExportDropdown {...defaultProps} findingCount={25} />)

      await user.click(screen.getByRole('button', { name: /export/i }))

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /export 25 findings to csv/i })).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /export 25 findings to excel/i })).toBeInTheDocument()
      })
    })

    it('closes dropdown after selection', async () => {
      const user = userEvent.setup()
      render(<ExportDropdown {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /export/i }))
      await waitFor(() => {
        expect(screen.getByText(/export to csv/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/export to csv/i))

      // Dropdown should close
      await waitFor(() => {
        expect(screen.queryByText(/export to csv/i)).not.toBeInTheDocument()
      })
    })
  })
})
