/**
 * Correction Propagation Service
 *
 * Handles flagging of dependent insights when a finding is corrected.
 * Story: E7.1 - Implement Finding Correction via Chat
 * Story: E7.6 - Propagate Corrections to Related Insights
 * AC: #5, #6, and E7.6 AC #1-#4
 *
 * Features:
 * - Query Neo4j for BASED_ON, DERIVED_FROM, REFERENCES relationships
 * - Flag dependent insights, Q&A answers, CIM sections for review
 * - Generate impact summary including Q&A and CIM impacts
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase/database.types'
import { DependentInsight, PropagationResult } from '@/lib/types/feedback'
import { executeRead, executeWrite } from '@/lib/neo4j/client'
import {
  NODE_LABELS,
  RELATIONSHIP_TYPES,
  type InsightNode,
  type FindingNode,
  type QAAnswerNode,
  type CIMSectionNode
} from '@/lib/neo4j/types'

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
 * Find Q&A answers that depend on a finding via DERIVED_FROM or REFERENCES relationships
 * Story: E7.6 - Propagate Corrections to Related Insights (AC: #1)
 */
export async function findDependentQAAnswers(
  findingId: string
): Promise<DependentInsight[]> {
  try {
    const result = await executeRead<{
      qa: QAAnswerNode
      relType: string
    }>(
      `MATCH (f:${NODE_LABELS.FINDING} {id: $findingId})<-[r]-(qa:${NODE_LABELS.QA_ANSWER})
       WHERE type(r) IN ['${RELATIONSHIP_TYPES.DERIVED_FROM}', '${RELATIONSHIP_TYPES.REFERENCES}', '${RELATIONSHIP_TYPES.BASED_ON}']
       RETURN qa, type(r) as relType`,
      { findingId }
    )

    return result.map((row) => ({
      id: row.qa.id,
      type: 'qa_answer' as const,
      title: row.qa.question.substring(0, 100) + (row.qa.question.length > 100 ? '...' : ''),
      flaggedForReview: false,
    }))
  } catch (err) {
    console.error('[correction-propagation] Error querying dependent Q&A answers:', err)
    return []
  }
}

/**
 * Find CIM sections that depend on a finding via DERIVED_FROM or REFERENCES relationships
 * Story: E7.6 - Propagate Corrections to Related Insights (AC: #1)
 */
export async function findDependentCIMSections(
  findingId: string
): Promise<DependentInsight[]> {
  try {
    const result = await executeRead<{
      cim: CIMSectionNode
      relType: string
    }>(
      `MATCH (f:${NODE_LABELS.FINDING} {id: $findingId})<-[r]-(cim:${NODE_LABELS.CIM_SECTION})
       WHERE type(r) IN ['${RELATIONSHIP_TYPES.DERIVED_FROM}', '${RELATIONSHIP_TYPES.REFERENCES}', '${RELATIONSHIP_TYPES.BASED_ON}']
       RETURN cim, type(r) as relType`,
      { findingId }
    )

    return result.map((row) => ({
      id: row.cim.id,
      type: 'cim_section' as const,
      title: row.cim.section_title.substring(0, 100) + (row.cim.section_title.length > 100 ? '...' : ''),
      flaggedForReview: false,
    }))
  } catch (err) {
    console.error('[correction-propagation] Error querying dependent CIM sections:', err)
    return []
  }
}

/**
 * Flag Q&A answers and CIM sections in Neo4j for review
 * Story: E7.6 - Propagate Corrections to Related Insights (AC: #2)
 */
