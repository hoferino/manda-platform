'use client'

/**
 * ExportButton - CIM Export Button with Dropdown
 *
 * Provides export functionality for CIMs with:
 * - Dropdown menu with export options
 * - Export Wireframe PPTX option
 * - Export LLM Prompt option (opens modal)
 * - Loading state during generation
 * - Disabled state when no slides exist
 * - Error handling with user feedback
 *
 * Story: E9.14 - Wireframe PowerPoint Export
 * Story: E9.15 - LLM Prompt Export
 * AC: #1 (Export Button Visibility), #6 (Browser Download)
 */

import * as React from 'react'
import { memo, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2, AlertCircle, CheckCircle, FileText, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { CIM } from '@/lib/types/cim'
import {
  exportCIMAsWireframe,
  triggerPPTXDownload,
} from '@/lib/services/cim-export'
import { LLMPromptExportModal } from './LLMPromptExportModal'

// ============================================================================
// Types
// ============================================================================

export interface ExportButtonProps {
  cim: CIM
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  onExportStart?: () => void
  onExportComplete?: (slideCount: number) => void
  onExportError?: (error: Error) => void
}

type ExportStatus = 'idle' | 'loading' | 'success' | 'error'

// ============================================================================
// Component
// ============================================================================

/**
 * ExportButton - Export dropdown with PPTX and LLM Prompt options
 *
 * Features:
 * - Dropdown with two export options (AC #1 - E9.15)
 * - Disabled when CIM has no slides (AC #1)
 * - Shows loading spinner during generation
 * - Triggers browser download without server round-trip (AC #6)
 * - Opens LLM prompt modal for structured export
 * - Provides success/error feedback
 */
export const ExportButton = memo(function ExportButton({
  cim,
  variant = 'outline',
  size = 'sm',
  className,
  onExportStart,
  onExportComplete,
  onExportError,
}: ExportButtonProps) {
  const [status, setStatus] = useState<ExportStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLLMPromptModalOpen, setIsLLMPromptModalOpen] = useState(false)

  // Determine if export is available (AC #1)
  const hasSlides = cim.slides.length > 0
  const isDisabled = !hasSlides || status === 'loading'

  // Handle PPTX export click
  const handlePPTXExport = useCallback(async () => {
    if (isDisabled) return

    try {
      setStatus('loading')
      setErrorMessage(null)
      onExportStart?.()

      // Generate PPTX (client-side, no server round-trip) (AC #6)
      const result = await exportCIMAsWireframe(cim)

      // Trigger browser download (AC #6)
      triggerPPTXDownload(result.blob, result.filename)

      setStatus('success')
      onExportComplete?.(result.slideCount)

      // Reset status after brief success indication
      setTimeout(() => setStatus('idle'), 2000)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Export failed')
      setStatus('error')
      setErrorMessage(error.message)
      onExportError?.(error)

      // Reset error status after showing message
      setTimeout(() => {
        setStatus('idle')
        setErrorMessage(null)
      }, 5000)
    }
  }, [cim, isDisabled, onExportStart, onExportComplete, onExportError])

  // Handle LLM Prompt export click (E9.15 AC #1)
  const handleLLMPromptExport = useCallback(() => {
    setIsLLMPromptModalOpen(true)
  }, [])

  // Render appropriate icon based on status
  const renderIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-4 w-4 animate-spin" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />
      default:
        return <Download className="h-4 w-4" />
    }
  }

  // Render button label
  const renderLabel = () => {
    switch (status) {
      case 'loading':
        return 'Exporting...'
      case 'success':
        return 'Exported!'
      case 'error':
        return 'Export Failed'
      default:
        return 'Export'
    }
  }

  // Tooltip content for disabled state
  const tooltipContent = !hasSlides
    ? 'Add slides to your CIM before exporting'
    : errorMessage
      ? errorMessage
      : 'Export CIM as PPTX or LLM Prompt'

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={variant}
                    size={size}
                    className={className}
                    disabled={isDisabled}
                    data-testid="export-button"
                    aria-label="Export CIM"
                  >
                    {renderIcon()}
                    <span className="ml-2">{renderLabel()}</span>
                    <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={handlePPTXExport}
                    disabled={isDisabled}
                    data-testid="export-pptx-option"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export Wireframe (PPTX)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleLLMPromptExport}
                    data-testid="export-llm-prompt-option"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Export LLM Prompt
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipContent}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* LLM Prompt Export Modal (E9.15) */}
      <LLMPromptExportModal
        cim={cim}
        isOpen={isLLMPromptModalOpen}
        onClose={() => setIsLLMPromptModalOpen(false)}
      />
    </>
  )
})

/**
 * ExportButtonIcon - Compact icon-only variant for toolbars
 */
export const ExportButtonIcon = memo(function ExportButtonIcon({
  cim,
  className,
  onExportStart,
  onExportComplete,
  onExportError,
}: Omit<ExportButtonProps, 'variant' | 'size'>) {
  const [status, setStatus] = useState<ExportStatus>('idle')
  const [isLLMPromptModalOpen, setIsLLMPromptModalOpen] = useState(false)

  const hasSlides = cim.slides.length > 0
  const isDisabled = !hasSlides || status === 'loading'

  const handlePPTXExport = useCallback(async () => {
    if (isDisabled) return

    try {
      setStatus('loading')
      onExportStart?.()

      const result = await exportCIMAsWireframe(cim)
      triggerPPTXDownload(result.blob, result.filename)

      setStatus('success')
      onExportComplete?.(result.slideCount)

      setTimeout(() => setStatus('idle'), 2000)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Export failed')
      setStatus('error')
      onExportError?.(error)

      setTimeout(() => setStatus('idle'), 3000)
    }
  }, [cim, isDisabled, onExportStart, onExportComplete, onExportError])

  const handleLLMPromptExport = useCallback(() => {
    setIsLLMPromptModalOpen(true)
  }, [])

  const renderIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-4 w-4 animate-spin" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />
      default:
        return <Download className="h-4 w-4" />
    }
  }

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={className}
                    disabled={isDisabled}
                    data-testid="export-button-icon"
                    aria-label="Export CIM"
                  >
                    {renderIcon()}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={handlePPTXExport}
                    disabled={isDisabled}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export Wireframe (PPTX)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLLMPromptExport}>
                    <FileText className="mr-2 h-4 w-4" />
                    Export LLM Prompt
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {!hasSlides
                ? 'Add slides to export'
                : status === 'loading'
                  ? 'Generating...'
                  : 'Export Options'}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* LLM Prompt Export Modal (E9.15) */}
      <LLMPromptExportModal
        cim={cim}
        isOpen={isLLMPromptModalOpen}
        onClose={() => setIsLLMPromptModalOpen(false)}
      />
    </>
  )
})

export default ExportButton
