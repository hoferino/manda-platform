/**
 * Folder Service
 *
 * CRUD operations for folders and auto-generation from IRL categories.
 * Story: E6.4 - Implement Data Room Folder Structure Auto-Generation from IRL
 *
 * Features:
 * - Create folders from IRL categories
 * - Sanitize folder names
 * - Create GCS folder prefixes
 * - CRUD operations for folder management
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase/database.types'
import { createGCSFolderPrefix, deleteGCSFolderPrefix } from '@/lib/gcs/folder-operations'

type DbFolder = Database['public']['Tables']['folders']['Row']

/**
 * Folder interface matching the database schema
 */
export interface Folder {
  id: string
  dealId: string
  name: string
  path: string
  parentPath: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Result of folder creation from IRL
 */
export interface FolderCreationResult {
  folders: Folder[]
  created: number
  skipped: number
  errors: string[]
}

/**
 * Map database folder row to Folder interface
 */
function mapDbToFolder(row: DbFolder): Folder {
  return {
    id: row.id,
    dealId: row.deal_id,
    name: row.name,
    path: row.path,
    parentPath: row.parent_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Sanitize a category/folder name to be URL-safe and filesystem-friendly.
 *
 * Rules:
 * - Convert to lowercase
 * - Replace spaces with hyphens
 * - Remove special characters except hyphens and underscores
 * - Collapse multiple hyphens to single
 * - Trim leading/trailing hyphens
 * - Max length: 100 characters
 *
 * @example sanitizeFolderName("Financial Documents & Reports") => "financial-documents-reports"
 * @example sanitizeFolderName("Legal (Contracts)") => "legal-contracts"
 * @example sanitizeFolderName("IT / Technology") => "it-technology"
 */
export function sanitizeFolderName(name: string): string {
  if (!name || typeof name !== 'string') {
    return ''
  }

  return (
    name
      // Convert to lowercase
      .toLowerCase()
      // Replace spaces with hyphens
      .replace(/\s+/g, '-')
      // Remove special characters except hyphens, underscores, and alphanumeric
      .replace(/[^a-z0-9\-_]/g, '')
      // Collapse multiple hyphens to single
      .replace(/-+/g, '-')
      // Trim leading/trailing hyphens
      .replace(/^-+|-+$/g, '')
      // Max length 100
      .slice(0, 100)
  )
}

/**
 * Category structure extracted from IRL for folder generation
 */
export interface IRLCategoryStructure {
  category: string
  subcategories: string[]
}

/**
 * Get unique categories and their subcategories from IRL items
 */
export async function getIRLCategoryStructure(
  supabase: SupabaseClient<Database>,
  irlId: string
): Promise<IRLCategoryStructure[]> {
  const { data, error } = await supabase
    .from('irl_items')
    .select('category, subcategory')
    .eq('irl_id', irlId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching IRL categories:', error)
    return []
  }

  // Build category -> subcategories map
  const categoryMap = new Map<string, Set<string>>()

  for (const row of data || []) {
    if (!categoryMap.has(row.category)) {
      categoryMap.set(row.category, new Set())
    }
    if (row.subcategory) {
      categoryMap.get(row.category)!.add(row.subcategory)
    }
  }

  // Convert to array structure
  const result: IRLCategoryStructure[] = []
  for (const [category, subcategories] of categoryMap) {
    result.push({
      category,
      subcategories: Array.from(subcategories),
    })
  }

  return result
}

/**
 * Create folders from IRL categories in both PostgreSQL and GCS.
 *
 * This function:
 * 1. Extracts categories and subcategories from IRL
 * 2. Creates folders in PostgreSQL with sanitized paths
 * 3. Creates corresponding GCS folder prefixes
 * 4. Skips folders that already exist
 * 5. Rolls back on failure
 *
 * @param supabase - Supabase client
 * @param dealId - Deal/project ID
 * @param irlId - IRL ID to extract categories from
 * @returns FolderCreationResult with created folders and counts
 */
export async function createFoldersFromIRL(
  supabase: SupabaseClient<Database>,
  dealId: string,
  irlId: string
): Promise<FolderCreationResult> {
  const result: FolderCreationResult = {
    folders: [],
    created: 0,
    skipped: 0,
    errors: [],
  }

  // Get category structure from IRL
  const categories = await getIRLCategoryStructure(supabase, irlId)

  if (categories.length === 0) {
    result.errors.push('No categories found in IRL')
    return result
  }

  // Track created GCS prefixes for rollback
  const createdGCSPrefixes: string[] = []

  try {
    // Process each category
    for (const categoryData of categories) {
      const sanitizedCategory = sanitizeFolderName(categoryData.category)

      if (!sanitizedCategory) {
        result.errors.push(`Invalid category name: "${categoryData.category}"`)
        continue
      }

      // Try to create parent folder
      const parentFolder = await createFolderIfNotExists(
        supabase,
        dealId,
        categoryData.category, // Use original name for display
        sanitizedCategory, // Use sanitized name for path
        null // No parent path (root folder)
      )

      if (parentFolder.created) {
        result.folders.push(parentFolder.folder)
        result.created++

        // Create GCS prefix for parent folder
        const gcsPath = `${dealId}/data-room/${sanitizedCategory}/`
        await createGCSFolderPrefix(gcsPath)
        createdGCSPrefixes.push(gcsPath)
      } else {
        result.skipped++
      }

      // Process subcategories
      for (const subcategory of categoryData.subcategories) {
        const sanitizedSubcategory = sanitizeFolderName(subcategory)

        if (!sanitizedSubcategory) {
          result.errors.push(`Invalid subcategory name: "${subcategory}"`)
          continue
        }

        const subfolderPath = `${sanitizedCategory}/${sanitizedSubcategory}`

        // Try to create subfolder
        const subfolder = await createFolderIfNotExists(
          supabase,
          dealId,
          subcategory, // Use original name for display
          subfolderPath, // Full path
          sanitizedCategory // Parent path
        )

        if (subfolder.created) {
          result.folders.push(subfolder.folder)
          result.created++

          // Create GCS prefix for subfolder
          const gcsPath = `${dealId}/data-room/${subfolderPath}/`
          await createGCSFolderPrefix(gcsPath)
          createdGCSPrefixes.push(gcsPath)
        } else {
          result.skipped++
        }
      }
    }
  } catch (error) {
    // Rollback: Delete created GCS prefixes
    console.error('Error creating folders from IRL, rolling back:', error)

    for (const gcsPath of createdGCSPrefixes) {
      try {
        await deleteGCSFolderPrefix(gcsPath)
      } catch (rollbackError) {
        console.error('Failed to rollback GCS prefix:', gcsPath, rollbackError)
      }
    }

    result.errors.push(
      error instanceof Error ? error.message : 'Failed to create folders'
    )
  }

  return result
}

/**
 * Create a folder if it doesn't already exist
 */
async function createFolderIfNotExists(
  supabase: SupabaseClient<Database>,
  dealId: string,
  name: string,
  path: string,
  parentPath: string | null
): Promise<{ folder: Folder; created: boolean }> {
  // Check if folder exists
  const { data: existing } = await supabase
    .from('folders')
    .select('*')
    .eq('deal_id', dealId)
    .eq('path', path)
    .single()

  if (existing) {
    return { folder: mapDbToFolder(existing), created: false }
  }

  // Create new folder
  const { data, error } = await supabase
    .from('folders')
    .insert({
      deal_id: dealId,
      name,
      path,
      parent_path: parentPath,
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Failed to create folder "${name}": ${error?.message}`)
  }

  return { folder: mapDbToFolder(data), created: true }
}

/**
 * Get all folders for a deal as a flat list
 */
export async function getFolders(
  supabase: SupabaseClient<Database>,
  dealId: string
): Promise<Folder[]> {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('deal_id', dealId)
    .order('path', { ascending: true })

  if (error) {
    console.error('Error fetching folders:', error)
    return []
  }

  return (data || []).map(mapDbToFolder)
}

/**
 * Get a single folder by ID
 */
export async function getFolder(
  supabase: SupabaseClient<Database>,
  folderId: string
): Promise<Folder | null> {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('id', folderId)
    .single()

  if (error || !data) {
    if (error?.code !== 'PGRST116') {
      console.error('Error fetching folder:', error)
    }
    return null
  }

  return mapDbToFolder(data)
}

/**
 * Create a new folder
 */
export async function createFolder(
  supabase: SupabaseClient<Database>,
  dealId: string,
  name: string,
  parentPath: string | null,
  createGCSPrefix: boolean = true
): Promise<{ folder: Folder | null; error?: string }> {
  // Validate name
  const trimmedName = name.trim()
  if (!trimmedName) {
    return { folder: null, error: 'Folder name is required' }
  }

  if (trimmedName.includes('/')) {
    return { folder: null, error: 'Folder name cannot contain "/"' }
  }

  if (trimmedName.length > 100) {
    return { folder: null, error: 'Folder name must be under 100 characters' }
  }

  // Build path
  const path = parentPath ? `${parentPath}/${trimmedName}` : trimmedName

  // Check if exists
  const { data: existing } = await supabase
    .from('folders')
    .select('id')
    .eq('deal_id', dealId)
    .eq('path', path)
    .single()

  if (existing) {
    return { folder: null, error: 'A folder with this name already exists' }
  }

  // Create folder in DB
  const { data, error } = await supabase
    .from('folders')
    .insert({
      deal_id: dealId,
      name: trimmedName,
      path,
      parent_path: parentPath,
    })
    .select()
    .single()

  if (error || !data) {
    console.error('Error creating folder:', error)
    return { folder: null, error: 'Failed to create folder' }
  }

  // Create GCS prefix
  if (createGCSPrefix) {
    try {
      const gcsPath = `${dealId}/data-room/${path}/`
      await createGCSFolderPrefix(gcsPath)
    } catch (gcsError) {
      // Rollback DB creation
      console.error('GCS prefix creation failed, rolling back:', gcsError)
      await supabase.from('folders').delete().eq('id', data.id)
      return { folder: null, error: 'Failed to create folder in storage' }
    }
  }

  return { folder: mapDbToFolder(data) }
}

/**
 * Rename a folder
 */
export async function renameFolder(
  supabase: SupabaseClient<Database>,
  folderId: string,
  newName: string
): Promise<{ folder: Folder | null; error?: string }> {
  // Get existing folder
  const existing = await getFolder(supabase, folderId)
  if (!existing) {
    return { folder: null, error: 'Folder not found' }
  }

  // Validate name
  const trimmedName = newName.trim()
  if (!trimmedName) {
    return { folder: null, error: 'Folder name is required' }
  }

  if (trimmedName.includes('/')) {
    return { folder: null, error: 'Folder name cannot contain "/"' }
  }

  if (trimmedName.length > 100) {
    return { folder: null, error: 'Folder name must be under 100 characters' }
  }

  // Build new path
  const oldPath = existing.path
  const newPath = existing.parentPath
    ? `${existing.parentPath}/${trimmedName}`
    : trimmedName

  // Check for conflicts
  if (newPath !== oldPath) {
    const { data: conflict } = await supabase
      .from('folders')
      .select('id')
      .eq('deal_id', existing.dealId)
      .eq('path', newPath)
      .single()

    if (conflict) {
      return { folder: null, error: 'A folder with this name already exists' }
    }
  }

  // Update folder
  const { data, error } = await supabase
    .from('folders')
    .update({ name: trimmedName, path: newPath })
    .eq('id', folderId)
    .select()
    .single()

  if (error || !data) {
    console.error('Error renaming folder:', error)
    return { folder: null, error: 'Failed to rename folder' }
  }

  // Update child folders if path changed
  if (newPath !== oldPath) {
    await updateChildFolderPaths(supabase, existing.dealId, oldPath, newPath)
    await updateDocumentFolderPaths(supabase, existing.dealId, oldPath, newPath)
  }

  return { folder: mapDbToFolder(data) }
}

/**
 * Delete a folder
 * Note: Does not allow deleting folders with documents (must be empty)
 */
export async function deleteFolder(
  supabase: SupabaseClient<Database>,
  folderId: string,
  deleteGCSPrefix: boolean = true
): Promise<{ success: boolean; error?: string }> {
  // Get existing folder
  const existing = await getFolder(supabase, folderId)
  if (!existing) {
    return { success: false, error: 'Folder not found' }
  }

  // Check if folder has documents
  const { count: docCount } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('deal_id', existing.dealId)
    .eq('folder_path', existing.path)

  if (docCount && docCount > 0) {
    return {
      success: false,
      error: 'Cannot delete folder with documents. Move or delete documents first.',
    }
  }

  // Check if folder has children
  const { count: childCount } = await supabase
    .from('folders')
    .select('id', { count: 'exact', head: true })
    .eq('deal_id', existing.dealId)
    .eq('parent_path', existing.path)

  if (childCount && childCount > 0) {
    return {
      success: false,
      error: 'Cannot delete folder with subfolders. Delete subfolders first.',
    }
  }

  // Delete folder from DB
  const { error } = await supabase.from('folders').delete().eq('id', folderId)

  if (error) {
    console.error('Error deleting folder:', error)
    return { success: false, error: 'Failed to delete folder' }
  }

  // Delete GCS prefix
  if (deleteGCSPrefix) {
    try {
      const gcsPath = `${existing.dealId}/data-room/${existing.path}/`
      await deleteGCSFolderPrefix(gcsPath)
    } catch (gcsError) {
      // Log but don't fail - DB deletion succeeded
      console.error('Failed to delete GCS prefix:', gcsError)
    }
  }

  return { success: true }
}

/**
 * Get document count for a folder
 */
export async function getFolderDocumentCount(
  supabase: SupabaseClient<Database>,
  dealId: string,
  folderPath: string
): Promise<number> {
  const { count, error } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('deal_id', dealId)
    .eq('folder_path', folderPath)

  if (error) {
    console.error('Error counting documents:', error)
    return 0
  }

  return count || 0
}

/**
 * Update child folder paths when parent is renamed
 */
async function updateChildFolderPaths(
  supabase: SupabaseClient<Database>,
  dealId: string,
  oldPath: string,
  newPath: string
): Promise<void> {
  const { data: children } = await supabase
    .from('folders')
    .select('id, path, parent_path')
    .eq('deal_id', dealId)
    .like('path', `${oldPath}/%`)

  if (!children || children.length === 0) return

  for (const child of children) {
    const updatedPath = child.path.replace(oldPath, newPath)
    const updatedParentPath = child.parent_path?.replace(oldPath, newPath) || null

    await supabase
      .from('folders')
      .update({ path: updatedPath, parent_path: updatedParentPath })
      .eq('id', child.id)
  }
}

/**
 * Update document folder paths when folder is renamed
 */
async function updateDocumentFolderPaths(
  supabase: SupabaseClient<Database>,
  dealId: string,
  oldPath: string,
  newPath: string
): Promise<void> {
  // Update documents directly in the folder
  await supabase
    .from('documents')
    .update({ folder_path: newPath })
    .eq('deal_id', dealId)
    .eq('folder_path', oldPath)

  // Update documents in subfolders
  const { data: docsInSubfolders } = await supabase
    .from('documents')
    .select('id, folder_path')
    .eq('deal_id', dealId)
    .like('folder_path', `${oldPath}/%`)

  if (docsInSubfolders && docsInSubfolders.length > 0) {
    for (const doc of docsInSubfolders) {
      const updatedPath = doc.folder_path?.replace(oldPath, newPath) || null
      await supabase
        .from('documents')
        .update({ folder_path: updatedPath })
        .eq('id', doc.id)
    }
  }
}
