/**
 * Single IRL API Route
 * GET/PUT/DELETE operations for a specific IRL
 * Story: E6.2 - Implement IRL Creation and Editing
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getIRLWithItems, updateIRL, deleteIRL } from '@/lib/services/irls'
import { UpdateIRLRequestSchema } from '@/lib/types/irl'

interface RouteContext {
  params: Promise<{ id: string; irlId: string }>
}

/**
 * GET /api/projects/[id]/irls/[irlId]
 * Get a single IRL with all its items
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

    // Get IRL with items
    const irlWithItems = await getIRLWithItems(supabase, irlId)

    if (!irlWithItems) {
      return NextResponse.json({ error: 'IRL not found' }, { status: 404 })
    }

    // Verify IRL belongs to this project
    if (irlWithItems.dealId !== projectId) {
      return NextResponse.json({ error: 'IRL not found' }, { status: 404 })
    }

    return NextResponse.json(irlWithItems)
  } catch (error) {
    console.error('Error in GET /api/projects/[id]/irls/[irlId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/projects/[id]/irls/[irlId]
 * Update IRL metadata (title)
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, irlId } = await context.params
    const body = await request.json()

    // Validate request body
    const parseResult = UpdateIRLRequestSchema.safeParse(body)
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
    const { data: existingIRL } = await supabase
      .from('irls')
      .select('deal_id')
      .eq('id', irlId)
      .single()

    if (!existingIRL || existingIRL.deal_id !== projectId) {
      return NextResponse.json({ error: 'IRL not found' }, { status: 404 })
    }

    // Update IRL
    const updatedIRL = await updateIRL(supabase, irlId, parseResult.data)

    if (!updatedIRL) {
      return NextResponse.json({ error: 'Failed to update IRL' }, { status: 500 })
    }

    return NextResponse.json(updatedIRL)
  } catch (error) {
    console.error('Error in PUT /api/projects/[id]/irls/[irlId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/[id]/irls/[irlId]
 * Delete an IRL (cascades to items)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
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
    const { data: existingIRL } = await supabase
      .from('irls')
      .select('deal_id')
      .eq('id', irlId)
      .single()

    if (!existingIRL || existingIRL.deal_id !== projectId) {
      return NextResponse.json({ error: 'IRL not found' }, { status: 404 })
    }

    // Delete IRL
    const deleted = await deleteIRL(supabase, irlId)

    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete IRL' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/projects/[id]/irls/[irlId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
