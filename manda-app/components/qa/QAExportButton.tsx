'use client'

/**
 * QA Export Button Component
 *
 * Button to export Q&A items to Excel file.
 * Story: E8.6 - Excel Export (AC: #4)
 *
 * Features:
 * - Accepts current filters as props
 * - Shows loading state during export (spinner on button)
 * - Displays success toast with filename after download
 * - Displays error toast if export fails
 * - Uses Download icon from lucide-react
 */

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { downloadQAExcel } from '@/lib/api/qa'
import type { QAFilters } from '@/lib/types/qa'

export interface QAExportButtonProps {
  projectId: string
  filters?: QAFilters
  disabled?: boolean
  className?: string
}

/**
 * Button component for exporting Q&A items to Excel
 *
 * @param projectId - Project ID for the Q&A export
 * @param filters - Current filters to apply to export (AC #4)
 * @param disabled - Whether the button is disabled
 * @param className - Optional additional CSS classes
 */
export function QAExportButton({
  projectId,
  filters,
  disabled = false,
  className,
}: QAExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    if (isExporting || disabled) return

    setIsExporting(true)

    try {
      // Download the Excel file (Task 4.3 - loading state during export)
      const filename = await downloadQAExcel(projectId, filters)

      // Task 4.4 - Display success toast with filename
      toast.success(`Q&A list exported successfully`, {
        description: filename,
        duration: 4000,
      })
    } catch (error) {
      console.error('[QAExportButton] Export failed:', error)

      // Task 4.5 - Display error toast if export fails
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to export Q&A list'

      toast.error('Export failed', {
        description: errorMessage,
        duration: 5000,
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isExporting || disabled}
      className={className}
      aria-label="Export Q&A list to Excel"
    >
      {isExporting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Exporting...</span>
        </>
      ) : (
        <>
          {/* Task 4.6 - Download icon from lucide-react */}
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
          <span>Export Excel</span>
        </>
      )}
    </Button>
  )
}

export default QAExportButton
