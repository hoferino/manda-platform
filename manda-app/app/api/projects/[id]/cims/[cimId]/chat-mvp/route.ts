/**
 * CIM MVP Chat API Route
 *
 * Workflow-based CIM agent endpoint.
 * Uses JSON knowledge file from manda-analyze skill.
 *
 * Story: CIM MVP Workflow Fix (Story 5)
 *
 * Features:
 * - SSE streaming for real-time responses
 * - Workflow progress tracking events
 * - Outline creation/update events
 * - Section navigation events
 * - Slide update events with layout support
 * - Database sync for outline and workflow state
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { streamCIMMVP, executeCIMMVP, getCIMMVPGraph } from '@/lib/agent/cim-mvp'
import type { CIMOutline, WorkflowProgress, CIMMVPStreamEvent } from '@/lib/agent/cim-mvp'
import { getSSEHeaders } from '@/lib/agent/streaming'
import { updateCIM } from '@/lib/services/cim'
import type { ConversationMessage } from '@/lib/types/cim'
import type { Json } from '@/lib/supabase/types'

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
 * Story 5.6: Sync outline to CIM database record
 */
async function syncOutlineToCIM(
  cimId: string,
  outline: CIMOutline
): Promise<void> {
  try {
    const supabase = await createClient()
    // Store outline sections in the CIM record
    // Cast to Json for Supabase type compatibility
    await supabase
      .from('cims')
      .update({ outline: outline.sections as unknown as Json })
      .eq('id', cimId)

    console.log(`[syncOutlineToCIM] Synced outline with ${outline.sections.length} sections to CIM ${cimId}`)
  } catch (error) {
    console.error('[syncOutlineToCIM] Error:', error)
    // Don't throw - this is best-effort persistence
  }
}

/**
 * Story 5.7: Sync workflow progress for session resume
 */
async function syncWorkflowProgressToCIM(
  cimId: string,
  workflowProgress: WorkflowProgress
): Promise<void> {
  try {
    const supabase = await createClient()
    // Store workflow progress in the CIM record's workflow_state column
    // Cast to Json for Supabase type compatibility
    await supabase
      .from('cims')
      .update({ workflow_state: workflowProgress as unknown as Json })
      .eq('id', cimId)

    console.log(`[syncWorkflowProgressToCIM] Synced workflow progress (stage: ${workflowProgress.currentStage}) to CIM ${cimId}`)
  } catch (error) {
    console.error('[syncWorkflowProgressToCIM] Error:', error)
    // Don't throw - this is best-effort persistence
  }
}

/**
 * Handle streaming chat request using SSE
 * Story 5: Enhanced with database sync for outline and workflow progress
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
        // Track latest state for end-of-stream sync
        let latestOutline: CIMOutline | null = null
        let latestWorkflowProgress: WorkflowProgress | null = null

        // Stream events from the CIM MVP agent
        for await (const event of streamCIMMVP(message, threadId, knowledgePath)) {
          const data = `data: ${JSON.stringify(event)}\n\n`
          controller.enqueue(encoder.encode(data))

          // Story 5.6: Sync outline when created or updated
          if (event.type === 'outline_created' || event.type === 'outline_updated') {
            latestOutline = { sections: event.data.sections }
            // Sync immediately for outline creation/updates
            await syncOutlineToCIM(cimId, latestOutline)
          }

          // Story 5.7: Track workflow progress for end-of-stream sync
          if (event.type === 'workflow_progress') {
            latestWorkflowProgress = {
              currentStage: event.data.currentStage,
              completedStages: event.data.completedStages,
              currentSectionId: event.data.currentSectionId || undefined,
              sectionProgress: {}, // Will be populated from full state
            }
          }
        }

        // After streaming completes, sync conversation and workflow state
        await syncConversationToCIM(cimId, threadId)

        // Sync final workflow progress if changed during stream
        if (latestWorkflowProgress) {
          // Get full state for complete workflow progress
          const graph = await getCIMMVPGraph()
          const config = { configurable: { thread_id: threadId } }
          const finalState = await graph.getState(config)
          if (finalState.values?.workflowProgress) {
            await syncWorkflowProgressToCIM(cimId, finalState.values.workflowProgress)
          }
        }
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

    // Return MVP agent info (Story 5: updated with workflow stages)
    return NextResponse.json({
      agent: 'cim-mvp',
      version: '2.0.0',
      workflowStages: [
        'welcome',
        'buyer_persona',
        'hero_concept',
        'investment_thesis',
        'outline',
        'building_sections',
        'complete',
      ],
      tools: [
        'web_search',
        'knowledge_search',
        'get_section_context',
        'update_slide',
        'advance_workflow',
        'save_buyer_persona',
        'save_hero_concept',
        'create_outline',
        'update_outline',
        'start_section',
        'save_context',
      ],
      sseEventTypes: [
        'token',
        'slide_update',
        'workflow_progress',
        'outline_created',
        'outline_updated',
        'section_started',
        'sources',
        'done',
        'error',
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
