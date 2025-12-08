/**
 * Response Edits API Route
 *
 * Story: E7.3 - Enable Response Editing and Learning
 *
 * Endpoints:
 * - POST: Save a new response edit
 * - GET: Get edit history for a message
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { saveResponseEdit, getEditHistory } from '@/lib/services/response-edits'
import type { EditType } from '@/lib/types/feedback'

const EditTypeSchema = z.enum(['style', 'content', 'factual', 'formatting'])

const SaveEditSchema = z.object({
  originalText: z.string().min(1),
  editedText: z.string().min(1),
  editType: EditTypeSchema,
})

interface RouteParams {
  params: Promise<{
    id: string
    messageId: string
  }>
}

/**
 * POST /api/projects/[id]/messages/[messageId]/edits
 * Save a response edit
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId, messageId } = await params
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify message belongs to user's project
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .select(`
        id,
        conversations!inner (
          deal_id,
          deals!inner (
            id,
            user_id
          )
        )
      `)
      .eq('id', messageId)
      .single()

    if (msgError || !message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Type assertion for nested query result
    const conversation = message.conversations as unknown as {
      deal_id: string
      deals: { id: string; user_id: string }
    }

    if (conversation.deals.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (conversation.deal_id !== projectId) {
      return NextResponse.json({ error: 'Message not in project' }, { status: 400 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = SaveEditSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { originalText, editedText, editType } = validation.data

    // Save the edit
    const result = await saveResponseEdit(
      messageId,
      originalText,
      editedText,
      editType as EditType,
      user.id
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('[edits-api] Error saving edit:', error)
    return NextResponse.json(
      { error: 'Failed to save edit' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/projects/[id]/messages/[messageId]/edits
 * Get edit history for a message
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId, messageId } = await params
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify message belongs to user's project
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .select(`
        id,
        conversations!inner (
          deal_id,
          deals!inner (
            id,
            user_id
          )
        )
      `)
      .eq('id', messageId)
      .single()

    if (msgError || !message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Type assertion for nested query result
    const conversation = message.conversations as unknown as {
      deal_id: string
      deals: { id: string; user_id: string }
    }

    if (conversation.deals.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (conversation.deal_id !== projectId) {
      return NextResponse.json({ error: 'Message not in project' }, { status: 400 })
    }

    // Get edit history
    const edits = await getEditHistory(messageId)

    return NextResponse.json({ edits })
  } catch (error) {
    console.error('[edits-api] Error fetching edits:', error)
    return NextResponse.json(
      { error: 'Failed to fetch edits' },
      { status: 500 }
    )
  }
}
