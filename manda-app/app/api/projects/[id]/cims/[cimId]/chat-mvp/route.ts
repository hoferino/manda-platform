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
import {
  streamCIMMVP,
  executeCIMMVP,
  getCIMMVPGraph,
  createKnowledgeService,
  type KnowledgeMode,
} from '@/lib/agent/cim-mvp'
import { setGlobalKnowledgeService } from '@/lib/agent/cim-mvp/tools'
import type { CIMOutline, WorkflowProgress, SlideUpdate, LayoutType as MVPLayoutType, ComponentType as MVPComponentType } from '@/lib/agent/cim-mvp'
import { getSSEHeaders } from '@/lib/agent/streaming'
import { updateCIM } from '@/lib/services/cim'
import type { ConversationMessage, Slide, ComponentType as DBComponentType, LayoutType as DBLayoutType, SlideComponent } from '@/lib/types/cim'
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
      // Story: CIM Knowledge Toggle - accept knowledge mode
      knowledgeMode: rawKnowledgeMode = 'json',
      knowledgePath,
      dealId,
      conversationId,
    } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Validate knowledgeMode - only accept 'json' or 'graphiti' (MEDIUM fix: input validation)
    const validModes: KnowledgeMode[] = ['json', 'graphiti']
    const knowledgeMode: KnowledgeMode = validModes.includes(rawKnowledgeMode as KnowledgeMode)
      ? (rawKnowledgeMode as KnowledgeMode)
      : 'json'

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

    // Story: CIM Knowledge Toggle - create and set knowledge service
    const knowledgeService = createKnowledgeService({
      mode: knowledgeMode,
      knowledgePath: knowledgeMode === 'json' ? knowledgePath : undefined,
      dealId: knowledgeMode === 'graphiti' ? (dealId || projectId) : undefined,
      groupId: knowledgeMode === 'graphiti' ? projectId : undefined,
    })

    // Set global knowledge service for tools to use
    setGlobalKnowledgeService(knowledgeService)
    console.log(`[api/cims/chat-mvp] Knowledge service created in ${knowledgeMode} mode`)

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
 * Map MVP component types to database component types
 */
function mapComponentType(mvpType: MVPComponentType): DBComponentType {
  // Direct mappings
  if (mvpType === 'title' || mvpType === 'subtitle' || mvpType === 'text' || mvpType === 'table' || mvpType === 'image') {
    return mvpType as DBComponentType
  }

  // List types -> bullet
  if (mvpType === 'bullet_list' || mvpType === 'numbered_list') {
    return 'bullet'
  }

  // Chart types -> chart
  if ([
    'bar_chart', 'horizontal_bar_chart', 'stacked_bar_chart', 'line_chart',
    'area_chart', 'pie_chart', 'waterfall_chart', 'combo_chart', 'scatter_plot',
    'gauge', 'progress_bar', 'sparkline', 'funnel', 'gantt_chart',
    'growth_trajectory', 'revenue_breakdown', 'unit_economics', 'valuation_summary'
  ].includes(mvpType)) {
    return 'chart'
  }

  // Table-like types -> table
  if ([
    'comparison_table', 'financial_table', 'feature_comparison',
    'metric', 'metric_group', 'swot', 'matrix', 'pros_cons'
  ].includes(mvpType)) {
    return 'table'
  }

  // Visual/image types -> image
  if ([
    'image_placeholder', 'logo_grid', 'icon_grid', 'screenshot', 'diagram',
    'map', 'location_list', 'org_chart', 'team_grid', 'hierarchy',
    'timeline', 'milestone_timeline', 'flowchart', 'pipeline', 'process_steps',
    'cycle', 'venn', 'versus', 'pyramid', 'hub_spoke'
  ].includes(mvpType)) {
    return 'image'
  }

  // Text-like types -> text
  if ([
    'heading', 'quote', 'callout', 'callout_group', 'stat_highlight',
    'key_takeaway', 'annotation'
  ].includes(mvpType)) {
    return 'text'
  }

  return 'text'
}

/**
 * Map MVP layout types to database layout types
 */
function mapLayoutType(mvpLayoutType: MVPLayoutType): DBLayoutType {
  switch (mvpLayoutType) {
    case 'title-only':
      return 'title_slide'
    case 'title-content':
    case 'full':
    case 'split-vertical':
    case 'thirds-vertical':
      return 'content'
    case 'split-horizontal':
    case 'split-horizontal-weighted':
    case 'comparison':
    case 'sidebar-left':
    case 'sidebar-right':
      return 'two_column'
    case 'quadrant':
    case 'thirds-horizontal':
    case 'six-grid':
    case 'pyramid':
    case 'hub-spoke':
      return 'chart_focus'
    case 'hero-with-details':
      return 'image_focus'
    default:
      return 'content'
  }
}

/**
 * Convert MVP SlideUpdate to database Slide format
 *
 * IMPORTANT: We preserve the original MVP component type and position in metadata
 * so we can reconstruct the full SlideUpdate on page load. This enables proper
 * wireframe rendering with correct layouts and component placement.
 */
function slideUpdateToSlide(update: SlideUpdate): Slide {
  return {
    id: update.slideId,
    section_id: update.sectionId,
    title: update.title,
    components: update.components.map((c): SlideComponent => ({
      id: c.id,
      type: mapComponentType(c.type),
      content: typeof c.content === 'string' ? c.content : JSON.stringify(c.content),
      // Always store MVP metadata for reconstruction on page load
      // This includes: original type, position, style, icon, label, and any data
      metadata: {
        mvpType: c.type,  // Original MVP component type (e.g., 'metric_group', 'callout_group')
        position: c.position,  // Region placement (e.g., { region: 'left', weight: 0.4 })
        style: c.style,  // Emphasis, size, alignment
        icon: c.icon,  // Icon name for callouts
        label: c.label,  // Label for metrics/stats
        data: c.data,  // Structured data if present
      },
    })),
    visual_concept: update.layoutType ? {
      layout_type: mapLayoutType(update.layoutType),
      notes: `mvp_layout:${update.layoutType}`,
    } : null,
    status: update.status === 'approved' ? 'approved' : 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

/**
 * Sync slides from LangGraph state to CIM database record
 * Defense in depth: backup persistence if client-side persistence fails
 */
async function syncSlidesToCIM(
  cimId: string,
  threadId: string
): Promise<void> {
  try {
    const graph = await getCIMMVPGraph()
    const config = { configurable: { thread_id: threadId } }
    const state = await graph.getState(config)

    if (!state.values?.allSlideUpdates?.length) {
      console.log('[syncSlidesToCIM] No slides in state to sync')
      return
    }

    // Convert SlideUpdate[] to Slide[]
    const slides = state.values.allSlideUpdates.map(slideUpdateToSlide)

    const supabase = await createClient()
    await supabase
      .from('cims')
      .update({ slides: slides as unknown as Json })
      .eq('id', cimId)

    console.log(`[syncSlidesToCIM] Synced ${slides.length} slides to CIM ${cimId}`)
  } catch (error) {
    console.error('[syncSlidesToCIM] Error:', error)
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

        // After streaming completes, sync conversation, workflow state, and slides
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

        // Sync slides as backup persistence (defense in depth)
        await syncSlidesToCIM(cimId, threadId)
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

    // Sync conversation and slides to CIM record after execution
    await syncConversationToCIM(cimId, threadId)
    await syncSlidesToCIM(cimId, threadId)

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
