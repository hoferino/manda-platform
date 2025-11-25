/**
 * Document Upload API
 *
 * POST /api/documents/upload
 * Handles file uploads to Google Cloud Storage
 *
 * Request: FormData with:
 * - file: File to upload
 * - projectId: Project/deal ID
 * - folderPath: Optional folder path for organization
 * - category: Optional document category
 *
 * Response: Document metadata including GCS paths
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  uploadFile,
  validateFile,
  DOCUMENT_CATEGORIES,
  type DocumentCategory,
} from '@/lib/gcs/client'
import { createAuditLog, DATA_ACCESS_EVENTS } from '@/lib/audit'

export const runtime = 'nodejs'
export const maxDuration = 60 // 60 seconds for large file uploads

export async function POST(request: NextRequest) {
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

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const projectId = formData.get('projectId') as string | null
    const folderPath = formData.get('folderPath') as string | null
    const category = formData.get('category') as DocumentCategory | null

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    // Validate category if provided
    if (category && !DOCUMENT_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Allowed: ${DOCUMENT_CATEGORIES.join(', ')}` },
        { status: 400 }
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
          category: category || 'other',
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
        category: category || null,
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
        category: category || null,
        folder_path: folderPath || null,
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
        category: document.category || null,
        folderPath: document.folder_path || null,
        uploadStatus: document.upload_status,
        processingStatus: document.processing_status,
        createdAt: document.created_at,
      },
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error during upload' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/documents/upload
 * Get a signed upload URL for direct client-side uploads (alternative flow)
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

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const filename = searchParams.get('filename')
    const mimeType = searchParams.get('mimeType')
    const fileSize = searchParams.get('fileSize')

    if (!projectId || !filename || !mimeType || !fileSize) {
      return NextResponse.json(
        { error: 'Missing required parameters: projectId, filename, mimeType, fileSize' },
        { status: 400 }
      )
    }

    // Verify user has access to the project
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

    // Validate file
    const validation = validateFile(filename, mimeType, parseInt(fileSize, 10))
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // Import function for signed upload URL
    const { getSignedUploadUrl } = await import('@/lib/gcs/client')

    const folderPath = searchParams.get('folderPath') || undefined
    const result = await getSignedUploadUrl(projectId, filename, mimeType, {
      folderPath,
      expiresInMinutes: 15,
    })

    return NextResponse.json({
      uploadUrl: result.uploadUrl,
      objectPath: result.objectPath,
      bucket: result.bucket,
      expiresIn: 15 * 60, // seconds
    })
  } catch (error) {
    console.error('Error generating signed URL:', error)
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    )
  }
}
