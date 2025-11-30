/**
 * Add Manual Finding API Route
 * Handles creating a manual finding to address an information gap
 * Story: E4.8 - Build Gap Analysis View (AC: #7)
 *
 * POST /api/projects/[id]/gaps/[gapId]/add-finding
 * Body: { text: string, domain: FindingDomain, confidence?: number, sourceNotes?: string }
 * Response: { finding: Finding }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { Finding, FindingDomain, FindingStatus, ValidationEvent } from '@/lib/types/findings'
import type { GapStatus } from '@/lib/types/gaps'
import type { Json } from '@/lib/supabase/database.types'

// Request body validation schema
const AddFindingSchema = z.object({
  text: z.string().min(1, 'Finding text is required'),
  domain: z.enum(['financial', 'operational', 'market', 'legal', 'technical']),
  confidence: z.number().min(0).max(1).default(1.0),
  sourceNotes: z.string().optional(),
})

interface RouteContext {
  params: Promise<{ id: string; gapId: string }>
}

/**
 * POST /api/projects/[id]/gaps/[gapId]/add-finding
 * Create a manual finding to address an information gap
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, gapId } = await context.params

    // Parse and validate request body
    const body = await request.json()
    const parseResult = AddFindingSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { text, domain, confidence, sourceNotes } = parseResult.data

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
    // Note: metadata column added in migration 00024 - using type assertion until types are regenerated
    const { data: project, error: projectError } = await supabase
      .from('deals')
      .select('id, metadata')
      .eq('id', projectId)
      .single() as { data: { id: string; metadata: Record<string, unknown> | null } | null; error: Error | null }

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Create the validation event for the new finding
    const validationEvent: ValidationEvent = {
      action: 'validated',
      timestamp: new Date().toISOString(),
      userId: user.id,
    }

    // Create the new finding
    const { data: newFinding, error: insertError } = await supabase
      .from('findings')
      .insert({
        deal_id: projectId,
        user_id: user.id,
        text,
        domain,
        confidence,
        finding_type: 'fact',
        status: 'validated',
        source_document: sourceNotes ? `Manual entry: ${sourceNotes}` : 'Manual entry from gap analysis',
        validation_history: [validationEvent] as unknown as Json,
        metadata: {
          manualEntry: true,
          fromGapId: gapId,
          sourceNotes,
        },
      })
      .select('*')
      .single()

    if (insertError) {
      console.error('[api/gaps/add-finding] Error creating finding:', insertError)
      return NextResponse.json({ error: 'Failed to create finding' }, { status: 500 })
    }

    // Mark the gap as resolved in deal metadata
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata = (project.metadata as Record<string, any>) || {}
    const gapResolutions: Record<string, { status: GapStatus; note?: string; resolvedAt: string; resolvedBy: string; findingId?: string }> =
      metadata.gapResolutions || {}

    gapResolutions[gapId] = {
      status: 'resolved',
      note: `Manual finding added: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
      resolvedAt: new Date().toISOString(),
      resolvedBy: user.id,
      findingId: newFinding.id,
    }

    // Note: metadata column added in migration 00024 - using type assertion until types are regenerated
    await supabase
      .from('deals')
      .update({
        metadata: {
          ...metadata,
          gapResolutions,
        },
      } as Record<string, unknown>)
      .eq('id', projectId)

    // Transform to Finding type
    const finding: Finding = {
      id: newFinding.id,
      dealId: newFinding.deal_id,
      documentId: newFinding.document_id,
      chunkId: newFinding.chunk_id,
      userId: newFinding.user_id,
      text: newFinding.text,
      sourceDocument: newFinding.source_document,
      pageNumber: newFinding.page_number,
      confidence: newFinding.confidence,
      findingType: newFinding.finding_type as Finding['findingType'],
      domain: newFinding.domain as FindingDomain,
      status: (newFinding.status as FindingStatus) || 'validated',
      validationHistory: (newFinding.validation_history as unknown as ValidationEvent[]) || [],
      metadata: newFinding.metadata as Record<string, unknown> | null,
      createdAt: newFinding.created_at,
      updatedAt: newFinding.updated_at,
    }

    return NextResponse.json({ finding })
  } catch (err) {
    console.error('[api/gaps/add-finding] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
