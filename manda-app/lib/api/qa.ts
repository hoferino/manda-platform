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
