/**
 * Findings API Client
 *
 * Client-side functions for interacting with the findings API.
 * Story: E4.1 - Build Knowledge Explorer UI Main Interface (AC: #5)
 */

import type {
  Finding,
  FindingFilters,
  FindingsResponse,
  FindingStats,
  FindingDomain,
  FindingType,
  FindingStatus,
  SearchResponse,
  SearchFilters,
  FindingWithSimilarity,
} from '@/lib/types/findings'

export type {
  Finding,
  FindingFilters,
  FindingsResponse,
  FindingStats,
  FindingDomain,
  FindingType,
  FindingStatus,
  SearchResponse,
  SearchFilters,
  FindingWithSimilarity,
}

/**
 * Build query string from filters
 */
function buildQueryString(filters: FindingFilters): string {
  const params = new URLSearchParams()

  if (filters.documentId) {
    params.set('documentId', filters.documentId)
  }

  if (filters.domain && filters.domain.length > 0) {
    params.set('domain', filters.domain.join(','))
  }

  if (filters.findingType && filters.findingType.length > 0) {
    params.set('findingType', filters.findingType.join(','))
  }

  if (filters.status && filters.status.length > 0) {
    params.set('status', filters.status.join(','))
  }

  if (filters.confidenceMin !== undefined) {
    params.set('confidenceMin', filters.confidenceMin.toString())
  }

  if (filters.confidenceMax !== undefined) {
    params.set('confidenceMax', filters.confidenceMax.toString())
  }

  if (filters.sortBy) {
    params.set('sortBy', filters.sortBy)
  }

  if (filters.sortOrder) {
    params.set('sortOrder', filters.sortOrder)
  }

  if (filters.page) {
    params.set('page', filters.page.toString())
  }

  if (filters.limit) {
    params.set('limit', filters.limit.toString())
  }

  return params.toString()
}

/**
 * Fetch findings for a project with optional filters
 */
export async function getFindings(
  projectId: string,
  filters: FindingFilters = {}
): Promise<FindingsResponse> {
  const queryString = buildQueryString(filters)
  const url = `/api/projects/${projectId}/findings${queryString ? `?${queryString}` : ''}`

  const response = await fetch(url)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch findings')
  }

  return response.json()
}

/**
 * Create a new finding (manual entry)
 */
export async function createFinding(
  projectId: string,
  data: {
    text: string
    documentId?: string
    sourceDocument?: string
    pageNumber?: number
    confidence?: number
    findingType?: FindingType
    domain?: FindingDomain
    metadata?: Record<string, unknown>
  }
): Promise<Finding> {
  const response = await fetch(`/api/projects/${projectId}/findings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create finding')
  }

  const result = await response.json()
  return result.finding
}

/**
 * Update a finding (edit text or metadata)
 */
export async function updateFinding(
  projectId: string,
  findingId: string,
  updates: Partial<Pick<Finding, 'text' | 'status' | 'confidence'>>
): Promise<Finding> {
  const response = await fetch(`/api/projects/${projectId}/findings/${findingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update finding')
  }

  const result = await response.json()
  return result.finding
}

/**
 * Validate or reject a finding
 */
export async function validateFinding(
  projectId: string,
  findingId: string,
  action: 'confirm' | 'reject'
): Promise<Finding> {
  const response = await fetch(`/api/projects/${projectId}/findings/${findingId}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to validate finding')
  }

  const result = await response.json()
  return result.finding
}

/**
 * Get finding statistics for a project
 */
export async function getFindingStats(projectId: string): Promise<FindingStats> {
  const response = await fetch(`/api/projects/${projectId}/findings/stats`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch finding stats')
  }

  return response.json()
}

/**
 * Get documents for filter dropdown
 */
export async function getProjectDocuments(projectId: string): Promise<{ id: string; name: string }[]> {
  const response = await fetch(`/api/projects/${projectId}/documents`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch documents')
  }

  const result = await response.json()
  return result.documents || []
}

/**
 * Search findings using semantic search
 * Story: E4.2 - Implement Semantic Search for Findings (AC: #2, #3, #7, #8)
 *
 * @param projectId - The project/deal ID
 * @param query - Natural language search query
 * @param filters - Optional filters to narrow search scope
 * @param limit - Max number of results (default: 20)
 * @returns SearchResponse with findings and similarity scores
 */
export async function searchFindings(
  projectId: string,
  query: string,
  filters?: SearchFilters,
  limit: number = 20
): Promise<SearchResponse> {
  const response = await fetch(`/api/projects/${projectId}/findings/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      limit,
      filters,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Search failed')
  }

  return response.json()
}
