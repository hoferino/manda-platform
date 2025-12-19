/**
 * Documents API Client
 *
 * Client-side functions for interacting with the documents API.
 * Handles file uploads, downloads, and document management.
 * Story: E12.9 - Multi-Tenant Data Isolation (AC: #9 - API client includes org header)
 */

import type { DocumentCategory } from '@/lib/gcs/client'
import { apiFetch, getOrganizationId } from '@/lib/api/client'

/**
 * Processing status values that match the backend pipeline
 * Status transitions: pending → parsing → parsed → embedding → analyzing → analyzed → complete
 * Failed states: failed (general), analysis_failed (LLM analysis failed), embedding_failed
 */
export type ProcessingStatus =
  | 'pending'
  | 'parsing'
  | 'parsed'
  | 'embedding'
  | 'embedded'
  | 'analyzing'
  | 'analyzed'
  | 'complete'
  | 'failed'
  | 'analysis_failed'
  | 'embedding_failed'

/**
 * Last completed processing stage for stage-aware retry
 * Story: E3.8 - Implement Retry Logic for Failed Processing (AC: #2)
 */
export type ProcessingStage = 'parsed' | 'embedded' | 'analyzed' | 'complete'

/**
 * Structured error information for failed processing
 * Story: E3.8 - Implement Retry Logic for Failed Processing (AC: #4)
 */
export interface ProcessingError {
  error_type: string        // "timeout" | "rate_limit" | "invalid_file" | etc.
  category: 'transient' | 'permanent' | 'unknown'
  message: string           // Full error message
  stage?: string            // "parsing" | "embedding" | "analyzing"
  timestamp: string         // ISO timestamp
  retry_count: number       // Current retry attempt
  stack_trace?: string      // Truncated stack trace (first 500 chars)
  guidance?: string         // User guidance message
  user_message?: string     // User-friendly error message
}

/**
 * Retry history entry
 * Story: E3.8 - Implement Retry Logic for Failed Processing (AC: #4)
 */
export interface RetryHistoryEntry {
  attempt: number
  stage: string
  error_type: string
  message: string
  timestamp: string
}

export interface Document {
  id: string
  projectId: string
  name: string
  size: number | null
  mimeType: string | null
  category: DocumentCategory | null
  folderPath: string | null
  uploadStatus: 'pending' | 'uploading' | 'completed' | 'failed'
  processingStatus: ProcessingStatus
  processingError?: string | ProcessingError | null
  findingsCount?: number | null
  createdAt: string
  updatedAt?: string
  downloadUrl?: string | null
  downloadUrlExpiresIn?: number | null
  // E3.8: Stage-aware retry fields
  lastCompletedStage?: ProcessingStage | null
  retryHistory?: RetryHistoryEntry[]
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
 * Note: Uses raw fetch with manual org header for FormData (apiFetch sets Content-Type)
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
    // Must use raw fetch for FormData (apiFetch sets Content-Type which breaks multipart)
    // But we still need the organization header for multi-tenant isolation
    const orgId = getOrganizationId()
    const headers: HeadersInit = {}
    if (orgId) {
      headers['x-organization-id'] = orgId
    }

    const response = await fetch('/api/documents/upload', {
      method: 'POST',
      headers,
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
    const response = await apiFetch(`/api/documents/${id}`)
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
    const response = await apiFetch(`/api/documents/${id}`, {
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
    const response = await apiFetch(`/api/documents/${id}`, {
      method: 'PATCH',
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

    const response = await apiFetch(`/api/documents/upload?${params}`)
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
 * Document lookup result for citation resolution
 * Story: E5.4 - AC: #3 (Document Viewer Integration)
 */
export interface DocumentLookupResult {
  documentId: string
  documentName: string
  chunkId?: string | null
}

/**
 * Cache for document name lookups
 * Key: `${projectId}:${documentName}`
 */
const documentLookupCache = new Map<string, DocumentLookupResult | null>()

/**
 * Find document by name within a project
 * Used for resolving citation document names to IDs
 * Story: E5.4 - AC: #3, #5
 */
export async function findDocumentByName(
  projectId: string,
  documentName: string
): Promise<DocumentLookupResult | null> {
  const cacheKey = `${projectId}:${documentName}`

  // Check cache first
  if (documentLookupCache.has(cacheKey)) {
    return documentLookupCache.get(cacheKey) ?? null
  }

  try {
    const response = await apiFetch(
      `/api/projects/${projectId}/documents/lookup?name=${encodeURIComponent(documentName)}`
    )

    if (!response.ok) {
      // Cache miss for 404s to avoid repeated lookups
      if (response.status === 404) {
        documentLookupCache.set(cacheKey, null)
      }
      return null
    }

    const data = await response.json()
    const result: DocumentLookupResult = {
      documentId: data.document.id,
      documentName: data.document.name,
      chunkId: data.chunkId ?? null,
    }

    documentLookupCache.set(cacheKey, result)
    return result
  } catch (error) {
    console.error('Error looking up document:', error)
    return null
  }
}

/**
 * Batch find documents by names within a project
 * More efficient for resolving multiple citations at once
 * Story: E5.4 - AC: #4 (Multiple Citations)
 */
export async function findDocumentsByNames(
  projectId: string,
  documentNames: string[]
): Promise<Map<string, DocumentLookupResult>> {
  const results = new Map<string, DocumentLookupResult>()
  const uncachedNames: string[] = []

  // Check cache for each name
  for (const name of documentNames) {
    const cacheKey = `${projectId}:${name}`
    if (documentLookupCache.has(cacheKey)) {
      const cached = documentLookupCache.get(cacheKey)
      if (cached) {
        results.set(name, cached)
      }
    } else {
      uncachedNames.push(name)
    }
  }

  // If all names are cached, return early
  if (uncachedNames.length === 0) {
    return results
  }

  // Fetch uncached names
  try {
    const response = await apiFetch(
      `/api/projects/${projectId}/documents/lookup`,
      {
        method: 'POST',
        body: JSON.stringify({ names: uncachedNames }),
      }
    )

    if (!response.ok) {
      // Mark all as not found
      for (const name of uncachedNames) {
        documentLookupCache.set(`${projectId}:${name}`, null)
      }
      return results
    }

    const data = await response.json()
    const documents = data.documents as Array<{
      name: string
      id: string
      chunkId?: string | null
    }>

    // Cache and add to results
    const foundNames = new Set<string>()
    for (const doc of documents) {
      const result: DocumentLookupResult = {
        documentId: doc.id,
        documentName: doc.name,
        chunkId: doc.chunkId ?? null,
      }
      documentLookupCache.set(`${projectId}:${doc.name}`, result)
      results.set(doc.name, result)
      foundNames.add(doc.name)
    }

    // Cache misses for names not found
    for (const name of uncachedNames) {
      if (!foundNames.has(name)) {
        documentLookupCache.set(`${projectId}:${name}`, null)
      }
    }

    return results
  } catch (error) {
    console.error('Error batch looking up documents:', error)
    return results
  }
}

/**
 * Clear the document lookup cache
 * Call when documents are uploaded/deleted/renamed
 */
export function clearDocumentLookupCache(projectId?: string): void {
  if (projectId) {
    // Clear only for specific project
    for (const key of documentLookupCache.keys()) {
      if (key.startsWith(`${projectId}:`)) {
        documentLookupCache.delete(key)
      }
    }
  } else {
    // Clear all
    documentLookupCache.clear()
  }
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
