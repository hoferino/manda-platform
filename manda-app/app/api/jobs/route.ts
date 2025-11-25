/**
 * Jobs List API Endpoint
 * Returns a list of jobs with optional filtering
 * Story: E1.8 - Configure pg-boss Job Queue (AC: #6)
 *
 * GET /api/jobs?type=test-job&limit=50
 * POST /api/jobs - Enqueue a new job
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPgBoss, JOB_TYPES, type JobType } from '@/lib/pgboss'

interface JobSummary {
  id: string
  name: string
  state: string
  priority: number
  created_at: string
  started_at: string | null
  completed_at: string | null
  retry_count: number
}

interface JobsListResponse {
  jobs: JobSummary[]
  total: number
  filters: {
    type?: string
    limit: number
  }
}

interface ErrorResponse {
  error: string
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<JobsListResponse | ErrorResponse>> {
  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type')
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 50

    // Validate type if provided
    const validTypes = Object.values(JOB_TYPES)
    if (type && !validTypes.includes(type as JobType)) {
      return NextResponse.json(
        {
          error: `Invalid type. Valid values: ${validTypes.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Validate limit
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 100' },
        { status: 400 }
      )
    }

    const boss = await getPgBoss()

    const jobs: JobSummary[] = []

    // If type is specified, fetch jobs of that type
    if (type) {
      const fetchedJobs = await boss.fetch(type, {
        batchSize: limit,
        includeMetadata: true,
      })
      if (fetchedJobs) {
        for (const job of fetchedJobs) {
          jobs.push({
            id: job.id,
            name: job.name,
            state: job.state,
            priority: job.priority,
            created_at: job.createdOn?.toISOString() || '',
            started_at: job.startedOn?.toISOString() || null,
            completed_at: job.completedOn?.toISOString() || null,
            retry_count: job.retryCount,
          })
        }
      }
    } else {
      // Fetch from all registered job types
      for (const jobType of validTypes) {
        const fetchedJobs = await boss.fetch(jobType, {
          batchSize: Math.ceil(limit / validTypes.length),
          includeMetadata: true,
        })
        if (fetchedJobs) {
          for (const job of fetchedJobs) {
            jobs.push({
              id: job.id,
              name: job.name,
              state: job.state,
              priority: job.priority,
              created_at: job.createdOn?.toISOString() || '',
              started_at: job.startedOn?.toISOString() || null,
              completed_at: job.completedOn?.toISOString() || null,
              retry_count: job.retryCount,
            })
          }
        }
        if (jobs.length >= limit) break
      }
    }

    // Sort by created_at descending
    jobs.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    // Apply limit
    const limitedJobs = jobs.slice(0, limit)

    return NextResponse.json({
      jobs: limitedJobs,
      total: limitedJobs.length,
      filters: {
        type: type || undefined,
        limit,
      },
    })
  } catch (error) {
    console.error('[api/jobs] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/jobs - Enqueue a new job (for testing)
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<{ jobId: string } | ErrorResponse>> {
  try {
    const body = await request.json()
    const { type, data, options } = body as {
      type: string
      data: unknown
      options?: Record<string, unknown>
    }

    // Validate type
    const validTypes = Object.values(JOB_TYPES)
    if (!type || !validTypes.includes(type as JobType)) {
      return NextResponse.json(
        {
          error: `Invalid or missing type. Valid values: ${validTypes.join(', ')}`,
        },
        { status: 400 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Job data is required' },
        { status: 400 }
      )
    }

    const boss = await getPgBoss()
    const jobId = await boss.send(type, data as object, options)

    if (!jobId) {
      return NextResponse.json(
        { error: 'Failed to enqueue job' },
        { status: 500 }
      )
    }

    return NextResponse.json({ jobId }, { status: 201 })
  } catch (error) {
    console.error('[api/jobs] POST Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
