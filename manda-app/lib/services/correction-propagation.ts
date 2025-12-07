/**
 * Correction Propagation Service
 *
 * Handles flagging of dependent insights when a finding is corrected.
 * Story: E7.1 - Implement Finding Correction via Chat
 * AC: #5, #6
 *
 * Features:
 * - Query Neo4j for BASED_ON relationships
 * - Flag dependent insights for review
 * - Generate impact summary
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase/database.types'
import { DependentInsight, PropagationResult } from '@/lib/types/feedback'
import { executeRead } from '@/lib/neo4j/client'
import { NODE_LABELS, RELATIONSHIP_TYPES, type InsightNode, type FindingNode } from '@/lib/neo4j/types'

/**
 * Find all insights that depend on a finding via BASED_ON relationship
 * Uses Neo4j graph traversal
 */
export async function findDependentInsights(
  findingId: string
): Promise<DependentInsight[]> {
  try {
    // Query Neo4j for insights that are BASED_ON this finding
    const result = await executeRead<{
      i: InsightNode
    }>(
      `MATCH (f:${NODE_LABELS.FINDING} {id: $findingId})<-[:${RELATIONSHIP_TYPES.BASED_ON}]-(i:${NODE_LABELS.INSIGHT})
       RETURN i`,
      { findingId }
    )

    return result.map((row) => ({
      id: row.i.id,
      type: mapInsightType(row.i.insight_type),
      title: row.i.text.substring(0, 100) + (row.i.text.length > 100 ? '...' : ''),
      flaggedForReview: false,
    }))
  } catch (err) {
    console.error('[correction-propagation] Error querying Neo4j:', err)
    return []
  }
}

/**
 * Find findings that depend on another finding (BASED_ON or SUPPORTS)
 */
export async function findDependentFindings(
  findingId: string
): Promise<DependentInsight[]> {
  try {
    const result = await executeRead<{
      f: FindingNode
      relType: string
    }>(
      `MATCH (source:${NODE_LABELS.FINDING} {id: $findingId})<-[r]-(f:${NODE_LABELS.FINDING})
       WHERE type(r) IN ['${RELATIONSHIP_TYPES.BASED_ON}', '${RELATIONSHIP_TYPES.SUPPORTS}']
       RETURN f, type(r) as relType`,
      { findingId }
    )

    return result.map((row) => ({
      id: row.f.id,
      type: 'finding' as const,
      title: row.f.text.substring(0, 100) + (row.f.text.length > 100 ? '...' : ''),
      flaggedForReview: false,
    }))
  } catch (err) {
    console.error('[correction-propagation] Error querying dependent findings:', err)
    return []
  }
}

/**
 * Map insight_type to DependentInsight type
 */
function mapInsightType(insightType: string): DependentInsight['type'] {
  switch (insightType) {
    case 'pattern':
    case 'contradiction':
    case 'gap':
    case 'trend':
      return 'insight'
    default:
      return 'insight'
  }
}

/**
 * Flag dependent findings for review in Supabase
 */
export async function flagDependentFindingsInDb(
  supabase: SupabaseClient<Database>,
  findingIds: string[],
  reason: string
): Promise<{ success: boolean; flaggedCount: number }> {
  if (findingIds.length === 0) {
    return { success: true, flaggedCount: 0 }
  }

  try {
    const { error } = await supabase
      .from('findings')
      .update({
        needs_review: true,
        review_reason: reason,
      })
      .in('id', findingIds)

    if (error) {
      console.error('[correction-propagation] Error flagging findings:', error)
      return { success: false, flaggedCount: 0 }
    }

    return { success: true, flaggedCount: findingIds.length }
  } catch (err) {
    console.error('[correction-propagation] Error flagging findings:', err)
    return { success: false, flaggedCount: 0 }
  }
}

/**
 * Main propagation function
 * Finds all dependent insights and flags them for review (AC: #5, #6)
 */
export async function propagateCorrection(
  supabase: SupabaseClient<Database>,
  findingId: string,
  reason: string
): Promise<PropagationResult> {
  const result: PropagationResult = {
    success: true,
    dependentCount: 0,
    flaggedCount: 0,
    dependentInsights: [],
    errors: [],
  }

  try {
    // 1. Find dependent insights from Neo4j
    const insights = await findDependentInsights(findingId)

    // 2. Find dependent findings from Neo4j
    const dependentFindings = await findDependentFindings(findingId)

    // Combine all dependencies
    const allDependents = [...insights, ...dependentFindings]
    result.dependentCount = allDependents.length

    if (allDependents.length === 0) {
      return result
    }

    // 3. Flag dependent findings in DB
    const findingIds = dependentFindings.map(f => f.id)
    if (findingIds.length > 0) {
      const findingResult = await flagDependentFindingsInDb(supabase, findingIds, reason)
      if (findingResult.success) {
        result.flaggedCount += findingResult.flaggedCount
      } else {
        result.errors?.push('Failed to flag some dependent findings')
      }
    }

    // Mark all as flagged in result
    result.dependentInsights = allDependents.map(d => ({
      ...d,
      flaggedForReview: true,
    }))
    result.flaggedCount = result.dependentInsights.length

    return result
  } catch (err) {
    console.error('[correction-propagation] Error propagating correction:', err)
    return {
      ...result,
      success: false,
      errors: ['Internal error during propagation'],
    }
  }
}

/**
 * Generate human-readable impact summary for agent response (AC: #6)
 */
export function generateImpactSummary(propagationResult: PropagationResult): string {
  if (propagationResult.dependentCount === 0) {
    return 'No dependent items require review.'
  }

  const parts: string[] = []
  const byType = propagationResult.dependentInsights.reduce((acc, item) => {
    if (!acc[item.type]) {
      acc[item.type] = []
    }
    acc[item.type]!.push(item)
    return acc
  }, {} as Record<string, DependentInsight[]>)

  for (const [type, items] of Object.entries(byType)) {
    const typeLabel = type === 'qa_answer' ? 'Q&A answers'
      : type === 'cim_section' ? 'CIM sections'
      : type === 'insight' ? 'insights'
      : type === 'finding' ? 'related findings'
      : 'items'

    parts.push(`${items.length} ${typeLabel}`)
  }

  const summary = parts.join(', ')
  return `This correction affects ${summary} which are now flagged for review.`
}

/**
 * Get count of items needing review for a deal
 */
export async function getReviewQueueCount(
  supabase: SupabaseClient<Database>,
  dealId: string
): Promise<{ findings: number; total: number }> {
  try {
    const { count: findingsCount, error } = await supabase
      .from('findings')
      .select('*', { count: 'exact', head: true })
      .eq('deal_id', dealId)
      .eq('needs_review', true)

    if (error) {
      console.error('[correction-propagation] Error counting review queue:', error)
      return { findings: 0, total: 0 }
    }

    return {
      findings: findingsCount || 0,
      total: findingsCount || 0,
    }
  } catch (err) {
    console.error('[correction-propagation] Error counting review queue:', err)
    return { findings: 0, total: 0 }
  }
}

/**
 * Clear needs_review flag for a finding (after review is complete)
 */
export async function clearReviewFlag(
  supabase: SupabaseClient<Database>,
  findingId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('findings')
      .update({
        needs_review: false,
        review_reason: null,
      })
      .eq('id', findingId)

    return !error
  } catch (err) {
    console.error('[correction-propagation] Error clearing review flag:', err)
    return false
  }
}
