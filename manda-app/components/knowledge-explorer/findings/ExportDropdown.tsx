/**
 * ExportDropdown Component
 * Dropdown menu for exporting findings to CSV or Excel
 * Story: E4.10 - Implement Export Findings to CSV/Excel (AC: #1, #4, #5, #7)
 *
 * Features:
 * - Export button with dropdown menu
 * - CSV and Excel format options
 * - Shows finding count in confirmation
 * - Loading state during export
 * - Disabled state when no findings
 * - Keyboard accessible (Enter/Space to open)
 * - Warning for large exports (>5000 findings)
 */

'use client'

import { useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { exportFindings, type ExportFormat, type ExportFilters } from '@/lib/api/findings'
import { cn } from '@/lib/utils'

// Maximum findings per export
const MAX_EXPORT_FINDINGS = 5000

export interface ExportDropdownProps {
  projectId: string
  filters: ExportFilters
  findingCount: number
  searchQuery?: string
  disabled?: boolean
  className?: string
}

export function ExportDropdown({
  projectId,
  filters,
  findingCount,
  searchQuery,
  disabled = false,
  className,
}: ExportDropdownProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const isDisabled = disabled || findingCount === 0 || isExporting

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setIsOpen(false)
      setIsExporting(true)

      try {
        const result = await exportFindings(projectId, format, filters, searchQuery)

        // Announce to screen readers
        const announcement = `Exported ${result.count} findings to ${result.filename}`

        // Show success toast
        toast.success(announcement, {
          description: findingCount > MAX_EXPORT_FINDINGS
            ? `Note: Export limited to first ${MAX_EXPORT_FINDINGS} findings`
            : undefined,
        })

        // Return focus to trigger button for accessibility
        triggerRef.current?.focus()
      } catch (error) {
        console.error('Export failed:', error)
        toast.error('Export failed', {
          description: error instanceof Error ? error.message : 'Please try again',
        })
      } finally {
        setIsExporting(false)
      }
    },
    [projectId, filters, searchQuery, findingCount]
  )

  const showLimitWarning = findingCount > MAX_EXPORT_FINDINGS

  return (
    <TooltipProvider>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                ref={triggerRef}
                variant="outline"
                size="sm"
                className={cn('gap-2', className)}
                disabled={isDisabled}
                aria-label={
                  isExporting
                    ? 'Exporting findings...'
                    : findingCount === 0
                      ? 'No findings to export'
                      : `Export ${findingCount} findings`
                }
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{isExporting ? 'Exporting...' : 'Export'}</span>
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            {isDisabled && findingCount === 0 ? (
              <p>No findings to export</p>
            ) : (
              <>
                <p>Export {findingCount} findings</p>
                {showLimitWarning && (
                  <p className="text-xs text-yellow-500">
                    Only first {MAX_EXPORT_FINDINGS} will be exported
                  </p>
                )}
              </>
            )}
          </TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="end" className="w-56">
          {/* Warning for large exports */}
          {showLimitWarning && (
            <>
              <div className="px-2 py-1.5 text-xs text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 rounded-sm">
                Only first {MAX_EXPORT_FINDINGS} findings will be exported
              </div>
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuItem
            onClick={() => handleExport('csv')}
            className="gap-3 cursor-pointer"
            aria-label={`Export ${Math.min(findingCount, MAX_EXPORT_FINDINGS)} findings to CSV`}
          >
            <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <div className="flex flex-col">
              <span>Export to CSV</span>
              <span className="text-xs text-muted-foreground">
                {Math.min(findingCount, MAX_EXPORT_FINDINGS)} findings
              </span>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => handleExport('xlsx')}
            className="gap-3 cursor-pointer"
            aria-label={`Export ${Math.min(findingCount, MAX_EXPORT_FINDINGS)} findings to Excel`}
          >
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <div className="flex flex-col">
              <span>Export to Excel</span>
              <span className="text-xs text-muted-foreground">
                {Math.min(findingCount, MAX_EXPORT_FINDINGS)} findings with formatting
              </span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  )
}
