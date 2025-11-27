/**
 * Processing Queue Job API
 * DELETE /api/processing/queue/[jobId]
 *
 * Story: E3.7 - Implement Processing Queue Visibility (AC: #4)
 *
 * Cancel a queued job by forwarding the request to manda-processing service.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ jobId: string }>
}

/**
 * DELETE /api/processing/queue/[jobId]
 * Cancel a queued processing job
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { jobId } = await params

    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Extract project_id from query params
    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      )
    }

    // Verify user has access to this project (via RLS)
    const { data: project, error: projectError } = await supabase
      .from('deals')
      .select('id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      )
    }

    // Call the manda-processing API
    const processingApiUrl = process.env.MANDA_PROCESSING_API_URL
    const processingApiKey = process.env.MANDA_PROCESSING_API_KEY

    if (!processingApiUrl || !processingApiKey) {
      console.error('MANDA_PROCESSING_API_URL or MANDA_PROCESSING_API_KEY not configured')
      return NextResponse.json(
        { error: 'Processing service not configured' },
        { status: 503 }
      )
    }

    const queryParams = new URLSearchParams({
      project_id: projectId,
    })

    const response = await fetch(
      `${processingApiUrl}/api/processing/queue/${jobId}?${queryParams}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${processingApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Processing API error:', errorData)
      return NextResponse.json(
        { error: errorData.detail || 'Failed to cancel job' },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error cancelling job:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
