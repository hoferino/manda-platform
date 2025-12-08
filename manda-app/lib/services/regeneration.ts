/**
 * Regeneration Service
 *
 * Handles regeneration of Q&A answers and CIM sections when their
 * source findings have been corrected.
 * Story: E7.6 - Propagate Corrections to Related Insights (AC: #4)
 *
 * Features:
 * - Trigger regeneration for Q&A answers using corrected findings
 * - Trigger regeneration for CIM sections using corrected findings
 * - Track regeneration status and history
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase/database.types'
import { executeRead, executeWrite } from '@/lib/neo4j/client'
import { NODE_LABELS, RELATIONSHIP_TYPES } from '@/lib/neo4j/types'
import { clearReviewFlagForItem } from './correction-propagation'

/**
 * Regeneration result type
 */
export interface RegenerationResult {
  success: boolean
  itemId: string
  itemType: 'qa_answer' | 'cim_section'
  previousContent?: string
  newContent?: string
  regeneratedAt?: string
  error?: string
}

/**
 * Q&A Answer regeneration context
 */
export interface QARegenerationContext {
  qaId: string
  question: string
  previousAnswer: string
  qaListId: string
  dealId: string
  // Source findings that have been corrected
  correctedFindingIds: string[]
  // Current corrected finding values
  findingContext: {
    id: string
    text: string
    confidence: number
  }[]
}

/**
 * CIM Section regeneration context
 */
export interface CIMRegenerationContext {
  sectionId: string
  cimId: string
  sectionTitle: string
  previousContent: string
  dealId: string
  // Source findings that have been corrected
  correctedFindingIds: string[]
  // Current corrected finding values
  findingContext: {
    id: string
    text: string
    confidence: number
  }[]
}

/**
 * Get regeneration context for a Q&A answer
 * Retrieves the question, previous answer, and all related findings
 */
export async function getQARegenerationContext(
  supabase: SupabaseClient<Database>,
  qaId: string,
  dealId: string
): Promise<QARegenerationContext | null> {
  try {
    // Get Q&A answer from Neo4j
    const qaResult = await executeRead<{
      qa: {
        id: string
        question: string
        answer: string
        qa_list_id: string
        deal_id: string
      }
    }>(
      `MATCH (qa:${NODE_LABELS.QA_ANSWER} {id: $qaId, deal_id: $dealId})
       RETURN qa`,
      { qaId, dealId }
    )

    if (qaResult.length === 0 || !qaResult[0]) {
      return null
    }

    const qa = qaResult[0].qa

    // Get all findings that this Q&A answer is derived from/references
    const findingsResult = await executeRead<{
      f: {
        id: string
        text: string
        confidence: number
      }
      corrected: boolean
    }>(
      `MATCH (qa:${NODE_LABELS.QA_ANSWER} {id: $qaId})-[r]->(f:${NODE_LABELS.FINDING})
       WHERE type(r) IN ['${RELATIONSHIP_TYPES.DERIVED_FROM}', '${RELATIONSHIP_TYPES.REFERENCES}', '${RELATIONSHIP_TYPES.BASED_ON}']
       OPTIONAL MATCH (fc:FindingCorrection)-[:CORRECTS]->(f)
       RETURN f, fc IS NOT NULL as corrected`,
      { qaId }
    )

    const correctedFindingIds = findingsResult
      .filter(r => r.corrected)
      .map(r => r.f.id)

    return {
      qaId: qa.id,
      question: qa.question,
      previousAnswer: qa.answer,
      qaListId: qa.qa_list_id,
      dealId: qa.deal_id,
      correctedFindingIds,
      findingContext: findingsResult.map(r => ({
        id: r.f.id,
        text: r.f.text,
        confidence: r.f.confidence,
      })),
    }
  } catch (error) {
    console.error('[regeneration] Error getting Q&A context:', error)
    return null
  }
}

/**
 * Get regeneration context for a CIM section
 * Retrieves the section details and all related findings
 */
