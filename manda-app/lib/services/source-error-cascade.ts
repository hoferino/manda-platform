/**
 * Source Error Cascade Service
 *
 * Handles cascade operations when a source document has errors.
 * Story: E7.1 - Implement Finding Correction via Chat
 * AC: #12, #13, #14, #15, #16
 *
 * Features:
 * - Mark document as unreliable
 * - Flag all findings from document for review
 * - Regenerate corrected finding embedding
 * - Sync to Neo4j knowledge graph
 *
 * IMPORTANT: All operations are gated by feature flags for safe rollout.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase/database.types'
import { SourceErrorCascadeResult, SourceDocumentImpact } from '@/lib/types/feedback'
import {
  getFeatureFlag,
  isSourceErrorCascadeAllowed,
  isAutoFlagDocumentFindingsAllowed,
} from '@/lib/config/feature-flags'
// E10.8: generateEmbedding removed - Graphiti handles all embeddings via Voyage AI
import { updateNode, getNodeById } from '@/lib/neo4j/operations'
import { NODE_LABELS, type FindingNode, type DocumentNode } from '@/lib/neo4j/types'

type DbDocument = Database['public']['Tables']['documents']['Row']
type DbFinding = Database['public']['Tables']['findings']['Row']

/**
 * Mark a document as unreliable due to source error (AC: #12)
 *
 * @param supabase - Supabase client
 * @param documentId - Document to mark as unreliable
 * @param errorNote - Description of the error found
 * @returns Success status
 */
export async function markDocumentAsUnreliable(
  supabase: SupabaseClient<Database>,
  documentId: string,
  errorNote: string
): Promise<{ success: boolean; previousStatus?: string; error?: string }> {
  try {
    // Check if cascade is allowed
    const cascadeEnabled = await isSourceErrorCascadeAllowed()
    if (!cascadeEnabled) {
      console.warn('[source-error-cascade] Cascade disabled by feature flag')
      return { success: false, error: 'Source error cascade is disabled' }
    }

    // Get current document status
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('id, name, reliability_status, reliability_notes, error_count')
      .eq('id', documentId)
      .single()

    if (fetchError || !document) {
      return { success: false, error: 'Document not found' }
    }

    const previousStatus = document.reliability_status

    // Append new error note to existing notes
    const existingNotes = document.reliability_notes || ''
    const timestamp = new Date().toISOString()
    const newNote = `[${timestamp}] ${errorNote}`
    const updatedNotes = existingNotes ? `${existingNotes}\n${newNote}` : newNote

    // Update document reliability status
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        reliability_status: 'contains_errors',
        reliability_notes: updatedNotes,
        error_count: (document.error_count || 0) + 1,
      })
      .eq('id', documentId)

    if (updateError) {
      console.error('[source-error-cascade] Failed to update document:', updateError)
      return { success: false, error: 'Failed to update document' }
    }

    return { success: true, previousStatus }
  } catch (err) {
    console.error('[source-error-cascade] Error marking document unreliable:', err)
    return { success: false, error: 'Internal error' }
  }
}

/**
 * Flag all findings from a document for review (AC: #13)
 *
 * @param supabase - Supabase client
 * @param documentId - Source document ID
 * @param reason - Reason for flagging
 * @returns Count of flagged findings
 */
export async function flagAllFindingsFromDocument(
  supabase: SupabaseClient<Database>,
  documentId: string,
  reason: string
): Promise<{ success: boolean; flaggedCount: number; totalCount: number; error?: string }> {
  try {
    // Check if auto-flagging is allowed
    const autoFlagEnabled = await isAutoFlagDocumentFindingsAllowed()
    if (!autoFlagEnabled) {
      console.warn('[source-error-cascade] Auto-flag disabled by feature flag')
      return { success: false, flaggedCount: 0, totalCount: 0, error: 'Auto-flag is disabled' }
    }

    // Count total findings from document
    const { count: totalCount, error: countError } = await supabase
      .from('findings')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', documentId)

    if (countError) {
      return { success: false, flaggedCount: 0, totalCount: 0, error: 'Failed to count findings' }
    }

    // Update all findings from document to needs_review
    const { error: updateError } = await supabase
      .from('findings')
      .update({
        needs_review: true,
        review_reason: reason,
      })
      .eq('document_id', documentId)

    if (updateError) {
      console.error('[source-error-cascade] Failed to flag findings:', updateError)
      return { success: false, flaggedCount: 0, totalCount: totalCount || 0, error: 'Failed to flag findings' }
    }

    return { success: true, flaggedCount: totalCount || 0, totalCount: totalCount || 0 }
  } catch (err) {
    console.error('[source-error-cascade] Error flagging findings:', err)
    return { success: false, flaggedCount: 0, totalCount: 0, error: 'Internal error' }
  }
}

/**
 * Regenerate embedding for a corrected finding (AC: #14)
 *
 * @deprecated E10.8 - pgvector embeddings removed, Graphiti handles embeddings
 *
 * This function is now a no-op. Graphiti handles all embeddings via Voyage AI
 * during document ingestion. Corrections to findings should trigger Graphiti
 * re-ingestion instead of direct embedding updates.
 *
 * @param supabase - Supabase client (unused)
 * @param findingId - Finding ID (unused)
 * @param correctedText - The corrected text (unused)
 * @returns Success status (always true as no-op)
 */
export async function regenerateFindingEmbedding(
  _supabase: SupabaseClient<Database>,
  _findingId: string,
  _correctedText: string
): Promise<{ success: boolean; error?: string }> {
  // E10.8: This function is deprecated.
  // pgvector embeddings have been removed from findings table.
  // Graphiti now handles all embeddings via Voyage AI during ingestion.
  // TODO: Implement Graphiti episode update for corrected findings
  console.info('[source-error-cascade] E10.8: regenerateFindingEmbedding is now a no-op')
  return { success: true }
}

