/**
 * Google Cloud Storage Client
 *
 * Provides GCS bucket operations for document storage.
 * Uses service account credentials for authentication.
 *
 * Environment variables required:
 * - GCS_PROJECT_ID: Google Cloud project ID
 * - GCS_BUCKET_NAME: Default bucket name for document storage
 * - GOOGLE_APPLICATION_CREDENTIALS: Path to service account JSON (or use GCS_CREDENTIALS_JSON)
 * - GCS_CREDENTIALS_JSON: Service account credentials as JSON string (for deployment)
 */

import { Storage, Bucket, File, GetSignedUrlConfig } from '@google-cloud/storage'

// Configuration
const GCS_PROJECT_ID = process.env.GCS_PROJECT_ID
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'manda-documents'
const SIGNED_URL_EXPIRY_MINUTES = 15

// Allowed file types for M&A document uploads
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/vnd.ms-powerpoint', // .ppt
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/gif',
] as const

export const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.xlsx',
  '.xls',
  '.docx',
  '.doc',
  '.pptx',
  '.ppt',
  '.txt',
  '.csv',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
] as const

// Max file size: 500MB
export const MAX_FILE_SIZE = 500 * 1024 * 1024

// Document categories for M&A due diligence
export const DOCUMENT_CATEGORIES = [
  'financial',
  'legal',
  'commercial',
  'operational',
  'tax',
  'hr',
  'it',
  'environmental',
  'regulatory',
  'contracts',
  'corporate',
  'insurance',
  'intellectual_property',
  'real_estate',
  'other',
] as const

export type DocumentCategory = typeof DOCUMENT_CATEGORIES[number]

// GCS Client singleton
let storageClient: Storage | null = null

/**
 * Get or create GCS client instance
 */
function getStorageClient(): Storage {
  if (storageClient) {
    return storageClient
  }

  // Check for credentials JSON (used in production deployments)
  const credentialsJson = process.env.GCS_CREDENTIALS_JSON

  if (credentialsJson) {
    try {
      const credentials = JSON.parse(credentialsJson)
      storageClient = new Storage({
        projectId: GCS_PROJECT_ID,
        credentials,
      })
    } catch (error) {
      console.error('Failed to parse GCS_CREDENTIALS_JSON:', error)
      throw new Error('Invalid GCS credentials configuration')
    }
  } else {
    // Use GOOGLE_APPLICATION_CREDENTIALS environment variable (local development)
    storageClient = new Storage({
      projectId: GCS_PROJECT_ID,
    })
  }

  return storageClient
}

/**
 * Get the default bucket for document storage
 */
export function getBucket(bucketName?: string): Bucket {
  const storage = getStorageClient()
  return storage.bucket(bucketName || GCS_BUCKET_NAME)
}

/**
 * Generate object path for a document
 * Format: {project_id}/{folder_path}/{filename}
 */
export function generateObjectPath(
  projectId: string,
  filename: string,
  folderPath?: string
): string {
  const sanitizedFilename = sanitizeFilename(filename)

  if (folderPath) {
    const sanitizedFolder = folderPath
      .split('/')
      .map(part => sanitizeFilename(part))
      .join('/')
    return `${projectId}/${sanitizedFolder}/${sanitizedFilename}`
  }

  return `${projectId}/${sanitizedFilename}`
}

/**
 * Sanitize filename to prevent path traversal and other issues
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\.\./g, '') // Prevent path traversal
    .replace(/[<>:"|?*]/g, '_') // Remove invalid characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .trim()
}

/**
 * Upload a file to GCS
 */
export async function uploadFile(
  projectId: string,
  file: Buffer | Uint8Array,
  filename: string,
  mimeType: string,
  options?: {
    folderPath?: string
    metadata?: Record<string, string>
  }
): Promise<{
  bucket: string
  objectPath: string
  publicUrl: string
  size: number
}> {
  const bucket = getBucket()
  const objectPath = generateObjectPath(projectId, filename, options?.folderPath)
  const gcsFile = bucket.file(objectPath)

  await gcsFile.save(file, {
    contentType: mimeType,
    metadata: {
      metadata: {
        projectId,
        originalFilename: filename,
        uploadedAt: new Date().toISOString(),
        ...options?.metadata,
      },
    },
  })

  return {
    bucket: GCS_BUCKET_NAME,
    objectPath,
    publicUrl: `gs://${GCS_BUCKET_NAME}/${objectPath}`,
    size: file.length,
  }
}

/**
 * Generate a signed URL for downloading a file
 * Default expiry: 15 minutes
 */
