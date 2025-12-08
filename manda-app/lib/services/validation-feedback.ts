/**
 * Validation Feedback Service
 *
 * Handles recording and processing of finding validation/rejection feedback.
 * Story: E7.2 - Track Validation/Rejection Feedback
 *
 * Features:
 * - Record validation and rejection actions (AC: #2, #3)
 * - Adjust confidence scores based on feedback (AC: #4, #5)
 * - Track source rejection rates for flagging (AC: #6)
 * - Append-only audit trail for compliance
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase/database.types'
import {
  ValidationAction,
  ValidationFeedback,
  FindingValidationStats,
  ValidationFeedbackResult,
  SourceRejectionInfo,
} from '@/lib/types/feedback'
import { getFeatureFlag } from '@/lib/config/feature-flags'

// Type for validation_feedback table (until migration is applied remotely)
// This will be replaced by Database types after migration
interface ValidationFeedbackRow {
  id: string
  finding_id: string
  action: 'validate' | 'reject'
  reason: string | null
  analyst_id: string
  created_at: string
}

type ValidationFeedbackInsert = Omit<ValidationFeedbackRow, 'id' | 'created_at'>

// Confidence adjustment constants from tech spec
const VALIDATION_BOOST = 0.05 // +0.05 per validation
const REJECTION_PENALTY = 0.10 // -0.10 per rejection
const MIN_CONFIDENCE = 0.1 // Floor
const MAX_CONFIDENCE = 0.95 // Cap
const SOURCE_REJECTION_THRESHOLD = 0.5 // 50% rejection rate triggers flagging

/**
 * Calculate adjusted confidence based on validation/rejection counts
 * Formula: baseConfidence + (validationCount * 0.05) - (rejectionCount * 0.10)
 * Capped at [0.1, 0.95]
 *
 * (AC: #4, #5)
 *
 * @param baseConfidence - Original confidence score
 * @param validationCount - Number of validations
 * @param rejectionCount - Number of rejections
 * @returns Adjusted confidence score within bounds
 */
export function calculateAdjustedConfidence(
  baseConfidence: number,
  validationCount: number,
  rejectionCount: number
): number {
  const adjustment = (validationCount * VALIDATION_BOOST) - (rejectionCount * REJECTION_PENALTY)
  const adjusted = baseConfidence + adjustment
  return Math.max(MIN_CONFIDENCE, Math.min(MAX_CONFIDENCE, adjusted))
}

/**
 * Get validation statistics for a finding
 * Uses the finding_validation_stats view for efficient aggregation
 *
 * @param supabase - Supabase client
 * @param findingId - Finding UUID
 * @returns Validation statistics or null if not found
 */
export async function getValidationStats(
  supabase: SupabaseClient<Database>,
  findingId: string
): Promise<FindingValidationStats | null> {
  try {
    // Query the view for aggregated stats
    // Using rpc or raw query since view types aren't generated
    const { data, error } = await (supabase as unknown as { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: string) => { single: () => Promise<{ data: unknown; error: unknown }> } } } })
      .from('finding_validation_stats')
      .select('*')
      .eq('finding_id', findingId)
      .single()

    if (error) {
      const err = error as { code?: string }
      // PGRST116 means no rows found - not an error for new findings
      if (err.code === 'PGRST116') {
        return {
          findingId,
          validationCount: 0,
          rejectionCount: 0,
          totalFeedback: 0,
        }
      }
      console.error('[validation-feedback] Error getting stats:', error)
      return null
    }

    const row = data as Record<string, unknown>
    return {
      findingId,
      validationCount: Number(row.validation_count) || 0,
      rejectionCount: Number(row.rejection_count) || 0,
      totalFeedback: Number(row.total_feedback) || 0,
    }
  } catch (err) {
    console.error('[validation-feedback] Error getting stats:', err)
    return null
  }
}

/**
 * Get validation statistics by counting feedback records directly
 * Fallback for when the view is not available
 */
