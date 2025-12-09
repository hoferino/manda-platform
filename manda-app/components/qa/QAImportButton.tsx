'use client'

/**
 * Q&A Import Button Component
 *
 * Button to trigger Excel import flow.
 * Story: E8.7 - Excel Import with Pattern Matching
 *
 * Features:
 * - File picker for Excel files
 * - Validates file type and size
 * - Opens import modal with preview
 */

import { useRef } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { ACCEPTED_MIME_TYPES, MAX_FILE_SIZE } from '@/lib/services/qa-import'

export interface QAImportButtonProps {
  disabled?: boolean
  className?: string
  onFileSelect: (file: File) => void
}

/**
 * Button component for importing Q&A items from Excel
 *
 * @param disabled - Whether the button is disabled
 * @param className - Optional additional CSS classes
 * @param onFileSelect - Callback when a valid file is selected
 */
export function QAImportButton({
  disabled = false,
  className,
  onFileSelect,
}: QAImportButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset input so same file can be selected again
    e.target.value = ''

    // Validate file type
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      toast.error('Invalid file type', {
        description: 'Please upload an Excel file (.xlsx)',
      })
      return
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large', {
        description: `Maximum file size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      })
      return
    }

    // Validate file is not empty
    if (file.size === 0) {
      toast.error('Empty file', {
        description: 'The uploaded file is empty',
      })
      return
    }

    onFileSelect(file)
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Select Excel file to import"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={disabled}
        className={className}
        aria-label="Import Q&A list from Excel"
      >
        <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
        <span>Import Excel</span>
      </Button>
    </>
  )
}

export default QAImportButton
