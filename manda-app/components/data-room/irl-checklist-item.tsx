/**
 * IRL Checklist Item Component
 * Story: E2.8 - Implement IRL Integration with Document Tracking
 * AC: #2 (Hierarchical Checklist), #3 (Status Indicators), #5 (Quick Upload)
 */

'use client'

import { useState, useRef } from 'react'
import { Check, Circle, Upload, FileText, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { useUploadStore } from '@/stores/upload-store'
import { linkDocumentToIRLItem, unlinkDocumentFromIRLItem, type IRLItem } from '@/lib/api/irl'
import { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '@/components/data-room/upload-zone'

export interface IRLChecklistItemProps {
  item: IRLItem
  /** Called when user clicks upload button */
  onUpload?: () => void
  /** Called after successful upload/link action */
  onRefresh?: () => void
}

export function IRLChecklistItem({
  item,
  onUpload,
  onRefresh,
}: IRLChecklistItemProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [isUnlinking, setIsUnlinking] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addToQueue } = useUploadStore()

  const isCompleted = item.documentId !== null

  // Handle file selection for quick upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    if (!file) return

    // Validate file type
    const extension = `.${file.name.split('.').pop()?.toLowerCase()}`
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      toast.error(`File type ${extension} is not supported`)
      return
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File exceeds maximum size of 500MB`)
      return
    }

    setIsUploading(true)

    try {
      // Add to upload queue with IRL item reference
      // The upload processor will link the document after upload completes
      addToQueue(
        [file],
        '', // projectId will be taken from context
        null, // folderPath
        item.id // irlItemId
      )

      toast.success(`"${file.name}" added to upload queue`)
      onRefresh?.()
    } catch (error) {
      console.error('Error queuing file:', error)
      toast.error('Failed to queue file for upload')
    } finally {
      setIsUploading(false)
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Handle unlinking document
  const handleUnlink = async () => {
    if (!item.documentId) return

    setIsUnlinking(true)
    try {
      const result = await unlinkDocumentFromIRLItem(item.documentId)
      if (result.success) {
        toast.success('Document unlinked from IRL item')
        onRefresh?.()
      } else {
        toast.error(result.error || 'Failed to unlink document')
      }
    } catch (error) {
      console.error('Error unlinking document:', error)
      toast.error('Failed to unlink document')
    } finally {
      setIsUnlinking(false)
    }
  }

  // Open file picker
  const handleUploadClick = () => {
    if (onUpload) {
      onUpload()
    } else {
      fileInputRef.current?.click()
    }
  }

  return (
    <TooltipProvider>
      <div
        className={cn(
          'flex items-start gap-2 rounded-md px-2 py-1.5 text-sm',
          'hover:bg-muted/50 transition-colors',
          isCompleted && 'bg-green-50/50 dark:bg-green-950/20'
        )}
      >
        {/* Status Icon */}
        <div className="mt-0.5 flex-shrink-0">
          {isCompleted ? (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white">
              <Check className="h-3 w-3" />
            </div>
          ) : (
            <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-muted-foreground/30">
              <Circle className="h-3 w-3 text-muted-foreground/30" />
            </div>
          )}
        </div>

        {/* Item Content */}
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'font-medium leading-tight',
              isCompleted && 'text-green-700 dark:text-green-400'
            )}
          >
            {item.name}
          </p>

          {/* Linked Document */}
          {isCompleted && item.documentName && (
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <FileText className="h-3 w-3" />
              <span className="truncate">{item.documentName}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 ml-1 hover:bg-destructive/10"
                    onClick={handleUnlink}
                    disabled={isUnlinking}
                  >
                    {isUnlinking ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Unlink document</TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Description */}
          {item.description && !isCompleted && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
              {item.description}
            </p>
          )}
        </div>

        {/* Upload Button (only for incomplete items) */}
        {!isCompleted && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 flex-shrink-0"
                  onClick={handleUploadClick}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Upload document</TooltipContent>
            </Tooltip>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={ALLOWED_EXTENSIONS.join(',')}
              onChange={handleFileSelect}
            />
          </>
        )}

        {/* Required indicator */}
        {item.required && !isCompleted && (
          <span className="text-xs text-destructive">*</span>
        )}
      </div>
    </TooltipProvider>
  )
}
