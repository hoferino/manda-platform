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

// ============================================================================
// Validation Feedback Types (E7.2)
// ============================================================================

/**
 * Validation feedback action type
 */
export type ValidationAction = 'validate' | 'reject'

/**
 * Validation feedback record from database
 */
export interface ValidationFeedback {
  id: string
  findingId: string
  action: ValidationAction
  reason?: string
  analystId: string
  createdAt: string
}

/**
 * Request to record validation feedback
 */
export interface RecordValidationRequest {
  findingId: string
  action: ValidationAction
  reason?: string
}

/**
 * Aggregated validation statistics for a finding
 * From the finding_validation_stats view
 */
export interface FindingValidationStats {
  findingId: string
  validationCount: number
  rejectionCount: number
  totalFeedback: number
}

/**
 * Result of recording validation/rejection with updated confidence
 */
export interface ValidationFeedbackResult {
  success: boolean
  feedbackId: string
  newConfidence: number
  previousConfidence: number
  sourceFlagged?: boolean
  sourceFlaggedReason?: string
}

/**
 * Source rejection rate info for flagging decisions
 */
export interface SourceRejectionInfo {
  documentId: string
  documentName: string
  totalFindings: number
  rejectedFindings: number
  rejectionRate: number
  exceedsThreshold: boolean
}

/**
 * Validation API response type
 */
export interface ValidationApiResponse {
  success: boolean
  newConfidence: number
  previousConfidence?: number
  feedbackId?: string
  error?: string
}

/**
 * Stats API response type
 */
export interface ValidationStatsApiResponse {
  findingId: string
  validationCount: number
  rejectionCount: number
  totalFeedback: number
  adjustedConfidence: number
  baseConfidence: number
}

// ============================================================================
// Response Edit Types (E7.3)
// ============================================================================

/**
 * Type of edit being made to a response
 */
export type EditType = 'style' | 'content' | 'factual' | 'formatting'

/**
 * Type of pattern detected from edits
 */
export type PatternType = 'word_replacement' | 'phrase_removal' | 'tone_adjustment' | 'structure_change'

/**
 * Response edit record from database
 */
export interface ResponseEdit {
  id: string
  messageId: string
  originalText: string
  editedText: string
  editType: EditType
  analystId: string
  createdAt: string
}

/**
 * Request to save a response edit
 */
export interface SaveResponseEditRequest {
  messageId: string
  originalText: string
  editedText: string
  editType: EditType
}

/**
 * Edit pattern record from database
 */
export interface EditPattern {
  id: string
  analystId: string
  patternType: PatternType
  originalPattern: string
  replacementPattern: string
  occurrenceCount: number
  firstSeen: string
  lastSeen: string
  isActive: boolean
}

/**
 * Detected pattern from text diff analysis
 */
export interface DetectedPattern {
  patternType: PatternType
  originalPattern: string
  replacementPattern: string
}

/**
 * Result of saving a response edit
 */
export interface ResponseEditResult {
  success: boolean
  edit: ResponseEdit
  detectedPatterns: DetectedPattern[]
  patternsUpdated: number
}

/**
 * Request to toggle pattern active state
 */
export interface TogglePatternRequest {
  patternId: string
  isActive: boolean
}

/**
 * Few-shot example for prompt enhancement
 */
export interface FewShotExample {
  original: string
  preferred: string
  patternType: PatternType
}

/**
 * Map database row to ResponseEdit interface
 */
export function mapDbToResponseEdit(row: {
  id: string
  message_id: string
  original_text: string
  edited_text: string
  edit_type: string
  analyst_id: string
  created_at: string | null
}): ResponseEdit {
  return {
    id: row.id,
    messageId: row.message_id,
    originalText: row.original_text,
    editedText: row.edited_text,
    editType: row.edit_type as EditType,
    analystId: row.analyst_id,
    createdAt: row.created_at ?? new Date().toISOString(),
  }
}

/**
 * Map database row to EditPattern interface
 */
export function mapDbToEditPattern(row: {
  id: string
  analyst_id: string
  pattern_type: string
  original_pattern: string
  replacement_pattern: string
  occurrence_count: number | null
  first_seen: string | null
  last_seen: string | null
  is_active: boolean | null
}): EditPattern {
  return {
    id: row.id,
    analystId: row.analyst_id,
    patternType: row.pattern_type as PatternType,
    originalPattern: row.original_pattern,
    replacementPattern: row.replacement_pattern,
    occurrenceCount: row.occurrence_count ?? 1,
    firstSeen: row.first_seen ?? new Date().toISOString(),
    lastSeen: row.last_seen ?? new Date().toISOString(),
    isActive: row.is_active ?? true,
  }
}

// ============================================================================
// Feedback Analysis Types (E7.4)
// ============================================================================

/**
 * Aggregated feedback data for a single finding
 * Used for analysis and confidence threshold adjustments
 */
export interface FindingFeedbackAggregate {
  findingId: string
  findingText: string
  domain: string
  sourceDocument?: string

