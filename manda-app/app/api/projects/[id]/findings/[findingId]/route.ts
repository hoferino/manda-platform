/**
 * Individual Finding API Route
 * Handles GET and PATCH operations for individual findings
 * Story: E4.3 - Implement Inline Finding Validation (AC: 6)
 * Story: E4.9 - Implement Finding Detail View with Full Context (AC: 2, 3, 4, 5, 6)
 *
 * GET /api/projects/[id]/findings/[findingId] - Get finding with full context
 * PATCH /api/projects/[id]/findings/[findingId] - Update finding text/status
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { Finding, FindingStatus, FindingWithContext, ValidationEvent, FindingDomain } from '@/lib/types/findings'
import type { Json } from '@/lib/supabase/database.types'

interface RouteContext {
  params: Promise<{ id: string; findingId: string }>
}

/**
 * GET /api/projects/[id]/findings/[findingId]
 * Get a single finding with full context including:
 * - Document information
 * - Chunk content with sheet/cell info
 * - Related findings (semantic similarity)
 * - Validation history
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, findingId } = await context.params

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

    // Fetch the finding with document join
    const { data: findingData, error: findingError } = await supabase
      .from('findings')
      .select(`
        *,
        documents:document_id (
          id,
          file_name,
          file_path
        )
      `)
      .eq('id', findingId)
      .eq('deal_id', projectId)
      .single()

    if (findingError || !findingData) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 })
    }

    // Fetch chunk data if finding has a chunk_id
    let chunkData: {
      id: string
      content: string
      sheet_name: string | null
      cell_reference: string | null
      page_number: number | null
    } | null = null

    if (findingData.chunk_id) {
      const { data: chunk } = await supabase
        .from('document_chunks')
        .select('id, content, sheet_name, cell_reference, page_number')
        .eq('id', findingData.chunk_id)
        .single()

      chunkData = chunk
    }

    // Fetch related findings using semantic similarity
    // Use the finding's embedding to find similar findings
    let relatedFindings: Finding[] = []

    try {
      // Check if the finding has an embedding
      const { data: findingWithEmbedding } = await supabase
        .from('findings')
        .select('embedding')
        .eq('id', findingId)
        .single()

      if (findingWithEmbedding?.embedding) {
        // Call the match_findings RPC for semantic similarity
        const { data: similarFindings } = await supabase.rpc('match_findings', {
          query_embedding: JSON.stringify(findingWithEmbedding.embedding),
          match_threshold: 0.5, // Only return reasonably similar findings
          match_count: 6, // Get 6 to exclude the current finding and still have 5
          p_deal_id: projectId,
          p_document_id: undefined,
          p_domains: undefined,
          p_statuses: undefined,
          p_confidence_min: undefined,
          p_confidence_max: undefined,
        })

        if (similarFindings) {
          // Filter out the current finding and limit to 5
          relatedFindings = similarFindings
            .filter((f: { id: string }) => f.id !== findingId)
            .slice(0, 5)
            .map((row: {
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
              status: string | null
              validation_history: unknown
              metadata: unknown
              created_at: string
              updated_at: string | null
              similarity: number
            }) => ({
              id: row.id,
              dealId: row.deal_id,
              documentId: row.document_id || null,
              chunkId: row.chunk_id || null,
              userId: row.user_id,
              text: row.text,
              sourceDocument: row.source_document || null,
              pageNumber: row.page_number || null,
              confidence: row.confidence || null,
              findingType: row.finding_type as Finding['findingType'],
              domain: row.domain as FindingDomain | null,
              status: (row.status as FindingStatus) || 'pending',
              validationHistory: (row.validation_history as unknown as ValidationEvent[]) || [],
              metadata: row.metadata as Record<string, unknown> | null,
              createdAt: row.created_at,
              updatedAt: row.updated_at || null,
              similarity: row.similarity,
            }))
        }
      }
    } catch (err) {
      // If semantic search fails, continue without related findings
      console.warn('[api/findings/[findingId]] Related findings search error:', err)
    }

    // Transform to API response format
    const extendedRow = findingData as typeof findingData & {
      status?: string
      validation_history?: Json
      documents?: {
        id: string
        file_name: string
        file_path: string
      } | null
    }

    const finding: FindingWithContext = {
      id: findingData.id,
      dealId: findingData.deal_id,
      documentId: findingData.document_id,
      chunkId: findingData.chunk_id,
      userId: findingData.user_id,
      text: findingData.text,
      sourceDocument: findingData.source_document,
      pageNumber: findingData.page_number,
      confidence: findingData.confidence,
      findingType: findingData.finding_type,
      domain: findingData.domain,
      status: (extendedRow.status as FindingStatus) || 'pending',
      validationHistory: (extendedRow.validation_history as unknown as ValidationEvent[]) || [],
      metadata: findingData.metadata as Record<string, unknown> | null,
      createdAt: findingData.created_at,
      updatedAt: findingData.updated_at,
      // Extended context fields
      document: extendedRow.documents
        ? {
            id: extendedRow.documents.id,
            name: extendedRow.documents.file_name,
            filePath: extendedRow.documents.file_path,
          }
        : null,
      chunk: chunkData
        ? {
            id: chunkData.id,
            content: chunkData.content,
            sheetName: chunkData.sheet_name,
            cellReference: chunkData.cell_reference,
            pageNumber: chunkData.page_number,
          }
        : null,
      relatedFindings,
    }

    return NextResponse.json({ finding })
  } catch (err) {
    console.error('[api/findings/[findingId]] GET Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH request body validation schema
const UpdateFindingSchema = z.object({
  text: z.string().min(1, 'Text cannot be empty').optional(),
  status: z.enum(['pending', 'validated', 'rejected']).optional(),
  confidence: z.number().min(0).max(1).optional(),
})

/**
 * PATCH /api/projects/[id]/findings/[findingId]
 * Update a finding's text, status, or confidence
 * Records edit in validation_history with previous and new values
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, findingId } = await context.params

    // Validate request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parseResult = UpdateFindingSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const updates = parseResult.data

    // Ensure at least one field is being updated
    if (!updates.text && !updates.status && updates.confidence === undefined) {
      return NextResponse.json(
        { error: 'At least one field (text, status, or confidence) must be provided' },
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

    // Verify user has access to this project
    const { data: project, error: projectError } = await supabase
      .from('deals')
      .select('id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Fetch the current finding
    const { data: existingFinding, error: findingError } = await supabase
      .from('findings')
      .select('*')
      .eq('id', findingId)
      .eq('deal_id', projectId)
      .single()

    if (findingError || !existingFinding) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 })
    }

    // Get current validation history
    const extendedFinding = existingFinding as typeof existingFinding & {
      status?: string
      validation_history?: Json
    }
    const currentHistory = (extendedFinding.validation_history as unknown as ValidationEvent[]) || []

    // Build update object and create validation events for changes
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    const newEvents: ValidationEvent[] = []

    // Handle text update - record edit in history
    if (updates.text !== undefined && updates.text !== existingFinding.text) {
      updateData.text = updates.text

      newEvents.push({
        action: 'edited',
        previousValue: existingFinding.text,
        newValue: updates.text,
        timestamp: new Date().toISOString(),
        userId: user.id,
      })
    }

    // Handle status update
    if (updates.status !== undefined && updates.status !== extendedFinding.status) {
      updateData.status = updates.status

      // Record status change in history
      const action = updates.status === 'validated' ? 'validated' : updates.status === 'rejected' ? 'rejected' : 'edited'
      newEvents.push({
        action,
        previousValue: extendedFinding.status || 'pending',
        newValue: updates.status,
        timestamp: new Date().toISOString(),
        userId: user.id,
      })
    }

    // Handle confidence update
    if (updates.confidence !== undefined) {
      updateData.confidence = updates.confidence
    }

    // Add new events to history
    if (newEvents.length > 0) {
      updateData.validation_history = [...currentHistory, ...newEvents] as unknown as Json
    }

    // Update the finding
    const { data: updatedFinding, error: updateError } = await supabase
      .from('findings')
      .update(updateData)
      .eq('id', findingId)
      .eq('deal_id', projectId)
      .select()
      .single()

    if (updateError) {
      console.error('[api/findings/[findingId]] PATCH Error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Transform to API response format
    const updatedExtended = updatedFinding as typeof updatedFinding & {
      status?: string
      validation_history?: Json
    }

    const finding: Finding = {
      id: updatedFinding.id,
      dealId: updatedFinding.deal_id,
      documentId: updatedFinding.document_id,
      chunkId: updatedFinding.chunk_id,
      userId: updatedFinding.user_id,
      text: updatedFinding.text,
      sourceDocument: updatedFinding.source_document,
      pageNumber: updatedFinding.page_number,
      confidence: updatedFinding.confidence,
      findingType: updatedFinding.finding_type,
      domain: updatedFinding.domain,
      status: (updatedExtended.status as FindingStatus) || 'pending',
      validationHistory: (updatedExtended.validation_history as unknown as ValidationEvent[]) || [],
      metadata: updatedFinding.metadata as Record<string, unknown> | null,
      createdAt: updatedFinding.created_at,
      updatedAt: updatedFinding.updated_at,
    }

    return NextResponse.json({ finding })
  } catch (err) {
    console.error('[api/findings/[findingId]] PATCH Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
