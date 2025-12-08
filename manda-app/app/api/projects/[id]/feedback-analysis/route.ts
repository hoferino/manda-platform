/**
 * Feedback Analysis API Routes
 *
 * Story: E7.4 - Build Feedback Incorporation System
 *
 * Endpoints:
 * - GET: Get latest analysis or analysis history
 * - POST: Trigger new analysis
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeFeedback, getLatestAnalysis, getAnalysisHistory } from '@/lib/services/feedback-analysis'
import { getFeatureFlag } from '@/lib/config/feature-flags'
import { z } from 'zod'

const AnalysisRequestSchema = z.object({
  analysisType: z.enum(['full', 'incremental']).default('full'),
  periodDays: z.number().min(1).max(90).default(7),
  includePatternDetection: z.boolean().default(true),
  includeConfidenceAdjustments: z.boolean().default(true),
})

/**
 * GET /api/projects/[id]/feedback-analysis
 *
 * Get feedback analysis for a project.
 * Query params:
 * - history: boolean - If true, returns analysis history instead of just latest
 * - limit: number - Number of history entries to return (default 10)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify project access
    const { data: project, error: projectError } = await supabase
      .from('deals')
      .select('id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams
    const showHistory = searchParams.get('history') === 'true'
    const limit = parseInt(searchParams.get('limit') || '10', 10)

    if (showHistory) {
      const history = await getAnalysisHistory(supabase, projectId, limit)
      return NextResponse.json({ history })
    }

    const latest = await getLatestAnalysis(supabase, projectId)
    if (!latest) {
      return NextResponse.json({ analysis: null, message: 'No analysis found' })
    }

    return NextResponse.json({ analysis: latest })
  } catch (error) {
    console.error('[feedback-analysis] GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/projects/[id]/feedback-analysis
 *
 * Trigger a new feedback analysis for a project.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify project access
    const { data: project, error: projectError } = await supabase
      .from('deals')
      .select('id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check if weekly analysis is enabled
    const analysisEnabled = await getFeatureFlag('weeklyFeedbackAnalysisEnabled')
    if (!analysisEnabled) {
      return NextResponse.json(
        { error: 'Feedback analysis is currently disabled' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    let body = {}
    try {
      body = await request.json()
    } catch {
      // Empty body is valid, will use defaults
    }

    const validationResult = AnalysisRequestSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { analysisType, periodDays, includePatternDetection, includeConfidenceAdjustments } =
      validationResult.data

    // Run analysis
    const result = await analyzeFeedback(supabase, {
      dealId: projectId,
      analysisType,
      periodDays,
      includePatternDetection,
      includeConfidenceAdjustments,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Analysis failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      analysis: result.summary,
      processingTimeMs: result.processingTimeMs,
    })
  } catch (error) {
    console.error('[feedback-analysis] POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
