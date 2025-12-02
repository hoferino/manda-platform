/**
 * Chat Upload API
 *
 * POST /api/projects/[id]/chat/upload
 * Handles file uploads from the chat interface to Google Cloud Storage.
 * Similar to /api/documents/upload but optimized for chat context.
 *
 * Story: E5.9 - Implement Document Upload via Chat Interface
 * AC: #3 (Upload Triggers Processing Pipeline)
 * AC: #8 (Data Room Integration)
 *
 * Request: FormData with:
 * - file: File to upload
 * - conversationId: Optional conversation ID for context
 * - folderPath: Optional folder path for organization (defaults to root)
 *
 * Response: Document metadata including processing status
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  uploadFile,
  validateFile,
} from '@/lib/gcs/client'
import { createAuditLog, DATA_ACCESS_EVENTS } from '@/lib/audit'

export const runtime = 'nodejs'
export const maxDuration = 60 // 60 seconds for large file uploads

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Get project ID from route params
    const params = await context.params
    const projectId = params.id

    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user has access to the project
    const { data: project, error: projectError } = await supabase
      .from('deals')
      .select('id, name')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const conversationId = formData.get('conversationId') as string | null
    const folderPath = formData.get('folderPath') as string | null

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file
    const validation = validateFile(file.name, file.type, file.size)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to GCS
    const gcsResult = await uploadFile(
      projectId,
      buffer,
      file.name,
      file.type,
      {
        folderPath: folderPath || undefined,
        metadata: {
          uploadedBy: user.id,
          uploadSource: 'chat',
          ...(conversationId && { conversationId }),
        },
      }
    )

    // Create document record in database
    const { data: document, error: dbError } = await supabase
      .from('documents')
      .insert({
        deal_id: projectId,
        user_id: user.id,
        name: file.name,
        file_path: gcsResult.publicUrl,
        file_size: gcsResult.size,
        mime_type: file.type,
        upload_status: 'completed',
        processing_status: 'pending',
        gcs_bucket: gcsResult.bucket,
        gcs_object_path: gcsResult.objectPath,
        folder_path: folderPath || null,
        // No IRL item linking for chat uploads by default
        irl_item_id: null,
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error creating document:', dbError)
      return NextResponse.json(
        { error: 'Failed to create document record' },
        { status: 500 }
      )
    }

    // Log audit event
    await createAuditLog({
      event_type: DATA_ACCESS_EVENTS.DOCUMENT_UPLOADED,
      user_id: user.id,
      metadata: {
        document_id: document.id,
        project_id: projectId,
        file_name: file.name,
        file_size: gcsResult.size,
        mime_type: file.type,
        folder_path: folderPath || null,
        upload_source: 'chat',
        conversation_id: conversationId || null,
      },
      success: true,
    })

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        name: document.name,
        size: document.file_size,
        mimeType: document.mime_type,
        folderPath: document.folder_path || null,
        uploadStatus: document.upload_status,
        processingStatus: document.processing_status,
        createdAt: document.created_at,
      },
    })
  } catch (error) {
    console.error('Chat upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error during upload' },
      { status: 500 }
    )
  }
}
