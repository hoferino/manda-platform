/**
 * Feedback Types
 *
 * TypeScript types for the Learning Loop feedback system.
 * Story: E7.1 - Implement Finding Correction via Chat
 *
 * Types cover:
 * - Finding corrections with source validation
 * - Correction propagation impact tracking
 * - Source error cascade results
 */

import { Database } from '@/lib/supabase/database.types'

// Database row types
type DbFindingCorrection = Database['public']['Tables']['finding_corrections']['Row']
type DbFindingCorrectionInsert = Database['public']['Tables']['finding_corrections']['Insert']

/**
 * Validation status for finding corrections
 * Determines how the correction was verified
 */
export type ValidationStatus =
  | 'pending'
  | 'confirmed_with_source'
  | 'override_without_source'
  | 'source_error'

/**
 * Type of correction being made
 */
export type CorrectionType = 'value' | 'source' | 'confidence' | 'text'

/**
 * Finding correction record
 * Represents a single correction to a finding with full audit trail
 */
export interface FindingCorrection {
  id: string
  findingId: string
  originalValue: string
  correctedValue: string
  correctionType: CorrectionType
  reason?: string
  analystId: string
  createdAt: string

  // Source validation fields (AC: #8, #9, #11)
  originalSourceDocument?: string   // Document where finding was extracted from
  originalSourceLocation?: string   // Page number, cell reference, paragraph
  userSourceReference?: string      // User's basis for correction
  validationStatus: ValidationStatus
}

/**
 * Request to create a finding correction
 */
export interface CreateCorrectionRequest {
  findingId: string
  originalValue: string
  correctedValue: string
  correctionType: CorrectionType
  reason?: string
  userSourceReference?: string
  validationStatus: ValidationStatus
}

/**
 * Dependent insight that may need review after a correction
 */
export interface DependentInsight {
  id: string
  type: 'qa_answer' | 'cim_section' | 'insight' | 'finding'
  title: string
  flaggedForReview: boolean
}

/**
 * Source document error cascade impact
 * Populated when validationStatus = 'source_error'
 */
export interface SourceDocumentImpact {
  documentId: string
  documentName: string
  previousReliabilityStatus: 'trusted' | 'contains_errors' | 'superseded'
  newReliabilityStatus: 'contains_errors'
  totalFindingsFromDocument: number
  findingsFlaggedForReview: number
  embeddingRegenerated: boolean
  neo4jUpdated: boolean
}

/**
 * Correction result with full impact assessment
 * Returned after processing a correction
 */
export interface CorrectionWithImpact {
  correction: FindingCorrection
  dependentInsights: DependentInsight[]
  // Only populated when validationStatus = 'source_error' and cascade enabled
  sourceDocumentImpact?: SourceDocumentImpact
}

/**
 * Source citation for a finding
 * Used to display original source before accepting correction
 */
export interface SourceCitation {
  documentId: string
  documentName: string
  location: string
  extractedValue: string
}

/**
 * Result of retrieving original source for a finding
 */
export interface OriginalSourceResult {
  found: boolean
  citation?: SourceCitation
  error?: string
}

/**
 * Correction history entry for display
 */
export interface CorrectionHistoryEntry extends FindingCorrection {
  analystName?: string
  analystEmail?: string
}

/**
 * Map database row to FindingCorrection interface
 */
export function mapDbToFindingCorrection(row: DbFindingCorrection): FindingCorrection {
  return {
    id: row.id,
    findingId: row.finding_id,
    originalValue: row.original_value,
    correctedValue: row.corrected_value,
    correctionType: row.correction_type as CorrectionType,
    reason: row.reason ?? undefined,
    analystId: row.analyst_id,
    createdAt: row.created_at ?? new Date().toISOString(),
    originalSourceDocument: row.original_source_document ?? undefined,
    originalSourceLocation: row.original_source_location ?? undefined,
    userSourceReference: row.user_source_reference ?? undefined,
    validationStatus: row.validation_status as ValidationStatus,
  }
}

/**
 * Map FindingCorrection to database insert format
 */
export function mapCorrectionToDbInsert(
  correction: CreateCorrectionRequest,
  analystId: string,
  sourceInfo?: { document?: string; location?: string }
): DbFindingCorrectionInsert {
  return {
    finding_id: correction.findingId,
    original_value: correction.originalValue,
    corrected_value: correction.correctedValue,
    correction_type: correction.correctionType,
    reason: correction.reason ?? null,
    analyst_id: analystId,
    original_source_document: sourceInfo?.document ?? null,
    original_source_location: sourceInfo?.location ?? null,
    user_source_reference: correction.userSourceReference ?? null,
    validation_status: correction.validationStatus,
  }
}

/**
 * Correction propagation result
 */
export interface PropagationResult {
  success: boolean
  dependentCount: number
  flaggedCount: number
  dependentInsights: DependentInsight[]
  errors?: string[]
}

/**
 * Source error cascade result
 */
export interface SourceErrorCascadeResult {
  success: boolean
  documentId: string
  documentName: string
  totalFindings: number
  flaggedFindings: number
  embeddingRegenerated: boolean
  neo4jSynced: boolean
  errors?: string[]
}

/**
 * Agent tool correction request format
 * Used when the agent detects correction intent
 */
export interface AgentCorrectionRequest {
  findingId: string
  originalValue: string
  correctedValue: string
  correctionType: CorrectionType
  reason?: string
}

/**
 * Agent tool correction response format
 */
export interface AgentCorrectionResponse {
  success: boolean
  message: string
  correction?: FindingCorrection
  dependentCount?: number
  sourceDocumentFlagged?: boolean
  flaggedFindingsCount?: number
  requiresSourceValidation?: boolean
  sourceCitation?: SourceCitation
}

/**
 * Parsed correction intent from user message
 */
export interface ParsedCorrectionIntent {
  found: boolean
  corrections: {
    findingText: string
    originalValue: string
    correctedValue: string
    confidence: number
  }[]
}
