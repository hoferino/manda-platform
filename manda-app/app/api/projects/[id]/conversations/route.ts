/**
 * Conversations API Route
 *
 * GET /api/projects/[id]/conversations - List conversations for a project
 * POST /api/projects/[id]/conversations - Create a new conversation
 *
 * Story: E5.3 - Build Chat Interface with Conversation History
 * AC: #5 (Conversation History Sidebar), #6 (New Conversation), #8 (API Routes)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ConversationCreateSchema, dbConversationToConversation } from '@/lib/types/chat'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/projects/[id]/conversations
 * List all conversations for a project
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params

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

    // Fetch conversations with message count and last message preview
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        deal_id,
        user_id,
        title,
        created_at,
        updated_at
      `)
      .eq('deal_id', projectId)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (convError) {
      console.error('[api/conversations] Error fetching conversations:', convError)
      return NextResponse.json({ error: convError.message }, { status: 500 })
    }

    // Get message counts and last messages for each conversation
    const conversationsWithDetails = await Promise.all(
      (conversations || []).map(async (conv) => {
        // Get message count
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)

        // Get last message
        const { data: lastMessage } = await supabase
          .from('messages')
          .select('content')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        const baseConv = dbConversationToConversation(conv)
        return {
          ...baseConv,
          messageCount: count || 0,
          lastMessage: lastMessage?.content
            ? lastMessage.content.length > 100
              ? lastMessage.content.substring(0, 97) + '...'
              : lastMessage.content
            : undefined,
        }
      })
    )

    return NextResponse.json(conversationsWithDetails)
  } catch (err) {
    console.error('[api/conversations] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[id]/conversations
 * Create a new conversation
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params

    // Parse and validate request body
    const body = await request.json()
    const parseResult = ConversationCreateSchema.safeParse(body)

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

    // Create the conversation
    const { data: conversation, error: createError } = await supabase
      .from('conversations')
      .insert({
        deal_id: projectId,
        user_id: user.id,
        title: title || null,
      })
      .select()
      .single()

    if (createError) {
      console.error('[api/conversations] Error creating conversation:', createError)
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    return NextResponse.json(dbConversationToConversation(conversation), { status: 201 })
  } catch (err) {
    console.error('[api/conversations] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