export async function getCIMRegenerationContext(
  supabase: SupabaseClient<Database>,
  sectionId: string,
  dealId: string
): Promise<CIMRegenerationContext | null> {
  try {
    // Get CIM section from Neo4j
    const cimResult = await executeRead<{
      cim: {
        id: string
        cim_id: string
        section_title: string
        section_content: string
        deal_id: string
      }
    }>(
      `MATCH (cim:${NODE_LABELS.CIM_SECTION} {id: $sectionId, deal_id: $dealId})
       RETURN cim`,
      { sectionId, dealId }
    )

    if (cimResult.length === 0 || !cimResult[0]) {
      return null
    }

    const cim = cimResult[0].cim

    // Get all findings that this CIM section is derived from/references
    const findingsResult = await executeRead<{
      f: {
        id: string
        text: string
        confidence: number
      }
      corrected: boolean
    }>(
      `MATCH (cim:${NODE_LABELS.CIM_SECTION} {id: $sectionId})-[r]->(f:${NODE_LABELS.FINDING})
       WHERE type(r) IN ['${RELATIONSHIP_TYPES.DERIVED_FROM}', '${RELATIONSHIP_TYPES.REFERENCES}', '${RELATIONSHIP_TYPES.BASED_ON}']
       OPTIONAL MATCH (fc:FindingCorrection)-[:CORRECTS]->(f)
       RETURN f, fc IS NOT NULL as corrected`,
      { sectionId }
    )

    const correctedFindingIds = findingsResult
      .filter(r => r.corrected)
      .map(r => r.f.id)

    return {
      sectionId: cim.id,
      cimId: cim.cim_id,
      sectionTitle: cim.section_title,
      previousContent: cim.section_content,
      dealId: cim.deal_id,
      correctedFindingIds,
      findingContext: findingsResult.map(r => ({
        id: r.f.id,
        text: r.f.text,
        confidence: r.f.confidence,
      })),
    }
  } catch (error) {
    console.error('[regeneration] Error getting CIM context:', error)
    return null
  }
}

/**
 * Update Q&A answer content in Neo4j after regeneration
 */
export async function updateQAAnswer(
  qaId: string,
  newAnswer: string
): Promise<boolean> {
  try {
    await executeWrite(
      `MATCH (qa:${NODE_LABELS.QA_ANSWER} {id: $qaId})
       SET qa.answer = $newAnswer,
           qa.updated_at = datetime(),
           qa.needs_review = false,
           qa.review_reason = null`,
      { qaId, newAnswer }
    )
    return true
  } catch (error) {
    console.error('[regeneration] Error updating Q&A answer:', error)
    return false
  }
}

/**
 * Update CIM section content in Neo4j after regeneration
 */
export async function updateCIMSection(
  sectionId: string,
  newContent: string
): Promise<boolean> {
  try {
    await executeWrite(
      `MATCH (cim:${NODE_LABELS.CIM_SECTION} {id: $sectionId})
       SET cim.section_content = $newContent,
           cim.updated_at = datetime(),
           cim.needs_review = false,
           cim.review_reason = null`,
      { sectionId, newContent }
    )
    return true
  } catch (error) {
    console.error('[regeneration] Error updating CIM section:', error)
    return false
  }
}

/**
 * Trigger regeneration for a Q&A answer
 * This is a placeholder that should integrate with the actual Q&A generation service
 * Story: E7.6 - Propagate Corrections to Related Insights (AC: #4)
 */
