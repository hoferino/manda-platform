/**
 * Q&A Client API Functions
 *
 * Client-side functions for interacting with the Q&A API endpoints.
 * Story: E8.1 - Q&A Data Model and CRUD API
 *
 * Features:
 * - CRUD operations for Q&A items
 * - Conflict error handling for optimistic locking
 * - Summary statistics retrieval
 */

import {
  QAItem,
  QAFilters,
  QASummary,
  QAConflictError,
  CreateQAItemInput,
  UpdateQAItemInput,
  isQAConflictError,
} from '@/lib/types/qa'

// ============================================================================
// Response Types
// ============================================================================

export interface QAListResponse {
  items: QAItem[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface QAItemResponse {
  item: QAItem
}

export interface QASummaryResponse {
  summary: QASummary
}

export interface QAErrorResponse {
  error: string
  details?: Record<string, unknown>
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Create a new Q&A item
 * AC: #1 - POST /qa with valid input returns 201 with QAItem
 */
export async function createQAItem(
  projectId: string,
  input: CreateQAItemInput
): Promise<QAItem> {
  const response = await fetch(`/api/projects/${projectId}/qa`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to create Q&A item: ${response.statusText}`)
  }

  const data: QAItemResponse = await response.json()
  return data.item
}

/**
 * Get Q&A items for a project with optional filters
 * AC: #2 - GET /qa returns list filtered by category, priority, status
 */
export async function getQAItems(
  projectId: string,
  filters?: QAFilters
): Promise<QAListResponse> {
  const params = new URLSearchParams()

  if (filters?.category) {
    params.set('category', filters.category)
  }
  if (filters?.priority) {
    params.set('priority', filters.priority)
  }
  if (filters?.status) {
    params.set('status', filters.status)
  }
  if (filters?.limit !== undefined) {
    params.set('limit', String(filters.limit))
  }
  if (filters?.offset !== undefined) {
    params.set('offset', String(filters.offset))
  }

  const url = `/api/projects/${projectId}/qa${params.toString() ? `?${params.toString()}` : ''}`

  const response = await fetch(url)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to fetch Q&A items: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Get a single Q&A item by ID
 */
export async function getQAItem(projectId: string, itemId: string): Promise<QAItem> {
  const response = await fetch(`/api/projects/${projectId}/qa/${itemId}`)

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Q&A item not found')
    }
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to fetch Q&A item: ${response.statusText}`)
  }

  const data: QAItemResponse = await response.json()
  return data.item
}

/**
 * Update a Q&A item with optimistic locking
 * AC: #3 - PUT with current updated_at succeeds
 * AC: #4 - PUT with stale updated_at returns conflict error
 *
 * @returns Updated QAItem on success
 * @throws Error or QAConflictError on failure
 */
export async function updateQAItem(
  projectId: string,
  itemId: string,
  input: UpdateQAItemInput
): Promise<QAItem | QAConflictError> {
  const response = await fetch(`/api/projects/${projectId}/qa/${itemId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  // Handle conflict response (409)
  if (response.status === 409) {
    const conflictData: QAConflictError = await response.json()
    return conflictData
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Q&A item not found')
    }
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to update Q&A item: ${response.statusText}`)
  }

  const data: QAItemResponse = await response.json()
  return data.item
}

/**
 * Delete a Q&A item
 * AC: #5 - DELETE returns 204 No Content
 */
export async function deleteQAItem(projectId: string, itemId: string): Promise<void> {
  const response = await fetch(`/api/projects/${projectId}/qa/${itemId}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Q&A item not found')
    }
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to delete Q&A item: ${response.statusText}`)
  }

  // 204 No Content - success
}

/**
 * Get summary statistics for Q&A items
 * AC: #7 - GET /qa/summary returns aggregate stats
 */
