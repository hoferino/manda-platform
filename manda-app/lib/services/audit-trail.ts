/**
 * Audit Trail Service
 *
 * Provides comprehensive audit trail querying for all feedback types.
 * Story: E7.5 - Maintain Comprehensive Audit Trail
 *
 * Features:
 * - Query corrections, validations, and edits (AC: #1, #2, #3)
 * - Filter by date range, analyst, finding (AC: #5)
 * - Get complete finding history with correction lineage (AC: #7)
 * - Immutability guarantee through append-only tables (AC: #4)
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase/database.types'
import {
  AuditQueryParams,
  AuditEntry,
  AuditEntryType,
  FindingHistoryEntry,
  PaginatedAuditResult,
  FindingCorrection,
  ValidationFeedback,
  ResponseEdit,
  mapDbToFindingCorrection,
  mapDbToResponseEdit,
  ValidationAction,
} from '@/lib/types/feedback'

// Default query limits
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 1000

/**
 * Type for validation_feedback table row (manual type until migration is applied)
 */
interface ValidationFeedbackRow {
  id: string
  finding_id: string
  action: 'validate' | 'reject'
  reason: string | null
  analyst_id: string
  created_at: string
}

/**
 * Convert date parameter to ISO string
 */
function toISOString(date: Date | string | undefined): string | undefined {
  if (!date) return undefined
  if (date instanceof Date) return date.toISOString()
  return date
}

/**
 * Query corrections with filters
 * (AC: #1 - corrections logged with finding_id, original, corrected, analyst, timestamp)
 * (AC: #5 - queryable by date range, analyst, finding)
 */
export async function queryCorrections(
  supabase: SupabaseClient<Database>,
  dealId: string,
  params: AuditQueryParams = {}
): Promise<PaginatedAuditResult<FindingCorrection>> {
  const limit = Math.min(params.limit || DEFAULT_LIMIT, MAX_LIMIT)
  const offset = params.offset || 0
  const orderDir = params.orderDir === 'asc'

  // First get all finding IDs for this deal
  const { data: findings, error: findingsError } = await supabase
    .from('findings')
    .select('id')
    .eq('deal_id', dealId)

  if (findingsError || !findings || findings.length === 0) {
    return { data: [], total: 0, limit, offset, hasMore: false }
  }

  const findingIds = findings.map(f => f.id)

  // Build query
  let query = supabase
    .from('finding_corrections')
    .select('*', { count: 'exact' })
    .in('finding_id', findingIds)

  // Apply filters
  const startDate = toISOString(params.startDate)
  const endDate = toISOString(params.endDate)

  if (startDate) {
    query = query.gte('created_at', startDate)
  }
  if (endDate) {
    query = query.lte('created_at', endDate)
  }
  if (params.analystId) {
    query = query.eq('analyst_id', params.analystId)
  }
  if (params.findingId) {
    query = query.eq('finding_id', params.findingId)
  }

  // Apply ordering and pagination
  const orderColumn = params.orderBy === 'analyst_id' ? 'analyst_id' : 'created_at'
  query = query
    .order(orderColumn, { ascending: orderDir })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('[audit-trail] Error querying corrections:', error)
    return { data: [], total: 0, limit, offset, hasMore: false }
  }

  const corrections = (data || []).map(mapDbToFindingCorrection)
  const total = count || 0

  return {
    data: corrections,
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  }
}

/**
 * Query validations with filters
 * (AC: #2 - validations logged with finding_id, action, analyst, timestamp)
 * (AC: #5 - queryable by date range, analyst, finding)
 */
