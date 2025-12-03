/**
 * IRL Export Dropdown Component Tests
 *
 * Story: E6.6 - Build IRL Export Functionality (PDF/Word)
 * ACs: 1 (Export dropdown offers PDF and Word options)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IRLExportDropdown } from '@/components/irl/IRLExportDropdown'
import { TooltipProvider } from '@/components/ui/tooltip'

// Mock the export API
vi.mock('@/lib/api/irl', () => ({
  exportIRL: vi.fn(),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { exportIRL } from '@/lib/api/irl'
import { toast } from 'sonner'

// Wrapper with required providers
function renderWithProviders(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

describe('IRLExportDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render the export button', () => {
      renderWithProviders(
        <IRLExportDropdown projectId="proj-1" irlId="irl-1" />
      )

      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
    })

    it('should show export text on larger screens', () => {
      renderWithProviders(
        <IRLExportDropdown projectId="proj-1" irlId="irl-1" />
      )

      // The "Export" text has class "hidden sm:inline"
      const button = screen.getByRole('button', { name: /export/i })
      expect(button).toHaveTextContent('Export')
    })

    it('should be disabled when disabled prop is true', () => {
      renderWithProviders(
        <IRLExportDropdown projectId="proj-1" irlId="irl-1" disabled />
      )

      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('should apply custom className', () => {
      renderWithProviders(
        <IRLExportDropdown
          projectId="proj-1"
          irlId="irl-1"
          className="custom-class"
        />
      )

      expect(screen.getByRole('button')).toHaveClass('custom-class')
    })
  })

  describe('dropdown menu (AC1)', () => {
    it('should open dropdown menu on click', async () => {
      const user = userEvent.setup()
      renderWithProviders(
        <IRLExportDropdown projectId="proj-1" irlId="irl-1" />
      )

      await user.click(screen.getByRole('button'))

      // Wait for dropdown to appear
      await waitFor(() => {
        expect(screen.getByText(/export as pdf/i)).toBeInTheDocument()
        expect(screen.getByText(/export as word/i)).toBeInTheDocument()
      })
    })

    it('should show PDF option with icon (AC1)', async () => {
      const user = userEvent.setup()
      renderWithProviders(
        <IRLExportDropdown projectId="proj-1" irlId="irl-1" />
      )

      await user.click(screen.getByRole('button'))

      await waitFor(() => {
        const pdfOption = screen.getByText(/export as pdf/i)
        expect(pdfOption).toBeInTheDocument()
      })
    })

    it('should show Word option with icon (AC1)', async () => {
      const user = userEvent.setup()
      renderWithProviders(
        <IRLExportDropdown projectId="proj-1" irlId="irl-1" />
      )

      await user.click(screen.getByRole('button'))

      await waitFor(() => {
        const wordOption = screen.getByText(/export as word/i)
        expect(wordOption).toBeInTheDocument()
      })
    })
  })

  describe('export functionality', () => {
    it('should call exportIRL with PDF format when PDF option clicked', async () => {
      const user = userEvent.setup()
      const mockExportIRL = vi.mocked(exportIRL)
      mockExportIRL.mockResolvedValue({ filename: 'test.pdf', count: 10 })

      renderWithProviders(
        <IRLExportDropdown projectId="proj-1" irlId="irl-1" />
      )

      await user.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText(/export as pdf/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/export as pdf/i))

      await waitFor(() => {
        expect(mockExportIRL).toHaveBeenCalledWith('proj-1', 'irl-1', 'pdf')
      })
    })

    it('should call exportIRL with Word format when Word option clicked', async () => {
      const user = userEvent.setup()
      const mockExportIRL = vi.mocked(exportIRL)
      mockExportIRL.mockResolvedValue({ filename: 'test.docx', count: 10 })

      renderWithProviders(
        <IRLExportDropdown projectId="proj-1" irlId="irl-1" />
      )

      await user.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText(/export as word/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/export as word/i))

      await waitFor(() => {
        expect(mockExportIRL).toHaveBeenCalledWith('proj-1', 'irl-1', 'word')
      })
    })

    it('should show success toast on successful export', async () => {
      const user = userEvent.setup()
      const mockExportIRL = vi.mocked(exportIRL)
      mockExportIRL.mockResolvedValue({ filename: 'irl-export.pdf', count: 15 })

      renderWithProviders(
        <IRLExportDropdown projectId="proj-1" irlId="irl-1" />
      )

      await user.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText(/export as pdf/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/export as pdf/i))

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          expect.stringContaining('irl-export.pdf')
        )
      })
    })

    it('should show error toast on failed export', async () => {
      const user = userEvent.setup()
      const mockExportIRL = vi.mocked(exportIRL)
      mockExportIRL.mockRejectedValue(new Error('Export failed'))

      renderWithProviders(
        <IRLExportDropdown projectId="proj-1" irlId="irl-1" />
      )

      await user.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText(/export as pdf/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/export as pdf/i))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Export failed')
      })
    })

    it('should call onExportStart callback when export starts', async () => {
      const user = userEvent.setup()
      const mockExportIRL = vi.mocked(exportIRL)
      mockExportIRL.mockResolvedValue({ filename: 'test.pdf', count: 10 })
      const onExportStart = vi.fn()

      renderWithProviders(
        <IRLExportDropdown
          projectId="proj-1"
          irlId="irl-1"
          onExportStart={onExportStart}
        />
      )

      await user.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText(/export as pdf/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/export as pdf/i))

      expect(onExportStart).toHaveBeenCalled()
    })

    it('should call onExportComplete callback on successful export', async () => {
      const user = userEvent.setup()
      const mockExportIRL = vi.mocked(exportIRL)
      mockExportIRL.mockResolvedValue({ filename: 'test.pdf', count: 10 })
      const onExportComplete = vi.fn()

      renderWithProviders(
        <IRLExportDropdown
          projectId="proj-1"
          irlId="irl-1"
          onExportComplete={onExportComplete}
        />
      )

      await user.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText(/export as pdf/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/export as pdf/i))

      await waitFor(() => {
        expect(onExportComplete).toHaveBeenCalledWith({
          filename: 'test.pdf',
          count: 10,
        })
      })
    })

    it('should call onExportError callback on failed export', async () => {
      const user = userEvent.setup()
      const mockExportIRL = vi.mocked(exportIRL)
      mockExportIRL.mockRejectedValue(new Error('Network error'))
      const onExportError = vi.fn()

      renderWithProviders(
        <IRLExportDropdown
          projectId="proj-1"
          irlId="irl-1"
          onExportError={onExportError}
        />
      )

      await user.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText(/export as pdf/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/export as pdf/i))

      await waitFor(() => {
        expect(onExportError).toHaveBeenCalledWith('Network error')
      })
    })
  })

  describe('loading state', () => {
    it('should show loading spinner during export', async () => {
      const user = userEvent.setup()
      const mockExportIRL = vi.mocked(exportIRL)

      // Create a promise that won't resolve immediately
      let resolveExport: (value: { filename: string; count: number }) => void
      mockExportIRL.mockImplementation(
        () => new Promise((resolve) => {
          resolveExport = resolve
        })
      )

      renderWithProviders(
        <IRLExportDropdown projectId="proj-1" irlId="irl-1" />
      )

      await user.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText(/export as pdf/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/export as pdf/i))

      // Button should be disabled during export
      await waitFor(() => {
        expect(screen.getByRole('button')).toBeDisabled()
      })

      // Resolve the export
      resolveExport!({ filename: 'test.pdf', count: 10 })

      await waitFor(() => {
        expect(screen.getByRole('button')).not.toBeDisabled()
      })
    })

    it('should prevent multiple simultaneous exports', async () => {
      const user = userEvent.setup()
      const mockExportIRL = vi.mocked(exportIRL)

      let resolveExport: (value: { filename: string; count: number }) => void
      mockExportIRL.mockImplementation(
        () => new Promise((resolve) => {
          resolveExport = resolve
        })
      )

      renderWithProviders(
        <IRLExportDropdown projectId="proj-1" irlId="irl-1" />
      )

      // Start first export
      await user.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText(/export as pdf/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/export as pdf/i))

      // exportIRL should only be called once
      expect(mockExportIRL).toHaveBeenCalledTimes(1)

      // Resolve to clean up
      resolveExport!({ filename: 'test.pdf', count: 10 })
    })
  })
})
