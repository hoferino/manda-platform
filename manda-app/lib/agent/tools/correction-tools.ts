/**
 * Correction Tools
 *
 * Agent tools for correcting findings via chat with source validation.
 * Story: E7.1 - Implement Finding Correction via Chat
 *
 * Tools:
 * - correct_finding (AC: #1-4) - Correct a finding with audit trail
 * - get_finding_source (AC: #8, #10) - Get original source before correction
 * - get_correction_history (AC: #3) - View correction audit trail
 */

import { tool } from '@langchain/core/tools'
import { createClient } from '@/lib/supabase/server'
import {
  CorrectFindingInputSchema,
  GetFindingSourceInputSchema,
  GetCorrectionHistoryInputSchema,
} from '../schemas'
import { formatToolResponse, handleToolError } from './utils'
import {
  correctFinding,
  getOriginalSource,
  getCorrectionHistory,
  isSourceValidationEnabled,
} from '@/lib/services/corrections'
import { propagateCorrection, generateImpactSummary } from '@/lib/services/correction-propagation'
import {
  executeSourceErrorCascade,
  buildSourceDocumentImpact,
} from '@/lib/services/source-error-cascade'
import { CreateCorrectionRequest, CorrectionWithImpact } from '@/lib/types/feedback'

/**
 * correct_finding
 *
 * Corrects a finding with full audit trail and propagation.
 * Handles source validation flow and source error cascade.
 *
 * AC: #1 - Agent detects correction intent
 * AC: #2 - Finding updated in PostgreSQL
 * AC: #3 - Original value stored with audit trail
 * AC: #4 - Agent confirms with original and new values
 * AC: #5 - Related insights flagged for review
 * AC: #6 - Agent reports affected items
 */
export const correctFindingTool = tool(
  async (input) => {
    try {
      const {
        findingId,
        originalValue,
        correctedValue,
        correctionType,
        reason,
        userSourceReference,
        validationStatus,
      } = input

      const supabase = await createClient()

      // Authenticate user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !user) {
        return formatToolResponse(false, 'Authentication required')
      }

      // Build correction request
      const request: CreateCorrectionRequest = {
        findingId,
        originalValue,
        correctedValue,
        correctionType,
        reason,
        userSourceReference,
        validationStatus,
      }

      // 1. Create the correction (AC: #2, #3)
      const correctionResult = await correctFinding(supabase, request, user.id)
      if (!correctionResult) {
        return formatToolResponse(false, 'Failed to create correction. Finding may not exist.')
      }

      // 2. Propagate to dependent insights (AC: #5)
      const propagationReason = `Source finding corrected: ${originalValue} → ${correctedValue}`
      const propagationResult = await propagateCorrection(supabase, findingId, propagationReason)
      correctionResult.dependentInsights = propagationResult.dependentInsights

      // 3. Handle source_error cascade if applicable (AC: #12-16)
      if (validationStatus === 'source_error') {
        // Get document ID from finding
        const { data: finding } = await supabase
          .from('findings')
          .select('document_id')
          .eq('id', findingId)
          .single()

        if (finding?.document_id) {
          const cascadeResult = await executeSourceErrorCascade(
            supabase,
            findingId,
            correctedValue,
            finding.document_id,
            reason || `Value incorrect: ${originalValue} should be ${correctedValue}`
          )

          if (cascadeResult.success) {
            correctionResult.sourceDocumentImpact = buildSourceDocumentImpact(cascadeResult)
          }
        }
      }

      // 4. Build response message (AC: #4, #6)
      const impactSummary = generateImpactSummary(propagationResult)
      let message = `I've corrected the finding from "${originalValue}" to "${correctedValue}".`

      if (correctionResult.correction.originalSourceDocument) {
        message += ` The original value was from ${correctionResult.correction.originalSourceDocument}`
        if (correctionResult.correction.originalSourceLocation) {
          message += ` (${correctionResult.correction.originalSourceLocation})`
        }
        message += '.'
      }

      if (userSourceReference) {
        message += ` Your source: "${userSourceReference}".`
      }

      if (propagationResult.dependentCount > 0) {
        message += ` ${impactSummary}`
      }

      if (correctionResult.sourceDocumentImpact) {
        const impact = correctionResult.sourceDocumentImpact
        message += ` The source document "${impact.documentName}" has been marked as containing errors.`
        if (impact.findingsFlaggedForReview > 0) {
          message += ` ${impact.findingsFlaggedForReview} other findings from this document are now flagged for review.`
        }
      }

      return formatToolResponse(true, {
        message,
        correction: {
          id: correctionResult.correction.id,
          findingId: correctionResult.correction.findingId,
          originalValue: correctionResult.correction.originalValue,
          correctedValue: correctionResult.correction.correctedValue,
          validationStatus: correctionResult.correction.validationStatus,
        },
        dependentCount: propagationResult.dependentCount,
        flaggedCount: propagationResult.flaggedCount,
        sourceDocumentFlagged: !!correctionResult.sourceDocumentImpact,
      })
    } catch (err) {
      return handleToolError(err, 'correct_finding')
    }
  },
  {
    name: 'correct_finding',
    description: `Correct a finding in the knowledge base with full audit trail.
Use this when the user wants to correct an incorrect finding value.
The tool will update the finding, create an audit record, and flag any dependent insights for review.

Example user input: "The revenue should be $50M, not $45M"
Example validationStatus values:
- confirmed_with_source: User provided alternative source
- override_without_source: User confirmed without source
- source_error: The original source document itself is wrong`,
    schema: CorrectFindingInputSchema,
  }
)

