/**
 * Finding History API Route
 * Story: E7.1 - Implement Finding Correction via Chat (AC: #3)
 * Story: E7.5 - Maintain Comprehensive Audit Trail (AC: #7)
 *
 * GET /api/projects/[id]/findings/[findingId]/history - Get complete finding history
 *
 * Returns:
 * - Complete correction lineage with before/after values
 * - All validation/rejection feedback
 * - Confidence impact calculation
 * - Combined timeline sorted by timestamp
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCorrectionHistory } from '@/lib/services/corrections'
import { getFindingHistory } from '@/lib/services/audit-trail'

interface RouteContext {
  params: Promise<{ id: string; findingId: string }>
}

/**
 * GET /api/projects/[id]/findings/[findingId]/history
 * Get the complete history for a finding (corrections + validations + timeline)
 *
 * Query params:
 * - full=true: Return full FindingHistoryEntry with timeline (default: false)
 * - limit: Max corrections to return in legacy mode (default: 50)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, findingId } = await context.params

    // Get query params
    const { searchParams } = new URL(request.url)
    const full = searchParams.get('full') === 'true'
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

    // If full=true, return complete FindingHistoryEntry (E7.5 AC#7)
    if (full) {
      const history = await getFindingHistory(supabase, findingId)

      if (!history) {
        return NextResponse.json(
          { error: 'Failed to load finding history' },
          { status: 500 }
        )
      }

      return NextResponse.json(history)
    }

    // Legacy mode: return corrections only (E7.1 AC#3)
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