export async function getSignedDownloadUrl(
  objectPath: string,
  options?: {
    bucketName?: string
    expiresInMinutes?: number
    responseDisposition?: string
  }
): Promise<string> {
  const bucket = getBucket(options?.bucketName)
  const file = bucket.file(objectPath)

  const config: GetSignedUrlConfig = {
    version: 'v4',
    action: 'read',
    expires: Date.now() + (options?.expiresInMinutes || SIGNED_URL_EXPIRY_MINUTES) * 60 * 1000,
  }

  if (options?.responseDisposition) {
    config.responseDisposition = options.responseDisposition
  }

  const [url] = await file.getSignedUrl(config)
  return url
}

/**
 * Generate a signed URL for uploading a file (resumable upload)
 */
export async function getSignedUploadUrl(
  projectId: string,
  filename: string,
  mimeType: string,
  options?: {
    folderPath?: string
    expiresInMinutes?: number
  }
): Promise<{
  uploadUrl: string
  objectPath: string
  bucket: string
}> {
  const bucket = getBucket()
  const objectPath = generateObjectPath(projectId, filename, options?.folderPath)
  const file = bucket.file(objectPath)

  const config: GetSignedUrlConfig = {
    version: 'v4',
    action: 'write',
    expires: Date.now() + (options?.expiresInMinutes || SIGNED_URL_EXPIRY_MINUTES) * 60 * 1000,
    contentType: mimeType,
  }

  const [uploadUrl] = await file.getSignedUrl(config)

  return {
    uploadUrl,
    objectPath,
    bucket: GCS_BUCKET_NAME,
  }
}

/**
 * Delete a file from GCS
 */
export async function deleteFile(
  objectPath: string,
  bucketName?: string
): Promise<void> {
  const bucket = getBucket(bucketName)
  const file = bucket.file(objectPath)

  await file.delete({ ignoreNotFound: true })
}

/**
 * Check if a file exists in GCS
 */
export async function fileExists(
  objectPath: string,
  bucketName?: string
): Promise<boolean> {
  const bucket = getBucket(bucketName)
  const file = bucket.file(objectPath)

  const [exists] = await file.exists()
  return exists
}

/**
 * Get file metadata from GCS
 */
export async function getFileMetadata(
  objectPath: string,
  bucketName?: string
): Promise<{
  size: number
  contentType: string
  created: Date
  updated: Date
  metadata: Record<string, string>
} | null> {
  const bucket = getBucket(bucketName)
  const file = bucket.file(objectPath)

  try {
    const [metadata] = await file.getMetadata()
    return {
      size: parseInt(metadata.size as string, 10),
      contentType: metadata.contentType || 'application/octet-stream',
      created: new Date(metadata.timeCreated as string),
      updated: new Date(metadata.updated as string),
      metadata: (metadata.metadata || {}) as Record<string, string>,
    }
  } catch (error) {
    return null
  }
}

/**
 * List files in a project folder
 */
export async function listFiles(
  projectId: string,
  options?: {
    folderPath?: string
    maxResults?: number
    pageToken?: string
  }
): Promise<{
  files: Array<{
    name: string
    path: string
    size: number
    contentType: string
    updated: Date
  }>
  nextPageToken?: string
}> {
  const bucket = getBucket()
  const prefix = options?.folderPath
    ? `${projectId}/${options.folderPath}/`
    : `${projectId}/`

  const [files, , apiResponse] = await bucket.getFiles({
    prefix,
    maxResults: options?.maxResults || 100,
    pageToken: options?.pageToken,
  })

  // Type the API response for pagination
  const response = apiResponse as { nextPageToken?: string } | undefined

  return {
    files: files.map(file => ({
      name: file.name.split('/').pop() || file.name,
      path: file.name,
      size: parseInt(file.metadata.size as string, 10),
      contentType: file.metadata.contentType || 'application/octet-stream',
      updated: new Date(file.metadata.updated as string),
    })),
    nextPageToken: response?.nextPageToken,
  }
}

/**
 * Validate file for upload
 */
export function validateFile(
  filename: string,
  mimeType: string,
  size: number
): { valid: boolean; error?: string } {
  // Check file extension
  const ext = '.' + filename.split('.').pop()?.toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext as typeof ALLOWED_EXTENSIONS[number])) {
    return {
      valid: false,
      error: `File extension ${ext} is not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
    }
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(mimeType as typeof ALLOWED_MIME_TYPES[number])) {
    return {
      valid: false,
      error: `File type ${mimeType} is not allowed.`,
    }
  }

  // Check file size
  if (size > MAX_FILE_SIZE) {
    const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024)
    return {
      valid: false,
      error: `File size exceeds maximum allowed (${maxSizeMB}MB).`,
    }
  }

  return { valid: true }
}
