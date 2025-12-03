'use client'

/**
 * IRL Export Dropdown Component
 *
 * Dropdown menu for exporting IRL to PDF or Word format.
 * Story: E6.6 - Build IRL Export Functionality (PDF/Word)
 *
 * Features:
 * - PDF and Word export options with icons
 * - Loading state during export generation
 * - Toast notifications for success/failure
 * - Triggers browser download on success
 */

import { useState } from 'react'
import { FileDown, FileText, FileType, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { exportIRL, IRLExportFormat } from '@/lib/api/irl'
import { cn } from '@/lib/utils'

export interface IRLExportDropdownProps {
  /** Project ID */
  projectId: string
  /** IRL ID to export */
  irlId: string
  /** Whether export is disabled */
  disabled?: boolean
  /** Additional class names */
  className?: string
  /** Called when export starts */
  onExportStart?: () => void
  /** Called when export completes successfully */
  onExportComplete?: (result: { filename: string; count: number }) => void
  /** Called when export fails */
  onExportError?: (error: string) => void
}

export function IRLExportDropdown({
  projectId,
  irlId,
  disabled = false,
  className,
  onExportStart,
  onExportComplete,
  onExportError,
}: IRLExportDropdownProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<IRLExportFormat | null>(null)

  const handleExport = async (format: IRLExportFormat) => {
    if (isExporting) return

    setIsExporting(true)
    setExportFormat(format)
    onExportStart?.()

    try {
      const result = await exportIRL(projectId, irlId, format)

      toast.success(`Downloaded ${result.filename} with ${result.count} items`)

      onExportComplete?.(result)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Export failed'

      toast.error(errorMessage)

      onExportError?.(errorMessage)
    } finally {
      setIsExporting(false)
      setExportFormat(null)
    }
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled || isExporting}
              className={cn('gap-2', className)}
              aria-label="Export IRL"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Export</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Export IRL to PDF or Word</p>
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => handleExport('pdf')}
          disabled={isExporting}
          className="gap-2 cursor-pointer"
        >
          {exportFormat === 'pdf' && isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin text-red-500" />
          ) : (
            <FileText className="h-4 w-4 text-red-500" />
          )}
          <span>Export as PDF</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleExport('word')}
          disabled={isExporting}
          className="gap-2 cursor-pointer"
        >
          {exportFormat === 'word' && isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          ) : (
            <FileType className="h-4 w-4 text-blue-500" />
          )}
          <span>Export as Word</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
