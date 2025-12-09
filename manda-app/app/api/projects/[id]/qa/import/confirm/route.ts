/**
 * Q&A Import Confirm API Route
 *
 * POST /api/projects/[id]/qa/import/confirm
 * Executes the import based on user decisions
 *
 * Story: E8.7 - Excel Import with Pattern Matching
 * AC: #5 - POST /import/confirm merges approved items into Q&A list
 * AC: #6 - Imported answers and date_answered populate Q&A item fields
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getQAItems } from '@/lib/services/qa'
import {
  confirmImport,
  matchImportedRows,
} from '@/lib/services/qa-import'
import {
  QAImportPreview,
  ImportConfirmationSchema,
} from '@/lib/types/qa'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Request body type (before validation)
 */
interface ConfirmRequestBody {
  exactMatchIds?: string[]
  fuzzyMatchDecisions?: Record<string, string>
  importNewItems?: boolean
  newItemsToImport?: unknown[]
  preview: QAImportPreview
}

/**
 * POST /api/projects/[id]/qa/import/confirm
 *
 * Accept confirmation decisions and execute import
 * Returns import result with updated and created items
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

    // Parse request body
    const body: ConfirmRequestBody = await request.json()

    if (!body.preview) {
      return NextResponse.json(
        { error: 'Preview data is required' },
        { status: 400 }
      )
    }

    // Build confirmation object with defaults
    const confirmationData = {
      exactMatchIds: body.exactMatchIds ?? body.preview.exactMatches.map(m => m.existing.id),
      fuzzyMatchDecisions: body.fuzzyMatchDecisions ?? {},
      importNewItems: body.importNewItems ?? false,
      newItemsToImport: body.newItemsToImport ?? body.preview.newItems,
      projectId,
    }

    // Validate confirmation data
    const parseResult = ImportConfirmationSchema.safeParse(confirmationData)
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid confirmation data',
          details: parseResult.error.issues,
        },
        { status: 400 }
      )
    }

    const confirmation = parseResult.data

    // Execute import
    const result = await confirmImport(supabase, body.preview, confirmation)

    return NextResponse.json({
      result,
      message: `Import completed: ${result.stats.total} items processed`,
    })
  } catch (error) {
    console.error('[qa/import/confirm] Error:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to confirm import' },
      { status: 500 }
    )
  }
}
