/**
 * Upload Store - Zustand Store for Upload State Management
 * Story: E2.7 - Build Upload Progress Indicators and WebSocket Updates
 *
 * Features:
 * - Global upload state accessible across components
 * - Support for multiple concurrent uploads (limit: 3)
 * - Retry functionality for failed uploads
 * - Persistent across navigation (AC: #8)
 * - Progress tracking per file
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Document } from '@/lib/api/documents'

/** Maximum concurrent uploads */
export const MAX_CONCURRENT_UPLOADS = 3

/** Upload item status */
export type UploadStatus = 'queued' | 'uploading' | 'completed' | 'failed'

/** Single upload item */
export interface UploadItem {
  /** Unique identifier for this upload */
  id: string
  /** Original file reference (not persisted) */
  file?: File
  /** File name */
  fileName: string
  /** File size in bytes */
  fileSize: number
  /** MIME type */
  mimeType: string
  /** Upload status */
  status: UploadStatus
  /** Upload progress 0-100 */
  progress: number
  /** Error message if failed */
  error?: string
  /** Target project ID */
  projectId: string
  /** Target folder path (optional) */
  folderPath?: string
  /** IRL item ID to link document to (E2.8) */
  irlItemId?: string
  /** Created timestamp */
  createdAt: number
  /** Completed document (when successful) */
  document?: Document
  /** Retry count */
  retryCount: number
}

/** Upload store state */
interface UploadState {
  /** All upload items */
  uploads: UploadItem[]
  /** Whether uploads are being processed */
  isProcessing: boolean
}

/** Upload store actions */
interface UploadActions {
  /** Add files to upload queue */
  addToQueue: (
    files: File[],
    projectId: string,
    folderPath?: string | null,
    irlItemId?: string
  ) => UploadItem[]
  /** Update upload progress */
  updateProgress: (id: string, progress: number) => void
  /** Mark upload as completed */
  markCompleted: (id: string, document: Document) => void
  /** Mark upload as failed */
  markFailed: (id: string, error: string) => void
  /** Retry a failed upload */
  retryUpload: (id: string, file: File) => void
  /** Cancel/remove an upload */
  removeUpload: (id: string) => void
  /** Clear completed uploads */
  clearCompleted: () => void
  /** Get next queued upload to process */
  getNextQueued: () => UploadItem | undefined
  /** Set processing state */
  setProcessing: (processing: boolean) => void
  /** Mark upload as uploading */
  markUploading: (id: string) => void
  /** Get uploads for a specific project */
  getUploadsForProject: (projectId: string) => UploadItem[]
  /** Get total pending count (for badge) */
  getPendingCount: () => number
  /** Get currently uploading count */
  getUploadingCount: () => number
}

/** Generate unique ID */
function generateId(): string {
  return `upload-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/** Create upload item from file */
function createUploadItem(
  file: File,
  projectId: string,
  folderPath?: string | null,
  irlItemId?: string
): UploadItem {
  return {
    id: generateId(),
    file,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || 'application/octet-stream',
    status: 'queued',
    progress: 0,
    projectId,
    folderPath: folderPath || undefined,
    irlItemId,
    createdAt: Date.now(),
    retryCount: 0,
  }
}

export const useUploadStore = create<UploadState & UploadActions>()(
  persist(
    (set, get) => ({
      // State
      uploads: [],
      isProcessing: false,

      // Actions
      addToQueue: (files, projectId, folderPath, irlItemId) => {
        const newItems = files.map((file) =>
          createUploadItem(file, projectId, folderPath, irlItemId)
        )

        set((state) => ({
          uploads: [...state.uploads, ...newItems],
        }))

        return newItems
      },

      updateProgress: (id, progress) => {
        set((state) => ({
          uploads: state.uploads.map((upload) =>
            upload.id === id ? { ...upload, progress } : upload
          ),
        }))
      },

      markUploading: (id) => {
        set((state) => ({
          uploads: state.uploads.map((upload) =>
            upload.id === id ? { ...upload, status: 'uploading' } : upload
          ),
        }))
      },

      markCompleted: (id, document) => {
        set((state) => ({
          uploads: state.uploads.map((upload) =>
            upload.id === id
              ? {
                  ...upload,
                  status: 'completed',
                  progress: 100,
                  document,
                  file: undefined, // Clear file reference
                }
              : upload
          ),
        }))
      },

      markFailed: (id, error) => {
        set((state) => ({
          uploads: state.uploads.map((upload) =>
            upload.id === id
              ? { ...upload, status: 'failed', error }
              : upload
          ),
        }))
      },

      retryUpload: (id, file) => {
        set((state) => ({
          uploads: state.uploads.map((upload) =>
            upload.id === id
              ? {
                  ...upload,
                  file,
                  status: 'queued',
                  progress: 0,
                  error: undefined,
                  retryCount: upload.retryCount + 1,
                }
              : upload
          ),
        }))
      },

      removeUpload: (id) => {
        set((state) => ({
          uploads: state.uploads.filter((upload) => upload.id !== id),
        }))
      },

      clearCompleted: () => {
        set((state) => ({
          uploads: state.uploads.filter(
            (upload) => upload.status !== 'completed'
          ),
        }))
      },

      getNextQueued: () => {
        const { uploads } = get()
        return uploads.find((upload) => upload.status === 'queued')
      },

      setProcessing: (processing) => {
        set({ isProcessing: processing })
      },

      getUploadsForProject: (projectId) => {
        const { uploads } = get()
        return uploads.filter((upload) => upload.projectId === projectId)
      },

      getPendingCount: () => {
        const { uploads } = get()
        return uploads.filter(
          (upload) =>
            upload.status === 'queued' || upload.status === 'uploading'
        ).length
      },

      getUploadingCount: () => {
        const { uploads } = get()
        return uploads.filter((upload) => upload.status === 'uploading').length
      },
    }),
    {
      name: 'manda-uploads',
      // Only persist specific fields (not file objects or processing state)
      partialize: (state) => ({
        uploads: state.uploads.map(({ file, ...rest }) => rest),
      }),
      // Merge persisted state with initial state
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<UploadState>
        return {
          ...currentState,
          uploads: (persisted?.uploads || []).map((upload) => ({
            ...upload,
            // Reset uploading items to queued (they weren't completed before reload)
            status: upload.status === 'uploading' ? 'queued' : upload.status,
          })) as UploadItem[],
        }
      },
    }
  )
)

/** Get overall progress percentage across all uploads */
export function getOverallProgress(uploads: UploadItem[]): number {
  if (uploads.length === 0) return 0

  const totalProgress = uploads.reduce((sum, upload) => sum + upload.progress, 0)
  return Math.round(totalProgress / uploads.length)
}
