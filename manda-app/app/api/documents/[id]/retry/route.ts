/**
 * Document Retry Processing API
 * POST /api/documents/[id]/retry
 *
 * Story: E3.6 - Create Processing Status Tracking and WebSocket Updates (AC: #6)
 * Story: E3.8 - Implement Retry Logic for Failed Processing (AC: #5)
 *
 * Enhanced stage-aware retry:
 * 1. Determines which stage to restart from based on last_completed_stage
 * 2. Clears processing_error but preserves retry_history
 * 3. Sets appropriate status for stage-aware retry
 * 4. Triggers the correct job (parse/embed/analyze) via manda-processing
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAuditLog, DATA_ACCESS_EVENTS } from '@/lib/audit'

interface RouteParams {
  params: Promise<{ id: string }>
}

// E3.8: Map last_completed_stage to next stage job
function getNextStageJob(lastCompletedStage: string | null): {
  job: string
  status: string
  endpoint: string
} {
  switch (lastCompletedStage) {
    case 'parsed':
      return {
        job: 'generate-embeddings',
        status: 'embedding',
        endpoint: '/api/processing/retry/embedding',
      }
    case 'embedded':
      return {
        job: 'analyze-document',
        status: 'analyzing',
        endpoint: '/api/processing/retry/analysis',
      }
    case 'analyzed':
      // Already complete, but allow re-analysis
      return {
        job: 'analyze-document',
        status: 'analyzing',
        endpoint: '/api/processing/retry/analysis',
      }
    default:
      // No stage completed, start from parsing
      return {
        job: 'parse-document',
        status: 'pending',
        endpoint: '/webhooks/document-uploaded',
      }
  }
}

/**
 * POST /api/documents/[id]/retry
 * Retry processing a failed document with stage-aware resumption
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params

    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get document from database (RLS will filter by user access)
    const { data: document, error: dbError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single()

    if (dbError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // E3.8: Expanded list of failed statuses
    const failedStatuses = ['failed', 'analysis_failed', 'embedding_failed']
    const processingStatus = document.processing_status as string | null
    if (!processingStatus || !failedStatuses.includes(processingStatus)) {
      return NextResponse.json(
        { error: 'Document is not in a failed state' },
        { status: 400 }
      )
    }

    // Check that upload is completed
    if (document.upload_status !== 'completed') {
      return NextResponse.json(
        { error: 'Document upload is not complete' },
        { status: 400 }
      )
    }

    // E3.8: Determine next stage based on last_completed_stage
    const lastCompletedStage = document.last_completed_stage as string | null
    const { job: nextJob, status: nextStatus, endpoint } = getNextStageJob(lastCompletedStage)

    // E3.8: Update status to next stage status, clear error but NOT retry_history
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        processing_status: nextStatus,
        processing_error: null,  // Clear error, retry_history stays
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('Failed to reset document status:', updateError)
      return NextResponse.json(
        { error: 'Failed to reset document status' },
        { status: 500 }
      )
    }

    // Call the manda-processing webhook to enqueue the appropriate job
    const processingApiUrl = process.env.MANDA_PROCESSING_API_URL
    const processingApiKey = process.env.MANDA_PROCESSING_API_KEY

    let jobId: string | null = null

    if (processingApiUrl && processingApiKey) {
      try {
        // Construct GCS path
        const gcsPath = document.gcs_bucket && document.gcs_object_path
          ? `gs://${document.gcs_bucket}/${document.gcs_object_path}`
          : document.file_path

        // E3.8: Call appropriate retry endpoint based on stage
        const webhookUrl = `${processingApiUrl}${endpoint}`
        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${processingApiKey}`,
          },
          body: JSON.stringify({
            document_id: document.id,
            deal_id: document.deal_id,
            user_id: user.id,
            gcs_path: gcsPath,
            file_type: document.mime_type || 'application/octet-stream',
            file_name: document.name,
            is_retry: true,  // E3.8: Flag to indicate this is a retry
            last_completed_stage: lastCompletedStage,
          }),
        })

        if (!webhookResponse.ok) {
          const errorData = await webhookResponse.json().catch(() => ({}))
          console.error('Processing webhook failed:', errorData)
          // Don't fail the request - status is already reset
          // The job will be picked up by the worker polling
        } else {
          const result = await webhookResponse.json()
          jobId = result.job_id
          console.log('Processing job enqueued:', {
            jobId,
            job: nextJob,
            lastCompletedStage,
          })
        }
      } catch (webhookError) {
        // Log but don't fail - status is already reset
        console.error('Failed to call processing webhook:', webhookError)
      }
    } else {
      console.warn('MANDA_PROCESSING_API_URL or MANDA_PROCESSING_API_KEY not configured')
      // Processing will be triggered by worker polling
    }

    // Log audit event
    await createAuditLog({
      event_type: DATA_ACCESS_EVENTS.PROJECT_UPDATED, // Using as closest match
      user_id: user.id,
      metadata: {
        document_id: id,
        project_id: document.deal_id,
        file_name: document.name,
        action: 'retry_processing',
        previous_status: document.processing_status,
        last_completed_stage: lastCompletedStage,
        next_job: nextJob,
        job_id: jobId,
      },
      success: true,
    })

    return NextResponse.json({
      success: true,
      message: lastCompletedStage
        ? `Processing resumed from ${lastCompletedStage} stage`
        : 'Processing restarted',
      document: {
        id: document.id,
        processingStatus: nextStatus,
        lastCompletedStage,
        nextJob,
      },
      jobId,
    })
  } catch (error) {
    console.error('Error retrying document processing:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
