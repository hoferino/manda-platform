/**
 * Folder Service Tests
 *
 * Tests for folder CRUD operations and IRL-based folder generation.
 * Story: E6.4 - Implement Data Room Folder Structure Auto-Generation from IRL
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  sanitizeFolderName,
  getIRLCategoryStructure,
  createFoldersFromIRL,
  createFolder,
  renameFolder,
  deleteFolder,
  getFolderDocumentCount,
} from '@/lib/services/folders'
import {
  createMockSupabaseClient,
  createMockFolder,
  mockQuerySuccess,
  mockQueryError,
} from '@/__tests__/utils/supabase-mock'

// Mock the GCS folder operations
vi.mock('@/lib/gcs/folder-operations', () => ({
  createGCSFolderPrefix: vi.fn().mockResolvedValue(undefined),
  deleteGCSFolderPrefix: vi.fn().mockResolvedValue(undefined),
}))

describe('sanitizeFolderName', () => {
  it('converts to lowercase', () => {
    expect(sanitizeFolderName('Financial')).toBe('financial')
    expect(sanitizeFolderName('LEGAL')).toBe('legal')
  })

  it('replaces spaces with hyphens', () => {
    expect(sanitizeFolderName('Financial Documents')).toBe('financial-documents')
    expect(sanitizeFolderName('Legal   Contracts')).toBe('legal-contracts')
  })

  it('removes special characters', () => {
    expect(sanitizeFolderName('Financial & Reports')).toBe('financial-reports')
    expect(sanitizeFolderName('Legal (Contracts)')).toBe('legal-contracts')
    expect(sanitizeFolderName('IT / Technology')).toBe('it-technology')
  })

  it('collapses multiple hyphens', () => {
    expect(sanitizeFolderName('Financial---Reports')).toBe('financial-reports')
    expect(sanitizeFolderName('Legal - - - Contracts')).toBe('legal-contracts')
  })

  it('trims leading/trailing hyphens', () => {
    expect(sanitizeFolderName('-Financial-')).toBe('financial')
    expect(sanitizeFolderName('---Legal---')).toBe('legal')
  })

  it('handles empty strings', () => {
    expect(sanitizeFolderName('')).toBe('')
    expect(sanitizeFolderName('   ')).toBe('')
  })

  it('handles null/undefined', () => {
    expect(sanitizeFolderName(null as unknown as string)).toBe('')
    expect(sanitizeFolderName(undefined as unknown as string)).toBe('')
  })

  it('preserves underscores', () => {
    expect(sanitizeFolderName('financial_reports')).toBe('financial_reports')
  })

  it('truncates to 100 characters', () => {
    const longName = 'a'.repeat(150)
    expect(sanitizeFolderName(longName).length).toBe(100)
  })

  it('handles complex category names', () => {
    expect(sanitizeFolderName('Financial Documents & Reports')).toBe('financial-documents-reports')
    expect(sanitizeFolderName('Legal (Contracts)')).toBe('legal-contracts')
    expect(sanitizeFolderName('IT / Technology')).toBe('it-technology')
    expect(sanitizeFolderName('Q1 2024 Reports')).toBe('q1-2024-reports')
    expect(sanitizeFolderName("HR & People's Data")).toBe('hr-peoples-data')
  })

  it('handles non-ASCII characters', () => {
    expect(sanitizeFolderName('Finanças')).toBe('finanas')
    expect(sanitizeFolderName('Données')).toBe('donnes')
  })
})

describe('getIRLCategoryStructure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('extracts categories and subcategories from IRL items', async () => {
    const { client, mocks } = createMockSupabaseClient()

    const mockData = [
      { category: 'Financial', subcategory: 'Q1 Reports' },
      { category: 'Financial', subcategory: 'Q2 Reports' },
      { category: 'Legal', subcategory: 'Contracts' },
      { category: 'Legal', subcategory: null },
      { category: 'HR', subcategory: null },
    ]

    mocks.order.mockResolvedValueOnce({ data: mockData, error: null })

    const result = await getIRLCategoryStructure(
      client as unknown as Parameters<typeof getIRLCategoryStructure>[0],
      'test-irl-id'
    )

    expect(result).toHaveLength(3)
    expect(result.find(c => c.category === 'Financial')?.subcategories).toEqual([
      'Q1 Reports',
      'Q2 Reports',
    ])
    expect(result.find(c => c.category === 'Legal')?.subcategories).toEqual(['Contracts'])
    expect(result.find(c => c.category === 'HR')?.subcategories).toEqual([])
  })

  it('returns empty array on error', async () => {
    const { client, mocks } = createMockSupabaseClient()
    mockQueryError(mocks, { message: 'Database error' })

    const result = await getIRLCategoryStructure(
      client as unknown as Parameters<typeof getIRLCategoryStructure>[0],
      'test-irl-id'
    )

    expect(result).toEqual([])
  })

  it('returns empty array when no data', async () => {
    const { client, mocks } = createMockSupabaseClient()
    mocks.order.mockResolvedValueOnce({ data: [], error: null })

    const result = await getIRLCategoryStructure(
      client as unknown as Parameters<typeof getIRLCategoryStructure>[0],
      'test-irl-id'
    )

    expect(result).toEqual([])
  })
})

describe('createFoldersFromIRL', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error when no categories found', async () => {
    const { client, mocks } = createMockSupabaseClient()
    mocks.order.mockResolvedValueOnce({ data: [], error: null })

    const result = await createFoldersFromIRL(
      client as unknown as Parameters<typeof createFoldersFromIRL>[0],
      'deal-123',
      'irl-456'
    )

    expect(result.errors).toContain('No categories found in IRL')
    expect(result.created).toBe(0)
  })

  it('skips invalid category names', async () => {
    const { client, mocks } = createMockSupabaseClient()
    mocks.order.mockResolvedValueOnce({
      data: [{ category: '!!!', subcategory: null }],
      error: null,
    })

    const result = await createFoldersFromIRL(
      client as unknown as Parameters<typeof createFoldersFromIRL>[0],
      'deal-123',
      'irl-456'
    )

    expect(result.errors).toContain('Invalid category name: "!!!"')
  })

  it('creates folders for valid categories', async () => {
    const { client, mocks } = createMockSupabaseClient()

    // Mock category structure retrieval
    mocks.order.mockResolvedValueOnce({
      data: [
        { category: 'Financial', subcategory: null },
        { category: 'Legal', subcategory: null },
      ],
      error: null,
    })

    // Mock folder existence check (not found) and creation
    mocks.single
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }) // Financial not found
      .mockResolvedValueOnce({
        data: createMockFolder({ name: 'Financial', path: 'financial' }),
        error: null,
      }) // Financial created
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }) // Legal not found
      .mockResolvedValueOnce({
        data: createMockFolder({ name: 'Legal', path: 'legal' }),
        error: null,
      }) // Legal created

    const result = await createFoldersFromIRL(
      client as unknown as Parameters<typeof createFoldersFromIRL>[0],
      'deal-123',
      'irl-456'
    )

    expect(result.created).toBe(2)
    expect(result.folders).toHaveLength(2)
  })

  it('skips existing folders', async () => {
    const { client, mocks } = createMockSupabaseClient()

    // Mock category structure retrieval
    mocks.order.mockResolvedValueOnce({
      data: [{ category: 'Financial', subcategory: null }],
      error: null,
    })

    // Mock folder existence check (found)
    mocks.single.mockResolvedValueOnce({
      data: createMockFolder({ name: 'Financial', path: 'financial' }),
      error: null,
    })

    const result = await createFoldersFromIRL(
      client as unknown as Parameters<typeof createFoldersFromIRL>[0],
      'deal-123',
      'irl-456'
    )

    expect(result.created).toBe(0)
    expect(result.skipped).toBe(1)
  })
})

describe('createFolder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('validates folder name is required', async () => {
    const { client } = createMockSupabaseClient()

    const result = await createFolder(
      client as unknown as Parameters<typeof createFolder>[0],
      'deal-123',
      '',
      null
    )

    expect(result.error).toBe('Folder name is required')
    expect(result.folder).toBeNull()
  })

  it('validates folder name with only spaces', async () => {
    const { client } = createMockSupabaseClient()

    const result = await createFolder(
      client as unknown as Parameters<typeof createFolder>[0],
      'deal-123',
      '   ',
      null
    )

    expect(result.error).toBe('Folder name is required')
    expect(result.folder).toBeNull()
  })

  it('rejects folder names with slashes', async () => {
    const { client } = createMockSupabaseClient()

    const result = await createFolder(
      client as unknown as Parameters<typeof createFolder>[0],
      'deal-123',
      'folder/name',
      null
    )

    expect(result.error).toBe('Folder name cannot contain "/"')
    expect(result.folder).toBeNull()
  })

  it('rejects folder names over 100 characters', async () => {
    const { client } = createMockSupabaseClient()

    const result = await createFolder(
      client as unknown as Parameters<typeof createFolder>[0],
      'deal-123',
      'a'.repeat(101),
      null
    )

    expect(result.error).toBe('Folder name must be under 100 characters')
    expect(result.folder).toBeNull()
  })

  it('returns error when folder already exists', async () => {
    const { client, mocks } = createMockSupabaseClient()
    mocks.single.mockResolvedValueOnce({
      data: { id: 'existing-folder' },
      error: null,
    })

    const result = await createFolder(
      client as unknown as Parameters<typeof createFolder>[0],
      'deal-123',
      'Financial',
      null
    )

    expect(result.error).toBe('A folder with this name already exists')
    expect(result.folder).toBeNull()
  })

  it('creates folder with parent path', async () => {
    const { client, mocks } = createMockSupabaseClient()

    // Not found check
    mocks.single
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
      .mockResolvedValueOnce({
        data: createMockFolder({
          name: 'Subfolder',
          path: 'parent/Subfolder',
          parent_path: 'parent',
        }),
        error: null,
      })

    const result = await createFolder(
      client as unknown as Parameters<typeof createFolder>[0],
      'deal-123',
      'Subfolder',
      'parent'
    )

    expect(result.folder).not.toBeNull()
    expect(result.folder?.path).toBe('parent/Subfolder')
    expect(result.folder?.parentPath).toBe('parent')
  })
})

describe('renameFolder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error for non-existent folder', async () => {
    const { client, mocks } = createMockSupabaseClient()
    mocks.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })

    const result = await renameFolder(
      client as unknown as Parameters<typeof renameFolder>[0],
      'folder-123',
      'New Name'
    )

    expect(result.error).toBe('Folder not found')
    expect(result.folder).toBeNull()
  })

  it('validates new name is required', async () => {
    const { client, mocks } = createMockSupabaseClient()
    mocks.single.mockResolvedValueOnce({
      data: createMockFolder({ name: 'Old Name', path: 'old-name' }),
      error: null,
    })

    const result = await renameFolder(
      client as unknown as Parameters<typeof renameFolder>[0],
      'folder-123',
      ''
    )

    expect(result.error).toBe('Folder name is required')
    expect(result.folder).toBeNull()
  })

  it('rejects names with slashes', async () => {
    const { client, mocks } = createMockSupabaseClient()
    mocks.single.mockResolvedValueOnce({
      data: createMockFolder({ name: 'Old Name', path: 'old-name' }),
      error: null,
    })

    const result = await renameFolder(
      client as unknown as Parameters<typeof renameFolder>[0],
      'folder-123',
      'new/name'
    )

    expect(result.error).toBe('Folder name cannot contain "/"')
    expect(result.folder).toBeNull()
  })

  it('rejects names over 100 characters', async () => {
    const { client, mocks } = createMockSupabaseClient()
    mocks.single.mockResolvedValueOnce({
      data: createMockFolder({ name: 'Old Name', path: 'old-name' }),
      error: null,
    })

    const result = await renameFolder(
      client as unknown as Parameters<typeof renameFolder>[0],
      'folder-123',
      'a'.repeat(101)
    )

    expect(result.error).toBe('Folder name must be under 100 characters')
    expect(result.folder).toBeNull()
  })
})

describe('deleteFolder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error for non-existent folder', async () => {
    const { client, mocks } = createMockSupabaseClient()
    mocks.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })

    const result = await deleteFolder(
      client as unknown as Parameters<typeof deleteFolder>[0],
      'folder-123'
    )

    expect(result.error).toBe('Folder not found')
    expect(result.success).toBe(false)
  })
})

describe('getFolderDocumentCount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns document count', async () => {
    const { client, mocks } = createMockSupabaseClient()
    // Override the eq chain to return count
    mocks.eq.mockReturnValue({
      ...mocks,
      eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
    })

    const count = await getFolderDocumentCount(
      client as unknown as Parameters<typeof getFolderDocumentCount>[0],
      'deal-123',
      'financial'
    )

    expect(count).toBe(5)
  })

  it('returns 0 on error', async () => {
    const { client, mocks } = createMockSupabaseClient()
    // Override the eq chain to return error
    mocks.eq.mockReturnValue({
      ...mocks,
      eq: vi.fn().mockResolvedValue({ count: null, error: { message: 'Error' } }),
    })

    const count = await getFolderDocumentCount(
      client as unknown as Parameters<typeof getFolderDocumentCount>[0],
      'deal-123',
      'financial'
    )

    expect(count).toBe(0)
  })
})
