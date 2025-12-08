/**
 * Confidence Thresholds Service
 *
 * Manages per-domain confidence thresholds with history tracking.
 * Supports automatic adjustment based on feedback analysis.
 *
 * Story: E7.4 - Build Feedback Incorporation System
 *
 * Features:
 * - Get/set domain thresholds with audit trail
 * - Apply threshold adjustments (manual or automatic)
 * - Get threshold history for compliance
 * - Bulk threshold operations
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase/database.types'
import {
  ConfidenceThresholdRecord,
  ConfidenceThresholdAdjustment,
  mapDbToConfidenceThresholdRecord,
} from '@/lib/types/feedback'
import { getFeatureFlag } from '@/lib/config/feature-flags'

// Default thresholds by domain - typed as const for TypeScript
const DEFAULT_THRESHOLD_VALUES = {
  financial: 0.70,
  legal: 0.70,
  operational: 0.60,
  market: 0.55,
  technical: 0.60,
  general: 0.50,
} as const

// Export for external use
export const DEFAULT_THRESHOLDS: Record<string, number> = DEFAULT_THRESHOLD_VALUES

// Minimum/maximum bounds for thresholds
const MIN_THRESHOLD = 0.30
const MAX_THRESHOLD = 0.95

/**
 * Get the default threshold for a domain
 */
function getDefaultThreshold(domain: string): number {
  const d = domain.toLowerCase()
  if (d === 'financial') return DEFAULT_THRESHOLD_VALUES.financial
  if (d === 'legal') return DEFAULT_THRESHOLD_VALUES.legal
  if (d === 'operational') return DEFAULT_THRESHOLD_VALUES.operational
  if (d === 'market') return DEFAULT_THRESHOLD_VALUES.market
  if (d === 'technical') return DEFAULT_THRESHOLD_VALUES.technical
  return DEFAULT_THRESHOLD_VALUES.general
}

// Minimum sample size required for auto-adjustment
const MIN_SAMPLE_SIZE_FOR_AUTO = 20

// Minimum statistical confidence for auto-adjustment
const MIN_STATISTICAL_CONFIDENCE = 0.60

/**
 * Get the current threshold for a domain
 * Returns deal-specific threshold if exists, otherwise default
 */
export async function getThreshold(
  supabase: SupabaseClient<Database>,
  dealId: string,
  domain: string
): Promise<number> {
  const normalizedDomain = domain.toLowerCase()

  const { data, error } = await (supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => {
            single: () => Promise<{ data: { threshold: number } | null; error: { code?: string } | null }>
          }
        }
      }
    }
  })
    .from('confidence_thresholds')
    .select('threshold')
    .eq('deal_id', dealId)
    .eq('domain', normalizedDomain)
    .single()

  if (!error && data) {
    return data.threshold
  }

  // Return default - use explicit lookup
  if (normalizedDomain === 'financial') return DEFAULT_THRESHOLD_VALUES.financial
  if (normalizedDomain === 'legal') return DEFAULT_THRESHOLD_VALUES.legal
  if (normalizedDomain === 'operational') return DEFAULT_THRESHOLD_VALUES.operational
  if (normalizedDomain === 'market') return DEFAULT_THRESHOLD_VALUES.market
  if (normalizedDomain === 'technical') return DEFAULT_THRESHOLD_VALUES.technical
  return DEFAULT_THRESHOLD_VALUES.general
}

/**
 * Get all thresholds for a deal
 */
export async function getAllThresholds(
  supabase: SupabaseClient<Database>,
  dealId: string
): Promise<ConfidenceThresholdRecord[]> {
  const { data, error } = await (supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          order: (col: string, opts: { ascending: boolean }) => Promise<{
            data: Array<{
              id: string
              deal_id: string
              domain: string
              threshold: number
              previous_threshold: number | null
              reason: string
              applied_at: string | null
              applied_by: string
              auto_applied: boolean | null
            }> | null
            error: unknown
          }>
        }
      }
    }
  })
    .from('confidence_thresholds')
    .select('*')
    .eq('deal_id', dealId)
    .order('domain', { ascending: true })

  if (error || !data) {
    return []
  }

  return data.map(mapDbToConfidenceThresholdRecord)
}

/**
 * Set threshold for a domain
 * Creates if doesn't exist, updates if exists
 */
