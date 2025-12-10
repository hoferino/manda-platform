/**
 * CIM Chat API Route - Agent communication for CIM Builder
 *
 * Story: E9.4 - Agent Orchestration Core
 *
 * Features:
 * - LangGraph-based CIM workflow agent
 * - SSE streaming support
 * - State persistence to database
 * - Phase-aware responses
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCIM } from '@/lib/services/cim'
import { executeCIMChat, streamCIMChat, type CIMStreamEvent } from '@/lib/agent/cim'
import { getSSEHeaders } from '@/lib/agent/streaming'

interface RouteContext {
  params: Promise<{ id: string; cimId: string }>
}

/**
 * POST /api/projects/[id]/cims/[cimId]/chat
 * Send a message to the CIM agent
 *
 * Body:
 * - message: string (required) - User message
 * - stream: boolean (optional) - Enable SSE streaming
 *
 * Response (non-streaming):
 * {
 *   messageId: string
 *   response: string
 *   metadata: { phase: string, sources?: array }
 *   workflowState: WorkflowState
 * }
 *
 * Response (streaming):
 * SSE events: token, tool_start, tool_end, done, error
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, cimId } = await context.params

    const body = await request.json()
    const { message, stream = false } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Authenticate user
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

    // Verify CIM exists and belongs to deal
    const cim = await getCIM(supabase, cimId)
    if (!cim) {
      return NextResponse.json(
        { error: 'CIM not found' },
        { status: 404 }
      )
    }

    if (cim.dealId !== projectId) {
      return NextResponse.json(
        { error: 'CIM does not belong to this project' },
        { status: 403 }
      )
    }

    // Fetch deal name for context
    const { data: deal } = await supabase
      .from('deals')
      .select('name')
      .eq('id', projectId)
      .single()

    const dealName = deal?.name

    // Handle streaming vs non-streaming
    if (stream) {
      return handleStreamingResponse(cimId, projectId, message, user.id, dealName)
    } else {
      return handleNonStreamingResponse(cimId, projectId, message, user.id, dealName)
    }
  } catch (err) {
    console.error('[api/cims/chat] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Handle non-streaming chat request
 */
async function handleNonStreamingResponse(
  cimId: string,
  dealId: string,
  message: string,
  userId: string,
  dealName?: string
): Promise<NextResponse> {
  try {
    const result = await executeCIMChat(cimId, dealId, message, userId, dealName)

    return NextResponse.json({
      messageId: result.messageId,
      response: result.response,
      metadata: result.metadata,
      workflowState: result.workflowState,
    })
  } catch (error) {
    console.error('[handleNonStreamingResponse] Error:', error)

    // Return a graceful error response
    return NextResponse.json({
      messageId: crypto.randomUUID(),
      response: 'I encountered an issue processing your request. Please try again.',
      metadata: { phase: 'unknown' },
      workflowState: null,
    })
  }
}

/**
 * Handle streaming chat request using SSE
 */
function handleStreamingResponse(
  cimId: string,
  dealId: string,
  message: string,
  userId: string,
  dealName?: string
): Response {
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Stream events from the CIM agent
        for await (const event of streamCIMChat(cimId, dealId, message, userId, dealName)) {
          const data = formatSSEEvent(event)
          controller.enqueue(encoder.encode(data))
        }
      } catch (error) {
        console.error('[handleStreamingResponse] Error:', error)
        const errorEvent: CIMStreamEvent = {
          type: 'error',
          data: {
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        }
        controller.enqueue(encoder.encode(formatSSEEvent(errorEvent)))
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
 * Format a CIM stream event as SSE data
 */
function formatSSEEvent(event: CIMStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

/**
 * GET /api/projects/[id]/cims/[cimId]/chat
 * Get conversation history and workflow state
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, cimId } = await context.params

    const supabase = await createClient()

    // Authenticate user
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

    // Fetch CIM
    const cim = await getCIM(supabase, cimId)
    if (!cim) {
      return NextResponse.json(
        { error: 'CIM not found' },
        { status: 404 }
      )
    }

    if (cim.dealId !== projectId) {
      return NextResponse.json(
        { error: 'CIM does not belong to this project' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      conversationHistory: cim.conversationHistory,
      workflowState: cim.workflowState,
      buyerPersona: cim.buyerPersona,
      investmentThesis: cim.investmentThesis,
      outline: cim.outline,
      slideCount: cim.slides.length,
    })
  } catch (err) {
    console.error('[api/cims/chat] GET Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/projects/[id]/cims/[cimId]/chat
 * Reset the conversation and workflow state
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, cimId } = await context.params

    const supabase = await createClient()

    // Authenticate user
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

    // Fetch CIM
    const cim = await getCIM(supabase, cimId)
    if (!cim) {
      return NextResponse.json(
        { error: 'CIM not found' },
        { status: 404 }
      )
    }

    if (cim.dealId !== projectId) {
      return NextResponse.json(
        { error: 'CIM does not belong to this project' },
        { status: 403 }
      )
    }

    // Import reset function
    const { resetCIMWorkflow } = await import('@/lib/agent/cim')

    const success = await resetCIMWorkflow(cimId)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to reset workflow' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Workflow reset successfully',
    })
  } catch (err) {
    console.error('[api/cims/chat] DELETE Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
