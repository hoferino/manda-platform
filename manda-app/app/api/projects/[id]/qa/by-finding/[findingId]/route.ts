/**
 * Q&A By Finding API Route
 * Check if a Q&A item exists for a specific finding
 * Story: E8.5 - Finding → Q&A Quick-Add (AC: #7)
 *
 * GET /api/projects/[id]/qa/by-finding/[findingId]
 * Returns: { exists: boolean, qaItemId?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string; findingId: string }>
}

/**
 * GET /api/projects/[id]/qa/by-finding/[findingId]
 * Check if a Q&A item exists for a specific finding
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, findingId } = await context.params

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

    // Query for Q&A item with this source_finding_id
    const { data, error } = await supabase
      .from('qa_items')
      .select('id')
      .eq('deal_id', projectId)
      .eq('source_finding_id', findingId)
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[api/qa/by-finding] Error checking Q&A existence:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (data) {
      return NextResponse.json({
        exists: true,
        qaItemId: data.id,
      })
    }

    return NextResponse.json({
      exists: false,
    })
  } catch (err) {
    console.error('[api/qa/by-finding] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