/**
 * get_finding_source
 *
 * Retrieves the original source citation for a finding.
 * Used to display source before accepting corrections.
 *
 * AC: #8 - Display original source document and location
 * AC: #10 - User can request "Show Source" to view context
 */
export const getFindingSourceTool = tool(
  async (input) => {
    try {
      const { findingId } = input

      const supabase = await createClient()

      // Authenticate user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !user) {
        return formatToolResponse(false, 'Authentication required')
      }

      // Get source citation
      const sourceResult = await getOriginalSource(supabase, findingId)

      if (!sourceResult.found || !sourceResult.citation) {
        return formatToolResponse(true, {
          message: 'Could not find source information for this finding.',
          found: false,
        })
      }

      const citation = sourceResult.citation
      return formatToolResponse(true, {
        message: `This finding was extracted from "${citation.documentName}" at ${citation.location}. The original extracted value was: "${citation.extractedValue}"`,
        found: true,
        source: {
          documentId: citation.documentId,
          documentName: citation.documentName,
          location: citation.location,
          extractedValue: citation.extractedValue,
        },
      })
    } catch (err) {
      return handleToolError(err, 'get_finding_source')
    }
  },
  {
    name: 'get_finding_source',
    description: `Get the original source citation for a finding.
Use this before accepting a correction to show the user where the value came from.
Returns the source document name, location (page/cell), and the originally extracted value.`,
    schema: GetFindingSourceInputSchema,
  }
)

/**
 * get_correction_history
 *
 * Retrieves the correction history for a finding.
 *
 * AC: #3 - Original value stored with analyst_id and timestamp
 */
export const getCorrectionHistoryTool = tool(
  async (input) => {
    try {
      const { findingId, limit } = input

      const supabase = await createClient()

      // Authenticate user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !user) {
        return formatToolResponse(false, 'Authentication required')
      }

      const history = await getCorrectionHistory(supabase, findingId, limit)

      if (history.length === 0) {
        return formatToolResponse(true, {
          message: 'No corrections have been made to this finding.',
          corrections: [],
          total: 0,
        })
      }

      const message = `Found ${history.length} correction(s) for this finding:`
      const corrections = history.map((c) => ({
        id: c.id,
        originalValue: c.originalValue,
        correctedValue: c.correctedValue,
        correctionType: c.correctionType,
        reason: c.reason,
        validationStatus: c.validationStatus,
        createdAt: c.createdAt,
      }))

      return formatToolResponse(true, {
        message,
        corrections,
        total: history.length,
      })
    } catch (err) {
      return handleToolError(err, 'get_correction_history')
    }
  },
  {
    name: 'get_correction_history',
    description: `Get the correction history for a finding.
Returns all past corrections with timestamps, original/corrected values, and reasons.
Useful for audit trail and understanding how a finding has evolved.`,
    schema: GetCorrectionHistoryInputSchema,
  }
)

// Export all correction tools
export const correctionTools = [
  correctFindingTool,
  getFindingSourceTool,
  getCorrectionHistoryTool,
]