export async function queryValidations(
  supabase: SupabaseClient<Database>,
  dealId: string,
  params: AuditQueryParams = {}
): Promise<PaginatedAuditResult<ValidationFeedback>> {
  const limit = Math.min(params.limit || DEFAULT_LIMIT, MAX_LIMIT)
  const offset = params.offset || 0
  const orderDir = params.orderDir === 'asc'

  // First get all finding IDs for this deal
  const { data: findings, error: findingsError } = await supabase
    .from('findings')
    .select('id')
    .eq('deal_id', dealId)

  if (findingsError || !findings || findings.length === 0) {
    return { data: [], total: 0, limit, offset, hasMore: false }
  }

  const findingIds = findings.map(f => f.id)

  // Build query using type assertion for table not in generated types
  type QueryBuilder = {
    from: (table: string) => {
      select: (cols: string, opts?: { count: string }) => {
        in: (col: string, vals: string[]) => QueryBuilder['chain']
      }
    }
    chain: {
      gte: (col: string, val: string) => QueryBuilder['chain']
      lte: (col: string, val: string) => QueryBuilder['chain']
      eq: (col: string, val: string) => QueryBuilder['chain']
      order: (col: string, opts: { ascending: boolean }) => QueryBuilder['chain']
      range: (from: number, to: number) => Promise<{ data: ValidationFeedbackRow[] | null; error: unknown; count: number | null }>
    }
  }

  let query = (supabase as unknown as QueryBuilder)
    .from('validation_feedback')
    .select('*', { count: 'exact' })
    .in('finding_id', findingIds)

  // Apply filters
  const startDate = toISOString(params.startDate)
  const endDate = toISOString(params.endDate)

  if (startDate) {
    query = query.gte('created_at', startDate)
  }
  if (endDate) {
    query = query.lte('created_at', endDate)
  }
  if (params.analystId) {
    query = query.eq('analyst_id', params.analystId)
  }
  if (params.findingId) {
    query = query.eq('finding_id', params.findingId)
  }

  // Apply ordering and pagination
  const orderColumn = params.orderBy === 'analyst_id' ? 'analyst_id' : 'created_at'
  const { data, error, count } = await query
    .order(orderColumn, { ascending: orderDir })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('[audit-trail] Error querying validations:', error)
    return { data: [], total: 0, limit, offset, hasMore: false }
  }

  const validations: ValidationFeedback[] = (data || []).map(row => ({
    id: row.id,
    findingId: row.finding_id,
    action: row.action as ValidationAction,
    reason: row.reason ?? undefined,
    analystId: row.analyst_id,
    createdAt: row.created_at ?? new Date().toISOString(),
  }))

  const total = count || 0

  return {
    data: validations,
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  }
}

/**
 * Query response edits with filters
 * (AC: #3 - edits logged with message_id, original, edited, analyst, timestamp)
 * (AC: #5 - queryable by date range, analyst)
 */
export async function queryResponseEdits(
  supabase: SupabaseClient<Database>,
  dealId: string,
  params: AuditQueryParams = {}
): Promise<PaginatedAuditResult<ResponseEdit>> {
  const limit = Math.min(params.limit || DEFAULT_LIMIT, MAX_LIMIT)
  const offset = params.offset || 0
  const orderDir = params.orderDir === 'asc'

  // Response edits are linked to messages via chat_messages table
  // For now, we'll query all response_edits since they don't have direct deal_id
  // In production, this should join through chat_messages -> chat_sessions -> deal_id

  // Build query
  let query = supabase
    .from('response_edits')
    .select('*', { count: 'exact' })

  // Apply filters
  const startDate = toISOString(params.startDate)
  const endDate = toISOString(params.endDate)

  if (startDate) {
    query = query.gte('created_at', startDate)
  }
  if (endDate) {
    query = query.lte('created_at', endDate)
  }
  if (params.analystId) {
    query = query.eq('analyst_id', params.analystId)
  }
  if (params.messageId) {
    query = query.eq('message_id', params.messageId)
  }

  // Apply ordering and pagination
  const orderColumn = params.orderBy === 'analyst_id' ? 'analyst_id' : 'created_at'
  query = query
    .order(orderColumn, { ascending: orderDir })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('[audit-trail] Error querying response edits:', error)
    return { data: [], total: 0, limit, offset, hasMore: false }
  }

  const edits = (data || []).map(mapDbToResponseEdit)
  const total = count || 0

  return {
    data: edits,
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  }
}

/**
 * Query all feedback types combined (corrections, validations, edits)
 * Returns unified AuditEntry list sorted by timestamp
 * (AC: #5 - queryable by date range, analyst, finding)
 */
