/**
 * QA Export Button Component Tests
 * Story: E8.6 - Excel Export (AC: #4)
 *
 * Tests for the QAExportButton component:
 * - Click triggers export
 * - Loading state during export
 * - Success toast with filename
 * - Error toast on failure
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QAExportButton } from '@/components/qa/QAExportButton'
import { toast } from 'sonner'

// Mock the qa API module
vi.mock('@/lib/api/qa', () => ({
  downloadQAExcel: vi.fn(),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Get the mocked function
import { downloadQAExcel } from '@/lib/api/qa'
const mockDownloadQAExcel = vi.mocked(downloadQAExcel)

describe('QAExportButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with correct text and icon', () => {
    render(<QAExportButton projectId="project-1" />)

    expect(screen.getByRole('button')).toHaveTextContent('Export Excel')
    expect(screen.getByLabelText('Export Q&A list to Excel')).toBeInTheDocument()
  })

  it('calls downloadQAExcel on click (AC #4)', async () => {
    mockDownloadQAExcel.mockResolvedValueOnce('Test_QA_List_2025-12-09.xlsx')

    render(<QAExportButton projectId="project-1" />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockDownloadQAExcel).toHaveBeenCalledWith('project-1', undefined)
    })
  })

  it('passes filters to downloadQAExcel (AC #4)', async () => {
    mockDownloadQAExcel.mockResolvedValueOnce('Test_QA_List_2025-12-09.xlsx')

    const filters = {
      category: 'Financials' as const,
      priority: 'high' as const,
      status: 'pending' as const,
    }

    render(<QAExportButton projectId="project-1" filters={filters} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockDownloadQAExcel).toHaveBeenCalledWith('project-1', filters)
    })
  })

  it('shows loading state during export (Task 4.3)', async () => {
    // Create a delayed promise
    let resolveExport: (value: string) => void
    const exportPromise = new Promise<string>((resolve) => {
      resolveExport = resolve
    })
    mockDownloadQAExcel.mockReturnValueOnce(exportPromise)

    render(<QAExportButton projectId="project-1" />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText('Exporting...')).toBeInTheDocument()
    })

    // Button should be disabled during export
    expect(button).toBeDisabled()

    // Resolve the promise
    resolveExport!('Test_QA_List_2025-12-09.xlsx')

    // Should return to normal state
    await waitFor(() => {
      expect(screen.getByText('Export Excel')).toBeInTheDocument()
    })
  })

  it('displays success toast with filename after download (Task 4.4)', async () => {
    const filename = 'Acme_Corp_QA_List_2025-12-09.xlsx'
    mockDownloadQAExcel.mockResolvedValueOnce(filename)

    render(<QAExportButton projectId="project-1" />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Q&A list exported successfully',
        expect.objectContaining({
          description: filename,
        })
      )
    })
  })

  it('displays error toast if export fails (Task 4.5)', async () => {
    const errorMessage = 'No Q&A items to export'
    mockDownloadQAExcel.mockRejectedValueOnce(new Error(errorMessage))

    render(<QAExportButton projectId="project-1" />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Export failed',
        expect.objectContaining({
          description: errorMessage,
        })
      )
    })
  })

  it('handles non-Error exceptions', async () => {
    mockDownloadQAExcel.mockRejectedValueOnce('Unknown error')

    render(<QAExportButton projectId="project-1" />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Export failed',
        expect.objectContaining({
          description: 'Failed to export Q&A list',
        })
      )
    })
  })

  it('is disabled when disabled prop is true', () => {
    render(<QAExportButton projectId="project-1" disabled={true} />)

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })

  it('prevents double-click during export', async () => {
    // Create a delayed promise
    let resolveExport: (value: string) => void
    const exportPromise = new Promise<string>((resolve) => {
      resolveExport = resolve
    })
    mockDownloadQAExcel.mockReturnValueOnce(exportPromise)

    render(<QAExportButton projectId="project-1" />)

    const button = screen.getByRole('button')

    // First click
    fireEvent.click(button)

    // Second click while loading
    fireEvent.click(button)

    // Should only be called once
    expect(mockDownloadQAExcel).toHaveBeenCalledTimes(1)

    // Cleanup
    resolveExport!('Test_QA_List_2025-12-09.xlsx')
    await waitFor(() => {
      expect(screen.getByText('Export Excel')).toBeInTheDocument()
    })
  })

  it('applies custom className', () => {
    render(<QAExportButton projectId="project-1" className="custom-class" />)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('custom-class')
  })

  it('has proper accessibility attributes', () => {
    render(<QAExportButton projectId="project-1" />)

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-label', 'Export Q&A list to Excel')
  })
})
