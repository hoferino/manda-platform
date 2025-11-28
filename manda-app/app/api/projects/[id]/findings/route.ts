/**
 * Findings API Route
 * Handles CRUD operations for project findings
 * Story: E4.1 - Build Knowledge Explorer UI Main Interface (AC: #5)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { FindingDomain, FindingType, FindingStatus, Finding, ValidationEvent } from '@/lib/types/findings'
import type { Json } from '@/lib/supabase/database.types'

// Query parameter validation schema
const FindingsQuerySchema = z.object({
  documentId: z.string().uuid().optional(),
  domain: z.string().optional().transform(val => val?.split(',') as FindingDomain[] | undefined),
  findingType: z.string().optional().transform(val => val?.split(',') as FindingType[] | undefined),
  status: z.string().optional().transform(val => val?.split(',') as FindingStatus[] | undefined),
  confidenceMin: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  confidenceMax: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  sortBy: z.enum(['confidence', 'createdAt', 'domain']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? Math.min(parseInt(val, 10), 100) : 50),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/projects/[id]/findings
 * Fetch paginated findings for a project with optional filters
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())

    // Validate query parameters
    const parseResult = FindingsQuerySchema.safeParse(searchParams)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const {
      documentId,
      domain,
      findingType,
      status,
      confidenceMin,
      confidenceMax,
      sortBy,
      sortOrder,
      page,
      limit,
    } = parseResult.data

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

    // Build query
    let query = supabase
      .from('findings')
      .select('*', { count: 'exact' })
      .eq('deal_id', projectId)

    // Apply filters
    if (documentId) {
      query = query.eq('document_id', documentId)
    }

    if (domain && domain.length > 0) {
      query = query.in('domain', domain)
    }

    if (findingType && findingType.length > 0) {
      query = query.in('finding_type', findingType)
    }

    if (status && status.length > 0) {
      query = query.in('status', status)
    }

    if (confidenceMin !== undefined) {
      query = query.gte('confidence', confidenceMin)
    }

    if (confidenceMax !== undefined) {
      query = query.lte('confidence', confidenceMax)
    }

    // Apply sorting
    const sortColumn = sortBy === 'createdAt' ? 'created_at' : sortBy
    query = query.order(sortColumn, { ascending: sortOrder === 'asc' })

    // Apply pagination
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('[api/findings] Error fetching findings:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform database records to API response format
    const findings = (data || []).map(row => {
      // Handle extended row with status/validation_history columns
      const extendedRow = row as typeof row & {
        status?: string
        validation_history?: Json
      }

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
        findingType: row.finding_type,
        domain: row.domain,
        status: (extendedRow.status as FindingStatus) || 'pending',
        validationHistory: (extendedRow.validation_history as unknown as ValidationEvent[]) || [],
        metadata: row.metadata as Record<string, unknown> | null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      } satisfies Finding
    })

    const total = count || 0
    const hasMore = offset + findings.length < total

    return NextResponse.json({
      findings,
      total,
      page,
      limit,
      hasMore,
    })
  } catch (err) {
    console.error('[api/findings] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Create finding request schema
const CreateFindingSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  documentId: z.string().uuid().optional(),
  sourceDocument: z.string().optional(),
  pageNumber: z.number().int().positive().optional(),
  confidence: z.number().min(0).max(1).optional().default(0.7),
  findingType: z.enum(['metric', 'fact', 'risk', 'opportunity', 'contradiction']).optional().default('fact'),
  domain: z.enum(['financial', 'operational', 'market', 'legal', 'technical']).optional().default('operational'),
  metadata: z.record(z.string(), z.any()).optional(),
})

/**
 * POST /api/projects/[id]/findings
 * Create a new manual finding
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params

    const body = await request.json()
    const parseResult = CreateFindingSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const findingData = parseResult.data

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

    // Create the finding
    const { data, error } = await supabase
      .from('findings')
      .insert({
        deal_id: projectId,
        user_id: user.id,
        text: findingData.text,
        document_id: findingData.documentId || null,
        source_document: findingData.sourceDocument || null,
        page_number: findingData.pageNumber || null,
        confidence: findingData.confidence,
        finding_type: findingData.findingType,
        domain: findingData.domain,
        metadata: (findingData.metadata || {}) as Json,
      })
      .select()
      .single()

    if (error) {
      console.error('[api/findings] Error creating finding:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const finding: Finding = {
      id: data.id,
      dealId: data.deal_id,
      documentId: data.document_id,
      chunkId: data.chunk_id,
      userId: data.user_id,
      text: data.text,
      sourceDocument: data.source_document,
      pageNumber: data.page_number,
      confidence: data.confidence,
      findingType: data.finding_type,
      domain: data.domain,
      status: 'pending',
      validationHistory: [],
      metadata: data.metadata as Record<string, unknown> | null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }

    return NextResponse.json({ finding }, { status: 201 })
  } catch (err) {
    console.error('[api/findings] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
