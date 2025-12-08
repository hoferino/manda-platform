/**
 * Finding Validate API Route
 * Handles validation (confirm/reject) of individual findings with feedback tracking
 * Story: E4.3 - Implement Inline Finding Validation (AC: 5)
 * Story: E7.2 - Track Validation/Rejection Feedback (AC: 2, 3, 4, 5, 7)
 *
 * POST /api/projects/[id]/findings/[findingId]/validate
 * Body: { action: 'confirm' | 'reject', reason?: string }
 * Response: { finding: Finding, newConfidence: number, feedbackId?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { Finding, FindingStatus, ValidationEvent } from '@/lib/types/findings'
import type { Json } from '@/lib/supabase/database.types'
import {
  recordValidation,
  recordRejection,
} from '@/lib/services/validation-feedback'

// Request body validation schema (E7.2: added reason support)
const ValidateRequestSchema = z.object({
  action: z.enum(['confirm', 'reject']),
  reason: z.string().optional(),
})

interface RouteContext {
  params: Promise<{ id: string; findingId: string }>
}

/**
 * POST /api/projects/[id]/findings/[findingId]/validate
 * Validate or reject a finding
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

    const parseResult = ValidateRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { action, reason } = parseResult.data

    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify user has access to this project (RLS will also enforce this)
    const { data: project, error: projectError } = await supabase
      .from('deals')
      .select('id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Fetch the current finding
    const { data: existingFinding, error: findingError } = await supabase
      .from('findings')
      .select('*')
      .eq('id', findingId)
      .eq('deal_id', projectId)
      .single()

    if (findingError || !existingFinding) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 })
    }

    // E7.2: Record validation/rejection feedback and get adjusted confidence
    const feedbackResult = action === 'confirm'
      ? await recordValidation(supabase, findingId, user.id, reason)
      : await recordRejection(supabase, findingId, user.id, reason)

    if (!feedbackResult) {
      console.error('[api/findings/validate] Failed to record feedback')
      // Continue with legacy behavior if feedback fails
    }

    // Calculate new values based on action
    const newStatus: FindingStatus = action === 'confirm' ? 'validated' : 'rejected'

    // E7.2: Use confidence from feedback service if available
    let newConfidence = feedbackResult?.newConfidence ?? existingFinding.confidence
    if (newConfidence === null) {
      // If no confidence, set to default
      newConfidence = 0.5
    }

    // Get current validation history
    const extendedFinding = existingFinding as typeof existingFinding & {
      status?: string
      validation_history?: Json
    }
    const currentHistory = (extendedFinding.validation_history as unknown as ValidationEvent[]) || []

    // Create new validation event
    const validationEvent: ValidationEvent = {
      action: action === 'confirm' ? 'validated' : 'rejected',
      timestamp: new Date().toISOString(),
      userId: user.id,
    }

    // Update the finding
    const { data: updatedFinding, error: updateError } = await supabase
      .from('findings')
      .update({
        status: newStatus,
        confidence: newConfidence,
        validation_history: [...currentHistory, validationEvent] as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq('id', findingId)
      .eq('deal_id', projectId)
      .select()
      .single()

    if (updateError) {
      console.error('[api/findings/validate] Error updating finding:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Transform to API response format
    const updatedExtended = updatedFinding as typeof updatedFinding & {
      status?: string
      validation_history?: Json
    }

    const finding: Finding = {
      id: updatedFinding.id,
      dealId: updatedFinding.deal_id,
      documentId: updatedFinding.document_id,
      chunkId: updatedFinding.chunk_id,
      userId: updatedFinding.user_id,
      text: updatedFinding.text,
      sourceDocument: updatedFinding.source_document,
      pageNumber: updatedFinding.page_number,
      confidence: updatedFinding.confidence,
      findingType: updatedFinding.finding_type,
      domain: updatedFinding.domain,
      status: (updatedExtended.status as FindingStatus) || 'pending',
      validationHistory: (updatedExtended.validation_history as unknown as ValidationEvent[]) || [],
      metadata: updatedFinding.metadata as Record<string, unknown> | null,
      createdAt: updatedFinding.created_at,
      updatedAt: updatedFinding.updated_at,
    }

    // E7.2: Include feedback info in response
    return NextResponse.json({
      finding,
      newConfidence: finding.confidence ?? 0.5,
      previousConfidence: feedbackResult?.previousConfidence,
      feedbackId: feedbackResult?.feedbackId,
      sourceFlagged: feedbackResult?.sourceFlagged,
    })
  } catch (err) {
    console.error('[api/findings/validate] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
