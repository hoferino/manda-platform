/**
 * IRL Items Reorder API Route
 * POST batch reorder items
 * Story: E6.2 - Implement IRL Creation and Editing
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { reorderIRLItems } from '@/lib/services/irls'
import { ReorderIRLItemsRequestSchema } from '@/lib/types/irl'

interface RouteContext {
  params: Promise<{ id: string; irlId: string }>
}

/**
 * POST /api/projects/[id]/irls/[irlId]/reorder
 * Batch reorder IRL items
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, irlId } = await context.params
    const body = await request.json()

    // Validate request body
    const parseResult = ReorderIRLItemsRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
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

    // Verify IRL exists and belongs to this project
    const { data: irl } = await supabase
      .from('irls')
      .select('deal_id')
      .eq('id', irlId)
      .single()

    if (!irl || irl.deal_id !== projectId) {
      return NextResponse.json({ error: 'IRL not found' }, { status: 404 })
    }

    // Verify all items belong to this IRL
    const itemIds = parseResult.data.items.map(item => item.id)
    const { data: existingItems, error: itemsError } = await supabase
      .from('irl_items')
      .select('id, irl_id')
      .in('id', itemIds)

    if (itemsError) {
      return NextResponse.json({ error: 'Failed to verify items' }, { status: 500 })
    }

    // Check all items belong to this IRL
    const invalidItems = existingItems?.filter(item => item.irl_id !== irlId) || []
    if (invalidItems.length > 0) {
      return NextResponse.json(
        { error: 'Some items do not belong to this IRL', invalidIds: invalidItems.map(i => i.id) },
        { status: 400 }
      )
    }

    // Check all requested items were found
    if ((existingItems?.length || 0) !== itemIds.length) {
      const foundIds = new Set(existingItems?.map(i => i.id) || [])
      const missingIds = itemIds.filter(id => !foundIds.has(id))
      return NextResponse.json(
        { error: 'Some items not found', missingIds },
        { status: 404 }
      )
    }

    // Reorder items
    const success = await reorderIRLItems(supabase, parseResult.data.items)

    if (!success) {
      return NextResponse.json({ error: 'Failed to reorder items' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in POST /api/projects/[id]/irls/[irlId]/reorder:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
