/**
 * Contradictions API Client
 *
 * Client-side functions for interacting with the contradictions API.
 * Story: E4.6 - Build Contradictions View (AC: #9)
 */

import type {
  Contradiction,
  ContradictionWithFindings,
  ContradictionFilters,
  ContradictionsResponse,
  ContradictionResolution,
  ContradictionStatus,
} from '@/lib/types/contradictions'

export type {
  Contradiction,
  ContradictionWithFindings,
  ContradictionFilters,
  ContradictionsResponse,
  ContradictionResolution,
  ContradictionStatus,
}

/**
 * Build query string from filters
 */
function buildQueryString(filters: ContradictionFilters): string {
  const params = new URLSearchParams()

  if (filters.status && filters.status !== 'all') {
    params.set('status', filters.status)
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
 * Fetch contradictions for a project with optional filters
 */
export async function getContradictions(
  projectId: string,
  filters: ContradictionFilters = {}
): Promise<ContradictionsResponse> {
  const queryString = buildQueryString(filters)
  const url = `/api/projects/${projectId}/contradictions${queryString ? `?${queryString}` : ''}`

  const response = await fetch(url)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch contradictions')
  }

  return response.json()
}

/**
 * Resolve a contradiction
 *
 * @param projectId - The project/deal ID
 * @param contradictionId - The contradiction ID to resolve
 * @param resolution - The resolution action and optional note
 * @returns Updated contradiction
 */
export async function resolveContradiction(
  projectId: string,
  contradictionId: string,
  resolution: ContradictionResolution
): Promise<Contradiction> {
  const response = await fetch(
    `/api/projects/${projectId}/contradictions/${contradictionId}/resolve`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resolution),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to resolve contradiction')
  }

  const result = await response.json()
  return result.contradiction
}

/**
 * Add a note to a contradiction (sets status to 'noted')
 *
 * @param projectId - The project/deal ID
 * @param contradictionId - The contradiction ID
 * @param note - The note text
 * @returns Updated contradiction
 */
export async function addNote(
  projectId: string,
  contradictionId: string,
  note: string
): Promise<Contradiction> {
  return resolveContradiction(projectId, contradictionId, {
    action: 'noted',
    note,
  })
}

/**
 * Mark a contradiction for investigation
 *
 * @param projectId - The project/deal ID
 * @param contradictionId - The contradiction ID
 * @param note - The investigation reason/note
 * @returns Updated contradiction
 */
export async function markForInvestigation(
  projectId: string,
  contradictionId: string,
  note: string
): Promise<Contradiction> {
  return resolveContradiction(projectId, contradictionId, {
    action: 'investigate',
    note,
  })
}

/**
 * Accept Finding A (resolves contradiction, validates A, rejects B)
 *
 * @param projectId - The project/deal ID
 * @param contradictionId - The contradiction ID
 * @returns Updated contradiction
 */
export async function acceptFindingA(
  projectId: string,
  contradictionId: string
): Promise<Contradiction> {
  return resolveContradiction(projectId, contradictionId, {
    action: 'accept_a',
  })
}

/**
 * Accept Finding B (resolves contradiction, validates B, rejects A)
 *
 * @param projectId - The project/deal ID
 * @param contradictionId - The contradiction ID
 * @returns Updated contradiction
 */
export async function acceptFindingB(
  projectId: string,
  contradictionId: string
): Promise<Contradiction> {
  return resolveContradiction(projectId, contradictionId, {
    action: 'accept_b',
  })
}

/**
 * Get count of unresolved contradictions for badge display
 *
 * @param projectId - The project/deal ID
 * @returns Count of unresolved contradictions
 */
export async function getUnresolvedCount(projectId: string): Promise<number> {
  const response = await getContradictions(projectId, {
    status: 'unresolved',
    limit: 1, // We only need the count
  })

  return response.total
}
