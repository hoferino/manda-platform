/**
 * Single Conversation API Route
 *
 * GET /api/projects/[id]/conversations/[conversationId] - Get conversation with messages
 * PATCH /api/projects/[id]/conversations/[conversationId] - Update conversation
 * DELETE /api/projects/[id]/conversations/[conversationId] - Delete conversation
 *
 * Story: E5.3 - Build Chat Interface with Conversation History
 * AC: #5 (Conversation History Sidebar), #7 (Message Persistence), #8 (API Routes)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  ConversationUpdateSchema,
  dbConversationToConversation,
  dbMessageToMessage,
} from '@/lib/types/chat'

interface RouteContext {
  params: Promise<{ id: string; conversationId: string }>
}

/**
 * GET /api/projects/[id]/conversations/[conversationId]
 * Get a conversation with its messages
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, conversationId } = await context.params

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

    // Fetch conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('deal_id', projectId)
      .eq('user_id', user.id)
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Fetch messages
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (msgError) {
      console.error('[api/conversations] Error fetching messages:', msgError)
      return NextResponse.json({ error: msgError.message }, { status: 500 })
    }

    const result = {
      ...dbConversationToConversation(conversation),
      messages: (messages || []).map((msg) =>
        dbMessageToMessage({
          ...msg,
          sources: undefined, // Will be populated when migration is applied
          tokens_used: undefined,
        })
      ),
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[api/conversations] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/projects/[id]/conversations/[conversationId]
 * Update a conversation (e.g., title)
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, conversationId } = await context.params

    // Parse and validate request body
    const body = await request.json()
    const parseResult = ConversationUpdateSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { title } = parseResult.data

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

    // Update conversation
    const { data: conversation, error: updateError } = await supabase
      .from('conversations')
      .update({
        title,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .eq('deal_id', projectId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('[api/conversations] Error updating conversation:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    return NextResponse.json(dbConversationToConversation(conversation))
  } catch (err) {
    console.error('[api/conversations] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/[id]/conversations/[conversationId]
 * Delete a conversation and its messages
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, conversationId } = await context.params

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

    // Delete conversation (messages will cascade delete)
    const { error: deleteError } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId)
      .eq('deal_id', projectId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('[api/conversations] Error deleting conversation:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('[api/conversations] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