export async function flagDependentsInNeo4j(
  items: DependentInsight[],
  reason: string
): Promise<{ success: boolean; flaggedCount: number }> {
  if (items.length === 0) {
    return { success: true, flaggedCount: 0 }
  }

  let flaggedCount = 0

  // Group by type for efficient batch updates
  const qaAnswerIds = items.filter(i => i.type === 'qa_answer').map(i => i.id)
  const cimSectionIds = items.filter(i => i.type === 'cim_section').map(i => i.id)
  const insightIds = items.filter(i => i.type === 'insight').map(i => i.id)

  try {
    // Flag Q&A Answers in Neo4j
    if (qaAnswerIds.length > 0) {
      await executeWrite(
        `MATCH (qa:${NODE_LABELS.QA_ANSWER})
         WHERE qa.id IN $ids
         SET qa.needs_review = true, qa.review_reason = $reason`,
        { ids: qaAnswerIds, reason }
      )
      flaggedCount += qaAnswerIds.length
    }

    // Flag CIM Sections in Neo4j
    if (cimSectionIds.length > 0) {
      await executeWrite(
        `MATCH (cim:${NODE_LABELS.CIM_SECTION})
         WHERE cim.id IN $ids
         SET cim.needs_review = true, cim.review_reason = $reason`,
        { ids: cimSectionIds, reason }
      )
      flaggedCount += cimSectionIds.length
    }

    // Flag Insights in Neo4j
    if (insightIds.length > 0) {
      await executeWrite(
        `MATCH (i:${NODE_LABELS.INSIGHT})
         WHERE i.id IN $ids
         SET i.needs_review = true, i.review_reason = $reason`,
        { ids: insightIds, reason }
      )
      flaggedCount += insightIds.length
    }

    return { success: true, flaggedCount }
  } catch (err) {
    console.error('[correction-propagation] Error flagging dependents in Neo4j:', err)
    return { success: false, flaggedCount }
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
 * Finds all dependent insights, Q&A answers, CIM sections and flags them for review
 * Story: E7.1 AC #5, #6 and E7.6 AC #1-#4
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
    // 1. Find all dependent items from Neo4j (in parallel for performance)
    const [insights, dependentFindings, qaAnswers, cimSections] = await Promise.all([
      findDependentInsights(findingId),
      findDependentFindings(findingId),
      findDependentQAAnswers(findingId),
      findDependentCIMSections(findingId),
    ])

    // Combine all dependencies
    const allDependents = [...insights, ...dependentFindings, ...qaAnswers, ...cimSections]
    result.dependentCount = allDependents.length

    if (allDependents.length === 0) {
      return result
    }

    // 2. Flag dependent findings in Supabase DB
    const findingIds = dependentFindings.map(f => f.id)
    if (findingIds.length > 0) {
      const findingResult = await flagDependentFindingsInDb(supabase, findingIds, reason)
      if (findingResult.success) {
        result.flaggedCount += findingResult.flaggedCount
      } else {
        result.errors?.push('Failed to flag some dependent findings')
      }
    }

    // 3. Flag Q&A answers, CIM sections, and insights in Neo4j (E7.6 AC #2)
    const neo4jItems = [...insights, ...qaAnswers, ...cimSections]
    if (neo4jItems.length > 0) {
      const neo4jResult = await flagDependentsInNeo4j(neo4jItems, reason)
      if (neo4jResult.success) {
        result.flaggedCount += neo4jResult.flaggedCount
      } else {
        result.errors?.push('Failed to flag some Q&A/CIM items in Neo4j')
      }
    }

    // Mark all as flagged in result
    result.dependentInsights = allDependents.map(d => ({
      ...d,
      flaggedForReview: true,
    }))

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
 * Review queue count result including Q&A and CIM items
 * Story: E7.6 - Propagate Corrections to Related Insights (AC: #3)
 */
export interface ReviewQueueCount {
  findings: number
  qaAnswers: number
  cimSections: number
  insights: number
  total: number
}

/**
 * Get count of items needing review for a deal (including Neo4j items)
 * Story: E7.6 - Propagate Corrections to Related Insights (AC: #3)
 */
export async function getReviewQueueCount(
  supabase: SupabaseClient<Database>,
  dealId: string
): Promise<ReviewQueueCount> {
  const result: ReviewQueueCount = {
    findings: 0,
    qaAnswers: 0,
    cimSections: 0,
    insights: 0,
    total: 0,
  }

  try {
    // Count findings from Supabase
    const { count: findingsCount, error } = await supabase
      .from('findings')
      .select('*', { count: 'exact', head: true })
      .eq('deal_id', dealId)
      .eq('needs_review', true)

    if (error) {
      console.error('[correction-propagation] Error counting findings:', error)
    } else {
      result.findings = findingsCount || 0
    }

    // Count Q&A answers, CIM sections, and insights from Neo4j
    try {
      const neo4jCounts = await executeRead<{
        qaCount: number
        cimCount: number
        insightCount: number
      }>(
        `MATCH (d:${NODE_LABELS.DEAL} {id: $dealId})
         OPTIONAL MATCH (qa:${NODE_LABELS.QA_ANSWER} {deal_id: $dealId, needs_review: true})
         OPTIONAL MATCH (cim:${NODE_LABELS.CIM_SECTION} {deal_id: $dealId, needs_review: true})
         OPTIONAL MATCH (i:${NODE_LABELS.INSIGHT} {deal_id: $dealId, needs_review: true})
         RETURN
           count(DISTINCT qa) as qaCount,
           count(DISTINCT cim) as cimCount,
           count(DISTINCT i) as insightCount`,
        { dealId }
      )

      if (neo4jCounts.length > 0 && neo4jCounts[0]) {
        result.qaAnswers = Number(neo4jCounts[0].qaCount ?? 0)
        result.cimSections = Number(neo4jCounts[0].cimCount ?? 0)
        result.insights = Number(neo4jCounts[0].insightCount ?? 0)
      }
    } catch (neo4jErr) {
      console.error('[correction-propagation] Error counting Neo4j items:', neo4jErr)
    }

    result.total = result.findings + result.qaAnswers + result.cimSections + result.insights
    return result
  } catch (err) {
    console.error('[correction-propagation] Error counting review queue:', err)
    return result
  }
}

/**
 * Review queue item for display
 */
export interface ReviewQueueItem {
  id: string
  type: 'finding' | 'qa_answer' | 'cim_section' | 'insight'
  title: string
  reviewReason: string
  createdAt: string
  // Finding-specific fields
  confidence?: number
  domain?: string
  documentId?: string
  documentName?: string
  // Q&A-specific fields
  question?: string
  answer?: string
  // CIM-specific fields
  sectionTitle?: string
  cimId?: string
}

/**
 * Get all items needing review for a deal
 * Story: E7.6 - Propagate Corrections to Related Insights (AC: #3)
 */
export async function getReviewQueueItems(
  supabase: SupabaseClient<Database>,
  dealId: string,
  options?: {
    type?: 'finding' | 'qa_answer' | 'cim_section' | 'insight'
    limit?: number
    offset?: number
  }
): Promise<{ items: ReviewQueueItem[]; total: number }> {
  const items: ReviewQueueItem[] = []
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  try {
    // Get findings from Supabase (if not filtering by other types)
    if (!options?.type || options.type === 'finding') {
      const { data: findings, error } = await supabase
        .from('findings')
        .select(`
          id,
          text,
          confidence,
          domain,
          document_id,
          review_reason,
          created_at,
          documents:document_id (name)
        `)
        .eq('deal_id', dealId)
        .eq('needs_review', true)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (!error && findings) {
        for (const f of findings) {
          items.push({
            id: f.id,
            type: 'finding',
            title: f.text.substring(0, 100) + (f.text.length > 100 ? '...' : ''),
            reviewReason: f.review_reason || 'Flagged for review',
            createdAt: f.created_at,
            confidence: f.confidence ?? undefined,
            domain: f.domain ?? undefined,
            documentId: f.document_id ?? undefined,
            documentName: (f.documents as { name: string } | null)?.name,
          })
        }
      }
    }

    // Get Q&A answers from Neo4j
    if (!options?.type || options.type === 'qa_answer') {
      try {
        const qaResults = await executeRead<{
          qa: QAAnswerNode
        }>(
          `MATCH (qa:${NODE_LABELS.QA_ANSWER} {deal_id: $dealId, needs_review: true})
           RETURN qa
           ORDER BY qa.created_at DESC
           SKIP $offset LIMIT $limit`,
          { dealId, offset, limit }
        )

        for (const row of qaResults) {
          items.push({
            id: row.qa.id,
            type: 'qa_answer',
            title: row.qa.question.substring(0, 100) + (row.qa.question.length > 100 ? '...' : ''),
            reviewReason: row.qa.review_reason || 'Flagged for review',
            createdAt: row.qa.created_at,
            question: row.qa.question,
            answer: row.qa.answer,
          })
        }
      } catch (err) {
        console.error('[correction-propagation] Error fetching Q&A items:', err)
      }
    }

    // Get CIM sections from Neo4j
    if (!options?.type || options.type === 'cim_section') {
      try {
        const cimResults = await executeRead<{
          cim: CIMSectionNode
        }>(
          `MATCH (cim:${NODE_LABELS.CIM_SECTION} {deal_id: $dealId, needs_review: true})
           RETURN cim
           ORDER BY cim.created_at DESC
           SKIP $offset LIMIT $limit`,
          { dealId, offset, limit }
        )

        for (const row of cimResults) {
          items.push({
            id: row.cim.id,
            type: 'cim_section',
            title: row.cim.section_title,
            reviewReason: row.cim.review_reason || 'Flagged for review',
            createdAt: row.cim.created_at,
            sectionTitle: row.cim.section_title,
            cimId: row.cim.cim_id,
          })
        }
      } catch (err) {
        console.error('[correction-propagation] Error fetching CIM items:', err)
      }
    }

    // Get insights from Neo4j
    if (!options?.type || options.type === 'insight') {
      try {
        const insightResults = await executeRead<{
          i: InsightNode
        }>(
          `MATCH (i:${NODE_LABELS.INSIGHT} {deal_id: $dealId, needs_review: true})
           RETURN i
           ORDER BY i.created_at DESC
           SKIP $offset LIMIT $limit`,
          { dealId, offset, limit }
        )

        for (const row of insightResults) {
          items.push({
            id: row.i.id,
            type: 'insight',
            title: row.i.text.substring(0, 100) + (row.i.text.length > 100 ? '...' : ''),
            reviewReason: row.i.review_reason || 'Flagged for review',
            createdAt: row.i.created_at,
          })
        }
      } catch (err) {
        console.error('[correction-propagation] Error fetching insight items:', err)
      }
    }

    // Sort combined results by createdAt
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Get total count
    const counts = await getReviewQueueCount(supabase, dealId)

    return { items, total: counts.total }
  } catch (err) {
    console.error('[correction-propagation] Error getting review queue items:', err)
    return { items: [], total: 0 }
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

/**
 * Clear needs_review flag for any item type
 * Story: E7.6 - Propagate Corrections to Related Insights (AC: #4)
 */
export async function clearReviewFlagForItem(
  supabase: SupabaseClient<Database>,
  itemId: string,
  itemType: 'finding' | 'qa_answer' | 'cim_section' | 'insight'
): Promise<boolean> {
  try {
    if (itemType === 'finding') {
      return clearReviewFlag(supabase, itemId)
    }

    // Clear in Neo4j for other types
    const nodeLabel = itemType === 'qa_answer' ? NODE_LABELS.QA_ANSWER
      : itemType === 'cim_section' ? NODE_LABELS.CIM_SECTION
      : NODE_LABELS.INSIGHT

    await executeWrite(
      `MATCH (n:${nodeLabel} {id: $itemId})
       SET n.needs_review = false, n.review_reason = null`,
      { itemId }
    )

    return true
  } catch (err) {
    console.error('[correction-propagation] Error clearing review flag:', err)
    return false
  }
}

/**
 * Dismiss (clear review flag) for a review queue item and optionally mark as reviewed
 * Story: E7.6 - Propagate Corrections to Related Insights (AC: #4)
 */
export async function dismissReviewItem(
  supabase: SupabaseClient<Database>,
  item: ReviewQueueItem,
  _dismissReason?: string
): Promise<boolean> {
  return clearReviewFlagForItem(supabase, item.id, item.type)
}
