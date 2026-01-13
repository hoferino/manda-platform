/**
 * CIM API Route - List and Create
 * Handles GET (list) and POST (create) operations
 * Story: E9.1 - CIM Database Schema & Deal Integration
 * AC: #4 - Basic CRUD for CIM entities
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CreateCIMInputSchema, CIMListItem, mapDbRowToCIM, cimToListItem } from '@/lib/types/cim'
import { Database } from '@/lib/supabase/database.types'

type CIMRow = Database['public']['Tables']['cims']['Row']

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/projects/[id]/cims
 * Fetch paginated CIMs for a project
 * AC: #4 - Basic CRUD for CIM entities (List)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0)

    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify user has access to this project (RLS will enforce, but explicit check for 404)
    const { data: project, error: projectError } = await supabase
      .from('deals')
      .select('id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Build query
    const query = supabase
      .from('cims')
      .select('*', { count: 'exact' })
      .eq('deal_id', projectId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('[api/cims] Error fetching CIMs:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform database records to API response format
    const items: CIMListItem[] = (data || []).map((row) =>
      cimToListItem(mapDbRowToCIM(row as CIMRow))
    )

    const total = count || 0
    const hasMore = offset + items.length < total

    return NextResponse.json({
      items,
      total,
      limit,
      offset,
      hasMore,
    })
  } catch (err) {
    console.error('[api/cims] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[id]/cims
 * Create a new CIM for a project
 * AC: #4 - Basic CRUD for CIM entities (Create)
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params

    const body = await request.json()
    const parseResult = CreateCIMInputSchema.safeParse(body)

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

    // Verify user has access to this project
    const { data: project, error: projectError } = await supabase
      .from('deals')
      .select('id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get the next version number for this deal
    const { data: maxVersionResult } = await supabase
      .from('cims')
      .select('version')
      .eq('deal_id', projectId)
      .order('version', { ascending: false })
      .limit(1)
      .single()

    const nextVersion = (maxVersionResult?.version || 0) + 1

    // Create initial workflow state
    const workflowState = {
      current_phase: 'persona',
      current_section_index: null,
      current_slide_index: null,
      completed_phases: [],
      is_complete: false,
    }

    // Create the CIM with auto-incremented version
    const { data, error } = await supabase
      .from('cims')
      .insert({
        deal_id: projectId,
        title: input.title,
        version: nextVersion,
        user_id: user.id,
        workflow_state: workflowState,
        buyer_persona: null,
        investment_thesis: null,
        outline: [],
        slides: [],
        dependency_graph: { dependencies: {}, references: {} },
        conversation_history: [],
      })
      .select('*')
      .single()

    if (error) {
      console.error('[api/cims] Error creating CIM:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const cim = mapDbRowToCIM(data as CIMRow)

    return NextResponse.json({ cim }, { status: 201 })
  } catch (err) {
    console.error('[api/cims] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