export async function getValidationStatsDirect(
  supabase: SupabaseClient<Database>,
  findingId: string
): Promise<FindingValidationStats> {
  try {
    // Use type assertion for table that isn't in generated types yet
    const { data, error } = await (supabase as unknown as { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: string) => Promise<{ data: ValidationFeedbackRow[] | null; error: unknown }> } } })
      .from('validation_feedback')
      .select('action')
      .eq('finding_id', findingId)

    if (error) {
      console.error('[validation-feedback] Error getting stats directly:', error)
      return {
        findingId,
        validationCount: 0,
        rejectionCount: 0,
        totalFeedback: 0,
      }
    }

    const rows = (data || []) as { action: string }[]
    const stats = rows.reduce(
      (acc, row) => {
        if (row.action === 'validate') acc.validationCount++
        if (row.action === 'reject') acc.rejectionCount++
        acc.totalFeedback++
        return acc
      },
      { findingId, validationCount: 0, rejectionCount: 0, totalFeedback: 0 }
    )

    return stats
  } catch (err) {
    console.error('[validation-feedback] Error getting stats directly:', err)
    return {
      findingId,
      validationCount: 0,
      rejectionCount: 0,
      totalFeedback: 0,
    }
  }
}

/**
 * Update finding confidence score in database
 *
 * @param supabase - Supabase client
 * @param findingId - Finding UUID
 * @param newConfidence - New confidence value
 * @returns Success status
 */