export async function setThreshold(
  supabase: SupabaseClient<Database>,
  dealId: string,
  domain: string,
  threshold: number,
  reason: string,
  appliedBy: string,
  autoApplied: boolean = false,
  analysisId?: string
): Promise<ConfidenceThresholdRecord | null> {
  const normalizedDomain = domain.toLowerCase()
  const clampedThreshold = Math.max(MIN_THRESHOLD, Math.min(MAX_THRESHOLD, threshold))

  // Get current threshold for history
  const currentThreshold = await getThreshold(supabase, dealId, normalizedDomain)

  // Upsert threshold
  const { data, error } = await (supabase as unknown as {
    from: (table: string) => {
      upsert: (row: unknown, opts: { onConflict: string }) => {
        select: () => {
          single: () => Promise<{
            data: {
              id: string
              deal_id: string
              domain: string
              threshold: number
              previous_threshold: number | null
              reason: string
              applied_at: string | null
              applied_by: string
              auto_applied: boolean | null
            } | null
            error: unknown
          }>
        }
      }
    }
  })
    .from('confidence_thresholds')
    .upsert({
      deal_id: dealId,
      domain: normalizedDomain,
      threshold: clampedThreshold,
      previous_threshold: currentThreshold,
      reason,
      applied_by: appliedBy,
      auto_applied: autoApplied,
      analysis_id: analysisId,
      applied_at: new Date().toISOString(),
    }, { onConflict: 'deal_id,domain' })
    .select()
    .single()

  if (error || !data) {
    console.error('[confidence-thresholds] Failed to set threshold:', error)
    return null
  }

  // Record in history table
  await recordThresholdChange(
    supabase,
    data.id,
    dealId,
    normalizedDomain,
    currentThreshold,
    clampedThreshold,
    reason,
    appliedBy,
    autoApplied
  )

  return mapDbToConfidenceThresholdRecord(data)
}

/**
 * Record threshold change in history table (append-only audit)
 */
async function recordThresholdChange(
  supabase: SupabaseClient<Database>,
  thresholdId: string,
  dealId: string,
  domain: string,
  oldThreshold: number,
  newThreshold: number,
  reason: string,
  changedBy: string,
  autoChanged: boolean
): Promise<void> {
  const { error } = await (supabase as unknown as {
    from: (table: string) => {
      insert: (row: unknown) => Promise<{ error: unknown }>
    }
  })
    .from('confidence_threshold_history')
    .insert({
      threshold_id: thresholdId,
      deal_id: dealId,
      domain,
      old_threshold: oldThreshold,
      new_threshold: newThreshold,
      reason,
      changed_by: changedBy,
      auto_changed: autoChanged,
    })

  if (error) {
    console.error('[confidence-thresholds] Failed to record history:', error)
  }
}

/**
 * Apply threshold adjustments from analysis
 * Only applies if auto-adjustment is enabled and criteria are met
 */
export async function applyThresholdAdjustments(
  supabase: SupabaseClient<Database>,
  dealId: string,
  adjustments: ConfidenceThresholdAdjustment[],
  analysisId?: string
): Promise<{
  applied: string[]
  skipped: { domain: string; reason: string }[]
}> {
  const applied: string[] = []
  const skipped: { domain: string; reason: string }[] = []

  // Check if auto-adjustment is enabled
  const autoAdjustEnabled = await getFeatureFlag('autoThresholdAdjustmentEnabled')
  if (!autoAdjustEnabled) {
    return {
      applied: [],
      skipped: adjustments.map(a => ({
        domain: a.domain,
        reason: 'Auto-adjustment is disabled',
      })),
    }
  }

  for (const adjustment of adjustments) {
    // Validate sample size
    if (adjustment.basedOnSampleSize < MIN_SAMPLE_SIZE_FOR_AUTO) {
      skipped.push({
        domain: adjustment.domain,
        reason: `Sample size (${adjustment.basedOnSampleSize}) below minimum (${MIN_SAMPLE_SIZE_FOR_AUTO})`,
      })
      continue
    }

    // Validate statistical confidence
    if (adjustment.statisticalConfidence < MIN_STATISTICAL_CONFIDENCE) {
      skipped.push({
        domain: adjustment.domain,
        reason: `Statistical confidence (${(adjustment.statisticalConfidence * 100).toFixed(0)}%) below minimum (${MIN_STATISTICAL_CONFIDENCE * 100}%)`,
      })
      continue
    }

    // Apply the adjustment
    const result = await setThreshold(
      supabase,
      dealId,
      adjustment.domain,
      adjustment.recommendedThreshold,
      adjustment.reason,
      'system', // Auto-applied by system
      true, // autoApplied = true
      analysisId
    )

    if (result) {
      applied.push(adjustment.domain)
    } else {
      skipped.push({
        domain: adjustment.domain,
        reason: 'Database error',
      })
    }
  }

  return { applied, skipped }
}

/**
 * Get threshold history for a deal (for audit/compliance)
 */
