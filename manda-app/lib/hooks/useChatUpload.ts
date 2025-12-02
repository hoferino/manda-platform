'use client'

/**
 * useChatUpload Hook
 *
 * Manages document uploads from the chat interface.
 * Story: E5.9 - Implement Document Upload via Chat Interface
 * AC: #3 (Upload Triggers Processing Pipeline)
 * AC: #4 (Status Updates via Chat Messages)
 *
 * Features:
 * - Upload files with progress tracking via XHR
 * - Track multiple uploads concurrently (max 3)
 * - Emit status updates for chat display
 * - Subscribe to processing status updates via Supabase Realtime
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useDocumentUpdates, didProcessingComplete, didProcessingFail } from './useDocumentUpdates'
import type { ProcessingError } from '@/lib/api/documents'

/** Extract error message string from processingError */
function getErrorMessage(error: string | ProcessingError | null | undefined): string {
  if (!error) return 'Processing failed'
  if (typeof error === 'string') return error
  return error.user_message || error.message || 'Processing failed'
}

/** Upload status stages */
export type ChatUploadStage =
  | 'uploading'
  | 'uploaded'
  | 'parsing'
  | 'embedding'
  | 'analyzing'
  | 'complete'
  | 'failed'

/** Single chat upload item */
export interface ChatUploadItem {
  /** Unique ID for this upload */
  id: string
  /** Original file name */
  fileName: string
  /** File size in bytes */
  fileSize: number
  /** Current upload/processing stage */
  stage: ChatUploadStage
  /** Upload progress 0-100 */
  uploadProgress: number
  /** Document ID from database (after upload completes) */
  documentId?: string
  /** Number of findings extracted (after processing completes) */
  findingsCount?: number
  /** Error message if failed */
  error?: string
  /** Timestamp when upload started */
  startedAt: Date
  /** Timestamp when processing completed */
  completedAt?: Date
}

/** Upload response from API */
interface UploadResponse {
  success: boolean
  document?: {
    id: string
    name: string
    size: number
    mimeType: string
    processingStatus: string
  }
  error?: string
}

/** Maximum concurrent uploads */
const MAX_CONCURRENT_UPLOADS = 3

