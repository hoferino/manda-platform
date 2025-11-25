/**
 * Job Status API Endpoint
 * Returns the status and metadata of a specific job
 * Story: E1.8 - Configure pg-boss Job Queue (AC: #6)
 *
 * GET /api/jobs/[jobId]?name=<queue-name>
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPgBoss, JOB_TYPES, type JobType } from '@/lib/pgboss'

interface JobStatusResponse {
  id: string
  name: string
  state: string
  priority: number
  data: unknown
  output: unknown
  created_at: string
  started_at: string | null
  completed_at: string | null
  retry_count: number
  retry_limit: number
  error?: string
}

interface ErrorResponse {
  error: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<NextResponse<JobStatusResponse | ErrorResponse>> {
  try {
    const { jobId } = await params
    const searchParams = request.nextUrl.searchParams
    const queueName = searchParams.get('name')

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
    }

    if (!queueName) {
      return NextResponse.json(
        { error: 'Queue name is required (use ?name=<queue-name>)' },
        { status: 400 }
      )
    }

    // Validate queue name
    const validTypes = Object.values(JOB_TYPES)
    if (!validTypes.includes(queueName as JobType)) {
      return NextResponse.json(
        {
          error: `Invalid queue name. Valid values: ${validTypes.join(', ')}`,
        },
        { status: 400 }
      )
    }

    const boss = await getPgBoss()
    const job = await boss.getJobById(queueName, jobId)

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Map pg-boss job to response format (using camelCase from v12)
    const response: JobStatusResponse = {
      id: job.id,
      name: job.name,
      state: job.state,
      priority: job.priority,
      data: job.data,
      output: job.output,
      created_at: job.createdOn?.toISOString() || '',
      started_at: job.startedOn?.toISOString() || null,
      completed_at: job.completedOn?.toISOString() || null,
      retry_count: job.retryCount,
      retry_limit: job.retryLimit,
    }

    // Include error from output if job failed
    if (job.state === 'failed' && job.output) {
      const output = job.output as Record<string, unknown>
      if (output.error) {
        response.error = String(output.error)
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[api/jobs/[jobId]] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
