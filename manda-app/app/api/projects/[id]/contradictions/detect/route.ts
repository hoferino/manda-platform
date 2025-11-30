/**
 * Manual Contradiction Detection Trigger API
 * Allows users to manually trigger contradiction detection for a project
 * Story: E4.7 - Detect Contradictions Using Neo4j (AC: #10)
 *
 * POST /api/projects/[id]/contradictions/detect
 * Response: { jobId: string, message: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPgBoss } from '@/lib/pgboss'
import type { DetectContradictionsJobPayload } from '@/lib/pgboss'

interface RouteContext {
  params: Promise<{ id: string }>
}

interface DetectResponse {
  jobId: string
  message: string
}

interface ErrorResponse {
  error: string
}

/**
 * POST /api/projects/[id]/contradictions/detect
 * Manually trigger contradiction detection for a project
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse<DetectResponse | ErrorResponse>> {
  try {
    const { id: projectId } = await context.params

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
      .select('id, name')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check if there are any findings to analyze
    const { count: findingsCount, error: countError } = await supabase
      .from('findings')
      .select('id', { count: 'exact', head: true })
      .eq('deal_id', projectId)
      .neq('status', 'rejected')

    if (countError) {
      console.error('[api/contradictions/detect] Error counting findings:', countError)
      return NextResponse.json({ error: countError.message }, { status: 500 })
    }

    if (!findingsCount || findingsCount === 0) {
      return NextResponse.json(
        { error: 'No findings available for contradiction detection' },
        { status: 400 }
      )
    }

    // Enqueue the detect-contradictions job
    const boss = await getPgBoss()

    const jobPayload: DetectContradictionsJobPayload = {
      deal_id: projectId,
      user_id: user.id,
      // No document_id - this is a project-wide detection
      manual_trigger: true,
    }

    const jobId = await boss.send('detect-contradictions', jobPayload, {
      priority: 5, // Higher priority for manual triggers
      retryLimit: 3,
      retryDelay: 60, // 1 minute retry delay
    })

    if (!jobId) {
      return NextResponse.json(
        { error: 'Failed to enqueue contradiction detection job' },
        { status: 500 }
      )
    }

    console.log('[api/contradictions/detect] Job enqueued:', {
      jobId,
      projectId,
      findingsCount,
      userId: user.id,
    })

    return NextResponse.json(
      {
        jobId,
        message: `Contradiction detection started for ${findingsCount} findings. Job ID: ${jobId}`,
      },
      { status: 202 }
    )
  } catch (err) {
    console.error('[api/contradictions/detect] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
