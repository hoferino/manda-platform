/**
 * Messages API Route
 *
 * GET /api/projects/[id]/conversations/[conversationId]/messages - Get messages for a conversation
 *
 * Story: E5.3 - Build Chat Interface with Conversation History
 * AC: #7 (Message Persistence), #8 (API Routes)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MessageQuerySchema, dbMessageToMessage } from '@/lib/types/chat'

interface RouteContext {
  params: Promise<{ id: string; conversationId: string }>
}

/**
 * GET /api/projects/[id]/conversations/[conversationId]/messages
 * Get messages for a conversation with pagination
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, conversationId } = await context.params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())

    // Validate query parameters
    const parseResult = MessageQuerySchema.safeParse(searchParams)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { limit, before } = parseResult.data

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

    // Verify conversation belongs to user
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('deal_id', projectId)
      .eq('user_id', user.id)
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Build query
    let query = supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (before) {
      query = query.lt('created_at', before)
    }

    const { data: messages, error: msgError } = await query

    if (msgError) {
      console.error('[api/messages] Error fetching messages:', msgError)
      return NextResponse.json({ error: msgError.message }, { status: 500 })
    }

    const result = (messages || []).map((msg) =>
      dbMessageToMessage({
        ...msg,
        sources: undefined, // Will be populated when migration is applied
        tokens_used: undefined,
      })
    )

    return NextResponse.json(result)
  } catch (err) {
    console.error('[api/messages] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
