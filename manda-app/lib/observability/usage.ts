/**
 * Usage logging service for LLM and feature tracking.
 * Story: E12.2 - Usage Logging Integration (AC: #2, #4, #5)
 *
 * This module provides functions to persist usage data to Supabase,
 * enabling cost visibility and performance analysis in E12.3 dashboard.
 */

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

type LlmUsageInsert = Database['public']['Tables']['llm_usage']['Insert']
type FeatureUsageInsert = Database['public']['Tables']['feature_usage']['Insert']

/**
 * Log LLM usage to database.
 *
 * @param params - LLM usage parameters
 * @returns Created record ID, or null if insert failed
 *
 * @example
 * ```typescript
 * const startTime = Date.now()
 * const result = await llm.invoke(messages)
 * await logLLMUsage({
 *   dealId: state.dealId,
 *   userId: state.userId,
 *   organizationId: state.organizationId,
 *   provider: 'anthropic',
 *   model: 'claude-sonnet-4-0',
 *   feature: 'chat',
 *   inputTokens: result.usage.input_tokens,
 *   outputTokens: result.usage.output_tokens,
 *   costUsd: calculateCost(result.usage),
 *   latencyMs: Date.now() - startTime,
 * })
 * ```
 */
export async function logLLMUsage(params: {
  organizationId?: string
  dealId?: string
  userId?: string
  provider: string
  model: string
  feature: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  latencyMs?: number
}): Promise<string | null> {
  try {
    const supabase = await createClient()

    const insertData: LlmUsageInsert = {
      provider: params.provider,
      model: params.model,
      feature: params.feature,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      cost_usd: params.costUsd,
    }

    // Add optional fields
    if (params.organizationId) {
      insertData.organization_id = params.organizationId
    }
    if (params.dealId) {
      insertData.deal_id = params.dealId
    }
    if (params.userId) {
      insertData.user_id = params.userId
    }
    if (params.latencyMs !== undefined) {
      insertData.latency_ms = params.latencyMs
    }

    const { data, error } = await supabase
      .from('llm_usage')
      .insert(insertData)
      .select('id')
      .single()

    if (error) {
      console.error('[logLLMUsage] Insert failed:', error.message)
      return null
    }

    return data?.id ?? null
  } catch (error) {
    console.error('[logLLMUsage] Error:', error)
    return null
  }
}

/**
 * Log feature usage to database.
 *
 * @param params - Feature usage parameters
 * @returns Created record ID, or null if insert failed
 *
 * @example
 * ```typescript
 * const startTime = Date.now()
 * try {
 *   await processDocument(doc)
 *   await logFeatureUsage({
 *     dealId: doc.dealId,
 *     userId: uploaderId,
 *     organizationId: orgId,
 *     featureName: 'document_upload',
 *     status: 'success',
 *     durationMs: Date.now() - startTime,
 *     metadata: { documentCount: 1, totalBytes: doc.size },
 *   })
 * } catch (err) {
 *   await logFeatureUsage({
 *     dealId: doc.dealId,
 *     featureName: 'document_upload',
 *     status: 'error',
 *     durationMs: Date.now() - startTime,
 *     errorMessage: err.message,
 *     metadata: { stack: err.stack },
 *   })
 * }
 * ```
 */
export async function logFeatureUsage(params: {
  organizationId?: string
  dealId?: string
  userId?: string
  featureName: string
  status: 'success' | 'error' | 'timeout'
  durationMs?: number
  errorMessage?: string
  metadata?: Record<string, unknown>
}): Promise<string | null> {
  try {
    const supabase = await createClient()

    const insertData: FeatureUsageInsert = {
      feature_name: params.featureName,
      status: params.status,
    }

    // Add optional fields
    if (params.organizationId) {
      insertData.organization_id = params.organizationId
    }
    if (params.dealId) {
      insertData.deal_id = params.dealId
    }
    if (params.userId) {
      insertData.user_id = params.userId
    }
    if (params.durationMs !== undefined) {
      insertData.duration_ms = params.durationMs
    }
    if (params.errorMessage) {
      insertData.error_message = params.errorMessage
    }
    if (params.metadata) {
      insertData.metadata = params.metadata as Database['public']['Tables']['feature_usage']['Insert']['metadata']
    }

    const { data, error } = await supabase
      .from('feature_usage')
      .insert(insertData)
      .select('id')
      .single()

    if (error) {
      console.error('[logFeatureUsage] Insert failed:', error.message)
      return null
    }

    return data?.id ?? null
  } catch (error) {
    console.error('[logFeatureUsage] Error:', error)
    return null
  }
}

/**
 * Helper to calculate LLM cost from token counts.
 *
 * Pricing (per 1M tokens):
 * - Gemini 2.5 Flash: $0.075 input, $0.30 output
 * - Claude Sonnet 4: $3.00 input, $15.00 output
 * - Voyage 3.5: $0.06 input, $0 output (embeddings)
 */
export function calculateLLMCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  // Pricing per 1M tokens
  const pricing: Record<string, { input: number; output: number }> = {
    'gemini-2.5-flash': { input: 0.075, output: 0.30 },
    'gemini-2.5-pro': { input: 1.25, output: 5.00 },
    'claude-sonnet-4-0': { input: 3.00, output: 15.00 },
    'claude-opus-4-5': { input: 15.00, output: 75.00 },
    'voyage-3.5': { input: 0.06, output: 0 },
    'rerank-2.5': { input: 0.05, output: 0 },
  }

  const rates = pricing[model] ?? { input: 0, output: 0 }
  return (
    (inputTokens * rates.input) / 1_000_000 +
    (outputTokens * rates.output) / 1_000_000
  )
}
