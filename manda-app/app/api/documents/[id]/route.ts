/**
 * Document API - Individual Document Operations
 *
 * GET /api/documents/[id] - Get document details with signed download URL
 * DELETE /api/documents/[id] - Delete document from GCS and database
 * PATCH /api/documents/[id] - Update document metadata
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSignedDownloadUrl, deleteFile } from '@/lib/gcs/client'
import { createAuditLog, DATA_ACCESS_EVENTS } from '@/lib/audit'

interface RouteParams {
  params: Promise<{ id: string }>
}


/**
 * GET /api/documents/[id]
 * Get document details with a signed download URL
 */
export async function GET(
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

    // Generate signed download URL
    let downloadUrl: string | null = null
    if (document.gcs_object_path && document.upload_status === 'completed') {
      try {
        downloadUrl = await getSignedDownloadUrl(document.gcs_object_path, {
          bucketName: document.gcs_bucket || undefined,
          expiresInMinutes: 15,
          responseDisposition: `attachment; filename="${document.name}"`,
        })
      } catch (error) {
        console.error('Error generating signed URL:', error)
        // Continue without download URL - document metadata is still useful
      }
    }

    // Log audit event for document access
    await createAuditLog({
      event_type: DATA_ACCESS_EVENTS.DOCUMENT_ACCESSED,
      user_id: user.id,
      metadata: {
        document_id: document.id,
        project_id: document.deal_id,
        file_name: document.name,
      },
      success: true,
    })

    return NextResponse.json({
      document: {
        id: document.id,
        projectId: document.deal_id,
        name: document.name,
        size: document.file_size,
        mimeType: document.mime_type,
        category: document.category || null,
        folderPath: document.folder_path || null,
        uploadStatus: document.upload_status,
        processingStatus: document.processing_status,
        createdAt: document.created_at,
        updatedAt: document.updated_at,
        downloadUrl,
        downloadUrlExpiresIn: downloadUrl ? 15 * 60 : null, // seconds
      },
    })
  } catch (error) {
    console.error('Error fetching document:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/documents/[id]
 * Delete document from GCS and database
 */
export async function DELETE(
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

    // Delete from GCS
    if (document.gcs_object_path) {
      try {
        await deleteFile(document.gcs_object_path, document.gcs_bucket || undefined)
      } catch (error) {
        console.error('Error deleting from GCS:', error)
        // Continue with database deletion even if GCS fails
        // This prevents orphaned records
      }
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Database error deleting document:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete document' },
        { status: 500 }
      )
    }

    // Log audit event
    await createAuditLog({
      event_type: DATA_ACCESS_EVENTS.DOCUMENT_DELETED,
      user_id: user.id,
      metadata: {
        document_id: id,
        project_id: document.deal_id,
        file_name: document.name,
      },
      success: true,
    })

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting document:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/documents/[id]
 * Update document metadata (name, category, folder_path)
 */
export async function PATCH(
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

    // Parse request body
    const body = await request.json()
    const { name, category, folderPath } = body

    // Validate at least one field is provided
    if (!name && !category && folderPath === undefined) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Validate category if provided
    if (category) {
      const { DOCUMENT_CATEGORIES } = await import('@/lib/gcs/client')
      if (!DOCUMENT_CATEGORIES.includes(category)) {
        return NextResponse.json(
          { error: `Invalid category. Allowed: ${DOCUMENT_CATEGORIES.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Build update object
    const updates: Record<string, string | null> = {}
    if (name) updates.name = name
    if (category) updates.category = category
    if (folderPath !== undefined) updates.folder_path = folderPath

    // Update document
    const { data: document, error: updateError } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError || !document) {
      if (updateError?.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        )
      }
      console.error('Database error updating document:', updateError)
      return NextResponse.json(
        { error: 'Failed to update document' },
        { status: 500 }
      )
    }

    // Log audit event
    await createAuditLog({
      event_type: DATA_ACCESS_EVENTS.PROJECT_UPDATED, // Using project_updated as closest match
      user_id: user.id,
      metadata: {
        document_id: id,
        project_id: document.deal_id,
        file_name: document.name,
        updates,
      },
      success: true,
    })

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        projectId: document.deal_id,
        name: document.name,
        category: document.category || null,
        folderPath: document.folder_path || null,
        updatedAt: document.updated_at,
      },
    })
  } catch (error) {
    console.error('Error updating document:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
