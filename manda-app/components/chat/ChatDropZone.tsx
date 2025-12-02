'use client'

/**
 * ChatDropZone Component
 *
 * Drag-and-drop wrapper for the chat interface.
 * Story: E5.9 - Implement Document Upload via Chat Interface
 * AC: #2 (Drag-and-Drop Support)
 *
 * Features:
 * - Wraps chat interface to enable drag-and-drop uploads
 * - Visual overlay when dragging files over chat window
 * - Reuses validation logic from UploadZone
 * - Handles multiple files dropped at once
 */

import { useState, useCallback, useRef, type DragEvent, type ReactNode } from 'react'
import { CloudUpload, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
} from '@/components/data-room/upload-zone'
import { cn } from '@/lib/utils'

interface ChatDropZoneProps {
  /** Child elements (the chat interface) */
  children: ReactNode
  /** Project ID for context */
  projectId: string
  /** Callback when valid files are dropped */
  onFilesDropped: (files: File[]) => void
  /** Disabled state */
  disabled?: boolean
  /** Additional CSS classes */
  className?: string
}

interface ValidationResult {
  valid: boolean
  error?: string
}

/** Validate a single file */
function validateFile(file: File): ValidationResult {
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
}

export function ChatDropZone({
  children,
  projectId,
  onFilesDropped,
  disabled = false,
  className,
}: ChatDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const dragCountRef = useRef(0)

  /** Process and validate dropped files */
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

      // Pass valid files to callback
      if (validFiles.length > 0) {
        onFilesDropped(validFiles)
      }
    },
    [onFilesDropped]
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

  /** Clear validation errors */
  const clearErrors = useCallback(() => {
    setValidationErrors([])
  }, [])

  return (
    <div
      className={cn('relative h-full', className)}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      data-testid="chat-drop-zone"
    >
      {children}

      {/* Drag overlay */}
      {isDragging && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm"
          data-testid="chat-drop-overlay"
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="rounded-full bg-primary/10 p-6">
              <CloudUpload className="h-12 w-12 text-primary" />
            </div>
            <div>
              <p className="text-lg font-medium">Drop files to upload</p>
              <p className="text-sm text-muted-foreground">
                PDF, Excel, Word, PowerPoint, Text, CSV, Images (max 500MB)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Validation errors toast */}
      {validationErrors.length > 0 && (
        <div
          className="absolute bottom-4 left-4 right-4 z-50 rounded-lg border border-destructive/50 bg-destructive/10 p-4 shadow-lg"
          role="alert"
          data-testid="chat-drop-errors"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
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
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
              onClick={clearErrors}
              aria-label="Dismiss validation errors"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Export validation function for testing */
export { validateFile }