export async function queryAllFeedback(
  supabase: SupabaseClient<Database>,
  dealId: string,
  params: AuditQueryParams = {}
): Promise<PaginatedAuditResult<AuditEntry>> {
  const types = params.types || ['correction', 'validation', 'edit']
  const limit = Math.min(params.limit || DEFAULT_LIMIT, MAX_LIMIT)
  const offset = params.offset || 0

  // Query each type in parallel
  const [corrections, validations, edits] = await Promise.all([
    types.includes('correction')
      ? queryCorrections(supabase, dealId, { ...params, limit: MAX_LIMIT, offset: 0 })
      : Promise.resolve({ data: [], total: 0, limit: 0, offset: 0, hasMore: false }),
    types.includes('validation')
      ? queryValidations(supabase, dealId, { ...params, limit: MAX_LIMIT, offset: 0 })
      : Promise.resolve({ data: [], total: 0, limit: 0, offset: 0, hasMore: false }),
    types.includes('edit')
      ? queryResponseEdits(supabase, dealId, { ...params, limit: MAX_LIMIT, offset: 0 })
      : Promise.resolve({ data: [], total: 0, limit: 0, offset: 0, hasMore: false }),
  ])

  // Convert to AuditEntry format
  const allEntries: AuditEntry[] = [
    ...corrections.data.map(c => ({
      type: 'correction' as AuditEntryType,
      id: c.id,
      timestamp: c.createdAt,
      analystId: c.analystId,
      findingId: c.findingId,
      data: c,
    })),
    ...validations.data.map(v => ({
      type: 'validation' as AuditEntryType,
      id: v.id,
      timestamp: v.createdAt,
      analystId: v.analystId,
      findingId: v.findingId,
      data: v,
    })),
    ...edits.data.map(e => ({
      type: 'edit' as AuditEntryType,
      id: e.id,
      timestamp: e.createdAt,
      analystId: e.analystId,
      messageId: e.messageId,
      data: e,
    })),
  ]

  // Sort by timestamp
  const orderDir = params.orderDir === 'asc' ? 1 : -1
  allEntries.sort((a, b) => {
    const dateA = new Date(a.timestamp).getTime()
    const dateB = new Date(b.timestamp).getTime()
    return (dateA - dateB) * orderDir
  })

  // Apply pagination
  const paginatedEntries = allEntries.slice(offset, offset + limit)
  const total = allEntries.length

  return {
    data: paginatedEntries,
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  }
}

/**
 * Get complete finding history with correction lineage
 * (AC: #7 - Finding history view shows complete correction lineage)
 */
export async function getFindingHistory(
  supabase: SupabaseClient<Database>,
  findingId: string
): Promise<FindingHistoryEntry | null> {
  try {
    // Get the finding to retrieve confidence info
    const { data: finding, error: findingError } = await supabase
      .from('findings')
      .select('id, confidence')
      .eq('id', findingId)
      .single()

    if (findingError || !finding) {
      console.error('[audit-trail] Finding not found:', findingError)
      return null
    }

    // Query corrections for this finding
    const { data: correctionsData, error: correctionsError } = await supabase
      .from('finding_corrections')
      .select('*')
      .eq('finding_id', findingId)
      .order('created_at', { ascending: true })

    if (correctionsError) {
      console.error('[audit-trail] Error fetching corrections:', correctionsError)
    }

    const corrections = (correctionsData || []).map(mapDbToFindingCorrection)

    // Query validations for this finding
    type ValidationQuery = {
      from: (table: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            order: (col: string, opts: { ascending: boolean }) => Promise<{ data: ValidationFeedbackRow[] | null; error: unknown }>
          }
        }
      }
    }

    const { data: validationsData, error: validationsError } = await (supabase as unknown as ValidationQuery)
      .from('validation_feedback')
      .select('*')
      .eq('finding_id', findingId)
      .order('created_at', { ascending: true })

    if (validationsError) {
      console.error('[audit-trail] Error fetching validations:', validationsError)
    }

    const validations: ValidationFeedback[] = (validationsData || []).map(row => ({
      id: row.id,
      findingId: row.finding_id,
      action: row.action as ValidationAction,
      reason: row.reason ?? undefined,
      analystId: row.analyst_id,
      createdAt: row.created_at ?? new Date().toISOString(),
    }))

    // Calculate confidence impact
    const validationCount = validations.filter(v => v.action === 'validate').length
    const rejectionCount = validations.filter(v => v.action === 'reject').length

    // Assume original confidence was 0.5 if we don't have correction history
    // In practice, the first correction would have the original value
    const originalConfidence = corrections.length > 0
      ? 0.5 // Default, would need to track original in corrections
      : (finding.confidence ?? 0.5)

    // Build combined timeline
    const timeline: AuditEntry[] = [
      ...corrections.map(c => ({
        type: 'correction' as AuditEntryType,
        id: c.id,
        timestamp: c.createdAt,
        analystId: c.analystId,
        findingId: c.findingId,
        data: c,
      })),
      ...validations.map(v => ({
        type: 'validation' as AuditEntryType,
        id: v.id,
        timestamp: v.createdAt,
        analystId: v.analystId,
        findingId: v.findingId,
        data: v,
      })),
    ]

    // Sort timeline by timestamp ascending
    timeline.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime()
      const dateB = new Date(b.timestamp).getTime()
      return dateA - dateB
    })

    return {
      findingId,
      corrections,
      validations,
      confidenceImpact: {
        original: originalConfidence,
        current: finding.confidence ?? originalConfidence,
        validationCount,
        rejectionCount,
      },
      timeline,
    }
  } catch (err) {
    console.error('[audit-trail] Error getting finding history:', err)
    return null
  }
}

