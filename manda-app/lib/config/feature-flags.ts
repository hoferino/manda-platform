/**
 * Feature Flags Configuration
 *
 * Runtime feature flags for safe rollout of Learning Loop operations.
 * Story: E7.1 - Implement Finding Correction via Chat
 *
 * Flags are read from environment variables with database fallback.
 * High-risk operations (source error cascade) are OFF by default.
 */

import { createClient } from '@/lib/supabase/server'

/**
 * Learning Loop feature flags with environment variable defaults
 *
 * Flag defaults follow risk-based approach:
 * - Low risk (sourceValidationEnabled): default ON
 * - Medium risk (autoReembedCorrections, neo4jSyncEnabled): default ON
 * - High risk (sourceErrorCascadeEnabled, autoFlagDocumentFindings): default OFF
 */
export const LEARNING_FLAGS = {
  /** Show source citation before accepting corrections (low risk) */
  sourceValidationEnabled:
    process.env.LEARNING_SOURCE_VALIDATION_ENABLED !== 'false',

  /** Enable full cascade when source document has errors (HIGH risk - OFF by default) */
  sourceErrorCascadeEnabled:
    process.env.LEARNING_SOURCE_ERROR_CASCADE_ENABLED === 'true',

  /** Auto-flag all findings from error document (HIGH risk - OFF by default) */
  autoFlagDocumentFindings:
    process.env.LEARNING_AUTO_FLAG_DOCUMENT_FINDINGS === 'true',

  /** Regenerate embeddings for corrected findings (medium risk) */
  autoReembedCorrections:
    process.env.LEARNING_AUTO_REEMBED_CORRECTIONS !== 'false',

  /** Sync corrections to Neo4j knowledge graph (medium risk) */
  neo4jSyncEnabled:
    process.env.LEARNING_NEO4J_SYNC_ENABLED !== 'false',

  /** Adjust confidence scores on validation/rejection (low risk) */
  confidenceAdjustmentEnabled:
    process.env.LEARNING_CONFIDENCE_ADJUSTMENT_ENABLED !== 'false',

  /** Detect edit patterns from response edits (low risk) */
  patternDetectionEnabled:
    process.env.LEARNING_PATTERN_DETECTION_ENABLED !== 'false',
} as const

export type FeatureFlagName = keyof typeof LEARNING_FLAGS

/**
 * Get feature flag value with database override support
 *
 * Priority:
 * 1. Database override (if exists)
 * 2. Environment variable
 *
 * @param flag - Feature flag name
 * @returns Promise<boolean> - Whether the feature is enabled
 */
export async function getFeatureFlag(flag: FeatureFlagName): Promise<boolean> {
  try {
    const supabase = await createClient()

    // Check database override first
    const { data: dbOverride, error } = await supabase
      .from('feature_flags')
      .select('enabled')
      .eq('flag_name', flag)
      .single()

    if (!error && dbOverride) {
      return dbOverride.enabled
    }

    // Fall back to environment variable default
    return LEARNING_FLAGS[flag]
  } catch (err) {
    console.error(`[feature-flags] Error checking flag ${flag}:`, err)
    // On error, fall back to environment variable default
    return LEARNING_FLAGS[flag]
  }
}

/**
 * Get all feature flag values (environment defaults only, for sync access)
 * Use this for non-async contexts where database lookup isn't needed
 */
export function getFeatureFlagsSync(): typeof LEARNING_FLAGS {
  return { ...LEARNING_FLAGS }
}

/**
 * Get all feature flags with database overrides
 * Useful for admin dashboards or debugging
 */
export async function getAllFeatureFlags(): Promise<Record<FeatureFlagName, boolean>> {
  const result = { ...LEARNING_FLAGS }

  try {
    const supabase = await createClient()

    const { data: dbFlags, error } = await supabase
      .from('feature_flags')
      .select('flag_name, enabled')

    if (!error && dbFlags) {
      for (const row of dbFlags) {
        if (row.flag_name in result) {
          result[row.flag_name as FeatureFlagName] = row.enabled
        }
      }
    }
  } catch (err) {
    console.error('[feature-flags] Error fetching all flags:', err)
  }

  return result
}

/**
 * Update a feature flag value in the database
 * Creates an audit log entry via database trigger
 *
 * @param flag - Feature flag name
 * @param enabled - New value
 * @returns Promise<boolean> - Success status
 */
export async function updateFeatureFlag(
  flag: FeatureFlagName,
  enabled: boolean
): Promise<boolean> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('feature_flags')
      .update({ enabled })
      .eq('flag_name', flag)

    if (error) {
      console.error(`[feature-flags] Error updating flag ${flag}:`, error)
      return false
    }

    return true
  } catch (err) {
    console.error(`[feature-flags] Error updating flag ${flag}:`, err)
    return false
  }
}

/**
 * Check if source error cascade operations are allowed
 * Convenience function combining multiple flag checks
 */
export async function isSourceErrorCascadeAllowed(): Promise<boolean> {
  const cascadeEnabled = await getFeatureFlag('sourceErrorCascadeEnabled')
  return cascadeEnabled
}

/**
 * Check if auto-flagging of document findings is allowed
 * Requires both cascade and auto-flag to be enabled
 */
export async function isAutoFlagDocumentFindingsAllowed(): Promise<boolean> {
  const [cascadeEnabled, autoFlagEnabled] = await Promise.all([
    getFeatureFlag('sourceErrorCascadeEnabled'),
    getFeatureFlag('autoFlagDocumentFindings'),
  ])
  return cascadeEnabled && autoFlagEnabled
}
