/**
 * Review Queue Item API Endpoints
 *
 * DELETE /api/projects/[id]/review-queue/[itemId] - Dismiss/clear review flag
 * Story: E7.6 - Propagate Corrections to Related Insights (AC: #4)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { clearReviewFlagForItem } from '@/lib/services/correction-propagation'

interface RouteContext {
  params: Promise<{ id: string; itemId: string }>
}

/**
 * DELETE /api/projects/[id]/review-queue/[itemId]
 * Dismisses a review queue item (clears the needs_review flag)
 *
 * Request body:
 * - type: 'finding' | 'qa_answer' | 'cim_section' | 'insight' (required)
 * - reason?: string (optional reason for dismissal)
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { id: dealId, itemId } = await context.params
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user has access to this deal
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('id, user_id')
      .eq('id', dealId)
      .single()

    if (dealError || !deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    if (deal.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { type, reason } = body as {
      type: 'finding' | 'qa_answer' | 'cim_section' | 'insight'
      reason?: string
    }

    if (!type || !['finding', 'qa_answer', 'cim_section', 'insight'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid or missing type parameter' },
        { status: 400 }
      )
    }

    // Clear the review flag
    const success = await clearReviewFlagForItem(supabase, itemId, type)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to dismiss review item' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Review item dismissed',
      itemId,
      type,
      dismissedBy: user.id,
      reason: reason ?? null,
    })
  } catch (error) {
    console.error('[review-queue] Error dismissing item:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
