/**
 * IRL Items API Route
 * GET all items, POST new item
 * Story: E6.2 - Implement IRL Creation and Editing
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getIRLItemsByCategory, createIRLItem } from '@/lib/services/irls'
import { CreateIRLItemRequestSchema } from '@/lib/types/irl'

interface RouteContext {
  params: Promise<{ id: string; irlId: string }>
}

/**
 * GET /api/projects/[id]/irls/[irlId]/items
 * Get all items for an IRL
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, irlId } = await context.params

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

    // Get items grouped by category
    const itemsByCategory = await getIRLItemsByCategory(supabase, irlId)

    // Also return flat list for convenience
    const allItems = Object.values(itemsByCategory).flat()

    return NextResponse.json({
      items: allItems,
      byCategory: itemsByCategory,
    })
  } catch (error) {
    console.error('Error in GET /api/projects/[id]/irls/[irlId]/items:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[id]/irls/[irlId]/items
 * Create a new IRL item
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, irlId } = await context.params
    const body = await request.json()

    // Validate request body
    const parseResult = CreateIRLItemRequestSchema.safeParse(body)
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

    // Create item
    const newItem = await createIRLItem(supabase, irlId, parseResult.data)

    if (!newItem) {
      return NextResponse.json({ error: 'Failed to create item' }, { status: 500 })
    }

    return NextResponse.json(newItem, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/projects/[id]/irls/[irlId]/items:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
