/**
 * Chat API Route (Legacy)
 *
 * POST /api/projects/[id]/chat
 *
 * Story 1.7: This route now forwards to the v2 agent system at /chat-v2.
 * The legacy orchestrator has been removed as part of the agent system v2.0 migration.
 *
 * This route maintains backward compatibility by forwarding requests to chat-v2
 * with appropriate response handling and conversation management.
 *
 * @deprecated Use /api/projects/[id]/chat-v2 for new integrations
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createClientFromAuthHeader } from '@/lib/supabase/server'
import { ChatRequestSchema } from '@/lib/types/chat'
import { toUserFacingError } from '@/lib/errors/types'
import {
  createSSEStream,
  getSSEHeaders,
  AgentStreamHandler,
  generateFollowupSuggestions,
} from '@/lib/agent/streaming'
import { logFeatureUsage } from '@/lib/observability/usage'
import { HumanMessage } from '@langchain/core/messages'
import {
  createV2ThreadId,
  safeStreamAgent,
  createInitialState,
  toUserFriendlyMessage,
  type SafeStreamErrorEvent,
} from '@/lib/agent/v2'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * POST /api/projects/[id]/chat
 * Send a message and receive streaming SSE response
 *
 * Story 1.7: Now uses Agent System v2.0 instead of legacy orchestrator.
 * Maintains same API contract for backward compatibility.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const chatStartTime = Date.now()

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

    // Try cookie-based auth first, then fall back to Authorization header
    // This supports both browser sessions and API clients (benchmarks, CLI tools)
    let supabase = await createClient()
    let user = (await supabase.auth.getUser()).data.user

    if (!user) {
      // Try Authorization header (Bearer token)
      const authHeader = request.headers.get('Authorization')
      const headerClient = await createClientFromAuthHeader(authHeader)
      if (headerClient) {
        supabase = headerClient
        user = (await supabase.auth.getUser()).data.user
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify user has access to this project and get organization_id
    const { data: project, error: projectError } = await supabase
      .from('deals')
      .select('id, name, organization_id')
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
    const { error: userMsgError } = await supabase
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

    // Create SSE stream
    const { stream, writer } = createSSEStream()
    const handler = new AgentStreamHandler(writer)

    // Build thread ID for v2 agent (Story 1.7: using v2 system)
    const threadId = createV2ThreadId('chat', projectId, user.id, activeConversationId)

    // Create initial state for v2 agent
    const state = createInitialState('chat', projectId, user.id)
    state.messages = [new HumanMessage(message)]

    // Start streaming in the background using v2 agent
    // Note: This IIFE runs asynchronously to populate the SSE stream.
    // Errors are caught and sent via handler.onError(), not thrown.
    void (async () => {
      try {
        let fullContent = ''

        // Stream using v2 agent
        for await (const event of safeStreamAgent(state, threadId, {
          metadata: {
            api_route: '/api/projects/[id]/chat',
            deal_id: projectId,
            user_id: user.id,
            conversation_id: activeConversationId,
          },
        })) {
          // Check for error events using type guard
          if ('type' in event && event.type === 'error') {
            const errorEvent = event as SafeStreamErrorEvent
            handler.onError(
              new Error(toUserFriendlyMessage(errorEvent.error)),
              errorEvent.error.code
            )
            return
          }

          // Handle LangGraph stream events using type guards
          if ('event' in event && 'data' in event) {
            const streamEvent = event as { event: string; data?: unknown }
            if (streamEvent.event === 'on_llm_stream' && streamEvent.data) {
              // Safely extract token content with optional chaining
              const data = streamEvent.data as Record<string, unknown>
              const chunk = data.chunk as Record<string, unknown> | undefined
              const token = typeof chunk?.content === 'string' ? chunk.content : undefined
              if (token) {
                fullContent += token
                handler.onToken(token)
              }
            }
          }
        }

        // Generate follow-up suggestions
        const followups = generateFollowupSuggestions(fullContent)

        // Generate message ID for the response
        const messageId = crypto.randomUUID()

        // Save assistant message to database
        const { error: assistantMsgError } = await supabase.from('messages').insert({
          id: messageId,
          conversation_id: activeConversationId,
          role: 'assistant',
          content: fullContent,
        })

        if (assistantMsgError) {
          console.error('[api/chat] Error saving assistant message:', assistantMsgError)
        } else {
          console.log('[api/chat] Assistant message saved:', messageId)
        }

        // Update conversation updated_at
        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', activeConversationId)

        // Log feature usage
        try {
          await logFeatureUsage({
            dealId: projectId,
            userId: user.id,
            organizationId: project.organization_id ?? undefined,
            featureName: 'chat',
            status: 'success',
            durationMs: Date.now() - chatStartTime,
            metadata: {
              conversationId: activeConversationId,
              messageLength: message.length,
              responseLength: fullContent.length,
              agentVersion: 'v2',
            },
          })
        } catch (loggingError) {
          console.error('[api/chat] Usage logging failed:', loggingError)
        }

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
        'X-Agent-Mode': 'v2',
      },
    })
  } catch (err) {
    const userError = toUserFacingError(err)
    console.error('[api/chat] Error:', userError.cause ?? err)

    return NextResponse.json(
      {
        error: userError.message,
        isRetryable: userError.isRetryable,
        errorType: userError.constructor.name,
      },
      { status: userError.statusCode }
    )
  }
}