/**
 * Sync correction to Neo4j knowledge graph (AC: #15)
 *
 * @param findingId - Finding ID
 * @param correctedValue - New value
 * @param documentId - Source document ID
 * @returns Success status
 */
export async function syncToNeo4j(
  findingId: string,
  correctedValue: string,
  documentId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if Neo4j sync is enabled
    const neo4jEnabled = await getFeatureFlag('neo4jSyncEnabled')
    if (!neo4jEnabled) {
      console.warn('[source-error-cascade] Neo4j sync disabled by feature flag')
      return { success: false, error: 'Neo4j sync is disabled' }
    }

    // Update finding node in Neo4j
    const findingNode = await getNodeById<FindingNode>(NODE_LABELS.FINDING, findingId)
    if (findingNode) {
      const updateSuccess = await updateNode(
        NODE_LABELS.FINDING,
        findingId,
        {
          text: correctedValue,
          corrected_at: new Date().toISOString(),
          needs_review: false, // The corrected finding itself doesn't need review
        }
      )

      if (!updateSuccess) {
        console.error('[source-error-cascade] Failed to update Neo4j finding node')
        return { success: false, error: 'Failed to update finding in Neo4j' }
      }
    }

    // Update document node reliability status if provided
    if (documentId) {
      const docNode = await getNodeById<DocumentNode>(NODE_LABELS.DOCUMENT, documentId)
      if (docNode) {
        await updateNode(
          NODE_LABELS.DOCUMENT,
          documentId,
          {
            reliability_status: 'contains_errors',
          }
        )
      }
    }

    return { success: true }
  } catch (err) {
    console.error('[source-error-cascade] Error syncing to Neo4j:', err)
    // Don't fail the whole operation if Neo4j sync fails
    return { success: false, error: 'Neo4j sync failed (non-fatal)' }
  }
}

/**
 * Execute full source error cascade (AC: #12, #13, #14, #15, #16)
 *
 * This is the main entry point for handling source_error corrections.
 * Orchestrates all cascade operations with feature flag checks.
 *
 * @param supabase - Supabase client
 * @param findingId - Corrected finding ID
 * @param correctedValue - New corrected value
 * @param documentId - Source document ID
 * @param errorNote - Description of the error
 * @returns Full cascade result
 */
export async function executeSourceErrorCascade(
  supabase: SupabaseClient<Database>,
  findingId: string,
  correctedValue: string,
  documentId: string,
  errorNote: string
): Promise<SourceErrorCascadeResult> {
  const result: SourceErrorCascadeResult = {
    success: false,
    documentId,
    documentName: '',
    totalFindings: 0,
    flaggedFindings: 0,
    embeddingRegenerated: false,
    neo4jSynced: false,
    errors: [],
  }

  try {
    // Check if cascade is enabled at all
    const cascadeEnabled = await isSourceErrorCascadeAllowed()
    if (!cascadeEnabled) {
      result.errors = ['Source error cascade is disabled by feature flag']
      return result
    }

    // Get document info
    const { data: document } = await supabase
      .from('documents')
      .select('id, name')
      .eq('id', documentId)
      .single()

    if (document) {
      result.documentName = document.name
    }

    // 1. Mark document as unreliable (AC: #12)
    const markResult = await markDocumentAsUnreliable(supabase, documentId, errorNote)
    if (!markResult.success && markResult.error) {
      result.errors?.push(markResult.error)
    }

    // 2. Flag all findings from document (AC: #13)
    const flagResult = await flagAllFindingsFromDocument(
      supabase,
      documentId,
      `Source document contains known errors: ${errorNote}`
    )
    result.totalFindings = flagResult.totalCount
    result.flaggedFindings = flagResult.flaggedCount
    if (!flagResult.success && flagResult.error) {
      result.errors?.push(flagResult.error)
    }

    // 3. Regenerate embedding for corrected finding (AC: #14)
    const embedResult = await regenerateFindingEmbedding(supabase, findingId, correctedValue)
    result.embeddingRegenerated = embedResult.success
    if (!embedResult.success && embedResult.error) {
      result.errors?.push(embedResult.error)
    }

    // 4. Sync to Neo4j (AC: #15)
    const neo4jResult = await syncToNeo4j(findingId, correctedValue, documentId)
    result.neo4jSynced = neo4jResult.success
    if (!neo4jResult.success && neo4jResult.error) {
      result.errors?.push(neo4jResult.error)
    }

    // Success if at least the document was marked (core operation)
    result.success = markResult.success

    return result
  } catch (err) {
    console.error('[source-error-cascade] Error executing cascade:', err)
    result.errors?.push('Internal error during cascade execution')
    return result
  }
}

/**
 * Build SourceDocumentImpact object from cascade result
 * Used for CorrectionWithImpact response
 */
export function buildSourceDocumentImpact(
  cascadeResult: SourceErrorCascadeResult,
  previousStatus: 'trusted' | 'contains_errors' | 'superseded' = 'trusted'
): SourceDocumentImpact {
  return {
    documentId: cascadeResult.documentId,
    documentName: cascadeResult.documentName,
    previousReliabilityStatus: previousStatus,
    newReliabilityStatus: 'contains_errors',
    totalFindingsFromDocument: cascadeResult.totalFindings,
    findingsFlaggedForReview: cascadeResult.flaggedFindings,
    embeddingRegenerated: cascadeResult.embeddingRegenerated,
    neo4jUpdated: cascadeResult.neo4jSynced,
  }
}