export async function updateFindingConfidence(
  supabase: SupabaseClient<Database>,
  findingId: string,
  newConfidence: number
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('findings')
      .update({
        confidence: newConfidence,
        updated_at: new Date().toISOString(),
      })
      .eq('id', findingId)

    if (error) {
      console.error('[validation-feedback] Error updating confidence:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('[validation-feedback] Error updating confidence:', err)
    return false
  }
}

/**
 * Record a validation action for a finding
 * (AC: #2)
 *
 * @param supabase - Supabase client
 * @param findingId - Finding UUID
 * @param analystId - Analyst UUID
 * @param reason - Optional reason for validation
 * @returns Validation result with new confidence
 */
export async function recordValidation(
  supabase: SupabaseClient<Database>,
  findingId: string,
  analystId: string,
  reason?: string
): Promise<ValidationFeedbackResult | null> {
  return recordFeedback(supabase, findingId, analystId, 'validate', reason)
}

/**
 * Record a rejection action for a finding
 * (AC: #3)
 *
 * @param supabase - Supabase client
 * @param findingId - Finding UUID
 * @param analystId - Analyst UUID
 * @param reason - Optional reason for rejection
 * @returns Validation result with new confidence
 */
export async function recordRejection(
  supabase: SupabaseClient<Database>,
  findingId: string,
  analystId: string,
  reason?: string
): Promise<ValidationFeedbackResult | null> {
  return recordFeedback(supabase, findingId, analystId, 'reject', reason)
}

/**
 * Record validation or rejection feedback
 * Core function that handles both actions
 *
 * @param supabase - Supabase client
 * @param findingId - Finding UUID
 * @param analystId - Analyst UUID
 * @param action - 'validate' or 'reject'
 * @param reason - Optional reason
 * @returns Validation result with new confidence
 */
async function recordFeedback(
  supabase: SupabaseClient<Database>,
  findingId: string,
  analystId: string,
  action: ValidationAction,
  reason?: string
): Promise<ValidationFeedbackResult | null> {
  try {
    // 1. Get current finding info
    const { data: finding, error: findingError } = await supabase
      .from('findings')
      .select('id, confidence, document_id, deal_id')
      .eq('id', findingId)
      .single()

    if (findingError || !finding) {
      console.error('[validation-feedback] Finding not found:', findingError)
      return null
    }

    const previousConfidence = finding.confidence ?? 0.5

    // 2. Insert feedback record (append-only)
    // Use type assertion for table not in generated types
    type InsertResult = { data: ValidationFeedbackRow | null; error: unknown }
    const { data: feedback, error: insertError } = await (supabase as unknown as {
      from: (table: string) => {
        insert: (row: ValidationFeedbackInsert) => {
          select: () => { single: () => Promise<InsertResult> }
        }
      }
    })
      .from('validation_feedback')
      .insert({
        finding_id: findingId,
        action,
        reason: reason || null,
        analyst_id: analystId,
      })
      .select()
      .single()

    if (insertError || !feedback) {
      console.error('[validation-feedback] Failed to insert feedback:', insertError)
      return null
    }

    // 3. Check if confidence adjustment is enabled
    const confidenceEnabled = await getFeatureFlag('confidenceAdjustmentEnabled')

    let newConfidence = previousConfidence

    if (confidenceEnabled) {
      // 4. Get updated stats and calculate new confidence
      const stats = await getValidationStatsDirect(supabase, findingId)
      newConfidence = calculateAdjustedConfidence(
        previousConfidence,
        stats.validationCount,
        stats.rejectionCount
      )

      // 5. Update finding confidence
      await updateFindingConfidence(supabase, findingId, newConfidence)
    }

    // 6. Check source rejection rate for flagging (only on rejection)
    let sourceFlagged = false
    let sourceFlaggedReason: string | undefined

    if (action === 'reject' && finding.document_id) {
      const rejectionInfo = await checkSourceRejectionRate(
        supabase,
        finding.document_id,
        finding.deal_id
      )

      if (rejectionInfo?.exceedsThreshold) {
        await flagSourceForReview(supabase, finding.document_id)
        sourceFlagged = true
        sourceFlaggedReason = `Source rejection rate (${(rejectionInfo.rejectionRate * 100).toFixed(0)}%) exceeds threshold`
      }
    }

    return {
      success: true,
      feedbackId: (feedback as { id: string }).id,
      newConfidence,
      previousConfidence,
      sourceFlagged,
      sourceFlaggedReason,
    }
  } catch (err) {
    console.error('[validation-feedback] Error recording feedback:', err)
    return null
  }
}

/**
 * Check the rejection rate for a source document
 * (AC: #6 - Sources with >50% rejection rate are flagged for review)
 *
 * @param supabase - Supabase client
 * @param documentId - Document UUID
 * @param dealId - Deal UUID
 * @returns Source rejection info or null if error
 */
export async function checkSourceRejectionRate(
  supabase: SupabaseClient<Database>,
  documentId: string,
  dealId: string
): Promise<SourceRejectionInfo | null> {
  try {
    // Get document info
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, name')
      .eq('id', documentId)
      .single()

    if (docError || !document) {
      console.error('[validation-feedback] Document not found:', docError)
      return null
    }

    // Get all findings from this document
    const { data: findings, error: findingsError } = await supabase
      .from('findings')
      .select('id')
      .eq('document_id', documentId)
      .eq('deal_id', dealId)

    if (findingsError || !findings || findings.length === 0) {
      return null
    }

    const findingIds = findings.map(f => f.id)

    // Get rejection count for all findings from this document
    // Use type assertion for table not in generated types
    const { data: feedback, error: feedbackError } = await (supabase as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          in: (col: string, vals: string[]) => Promise<{ data: { action: string }[] | null; error: unknown }>
        }
      }
    })
      .from('validation_feedback')
      .select('action')
      .in('finding_id', findingIds)

    if (feedbackError) {
      console.error('[validation-feedback] Error getting feedback:', feedbackError)
      return null
    }

    const feedbackRows = (feedback || []) as { action: string }[]
    const totalFeedback = feedbackRows.length
    const rejectedCount = feedbackRows.filter(f => f.action === 'reject').length

    // Calculate rejection rate (avoid division by zero)
    const rejectionRate = totalFeedback > 0 ? rejectedCount / totalFeedback : 0

    return {
      documentId,
      documentName: document.name,
      totalFindings: findings.length,
      rejectedFindings: rejectedCount,
      rejectionRate,
      exceedsThreshold: rejectionRate > SOURCE_REJECTION_THRESHOLD,
    }
  } catch (err) {
    console.error('[validation-feedback] Error checking rejection rate:', err)
    return null
  }
}

