/**
 * Unit tests for Upload Store
 * Story: E2.7 - Build Upload Progress Indicators and WebSocket Updates
 * Tests: AC4 (Status States), AC5 (Retry), AC6 (Bulk Upload)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import {
  useUploadStore,
  getOverallProgress,
  MAX_CONCURRENT_UPLOADS,
  type UploadItem,
} from '@/stores/upload-store'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get store() {
      return store
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Helper to create mock file
function createMockFile(name: string, size: number): File {
  const blob = new Blob(['x'.repeat(size)], { type: 'application/pdf' })
  return new File([blob], name, { type: 'application/pdf' })
}

describe('Upload Store', () => {
  beforeEach(() => {
    // Reset store state
    useUploadStore.setState({ uploads: [], isProcessing: false })
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  describe('addToQueue', () => {
    it('adds files to upload queue with queued status', () => {
      const file = createMockFile('test.pdf', 1024)

      act(() => {
        useUploadStore.getState().addToQueue([file], 'project-123', '/docs')
      })

      const { uploads } = useUploadStore.getState()
      expect(uploads).toHaveLength(1)
      expect(uploads[0]?.status).toBe('queued')
      expect(uploads[0]?.progress).toBe(0)
      expect(uploads[0]?.projectId).toBe('project-123')
      expect(uploads[0]?.folderPath).toBe('/docs')
      expect(uploads[0]?.fileName).toBe('test.pdf')
      expect(uploads[0]?.fileSize).toBe(1024)
    })

    it('adds multiple files at once (AC6)', () => {
      const files = [
        createMockFile('doc1.pdf', 1024),
        createMockFile('doc2.pdf', 2048),
        createMockFile('doc3.pdf', 3072),
      ]

      act(() => {
        useUploadStore.getState().addToQueue(files, 'project-123')
      })

      const { uploads } = useUploadStore.getState()
      expect(uploads).toHaveLength(3)
      expect(uploads.every((u) => u.status === 'queued')).toBe(true)
    })

    it('generates unique IDs for each upload', () => {
      const files = [
        createMockFile('doc1.pdf', 1024),
        createMockFile('doc2.pdf', 2048),
      ]

      act(() => {
        useUploadStore.getState().addToQueue(files, 'project-123')
      })

      const { uploads } = useUploadStore.getState()
      const ids = uploads.map((u) => u.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('returns created upload items', () => {
      const file = createMockFile('test.pdf', 1024)

      let result: UploadItem[] = []
      act(() => {
        result = useUploadStore.getState().addToQueue([file], 'project-123')
      })

      expect(result).toHaveLength(1)
      expect(result[0]?.fileName).toBe('test.pdf')
    })
  })

  describe('updateProgress', () => {
    it('updates progress for specific upload', () => {
      const file = createMockFile('test.pdf', 1024)

      act(() => {
        useUploadStore.getState().addToQueue([file], 'project-123')
      })

      const { uploads } = useUploadStore.getState()
      const uploadId = uploads[0]?.id

      act(() => {
        useUploadStore.getState().updateProgress(uploadId!, 50)
      })

      expect(useUploadStore.getState().uploads[0]?.progress).toBe(50)
    })
  })

  describe('Status Transitions (AC4)', () => {
    it('marks upload as uploading', () => {
      const file = createMockFile('test.pdf', 1024)

      act(() => {
        useUploadStore.getState().addToQueue([file], 'project-123')
      })

      const uploadId = useUploadStore.getState().uploads[0]?.id

      act(() => {
        useUploadStore.getState().markUploading(uploadId!)
      })

      expect(useUploadStore.getState().uploads[0]?.status).toBe('uploading')
    })

    it('marks upload as completed with document', () => {
      const file = createMockFile('test.pdf', 1024)

      act(() => {
        useUploadStore.getState().addToQueue([file], 'project-123')
      })

      const uploadId = useUploadStore.getState().uploads[0]?.id
      const mockDocument = {
        id: 'doc-123',
        projectId: 'project-123',
        name: 'test.pdf',
        size: 1024,
        mimeType: 'application/pdf',
        category: null,
        folderPath: null,
        uploadStatus: 'completed' as const,
        processingStatus: 'pending' as const,
        createdAt: new Date().toISOString(),
      }

      act(() => {
        useUploadStore.getState().markCompleted(uploadId!, mockDocument)
      })

      const upload = useUploadStore.getState().uploads[0]
      expect(upload?.status).toBe('completed')
      expect(upload?.progress).toBe(100)
      expect(upload?.document).toEqual(mockDocument)
      expect(upload?.file).toBeUndefined() // File reference cleared
    })

    it('marks upload as failed with error message', () => {
      const file = createMockFile('test.pdf', 1024)

      act(() => {
        useUploadStore.getState().addToQueue([file], 'project-123')
      })

      const uploadId = useUploadStore.getState().uploads[0]?.id

      act(() => {
        useUploadStore.getState().markFailed(uploadId!, 'Network error')
      })

      const upload = useUploadStore.getState().uploads[0]
      expect(upload?.status).toBe('failed')
      expect(upload?.error).toBe('Network error')
    })
  })

  describe('Retry Functionality (AC5)', () => {
    it('resets failed upload to queued status', () => {
      const file = createMockFile('test.pdf', 1024)

      act(() => {
        useUploadStore.getState().addToQueue([file], 'project-123')
      })

      const uploadId = useUploadStore.getState().uploads[0]?.id

      // Mark as failed first
      act(() => {
        useUploadStore.getState().markFailed(uploadId!, 'Network error')
      })

      expect(useUploadStore.getState().uploads[0]?.status).toBe('failed')

      // Retry
      const newFile = createMockFile('test.pdf', 1024)
      act(() => {
        useUploadStore.getState().retryUpload(uploadId!, newFile)
      })

      const upload = useUploadStore.getState().uploads[0]
      expect(upload?.status).toBe('queued')
      expect(upload?.progress).toBe(0)
      expect(upload?.error).toBeUndefined()
      expect(upload?.retryCount).toBe(1)
    })

    it('increments retry count on each retry', () => {
      const file = createMockFile('test.pdf', 1024)

      act(() => {
        useUploadStore.getState().addToQueue([file], 'project-123')
      })

      const uploadId = useUploadStore.getState().uploads[0]?.id

      // Fail and retry multiple times
      for (let i = 0; i < 3; i++) {
        act(() => {
          useUploadStore.getState().markFailed(uploadId!, 'Error')
          useUploadStore.getState().retryUpload(uploadId!, createMockFile('test.pdf', 1024))
        })
      }

      expect(useUploadStore.getState().uploads[0]?.retryCount).toBe(3)
    })
  })

  describe('removeUpload', () => {
    it('removes upload from queue', () => {
      const file = createMockFile('test.pdf', 1024)

      act(() => {
        useUploadStore.getState().addToQueue([file], 'project-123')
      })

      const uploadId = useUploadStore.getState().uploads[0]?.id

      act(() => {
        useUploadStore.getState().removeUpload(uploadId!)
      })

      expect(useUploadStore.getState().uploads).toHaveLength(0)
    })
  })

  describe('clearCompleted', () => {
    it('removes only completed uploads', () => {
      const files = [
        createMockFile('doc1.pdf', 1024),
        createMockFile('doc2.pdf', 2048),
        createMockFile('doc3.pdf', 3072),
      ]

      act(() => {
        useUploadStore.getState().addToQueue(files, 'project-123')
      })

      const uploads = useUploadStore.getState().uploads
      const mockDocument = {
        id: 'doc',
        projectId: 'project-123',
        name: 'doc1.pdf',
        size: 1024,
        mimeType: 'application/pdf',
        category: null,
        folderPath: null,
        uploadStatus: 'completed' as const,
        processingStatus: 'pending' as const,
        createdAt: new Date().toISOString(),
      }

      // Mark first as completed, second as failed, third stays queued
      act(() => {
        useUploadStore.getState().markCompleted(uploads[0]!.id, mockDocument)
        useUploadStore.getState().markFailed(uploads[1]!.id, 'Error')
      })

      act(() => {
        useUploadStore.getState().clearCompleted()
      })

      const remaining = useUploadStore.getState().uploads
      expect(remaining).toHaveLength(2) // Failed and queued remain
      expect(remaining.find((u) => u.status === 'completed')).toBeUndefined()
    })
  })

  describe('getNextQueued', () => {
    it('returns first queued upload', () => {
      const files = [
        createMockFile('doc1.pdf', 1024),
        createMockFile('doc2.pdf', 2048),
      ]

      act(() => {
        useUploadStore.getState().addToQueue(files, 'project-123')
      })

      // Mark first as uploading
      act(() => {
        useUploadStore.getState().markUploading(
          useUploadStore.getState().uploads[0]!.id
        )
      })

      const next = useUploadStore.getState().getNextQueued()
      expect(next?.fileName).toBe('doc2.pdf')
    })

    it('returns undefined when no queued uploads', () => {
      expect(useUploadStore.getState().getNextQueued()).toBeUndefined()
    })
  })

  describe('getUploadsForProject', () => {
    it('filters uploads by project ID', () => {
      const files = [createMockFile('doc1.pdf', 1024)]

      act(() => {
        useUploadStore.getState().addToQueue(files, 'project-a')
        useUploadStore.getState().addToQueue(files, 'project-b')
        useUploadStore.getState().addToQueue(files, 'project-a')
      })

      const projectAUploads = useUploadStore.getState().getUploadsForProject('project-a')
      expect(projectAUploads).toHaveLength(2)
    })
  })

  describe('getPendingCount', () => {
    it('counts queued and uploading items', () => {
      const files = [
        createMockFile('doc1.pdf', 1024),
        createMockFile('doc2.pdf', 2048),
        createMockFile('doc3.pdf', 3072),
      ]

      act(() => {
        useUploadStore.getState().addToQueue(files, 'project-123')
      })

      // Mark one as uploading
      act(() => {
        useUploadStore.getState().markUploading(
          useUploadStore.getState().uploads[0]!.id
        )
      })

      expect(useUploadStore.getState().getPendingCount()).toBe(3)
    })

    it('excludes completed and failed', () => {
      const files = [
        createMockFile('doc1.pdf', 1024),
        createMockFile('doc2.pdf', 2048),
      ]

      act(() => {
        useUploadStore.getState().addToQueue(files, 'project-123')
      })

      const mockDocument = {
        id: 'doc',
        projectId: 'project-123',
        name: 'doc1.pdf',
        size: 1024,
        mimeType: 'application/pdf',
        category: null,
        folderPath: null,
        uploadStatus: 'completed' as const,
        processingStatus: 'pending' as const,
        createdAt: new Date().toISOString(),
      }

      act(() => {
        useUploadStore.getState().markCompleted(
          useUploadStore.getState().uploads[0]!.id,
          mockDocument
        )
        useUploadStore.getState().markFailed(
          useUploadStore.getState().uploads[1]!.id,
          'Error'
        )
      })

      expect(useUploadStore.getState().getPendingCount()).toBe(0)
    })
  })

  describe('getUploadingCount', () => {
    it('counts only uploading items', () => {
      const files = [
        createMockFile('doc1.pdf', 1024),
        createMockFile('doc2.pdf', 2048),
        createMockFile('doc3.pdf', 3072),
      ]

      act(() => {
        useUploadStore.getState().addToQueue(files, 'project-123')
      })

      // Mark two as uploading
      act(() => {
        useUploadStore.getState().markUploading(
          useUploadStore.getState().uploads[0]!.id
        )
        useUploadStore.getState().markUploading(
          useUploadStore.getState().uploads[1]!.id
        )
      })

      expect(useUploadStore.getState().getUploadingCount()).toBe(2)
    })
  })

  describe('MAX_CONCURRENT_UPLOADS', () => {
    it('has a value of 3', () => {
      expect(MAX_CONCURRENT_UPLOADS).toBe(3)
    })
  })
})

describe('getOverallProgress', () => {
  it('returns 0 for empty array', () => {
    expect(getOverallProgress([])).toBe(0)
  })

  it('calculates average progress', () => {
    const uploads: UploadItem[] = [
      {
        id: '1',
        fileName: 'doc1.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        status: 'uploading',
        progress: 50,
        projectId: 'proj',
        createdAt: Date.now(),
        retryCount: 0,
      },
      {
        id: '2',
        fileName: 'doc2.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        status: 'uploading',
        progress: 100,
        projectId: 'proj',
        createdAt: Date.now(),
        retryCount: 0,
      },
    ]

    expect(getOverallProgress(uploads)).toBe(75)
  })

  it('rounds to nearest integer', () => {
    const uploads: UploadItem[] = [
      {
        id: '1',
        fileName: 'doc1.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        status: 'uploading',
        progress: 33,
        projectId: 'proj',
        createdAt: Date.now(),
        retryCount: 0,
      },
      {
        id: '2',
        fileName: 'doc2.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        status: 'uploading',
        progress: 33,
        projectId: 'proj',
        createdAt: Date.now(),
        retryCount: 0,
      },
      {
        id: '3',
        fileName: 'doc3.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        status: 'uploading',
        progress: 33,
        projectId: 'proj',
        createdAt: Date.now(),
        retryCount: 0,
      },
    ]

    expect(getOverallProgress(uploads)).toBe(33)
  })
})