  // Correction stats
  correctionCount: number
  lastCorrectedAt?: string

  // Validation/rejection stats
  validationCount: number
  rejectionCount: number
  netValidations: number // validationCount - rejectionCount

  // Confidence info
  originalConfidence: number
  currentConfidence: number

  // Analysis flags
  needsReview: boolean
  hasCascadeImpact: boolean
}

/**
 * Pattern-based feedback analysis result
 * Identifies systematic patterns in corrections/rejections
 */
export interface FeedbackPattern {
  patternType: 'domain_bias' | 'source_quality' | 'confidence_drift' | 'extraction_error'
  description: string
  affectedCount: number
  severity: 'low' | 'medium' | 'high'
  recommendation: string
  examples: string[]
}

/**
 * Feedback analysis summary for a project/deal
 */
export interface FeedbackAnalysisSummary {
  dealId: string
  analysisDate: string
  periodStart: string
  periodEnd: string

  // Aggregate stats
  totalFindings: number
  totalCorrections: number
  totalValidations: number
  totalRejections: number

  // Patterns identified
  patterns: FeedbackPattern[]

  // Per-domain breakdown
  domainStats: DomainFeedbackStats[]

  // Recommendations
  recommendations: AnalysisRecommendation[]

  // Confidence threshold recommendations
  confidenceAdjustments: ConfidenceThresholdAdjustment[]
}

/**
 * Per-domain feedback statistics
 */
export interface DomainFeedbackStats {
  domain: string
  findingCount: number
  correctionCount: number
  validationCount: number
  rejectionCount: number
  averageConfidence: number
  rejectionRate: number
}

/**
 * Recommendation from feedback analysis
 */
export interface AnalysisRecommendation {
  id: string
  type: 'prompt_improvement' | 'threshold_adjustment' | 'source_review' | 'domain_focus'
  priority: 'low' | 'medium' | 'high'
  title: string
  description: string
  actionable: boolean
  autoApplicable: boolean
  applied?: boolean
  appliedAt?: string
}

/**
 * Confidence threshold adjustment recommendation
 */
export interface ConfidenceThresholdAdjustment {
  domain: string
  currentThreshold: number
  recommendedThreshold: number
  reason: string
  basedOnSampleSize: number
  statisticalConfidence: number
}

/**
 * Feedback analysis job request
 */
export interface FeedbackAnalysisJobRequest {
  dealId: string
  analysisType: 'full' | 'incremental'
  periodDays?: number // Default 7 days
  includePatternDetection?: boolean
  includeConfidenceAdjustments?: boolean
}

/**
 * Feedback analysis job result
 */
export interface FeedbackAnalysisJobResult {
  success: boolean
  jobId: string
  summary?: FeedbackAnalysisSummary
  error?: string
  processingTimeMs: number
}

/**
 * Prompt improvement suggestion from analysis
 */
export interface PromptImprovementSuggestion {
  id: string
  domain?: string
  correctionPattern: string
  originalPromptSnippet?: string
  suggestedImprovement: string
  basedOnCorrections: number
  confidence: number
  createdAt: string
}

/**
 * Feedback analytics record in database
 */
export interface FeedbackAnalyticsRecord {
  id: string
  dealId: string
  analysisDate: string
  periodStart: string
  periodEnd: string
  summaryJson: FeedbackAnalysisSummary
  createdAt: string
}

/**
 * Map database row to FeedbackAnalyticsRecord
 */
export function mapDbToFeedbackAnalyticsRecord(row: {
  id: string
  deal_id: string
  analysis_date: string
  period_start: string
  period_end: string
  summary_json: unknown
  created_at: string | null
}): FeedbackAnalyticsRecord {
  return {
    id: row.id,
    dealId: row.deal_id,
    analysisDate: row.analysis_date,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    summaryJson: row.summary_json as FeedbackAnalysisSummary,
    createdAt: row.created_at ?? new Date().toISOString(),
  }
}

/**
 * Confidence threshold record in database
 */
export interface ConfidenceThresholdRecord {
  id: string
  dealId: string
  domain: string
  threshold: number
  previousThreshold?: number
  reason: string
  appliedAt: string
  appliedBy: string
  autoApplied: boolean
}

/**
 * Map database row to ConfidenceThresholdRecord
 */
export function mapDbToConfidenceThresholdRecord(row: {
  id: string
  deal_id: string
  domain: string
  threshold: number
  previous_threshold: number | null
  reason: string
  applied_at: string | null
  applied_by: string
  auto_applied: boolean | null
}): ConfidenceThresholdRecord {
  return {
    id: row.id,
    dealId: row.deal_id,
    domain: row.domain,
    threshold: row.threshold,
    previousThreshold: row.previous_threshold ?? undefined,
    reason: row.reason,
    appliedAt: row.applied_at ?? new Date().toISOString(),
    appliedBy: row.applied_by,
    autoApplied: row.auto_applied ?? false,
  }
}

/**
 * Weekly analysis job status
 */
