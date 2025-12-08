/**
 * Review Queue API Endpoints
 *
 * GET /api/projects/[id]/review-queue - Get items needing review
 * Story: E7.6 - Propagate Corrections to Related Insights (AC: #3)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getReviewQueueItems,
  getReviewQueueCount,
  type ReviewQueueItem,
  type ReviewQueueCount,
} from '@/lib/services/correction-propagation'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/projects/[id]/review-queue
 * Returns items flagged for review after corrections
 *
 * Query params:
 * - type: 'finding' | 'qa_answer' | 'cim_section' | 'insight' (optional)
 * - limit: number (default 50)
 * - offset: number (default 0)
 * - countOnly: boolean (if true, only returns counts)
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { id: dealId } = await context.params
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

    // Parse query params
    const { searchParams } = new URL(request.url)
    const countOnly = searchParams.get('countOnly') === 'true'
    const typeFilter = searchParams.get('type') as
      | 'finding'
      | 'qa_answer'
      | 'cim_section'
      | 'insight'
      | null
    const limit = parseInt(searchParams.get('limit') ?? '50', 10)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)

    // If countOnly, just return counts
    if (countOnly) {
      const counts: ReviewQueueCount = await getReviewQueueCount(supabase, dealId)
      return NextResponse.json({
        success: true,
        counts,
      })
    }

    // Get review queue items
    const result = await getReviewQueueItems(supabase, dealId, {
      type: typeFilter ?? undefined,
      limit,
      offset,
    })

    return NextResponse.json({
      success: true,
      items: result.items,
      total: result.total,
      limit,
      offset,
      hasMore: offset + result.items.length < result.total,
    })
  } catch (error) {
    console.error('[review-queue] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
