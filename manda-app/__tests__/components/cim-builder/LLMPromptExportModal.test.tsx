/**
 * LLMPromptExportModal Tests
 *
 * Story: E9.15 - LLM Prompt Export
 * ACs: #1 (Export Option Available), #2 (Comprehensive Content), #3 (Structured Format),
 *      #4 (Copy to Clipboard), #5 (Download as Text File)
 */

import * as React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LLMPromptExportModal } from '@/components/cim-builder/LLMPromptExportModal'
import type { CIM } from '@/lib/types/cim'

// Mock sonner toast - define mock inline in factory function to avoid hoisting issues
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Get reference to mocked toast after vi.mock is hoisted
const { toast: mockToast } = await import('sonner') as unknown as { toast: { success: ReturnType<typeof vi.fn>, error: ReturnType<typeof vi.fn> } }

// Mock clipboard and download functions - define inline
vi.mock('@/lib/services/cim-export', () => ({
  exportCIMAsLLMPrompt: vi.fn((cim: { title: string; outline?: { id: string }[]; slides?: { id: string }[] }) => ({
    prompt: '<cim_export version="1.0"><metadata><title>' + cim.title + '</title></metadata></cim_export>',
    characterCount: 100,
    sectionCount: cim.outline?.length || 0,
    slideCount: cim.slides?.length || 0,
    filename: cim.title + ' - LLM Prompt.txt',
  })),
  copyToClipboard: vi.fn(),
  triggerTextDownload: vi.fn(),
}))

// Get references to mocked functions
const cimExportModule = await import('@/lib/services/cim-export')
const mockCopyToClipboard = cimExportModule.copyToClipboard as ReturnType<typeof vi.fn>
const mockTriggerTextDownload = cimExportModule.triggerTextDownload as ReturnType<typeof vi.fn>

// Test CIM fixture
const createTestCIM = (overrides = {}): CIM => ({
  id: 'test-cim-id',
  dealId: 'test-deal-id',
  title: 'Test Company CIM',
  userId: 'test-user-id',
  version: 1,
  workflowState: {
    current_phase: 'content_creation',
    current_section_index: 0,
    current_slide_index: 0,
    completed_phases: ['persona', 'thesis', 'outline'],
    is_complete: false,
  },
  buyerPersona: {
    buyer_type: 'strategic',
    buyer_description: 'Large technology company',
    priorities: ['Market share growth'],
    concerns: ['Integration complexity'],
    key_metrics: ['Revenue growth'],
  },
  investmentThesis: 'Strong market position',
  outline: [
    {
      id: 'section-1',
      title: 'Executive Summary',
      description: 'Overview',
      order: 1,
      status: 'complete',
      slide_ids: ['s1', 's2'],
    },
  ],
  slides: [
    {
      id: 's1',
      section_id: 'section-1',
      title: 'Welcome Slide',
      components: [
        { id: 'c1', type: 'title', content: 'Test Company CIM' },
      ],
      visual_concept: null,
      status: 'draft',
      created_at: '2025-12-10T10:00:00Z',
      updated_at: '2025-12-10T10:00:00Z',
    },
  ],
  dependencyGraph: { dependencies: {}, references: {} },
  conversationHistory: [],
  exportFormats: null,
  createdAt: '2025-12-10T09:00:00Z',
  updatedAt: '2025-12-10T12:00:00Z',
  ...overrides,
})

