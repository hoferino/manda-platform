/**
 * Folders API Client
 * Provides functions for folder CRUD operations
 * Story: E2.2 Enhancement - Persistent folder storage
 */

import { getOrganizationId } from './client'

/**
 * Get headers with organization ID for API requests
 */
function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const orgId = getOrganizationId()
  if (orgId) {
    headers['x-organization-id'] = orgId
  }
  return headers
}

export interface Folder {
  id: string
  dealId: string
  name: string
  path: string
  parentPath: string | null
  createdAt: string
  updatedAt: string
}

interface FoldersResponse {
  folders: Array<{
    id: string
    deal_id: string
    name: string
    path: string
    parent_path: string | null
    created_at: string
    updated_at: string
  }>
}

interface FolderResponse {
  folder: {
    id: string
    deal_id: string
    name: string
    path: string
    parent_path: string | null
    created_at: string
    updated_at: string
  }
}

/**
 * Fetch all folders for a project
 */
export async function getFolders(projectId: string): Promise<{ folders: Folder[]; error?: string }> {
  try {
    const response = await fetch(`/api/projects/${projectId}/folders`, {
      headers: getHeaders(),
    })

    if (!response.ok) {
      const data = await response.json()
      return { folders: [], error: data.error || 'Failed to fetch folders' }
    }

    const data: FoldersResponse = await response.json()

    const folders: Folder[] = data.folders.map((f) => ({
      id: f.id,
      dealId: f.deal_id,
      name: f.name,
      path: f.path,
      parentPath: f.parent_path,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    }))

    return { folders }
  } catch (error) {
    console.error('Error fetching folders:', error)
    return { folders: [], error: 'Failed to fetch folders' }
  }
}

/**
 * Create a new folder
 */
export async function createFolder(
  projectId: string,
  name: string,
  parentPath: string | null
): Promise<{ folder?: Folder; error?: string }> {
  try {
    const response = await fetch(`/api/projects/${projectId}/folders`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, parentPath }),
    })

    if (!response.ok) {
      const data = await response.json()
      return { error: data.error || 'Failed to create folder' }
    }

    const data: FolderResponse = await response.json()

    const folder: Folder = {
      id: data.folder.id,
      dealId: data.folder.deal_id,
      name: data.folder.name,
      path: data.folder.path,
      parentPath: data.folder.parent_path,
      createdAt: data.folder.created_at,
      updatedAt: data.folder.updated_at,
    }

    return { folder }
  } catch (error) {
    console.error('Error creating folder:', error)
    return { error: 'Failed to create folder' }
  }
}

/**
 * Rename a folder
 */
export async function renameFolder(
  projectId: string,
  folderId: string,
  newName: string
): Promise<{ folder?: Folder; error?: string }> {
  try {
    const response = await fetch(`/api/projects/${projectId}/folders/${folderId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ name: newName }),
    })

    if (!response.ok) {
      const data = await response.json()
      return { error: data.error || 'Failed to rename folder' }
    }

    const data: FolderResponse = await response.json()

    const folder: Folder = {
      id: data.folder.id,
      dealId: data.folder.deal_id,
      name: data.folder.name,
      path: data.folder.path,
      parentPath: data.folder.parent_path,
      createdAt: data.folder.created_at,
      updatedAt: data.folder.updated_at,
    }

    return { folder }
  } catch (error) {
    console.error('Error renaming folder:', error)
    return { error: 'Failed to rename folder' }
  }
}

/**
 * Delete a folder
 */
export async function deleteFolder(
  projectId: string,
  folderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/projects/${projectId}/folders/${folderId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    })

    if (!response.ok) {
      const data = await response.json()
      return { success: false, error: data.error || 'Failed to delete folder' }
    }

    return { success: true }
  } catch (error) {
    console.error('Error deleting folder:', error)
    return { success: false, error: 'Failed to delete folder' }
  }
}
