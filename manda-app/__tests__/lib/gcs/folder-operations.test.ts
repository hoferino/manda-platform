/**
 * GCS Folder Operations Tests
 *
 * Tests for GCS folder prefix creation and deletion.
 * Story: E6.4 - Implement Data Room Folder Structure Auto-Generation from IRL
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createGCSFolderPrefix,
  deleteGCSFolderPrefix,
  folderPrefixExists,
  listFolderPrefixes,
  createMultipleGCSFolderPrefixes,
  deleteMultipleGCSFolderPrefixes,
} from '@/lib/gcs/folder-operations'

// Mock the GCS client
const mockSave = vi.fn()
const mockDelete = vi.fn()
const mockExists = vi.fn()
const mockGetFiles = vi.fn()
const mockFile = vi.fn()

vi.mock('@/lib/gcs/client', () => ({
  getBucket: () => ({
    file: (path: string) => {
      mockFile(path)
      return {
        save: mockSave,
        delete: mockDelete,
        exists: mockExists,
      }
    },
    getFiles: mockGetFiles,
  }),
}))

describe('createGCSFolderPrefix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExists.mockResolvedValue([false])
  })

  it('creates folder prefix with trailing slash', async () => {
    await createGCSFolderPrefix('deal-123/data-room/financial/')

    expect(mockFile).toHaveBeenCalledWith('deal-123/data-room/financial/')
    expect(mockSave).toHaveBeenCalledWith('', expect.objectContaining({
      contentType: 'application/x-directory',
    }))
  })

  it('adds trailing slash if missing', async () => {
    await createGCSFolderPrefix('deal-123/data-room/financial')

    expect(mockFile).toHaveBeenCalledWith('deal-123/data-room/financial/')
  })

  it('skips creation if folder already exists', async () => {
    mockExists.mockResolvedValueOnce([true])

    await createGCSFolderPrefix('deal-123/data-room/financial/')

    expect(mockSave).not.toHaveBeenCalled()
  })

  it('includes metadata in folder creation', async () => {
    await createGCSFolderPrefix('deal-123/data-room/financial/')

    expect(mockSave).toHaveBeenCalledWith('', expect.objectContaining({
      metadata: expect.objectContaining({
        metadata: expect.objectContaining({
          type: 'folder',
        }),
      }),
    }))
  })
})

describe('deleteGCSFolderPrefix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes folder prefix with trailing slash', async () => {
    await deleteGCSFolderPrefix('deal-123/data-room/financial/')

    expect(mockFile).toHaveBeenCalledWith('deal-123/data-room/financial/')
    expect(mockDelete).toHaveBeenCalledWith({ ignoreNotFound: true })
  })

  it('adds trailing slash if missing', async () => {
    await deleteGCSFolderPrefix('deal-123/data-room/financial')

    expect(mockFile).toHaveBeenCalledWith('deal-123/data-room/financial/')
  })

  it('does not throw if folder does not exist', async () => {
    mockDelete.mockResolvedValueOnce(undefined)

    await expect(
      deleteGCSFolderPrefix('deal-123/data-room/nonexistent/')
    ).resolves.not.toThrow()
  })
})

describe('folderPrefixExists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true if folder exists', async () => {
    mockExists.mockResolvedValueOnce([true])

    const result = await folderPrefixExists('deal-123/data-room/financial/')

    expect(result).toBe(true)
  })

  it('returns false if folder does not exist', async () => {
    mockExists.mockResolvedValueOnce([false])

    const result = await folderPrefixExists('deal-123/data-room/nonexistent/')

    expect(result).toBe(false)
  })

  it('adds trailing slash if missing', async () => {
    mockExists.mockResolvedValueOnce([true])

    await folderPrefixExists('deal-123/data-room/financial')

    expect(mockFile).toHaveBeenCalledWith('deal-123/data-room/financial/')
  })
})

describe('listFolderPrefixes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns list of folder prefixes', async () => {
    mockGetFiles.mockResolvedValueOnce([
      [],
      null,
      {
        prefixes: [
          'deal-123/data-room/financial/',
          'deal-123/data-room/legal/',
          'deal-123/data-room/hr/',
        ],
      },
    ])

    const result = await listFolderPrefixes('deal-123/data-room/')

    expect(result).toEqual(['financial', 'legal', 'hr'])
  })

  it('returns empty array if no folders', async () => {
    mockGetFiles.mockResolvedValueOnce([[], null, {}])

    const result = await listFolderPrefixes('deal-123/data-room/')

    expect(result).toEqual([])
  })

  it('adds trailing slash to base path', async () => {
    mockGetFiles.mockResolvedValueOnce([[], null, {}])

    await listFolderPrefixes('deal-123/data-room')

    expect(mockGetFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        prefix: 'deal-123/data-room/',
        delimiter: '/',
      })
    )
  })
})

describe('createMultipleGCSFolderPrefixes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExists.mockResolvedValue([false])
  })

  it('creates multiple folder prefixes', async () => {
    const paths = [
      'deal-123/data-room/financial/',
      'deal-123/data-room/legal/',
    ]

    const result = await createMultipleGCSFolderPrefixes(paths)

    expect(result.created).toHaveLength(2)
    expect(result.errors).toHaveLength(0)
  })

  it('captures errors for individual failures', async () => {
    mockSave
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('GCS error'))

    const paths = [
      'deal-123/data-room/financial/',
      'deal-123/data-room/legal/',
    ]

    const result = await createMultipleGCSFolderPrefixes(paths)

    expect(result.created).toHaveLength(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toEqual({
      path: 'deal-123/data-room/legal/',
      error: 'GCS error',
    })
  })
})

describe('deleteMultipleGCSFolderPrefixes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes multiple folder prefixes', async () => {
    const paths = [
      'deal-123/data-room/financial/',
      'deal-123/data-room/legal/',
    ]

    const result = await deleteMultipleGCSFolderPrefixes(paths)

    expect(result.deleted).toHaveLength(2)
    expect(result.errors).toHaveLength(0)
  })

  it('captures errors for individual failures', async () => {
    mockDelete
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('GCS error'))

    const paths = [
      'deal-123/data-room/financial/',
      'deal-123/data-room/legal/',
    ]

    const result = await deleteMultipleGCSFolderPrefixes(paths)

    expect(result.deleted).toHaveLength(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toEqual({
      path: 'deal-123/data-room/legal/',
      error: 'GCS error',
    })
  })
})
