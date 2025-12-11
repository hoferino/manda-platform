'use client'

/**
 * ExportButton - CIM Wireframe PowerPoint Export Button
 *
 * Provides export functionality for CIMs with:
 * - Download icon and "Export Wireframe" label
 * - Loading state during generation
 * - Disabled state when no slides exist
 * - Error handling with user feedback
 *
 * Story: E9.14 - Wireframe PowerPoint Export
 * AC: #1 (Export Button Visibility), #6 (Browser Download)
 */

import * as React from 'react'
import { memo, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
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
 * ExportButton - Trigger wireframe PPTX export for a CIM
 *
 * Features:
 * - Disabled when CIM has no slides (AC #1)
 * - Shows loading spinner during generation
 * - Triggers browser download without server round-trip (AC #6)
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

  // Determine if export is available (AC #1)
  const hasSlides = cim.slides.length > 0
  const isDisabled = !hasSlides || status === 'loading'

  // Handle export click
  const handleExport = useCallback(async () => {
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
        return 'Export Wireframe'
    }
  }

  // Tooltip content for disabled state
  const tooltipContent = !hasSlides
    ? 'Add slides to your CIM before exporting'
    : errorMessage
      ? errorMessage
      : 'Export as PowerPoint wireframe'

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            className={className}
            disabled={isDisabled}
            onClick={handleExport}
            data-testid="export-button"
            aria-label="Export CIM as wireframe PowerPoint"
          >
            {renderIcon()}
            <span className="ml-2">{renderLabel()}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipContent}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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

  const hasSlides = cim.slides.length > 0
  const isDisabled = !hasSlides || status === 'loading'

  const handleExport = useCallback(async () => {
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
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={className}
            disabled={isDisabled}
            onClick={handleExport}
            data-testid="export-button-icon"
            aria-label="Export CIM as wireframe PowerPoint"
          >
            {renderIcon()}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {!hasSlides
              ? 'Add slides to export'
              : status === 'loading'
                ? 'Generating...'
                : 'Export Wireframe'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
})

export default ExportButton
