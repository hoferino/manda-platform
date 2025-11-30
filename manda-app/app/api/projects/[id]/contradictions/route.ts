/**
 * Contradictions API Route
 * Handles listing contradictions for a project with filtering
 * Story: E4.6 - Build Contradictions View (AC: #9)
 *
 * GET /api/projects/[id]/contradictions
 * Query: status (optional: 'all' | 'unresolved' | 'resolved' | 'investigating' | 'noted')
 * Response: { contradictions: ContradictionWithFindings[], total: number, page: number, limit: number, hasMore: boolean }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type {
  ContradictionWithFindings,
  ContradictionStatus,
  ContradictionResolutionAction,
} from '@/lib/types/contradictions'
import type { Finding, FindingStatus, ValidationEvent } from '@/lib/types/findings'
import type { Json } from '@/lib/supabase/database.types'

// Query parameter validation schema
const ContradictionsQuerySchema = z.object({
  status: z
    .enum(['all', 'unresolved', 'resolved', 'investigating', 'noted'])
    .optional()
    .default('unresolved'),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(parseInt(val, 10), 100) : 50)),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * Map database finding row to Finding type
 */
function mapFindingFromDb(row: {
  id: string
  deal_id: string
  document_id: string | null
  chunk_id: string | null
  user_id: string
  text: string
  source_document: string | null
  page_number: number | null
  confidence: number | null
  finding_type: string | null
  domain: string | null
  status?: string | null
  validation_history?: Json
  metadata: Json | null
  created_at: string
  updated_at: string | null
}): Finding {
  return {
    id: row.id,
    dealId: row.deal_id,
    documentId: row.document_id,
    chunkId: row.chunk_id,
    userId: row.user_id,
    text: row.text,
    sourceDocument: row.source_document,
    pageNumber: row.page_number,
    confidence: row.confidence,
    findingType: row.finding_type as Finding['findingType'],
    domain: row.domain as Finding['domain'],
    status: (row.status as FindingStatus) || 'pending',
    validationHistory: (row.validation_history as unknown as ValidationEvent[]) || [],
    metadata: row.metadata as Record<string, unknown> | null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * GET /api/projects/[id]/contradictions
 * Fetch paginated contradictions for a project with optional status filter
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())

    // Validate query parameters
    const parseResult = ContradictionsQuerySchema.safeParse(searchParams)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { status, page, limit } = parseResult.data

    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
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

    // Build query for contradictions with joined findings
    let query = supabase
      .from('contradictions')
      .select(
        `
        *,
        finding_a:findings!contradictions_finding_a_id_fkey(*),
        finding_b:findings!contradictions_finding_b_id_fkey(*)
      `,
        { count: 'exact' }
      )
      .eq('deal_id', projectId)

    // Apply status filter (default is 'unresolved')
    if (status !== 'all') {
      query = query.eq('status', status)
    }

    // Order by detected_at descending (newest first)
    query = query.order('detected_at', { ascending: false })

    // Apply pagination
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('[api/contradictions] Error fetching contradictions:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform database records to API response format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contradictions: ContradictionWithFindings[] = (data || []).map((row: any) => {
      // Type assertion for the joined data
      const findingA = row.finding_a as unknown as {
        id: string
        deal_id: string
        document_id: string | null
        chunk_id: string | null
        user_id: string
        text: string
        source_document: string | null
        page_number: number | null
        confidence: number | null
        finding_type: string | null
        domain: string | null
        status?: string | null
        validation_history?: Json
        metadata: Json | null
        created_at: string
        updated_at: string | null
      }

      const findingB = row.finding_b as unknown as {
        id: string
        deal_id: string
        document_id: string | null
        chunk_id: string | null
        user_id: string
        text: string
        source_document: string | null
        page_number: number | null
        confidence: number | null
        finding_type: string | null
        domain: string | null
        status?: string | null
        validation_history?: Json
        metadata: Json | null
        created_at: string
        updated_at: string | null
      }

      return {
        id: row.id,
        dealId: row.deal_id,
        findingAId: row.finding_a_id,
        findingBId: row.finding_b_id,
        confidence: row.confidence,
        status: (row.status as ContradictionStatus) || 'unresolved',
        resolution: row.resolution as ContradictionResolutionAction | null,
        resolutionNote: row.resolution_note,
        detectedAt: row.detected_at,
        resolvedAt: row.resolved_at,
        resolvedBy: row.resolved_by,
        metadata: row.metadata as Record<string, unknown> | null,
        findingA: mapFindingFromDb(findingA),
        findingB: mapFindingFromDb(findingB),
      }
    })

    const total = count || 0
    const hasMore = offset + contradictions.length < total

    return NextResponse.json({
      contradictions,
      total,
      page,
      limit,
      hasMore,
    })
  } catch (err) {
    console.error('[api/contradictions] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
