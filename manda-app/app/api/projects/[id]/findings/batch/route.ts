/**
 * Batch Finding Actions API Route
 * Handles bulk validation/rejection of multiple findings
 * Story: E4.11 - Build Bulk Actions for Finding Management (AC: 7, 8)
 *
 * POST /api/projects/[id]/findings/batch
 * Body: { action: 'confirm' | 'reject', findingIds: string[] }
 * Response: { results: { id, success, finding? }[], summary: { total, succeeded, failed } }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { Finding, FindingStatus, ValidationEvent } from '@/lib/types/findings'
import type { Json } from '@/lib/supabase/database.types'

// Maximum findings per batch request (prevent abuse)
const MAX_BATCH_SIZE = 100

// Request body validation schema
const BatchRequestSchema = z.object({
  action: z.enum(['confirm', 'reject']),
  findingIds: z
    .array(z.string().uuid())
    .min(1, 'At least one finding ID is required')
    .max(MAX_BATCH_SIZE, `Maximum ${MAX_BATCH_SIZE} findings per batch`),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

interface BatchResult {
  id: string
  success: boolean
  finding?: Finding
  error?: string
}

/**
 * POST /api/projects/[id]/findings/batch
 * Batch validate or reject multiple findings
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params

    // Validate request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parseResult = BatchRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { action, findingIds } = parseResult.data

    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify user has access to this project (RLS will also enforce this)
    const { data: project, error: projectError } = await supabase
      .from('deals')
      .select('id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Fetch all findings to validate they exist and belong to this project
    const { data: existingFindings, error: findingsError } = await supabase
      .from('findings')
      .select('*')
      .eq('deal_id', projectId)
      .in('id', findingIds)

    if (findingsError) {
      console.error('[api/findings/batch] Error fetching findings:', findingsError)
      return NextResponse.json({ error: 'Failed to fetch findings' }, { status: 500 })
    }

    // Create a map for quick lookup
    const findingsMap = new Map(existingFindings?.map((f) => [f.id, f]) || [])

    // Process each finding
    const results: BatchResult[] = []
    const newStatus: FindingStatus = action === 'confirm' ? 'validated' : 'rejected'
    const timestamp = new Date().toISOString()

    for (const findingId of findingIds) {
      const existingFinding = findingsMap.get(findingId)

      if (!existingFinding) {
        results.push({
          id: findingId,
          success: false,
          error: 'Finding not found',
        })
        continue
      }

      // Calculate new confidence
      let newConfidence = existingFinding.confidence
      if (action === 'confirm' && newConfidence !== null) {
        newConfidence = Math.min(1, newConfidence + 0.05)
      } else if (action === 'confirm' && newConfidence === null) {
        newConfidence = 0.55 // Default + 0.05
      }

      // Get current validation history
      const currentHistory =
        (existingFinding.validation_history as unknown as ValidationEvent[]) || []

      // Create new validation event
      const validationEvent: ValidationEvent = {
        action: action === 'confirm' ? 'validated' : 'rejected',
        timestamp,
        userId: user.id,
      }

      // Update the finding
      const { data: updatedFinding, error: updateError } = await supabase
        .from('findings')
        .update({
          status: newStatus,
          confidence: newConfidence,
          validation_history: [...currentHistory, validationEvent] as unknown as Json,
          updated_at: timestamp,
        })
        .eq('id', findingId)
        .eq('deal_id', projectId)
        .select()
        .single()

      if (updateError) {
        console.error(`[api/findings/batch] Error updating finding ${findingId}:`, updateError)
        results.push({
          id: findingId,
          success: false,
          error: updateError.message,
        })
        continue
      }

      // Transform to API response format
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
        status: newStatus,
        validationHistory: [...currentHistory, validationEvent],
        metadata: updatedFinding.metadata as Record<string, unknown> | null,
        createdAt: updatedFinding.created_at,
        updatedAt: updatedFinding.updated_at,
      }

      results.push({
        id: findingId,
        success: true,
        finding,
      })
    }

    // Calculate summary
    const succeeded = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length

    return NextResponse.json({
      results,
      summary: {
        total: findingIds.length,
        succeeded,
        failed,
      },
    })
  } catch (err) {
    console.error('[api/findings/batch] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
