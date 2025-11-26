/**
 * Upload Zone Component
 * Story: E2.7 - Build Upload Progress Indicators and WebSocket Updates
 * Acceptance Criteria: AC1 (Drag-and-Drop), AC2 (File Picker Button)
 *
 * Features:
 * - Drag-and-drop with visual feedback (AC1)
 * - File picker button (AC2)
 * - Multiple file selection
 * - File type validation
 * - File size validation (500MB max per file)
 */

'use client'

import { useState, useCallback, useRef, type DragEvent } from 'react'
import { Upload, X, CloudUpload, FileUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useUploadStore } from '@/stores/upload-store'

/** Maximum file size in bytes (500MB) */
export const MAX_FILE_SIZE = 500 * 1024 * 1024

/** Allowed MIME types */
export const ALLOWED_MIME_TYPES = [
  // PDF
  'application/pdf',
  // Excel
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Word
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // PowerPoint
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Text
  'text/plain',
  'text/csv',
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]

/** Allowed file extensions (fallback) */
export const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.xls',
  '.xlsx',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.txt',
  '.csv',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
]

export interface UploadZoneProps {
  /** Project ID for uploads */
  projectId: string
  /** Target folder path (optional) */
  folderPath?: string | null
  /** Callback when files are added */
  onFilesAdded?: (files: File[]) => void
  /** Custom className */
  className?: string
  /** Compact mode (smaller UI) */
  compact?: boolean
  /** Disabled state */
  disabled?: boolean
}

export function UploadZone({
  projectId,
  folderPath,
  onFilesAdded,
  className,
  compact = false,
  disabled = false,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCountRef = useRef(0)

  const addToQueue = useUploadStore((state) => state.addToQueue)

  /** Validate a single file */
  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `"${file.name}" exceeds maximum size (500MB)`,
      }
    }

    // Check MIME type
    if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
      // Fallback to extension check
      const extension = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!ALLOWED_EXTENSIONS.includes(extension)) {
        return {
          valid: false,
          error: `"${file.name}" - file type not supported`,
        }
      }
    }

    // Extension-only check for empty MIME type
    if (!file.type) {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!ALLOWED_EXTENSIONS.includes(extension)) {
        return {
          valid: false,
          error: `"${file.name}" - file type not supported`,
        }
      }
    }

    return { valid: true }
  }, [])

  /** Process and add files to queue */
  const processFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files)
      const errors: string[] = []
      const validFiles: File[] = []

      for (const file of fileArray) {
        const result = validateFile(file)
        if (result.valid) {
          validFiles.push(file)
        } else if (result.error) {
          errors.push(result.error)
        }
      }

      // Show validation errors
      if (errors.length > 0) {
        setValidationErrors(errors)
        // Auto-clear errors after 5 seconds
        setTimeout(() => setValidationErrors([]), 5000)
      }

      // Add valid files to queue
      if (validFiles.length > 0) {
        addToQueue(validFiles, projectId, folderPath || undefined)
        onFilesAdded?.(validFiles)
      }
    },
    [projectId, folderPath, addToQueue, onFilesAdded, validateFile]
  )

  /** Handle drag enter */
  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (disabled) return

      dragCountRef.current++
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true)
      }
    },
    [disabled]
  )

  /** Handle drag leave */
  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    dragCountRef.current--
    if (dragCountRef.current === 0) {
      setIsDragging(false)
    }
  }, [])

  /** Handle drag over */
  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  /** Handle drop */
  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      dragCountRef.current = 0
      setIsDragging(false)

      if (disabled) return

      const { files } = e.dataTransfer
      if (files && files.length > 0) {
        processFiles(files)
      }
    },
    [disabled, processFiles]
  )

  /** Handle file input change */
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { files } = e.target
      if (files && files.length > 0) {
        processFiles(files)
      }
      // Reset input so same file can be selected again
      e.target.value = ''
    },
    [processFiles]
  )

  /** Open file picker */
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  /** Clear validation errors */
  const clearErrors = useCallback(() => {
    setValidationErrors([])
  }, [])

  return (
    <div className={cn('relative', className)}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ALLOWED_EXTENSIONS.join(',')}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
        aria-label="Select files to upload"
      />

      {/* Drop zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          'relative rounded-lg border-2 border-dashed transition-colors',
          compact ? 'p-4' : 'p-8',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50',
          disabled && 'cursor-not-allowed opacity-50'
        )}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={!disabled ? openFilePicker : undefined}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            openFilePicker()
          }
        }}
        aria-label="Drop files here or click to upload"
      >
        <div className="flex flex-col items-center justify-center text-center">
          {isDragging ? (
            <>
              <CloudUpload
                className={cn(
                  'text-primary',
                  compact ? 'mb-2 h-8 w-8' : 'mb-4 h-12 w-12'
                )}
              />
              <p className={cn('font-medium text-primary', compact ? 'text-sm' : 'text-base')}>
                Drop files here to upload
              </p>
            </>
          ) : (
            <>
              <FileUp
                className={cn(
                  'text-muted-foreground',
                  compact ? 'mb-2 h-8 w-8' : 'mb-4 h-12 w-12'
                )}
              />
              <p
                className={cn(
                  'font-medium text-foreground',
                  compact ? 'text-sm' : 'text-base'
                )}
              >
                Drag & drop files here
              </p>
              <p
                className={cn(
                  'text-muted-foreground',
                  compact ? 'mt-1 text-xs' : 'mt-2 text-sm'
                )}
              >
                or click to select files
              </p>
              {!compact && (
                <p className="mt-4 text-xs text-muted-foreground">
                  PDF, Excel, Word, PowerPoint, Text, CSV, Images (max 500MB per file)
                </p>
              )}
            </>
          )}
        </div>

        {/* Overlay when dragging */}
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 rounded-lg bg-primary/10" />
        )}
      </div>

      {/* Upload button (alternative to drag-drop) */}
      {!compact && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={openFilePicker}
            disabled={disabled}
            size="sm"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload Files
          </Button>
        </div>
      )}

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">
                Some files could not be added:
              </p>
              <ul className="mt-1 list-inside list-disc text-sm text-destructive/80">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                clearErrors()
              }}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
