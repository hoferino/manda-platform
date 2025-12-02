/**
 * Chat API Route
 *
 * POST /api/projects/[id]/chat
 * Send a message to the AI agent and receive a streaming SSE response.
 *
 * Story: E5.3 - Build Chat Interface with Conversation History
 * Story: E5.6 - Add Conversation Context and Multi-turn Support
 * AC: #2 (Message Submission), #3 (Streaming Responses), #8 (API Routes)
 * AC: E5.6 #1 (Last N Messages), #3 (Context Persists), #4 (Long Conversations), #5 (Token Management)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ChatRequestSchema } from '@/lib/types/chat'
import {
  createChatAgent,
  streamChat,
} from '@/lib/agent/executor'
import {
  createSSEStream,
  getSSEHeaders,
  AgentStreamHandler,
  generateFollowupSuggestions,
} from '@/lib/agent/streaming'
import {
  ConversationContextManager,
  type DatabaseMessage,
  DEFAULT_CONTEXT_OPTIONS,
} from '@/lib/agent/context'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * Context window size - number of messages to include in LLM context
 * Configured via DEFAULT_CONTEXT_OPTIONS in context.ts (default: 10 messages, 8000 tokens)
 */
const CONTEXT_WINDOW_SIZE = DEFAULT_CONTEXT_OPTIONS.maxMessages

/**
 * POST /api/projects/[id]/chat
 * Send a message and receive streaming SSE response
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params

    // Parse and validate request body
    const body = await request.json()
    const parseResult = ChatRequestSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { message, conversationId } = parseResult.data

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
      .select('id, name')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get or create conversation
    let activeConversationId: string

    if (conversationId) {
      // Verify conversation exists and belongs to user
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
      activeConversationId = conversationId
    } else {
      // Create new conversation
      const title = message.length > 50 ? message.substring(0, 47) + '...' : message
      const { data: newConversation, error: createError } = await supabase
        .from('conversations')
        .insert({
          deal_id: projectId,
          user_id: user.id,
          title,
        })
        .select('id')
        .single()

      if (createError || !newConversation) {
        console.error('[api/chat] Error creating conversation:', createError)
        return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
      }

      activeConversationId = newConversation.id
    }

    // Save user message to database
    const { data: userMessage, error: userMsgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: activeConversationId,
        role: 'user',
        content: message,
      })
      .select('id')
      .single()

    if (userMsgError) {
      console.error('[api/chat] Error saving user message:', userMsgError)
      // Continue anyway - we don't want to block the response
    }

    // Fetch conversation history for context (E5.6: AC1, AC3, AC4, AC5)
    // Load more messages than needed to allow for token-based truncation
    // Note: Only select columns needed for context (sources not required for history)
    const { data: historyMessages } = await supabase
      .from('messages')
      .select('id, conversation_id, role, content, tool_calls, created_at')
      .eq('conversation_id', activeConversationId)
      .order('created_at', { ascending: true })
      .limit(CONTEXT_WINDOW_SIZE * 3) // Load extra for token-aware truncation

    // Use ConversationContextManager for intelligent context formatting
    // This handles token counting and truncation (AC4, AC5)
    const contextManager = new ConversationContextManager()
    const formattedContext = contextManager.loadFromDatabase(
      (historyMessages || []) as unknown as DatabaseMessage[]
    )

    // Log context stats for debugging
    if (formattedContext.wasTruncated) {
      console.log(
        `[api/chat] Context truncated: ${formattedContext.originalMessageCount} → ${formattedContext.messages.length} messages, ${formattedContext.tokenCount} tokens`
      )
    }

    // Convert formatted context to the format expected by streamChat
    // The ConversationContextManager already produces LangChain BaseMessage objects
    // but streamChat expects ConversationMessage format, so we need to convert back
    const chatHistory = (historyMessages || [])
      .slice(-CONTEXT_WINDOW_SIZE * 2)
      .map((msg) => ({
        role: (msg.role === 'human' || msg.role === 'user' ? 'user' :
              msg.role === 'ai' || msg.role === 'assistant' ? 'assistant' :
              msg.role) as 'user' | 'assistant' | 'system',
        content: msg.content,
        timestamp: msg.created_at,
      }))

    // Create SSE stream
    const { stream, writer } = createSSEStream()
    const handler = new AgentStreamHandler(writer)

    // Create the agent
    const agent = createChatAgent({
      dealId: projectId,
      userId: user.id,
      dealName: project.name,
    })

    // Start streaming in the background
    const streamPromise = (async () => {
      try {
        await streamChat(agent, message, chatHistory, {
          onToken: (token) => handler.onToken(token),
          onToolStart: (tool, input) => handler.onToolStart(tool, input),
          onToolEnd: (tool, output) => handler.onToolEnd(tool, output as string),
          onError: (error) => handler.onError(error),
        })

        // Generate follow-up suggestions
        const content = handler.getContent()
        const followups = generateFollowupSuggestions(content)

        // Generate message ID for the response
        const messageId = crypto.randomUUID()

        // Save assistant message to database
        await supabase.from('messages').insert({
          id: messageId,
          conversation_id: activeConversationId,
          role: 'assistant',
          content,
          sources: handler.getSources().length > 0 ? JSON.stringify(handler.getSources()) : null,
        })

        // Update conversation updated_at
        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', activeConversationId)

        // Complete the stream
        handler.onComplete(messageId, followups)
      } catch (error) {
        console.error('[api/chat] Stream error:', error)
        handler.onError(error instanceof Error ? error : new Error(String(error)), 'STREAM_ERROR')
      }
    })()

    // Return the streaming response
    return new NextResponse(stream, {
      headers: {
        ...getSSEHeaders(),
        'X-Conversation-Id': activeConversationId,
      },
    })
  } catch (err) {
    console.error('[api/chat] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
