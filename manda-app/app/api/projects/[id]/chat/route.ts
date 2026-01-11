/**
 * Chat API Route (Agent System v2.0)
 *
 * Story: 1-4 Implement Thread ID Generation and Management
 * Story: 1-6 Implement Basic Error Recovery (AC: #4)
 * Story: 1-7 Remove Legacy Agent Code (route consolidation)
 * Story: 2-2 Implement Real-Time Token Streaming (AC: #1, #4, #7)
 * Story: 3-2 Implement Source Attribution (AC: #1, #3, #4)
 * POST /api/projects/[id]/chat
 *
 * Entry point for Agent System v2.0 conversations. Connects the frontend
 * chat UI to the LangGraph-based agent with PostgresSaver checkpointing.
 *
 * Features:
 * - Thread ID generation for new conversations
 * - Thread resumption for existing conversations
 * - Deal-scoped isolation via RLS
 * - SSE streaming of agent responses with real-time token streaming
 * - Proper error handling with structured error events (Story 1.6)
 *
 * References:
 * - [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Chat API Route]
 * - [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Error Handling Patterns]
 * - [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Streaming Event Patterns]
 * - [Source: CLAUDE.md#Agent System v2.0]
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { HumanMessage } from '@langchain/core/messages'
import {
  createV2ThreadId,
  streamAgentWithTokens,
  createInitialState,
  generateConversationId,
  toUserFriendlyMessage,
  type TokenStreamEvent,
  type SourceAddedEvent,
  type SourceCitation,
} from '@/lib/agent/v2'
import { AgentErrorCode, type AgentError } from '@/lib/agent/v2'

// =============================================================================
// Request Validation (AC: #1 - Task 4)
// =============================================================================

/**
 * Valid workflow modes for v2 agent
 */
const WorkflowModeSchema = z.enum(['chat', 'cim', 'irl'])

/**
 * Chat v2 request body schema
 */
const ChatV2RequestSchema = z.object({
  /** User message content */
  message: z
    .string()
    .min(1, 'Message is required')
    .max(10000, 'Message exceeds maximum length of 10,000 characters'),
  /** Existing conversation ID (UUID) for thread resumption */
  conversationId: z.string().uuid().optional(),
  /** Workflow mode determines system prompt and tool filtering */
  workflowMode: WorkflowModeSchema.optional().default('chat'),
})

// =============================================================================
// Route Context Type
// =============================================================================

interface RouteContext {
  params: Promise<{ id: string }>
}

// =============================================================================
// POST Handler
// =============================================================================

