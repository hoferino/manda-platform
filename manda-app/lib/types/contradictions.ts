/**
 * Contradictions Types
 *
 * TypeScript interfaces for Knowledge Explorer contradictions
 * Story: E4.6 - Build Contradictions View
 */

import type { Finding } from './findings'

/**
 * Contradiction status values
 */
export type ContradictionStatus = 'unresolved' | 'resolved' | 'noted' | 'investigating'

/**
 * Resolution action types
 */
export type ContradictionResolutionAction = 'accept_a' | 'accept_b' | 'investigate' | 'noted'

/**
 * Base Contradiction interface matching database schema
 */
export interface Contradiction {
  id: string
  dealId: string
  findingAId: string
  findingBId: string
  confidence: number | null
  status: ContradictionStatus
  resolution: ContradictionResolutionAction | null
  resolutionNote: string | null
  detectedAt: string
  resolvedAt: string | null
  resolvedBy: string | null
  metadata: Record<string, unknown> | null
}

/**
 * Contradiction with joined finding data for display
 */
export interface ContradictionWithFindings extends Contradiction {
  findingA: Finding
  findingB: Finding
}

/**
 * Resolution request body for API
 */
export interface ContradictionResolution {
  action: ContradictionResolutionAction
  note?: string
}

/**
 * Filter parameters for querying contradictions
 */
export interface ContradictionFilters {
  status?: ContradictionStatus | 'all'
  page?: number
  limit?: number
}

/**
 * Paginated response for contradictions
 */
export interface ContradictionsResponse {
  contradictions: ContradictionWithFindings[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

/**
 * Status display configuration
 */
export const CONTRADICTION_STATUSES: {
  value: ContradictionStatus
  label: string
  color: string
  bgColor: string
  description: string
}[] = [
  {
    value: 'unresolved',
    label: 'Unresolved',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    description: 'Needs analyst review',
  },
  {
    value: 'resolved',
    label: 'Resolved',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    description: 'One finding accepted',
  },
  {
    value: 'investigating',
    label: 'Investigating',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    description: 'Requires further investigation',
  },
  {
    value: 'noted',
    label: 'Noted',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    description: 'Acknowledged discrepancy',
  },
]

/**
 * Filter options for the status dropdown
 */
export const CONTRADICTION_FILTER_OPTIONS: {
  value: ContradictionStatus | 'all'
  label: string
}[] = [
  { value: 'all', label: 'All' },
  { value: 'unresolved', label: 'Unresolved' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'noted', label: 'Noted' },
]

/**
 * Get status display info
 */
export function getContradictionStatusInfo(status: ContradictionStatus) {
  return (
    CONTRADICTION_STATUSES.find((s) => s.value === status) || {
      value: status,
      label: status,
      color: 'text-gray-500',
      bgColor: 'bg-gray-100',
      description: 'Unknown status',
    }
  )
}

/**
 * Helper to convert database row to Contradiction type
 */
export function mapContradictionFromDb(row: {
  id: string
  deal_id: string
  finding_a_id: string
  finding_b_id: string
  confidence: number | null
  status: string | null
  resolution: string | null
  resolution_note: string | null
  detected_at: string
  resolved_at: string | null
  resolved_by: string | null
  metadata: Record<string, unknown> | null
}): Contradiction {
  return {
    id: row.id,
    dealId: row.deal_id,
    findingAId: row.finding_a_id,
    findingBId: row.finding_b_id,
    confidence: row.confidence,
    status: (row.status as ContradictionStatus) || 'unresolved',
    resolution: row.resolution as ContradictionResolutionAction | null,
    resolutionNote: row.resolution_note,
    detectedAt: row.detected_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    metadata: row.metadata,
  }
}
