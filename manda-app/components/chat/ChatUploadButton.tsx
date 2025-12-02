'use client'

/**
 * ChatUploadButton Component
 *
 * Upload button for the chat input area with file picker functionality.
 * Story: E5.9 - Implement Document Upload via Chat Interface
 * AC: #1 (File Picker Button in Chat Input)
 *
 * Features:
 * - Paperclip icon button to trigger file selection
 * - Hidden file input with same accepted formats as UploadZone
 * - Loading state during upload
 * - Accessible with ARIA labels
 */

import { useRef, useCallback } from 'react'
import { Paperclip, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ALLOWED_EXTENSIONS } from '@/components/data-room/upload-zone'
import { cn } from '@/lib/utils'

interface ChatUploadButtonProps {
  /** Callback when files are selected */
  onFilesSelected: (files: File[]) => void
  /** Loading state during upload */
  isLoading?: boolean
  /** Disabled state */
  disabled?: boolean
  /** Additional CSS classes */
  className?: string
}

export function ChatUploadButton({
  onFilesSelected,
  isLoading = false,
  disabled = false,
  className,
}: ChatUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  /** Open file picker dialog */
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  /** Handle file selection from input */
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { files } = e.target
      if (files && files.length > 0) {
        onFilesSelected(Array.from(files))
      }
      // Reset input so same file can be selected again
      e.target.value = ''
    },
    [onFilesSelected]
  )

  const isDisabled = disabled || isLoading

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ALLOWED_EXTENSIONS.join(',')}
        onChange={handleFileSelect}
        className="hidden"
        disabled={isDisabled}
        aria-label="Select files to upload"
        data-testid="chat-upload-file-input"
      />

      {/* Upload button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={openFilePicker}
              disabled={isDisabled}
              className={cn(
                'h-8 w-8 text-muted-foreground hover:text-foreground',
                isDisabled && 'cursor-not-allowed opacity-50',
                className
              )}
              aria-label={isLoading ? 'Uploading files...' : 'Attach files'}
              data-testid="chat-upload-button"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isLoading ? 'Uploading...' : 'Attach files (PDF, Excel, Word, images)'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </>
  )
}
