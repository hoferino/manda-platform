/**
 * Findings API Client
 *
 * Client-side functions for interacting with the findings API.
 * Story: E4.1 - Build Knowledge Explorer UI Main Interface (AC: #5)
 * Story: E4.11 - Build Bulk Actions for Finding Management (AC: #7)
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
  FindingWithContext,
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
  FindingWithContext,
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

/**
 * Get a single finding with full context
 * Story: E4.9 - Implement Finding Detail View with Full Context (AC: #2, #3, #4, #5, #6)
 *
 * @param projectId - The project/deal ID
 * @param findingId - The finding ID
 * @returns FindingWithContext with document, chunk, related findings, and validation history
 */
export async function getFindingById(
  projectId: string,
  findingId: string
): Promise<FindingWithContext> {
  const response = await fetch(`/api/projects/${projectId}/findings/${findingId}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch finding')
  }

  const result = await response.json()
  return result.finding
}

/**
 * Export format type
 */
export type ExportFormat = 'csv' | 'xlsx'

/**
 * Export filters (subset of FindingFilters for export)
 */
export interface ExportFilters {
  documentId?: string
  domain?: FindingDomain[]
  findingType?: FindingType[]
  status?: FindingStatus[]
  confidenceMin?: number
  confidenceMax?: number
}

/**
 * Export result with filename
 */
export interface ExportResult {
  filename: string
  count: number
}

/**
 * Export findings to CSV or Excel
 * Story: E4.10 - Implement Export Findings to CSV/Excel (AC: #2, #3, #6)
 *
 * @param projectId - The project/deal ID
 * @param format - Export format ('csv' or 'xlsx')
 * @param filters - Optional filters to apply to export
 * @param searchQuery - Optional search query (for semantic search exports)
 * @returns ExportResult with filename and count
 */
export async function exportFindings(
  projectId: string,
  format: ExportFormat,
  filters?: ExportFilters,
  searchQuery?: string
): Promise<ExportResult> {
  const response = await fetch(`/api/projects/${projectId}/findings/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      format,
      filters,
      searchQuery,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Export failed')
  }

  // Get metadata from headers
  const filename = response.headers.get('X-Export-Filename') || `findings-export.${format}`
  const count = parseInt(response.headers.get('X-Export-Count') || '0', 10)

  // Get blob and trigger download
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)

  // Create download link and trigger click
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()

  // Cleanup
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  return { filename, count }
}

/**
 * Batch result for individual finding
 */
export interface BatchFindingResult {
  id: string
  success: boolean
  finding?: Finding
  error?: string
}

/**
 * Batch action response
 */
export interface BatchActionResponse {
  results: BatchFindingResult[]
  summary: {
    total: number
    succeeded: number
    failed: number
  }
}

/**
 * Batch validate or reject multiple findings
 * Story: E4.11 - Build Bulk Actions for Finding Management (AC: #7, #8)
 *
 * @param projectId - The project/deal ID
 * @param action - Action to perform ('confirm' | 'reject')
 * @param findingIds - Array of finding IDs to process
 * @returns BatchActionResponse with results and summary
 */
export async function batchValidateFindings(
  projectId: string,
  action: 'confirm' | 'reject',
  findingIds: string[]
): Promise<BatchActionResponse> {
  const response = await fetch(`/api/projects/${projectId}/findings/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, findingIds }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Batch action failed')
  }

  return response.json()
}