export interface AnalysisJobStatus {
  jobId: string
  dealId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  startedAt?: string
  completedAt?: string
  error?: string
}

// ============================================================================
// Audit Trail Types (E7.5)
// ============================================================================

/**
 * Audit entry type identifier
 */
export type AuditEntryType = 'correction' | 'validation' | 'edit'

/**
 * Parameters for querying audit trail records
 * (AC: #5 - queryable by date range, analyst, finding)
 */
export interface AuditQueryParams {
  startDate?: Date | string
  endDate?: Date | string
  analystId?: string
  findingId?: string
  messageId?: string
  limit?: number
  offset?: number
  orderBy?: 'created_at' | 'analyst_id'
  orderDir?: 'asc' | 'desc'
  types?: AuditEntryType[]
}

/**
 * Unified audit entry type that wraps all feedback types
 * (AC: #1, #2, #3 - all logged with required fields)
 */
export interface AuditEntry {
  type: AuditEntryType
  id: string
  timestamp: string
  analystId: string
  // Finding-related (for corrections and validations)
  findingId?: string
  // Message-related (for response edits)
  messageId?: string
  // Type-specific data
  data: FindingCorrection | ValidationFeedback | ResponseEdit
}

/**
 * Finding history entry with correction lineage
 * (AC: #7 - complete correction lineage)
 */
export interface FindingHistoryEntry {
  findingId: string
  // All corrections for this finding
  corrections: FindingCorrection[]
  // All validation/rejection feedback
  validations: ValidationFeedback[]
  // Calculated confidence impact from validations
  confidenceImpact: {
    original: number
    current: number
    validationCount: number
    rejectionCount: number
  }
  // Combined timeline (sorted by timestamp)
  timeline: AuditEntry[]
}

/**
 * Export format options
 */
export type AuditExportFormat = 'csv' | 'json'

/**
 * Export options for audit trail
 * (AC: #6 - export to CSV/JSON with all fields)
 */
export interface AuditExportOptions {
  format: AuditExportFormat
  types?: AuditEntryType[]
  fields?: string[]
  includeMetadata?: boolean
  // Filter options
  startDate?: Date | string
  endDate?: Date | string
  analystId?: string
  findingId?: string
}

/**
 * Audit export result with metadata
 */
export interface AuditExportResult {
  success: boolean
  filename: string
  format: AuditExportFormat
  recordCount: number
  exportedAt: string
  exportedBy: string
  dateRange: {
    start: string | null
    end: string | null
  }
  filters: {
    analystId?: string
    findingId?: string
    types?: AuditEntryType[]
  }
  // For JSON export, includes the actual records
  records?: AuditEntry[]
  // For CSV export, includes the raw CSV content
  content?: string
}

/**
 * JSON export structure with full metadata
 */
export interface AuditExportJSON {
  exportedAt: string
  exportedBy: string
  dateRange: { start: string | null; end: string | null }
  filters: { analystId?: string; findingId?: string; types?: AuditEntryType[] }
  totalRecords: number
  records: AuditEntry[]
}

/**
 * Paginated query result
 */
export interface PaginatedAuditResult<T> {
  data: T[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

/**
 * Map an AuditEntry to CSV row format
 */
export function auditEntryToCsvRow(entry: AuditEntry): Record<string, string> {
  const baseRow = {
    type: entry.type,
    id: entry.id,
    timestamp: entry.timestamp,
    analyst_id: entry.analystId,
    finding_id: entry.findingId || '',
    message_id: entry.messageId || '',
  }

  if (entry.type === 'correction') {
    const data = entry.data as FindingCorrection
    return {
      ...baseRow,
      original_value: data.originalValue,
      corrected_value: data.correctedValue,
      correction_type: data.correctionType,
      action: '',
      reason: data.reason || '',
      source_document: data.originalSourceDocument || '',
      source_location: data.originalSourceLocation || '',
      user_source_reference: data.userSourceReference || '',
      validation_status: data.validationStatus,
    }
  }

  if (entry.type === 'validation') {
    const data = entry.data as ValidationFeedback
    return {
      ...baseRow,
      original_value: '',
      corrected_value: '',
      correction_type: '',
      action: data.action,
      reason: data.reason || '',
      source_document: '',
      source_location: '',
      user_source_reference: '',
      validation_status: '',
    }
  }

  // edit type
  const data = entry.data as ResponseEdit
  return {
    ...baseRow,
    original_value: data.originalText,
    corrected_value: data.editedText,
    correction_type: data.editType,
    action: '',
    reason: '',
    source_document: '',
    source_location: '',
    user_source_reference: '',
    validation_status: '',
  }
}

/**
 * CSV headers for audit export
 */
export const AUDIT_CSV_HEADERS = [
  'type',
  'id',
  'timestamp',
  'analyst_id',
  'finding_id',
  'message_id',
  'original_value',
  'corrected_value',
  'correction_type',
  'action',
  'reason',
  'source_document',
  'source_location',
  'user_source_reference',
  'validation_status',
] as const
