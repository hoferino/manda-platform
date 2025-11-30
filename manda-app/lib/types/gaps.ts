/**
 * Gap Analysis Types
 *
 * TypeScript interfaces for Knowledge Explorer gap analysis
 * Story: E4.8 - Build Gap Analysis View
 */

import type { FindingDomain } from './findings'
import type { IRLItem } from '@/lib/api/irl'

/**
 * Gap category values
 */
export type GapCategory = 'irl_missing' | 'information_gap' | 'incomplete_analysis'

/**
 * Gap priority values
 */
export type GapPriority = 'high' | 'medium' | 'low'

/**
 * Gap status values
 */
export type GapStatus = 'active' | 'resolved' | 'not_applicable'

/**
 * Base Gap interface
 * Note: Gaps are computed at runtime from IRL items and findings coverage,
 * not stored in a dedicated database table
 */
export interface Gap {
  id: string
  dealId: string
  category: GapCategory
  description: string
  priority: GapPriority
  status: GapStatus
  domain?: FindingDomain | null
  relatedIrlItemId?: string | null
  relatedIrlItem?: IRLItem | null
  source: string
  detectedAt: string
  resolvedAt?: string | null
  metadata?: Record<string, unknown> | null
}

/**
 * IRL Gap - An IRL item without a linked document
 */
export interface IRLGap extends Gap {
  category: 'irl_missing'
  relatedIrlItemId: string
  relatedIrlItem: IRLItem
}

/**
 * Information Gap - Missing data based on domain coverage
 */
export interface InformationGap extends Gap {
  category: 'information_gap'
  domain: FindingDomain
  findingsCount: number
  expectedMinimum: number
}

/**
 * Filter parameters for querying gaps
 */
export interface GapFilters {
  category?: GapCategory | 'all'
  status?: GapStatus | 'all'
  priority?: GapPriority | 'all'
  sortBy?: 'priority' | 'category' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

/**
 * Response for gaps endpoint
 */
export interface GapsResponse {
  gaps: Gap[]
  irlGaps: number
  infoGaps: number
  total: number
  resolved: number
}

/**
 * Request body for resolving a gap
 */
export interface GapResolution {
  status: 'resolved' | 'not_applicable' | 'active'
  note?: string
}

/**
 * Request body for adding a gap to IRL
 */
export interface AddToIRLRequest {
  irlId: string
  name?: string
  category?: string
  required?: boolean
}

/**
 * Request body for creating a manual finding from a gap
 */
export interface ManualFindingRequest {
  text: string
  domain: FindingDomain
  confidence?: number
  sourceNotes?: string
}

/**
 * Gap category display configuration
 */
export const GAP_CATEGORIES: {
  value: GapCategory
  label: string
  color: string
  bgColor: string
  description: string
}[] = [
  {
    value: 'irl_missing',
    label: 'IRL Items Not Received',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    description: 'Documents requested but not yet received',
  },
  {
    value: 'information_gap',
    label: 'Information Gap',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    description: 'Missing data points from analysis',
  },
  {
    value: 'incomplete_analysis',
    label: 'Incomplete Analysis',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    description: 'Domain with sparse findings coverage',
  },
]

/**
 * Gap priority display configuration
 */
export const GAP_PRIORITIES: {
  value: GapPriority
  label: string
  color: string
  bgColor: string
  textColor: string
}[] = [
  {
    value: 'high',
    label: 'High',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
  },
  {
    value: 'medium',
    label: 'Medium',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-700',
  },
  {
    value: 'low',
    label: 'Low',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
  },
]

/**
 * Gap status display configuration
 */
export const GAP_STATUSES: {
  value: GapStatus
  label: string
  color: string
  bgColor: string
}[] = [
  {
    value: 'active',
    label: 'Active',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
  {
    value: 'resolved',
    label: 'Resolved',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  {
    value: 'not_applicable',
    label: 'N/A',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
]

/**
 * Filter options for category dropdown
 */
export const GAP_CATEGORY_FILTER_OPTIONS: {
  value: GapCategory | 'all'
  label: string
}[] = [
  { value: 'all', label: 'All Categories' },
  { value: 'irl_missing', label: 'IRL Items Not Received' },
  { value: 'information_gap', label: 'Information Gaps' },
  { value: 'incomplete_analysis', label: 'Incomplete Analysis' },
]

/**
 * Filter options for status dropdown
 */
export const GAP_STATUS_FILTER_OPTIONS: {
  value: GapStatus | 'all'
  label: string
}[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'not_applicable', label: 'Not Applicable' },
]

/**
 * Filter options for priority dropdown
 */
export const GAP_PRIORITY_FILTER_OPTIONS: {
  value: GapPriority | 'all'
  label: string
}[] = [
  { value: 'all', label: 'All Priorities' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

/**
 * Sort options for gaps
 */
export const GAP_SORT_OPTIONS: {
  value: GapFilters['sortBy']
  label: string
}[] = [
  { value: 'priority', label: 'Priority' },
  { value: 'category', label: 'Category' },
  { value: 'createdAt', label: 'Created Date' },
]

/**
 * Get category display info
 */
export function getGapCategoryInfo(category: GapCategory) {
  return (
    GAP_CATEGORIES.find((c) => c.value === category) || {
      value: category,
      label: category,
      color: 'text-gray-500',
      bgColor: 'bg-gray-100',
      description: 'Unknown category',
    }
  )
}

/**
 * Get priority display info
 */
export function getGapPriorityInfo(priority: GapPriority) {
  return (
    GAP_PRIORITIES.find((p) => p.value === priority) || {
      value: priority,
      label: priority,
      color: 'text-gray-500',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-700',
    }
  )
}

/**
 * Get status display info
 */
export function getGapStatusInfo(status: GapStatus) {
  return (
    GAP_STATUSES.find((s) => s.value === status) || {
      value: status,
      label: status,
      color: 'text-gray-500',
      bgColor: 'bg-gray-100',
    }
  )
}

/**
 * Priority sort order for sorting gaps
 */
export const PRIORITY_ORDER: Record<GapPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

/**
 * Sort gaps by priority (high first)
 */
export function sortGapsByPriority(gaps: Gap[]): Gap[] {
  return [...gaps].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  )
}

/**
 * Sort gaps by category
 */
export function sortGapsByCategory(gaps: Gap[]): Gap[] {
  const categoryOrder: Record<GapCategory, number> = {
    irl_missing: 0,
    information_gap: 1,
    incomplete_analysis: 2,
  }
  return [...gaps].sort(
    (a, b) => categoryOrder[a.category] - categoryOrder[b.category]
  )
}

/**
 * Filter gaps by criteria
 */
export function filterGaps(gaps: Gap[], filters: GapFilters): Gap[] {
  return gaps.filter((gap) => {
    if (filters.category && filters.category !== 'all' && gap.category !== filters.category) {
      return false
    }
    if (filters.status && filters.status !== 'all' && gap.status !== filters.status) {
      return false
    }
    if (filters.priority && filters.priority !== 'all' && gap.priority !== filters.priority) {
      return false
    }
    return true
  })
}
