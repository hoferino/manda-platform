/**
 * Validations Audit API Route
 * GET /api/projects/[id]/audit/validations - Query validation feedback
 * Story: E7.5 - Maintain Comprehensive Audit Trail (AC: #2, #5)
 *
 * Returns validations with:
 * - finding_id, action (validate/reject)
 * - analyst_id, timestamp
 * - reason (optional)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { queryValidations } from '@/lib/services/audit-trail'

// Request validation schema
const QuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  analystId: z.string().uuid().optional(),
  findingId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(1000).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
  orderBy: z.enum(['created_at', 'analyst_id']).optional().default('created_at'),
  orderDir: z.enum(['asc', 'desc']).optional().default('desc'),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/projects/[id]/audit/validations
 * Query validation feedback with filters and pagination
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const queryParams = {
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      analystId: searchParams.get('analystId') || undefined,
      findingId: searchParams.get('findingId') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
      orderBy: searchParams.get('orderBy') || undefined,
      orderDir: searchParams.get('orderDir') || undefined,
    }

    const parseResult = QuerySchema.safeParse(queryParams)

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

    // Verify user has access to this project
    const { data: project, error: projectError } = await supabase
      .from('deals')
      .select('id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Query validations
    const result = await queryValidations(supabase, projectId, {
      startDate: params.startDate,
      endDate: params.endDate,
      analystId: params.analystId,
      findingId: params.findingId,
      limit: params.limit,
      offset: params.offset,
      orderBy: params.orderBy,
      orderDir: params.orderDir,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[api/audit/validations] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
