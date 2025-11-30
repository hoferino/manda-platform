/**
 * Gaps API Client
 *
 * Client-side functions for interacting with the gap analysis API.
 * Story: E4.8 - Build Gap Analysis View
 */

import type {
  Gap,
  GapFilters,
  GapsResponse,
  GapResolution,
  AddToIRLRequest,
  ManualFindingRequest,
  GapCategory,
  GapPriority,
  GapStatus,
} from '@/lib/types/gaps'

import type { Finding } from '@/lib/types/findings'

export type {
  Gap,
  GapFilters,
  GapsResponse,
  GapResolution,
  AddToIRLRequest,
  ManualFindingRequest,
  GapCategory,
  GapPriority,
  GapStatus,
}

/**
 * Build query string from filters
 */
function buildQueryString(filters: GapFilters): string {
  const params = new URLSearchParams()

  if (filters.category && filters.category !== 'all') {
    params.set('category', filters.category)
  }

  if (filters.status && filters.status !== 'all') {
    params.set('status', filters.status)
  }

  if (filters.priority && filters.priority !== 'all') {
    params.set('priority', filters.priority)
  }

  if (filters.sortBy) {
    params.set('sortBy', filters.sortBy)
  }

  if (filters.sortOrder) {
    params.set('sortOrder', filters.sortOrder)
  }

  return params.toString()
}

/**
 * Fetch gaps for a project with optional filters
 *
 * @param projectId - The project/deal ID
 * @param filters - Optional filter parameters
 * @returns GapsResponse with gaps and statistics
 */
export async function getProjectGaps(
  projectId: string,
  filters: GapFilters = {}
): Promise<GapsResponse> {
  const queryString = buildQueryString(filters)
  const url = `/api/projects/${projectId}/gaps${queryString ? `?${queryString}` : ''}`

  const response = await fetch(url)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch gaps')
  }

  return response.json()
}

/**
 * Resolve a gap (mark as resolved or not applicable)
 *
 * @param projectId - The project/deal ID
 * @param gapId - The gap ID to resolve
 * @param resolution - Resolution status and optional note
 * @returns Updated gap
 */
export async function resolveGap(
  projectId: string,
  gapId: string,
  resolution: GapResolution
): Promise<Gap> {
  const response = await fetch(
    `/api/projects/${projectId}/gaps/${gapId}/resolve`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resolution),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to resolve gap')
  }

  const result = await response.json()
  return result.gap
}

/**
 * Mark a gap as not applicable
 *
 * @param projectId - The project/deal ID
 * @param gapId - The gap ID
 * @param note - Optional note explaining why N/A
 * @returns Updated gap
 */
export async function markGapNotApplicable(
  projectId: string,
  gapId: string,
  note?: string
): Promise<Gap> {
  return resolveGap(projectId, gapId, {
    status: 'not_applicable',
    note,
  })
}

/**
 * Undo a gap resolution (revert to active)
 *
 * @param projectId - The project/deal ID
 * @param gapId - The gap ID
 * @returns Updated gap
 */
export async function undoGapResolution(
  projectId: string,
  gapId: string
): Promise<Gap> {
  const response = await fetch(
    `/api/projects/${projectId}/gaps/${gapId}/resolve`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to undo gap resolution')
  }

  const result = await response.json()
  return result.gap
}

/**
 * Create an IRL item from a gap (adds to IRL checklist)
 *
 * @param projectId - The project/deal ID
 * @param gapId - The gap ID
 * @param request - IRL item details
 * @returns Success response with created IRL item ID
 */
export async function createIrlFromGap(
  projectId: string,
  gapId: string,
  request: AddToIRLRequest
): Promise<{ success: boolean; irlItemId: string }> {
  const response = await fetch(
    `/api/projects/${projectId}/gaps/${gapId}/add-to-irl`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to add gap to IRL')
  }

  return response.json()
}

/**
 * Create a manual finding from a gap
 *
 * @param projectId - The project/deal ID
 * @param gapId - The gap ID
 * @param finding - Finding details
 * @returns Created finding
 */
export async function createManualFinding(
  projectId: string,
  gapId: string,
  finding: ManualFindingRequest
): Promise<Finding> {
  const response = await fetch(
    `/api/projects/${projectId}/gaps/${gapId}/add-finding`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finding),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create manual finding')
  }

  const result = await response.json()
  return result.finding
}

/**
 * Get count of active gaps for badge display
 *
 * @param projectId - The project/deal ID
 * @returns Count of active gaps
 */
export async function getActiveGapsCount(projectId: string): Promise<number> {
  const response = await getProjectGaps(projectId, { status: 'active' })
  return response.total - response.resolved
}

/**
 * Get gap statistics for a project
 *
 * @param projectId - The project/deal ID
 * @returns Gap statistics
 */
export async function getGapStats(projectId: string): Promise<{
  total: number
  irlGaps: number
  infoGaps: number
  resolved: number
  active: number
}> {
  const response = await getProjectGaps(projectId)
  return {
    total: response.total,
    irlGaps: response.irlGaps,
    infoGaps: response.infoGaps,
    resolved: response.resolved,
    active: response.total - response.resolved,
  }
}
