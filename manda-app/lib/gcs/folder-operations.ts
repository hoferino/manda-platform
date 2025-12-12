/**
 * GCS Folder Operations
 *
 * Utility functions for managing folder prefixes in Google Cloud Storage.
 * Story: E6.4 - Implement Data Room Folder Structure Auto-Generation from IRL
 *
 * GCS doesn't have true folders - they're simulated using object prefixes.
 * Creating a "folder" means creating an empty object with a trailing slash.
 */

import { getBucket } from './client'

/**
 * Create a folder prefix in GCS.
 *
 * GCS folders are simulated by creating an empty object with a trailing slash.
 * This makes the "folder" visible in the GCS console and allows listing.
 *
 * @param gcsPath - Full path including trailing slash (e.g., "deal-id/data-room/financial/")
 */
export async function createGCSFolderPrefix(gcsPath: string): Promise<void> {
  // Ensure path ends with slash
  const normalizedPath = gcsPath.endsWith('/') ? gcsPath : `${gcsPath}/`

  const bucket = getBucket()
  const file = bucket.file(normalizedPath)

  // Check if already exists
  const [exists] = await file.exists()
  if (exists) {
    return // Already exists, nothing to do
  }

  // Create empty object with trailing slash
  await file.save('', {
    contentType: 'application/x-directory',
    metadata: {
      metadata: {
        type: 'folder',
        createdAt: new Date().toISOString(),
      },
    },
  })
}

/**
 * Delete a folder prefix from GCS.
 *
 * Only deletes the folder marker object, not any contents.
 * Should only be called if folder is empty in the database.
 *
 * @param gcsPath - Full path including trailing slash (e.g., "deal-id/data-room/financial/")
 */
export async function deleteGCSFolderPrefix(gcsPath: string): Promise<void> {
  // Ensure path ends with slash
  const normalizedPath = gcsPath.endsWith('/') ? gcsPath : `${gcsPath}/`

  const bucket = getBucket()
  const file = bucket.file(normalizedPath)

  // Delete if exists (ignoreNotFound prevents error if already gone)
  await file.delete({ ignoreNotFound: true })
}

/**
 * Check if a folder prefix exists in GCS.
 *
 * @param gcsPath - Full path including trailing slash
 * @returns True if the folder prefix exists
 */
export async function folderPrefixExists(gcsPath: string): Promise<boolean> {
  const normalizedPath = gcsPath.endsWith('/') ? gcsPath : `${gcsPath}/`

  const bucket = getBucket()
  const file = bucket.file(normalizedPath)

  const [exists] = await file.exists()
  return exists
}

/**
 * List all folder prefixes under a given path.
 *
 * @param basePath - Base path to search under (e.g., "deal-id/data-room/")
 * @returns Array of folder paths (relative to basePath)
 */
export async function listFolderPrefixes(basePath: string): Promise<string[]> {
  const normalizedPath = basePath.endsWith('/') ? basePath : `${basePath}/`

  const bucket = getBucket()

  // Get all objects with delimiter to get "folders"
  const [, , apiResponse] = await bucket.getFiles({
    prefix: normalizedPath,
    delimiter: '/',
    autoPaginate: false,
  })

  // Extract prefixes (folders) from response
  const response = apiResponse as { prefixes?: string[] }
  const prefixes = response.prefixes || []

  // Return relative paths
  return prefixes.map(p => p.replace(normalizedPath, '').replace(/\/$/, ''))
}

/**
 * Create multiple folder prefixes in GCS in parallel.
 *
 * @param gcsPaths - Array of full paths including trailing slashes
 * @returns Object with created paths and any errors
 */
export async function createMultipleGCSFolderPrefixes(
  gcsPaths: string[]
): Promise<{ created: string[]; errors: Array<{ path: string; error: string }> }> {
  const created: string[] = []
  const errors: Array<{ path: string; error: string }> = []

  // Create all folders in parallel for better performance
  const results = await Promise.allSettled(
    gcsPaths.map(async (gcsPath) => {
      await createGCSFolderPrefix(gcsPath)
      return gcsPath
    })
  )

  // Process results
  results.forEach((result, index) => {
    const gcsPath = gcsPaths[index]
    if (!gcsPath) return

    if (result.status === 'fulfilled') {
      created.push(result.value)
    } else {
      errors.push({
        path: gcsPath,
        error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
      })
    }
  })

  return { created, errors }
}

/**
 * Delete multiple folder prefixes from GCS.
 *
 * @param gcsPaths - Array of full paths including trailing slashes
 * @returns Object with deleted paths and any errors
 */
export async function deleteMultipleGCSFolderPrefixes(
  gcsPaths: string[]
): Promise<{ deleted: string[]; errors: Array<{ path: string; error: string }> }> {
  const deleted: string[] = []
  const errors: Array<{ path: string; error: string }> = []

  for (const gcsPath of gcsPaths) {
    try {
      await deleteGCSFolderPrefix(gcsPath)
      deleted.push(gcsPath)
    } catch (error) {
      errors.push({
        path: gcsPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return { deleted, errors }
}
