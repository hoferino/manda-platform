/**
 * Document Retry Processing API
 * POST /api/documents/[id]/retry
 *
 * Story: E3.6 - Create Processing Status Tracking and WebSocket Updates (AC: #6)
 *
 * Retry failed document processing by:
 * 1. Resetting the document's processing_status to 'pending'
 * 2. Clearing the processing_error
 * 3. Enqueueing a new parse job via the manda-processing webhook
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAuditLog, DATA_ACCESS_EVENTS } from '@/lib/audit'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/documents/[id]/retry
 * Retry processing a failed document
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

    // Validate that the document is in a failed state
    const failedStatuses = ['failed', 'analysis_failed']
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

    // Reset processing status to pending
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        processing_status: 'pending',
        processing_error: null,
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

    // Call the manda-processing webhook to enqueue the parsing job
    const processingApiUrl = process.env.MANDA_PROCESSING_API_URL
    const processingApiKey = process.env.MANDA_PROCESSING_API_KEY

    if (processingApiUrl && processingApiKey) {
      try {
        // Construct GCS path
        const gcsPath = document.gcs_bucket && document.gcs_object_path
          ? `gs://${document.gcs_bucket}/${document.gcs_object_path}`
          : document.file_path

        const webhookResponse = await fetch(`${processingApiUrl}/webhooks/document-uploaded`, {
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
          }),
        })

        if (!webhookResponse.ok) {
          const errorData = await webhookResponse.json().catch(() => ({}))
          console.error('Processing webhook failed:', errorData)
          // Don't fail the request - status is already reset
          // The job will be picked up by the worker polling for pending documents
        } else {
          const result = await webhookResponse.json()
          console.log('Processing job enqueued:', result.job_id)
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
      },
      success: true,
    })

    return NextResponse.json({
      success: true,
      message: 'Processing restarted',
      document: {
        id: document.id,
        processingStatus: 'pending',
      },
    })
  } catch (error) {
    console.error('Error retrying document processing:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
