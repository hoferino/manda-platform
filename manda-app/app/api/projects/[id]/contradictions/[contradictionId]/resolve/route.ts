/**
 * Contradiction Resolve API Route
 * Handles resolution of contradictions (accept_a, accept_b, investigate, noted)
 * Story: E4.6 - Build Contradictions View (AC: #4, #5, #6, #7, #9)
 *
 * POST /api/projects/[id]/contradictions/[contradictionId]/resolve
 * Body: { action: 'accept_a' | 'accept_b' | 'investigate' | 'noted', note?: string }
 * Response: { contradiction: Contradiction }
 *
 * Side effects:
 * - accept_a: Finding A → validated, Finding B → rejected
 * - accept_b: Finding A → rejected, Finding B → validated
 * - investigate: Status → investigating (no finding changes)
 * - noted: Status → noted (no finding changes)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type {
  Contradiction,
  ContradictionStatus,
  ContradictionResolutionAction,
} from '@/lib/types/contradictions'
import type { ValidationEvent, FindingStatus } from '@/lib/types/findings'
import type { Json } from '@/lib/supabase/database.types'

// Request body validation schema
const ResolveRequestSchema = z.object({
  action: z.enum(['accept_a', 'accept_b', 'investigate', 'noted']),
  note: z.string().optional(),
})

interface RouteContext {
  params: Promise<{ id: string; contradictionId: string }>
}

/**
 * POST /api/projects/[id]/contradictions/[contradictionId]/resolve
 * Resolve a contradiction with the specified action
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, contradictionId } = await context.params

    // Validate request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parseResult = ResolveRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { action, note } = parseResult.data

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

    // Fetch the existing contradiction
    const { data: existingContradiction, error: contradictionError } = await supabase
      .from('contradictions')
      .select('*')
      .eq('id', contradictionId)
      .eq('deal_id', projectId)
      .single()

    if (contradictionError || !existingContradiction) {
      return NextResponse.json({ error: 'Contradiction not found' }, { status: 404 })
    }

    // Determine new contradiction status based on action
    const newStatus: ContradictionStatus =
      action === 'accept_a' || action === 'accept_b'
        ? 'resolved'
        : action === 'investigate'
          ? 'investigating'
          : 'noted'

    const now = new Date().toISOString()

    // Start transaction-like updates
    // 1. Update the contradiction
    const { data: updatedContradiction, error: updateError } = await supabase
      .from('contradictions')
      .update({
        status: newStatus,
        resolution: action,
        resolution_note: note || existingContradiction.resolution_note,
        resolved_at: now,
        resolved_by: user.id,
      })
      .eq('id', contradictionId)
      .eq('deal_id', projectId)
      .select()
      .single()

    if (updateError) {
      console.error('[api/contradictions/resolve] Error updating contradiction:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // 2. If accept_a or accept_b, update finding statuses
    if (action === 'accept_a' || action === 'accept_b') {
      const acceptedFindingId =
        action === 'accept_a'
          ? existingContradiction.finding_a_id
          : existingContradiction.finding_b_id
      const rejectedFindingId =
        action === 'accept_a'
          ? existingContradiction.finding_b_id
          : existingContradiction.finding_a_id

      // Fetch both findings to get their validation history
      const { data: findings, error: findingsError } = await supabase
        .from('findings')
        .select('*')
        .in('id', [acceptedFindingId, rejectedFindingId])

      if (findingsError) {
        console.error('[api/contradictions/resolve] Error fetching findings:', findingsError)
        // Continue - contradiction is updated but findings may not be
      } else if (findings) {
        // Update each finding
        for (const finding of findings) {
          const isAccepted = finding.id === acceptedFindingId
          const newFindingStatus: FindingStatus = isAccepted ? 'validated' : 'rejected'

          // Get existing validation history
          const extendedFinding = finding as typeof finding & {
            status?: string | null
            validation_history?: Json
          }
          const currentHistory =
            (extendedFinding.validation_history as unknown as ValidationEvent[]) || []

          // Create new validation event
          const validationEvent: ValidationEvent = {
            action: isAccepted ? 'validated' : 'rejected',
            timestamp: now,
            userId: user.id,
          }

          // Update the finding
          const { error: findingUpdateError } = await supabase
            .from('findings')
            .update({
              status: newFindingStatus,
              validation_history: [...currentHistory, validationEvent] as unknown as Json,
              updated_at: now,
            })
            .eq('id', finding.id)

          if (findingUpdateError) {
            console.error(
              `[api/contradictions/resolve] Error updating finding ${finding.id}:`,
              findingUpdateError
            )
            // Continue - log error but don't fail the whole operation
          }
        }
      }
    }

    // Transform response
    const contradiction: Contradiction = {
      id: updatedContradiction.id,
      dealId: updatedContradiction.deal_id,
      findingAId: updatedContradiction.finding_a_id,
      findingBId: updatedContradiction.finding_b_id,
      confidence: updatedContradiction.confidence,
      status: (updatedContradiction.status as ContradictionStatus) || 'unresolved',
      resolution: updatedContradiction.resolution as ContradictionResolutionAction | null,
      resolutionNote: updatedContradiction.resolution_note,
      detectedAt: updatedContradiction.detected_at,
      resolvedAt: updatedContradiction.resolved_at,
      resolvedBy: updatedContradiction.resolved_by,
      metadata: updatedContradiction.metadata as Record<string, unknown> | null,
    }

    return NextResponse.json({ contradiction })
  } catch (err) {
    console.error('[api/contradictions/resolve] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