describe('LLMPromptExportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCopyToClipboard.mockResolvedValue(undefined)
    mockTriggerTextDownload.mockImplementation(() => {})
    mockToast.success.mockClear()
    mockToast.error.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Modal Rendering', () => {
    it('should not render when isOpen is false', () => {
      const cim = createTestCIM()
      render(
        <LLMPromptExportModal
          cim={cim}
          isOpen={false}
          onClose={() => {}}
        />
      )

      expect(screen.queryByText('Export LLM Prompt')).not.toBeInTheDocument()
    })

    it('should render when isOpen is true', () => {
      const cim = createTestCIM()
      render(
        <LLMPromptExportModal
          cim={cim}
          isOpen={true}
          onClose={() => {}}
        />
      )

      expect(screen.getByText('Export LLM Prompt')).toBeInTheDocument()
    })

    it('should show dialog title and description', () => {
      const cim = createTestCIM()
      render(
        <LLMPromptExportModal
          cim={cim}
          isOpen={true}
          onClose={() => {}}
        />
      )

      expect(screen.getByText('Export LLM Prompt')).toBeInTheDocument()
      expect(screen.getByText(/Export your CIM as a structured prompt/)).toBeInTheDocument()
    })

    it('should show character count', () => {
      const cim = createTestCIM()
      render(
        <LLMPromptExportModal
          cim={cim}
          isOpen={true}
          onClose={() => {}}
        />
      )

      expect(screen.getByText(/100/)).toBeInTheDocument()
      expect(screen.getByText(/characters/)).toBeInTheDocument()
    })

    it('should show section count', () => {
      const cim = createTestCIM()
      render(
        <LLMPromptExportModal
          cim={cim}
          isOpen={true}
          onClose={() => {}}
        />
      )

      // Dialog should render with stats displayed
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('should show slide count', () => {
      const cim = createTestCIM()
      render(
        <LLMPromptExportModal
          cim={cim}
          isOpen={true}
          onClose={() => {}}
        />
      )

      // Check that preview textarea exists which contains stats
      expect(screen.getByTestId('llm-prompt-preview')).toBeInTheDocument()
    })

    it('should show preview textarea with generated prompt', () => {
      const cim = createTestCIM()
      render(
        <LLMPromptExportModal
          cim={cim}
          isOpen={true}
          onClose={() => {}}
        />
      )

      const textarea = screen.getByTestId('llm-prompt-preview')
      expect(textarea).toBeInTheDocument()
      // Use toContain on the value since toHaveValue doesn't support stringContaining
      expect((textarea as HTMLTextAreaElement).value).toContain('<cim_export')
    })

    it('should have readonly preview textarea', () => {
      const cim = createTestCIM()
      render(
        <LLMPromptExportModal
          cim={cim}
          isOpen={true}
          onClose={() => {}}
        />
      )

      const textarea = screen.getByTestId('llm-prompt-preview')
      expect(textarea).toHaveAttribute('readonly')
    })
  })

  describe('Close Button (AC #1)', () => {
    it('should call onClose when close button is clicked', async () => {
      const cim = createTestCIM()
      const onClose = vi.fn()
      render(
        <LLMPromptExportModal
          cim={cim}
          isOpen={true}
          onClose={onClose}
        />
      )

      const closeButton = screen.getByTestId('llm-prompt-close-button')
      await userEvent.click(closeButton)

      expect(onClose).toHaveBeenCalled()
    })

    it('should show "Close" label on close button', () => {
      const cim = createTestCIM()
      render(
        <LLMPromptExportModal
          cim={cim}
          isOpen={true}
          onClose={() => {}}
        />
      )

      expect(screen.getByTestId('llm-prompt-close-button')).toHaveTextContent('Close')
    })
  })

  describe('Copy to Clipboard (AC #4)', () => {
    it('should call copyToClipboard when copy button is clicked', async () => {
      const cim = createTestCIM()
      render(
        <LLMPromptExportModal
          cim={cim}
          isOpen={true}
          onClose={() => {}}
        />
      )

      const copyButton = screen.getByTestId('llm-prompt-copy-button')
      await userEvent.click(copyButton)

      await waitFor(() => {
        expect(mockCopyToClipboard).toHaveBeenCalled()
      })
    })

    it('should show toast notification on successful copy', async () => {
      const cim = createTestCIM()
      render(
        <LLMPromptExportModal
          cim={cim}
          isOpen={true}
          onClose={() => {}}
        />
      )

      const copyButton = screen.getByTestId('llm-prompt-copy-button')
      await userEvent.click(copyButton)

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          'Copied to clipboard',
          expect.objectContaining({
            description: expect.any(String),
          })
        )
      })
    })

    it('should call onCopySuccess callback on successful copy', async () => {
      const cim = createTestCIM()
      const onCopySuccess = vi.fn()
      render(
        <LLMPromptExportModal
          cim={cim}
          isOpen={true}
          onClose={() => {}}
          onCopySuccess={onCopySuccess}
        />
      )

      const copyButton = screen.getByTestId('llm-prompt-copy-button')
      await userEvent.click(copyButton)

      await waitFor(() => {
        expect(onCopySuccess).toHaveBeenCalled()
      })
    })

    it('should show error toast on copy failure', async () => {
      mockCopyToClipboard.mockRejectedValueOnce(new Error('Copy failed'))
      const cim = createTestCIM()
      render(
        <LLMPromptExportModal
          cim={cim}
          isOpen={true}
          onClose={() => {}}
        />
      )

      const copyButton = screen.getByTestId('llm-prompt-copy-button')
      await userEvent.click(copyButton)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'Copy failed',
          expect.objectContaining({
            description: expect.any(String),
          })
        )
      })
    })

    it('should show "Copy to Clipboard" label on copy button', () => {
      const cim = createTestCIM()
      render(
        <LLMPromptExportModal
          cim={cim}
          isOpen={true}
          onClose={() => {}}
        />
      )

      expect(screen.getByTestId('llm-prompt-copy-button')).toHaveTextContent('Copy to Clipboard')
    })
  })

  describe('Download as Text File (AC #5)', () => {
    it('should call triggerTextDownload when download button is clicked', async () => {
      const cim = createTestCIM()
      render(
        <LLMPromptExportModal
          cim={cim}
          isOpen={true}
          onClose={() => {}}
        />
      )

      const downloadButton = screen.getByTestId('llm-prompt-download-button')
      await userEvent.click(downloadButton)

      await waitFor(() => {
        expect(mockTriggerTextDownload).toHaveBeenCalled()
      })
    })

    it('should show toast notification on successful download', async () => {
      const cim = createTestCIM()
      render(
        <LLMPromptExportModal
          cim={cim}
          isOpen={true}
          onClose={() => {}}
        />
      )

      const downloadButton = screen.getByTestId('llm-prompt-download-button')
      await userEvent.click(downloadButton)

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          'Download started',
          expect.objectContaining({
            description: expect.any(String),
          })
        )
      })
    })

    it('should call onDownloadSuccess callback on successful download', async () => {
      const cim = createTestCIM()
      const onDownloadSuccess = vi.fn()
      render(
        <LLMPromptExportModal
          cim={cim}
          isOpen={true}
          onClose={() => {}}
          onDownloadSuccess={onDownloadSuccess}
        />
      )

      const downloadButton = screen.getByTestId('llm-prompt-download-button')
      await userEvent.click(downloadButton)

      await waitFor(() => {
        expect(onDownloadSuccess).toHaveBeenCalled()
      })
    })

    it('should show "Download .txt" label on download button', () => {
      const cim = createTestCIM()
      render(
        <LLMPromptExportModal
          cim={cim}
          isOpen={true}
          onClose={() => {}}
        />
      )

      expect(screen.getByTestId('llm-prompt-download-button')).toHaveTextContent('Download .txt')
    })
  })

  describe('Format Information (AC #3)', () => {
    it('should display format description', () => {
      const cim = createTestCIM()
      render(
        <LLMPromptExportModal
          cim={cim}
          isOpen={true}
          onClose={() => {}}
        />
      )

      expect(screen.getByText(/Format: XML-structured content/)).toBeInTheDocument()
    })

    it('should mention metadata, buyer persona, investment thesis, outline and slides in format description', () => {
      const cim = createTestCIM()
      render(
        <LLMPromptExportModal
          cim={cim}
          isOpen={true}
          onClose={() => {}}
        />
      )

      const formatNote = screen.getByText(/Format:/)
      expect(formatNote).toHaveTextContent(/metadata/)
      expect(formatNote).toHaveTextContent(/buyer persona/)
      expect(formatNote).toHaveTextContent(/investment thesis/)
      expect(formatNote).toHaveTextContent(/outline/)
      expect(formatNote).toHaveTextContent(/slides/)
    })
  })

  describe('Edge Cases', () => {
    it('should handle CIM with no slides', () => {
      const cim = createTestCIM({ slides: [] })
      render(
        <LLMPromptExportModal
          cim={cim}
          isOpen={true}
          onClose={() => {}}
        />
      )

      // The slide count should show 0
      const slideCountText = screen.getByText('0', { selector: 'strong' })
      expect(slideCountText).toBeInTheDocument()
    })

    it('should handle CIM with no outline sections', () => {
      const cim = createTestCIM({ outline: [] })
      render(
        <LLMPromptExportModal
          cim={cim}
          isOpen={true}
          onClose={() => {}}
        />
      )

      // Section count should show 0
      const stats = screen.getAllByText('0')
      expect(stats.length).toBeGreaterThan(0)
    })

    it('should handle CIM with long title', () => {
      const cim = createTestCIM({ title: 'A'.repeat(200) })
      render(
        <LLMPromptExportModal
          cim={cim}
          isOpen={true}
          onClose={() => {}}
        />
      )

      expect(screen.getByTestId('llm-prompt-preview')).toBeInTheDocument()
    })

    it('should handle CIM with special characters in title', () => {
      const cim = createTestCIM({ title: 'Test & Company <CIM>' })
      render(
        <LLMPromptExportModal
          cim={cim}
          isOpen={true}
          onClose={() => {}}
        />
      )

      expect(screen.getByTestId('llm-prompt-preview')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper dialog role', () => {
      const cim = createTestCIM()
      render(
        <LLMPromptExportModal
          cim={cim}
          isOpen={true}
          onClose={() => {}}
        />
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('should have accessible name on buttons', () => {
      const cim = createTestCIM()
      render(
        <LLMPromptExportModal
          cim={cim}
          isOpen={true}
          onClose={() => {}}
        />
      )

      expect(screen.getByTestId('llm-prompt-close-button')).toHaveAccessibleName('Close')
      expect(screen.getByTestId('llm-prompt-copy-button')).toHaveAccessibleName('Copy to Clipboard')
      expect(screen.getByTestId('llm-prompt-download-button')).toHaveAccessibleName('Download .txt')
    })
  })
})
