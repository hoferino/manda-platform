/**
 * Finding Validation Stats API Route
 * Get validation statistics for a finding
 * Story: E7.2 - Track Validation/Rejection Feedback
 *
 * GET /api/projects/[id]/findings/[findingId]/stats
 * Response: { findingId, validationCount, rejectionCount, totalFeedback, adjustedConfidence, baseConfidence }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getValidationStatsDirect,
  calculateAdjustedConfidence,
} from '@/lib/services/validation-feedback'
import type { ValidationStatsApiResponse } from '@/lib/types/feedback'

interface RouteContext {
  params: Promise<{ id: string; findingId: string }>
}

/**
 * GET /api/projects/[id]/findings/[findingId]/stats
 * Get validation statistics for a finding
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

    // Verify user has access to this project
    const { data: project, error: projectError } = await supabase
      .from('deals')
      .select('id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Verify finding exists and get base confidence
    const { data: finding, error: findingError } = await supabase
      .from('findings')
      .select('id, deal_id, confidence')
      .eq('id', findingId)
      .eq('deal_id', projectId)
      .single()

    if (findingError || !finding) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 })
    }

    const baseConfidence = finding.confidence ?? 0.5

    // Get validation stats
    const stats = await getValidationStatsDirect(supabase, findingId)

    // Calculate adjusted confidence
    const adjustedConfidence = calculateAdjustedConfidence(
      baseConfidence,
      stats.validationCount,
      stats.rejectionCount
    )

    const response: ValidationStatsApiResponse = {
      findingId,
      validationCount: stats.validationCount,
      rejectionCount: stats.rejectionCount,
      totalFeedback: stats.totalFeedback,
      adjustedConfidence,
      baseConfidence,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[api/findings/stats] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
