/**
 * Finding Validate API Route
 * Handles validation (confirm/reject) of individual findings
 * Story: E4.3 - Implement Inline Finding Validation (AC: 5)
 *
 * POST /api/projects/[id]/findings/[findingId]/validate
 * Body: { action: 'confirm' | 'reject' }
 * Response: { finding: Finding }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { Finding, FindingStatus, ValidationEvent } from '@/lib/types/findings'
import type { Json } from '@/lib/supabase/database.types'

// Request body validation schema
const ValidateRequestSchema = z.object({
  action: z.enum(['confirm', 'reject']),
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

    const { action } = parseResult.data

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

    // Calculate new values based on action
    const newStatus: FindingStatus = action === 'confirm' ? 'validated' : 'rejected'

    // Confidence adjustment: +5% on confirm, unchanged on reject (capped at 1.0)
    let newConfidence = existingFinding.confidence
    if (action === 'confirm' && newConfidence !== null) {
      newConfidence = Math.min(1, newConfidence + 0.05)
    } else if (action === 'confirm' && newConfidence === null) {
      // If no confidence, set to default + 5%
      newConfidence = 0.55 // 0.5 default + 0.05
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

    return NextResponse.json({ finding })
  } catch (err) {
    console.error('[api/findings/validate] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
