/**
 * Processing Queue API
 * GET /api/processing/queue
 *
 * Story: E3.7 - Implement Processing Queue Visibility (AC: #3)
 *
 * Proxy endpoint to fetch processing queue jobs from manda-processing service.
 * Handles authentication and forwards requests with appropriate headers.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/processing/queue
 * Fetch jobs in the processing queue for a project
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Extract query parameters
    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get('projectId')
    const limit = searchParams.get('limit') || '20'
    const offset = searchParams.get('offset') || '0'

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
      limit,
      offset,
    })

    const response = await fetch(
      `${processingApiUrl}/api/processing/queue?${queryParams}`,
      {
        method: 'GET',
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
        { error: errorData.detail || 'Failed to fetch queue' },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching processing queue:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
