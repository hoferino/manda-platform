/**
 * User Patterns API Route
 *
 * Story: E7.3 - Enable Response Editing and Learning
 *
 * Endpoints:
 * - GET: Get all patterns for current user
 * - PATCH: Toggle pattern active state
 * - DELETE: Delete a pattern
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getPatterns, togglePatternActive, deletePattern } from '@/lib/services/response-edits'

const TogglePatternSchema = z.object({
  patternId: z.string().uuid(),
  isActive: z.boolean(),
})

const DeletePatternSchema = z.object({
  patternId: z.string().uuid(),
})

/**
 * GET /api/user/patterns
 * Get all patterns for the current user
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get patterns
    const patterns = await getPatterns(user.id)

    return NextResponse.json({ patterns })
  } catch (error) {
    console.error('[patterns-api] Error fetching patterns:', error)
    return NextResponse.json(
      { error: 'Failed to fetch patterns' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/user/patterns
 * Toggle a pattern's active state
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = TogglePatternSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { patternId, isActive } = validation.data

    // Verify pattern belongs to user
    const { data: pattern, error: patternError } = await supabase
      .from('edit_patterns')
      .select('analyst_id')
      .eq('id', patternId)
      .single()

    if (patternError || !pattern) {
      return NextResponse.json({ error: 'Pattern not found' }, { status: 404 })
    }

    if (pattern.analyst_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Toggle pattern
    await togglePatternActive(patternId, isActive)

    return NextResponse.json({ success: true, isActive })
  } catch (error) {
    console.error('[patterns-api] Error toggling pattern:', error)
    return NextResponse.json(
      { error: 'Failed to toggle pattern' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/user/patterns
 * Delete a pattern
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = DeletePatternSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { patternId } = validation.data

    // Verify pattern belongs to user
    const { data: pattern, error: patternError } = await supabase
      .from('edit_patterns')
      .select('analyst_id')
      .eq('id', patternId)
      .single()

    if (patternError || !pattern) {
      return NextResponse.json({ error: 'Pattern not found' }, { status: 404 })
    }

    if (pattern.analyst_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete pattern
    await deletePattern(patternId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[patterns-api] Error deleting pattern:', error)
    return NextResponse.json(
      { error: 'Failed to delete pattern' },
      { status: 500 }
    )
  }
}