/**
 * POST /api/projects/[id]/chat
 *
 * Send a message to the v2 agent and receive a streaming SSE response.
 *
 * Request body:
 * - message: string (required) - User's message
 * - conversationId?: string (optional) - UUID to resume existing conversation
 * - workflowMode?: 'chat' | 'cim' | 'irl' (optional, default: 'chat')
 *
 * Response:
 * - SSE stream of agent events
 * - X-Conversation-Id header with conversation UUID
 *
 * Error responses:
 * - 400: Invalid request (missing message, invalid format)
 * - 401: Unauthorized (no auth session)
 * - 404: Deal not found
 * - 500: Internal server error
 *
 * SSE Error Event Format (Story 1.6):
 * ```json
 * {
 *   "type": "error",
 *   "error": {
 *     "code": "LLM_ERROR",
 *     "message": "I'm having trouble thinking. Let me try again."
 *   },
 *   "conversationId": "...",
 *   "timestamp": "..."
 * }
 * ```
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // Extract deal ID from route params
    const { id: dealId } = await context.params

    // ==========================================================================
    // Authentication (AC: #3 - Task 5)
    // ==========================================================================
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ==========================================================================
    // Deal Access Verification (AC: #3 - Task 5)
    // ==========================================================================
    // RLS policy automatically enforces access control
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('id, name')
      .eq('id', dealId)
      .single()

    if (dealError || !deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    // ==========================================================================
    // Request Validation (AC: #1 - Task 4)
    // ==========================================================================
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parseResult = ChatV2RequestSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const {
      message,
      conversationId: providedConversationId,
      workflowMode,
    } = parseResult.data

    // Note: conversationId is already validated as UUID by Zod schema

    // ==========================================================================
    // Conversation ID Management (AC: #1, #2 - Tasks 2, 3)
    // ==========================================================================
    // Generate new conversation ID or use existing for thread resumption
    const conversationId = providedConversationId || generateConversationId()

    // Build thread ID for checkpointer isolation
    // Format: {workflowMode}:{dealId}:{userId}:{conversationId}
    const threadId = createV2ThreadId(
      workflowMode,
      dealId,
      user.id,
      conversationId
    )

    // ==========================================================================
    // Agent State Initialization (AC: #2 - Task 3)
    // ==========================================================================
    // Create initial state with workflow mode and deal context placeholder
    // Context loader middleware (Story 3-1) will populate full deal context
    const state = createInitialState(workflowMode, dealId, user.id)

    // Add user message to state
    // messagesStateReducer will append to existing messages if resuming
    state.messages = [new HumanMessage(message)]

    // ==========================================================================
    // SSE Streaming Response with Token Streaming (Story 2-2 AC: #1, #4, #7)
    // ==========================================================================
    const encoder = new TextEncoder()

    // Track accumulated content and sources for done event (AC #6, Story 3-2)
    let fullContent = ''
    const collectedSources: SourceCitation[] = []
    const messageId = crypto.randomUUID()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Use streamAgentWithTokens for real-time token streaming
          for await (const event of streamAgentWithTokens(state, threadId, {
            metadata: {
              api_route: '/api/projects/[id]/chat',
              deal_id: dealId,
              user_id: user.id,
              conversation_id: conversationId,
            },
          })) {
            // Handle token events from streamAgentWithTokens (Story 2-2)
            if ('type' in event && event.type === 'token') {
              const tokenEvent = event as TokenStreamEvent
              // Accumulate content for done event
              fullContent += tokenEvent.content
              const sseData = JSON.stringify({
                type: 'token',
                content: tokenEvent.content,
                node: tokenEvent.node,
                conversationId,
                timestamp: tokenEvent.timestamp,
              })
              controller.enqueue(encoder.encode(`data: ${sseData}\n\n`))
              continue
            }

            // Handle source_added events from streamAgentWithTokens (Story 3-2)
            if ('type' in event && event.type === 'source_added') {
              const sourceEvent = event as SourceAddedEvent
              // Collect sources for done event
              collectedSources.push(sourceEvent.source)
              const sseData = JSON.stringify({
                type: 'source_added',
                source: sourceEvent.source,
                conversationId,
                timestamp: sourceEvent.timestamp,
              })
              controller.enqueue(encoder.encode(`data: ${sseData}\n\n`))
              continue
            }

            // Handle original LangGraph stream events (tool calls, etc.)
            // StreamEvent has 'event' and 'data' properties
            const streamEvent = event as { event: string; data?: unknown }
            const sseData = JSON.stringify({
              event: streamEvent.event,
              data: streamEvent.data,
              conversationId,
              timestamp: new Date().toISOString(),
            })
            controller.enqueue(encoder.encode(`data: ${sseData}\n\n`))
          }

          // Send done event with complete response (AC #6, Story 3-2)
          const doneData = JSON.stringify({
            type: 'done',
            messageId,
            content: fullContent,
            sources: collectedSources,
            conversationId,
            timestamp: new Date().toISOString(),
          })
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`))

          controller.close()
        } catch (streamError) {
          // Handle errors during streaming (Story 1.6 AC: #4)
          console.error('[chat] Streaming error:', streamError)

          // Create structured error
          const agentError: AgentError = {
            code: AgentErrorCode.STREAMING_ERROR,
            message:
              streamError instanceof Error
                ? streamError.message
                : 'Stream interrupted',
            recoverable: true,
            timestamp: new Date().toISOString(),
          }

          const errorData = JSON.stringify({
            type: 'error',
            error: {
              code: agentError.code,
              message: toUserFriendlyMessage(agentError),
            },
            conversationId,
            timestamp: new Date().toISOString(),
          })
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))

          controller.close()
        }
      },
    })

    // Return SSE response with conversation ID header
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
        'X-Conversation-Id': conversationId, // For client to store
        'X-Thread-Id': threadId, // For debugging
        'X-Agent-Version': 'v2',
      },
    })
  } catch (error) {
    // Handle errors before streaming starts (auth, validation, etc.)
    console.error('[chat] Unexpected error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