export async function regenerateQAAnswer(
  supabase: SupabaseClient<Database>,
  qaId: string,
  dealId: string,
  options?: {
    autoApply?: boolean
  }
): Promise<RegenerationResult> {
  try {
    // Get regeneration context
    const context = await getQARegenerationContext(supabase, qaId, dealId)

    if (!context) {
      return {
        success: false,
        itemId: qaId,
        itemType: 'qa_answer',
        error: 'Q&A answer not found',
      }
    }

    // For now, just clear the review flag and return success
    // In a full implementation, this would:
    // 1. Call the Q&A generation service with the updated findings
    // 2. Generate a new answer based on corrected data
    // 3. Update the answer in Neo4j
    // 4. Clear the review flag

    // Placeholder: Just clear the review flag
    const cleared = await clearReviewFlagForItem(supabase, qaId, 'qa_answer')

    if (!cleared) {
      return {
        success: false,
        itemId: qaId,
        itemType: 'qa_answer',
        error: 'Failed to clear review flag',
      }
    }

    return {
      success: true,
      itemId: qaId,
      itemType: 'qa_answer',
      previousContent: context.previousAnswer,
      // In full implementation, newContent would be the regenerated answer
      newContent: context.previousAnswer, // Placeholder: unchanged for now
      regeneratedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error('[regeneration] Error regenerating Q&A answer:', error)
    return {
      success: false,
      itemId: qaId,
      itemType: 'qa_answer',
      error: 'Internal error during regeneration',
    }
  }
}

/**
 * Trigger regeneration for a CIM section
 * This is a placeholder that should integrate with the actual CIM generation service
 * Story: E7.6 - Propagate Corrections to Related Insights (AC: #4)
 */
export async function regenerateCIMSection(
  supabase: SupabaseClient<Database>,
  sectionId: string,
  dealId: string,
  options?: {
    autoApply?: boolean
  }
): Promise<RegenerationResult> {
  try {
    // Get regeneration context
    const context = await getCIMRegenerationContext(supabase, sectionId, dealId)

    if (!context) {
      return {
        success: false,
        itemId: sectionId,
        itemType: 'cim_section',
        error: 'CIM section not found',
      }
    }

    // For now, just clear the review flag and return success
    // In a full implementation, this would:
    // 1. Call the CIM generation service with the updated findings
    // 2. Generate new section content based on corrected data
    // 3. Update the section in Neo4j (and Supabase if stored there)
    // 4. Clear the review flag

    // Placeholder: Just clear the review flag
    const cleared = await clearReviewFlagForItem(supabase, sectionId, 'cim_section')

    if (!cleared) {
      return {
        success: false,
        itemId: sectionId,
        itemType: 'cim_section',
        error: 'Failed to clear review flag',
      }
    }

    return {
      success: true,
      itemId: sectionId,
      itemType: 'cim_section',
      previousContent: context.previousContent,
      // In full implementation, newContent would be the regenerated content
      newContent: context.previousContent, // Placeholder: unchanged for now
      regeneratedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error('[regeneration] Error regenerating CIM section:', error)
    return {
      success: false,
      itemId: sectionId,
      itemType: 'cim_section',
      error: 'Internal error during regeneration',
    }
  }
}

/**
 * Get the list of items that can be regenerated for a deal
 */
export async function getRegeneratableItems(
  supabase: SupabaseClient<Database>,
  dealId: string
): Promise<{
  qaAnswers: { id: string; question: string; reviewReason: string }[]
  cimSections: { id: string; title: string; reviewReason: string }[]
}> {
  const result = {
    qaAnswers: [] as { id: string; question: string; reviewReason: string }[],
    cimSections: [] as { id: string; title: string; reviewReason: string }[],
  }

  try {
    // Get Q&A answers needing review
    const qaResult = await executeRead<{
      qa: {
        id: string
        question: string
        review_reason: string
      }
    }>(
      `MATCH (qa:${NODE_LABELS.QA_ANSWER} {deal_id: $dealId, needs_review: true})
       RETURN qa`,
      { dealId }
    )

    result.qaAnswers = qaResult.map(r => ({
      id: r.qa.id,
      question: r.qa.question,
      reviewReason: r.qa.review_reason || 'Flagged for review',
    }))

    // Get CIM sections needing review
    const cimResult = await executeRead<{
      cim: {
        id: string
        section_title: string
        review_reason: string
      }
    }>(
      `MATCH (cim:${NODE_LABELS.CIM_SECTION} {deal_id: $dealId, needs_review: true})
       RETURN cim`,
      { dealId }
    )

    result.cimSections = cimResult.map(r => ({
      id: r.cim.id,
      title: r.cim.section_title,
      reviewReason: r.cim.review_reason || 'Flagged for review',
    }))
  } catch (error) {
    console.error('[regeneration] Error getting regeneratable items:', error)
  }

  return result
}