/** Generate unique ID */
function generateId(): string {
  return `chat-upload-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Upload a file with progress tracking using XMLHttpRequest
 */
function uploadWithProgress(
  file: File,
  projectId: string,
  conversationId: string | undefined,
  onProgress: (progress: number) => void
): Promise<UploadResponse> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()

    formData.append('file', file)
    if (conversationId) {
      formData.append('conversationId', conversationId)
    }

    // Progress event
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100)
        onProgress(progress)
      }
    })

    // Load event (success)
    xhr.addEventListener('load', () => {
      try {
        const response = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300 && response.success) {
          resolve({
            success: true,
            document: response.document,
          })
        } else {
          resolve({
            success: false,
            error: response.error || `Upload failed (${xhr.status})`,
          })
        }
      } catch {
        resolve({
          success: false,
          error: 'Invalid server response',
        })
      }
    })

    // Error event
    xhr.addEventListener('error', () => {
      resolve({
        success: false,
        error: 'Network error during upload',
      })
    })

    // Abort event
    xhr.addEventListener('abort', () => {
      resolve({
        success: false,
        error: 'Upload cancelled',
      })
    })

    // Timeout event
    xhr.addEventListener('timeout', () => {
      resolve({
        success: false,
        error: 'Upload timed out',
      })
    })

    // Configure and send
    xhr.open('POST', `/api/projects/${projectId}/chat/upload`)
    xhr.timeout = 600000 // 10 minutes timeout for large files
    xhr.send(formData)
  })
}

interface UseChatUploadOptions {
  /** Current conversation ID */
  conversationId?: string | null
  /** Callback when upload status changes */
  onStatusChange?: (upload: ChatUploadItem) => void
}

export function useChatUpload(
  projectId: string,
  options: UseChatUploadOptions = {}
) {
  const { conversationId, onStatusChange } = options

  const [uploads, setUploads] = useState<ChatUploadItem[]>([])
  const processingRef = useRef(false)
  const pendingFilesRef = useRef<File[]>([])

  /** Map processing_status from API to ChatUploadStage */
  const mapProcessingStatus = useCallback((status: string): ChatUploadStage => {
    switch (status) {
      case 'pending':
        return 'uploaded'
      case 'parsing':
        return 'parsing'
      case 'embedding':
        return 'embedding'
      case 'analyzing':
        return 'analyzing'
      case 'complete':
        return 'complete'
      case 'failed':
      case 'parsing_failed':
      case 'embedding_failed':
      case 'analysis_failed':
        return 'failed'
      default:
        return 'uploaded'
    }
  }, [])

  /** Update a specific upload item */
  const updateUpload = useCallback(
    (id: string, updates: Partial<ChatUploadItem>) => {
      setUploads((prev) => {
        const updated = prev.map((upload) =>
          upload.id === id ? { ...upload, ...updates } : upload
        )
        // Find the updated item and call callback
        const updatedItem = updated.find((u) => u.id === id)
        if (updatedItem && onStatusChange) {
          onStatusChange(updatedItem)
        }
        return updated
      })
    },
    [onStatusChange]
  )

  /** Process a single file upload */
  const processUpload = useCallback(
    async (file: File, uploadId: string) => {
      // Update to uploading state
      updateUpload(uploadId, {
        stage: 'uploading',
        uploadProgress: 0,
      })

      const result = await uploadWithProgress(
        file,
        projectId,
        conversationId || undefined,
        (progress) => {
          updateUpload(uploadId, { uploadProgress: progress })
        }
      )

      if (result.success && result.document) {
        // Upload succeeded, waiting for processing
        updateUpload(uploadId, {
          stage: 'uploaded',
          uploadProgress: 100,
          documentId: result.document.id,
        })
      } else {
        // Upload failed
        updateUpload(uploadId, {
          stage: 'failed',
          error: result.error || 'Upload failed',
          completedAt: new Date(),
        })
      }
    },
    [projectId, conversationId, updateUpload]
  )

  /** Process queue of pending files */
  const processQueue = useCallback(async () => {
    if (processingRef.current) return
    processingRef.current = true

    try {
      while (pendingFilesRef.current.length > 0) {
        // Count active uploads
        const activeCount = uploads.filter(
          (u) => u.stage === 'uploading'
        ).length

        if (activeCount >= MAX_CONCURRENT_UPLOADS) {
          break
        }

        const file = pendingFilesRef.current.shift()
        if (!file) break

        // Create upload item
        const uploadId = generateId()
        const newUpload: ChatUploadItem = {
          id: uploadId,
          fileName: file.name,
          fileSize: file.size,
          stage: 'uploading',
          uploadProgress: 0,
          startedAt: new Date(),
        }

        setUploads((prev) => [...prev, newUpload])
        if (onStatusChange) {
          onStatusChange(newUpload)
        }

        // Start upload (don't await - process in parallel)
        processUpload(file, uploadId)
      }
    } finally {
      processingRef.current = false
    }
  }, [uploads, processUpload, onStatusChange])

  /** Add files to upload queue */
  const uploadFiles = useCallback(
    (files: File[]) => {
      pendingFilesRef.current.push(...files)
      processQueue()
    },
    [processQueue]
  )

  /** Retry a failed upload */
  const retryUpload = useCallback(
    (uploadId: string, file: File) => {
      setUploads((prev) =>
        prev.map((upload) =>
          upload.id === uploadId
            ? {
                ...upload,
                stage: 'uploading' as ChatUploadStage,
                uploadProgress: 0,
                error: undefined,
                startedAt: new Date(),
                completedAt: undefined,
              }
            : upload
        )
      )
      processUpload(file, uploadId)
    },
    [processUpload]
  )

  /** Clear completed or failed uploads */
  const clearCompleted = useCallback(() => {
    setUploads((prev) =>
      prev.filter((u) => u.stage !== 'complete' && u.stage !== 'failed')
    )
  }, [])

  /** Dismiss a specific upload */
  const dismissUpload = useCallback((uploadId: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== uploadId))
  }, [])

  /** Subscribe to document processing updates via Supabase Realtime */
  useDocumentUpdates(projectId, {
    onUpdate: (update) => {
      // Find upload item that matches this document
      const matchingUpload = uploads.find(
        (u) => u.documentId === update.document.id
      )

      if (!matchingUpload) return

      // Check if processing completed
      if (didProcessingComplete(update.oldDocument, update.document)) {
        updateUpload(matchingUpload.id, {
          stage: 'complete',
          findingsCount: update.document.findingsCount || 0,
          completedAt: new Date(),
        })
      }
      // Check if processing failed
      else if (didProcessingFail(update.oldDocument, update.document)) {
        updateUpload(matchingUpload.id, {
          stage: 'failed',
          error: getErrorMessage(update.document.processingError),
          completedAt: new Date(),
        })
      }
      // Update processing stage
      else if (update.document.processingStatus) {
        const newStage = mapProcessingStatus(update.document.processingStatus)
        if (newStage !== matchingUpload.stage) {
          updateUpload(matchingUpload.id, { stage: newStage })
        }
      }
    },
    enabled: uploads.some(
      (u) => u.documentId && u.stage !== 'complete' && u.stage !== 'failed'
    ),
  })

  // Watch for completed uploads to process more from queue
  useEffect(() => {
    const uploadingCount = uploads.filter((u) => u.stage === 'uploading').length
    if (pendingFilesRef.current.length > 0 && uploadingCount < MAX_CONCURRENT_UPLOADS) {
      const timer = setTimeout(processQueue, 100)
      return () => clearTimeout(timer)
    }
  }, [uploads, processQueue])

  return {
    /** Current uploads */
    uploads,
    /** Add files to upload queue */
    uploadFiles,
    /** Retry a failed upload */
    retryUpload,
    /** Clear completed/failed uploads */
    clearCompleted,
    /** Dismiss a specific upload */
    dismissUpload,
    /** Whether any uploads are in progress */
    isUploading: uploads.some((u) => u.stage === 'uploading'),
    /** Whether any processing is in progress */
    isProcessing: uploads.some(
      (u) =>
        u.stage === 'uploaded' ||
        u.stage === 'parsing' ||
        u.stage === 'embedding' ||
        u.stage === 'analyzing'
    ),
  }
}
