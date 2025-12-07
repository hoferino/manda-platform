/**
 * Finding Correction History API Route
 * Story: E7.1 - Implement Finding Correction via Chat
 * AC: #3 - Audit trail of corrections
 *
 * GET /api/projects/[id]/findings/[findingId]/history - Get correction history
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCorrectionHistory } from '@/lib/services/corrections'

interface RouteContext {
  params: Promise<{ id: string; findingId: string }>
}

/**
 * GET /api/projects/[id]/findings/[findingId]/history
 * Get the correction history for a finding
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, findingId } = await context.params

    // Get limit from query params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    // Validate limit
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Invalid limit. Must be between 1 and 100.' },
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

    // Verify finding exists in this project
    const { data: finding, error: findingError } = await supabase
      .from('findings')
      .select('id')
      .eq('id', findingId)
      .eq('deal_id', projectId)
      .single()

    if (findingError || !finding) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 })
    }

    // Get correction history
    const history = await getCorrectionHistory(supabase, findingId, limit)

    return NextResponse.json({
      findingId,
      corrections: history.map((c) => ({
        id: c.id,
        originalValue: c.originalValue,
        correctedValue: c.correctedValue,
        correctionType: c.correctionType,
        reason: c.reason,
        validationStatus: c.validationStatus,
        originalSourceDocument: c.originalSourceDocument,
        originalSourceLocation: c.originalSourceLocation,
        userSourceReference: c.userSourceReference,
        analystId: c.analystId,
        createdAt: c.createdAt,
      })),
      total: history.length,
    })
  } catch (err) {
    console.error('[api/findings/[findingId]/history] GET Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