export async function getThresholdHistory(
  supabase: SupabaseClient<Database>,
  dealId: string,
  options?: {
    domain?: string
    startDate?: string
    endDate?: string
    limit?: number
  }
): Promise<Array<{
  id: string
  domain: string
  oldThreshold: number | null
  newThreshold: number
  reason: string
  changedBy: string
  autoChanged: boolean
  changedAt: string
}>> {
  let query = (supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => unknown
        gte: (col: string, val: string) => unknown
        lte: (col: string, val: string) => unknown
        order: (col: string, opts: { ascending: boolean }) => unknown
        limit: (n: number) => Promise<{
          data: Array<{
            id: string
            domain: string
            old_threshold: number | null
            new_threshold: number
            reason: string
            changed_by: string
            auto_changed: boolean | null
            changed_at: string | null
          }> | null
          error: unknown
        }>
      }
    }
  })
    .from('confidence_threshold_history')
    .select('*')
    .eq('deal_id', dealId) as unknown as {
      eq?: (col: string, val: string) => unknown
      gte?: (col: string, val: string) => unknown
      lte?: (col: string, val: string) => unknown
      order: (col: string, opts: { ascending: boolean }) => {
        limit: (n: number) => Promise<{
          data: Array<{
            id: string
            domain: string
            old_threshold: number | null
            new_threshold: number
            reason: string
            changed_by: string
            auto_changed: boolean | null
            changed_at: string | null
          }> | null
          error: unknown
        }>
      }
    }

  if (options?.domain) {
    query = (query as { eq: (col: string, val: string) => unknown }).eq('domain', options.domain.toLowerCase()) as typeof query
  }
  if (options?.startDate) {
    query = (query as { gte: (col: string, val: string) => unknown }).gte('changed_at', options.startDate) as typeof query
  }
  if (options?.endDate) {
    query = (query as { lte: (col: string, val: string) => unknown }).lte('changed_at', options.endDate) as typeof query
  }

  const { data, error } = await query
    .order('changed_at', { ascending: false })
    .limit(options?.limit ?? 50)

  if (error || !data) {
    return []
  }

  return data.map(row => ({
    id: row.id,
    domain: row.domain,
    oldThreshold: row.old_threshold,
    newThreshold: row.new_threshold,
    reason: row.reason,
    changedBy: row.changed_by,
    autoChanged: row.auto_changed ?? false,
    changedAt: row.changed_at ?? new Date().toISOString(),
  }))
}

/**
 * Reset threshold to default for a domain
 */
export async function resetThreshold(
  supabase: SupabaseClient<Database>,
  dealId: string,
  domain: string,
  userId: string
): Promise<ConfidenceThresholdRecord | null> {
  const defaultThreshold = getDefaultThreshold(domain)

  return setThreshold(
    supabase,
    dealId,
    domain,
    defaultThreshold,
    'Reset to default threshold',
    userId,
    false
  )
}

/**
 * Bulk reset all thresholds for a deal
 */
export async function resetAllThresholds(
  supabase: SupabaseClient<Database>,
  dealId: string,
  userId: string
): Promise<number> {
  const currentThresholds = await getAllThresholds(supabase, dealId)
  let resetCount = 0

  for (const threshold of currentThresholds) {
    const result = await resetThreshold(supabase, dealId, threshold.domain, userId)
    if (result) {
      resetCount++
    }
  }

  return resetCount
}

/**
 * Check if a finding meets the threshold for its domain
 */
export async function meetsThreshold(
  supabase: SupabaseClient<Database>,
  dealId: string,
  domain: string,
  confidence: number
): Promise<boolean> {
  const threshold = await getThreshold(supabase, dealId, domain)
  return confidence >= threshold
}

/**
 * Get findings that don't meet threshold (for review)
 */
export async function getFindingsBelowThreshold(
  supabase: SupabaseClient<Database>,
  dealId: string
): Promise<Array<{ id: string; domain: string; confidence: number; threshold: number }>> {
  // Get all findings for deal
  const { data: findings, error } = await supabase
    .from('findings')
    .select('id, domain, confidence')
    .eq('deal_id', dealId)

  if (error || !findings) {
    return []
  }

  const thresholds = await getAllThresholds(supabase, dealId)
  const thresholdMap = new Map(thresholds.map(t => [t.domain, t.threshold]))

  const results: Array<{ id: string; domain: string; confidence: number; threshold: number }> = []

  for (const finding of findings) {
    const domainLower = (finding.domain || 'general').toLowerCase()
    const customThreshold = thresholdMap.get(domainLower)
    const defaultThreshold = getDefaultThreshold(domainLower)
    const threshold = customThreshold ?? defaultThreshold
    const confidence = finding.confidence ?? 0.5

    if (confidence < threshold) {
      results.push({
        id: finding.id,
        domain: domainLower,
        confidence,
        threshold,
      })
    }
  }

  return results
}