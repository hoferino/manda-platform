/**
 * CIM API Route - Single CIM operations
 * Handles GET (read), PUT (update), and DELETE operations for a specific CIM
 * Story: E9.1 - CIM Database Schema & Deal Integration
 * AC: #4 - Basic CRUD for CIM entities
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UpdateCIMInputSchema, mapDbRowToCIM, UpdateCIMInput } from '@/lib/types/cim'
import { Database, Json } from '@/lib/supabase/database.types'

type CIMRow = Database['public']['Tables']['cims']['Row']

/**
 * Build update data with proper Json casting
 */
function buildCIMUpdateData(input: UpdateCIMInput): Record<string, Json | string | null> {
  const updateData: Record<string, Json | string | null> = {}
  if (input.title !== undefined) updateData.title = input.title
  if (input.workflowState !== undefined) updateData.workflow_state = input.workflowState as unknown as Json
  if (input.buyerPersona !== undefined) updateData.buyer_persona = input.buyerPersona as unknown as Json
  if (input.investmentThesis !== undefined) updateData.investment_thesis = input.investmentThesis
  if (input.outline !== undefined) updateData.outline = input.outline as unknown as Json
  if (input.slides !== undefined) updateData.slides = input.slides as unknown as Json
  if (input.dependencyGraph !== undefined) updateData.dependency_graph = input.dependencyGraph as unknown as Json
  if (input.conversationHistory !== undefined) updateData.conversation_history = input.conversationHistory as unknown as Json
  return updateData
}

interface RouteContext {
  params: Promise<{ id: string; cimId: string }>
}

/**
 * GET /api/projects/[id]/cims/[cimId]
 * Fetch a single CIM by ID
 * AC: #4 - Basic CRUD for CIM entities (Read)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, cimId } = await context.params

    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Fetch the CIM (RLS will enforce access control)
    const { data, error } = await supabase
      .from('cims')
      .select('*')
      .eq('id', cimId)
      .eq('deal_id', projectId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'CIM not found' }, { status: 404 })
      }
      console.error('[api/cims] Error fetching CIM:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'CIM not found' }, { status: 404 })
    }

    const cim = mapDbRowToCIM(data as CIMRow)

    return NextResponse.json({ cim })
  } catch (err) {
    console.error('[api/cims] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/projects/[id]/cims/[cimId]
 * Update a CIM
 * AC: #4 - Basic CRUD for CIM entities (Update)
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, cimId } = await context.params

    const body = await request.json()
    const parseResult = UpdateCIMInputSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const input = parseResult.data

    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify CIM exists and belongs to the project
    const { data: existingCIM, error: fetchError } = await supabase
      .from('cims')
      .select('id')
      .eq('id', cimId)
      .eq('deal_id', projectId)
      .single()

    if (fetchError || !existingCIM) {
      return NextResponse.json({ error: 'CIM not found' }, { status: 404 })
    }

    // Build update data with proper Json casting
    const updateData = buildCIMUpdateData(input)

    if (Object.keys(updateData).length === 0) {
      // No actual updates, fetch and return current state
      const { data, error } = await supabase
        .from('cims')
        .select('*')
        .eq('id', cimId)
        .single()

      if (error || !data) {
        return NextResponse.json({ error: 'CIM not found' }, { status: 404 })
      }

      return NextResponse.json({ cim: mapDbRowToCIM(data as CIMRow) })
    }

    // Update the CIM
    const { data, error } = await supabase
      .from('cims')
      .update(updateData)
      .eq('id', cimId)
      .eq('deal_id', projectId)
      .select('*')
      .single()

    if (error) {
      console.error('[api/cims] Error updating CIM:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'CIM not found' }, { status: 404 })
    }

    const cim = mapDbRowToCIM(data as CIMRow)

    return NextResponse.json({ cim })
  } catch (err) {
    console.error('[api/cims] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/[id]/cims/[cimId]
 * Delete a CIM
 * AC: #4 - Basic CRUD for CIM entities (Delete)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, cimId } = await context.params

    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Delete the CIM (RLS will enforce access control)
    const { error } = await supabase
      .from('cims')
      .delete()
      .eq('id', cimId)
      .eq('deal_id', projectId)

    if (error) {
      console.error('[api/cims] Error deleting CIM:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('[api/cims] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
