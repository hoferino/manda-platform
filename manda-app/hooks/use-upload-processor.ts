/**
 * Upload Processor Hook
 * Story: E2.7 - Build Upload Progress Indicators and WebSocket Updates
 * Story: E12.9 - Multi-Tenant Data Isolation (AC: #9 - API client includes org header)
 * Acceptance Criteria: AC3 (Progress), AC5 (Retry), AC6 (Bulk/Parallel), AC7 (Notifications)
 *
 * Features:
 * - Process queued uploads with progress tracking
 * - Limit concurrent uploads (default: 3)
 * - XMLHttpRequest for real progress events
 * - Toast notifications for completion/failure
 * - Retry support
 */

'use client'

import { useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  useUploadStore,
  MAX_CONCURRENT_UPLOADS,
  type UploadItem,
} from '@/stores/upload-store'
import type { Document } from '@/lib/api/documents'
import { getOrganizationId } from '@/lib/api/client'

interface UploadResponse {
  success: boolean
  document?: Document
  error?: string
}

/**
 * Upload a file with progress tracking using XMLHttpRequest
 */
function uploadWithProgress(
  file: File,
  projectId: string,
  folderPath: string | undefined,
  irlItemId: string | undefined,
  onProgress: (progress: number) => void
): Promise<UploadResponse> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()

    formData.append('file', file)
    formData.append('projectId', projectId)
    if (folderPath) {
      formData.append('folderPath', folderPath)
    }
    // E2.8: Support IRL item linking
    if (irlItemId) {
      formData.append('irlItemId', irlItemId)
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
    xhr.open('POST', '/api/documents/upload')
    xhr.timeout = 600000 // 10 minutes timeout for large files

    // E12.9: Add organization header for multi-tenant isolation
    const orgId = getOrganizationId()
    if (orgId) {
      xhr.setRequestHeader('x-organization-id', orgId)
    }

    xhr.send(formData)
  })
}

/**
 * Hook to process upload queue
 * Should be used in a component that persists across navigation (e.g., layout)
 */
export function useUploadProcessor() {
  const processingRef = useRef(false)
  const activeUploadsRef = useRef<Set<string>>(new Set())

  const uploads = useUploadStore((state) => state.uploads)
  const getNextQueued = useUploadStore((state) => state.getNextQueued)
  const getUploadingCount = useUploadStore((state) => state.getUploadingCount)
  const markUploading = useUploadStore((state) => state.markUploading)
  const updateProgress = useUploadStore((state) => state.updateProgress)
  const markCompleted = useUploadStore((state) => state.markCompleted)
  const markFailed = useUploadStore((state) => state.markFailed)

  const processUpload = useCallback(
    async (item: UploadItem) => {
      // Skip if no file (can happen after page reload)
      if (!item.file) {
        markFailed(item.id, 'File not available. Please add the file again.')
        return
      }

      activeUploadsRef.current.add(item.id)
      markUploading(item.id)

      const result = await uploadWithProgress(
        item.file,
        item.projectId,
        item.folderPath,
        item.irlItemId,
        (progress) => {
          updateProgress(item.id, progress)
        }
      )

      activeUploadsRef.current.delete(item.id)

      if (result.success && result.document) {
        markCompleted(item.id, result.document)

        // Success toast (AC7)
        toast.success(`Uploaded "${item.fileName}"`, {
          duration: 3000,
        })
      } else {
        markFailed(item.id, result.error || 'Upload failed')

        // Error toast with retry (AC7)
        toast.error(`Failed to upload "${item.fileName}"`, {
          description: result.error,
          duration: 5000,
          action: {
            label: 'Details',
            onClick: () => {
              // Could open details panel
            },
          },
        })
      }
    },
    [markUploading, updateProgress, markCompleted, markFailed]
  )

  const processQueue = useCallback(async () => {
    if (processingRef.current) return
    processingRef.current = true

    try {
      // Process uploads while there are queued items and capacity
      while (true) {
        const uploadingCount = getUploadingCount()
        if (uploadingCount >= MAX_CONCURRENT_UPLOADS) {
          break
        }

        const nextItem = getNextQueued()
        if (!nextItem) {
          break
        }

        // Start upload (don't await - process in parallel)
        processUpload(nextItem)
      }
    } finally {
      processingRef.current = false
    }
  }, [getUploadingCount, getNextQueued, processUpload])

  // Watch for new queued items
  useEffect(() => {
    const hasQueued = uploads.some((u) => u.status === 'queued')
    const uploadingCount = uploads.filter((u) => u.status === 'uploading').length

    if (hasQueued && uploadingCount < MAX_CONCURRENT_UPLOADS) {
      processQueue()
    }
  }, [uploads, processQueue])

  // Watch for completed uploads to process more
  useEffect(() => {
    const uploadingCount = uploads.filter((u) => u.status === 'uploading').length
    const hasQueued = uploads.some((u) => u.status === 'queued')

    if (hasQueued && uploadingCount < MAX_CONCURRENT_UPLOADS) {
      // Small delay to prevent rapid re-processing
      const timer = setTimeout(() => {
        processQueue()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [uploads, processQueue])

  return {
    processQueue,
    isProcessing: processingRef.current,
  }
}

/**
 * Store file references for retry functionality
 * Files can't be persisted in localStorage, so we keep them in memory
 */
const fileStore = new Map<string, File>()

export function storeFileForRetry(id: string, file: File) {
  fileStore.set(id, file)
}

export function getFileForRetry(id: string): File | undefined {
  return fileStore.get(id)
}

export function clearFileFromStore(id: string) {
  fileStore.delete(id)
}
