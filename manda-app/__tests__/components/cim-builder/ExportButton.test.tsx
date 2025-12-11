/**
 * ExportButton Component Tests
 *
 * Story: E9.14 - Wireframe PowerPoint Export
 * AC: #1 (Export Button Visibility), #6 (Browser Download)
 *
 * Tests button states, export triggering, and user feedback
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExportButton, ExportButtonIcon } from '@/components/cim-builder/ExportButton'
import type { CIM, Slide, SlideComponent } from '@/lib/types/cim'

// Mock the export service
const mockExportCIMAsWireframe = vi.fn()
const mockTriggerPPTXDownload = vi.fn()

vi.mock('@/lib/services/cim-export', () => ({
  exportCIMAsWireframe: (...args: unknown[]) => mockExportCIMAsWireframe(...args),
  triggerPPTXDownload: (...args: unknown[]) => mockTriggerPPTXDownload(...args),
}))

// ============================================================================
// Test Data Factories
// ============================================================================

function createMockSlide(title: string): Slide {
  return {
    id: `slide-${Math.random().toString(36).substr(2, 9)}`,
    section_id: `section-${Math.random().toString(36).substr(2, 9)}`,
    title,
    components: [
      {
        id: 'comp-1',
        type: 'title',
        content: title,
      } as SlideComponent,
    ],
    visual_concept: null,
    status: 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function createMockCIM(title: string, slideCount: number = 0): CIM {
  const slides: Slide[] = []
  for (let i = 0; i < slideCount; i++) {
    slides.push(createMockSlide(`Slide ${i + 1}`))
  }

  return {
    id: 'cim-1',
    dealId: 'deal-1',
    title,
    userId: 'user-1',
    version: 1,
    workflowState: {
      current_phase: 'content_creation',
      current_section_index: 0,
      current_slide_index: 0,
      completed_phases: ['persona', 'thesis', 'outline'],
      is_complete: false,
    },
    buyerPersona: null,
    investmentThesis: null,
    outline: [],
    slides,
    dependencyGraph: { dependencies: {}, references: {} },
    conversationHistory: [],
    exportFormats: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('ExportButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExportCIMAsWireframe.mockResolvedValue({
      blob: new Blob(['test']),
      filename: 'Test - Wireframe.pptx',
      contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      slideCount: 1,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ==========================================================================
  // Visibility Tests (AC #1)
  // ==========================================================================
  describe('visibility and enabled state (AC #1)', () => {
    it('should render export button when CIM has slides', () => {
      const cim = createMockCIM('Test CIM', 3)
      render(<ExportButton cim={cim} />)

      expect(screen.getByTestId('export-button')).toBeInTheDocument()
    })

    it('should be enabled when CIM has at least one slide', () => {
      const cim = createMockCIM('Test CIM', 1)
      render(<ExportButton cim={cim} />)

      const button = screen.getByTestId('export-button')
      expect(button).not.toBeDisabled()
    })

    it('should be disabled when CIM has no slides', () => {
      const cim = createMockCIM('Empty CIM', 0)
      render(<ExportButton cim={cim} />)

      const button = screen.getByTestId('export-button')
      expect(button).toBeDisabled()
    })

    it('should show "Export Wireframe" label by default', () => {
      const cim = createMockCIM('Test CIM', 1)
      render(<ExportButton cim={cim} />)

      expect(screen.getByText('Export Wireframe')).toBeInTheDocument()
    })

    it('should have download icon', () => {
      const cim = createMockCIM('Test CIM', 1)
      render(<ExportButton cim={cim} />)

      const button = screen.getByTestId('export-button')
      expect(button.querySelector('svg')).toBeInTheDocument()
    })
  })

  // ==========================================================================
  // Export Trigger Tests (AC #6)
  // ==========================================================================
  describe('export trigger (AC #6)', () => {
    it('should call export service when clicked', async () => {
      const cim = createMockCIM('Test CIM', 1)
      render(<ExportButton cim={cim} />)

      const button = screen.getByTestId('export-button')
      await userEvent.click(button)

      expect(mockExportCIMAsWireframe).toHaveBeenCalledWith(cim)
    })

    it('should trigger download after export', async () => {
      const cim = createMockCIM('Test CIM', 1)
      render(<ExportButton cim={cim} />)

      const button = screen.getByTestId('export-button')
      await userEvent.click(button)

      await waitFor(() => {
        expect(mockTriggerPPTXDownload).toHaveBeenCalledWith(
          expect.any(Blob),
          'Test - Wireframe.pptx'
        )
      })
    })

    it('should not call export when disabled', async () => {
      const cim = createMockCIM('Empty CIM', 0)
      render(<ExportButton cim={cim} />)

      const button = screen.getByTestId('export-button')
      await userEvent.click(button)

      expect(mockExportCIMAsWireframe).not.toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // Loading State Tests
  // ==========================================================================
  describe('loading state', () => {
    it('should show loading state during export', async () => {
      // Make export take some time
      mockExportCIMAsWireframe.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({
          blob: new Blob(['test']),
          filename: 'Test.pptx',
          contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          slideCount: 1,
        }), 100))
      )

      const cim = createMockCIM('Test CIM', 1)
      render(<ExportButton cim={cim} />)

      const button = screen.getByTestId('export-button')
      await userEvent.click(button)

      // Should show loading text
      expect(screen.getByText('Exporting...')).toBeInTheDocument()
      expect(button).toBeDisabled()
    })

    it('should show success state after export', async () => {
      const cim = createMockCIM('Test CIM', 1)
      render(<ExportButton cim={cim} />)

      const button = screen.getByTestId('export-button')
      await userEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('Exported!')).toBeInTheDocument()
      })
    })

    it('should have success status after successful export', async () => {
      const cim = createMockCIM('Test CIM', 1)
      render(<ExportButton cim={cim} />)

      const button = screen.getByTestId('export-button')
      await userEvent.click(button)

      // Verify success state is achieved
      await waitFor(() => {
        expect(screen.getByText('Exported!')).toBeInTheDocument()
      })
    })
  })

  // ==========================================================================
  // Error State Tests
  // ==========================================================================
  describe('error handling', () => {
    it('should show error state when export fails', async () => {
      mockExportCIMAsWireframe.mockRejectedValue(new Error('Export failed'))

      const cim = createMockCIM('Test CIM', 1)
      render(<ExportButton cim={cim} />)

      const button = screen.getByTestId('export-button')
      await userEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('Export Failed')).toBeInTheDocument()
      })
    })

    it('should call onExportError callback on failure', async () => {
      const onExportError = vi.fn()
      mockExportCIMAsWireframe.mockRejectedValue(new Error('Test error'))

      const cim = createMockCIM('Test CIM', 1)
      render(<ExportButton cim={cim} onExportError={onExportError} />)

      const button = screen.getByTestId('export-button')
      await userEvent.click(button)

      await waitFor(() => {
        expect(onExportError).toHaveBeenCalledWith(expect.any(Error))
      })
    })

    it('should show error state with error indicator', async () => {
      mockExportCIMAsWireframe.mockRejectedValue(new Error('Export failed'))

      const cim = createMockCIM('Test CIM', 1)
      render(<ExportButton cim={cim} />)

      const button = screen.getByTestId('export-button')
      await userEvent.click(button)

      // Verify error state is shown
      await waitFor(() => {
        expect(screen.getByText('Export Failed')).toBeInTheDocument()
      })
    })
  })

  // ==========================================================================
  // Callback Tests
  // ==========================================================================
  describe('callbacks', () => {
    it('should call onExportStart when export begins', async () => {
      const onExportStart = vi.fn()
      const cim = createMockCIM('Test CIM', 1)
      render(<ExportButton cim={cim} onExportStart={onExportStart} />)

      const button = screen.getByTestId('export-button')
      await userEvent.click(button)

      await waitFor(() => {
        expect(onExportStart).toHaveBeenCalled()
      })
    })

    it('should call onExportComplete with slide count on success', async () => {
      const onExportComplete = vi.fn()
      mockExportCIMAsWireframe.mockResolvedValue({
        blob: new Blob(['test']),
        filename: 'Test.pptx',
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        slideCount: 5,
      })

      const cim = createMockCIM('Test CIM', 5)
      render(<ExportButton cim={cim} onExportComplete={onExportComplete} />)

      const button = screen.getByTestId('export-button')
      await userEvent.click(button)

      await waitFor(() => {
        expect(onExportComplete).toHaveBeenCalledWith(5)
      })
    })
  })

  // ==========================================================================
  // Button Variants Tests
  // ==========================================================================
  describe('button variants', () => {
    it('should support outline variant', () => {
      const cim = createMockCIM('Test CIM', 1)
      render(<ExportButton cim={cim} variant="outline" />)

      const button = screen.getByTestId('export-button')
      expect(button).toBeInTheDocument()
    })

    it('should support ghost variant', () => {
      const cim = createMockCIM('Test CIM', 1)
      render(<ExportButton cim={cim} variant="ghost" />)

      const button = screen.getByTestId('export-button')
      expect(button).toBeInTheDocument()
    })

    it('should support sm size', () => {
      const cim = createMockCIM('Test CIM', 1)
      render(<ExportButton cim={cim} size="sm" />)

      const button = screen.getByTestId('export-button')
      expect(button).toBeInTheDocument()
    })

    it('should support custom className', () => {
      const cim = createMockCIM('Test CIM', 1)
      render(<ExportButton cim={cim} className="custom-class" />)

      const button = screen.getByTestId('export-button')
      expect(button).toHaveClass('custom-class')
    })
  })

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================
  describe('accessibility', () => {
    it('should have aria-label', () => {
      const cim = createMockCIM('Test CIM', 1)
      render(<ExportButton cim={cim} />)

      const button = screen.getByTestId('export-button')
      expect(button).toHaveAttribute('aria-label')
    })

    it('should have data-testid for testing', () => {
      const cim = createMockCIM('Test CIM', 1)
      render(<ExportButton cim={cim} />)

      expect(screen.getByTestId('export-button')).toBeInTheDocument()
    })
  })
})

describe('ExportButtonIcon', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExportCIMAsWireframe.mockResolvedValue({
      blob: new Blob(['test']),
      filename: 'Test - Wireframe.pptx',
      contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      slideCount: 1,
    })
  })

  it('should render icon-only button', () => {
    const cim = createMockCIM('Test CIM', 1)
    render(<ExportButtonIcon cim={cim} />)

    expect(screen.getByTestId('export-button-icon')).toBeInTheDocument()
  })

  it('should be disabled when CIM has no slides', () => {
    const cim = createMockCIM('Empty CIM', 0)
    render(<ExportButtonIcon cim={cim} />)

    const button = screen.getByTestId('export-button-icon')
    expect(button).toBeDisabled()
  })

  it('should trigger export when clicked', async () => {
    const cim = createMockCIM('Test CIM', 1)
    render(<ExportButtonIcon cim={cim} />)

    const button = screen.getByTestId('export-button-icon')
    await userEvent.click(button)

    await waitFor(() => {
      expect(mockExportCIMAsWireframe).toHaveBeenCalledWith(cim)
    })
  })

  it('should call callbacks on export', async () => {
    const onExportStart = vi.fn()
    const onExportComplete = vi.fn()
    const cim = createMockCIM('Test CIM', 1)

    render(
      <ExportButtonIcon
        cim={cim}
        onExportStart={onExportStart}
        onExportComplete={onExportComplete}
      />
    )

    const button = screen.getByTestId('export-button-icon')
    await userEvent.click(button)

    await waitFor(() => {
      expect(onExportStart).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(onExportComplete).toHaveBeenCalled()
    })
  })

  it('should have aria-label for accessibility', () => {
    const cim = createMockCIM('Test CIM', 1)
    render(<ExportButtonIcon cim={cim} />)

    const button = screen.getByTestId('export-button-icon')
    expect(button).toHaveAttribute('aria-label')
  })
})
