/**
 * Q&A Import Preview API Route
 *
 * POST /api/projects/[id]/qa/import/preview
 * Parses uploaded Excel file and returns match preview
 *
 * Story: E8.7 - Excel Import with Pattern Matching
 * AC: #1 - POST /import/preview with Excel file returns categorized matches
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getQAItems } from '@/lib/services/qa'
import {
  parseQAExcel,
  matchImportedRows,
  validateBuffer,
  MAX_FILE_SIZE,
  ACCEPTED_MIME_TYPES,
} from '@/lib/services/qa-import'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/projects/[id]/qa/import/preview
 *
 * Accept multipart form data with Excel file
 * Returns import preview with exact matches, fuzzy matches, and new items
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: projectId } = await params

  // Validate UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
    return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 })
  }

  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Validate file type
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an Excel file (.xlsx)' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Validate buffer
    validateBuffer(buffer)

    // Parse Excel file
    const importedRows = await parseQAExcel(buffer)

    if (importedRows.length === 0) {
      return NextResponse.json(
        { error: 'No valid Q&A items found in the uploaded file' },
        { status: 400 }
      )
    }

    // Fetch existing Q&A items for matching
    const existingItems = await getQAItems(supabase, projectId, { limit: 1000 })

    // Match imported rows against existing items
    const preview = matchImportedRows(importedRows, existingItems)

    return NextResponse.json({
      preview,
      projectId,
    })
  } catch (error) {
    console.error('[qa/import/preview] Error:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to process import file' },
      { status: 500 }
    )
  }
}
