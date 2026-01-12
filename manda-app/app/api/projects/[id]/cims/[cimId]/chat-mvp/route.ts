/**
 * CIM MVP Chat API Route
 *
 * Simplified CIM agent endpoint for MVP testing.
 * Uses JSON knowledge file from manda-analyze skill.
 *
 * Story: CIM MVP Fast Track
 *
 * Features:
 * - SSE streaming for real-time responses
 * - Slide update events for preview panel
 * - Phase tracking for workflow navigation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { streamCIMMVP, executeCIMMVP, getCIMMVPGraph } from '@/lib/agent/cim-mvp'
import { getSSEHeaders } from '@/lib/agent/streaming'
import { updateCIM } from '@/lib/services/cim'
import type { ConversationMessage } from '@/lib/types/cim'

interface RouteContext {
  params: Promise<{ id: string; cimId: string }>
}

/**
 * POST /api/projects/[id]/cims/[cimId]/chat-mvp
 *
 * Send a message to the CIM MVP agent
 *
 * Body:
 * - message: string (required) - User message
 * - stream: boolean (optional) - Enable SSE streaming (default: true)
 * - knowledgePath: string (optional) - Path to knowledge.json
 * - conversationId: string (optional) - Thread ID for persistence
 *
 * Response (streaming):
 * SSE events: token, slide_update, sources, phase_change, done, error
 *
 * Response (non-streaming):
 * { response: string, currentPhase: string, slideUpdates: array }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, cimId } = await context.params

    const body = await request.json()
    const {
      message,
      stream = true,
      knowledgePath,
      conversationId,
    } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Authenticate user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Thread ID is deterministic per CIM - ensures each CIM has isolated conversation history
    // Don't use Date.now() as that creates new threads on each request
    const threadId = conversationId || `cim-mvp:${cimId}`

    // Handle streaming vs non-streaming
    if (stream) {
      return handleStreamingResponse(message, threadId, cimId, knowledgePath)
    } else {
      return handleNonStreamingResponse(message, threadId, cimId, knowledgePath)
    }
  } catch (err) {
    console.error('[api/cims/chat-mvp] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Sync LangGraph messages to CIM conversation_history in database
 *
 * This ensures conversation is persisted to the CIM record so it loads
 * on page refresh, not just in LangGraph's checkpointer.
 */
async function syncConversationToCIM(
  cimId: string,
  threadId: string
): Promise<void> {
  try {
    const graph = await getCIMMVPGraph()
    const config = { configurable: { thread_id: threadId } }

    // Get current state from LangGraph
    const state = await graph.getState(config)
    if (!state.values?.messages) {
      console.log('[syncConversationToCIM] No messages in state')
      return
    }

    // Convert LangGraph messages to ConversationMessage format
    // Only include user messages and assistant messages with actual text content
    // Skip: tool calls, tool results, and AI messages that only contain tool invocations
    const conversationHistory: ConversationMessage[] = []

    for (const msg of state.values.messages) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msgAny = msg as any
      const msgType = typeof msgAny._getType === 'function'
        ? msgAny._getType()
        : msgAny.type || 'unknown'

      // Skip tool messages (results from tool executions)
      if (msgType === 'tool') continue

      // Skip messages with no content
      if (!msg.content) continue

      // For AI messages, skip if they have tool calls (these are intermediate steps)
      // Only include AI messages that are actual responses to the user
      if (msgType === 'ai' && msgAny.tool_calls?.length > 0) continue

      const role = msgType === 'human' ? 'user' : 'assistant'
      const content = typeof msg.content === 'string'
        ? msg.content
        : JSON.stringify(msg.content)

      // Skip empty content
      if (!content.trim()) continue

      conversationHistory.push({
        id: msgAny.id || crypto.randomUUID(),
        role,
        content,
        timestamp: new Date().toISOString(),
      })
    }

    // Update CIM with conversation history
    const supabase = await createClient()
    await updateCIM(supabase, cimId, { conversationHistory })

    console.log(`[syncConversationToCIM] Synced ${conversationHistory.length} messages to CIM ${cimId}`)
  } catch (error) {
    console.error('[syncConversationToCIM] Error:', error)
    // Don't throw - this is best-effort persistence
  }
}

/**
 * Handle streaming chat request using SSE
 */
function handleStreamingResponse(
  message: string,
  threadId: string,
  cimId: string,
  knowledgePath?: string
): Response {
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Stream events from the CIM MVP agent
        for await (const event of streamCIMMVP(message, threadId, knowledgePath)) {
          const data = `data: ${JSON.stringify(event)}\n\n`
          controller.enqueue(encoder.encode(data))
        }

        // After streaming completes, sync conversation to CIM record
        await syncConversationToCIM(cimId, threadId)
      } catch (error) {
        console.error('[handleStreamingResponse] Error:', error)
        const errorEvent = {
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: getSSEHeaders(),
  })
}

/**
 * Handle non-streaming chat request
 */
async function handleNonStreamingResponse(
  message: string,
  threadId: string,
  cimId: string,
  knowledgePath?: string
): Promise<NextResponse> {
  try {
    const result = await executeCIMMVP(message, threadId, knowledgePath)

    // Sync conversation to CIM record after execution
    await syncConversationToCIM(cimId, threadId)

    return NextResponse.json({
      messageId: crypto.randomUUID(),
      response: result.response,
      currentPhase: result.currentPhase,
      slideUpdates: result.slideUpdates,
      conversationId: threadId,
      error: result.error,
    })
  } catch (error) {
    console.error('[handleNonStreamingResponse] Error:', error)

    return NextResponse.json({
      messageId: crypto.randomUUID(),
      response: 'I encountered an issue processing your request. Please try again.',
      currentPhase: 'executive_summary',
      slideUpdates: [],
      conversationId: threadId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * GET /api/projects/[id]/cims/[cimId]/chat-mvp
 *
 * Get CIM MVP status and available phases
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, cimId } = await context.params

    // Authenticate user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Return MVP agent info
    return NextResponse.json({
      agent: 'cim-mvp',
      version: '1.0.0',
      phases: [
        'executive_summary',
        'company_overview',
        'management_team',
        'products_services',
        'market_opportunity',
        'business_model',
        'financial_performance',
        'competitive_landscape',
        'growth_strategy',
        'risk_factors',
        'appendix',
      ],
      tools: [
        'web_search',
        'knowledge_search',
        'get_section_context',
        'update_slide',
        'navigate_phase',
      ],
      instructions: 'Send a POST request with { message: "your message" } to chat with the CIM MVP agent.',
    })
  } catch (err) {
    console.error('[api/cims/chat-mvp] GET Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