export async function getQASummary(projectId: string): Promise<QASummary> {
  const response = await fetch(`/api/projects/${projectId}/qa/summary`)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to fetch Q&A summary: ${response.statusText}`)
  }

  const data: QASummaryResponse = await response.json()
  return data.summary
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Handle update with conflict resolution
 * Attempts update and returns result with conflict handling
 */
export async function updateQAItemWithConflictCheck(
  projectId: string,
  itemId: string,
  input: UpdateQAItemInput
): Promise<{ success: true; item: QAItem } | { success: false; conflict: QAConflictError }> {
  const result = await updateQAItem(projectId, itemId, input)

  if (isQAConflictError(result)) {
    return { success: false, conflict: result }
  }

  return { success: true, item: result }
}

/**
 * Retry update with fresh data after conflict
 * Fetches current item, applies changes, and retries
 */
export async function retryUpdateAfterConflict(
  projectId: string,
  itemId: string,
  changes: Omit<UpdateQAItemInput, 'updatedAt'>
): Promise<QAItem> {
  // Fetch fresh data
  const currentItem = await getQAItem(projectId, itemId)

  // Retry update with current updated_at
  const result = await updateQAItem(projectId, itemId, {
    ...changes,
    updatedAt: currentItem.updatedAt,
  })

  if (isQAConflictError(result)) {
    throw new Error('Update failed again due to conflict. Please refresh and try again.')
  }

  return result
}

/**
 * Bulk create Q&A items
 */
export async function createQAItems(
  projectId: string,
  items: CreateQAItemInput[]
): Promise<QAItem[]> {
  // Create items sequentially to maintain order and handle errors individually
  const results: QAItem[] = []

  for (const input of items) {
    const item = await createQAItem(projectId, input)
    results.push(item)
  }

  return results
}

/**
 * Bulk delete Q&A items
 */
export async function deleteQAItems(projectId: string, itemIds: string[]): Promise<void> {
  await Promise.all(itemIds.map(id => deleteQAItem(projectId, id)))
}

// ============================================================================
// Q&A Finding Existence Checks
// Story: E8.5 - Finding → Q&A Quick-Add (AC: #7)
// ============================================================================

/**
 * Response from single finding Q&A check
 */
export interface QAExistenceResponse {
  exists: boolean
  qaItemId?: string
}

/**
 * Response from batch finding Q&A check
 */
export interface QABatchCheckResponse {
  results: Record<string, string | null>
}

/**
 * Check if a Q&A item exists for a specific finding
 * AC: #7 - Show indicator if Q&A already exists
 *
 * @param projectId - Project ID
 * @param findingId - Finding ID to check
 * @returns { exists: boolean, qaItemId?: string }
 */
export async function getQAItemByFindingId(
  projectId: string,
  findingId: string
): Promise<QAExistenceResponse> {
  const response = await fetch(`/api/projects/${projectId}/qa/by-finding/${findingId}`)

  if (!response.ok) {
    if (response.status === 404) {
      return { exists: false }
    }
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to check Q&A existence: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Batch check Q&A existence for multiple findings
 * More efficient than calling getQAItemByFindingId for each finding
 * AC: #7 - Show indicators efficiently for findings list
 *
 * @param projectId - Project ID
 * @param findingIds - Array of finding IDs to check
 * @returns { results: Record<string, string | null> } - Maps findingId to qaItemId or null
 */
export async function checkQAExistenceForFindings(
  projectId: string,
  findingIds: string[]
): Promise<QABatchCheckResponse> {
  if (findingIds.length === 0) {
    return { results: {} }
  }

  const response = await fetch(`/api/projects/${projectId}/qa/check-findings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ findingIds }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to check Q&A existence: ${response.statusText}`)
  }

  return response.json()
}

// ============================================================================
// Q&A Export Functions
// Story: E8.6 - Excel Export (AC: #1, #4)
// ============================================================================

/**
 * Export result with filename
 */
export interface QAExportDownloadResult {
  blob: Blob
  filename: string
}

/**
 * Export Q&A items to Excel file
 * AC: #1 - Returns valid .xlsx file
 * AC: #4 - Filter parameters apply before export
 *
 * @param projectId - Project ID
 * @param filters - Optional filters to apply before export
 * @returns Blob with filename extracted from Content-Disposition header
 */
export async function exportQAToExcel(
  projectId: string,
  filters?: QAFilters
): Promise<QAExportDownloadResult> {
  const params = new URLSearchParams()

  if (filters?.category) {
    params.set('category', filters.category)
  }
  if (filters?.priority) {
    params.set('priority', filters.priority)
  }
  if (filters?.status) {
    params.set('status', filters.status)
  }

  const url = `/api/projects/${projectId}/qa/export${params.toString() ? `?${params.toString()}` : ''}`

  const response = await fetch(url)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to export Q&A items: ${response.statusText}`)
  }

  // Get blob from response
  const blob = await response.blob()

  // Extract filename from Content-Disposition header or X-Export-Filename
  let filename = response.headers.get('X-Export-Filename') || 'qa_export.xlsx'

  // Try to parse Content-Disposition header
  const contentDisposition = response.headers.get('Content-Disposition')
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^";\n]+)"?/)
    if (match?.[1]) {
      filename = match[1]
    }
  }

  return { blob, filename }
}

/**
 * Export Q&A to Excel and trigger browser download
 *
 * @param projectId - Project ID
 * @param filters - Optional filters to apply before export
 * @returns filename of downloaded file
 */
export async function downloadQAExcel(
  projectId: string,
  filters?: QAFilters
): Promise<string> {
  const { blob, filename } = await exportQAToExcel(projectId, filters)

  // Create download link
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()

  // Cleanup
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  return filename
}

// ============================================================================
// Q&A Import Functions
// Story: E8.7 - Excel Import with Pattern Matching
// ============================================================================

import type {
  QAImportPreview,
  ImportConfirmation,
  ImportConfirmationResult,
  FuzzyMatchDecision,
} from '@/lib/types/qa'

/**
 * Response from import preview endpoint
 */
export interface QAImportPreviewResponse {
  preview: QAImportPreview
  projectId: string
}

/**
 * Response from import confirm endpoint
 */
export interface QAImportConfirmResponse {
  result: ImportConfirmationResult
  message: string
}

/**
 * Upload Excel file and get import preview
 * AC: #1 - POST /import/preview with Excel file returns categorized matches
 *
 * @param projectId - Project ID
 * @param file - Excel file to import
 * @returns Import preview with exact matches, fuzzy matches, and new items
 */
export async function uploadQAImportFile(
  projectId: string,
  file: File
): Promise<QAImportPreviewResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`/api/projects/${projectId}/qa/import/preview`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to upload import file: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Confirm and execute import
 * AC: #5 - POST /import/confirm merges approved items into Q&A list
 *
 * @param projectId - Project ID
 * @param preview - Import preview from uploadQAImportFile
 * @param options - Import options
 * @returns Import result with updated and created items
 */
export async function confirmQAImport(
  projectId: string,
  preview: QAImportPreview,
  options: {
    exactMatchIds?: string[]
    fuzzyMatchDecisions?: Record<string, FuzzyMatchDecision>
    importNewItems?: boolean
  } = {}
): Promise<QAImportConfirmResponse> {
  const body = {
    preview,
    exactMatchIds: options.exactMatchIds,
    fuzzyMatchDecisions: options.fuzzyMatchDecisions,
    importNewItems: options.importNewItems,
    newItemsToImport: options.importNewItems ? preview.newItems : undefined,
  }

  const response = await fetch(`/api/projects/${projectId}/qa/import/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to confirm import: ${response.statusText}`)
  }

  return response.json()
}