/**
 * Flag a source document for review
 * (AC: #6)
 *
 * @param supabase - Supabase client
 * @param documentId - Document UUID
 * @returns Success status
 */
export async function flagSourceForReview(
  supabase: SupabaseClient<Database>,
  documentId: string
): Promise<boolean> {
  try {
    // Update document to mark it as needing review
    // This uses the reliability_status column from E7.1
    const { error } = await supabase
      .from('documents')
      .update({
        reliability_status: 'contains_errors',
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId)

    if (error) {
      console.error('[validation-feedback] Error flagging source:', error)
      return false
    }

    console.log(`[validation-feedback] Flagged document ${documentId} for review`)
    return true
  } catch (err) {
    console.error('[validation-feedback] Error flagging source:', err)
    return false
  }
}

/**
 * Get validation history for a finding
 */
export async function getValidationHistory(
  supabase: SupabaseClient<Database>,
  findingId: string,
  limit: number = 50
): Promise<ValidationFeedback[]> {
  try {
    // Use type assertion for table not in generated types
    const { data, error } = await (supabase as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            order: (col: string, opts: { ascending: boolean }) => {
              limit: (n: number) => Promise<{ data: ValidationFeedbackRow[] | null; error: unknown }>
            }
          }
        }
      }
    })
      .from('validation_feedback')
      .select('*')
      .eq('finding_id', findingId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[validation-feedback] Error getting history:', error)
      return []
    }

    const rows = (data || []) as ValidationFeedbackRow[]
    return rows.map(row => ({
      id: row.id,
      findingId: row.finding_id,
      action: row.action as ValidationAction,
      reason: row.reason ?? undefined,
      analystId: row.analyst_id,
      createdAt: row.created_at ?? new Date().toISOString(),
    }))
  } catch (err) {
    console.error('[validation-feedback] Error getting history:', err)
    return []
  }
}

/**
 * Get findings needing review for a document (flagged source)
 */
export async function getFindingsNeedingReview(
  supabase: SupabaseClient<Database>,
  documentId: string
): Promise<string[]> {
  try {
    // Get findings with high rejection rates from this document
    const { data: findings, error } = await supabase
      .from('findings')
      .select('id')
      .eq('document_id', documentId)
      .eq('needs_review', true)

    if (error) {
      console.error('[validation-feedback] Error getting findings needing review:', error)
      return []
    }

    return (findings || []).map(f => f.id)
  } catch (err) {
    console.error('[validation-feedback] Error getting findings needing review:', err)
    return []
  }
}

/**
 * Mark a finding as needing review
 */
export async function markFindingForReview(
  supabase: SupabaseClient<Database>,
  findingId: string,
  reason?: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('findings')
      .update({
        needs_review: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', findingId)

    if (error) {
      console.error('[validation-feedback] Error marking finding for review:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('[validation-feedback] Error marking finding for review:', err)
    return false
  }
}

/**
 * Bulk validate findings
 */
export async function bulkValidate(
  supabase: SupabaseClient<Database>,
  findingIds: string[],
  analystId: string
): Promise<{ success: number; failed: number }> {
  let success = 0
  let failed = 0

  for (const findingId of findingIds) {
    const result = await recordValidation(supabase, findingId, analystId)
    if (result?.success) {
      success++
    } else {
      failed++
    }
  }

  return { success, failed }
}

/**
 * Bulk reject findings
 */
export async function bulkReject(
  supabase: SupabaseClient<Database>,
  findingIds: string[],
  analystId: string,
  reason?: string
): Promise<{ success: number; failed: number }> {
  let success = 0
  let failed = 0

  for (const findingId of findingIds) {
    const result = await recordRejection(supabase, findingId, analystId, reason)
    if (result?.success) {
      success++
    } else {
      failed++
    }
  }

  return { success, failed }
}
