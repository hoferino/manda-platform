/**
 * Single IRL Item API Route
 * GET/PUT/DELETE operations for a specific IRL item
 * Story: E6.2 - Implement IRL Creation and Editing
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getIRLItem, updateIRLItem, deleteIRLItem, updateIRLProgressPercent } from '@/lib/services/irls'
import { UpdateIRLItemRequestSchema } from '@/lib/types/irl'

interface RouteContext {
  params: Promise<{ id: string; irlId: string; itemId: string }>
}

/**
 * GET /api/projects/[id]/irls/[irlId]/items/[itemId]
 * Get a single IRL item
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, irlId, itemId } = await context.params

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

    // Get item
    const item = await getIRLItem(supabase, itemId)

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Verify item belongs to the specified IRL
    if (item.irlId !== irlId) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    return NextResponse.json(item)
  } catch (error) {
    console.error('Error in GET /api/projects/[id]/irls/[irlId]/items/[itemId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/projects/[id]/irls/[irlId]/items/[itemId]
 * Update an IRL item
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, irlId, itemId } = await context.params
    const body = await request.json()

    // Validate request body
    const parseResult = UpdateIRLItemRequestSchema.safeParse(body)
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

    // Verify item exists and belongs to this IRL
    const existingItem = await getIRLItem(supabase, itemId)

    if (!existingItem || existingItem.irlId !== irlId) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Update item
    const updatedItem = await updateIRLItem(supabase, itemId, parseResult.data)

    if (!updatedItem) {
      return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
    }

    // If status was updated, recalculate IRL progress
    if (parseResult.data.status !== undefined) {
      await updateIRLProgressPercent(supabase, irlId)
    }

    return NextResponse.json(updatedItem)
  } catch (error) {
    console.error('Error in PUT /api/projects/[id]/irls/[irlId]/items/[itemId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/[id]/irls/[irlId]/items/[itemId]
 * Delete an IRL item
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, irlId, itemId } = await context.params

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

    // Verify item exists and belongs to this IRL
    const existingItem = await getIRLItem(supabase, itemId)

    if (!existingItem || existingItem.irlId !== irlId) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Delete item
    const deleted = await deleteIRLItem(supabase, itemId)

    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
    }

    // Recalculate IRL progress after deletion
    await updateIRLProgressPercent(supabase, irlId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/projects/[id]/irls/[irlId]/items/[itemId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
