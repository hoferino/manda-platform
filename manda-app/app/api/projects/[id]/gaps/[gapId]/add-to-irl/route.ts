/**
 * Add Gap to IRL API Route
 * Handles creating a new IRL item from an information gap
 * Story: E4.8 - Build Gap Analysis View (AC: #5)
 *
 * POST /api/projects/[id]/gaps/[gapId]/add-to-irl
 * Body: { irlId: string, name?: string, category?: string, required?: boolean }
 * Response: { success: boolean, irlItemId: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { GapStatus } from '@/lib/types/gaps'

// Request body validation schema
const AddToIRLSchema = z.object({
  irlId: z.string().uuid(),
  name: z.string().optional(),
  category: z.string().default('Additional Request'),
  required: z.boolean().default(true),
})

interface RouteContext {
  params: Promise<{ id: string; gapId: string }>
}

/**
 * POST /api/projects/[id]/gaps/[gapId]/add-to-irl
 * Create a new IRL item from an information gap
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, gapId } = await context.params

    // Parse and validate request body
    const body = await request.json()
    const parseResult = AddToIRLSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { irlId, name, category, required } = parseResult.data

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

    // Verify IRL belongs to this project
    const { data: irl, error: irlError } = await supabase
      .from('irls')
      .select('id')
      .eq('id', irlId)
      .eq('deal_id', projectId)
      .single()

    if (irlError || !irl) {
      return NextResponse.json({ error: 'IRL not found' }, { status: 404 })
    }

    // Get the highest sort order for the category
    const { data: existingItems } = await supabase
      .from('irl_items')
      .select('sort_order')
      .eq('irl_id', irlId)
      .eq('category', category)
      .order('sort_order', { ascending: false })
      .limit(1)

    const sortOrder = existingItems && existingItems.length > 0 && existingItems[0]
      ? (existingItems[0].sort_order || 0) + 1
      : 0

    // Extract a reasonable name from the gap ID if not provided
    const itemName = name || extractNameFromGapId(gapId)

    // Create the new IRL item
    const { data: newItem, error: insertError } = await supabase
      .from('irl_items')
      .insert({
        irl_id: irlId,
        category,
        name: itemName,
        description: `Added from gap analysis (Gap ID: ${gapId})`,
        required,
        sort_order: sortOrder,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[api/gaps/add-to-irl] Error creating IRL item:', insertError)
      return NextResponse.json({ error: 'Failed to create IRL item' }, { status: 500 })
    }

    // Mark the gap as resolved in deal metadata
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata = (project.metadata as Record<string, any>) || {}
    const gapResolutions: Record<string, { status: GapStatus; note?: string; resolvedAt: string; resolvedBy: string; irlItemId?: string }> =
      metadata.gapResolutions || {}

    gapResolutions[gapId] = {
      status: 'resolved',
      note: `Added to IRL as: ${itemName}`,
      resolvedAt: new Date().toISOString(),
      resolvedBy: user.id,
      irlItemId: newItem.id,
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

    return NextResponse.json({
      success: true,
      irlItemId: newItem.id,
    })
  } catch (err) {
    console.error('[api/gaps/add-to-irl] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Extract a human-readable name from a gap ID
 */
function extractNameFromGapId(gapId: string): string {
  // Gap IDs are formatted as "info-{domain}" or "irl-{id}"
  const [prefix, suffix] = gapId.split('-', 2)

  if (prefix === 'info' && suffix) {
    // Convert domain to title case
    return `Additional ${suffix.charAt(0).toUpperCase() + suffix.slice(1)} Documentation`
  }

  return 'Additional Information Request'
}
