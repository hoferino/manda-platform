/**
 * IRL Import API
 * POST /api/projects/[id]/irl/import
 *
 * Story: E6.X - IRL Import from Excel/CSV
 *
 * Handles file upload and IRL import workflow:
 * 1. Validate file (size, type)
 * 2. Parse Excel/CSV file
 * 3. Create IRL record + items
 * 4. Optionally generate folder structure
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  parseExcelIRL,
  parseCSVIRL,
  importIRL,
  validateIRLFile,
  MAX_FILE_SIZE,
} from '@/lib/services/irl-import'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

/**
 * POST /api/projects/[id]/irl/import
 * Upload and import IRL from Excel/CSV file
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Authenticate user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get project ID from params
    const { id: dealId } = await params

    // Verify user has access to this project (via RLS)
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('id, name')
      .eq('id', dealId)
      .single()

    if (dealError || !deal) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      )
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const irlName = formData.get('name') as string | null
    const generateFolders = formData.get('generateFolders') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file
    const validation = validateIRLFile(file)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parse file based on MIME type
    let preview
    try {
      if (file.type.includes('spreadsheet') || file.name.endsWith('.xlsx')) {
        preview = await parseExcelIRL(buffer)
      } else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        preview = await parseCSVIRL(buffer)
      } else {
        return NextResponse.json(
          { error: 'Unsupported file format' },
          { status: 400 }
        )
      }
    } catch (parseError) {
      console.error('[IRL Import API] Parse error:', parseError)
      return NextResponse.json(
        {
          error:
            parseError instanceof Error
              ? parseError.message
              : 'Failed to parse file',
        },
        { status: 400 }
      )
    }

    // Import IRL to database
    const importName = irlName || `${deal.name} - IRL (Imported)`
    const result = await importIRL(
      supabase,
      dealId,
      user.id,
      preview,
      importName,
      generateFolders
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to import IRL' },
        { status: 500 }
      )
    }

    // Return success response
    return NextResponse.json({
      success: true,
      irlId: result.irlId,
      itemsCreated: result.itemsCreated,
      foldersCreated: result.foldersCreated,
      categories: preview.categories,
      warnings: preview.warnings,
    })
  } catch (error) {
    console.error('[IRL Import API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
