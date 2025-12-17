/**
 * Q&A Item API Route - Single Item Operations
 * Handles GET (single), PUT (update with optimistic locking), DELETE operations
 * Story: E8.1 - Q&A Data Model and CRUD API
 * Story: E10.5 - Q&A and Chat Ingestion (AC: #1) - Triggers Graphiti ingestion on answer
 * AC: #3 (PUT succeeds with current updated_at), #4 (PUT returns 409 on conflict), #5 (DELETE returns 204)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  UpdateQAItemInputSchema,
  QAConflictError,
  mapDbRowToQAItem,
  mapQAItemToDbUpdate,
} from '@/lib/types/qa'

interface RouteContext {
  params: Promise<{ id: string; itemId: string }>
}

/**
 * GET /api/projects/[id]/qa/[itemId]
 * Fetch a single Q&A item by ID
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, itemId } = await context.params

    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Fetch the Q&A item (RLS will enforce access control)
    const { data, error } = await supabase
      .from('qa_items')
      .select('*')
      .eq('id', itemId)
      .eq('deal_id', projectId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Q&A item not found' }, { status: 404 })
      }
      console.error('[api/qa/[itemId]] Error fetching Q&A item:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const item = mapDbRowToQAItem(data)

    return NextResponse.json({ item })
  } catch (err) {
    console.error('[api/qa/[itemId]] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/projects/[id]/qa/[itemId]
 * Update a Q&A item with optimistic locking
 * AC: #3 - PUT with current updated_at timestamp succeeds and returns updated item
 * AC: #4 - PUT with stale updated_at returns 409 Conflict with current item state
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, itemId } = await context.params

    const body = await request.json()
    const parseResult = UpdateQAItemInputSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const input = parseResult.data
    const { updatedAt, ...updateFields } = input
    const updateData = mapQAItemToDbUpdate(updateFields)

    // Check if there are actual updates
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update provided' },
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

    // Perform update with optimistic locking (WHERE updated_at = provided value)
    const { data, error } = await supabase
      .from('qa_items')
      .update(updateData)
      .eq('id', itemId)
      .eq('deal_id', projectId)
      .eq('updated_at', updatedAt) // Optimistic locking
      .select('*')

    if (error) {
      console.error('[api/qa/[itemId]] Error updating Q&A item:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Check if update succeeded (row was matched)
    if (!data || data.length === 0) {
      // No rows updated - either item doesn't exist or updated_at didn't match
      // Fetch current item to determine which case
      const { data: currentData, error: fetchError } = await supabase
        .from('qa_items')
        .select('*')
        .eq('id', itemId)
        .eq('deal_id', projectId)
        .single()

      if (fetchError || !currentData) {
        return NextResponse.json({ error: 'Q&A item not found' }, { status: 404 })
      }

      // Item exists but updated_at didn't match - return conflict
      const currentItem = mapDbRowToQAItem(currentData)

      const conflictError: QAConflictError = {
        type: 'conflict',
        message: 'This item was modified by another user. Please review the current values.',
        currentItem,
        yourChanges: updateFields,
      }

      return NextResponse.json(conflictError, { status: 409 })
    }

    const updatedRow = data[0]
    if (!updatedRow) {
      return NextResponse.json({ error: 'Failed to update Q&A item' }, { status: 500 })
    }

    const item = mapDbRowToQAItem(updatedRow)

    // E10.5: Fire-and-forget Graphiti ingestion for Q&A answer
    // Trigger when an answer is provided (date_answered is set)
    if (input.answer && updatedRow.date_answered) {
      const processingApiUrl = process.env.PROCESSING_API_URL
      const processingApiKey = process.env.PROCESSING_API_KEY

      if (processingApiUrl && processingApiKey) {
        // Fire-and-forget: Don't await - let it process asynchronously
        fetch(`${processingApiUrl}/webhooks/qa-answered`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${processingApiKey}`,
          },
          body: JSON.stringify({
            qa_item_id: itemId,
            deal_id: projectId,
            question: updatedRow.question,
            answer: input.answer,
          }),
        })
          .then((response) => {
            if (!response.ok) {
              console.error(
                `[api/qa/[itemId]] Graphiti ingestion webhook failed: ${response.status} ${response.statusText}`
              )
            }
          })
          .catch((err) => {
            // Log but don't fail the response - ingestion is best-effort
            console.error('[api/qa/[itemId]] Failed to trigger Graphiti ingestion:', err)
          })
      } else {
        // Log which specific env var is missing for easier debugging
        const missing = []
        if (!processingApiUrl) missing.push('PROCESSING_API_URL')
        if (!processingApiKey) missing.push('PROCESSING_API_KEY')
        console.warn(
          `[api/qa/[itemId]] Missing env vars: ${missing.join(', ')} - skipping Graphiti ingestion for Q&A ${itemId}`
        )
      }
    }

    return NextResponse.json({ item })
  } catch (err) {
    console.error('[api/qa/[itemId]] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/[id]/qa/[itemId]
 * Delete a Q&A item
 * AC: #5 - DELETE returns 204 No Content and removes the item
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, itemId } = await context.params

    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Check if item exists before deleting
    const { data: existingItem, error: fetchError } = await supabase
      .from('qa_items')
      .select('id')
      .eq('id', itemId)
      .eq('deal_id', projectId)
      .single()

    if (fetchError || !existingItem) {
      return NextResponse.json({ error: 'Q&A item not found' }, { status: 404 })
    }

    // Delete the Q&A item
    const { error } = await supabase
      .from('qa_items')
      .delete()
      .eq('id', itemId)
      .eq('deal_id', projectId)

    if (error) {
      console.error('[api/qa/[itemId]] Error deleting Q&A item:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Return 204 No Content on successful deletion
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('[api/qa/[itemId]] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
