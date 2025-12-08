/**
 * Finding Reject API Route
 * Dedicated endpoint for rejecting findings with optional reason
 * Story: E7.2 - Track Validation/Rejection Feedback (AC: 3, 5, 6)
 *
 * POST /api/projects/[id]/findings/[findingId]/reject
 * Body: { reason?: string }
 * Response: { success: boolean, newConfidence: number, feedbackId: string, sourceFlagged?: boolean }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { recordRejection } from '@/lib/services/validation-feedback'

// Request body validation schema
const RejectRequestSchema = z.object({
  reason: z.string().optional(),
})

interface RouteContext {
  params: Promise<{ id: string; findingId: string }>
}

/**
 * POST /api/projects/[id]/findings/[findingId]/reject
 * Reject a finding with optional reason
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, findingId } = await context.params

    // Validate request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      // Empty body is fine for rejections without reason
      body = {}
    }

    const parseResult = RejectRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { reason } = parseResult.data

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

    // Verify finding exists and belongs to project
    const { data: finding, error: findingError } = await supabase
      .from('findings')
      .select('id, deal_id')
      .eq('id', findingId)
      .eq('deal_id', projectId)
      .single()

    if (findingError || !finding) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 })
    }

    // Record rejection feedback
    const result = await recordRejection(supabase, findingId, user.id, reason)

    if (!result) {
      return NextResponse.json({ error: 'Failed to record rejection' }, { status: 500 })
    }

    // Update finding status to rejected
    await supabase
      .from('findings')
      .update({
        status: 'rejected',
        confidence: result.newConfidence,
        updated_at: new Date().toISOString(),
      })
      .eq('id', findingId)

    return NextResponse.json({
      success: true,
      newConfidence: result.newConfidence,
      previousConfidence: result.previousConfidence,
      feedbackId: result.feedbackId,
      sourceFlagged: result.sourceFlagged,
      sourceFlaggedReason: result.sourceFlaggedReason,
    })
  } catch (err) {
    console.error('[api/findings/reject] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
