/**
 * Findings Types
 *
 * TypeScript interfaces for Knowledge Explorer findings
 * Story: E4.1 - Build Knowledge Explorer UI Main Interface
 */

import type { Database } from '@/lib/supabase/database.types'

// Use the database enum types directly
export type FindingDomain = Database['public']['Enums']['finding_domain_enum']
export type FindingType = Database['public']['Enums']['finding_type_enum']
export type FindingStatus = 'pending' | 'validated' | 'rejected'

/**
 * Validation event for audit trail
 */
export interface ValidationEvent {
  action: 'validated' | 'rejected' | 'edited'
  previousValue?: string
  newValue?: string
  timestamp: string
  userId: string
}

/**
 * Base Finding interface matching database schema
 */
export interface Finding {
  id: string
  dealId: string
  documentId: string | null
  chunkId: string | null
  userId: string
  text: string
  sourceDocument: string | null
  pageNumber: number | null
  confidence: number | null
  findingType: FindingType | null
  domain: FindingDomain | null
  status: FindingStatus
  validationHistory: ValidationEvent[]
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string | null
}

/**
 * Finding with extended context for detail view
 */
export interface FindingWithContext extends Finding {
  document: {
    id: string
    name: string
    filePath: string
  } | null
  chunk: {
    id: string
    content: string
    sheetName: string | null
    cellReference: string | null
    pageNumber: number | null
  } | null
  relatedFindings: Finding[]
}

/**
 * Filter parameters for querying findings
 */
export interface FindingFilters {
  documentId?: string
  domain?: FindingDomain[]
  findingType?: FindingType[]
  confidenceMin?: number
  confidenceMax?: number
  status?: FindingStatus[]
  sortBy?: 'confidence' | 'createdAt' | 'domain'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

/**
 * Statistics for findings
 */
export interface FindingStats {
  total: number
  byDomain: Record<FindingDomain, number>
  byType: Record<FindingType, number>
  byStatus: Record<FindingStatus, number>
  avgConfidence: number
}

/**
 * Paginated response for findings
 */
export interface FindingsResponse {
  findings: Finding[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

/**
 * Domain display configuration
 */
export const FINDING_DOMAINS: { value: FindingDomain; label: string; color: string }[] = [
  { value: 'financial', label: 'Financial', color: 'bg-emerald-500' },
  { value: 'operational', label: 'Operational', color: 'bg-blue-500' },
  { value: 'market', label: 'Market', color: 'bg-purple-500' },
  { value: 'legal', label: 'Legal', color: 'bg-amber-500' },
  { value: 'technical', label: 'Technical', color: 'bg-slate-500' },
]

/**
 * Finding type display configuration
 */
export const FINDING_TYPES: { value: FindingType; label: string; color: string }[] = [
  { value: 'metric', label: 'Metric', color: 'bg-cyan-500' },
  { value: 'fact', label: 'Fact', color: 'bg-gray-500' },
  { value: 'risk', label: 'Risk', color: 'bg-red-500' },
  { value: 'opportunity', label: 'Opportunity', color: 'bg-green-500' },
  { value: 'contradiction', label: 'Contradiction', color: 'bg-orange-500' },
]

/**
 * Status display configuration
 */
export const FINDING_STATUSES: { value: FindingStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Pending', color: 'bg-yellow-500' },
  { value: 'validated', label: 'Validated', color: 'bg-green-500' },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-500' },
]

/**
 * Confidence level thresholds
 */
export const CONFIDENCE_LEVELS = {
  high: { min: 0.8, label: 'High', color: 'text-green-600 bg-green-100' },
  medium: { min: 0.6, max: 0.8, label: 'Medium', color: 'text-yellow-600 bg-yellow-100' },
  low: { max: 0.6, label: 'Low', color: 'text-red-600 bg-red-100' },
} as const

/**
 * Get confidence level info from value
 */
export function getConfidenceLevel(confidence: number | null): {
  level: 'high' | 'medium' | 'low' | 'unknown'
  label: string
  color: string
} {
  if (confidence === null) {
    return { level: 'unknown', label: 'Unknown', color: 'text-gray-500 bg-gray-100' }
  }
  if (confidence >= CONFIDENCE_LEVELS.high.min) {
    return { level: 'high', ...CONFIDENCE_LEVELS.high }
  }
  if (confidence >= CONFIDENCE_LEVELS.medium.min) {
    return { level: 'medium', ...CONFIDENCE_LEVELS.medium }
  }
  return { level: 'low', ...CONFIDENCE_LEVELS.low }
}

/**
 * Get domain display info
 */
export function getDomainInfo(domain: FindingDomain | null) {
  return FINDING_DOMAINS.find(d => d.value === domain) || { value: domain, label: domain || 'Unknown', color: 'bg-gray-500' }
}

/**
 * Get finding type display info
 */
export function getTypeInfo(type: FindingType | null) {
  return FINDING_TYPES.find(t => t.value === type) || { value: type, label: type || 'Unknown', color: 'bg-gray-500' }
}

/**
 * Get status display info
 */
export function getStatusInfo(status: FindingStatus) {
  return FINDING_STATUSES.find(s => s.value === status) || { value: status, label: status, color: 'bg-gray-500' }
}

/**
 * Finding with similarity score for search results
 */
export interface FindingWithSimilarity extends Finding {
  similarity: number
}

/**
 * Search response from the search API
 */
export interface SearchResponse {
  findings: FindingWithSimilarity[]
  total: number
  searchTime: number
  query: string
  cached?: boolean
}

/**
 * Search filters (subset of FindingFilters)
 */
export interface SearchFilters {
  documentId?: string
  domain?: FindingDomain[]
  status?: FindingStatus[]
  confidenceMin?: number
  confidenceMax?: number
}
