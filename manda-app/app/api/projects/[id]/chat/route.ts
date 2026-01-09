/**
 * Chat API Route
 *
 * POST /api/projects/[id]/chat
 * Send a message to the AI agent and receive a streaming SSE response.
 *
 * Architecture: 3-Path Orchestrator
 * - Vanilla: Direct LLM response (greetings, general chat)
 * - Retrieval: Neo4j context injection + LLM (document questions)
 * - Analysis: Subagent routing (complex analysis)
 *
 * Feature Flag: USE_ORCHESTRATOR (default: true)
 * Set to 'false' to use legacy agent system
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
import {
  DEFAULT_CONTEXT_OPTIONS,
} from '@/lib/agent/context'
import { logFeatureUsage } from '@/lib/observability/usage'

// New orchestrator
import {
  streamOrchestrator,
  type OrchestratorResult,
  type RoutePath,
} from '@/lib/agent/orchestrator'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * Context window size - number of messages to include in LLM context
 */
const CONTEXT_WINDOW_SIZE = DEFAULT_CONTEXT_OPTIONS.maxMessages

/**
 * Feature flag: Use new orchestrator (default: true)
 * Set USE_ORCHESTRATOR=false to use legacy agent system
 */
const USE_ORCHESTRATOR = process.env.USE_ORCHESTRATOR !== 'false'

/**
 * POST /api/projects/[id]/chat
 * Send a message and receive streaming SSE response
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

    // Fetch conversation history for context
    const { data: historyMessages } = await supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', activeConversationId)
      .order('created_at', { ascending: true })
      .limit(CONTEXT_WINDOW_SIZE * 2)

    // Convert to chat history format
    const chatHistory = (historyMessages || [])
      .slice(0, -1) // Exclude the message we just saved
      .map((msg) => ({
        role: (msg.role === 'human' || msg.role === 'user' ? 'user' :
              msg.role === 'ai' || msg.role === 'assistant' ? 'assistant' :
              msg.role) as 'user' | 'assistant' | 'system',
        content: msg.content,
      }))

    // Create SSE stream
    const { stream, writer } = createSSEStream()
    const handler = new AgentStreamHandler(writer)

    // Start streaming in the background
    const streamPromise = (async () => {
      try {
        console.log(`[api/chat] Using orchestrator for message: "${message.slice(0, 50)}..."`)

        const result = await streamOrchestrator(
          {
            message,
            dealId: projectId,
            userId: user.id,
            organizationId: project.organization_id ?? undefined,
            chatHistory,
          },
          {
            onToken: (token) => handler.onToken(token),
            onRouteDecision: (routeResult) => {
              console.log(
                `[api/chat] Route decision: ${routeResult.path} ` +
                `(confidence: ${routeResult.confidence.toFixed(2)}, ` +
                `reason: ${routeResult.reason})`
              )
            },
            onError: (error) => handler.onError(error),
          }
        )

        // Generate follow-up suggestions
        const followups = generateFollowupSuggestions(result.content)

        // Generate message ID for the response
        const messageId = crypto.randomUUID()

        // Save assistant message to database
        const { error: assistantMsgError } = await supabase.from('messages').insert({
          id: messageId,
          conversation_id: activeConversationId,
          role: 'assistant',
          content: result.content,
          sources: result.sources.length > 0 ? JSON.stringify(result.sources) : null,
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
              responseLength: result.content.length,
              // Orchestrator metadata
              path: result.path,
              routeConfidence: result.routing.confidence,
              routeReason: result.routing.reason,
              matchedKeywords: result.routing.matchedKeywords,
              // Timing
              routeLatencyMs: result.metrics.routeLatencyMs,
              pathLatencyMs: result.metrics.pathLatencyMs,
              totalLatencyMs: result.metrics.totalLatencyMs,
              // Path-specific
              model: result.metrics.model,
              specialists: result.metrics.specialists,
              retrievalLatencyMs: result.metrics.retrievalLatencyMs,
              hadContext: result.metrics.hadContext,
              sourceCount: result.sources.length,
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
        'X-Agent-Mode': 'orchestrator',
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
