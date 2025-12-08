/**
 * Regeneration API Endpoint
 *
 * POST /api/projects/[id]/review-queue/[itemId]/regenerate - Trigger regeneration
 * Story: E7.6 - Propagate Corrections to Related Insights (AC: #4)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  regenerateQAAnswer,
  regenerateCIMSection,
} from '@/lib/services/regeneration'

interface RouteContext {
  params: Promise<{ id: string; itemId: string }>
}

/**
 * POST /api/projects/[id]/review-queue/[itemId]/regenerate
 * Triggers regeneration of a Q&A answer or CIM section
 *
 * Request body:
 * - type: 'qa_answer' | 'cim_section' (required)
 * - autoApply?: boolean (if true, automatically applies the regenerated content)
 */
export async function POST(
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
    const { type, autoApply } = body as {
      type: 'qa_answer' | 'cim_section'
      autoApply?: boolean
    }

    if (!type || !['qa_answer', 'cim_section'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid or missing type parameter. Must be qa_answer or cim_section' },
        { status: 400 }
      )
    }

    // Trigger regeneration based on type
    let result
    if (type === 'qa_answer') {
      result = await regenerateQAAnswer(supabase, itemId, dealId, { autoApply })
    } else {
      result = await regenerateCIMSection(supabase, itemId, dealId, { autoApply })
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Regeneration failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      itemId: result.itemId,
      itemType: result.itemType,
      previousContent: result.previousContent,
      newContent: result.newContent,
      regeneratedAt: result.regeneratedAt,
      message: `${type === 'qa_answer' ? 'Q&A answer' : 'CIM section'} regeneration triggered successfully`,
    })
  } catch (error) {
    console.error('[regenerate] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
