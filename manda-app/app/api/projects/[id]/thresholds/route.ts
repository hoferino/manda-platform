/**
 * Confidence Thresholds API Routes
 *
 * Story: E7.4 - Build Feedback Incorporation System
 *
 * Endpoints:
 * - GET: Get all thresholds for a project
 * - POST: Set a threshold for a domain
 * - DELETE: Reset threshold to default
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getAllThresholds,
  setThreshold,
  resetThreshold,
  resetAllThresholds,
  getThresholdHistory,
  DEFAULT_THRESHOLDS,
} from '@/lib/services/confidence-thresholds'
import { z } from 'zod'

const SetThresholdSchema = z.object({
  domain: z.string().min(1),
  threshold: z.number().min(0.3).max(0.95),
  reason: z.string().min(1).max(500),
})

const ResetThresholdSchema = z.object({
  domain: z.string().min(1).optional(),
  resetAll: z.boolean().optional(),
})

/**
 * GET /api/projects/[id]/thresholds
 *
 * Get confidence thresholds for a project.
 * Query params:
 * - history: boolean - If true, returns threshold history
 * - domain: string - Filter history by domain
 * - limit: number - Number of history entries (default 50)
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
    const domain = searchParams.get('domain') || undefined
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    if (showHistory) {
      const history = await getThresholdHistory(supabase, projectId, {
        domain,
        limit,
      })
      return NextResponse.json({ history })
    }

    // Get current thresholds
    const thresholds = await getAllThresholds(supabase, projectId)

    // Merge with defaults for complete picture
    const thresholdMap = new Map(thresholds.map(t => [t.domain, t]))
    const mergedThresholds = Object.entries(DEFAULT_THRESHOLDS).map(([domain, defaultValue]) => {
      const custom = thresholdMap.get(domain)
      if (custom) {
        return {
          domain,
          threshold: custom.threshold,
          isCustom: true,
          appliedAt: custom.appliedAt,
          autoApplied: custom.autoApplied,
          reason: custom.reason,
        }
      }
      return {
        domain,
        threshold: defaultValue,
        isCustom: false,
        appliedAt: null,
        autoApplied: false,
        reason: 'Default threshold',
      }
    })

    // Add any custom thresholds for domains not in defaults
    for (const threshold of thresholds) {
      if (!DEFAULT_THRESHOLDS[threshold.domain]) {
        mergedThresholds.push({
          domain: threshold.domain,
          threshold: threshold.threshold,
          isCustom: true,
          appliedAt: threshold.appliedAt,
          autoApplied: threshold.autoApplied,
          reason: threshold.reason,
        })
      }
    }

    return NextResponse.json({
      thresholds: mergedThresholds,
      defaults: DEFAULT_THRESHOLDS,
    })
  } catch (error) {
    console.error('[thresholds] GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/projects/[id]/thresholds
 *
 * Set a confidence threshold for a domain.
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

    // Parse and validate request body
    const body = await request.json()
    const validationResult = SetThresholdSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { domain, threshold, reason } = validationResult.data

    // Set threshold
    const result = await setThreshold(
      supabase,
      projectId,
      domain,
      threshold,
      reason,
      user.id,
      false // Not auto-applied
    )

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to set threshold' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      threshold: result,
    })
  } catch (error) {
    console.error('[thresholds] POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/projects/[id]/thresholds
 *
 * Reset threshold(s) to default.
 * Body:
 * - domain: string - Reset specific domain
 * - resetAll: boolean - Reset all thresholds
 */
export async function DELETE(
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

    // Parse body
    let body = {}
    try {
      body = await request.json()
    } catch {
      // Empty body is valid
    }

    const validationResult = ResetThresholdSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { domain, resetAll } = validationResult.data

    if (resetAll) {
      const count = await resetAllThresholds(supabase, projectId, user.id)
      return NextResponse.json({
        success: true,
        message: `Reset ${count} thresholds to defaults`,
        count,
      })
    }

    if (!domain) {
      return NextResponse.json(
        { error: 'Either domain or resetAll must be specified' },
        { status: 400 }
      )
    }

    const result = await resetThreshold(supabase, projectId, domain, user.id)

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to reset threshold' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      threshold: result,
    })
  } catch (error) {
    console.error('[thresholds] DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
