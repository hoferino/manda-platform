/**
 * Documents API Client
 *
 * Client-side functions for interacting with the documents API.
 * Handles file uploads, downloads, and document management.
 */

import type { DocumentCategory } from '@/lib/gcs/client'

export interface Document {
  id: string
  projectId: string
  name: string
  size: number | null
  mimeType: string | null
  category: DocumentCategory | null
  folderPath: string | null
  uploadStatus: 'pending' | 'uploading' | 'completed' | 'failed'
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: string
  updatedAt?: string
  downloadUrl?: string | null
  downloadUrlExpiresIn?: number | null
}

export interface UploadOptions {
  projectId: string
  folderPath?: string
  category?: DocumentCategory
  onProgress?: (progress: number) => void
}

export interface UploadResult {
  success: boolean
  document?: Document
  error?: string
}

/**
 * Upload a file to the document storage
 */
export async function uploadDocument(
  file: File,
  options: UploadOptions
): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('projectId', options.projectId)

  if (options.folderPath) {
    formData.append('folderPath', options.folderPath)
  }

  if (options.category) {
    formData.append('category', options.category)
  }

  try {
    const response = await fetch('/api/documents/upload', {
      method: 'POST',
      body: formData,
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Upload failed',
      }
    }

    return {
      success: true,
      document: data.document,
    }
  } catch (error) {
    console.error('Upload error:', error)
    return {
      success: false,
      error: 'Network error during upload',
    }
  }
}

/**
 * Upload multiple files
 */
export async function uploadDocuments(
  files: File[],
  options: UploadOptions,
  onFileProgress?: (index: number, status: 'pending' | 'uploading' | 'completed' | 'failed', document?: Document, error?: string) => void
): Promise<UploadResult[]> {
  const results: UploadResult[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (!file) continue

    onFileProgress?.(i, 'uploading')

    const result = await uploadDocument(file, options)
    results.push(result)

    onFileProgress?.(
      i,
      result.success ? 'completed' : 'failed',
      result.document,
      result.error
    )
  }

  return results
}

/**
 * Get document details with download URL
 */
export async function getDocument(id: string): Promise<{
  document?: Document
  error?: string
}> {
  try {
    const response = await fetch(`/api/documents/${id}`)
    const data = await response.json()

    if (!response.ok) {
      return { error: data.error || 'Failed to fetch document' }
    }

    return { document: data.document }
  } catch (error) {
    console.error('Error fetching document:', error)
    return { error: 'Network error' }
  }
}

/**
 * Delete a document
 */
export async function deleteDocument(id: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const response = await fetch(`/api/documents/${id}`, {
      method: 'DELETE',
    })
    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to delete document' }
    }

    return { success: true }
  } catch (error) {
    console.error('Error deleting document:', error)
    return { success: false, error: 'Network error' }
  }
}

/**
 * Update document metadata
 */
export async function updateDocument(
  id: string,
  updates: {
    name?: string
    category?: DocumentCategory
    folderPath?: string | null
  }
): Promise<{
  success: boolean
  document?: Partial<Document>
  error?: string
}> {
  try {
    const response = await fetch(`/api/documents/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    })
    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to update document' }
    }

    return { success: true, document: data.document }
  } catch (error) {
    console.error('Error updating document:', error)
    return { success: false, error: 'Network error' }
  }
}

/**
 * Download a document
 * Opens the signed URL in a new tab or initiates download
 */
export async function downloadDocument(id: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const { document, error } = await getDocument(id)

    if (error || !document) {
      return { success: false, error: error || 'Document not found' }
    }

    if (!document.downloadUrl) {
      return { success: false, error: 'Download URL not available' }
    }

    // Open in new tab to trigger download
    window.open(document.downloadUrl, '_blank')
    return { success: true }
  } catch (error) {
    console.error('Error downloading document:', error)
    return { success: false, error: 'Download failed' }
  }
}

/**
 * Get signed upload URL for direct client-side uploads
 * (Alternative to server-side upload for large files)
 */
export async function getSignedUploadUrl(
  projectId: string,
  filename: string,
  mimeType: string,
  fileSize: number,
  folderPath?: string
): Promise<{
  uploadUrl?: string
  objectPath?: string
  bucket?: string
  error?: string
}> {
  try {
    const params = new URLSearchParams({
      projectId,
      filename,
      mimeType,
      fileSize: fileSize.toString(),
    })

    if (folderPath) {
      params.set('folderPath', folderPath)
    }

    const response = await fetch(`/api/documents/upload?${params}`)
    const data = await response.json()

    if (!response.ok) {
      return { error: data.error || 'Failed to get upload URL' }
    }

    return {
      uploadUrl: data.uploadUrl,
      objectPath: data.objectPath,
      bucket: data.bucket,
    }
  } catch (error) {
    console.error('Error getting signed URL:', error)
    return { error: 'Network error' }
  }
}

/**
 * Document categories for M&A due diligence
 */
export const DOCUMENT_CATEGORIES = [
  { value: 'financial', label: 'Financial' },
  { value: 'legal', label: 'Legal' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'operational', label: 'Operational' },
  { value: 'tax', label: 'Tax' },
  { value: 'hr', label: 'Human Resources' },
  { value: 'it', label: 'IT & Technology' },
  { value: 'environmental', label: 'Environmental' },
  { value: 'regulatory', label: 'Regulatory' },
  { value: 'contracts', label: 'Contracts' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'intellectual_property', label: 'Intellectual Property' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'other', label: 'Other' },
] as const

/**
 * Get human-readable file size
 */
export function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : ''
}

/**
 * Get icon name based on file type
 */
export function getFileTypeIcon(mimeType: string | null): string {
  if (!mimeType) return 'file'

  if (mimeType.includes('pdf')) return 'file-text'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'table'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'file-text'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation'
  if (mimeType.includes('image')) return 'image'
  if (mimeType.includes('text')) return 'file-text'

  return 'file'
}