/**
 * Get unique analysts who have provided feedback for a deal
 * Useful for populating analyst filter dropdowns
 */
export async function getAnalystsWithFeedback(
  supabase: SupabaseClient<Database>,
  dealId: string
): Promise<string[]> {
  try {
    // Get finding IDs for this deal
    const { data: findings } = await supabase
      .from('findings')
      .select('id')
      .eq('deal_id', dealId)

    if (!findings || findings.length === 0) {
      return []
    }

    const findingIds = findings.map(f => f.id)

    // Get analysts from corrections
    const { data: correctionAnalysts } = await supabase
      .from('finding_corrections')
      .select('analyst_id')
      .in('finding_id', findingIds)

    // Get analysts from validations
    type AnalystQuery = {
      from: (table: string) => {
        select: (cols: string) => {
          in: (col: string, vals: string[]) => Promise<{ data: { analyst_id: string }[] | null; error: unknown }>
        }
      }
    }

    const { data: validationAnalysts } = await (supabase as unknown as AnalystQuery)
      .from('validation_feedback')
      .select('analyst_id')
      .in('finding_id', findingIds)

    // Get analysts from response_edits
    const { data: editAnalysts } = await supabase
      .from('response_edits')
      .select('analyst_id')

    // Combine and deduplicate
    const allAnalystIds = new Set<string>()

    correctionAnalysts?.forEach(c => allAnalystIds.add(c.analyst_id))
    validationAnalysts?.forEach(v => allAnalystIds.add(v.analyst_id))
    editAnalysts?.forEach(e => allAnalystIds.add(e.analyst_id))

    return Array.from(allAnalystIds)
  } catch (err) {
    console.error('[audit-trail] Error getting analysts:', err)
    return []
  }
}

/**
 * Get audit trail statistics for a deal
 */
export async function getAuditStats(
  supabase: SupabaseClient<Database>,
  dealId: string
): Promise<{
  totalCorrections: number
  totalValidations: number
  totalEdits: number
  uniqueAnalysts: number
  dateRange: { earliest: string | null; latest: string | null }
}> {
  try {
    const [corrections, validations, edits, analysts] = await Promise.all([
      queryCorrections(supabase, dealId, { limit: 1 }),
      queryValidations(supabase, dealId, { limit: 1 }),
      queryResponseEdits(supabase, dealId, { limit: 1 }),
      getAnalystsWithFeedback(supabase, dealId),
    ])

    // Get date range from all feedback
    const allFeedback = await queryAllFeedback(supabase, dealId, {
      limit: 1,
      orderDir: 'asc'
    })
    const allFeedbackDesc = await queryAllFeedback(supabase, dealId, {
      limit: 1,
      orderDir: 'desc'
    })

    return {
      totalCorrections: corrections.total,
      totalValidations: validations.total,
      totalEdits: edits.total,
      uniqueAnalysts: analysts.length,
      dateRange: {
        earliest: allFeedback.data[0]?.timestamp || null,
        latest: allFeedbackDesc.data[0]?.timestamp || null,
      },
    }
  } catch (err) {
    console.error('[audit-trail] Error getting stats:', err)
    return {
      totalCorrections: 0,
      totalValidations: 0,
      totalEdits: 0,
      uniqueAnalysts: 0,
      dateRange: { earliest: null, latest: null },
    }
  }
}