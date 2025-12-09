/**
 * Q&A API Route - List and Create
 * Handles GET (list with filters) and POST (create) operations
 * Story: E8.1 - Q&A Data Model and CRUD API
 * AC: #1 (POST returns 201), #2 (GET with filters)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  CreateQAItemInputSchema,
  QAFiltersSchema,
  QAItem,
  mapDbRowToQAItem,
} from '@/lib/types/qa'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/projects/[id]/qa
 * Fetch paginated Q&A items for a project with optional filters
 * AC: #2 - Returns list filtered by category, priority, and status query params
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())

    // Validate query parameters
    const parseResult = QAFiltersSchema.safeParse(searchParams)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { category, priority, status, limit, offset } = parseResult.data

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
    let query = supabase
      .from('qa_items')
      .select('*', { count: 'exact' })
      .eq('deal_id', projectId)
      .order('date_added', { ascending: false })

    // Apply filters
    if (category) {
      query = query.eq('category', category)
    }

    if (priority) {
      query = query.eq('priority', priority)
    }

    if (status === 'pending') {
      query = query.is('date_answered', null)
    } else if (status === 'answered') {
      query = query.not('date_answered', 'is', null)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('[api/qa] Error fetching Q&A items:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform database records to API response format
    const items: QAItem[] = (data || []).map((row) => mapDbRowToQAItem(row))

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
    console.error('[api/qa] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[id]/qa
 * Create a new Q&A item
 * AC: #1 - Returns 201 with QAItem including generated id and timestamps
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params

    const body = await request.json()
    const parseResult = CreateQAItemInputSchema.safeParse(body)

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

    // Validate source_finding_id if provided
    if (input.sourceFindingId) {
      const { data: finding, error: findingError } = await supabase
        .from('findings')
        .select('id')
        .eq('id', input.sourceFindingId)
        .eq('deal_id', projectId)
        .single()

      if (findingError || !finding) {
        return NextResponse.json(
          { error: 'Source finding not found or does not belong to this project' },
          { status: 400 }
        )
      }
    }

    // Create the Q&A item
    const { data, error } = await supabase
      .from('qa_items')
      .insert({
        deal_id: projectId,
        question: input.question,
        category: input.category,
        priority: input.priority ?? 'medium',
        source_finding_id: input.sourceFindingId ?? null,
        comment: input.comment ?? null,
        created_by: user.id,
      })
      .select('*')
      .single()

    if (error) {
      console.error('[api/qa] Error creating Q&A item:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const item = mapDbRowToQAItem(data)

    return NextResponse.json({ item }, { status: 201 })
  } catch (err) {
    console.error('[api/qa] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
