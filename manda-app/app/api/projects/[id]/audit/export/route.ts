/**
 * Audit Trail Export API Route
 * GET /api/projects/[id]/audit/export - Export audit trail to CSV/JSON
 * Story: E7.5 - Maintain Comprehensive Audit Trail (AC: #6)
 *
 * Exports audit trail data with:
 * - Format selection (CSV/JSON)
 * - Date range filtering
 * - Analyst filtering
 * - Finding filtering
 * - Type filtering
 * - UTF-8 BOM for Excel compatibility (CSV)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { format } from 'date-fns'
import { exportAuditTrail } from '@/lib/services/audit-export'
import { AuditEntryType, AuditExportFormat } from '@/lib/types/feedback'

// Request validation schema
const ExportQuerySchema = z.object({
  format: z.enum(['csv', 'json']).default('csv'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  analystId: z.string().uuid().optional(),
  findingId: z.string().uuid().optional(),
  types: z.array(z.enum(['correction', 'validation', 'edit'])).optional(),
  includeMetadata: z.coerce.boolean().optional().default(true),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/projects/[id]/audit/export
 * Export audit trail to CSV or JSON format
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const typesParam = searchParams.getAll('types')

    const queryParams = {
      format: searchParams.get('format') || 'csv',
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      analystId: searchParams.get('analystId') || undefined,
      findingId: searchParams.get('findingId') || undefined,
      types: typesParam.length > 0 ? typesParam : undefined,
      includeMetadata: searchParams.get('includeMetadata') || 'true',
    }

    const parseResult = ExportQuerySchema.safeParse(queryParams)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const params = parseResult.data

    const supabase = await createClient()

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
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

    // Execute export
    const result = await exportAuditTrail(supabase, projectId, user.id, {
      format: params.format as AuditExportFormat,
      startDate: params.startDate,
      endDate: params.endDate,
      analystId: params.analystId,
      findingId: params.findingId,
      types: params.types as AuditEntryType[] | undefined,
      includeMetadata: params.includeMetadata,
    })

    if (!result.success || !result.content) {
      return NextResponse.json(
        { error: 'No data to export or export failed' },
        { status: 400 }
      )
    }

    // Generate filename
    const projectName = (project.name || 'project').replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase()
    const dateStr = format(new Date(), 'yyyy-MM-dd')
    const extension = params.format === 'json' ? 'json' : 'csv'
    const filename = `audit-trail-${projectName}-${dateStr}.${extension}`

    // Set content type
    const contentType = params.format === 'json'
      ? 'application/json; charset=utf-8'
      : 'text/csv; charset=utf-8'

    // Return file download
    return new Response(result.content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': new TextEncoder().encode(result.content).length.toString(),
        'X-Export-Count': result.recordCount.toString(),
        'X-Export-Filename': filename,
      },
    })
  } catch (err) {
    console.error('[api/audit/export] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
