/**
 * Q&A Export API Route
 * GET /api/projects/[id]/qa/export
 * Story: E8.6 - Excel Export
 *
 * Exports Q&A items to a professionally formatted Excel file.
 * Supports filtering by category, priority, and status.
 *
 * AC #1: Returns valid .xlsx file
 * AC #4: Filter parameters apply before export
 * AC #5: Filename follows pattern {company_name}_QA_List_{YYYY-MM-DD}.xlsx
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getQAItems } from '@/lib/services/qa'
import { generateQAExport } from '@/lib/services/qa-export'
import { QAFiltersSchema } from '@/lib/types/qa'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/projects/[id]/qa/export
 * Export Q&A items to Excel format
 *
 * Query parameters:
 * - category: Filter by category (Financials, Legal, etc.)
 * - priority: Filter by priority (high, medium, low)
 * - status: Filter by status (pending, answered)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params

    // Parse query parameters for filters (AC #4)
    const searchParams = request.nextUrl.searchParams
    const filterParams: Record<string, string | undefined> = {
      category: searchParams.get('category') || undefined,
      priority: searchParams.get('priority') || undefined,
      status: searchParams.get('status') || undefined,
    }

    // Validate filters using existing schema
    const parseResult = QAFiltersSchema.safeParse(filterParams)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid filter parameters', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const filters = parseResult.data

    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify user has access to this project and get project name (AC #5)
    const { data: project, error: projectError } = await supabase
      .from('deals')
      .select('id, name')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Fetch Q&A items with filters (AC #4)
    // Remove pagination for export - we want all matching items
    const exportFilters = {
      ...filters,
      limit: 10000, // High limit for export
      offset: 0,
    }

    const items = await getQAItems(supabase, projectId, exportFilters)

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'No Q&A items to export' },
        { status: 400 }
      )
    }

    // Generate Excel file (AC #1, #2, #3, #6, #7)
    const { buffer, filename, contentType } = await generateQAExport(
      items,
      project.name || 'Project'
    )

    // Convert Buffer to Uint8Array for Response
    const uint8Array = new Uint8Array(buffer)

    // Return file with appropriate headers (AC #5)
    return new Response(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
        'X-Export-Count': items.length.toString(),
        'X-Export-Filename': filename,
      },
    })
  } catch (err) {
    console.error('[api/qa/export] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
