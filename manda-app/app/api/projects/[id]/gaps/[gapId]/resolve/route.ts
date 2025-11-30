/**
 * Gap Resolution API Route
 * Handles resolving gaps (mark as resolved or not applicable)
 * Story: E4.8 - Build Gap Analysis View (AC: #6)
 *
 * POST /api/projects/[id]/gaps/[gapId]/resolve
 * Body: { status: 'resolved' | 'not_applicable' | 'active', note?: string }
 * Response: { gap: Gap }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { Gap, GapStatus } from '@/lib/types/gaps'

// Request body validation schema
const ResolveGapSchema = z.object({
  status: z.enum(['resolved', 'not_applicable', 'active']),
  note: z.string().optional(),
})

interface RouteContext {
  params: Promise<{ id: string; gapId: string }>
}

/**
 * POST /api/projects/[id]/gaps/[gapId]/resolve
 * Resolve a gap by storing resolution in deal metadata
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, gapId } = await context.params

    // Parse and validate request body
    const body = await request.json()
    const parseResult = ResolveGapSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { status, note } = parseResult.data

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

    // Get current gap resolutions from deal metadata
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata = (project.metadata as Record<string, any>) || {}
    const gapResolutions: Record<string, { status: GapStatus; note?: string; resolvedAt: string; resolvedBy: string }> =
      metadata.gapResolutions || {}

    if (status === 'active') {
      // Undo resolution - remove from stored resolutions
      delete gapResolutions[gapId]
    } else {
      // Store resolution
      gapResolutions[gapId] = {
        status: status as GapStatus,
        note,
        resolvedAt: new Date().toISOString(),
        resolvedBy: user.id,
      }
    }

    // Update deal metadata with new gap resolutions
    // Note: metadata column added in migration 00024 - using type assertion until types are regenerated
    const { error: updateError } = await supabase
      .from('deals')
      .update({
        metadata: {
          ...metadata,
          gapResolutions,
        },
      } as Record<string, unknown>)
      .eq('id', projectId)

    if (updateError) {
      console.error('[api/gaps/resolve] Error updating deal metadata:', updateError)
      return NextResponse.json({ error: 'Failed to resolve gap' }, { status: 500 })
    }

    // Parse gap ID to determine type and return appropriate response
    const [prefix, originalId] = gapId.split('-', 2)

    const gap: Gap = {
      id: gapId,
      dealId: projectId,
      category: prefix === 'irl' ? 'irl_missing' : 'information_gap',
      description: '', // Will be populated by client from cached data
      priority: 'medium',
      status: status as GapStatus,
      source: '',
      detectedAt: new Date().toISOString(),
      resolvedAt: status !== 'active' ? new Date().toISOString() : undefined,
      metadata: {
        note,
        originalId,
      },
    }

    return NextResponse.json({ gap })
  } catch (err) {
    console.error('[api/gaps/resolve] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
