/**
 * Finding Correction API Route
 * Story: E7.1 - Implement Finding Correction via Chat
 * AC: #2, #3, #5, #6, #11-16
 *
 * POST /api/projects/[id]/findings/[findingId]/correct - Correct a finding
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import {
  correctFinding,
  validateCorrectionRequest,
} from '@/lib/services/corrections'
import { propagateCorrection, generateImpactSummary } from '@/lib/services/correction-propagation'
import {
  executeSourceErrorCascade,
  buildSourceDocumentImpact,
} from '@/lib/services/source-error-cascade'
import { CreateCorrectionRequest, ValidationStatus, CorrectionType } from '@/lib/types/feedback'

interface RouteContext {
  params: Promise<{ id: string; findingId: string }>
}

// Request body validation schema
const CorrectFindingSchema = z.object({
  originalValue: z.string().min(1, 'Original value is required'),
  correctedValue: z.string().min(1, 'Corrected value is required'),
  correctionType: z.enum(['value', 'source', 'confidence', 'text']).default('text'),
  reason: z.string().optional(),
  userSourceReference: z.string().optional(),
  validationStatus: z.enum([
    'pending',
    'confirmed_with_source',
    'override_without_source',
    'source_error',
  ]).default('override_without_source'),
})

/**
 * POST /api/projects/[id]/findings/[findingId]/correct
 * Correct a finding with full audit trail and propagation
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, findingId } = await context.params

    // Validate request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parseResult = CorrectFindingSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const {
      originalValue,
      correctedValue,
      correctionType,
      reason,
      userSourceReference,
      validationStatus,
    } = parseResult.data

    // Validate values are different
    if (originalValue === correctedValue) {
      return NextResponse.json(
        { error: 'Corrected value must differ from original value' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify user has access to this project
    const { data: project, error: projectError } = await supabase
      .from('deals')
      .select('id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Verify finding exists in this project
    const { data: finding, error: findingError } = await supabase
      .from('findings')
      .select('id, document_id')
      .eq('id', findingId)
      .eq('deal_id', projectId)
      .single()

    if (findingError || !finding) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 })
    }

    // Build correction request
    const correctionRequest: CreateCorrectionRequest = {
      findingId,
      originalValue,
      correctedValue,
      correctionType: correctionType as CorrectionType,
      reason,
      userSourceReference,
      validationStatus: validationStatus as ValidationStatus,
    }

    // Validate request
    const validation = validateCorrectionRequest(correctionRequest)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // 1. Create the correction (AC: #2, #3)
    const correctionResult = await correctFinding(supabase, correctionRequest, user.id)
    if (!correctionResult) {
      return NextResponse.json(
        { error: 'Failed to create correction' },
        { status: 500 }
      )
    }

    // 2. Propagate to dependent insights (AC: #5)
    const propagationReason = `Source finding corrected: ${originalValue} → ${correctedValue}`
    const propagationResult = await propagateCorrection(supabase, findingId, propagationReason)
    correctionResult.dependentInsights = propagationResult.dependentInsights

    // 3. Handle source_error cascade if applicable (AC: #12-16)
    if (validationStatus === 'source_error' && finding.document_id) {
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

    // Build response
    const impactSummary = generateImpactSummary(propagationResult)

    return NextResponse.json({
      success: true,
      correction: {
        id: correctionResult.correction.id,
        findingId: correctionResult.correction.findingId,
        originalValue: correctionResult.correction.originalValue,
        correctedValue: correctionResult.correction.correctedValue,
        correctionType: correctionResult.correction.correctionType,
        validationStatus: correctionResult.correction.validationStatus,
        createdAt: correctionResult.correction.createdAt,
      },
      impact: {
        dependentCount: propagationResult.dependentCount,
        flaggedCount: propagationResult.flaggedCount,
        summary: impactSummary,
        dependentInsights: correctionResult.dependentInsights,
      },
      sourceDocumentImpact: correctionResult.sourceDocumentImpact,
    })
  } catch (err) {
    console.error('[api/findings/[findingId]/correct] POST Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
