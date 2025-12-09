/**
 * Batch Q&A Existence Check API Route
 * Check if Q&A items exist for multiple findings at once
 * Story: E8.5 - Finding → Q&A Quick-Add (AC: #7)
 *
 * POST /api/projects/[id]/qa/check-findings
 * Body: { findingIds: string[] }
 * Returns: { results: Record<string, string | null> }
 *   - Maps findingId to qaItemId (or null if none exists)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

interface RouteContext {
  params: Promise<{ id: string }>
}

// Request body schema
const CheckFindingsSchema = z.object({
  findingIds: z
    .array(z.string().uuid())
    .min(1, 'At least one finding ID is required')
    .max(100, 'Maximum 100 finding IDs per request'),
})

/**
 * POST /api/projects/[id]/qa/check-findings
 * Batch check Q&A existence for multiple findings
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params

    const body = await request.json()
    const parseResult = CheckFindingsSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { findingIds } = parseResult.data

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

    // Query for Q&A items with these source_finding_ids
    const { data, error } = await supabase
      .from('qa_items')
      .select('id, source_finding_id')
      .eq('deal_id', projectId)
      .in('source_finding_id', findingIds)

    if (error) {
      console.error('[api/qa/check-findings] Error checking Q&A existence:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Build results map: findingId -> qaItemId (or null)
    const results: Record<string, string | null> = {}

    // Initialize all requested finding IDs with null
    for (const findingId of findingIds) {
      results[findingId] = null
    }

    // Fill in Q&A item IDs for findings that have them
    if (data) {
      for (const row of data) {
        if (row.source_finding_id) {
          results[row.source_finding_id] = row.id
        }
      }
    }

    return NextResponse.json({ results })
  } catch (err) {
    console.error('[api/qa/check-findings] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
