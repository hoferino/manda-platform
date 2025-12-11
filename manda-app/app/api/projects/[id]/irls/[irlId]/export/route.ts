/**
 * IRL Export API Route
 * POST /api/projects/[id]/irls/[irlId]/export
 * Generates PDF or Word export of an IRL
 * Story: E6.6 - Build IRL Export Functionality (PDF/Word)
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getIRLWithItems } from '@/lib/services/irls'
import { generateIRLExport, IRLExportFormat } from '@/lib/services/irl-export'

interface RouteContext {
  params: Promise<{ id: string; irlId: string }>
}

// Request body schema
const ExportRequestSchema = z.object({
  format: z.enum(['pdf', 'word', 'excel', 'csv']),
})

/**
 * GET /api/projects/[id]/irls/[irlId]/export?format=excel
 * Generate and download IRL export
 *
 * Query params:
 * - format: 'pdf' | 'word' | 'excel' | 'csv'
 *
 * Response:
 * - File blob with appropriate Content-Type
 * - Headers: X-Export-Filename, X-Export-Count
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, irlId } = await context.params
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'excel'

    // Validate format
    const parseResult = ExportRequestSchema.safeParse({ format })
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid format. Must be: pdf, word, excel, or csv' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify user has access to this project and get project name
    const { data: project, error: projectError } = await supabase
      .from('deals')
      .select('id, name')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get IRL with items
    const irlWithItems = await getIRLWithItems(supabase, irlId)

    if (!irlWithItems) {
      return NextResponse.json({ error: 'IRL not found' }, { status: 404 })
    }

    // Verify IRL belongs to this project
    if (irlWithItems.dealId !== projectId) {
      return NextResponse.json({ error: 'IRL not found' }, { status: 404 })
    }

    // Handle empty IRL case
    if (irlWithItems.items.length === 0) {
      return NextResponse.json(
        { error: 'Cannot export empty IRL. Add items before exporting.' },
        { status: 400 }
      )
    }

    // Generate export
    const exportResult = await generateIRLExport(irlWithItems, {
      format: parseResult.data.format as IRLExportFormat,
      projectName: project.name,
      exportDate: new Date(),
    })

    // Return file with appropriate headers
    // Convert Buffer to Uint8Array for NextResponse compatibility
    const response = new NextResponse(new Uint8Array(exportResult.buffer), {
      status: 200,
      headers: {
        'Content-Type': exportResult.contentType,
        'Content-Disposition': `attachment; filename="${exportResult.filename}"`,
        'X-Export-Filename': exportResult.filename,
        'X-Export-Count': irlWithItems.items.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })

    return response
  } catch (error) {
    console.error('Error in GET /api/projects/[id]/irls/[irlId]/export:', error)
    return NextResponse.json(
      { error: 'Failed to generate export' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/projects/[id]/irls/[irlId]/export
 * Generate and download IRL export
 *
 * Request body:
 * - format: 'pdf' | 'word' | 'excel' | 'csv'
 *
 * Response:
 * - File blob with appropriate Content-Type
 * - Headers: X-Export-Filename, X-Export-Count
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, irlId } = await context.params
    const body = await request.json()

    // Validate request body
    const parseResult = ExportRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { format } = parseResult.data

    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify user has access to this project and get project name
    const { data: project, error: projectError } = await supabase
      .from('deals')
      .select('id, name')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get IRL with items
    const irlWithItems = await getIRLWithItems(supabase, irlId)

    if (!irlWithItems) {
      return NextResponse.json({ error: 'IRL not found' }, { status: 404 })
    }

    // Verify IRL belongs to this project
    if (irlWithItems.dealId !== projectId) {
      return NextResponse.json({ error: 'IRL not found' }, { status: 404 })
    }

    // Handle empty IRL case
    if (irlWithItems.items.length === 0) {
      return NextResponse.json(
        { error: 'Cannot export empty IRL. Add items before exporting.' },
        { status: 400 }
      )
    }

    // Generate export
    const exportResult = await generateIRLExport(irlWithItems, {
      format: format as IRLExportFormat,
      projectName: project.name,
      exportDate: new Date(),
    })

    // Return file with appropriate headers
    // Convert Buffer to Uint8Array for NextResponse compatibility
    const response = new NextResponse(new Uint8Array(exportResult.buffer), {
      status: 200,
      headers: {
        'Content-Type': exportResult.contentType,
        'Content-Disposition': `attachment; filename="${exportResult.filename}"`,
        'X-Export-Filename': exportResult.filename,
        'X-Export-Count': irlWithItems.items.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })

    return response
  } catch (error) {
    console.error('Error in POST /api/projects/[id]/irls/[irlId]/export:', error)
    return NextResponse.json(
      { error: 'Failed to generate export' },
      { status: 500 }
    )
  }
}
