/**
 * CIM Chat API Route - Agent communication for CIM Builder
 * Placeholder for E9.4 - Agent Orchestration Core
 *
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * AC: #4 - Conversation panel (placeholder agent connection)
 *
 * This route will be enhanced in E9.4 to connect to the LangGraph CIM agent.
 * For now, it provides a simple echo response to enable UI testing.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ConversationMessage, mapDbRowToCIM, CIMDbRow } from '@/lib/types/cim'
import { Database, Json } from '@/lib/supabase/database.types'

interface RouteContext {
  params: Promise<{ id: string; cimId: string }>
}

/**
 * POST /api/projects/[id]/cims/[cimId]/chat
 * Send a message to the CIM agent
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, cimId } = await context.params

    const body = await request.json()
    const { message } = body

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

    // Fetch the CIM to get current conversation history
    const { data: cimData, error: fetchError } = await supabase
      .from('cims')
      .select('*')
      .eq('id', cimId)
      .eq('deal_id', projectId)
      .single()

    if (fetchError || !cimData) {
      return NextResponse.json(
        { error: 'CIM not found' },
        { status: 404 }
      )
    }

    const cim = mapDbRowToCIM(cimData as CIMDbRow)

    // Create user message
    const userMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    }

    // Create placeholder assistant response
    // E9.4 will replace this with actual LangGraph agent integration
    const assistantMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: generatePlaceholderResponse(message, cim.workflowState.current_phase),
      timestamp: new Date().toISOString(),
      metadata: {
        phase: cim.workflowState.current_phase,
      },
    }

    // Update conversation history in database
    const updatedHistory = [
      ...cim.conversationHistory,
      userMessage,
      assistantMessage,
    ]

    const { error: updateError } = await supabase
      .from('cims')
      .update({
        conversation_history: updatedHistory as unknown as Json,
      })
      .eq('id', cimId)
      .eq('deal_id', projectId)

    if (updateError) {
      console.error('[api/cims/chat] Error updating conversation:', updateError)
      return NextResponse.json(
        { error: 'Failed to save conversation' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      messageId: assistantMessage.id,
      response: assistantMessage.content,
      metadata: assistantMessage.metadata,
    })
  } catch (err) {
    console.error('[api/cims/chat] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Generate a placeholder response based on message content and current phase
 * This will be replaced with actual agent responses in E9.4
 */
function generatePlaceholderResponse(message: string, phase: string): string {
  const messageLower = message.toLowerCase()

  // Check for source references
  if (message.includes('[doc:') || message.includes('[finding:') || message.includes('[qa:')) {
    return `I see you've referenced a source. In the full implementation (E9.4), I'll analyze this reference and incorporate relevant information into the CIM content.

For now, the CIM Builder UI is ready for testing. You can:
- Browse documents, findings, and Q&A in the Sources panel
- Click items to add references to your message
- Navigate slides in the Preview panel
- Use the Structure tree to jump to sections

**Current Phase:** ${phase}`
  }

  // Phase-specific responses
  if (messageLower.includes('buyer') || messageLower.includes('persona')) {
    return `Great question about the buyer persona! In the full implementation (E9.4), I'll help you define:

1. **Buyer Type** - Strategic, Financial, Management, or Other
2. **Key Priorities** - What the buyer values most
3. **Concerns** - Potential objections to address
4. **Key Metrics** - Numbers that matter to this buyer

This information will guide how we structure and present your CIM.

**Current Phase:** ${phase}`
  }

  if (messageLower.includes('thesis') || messageLower.includes('investment')) {
    return `The investment thesis is the core narrative of your CIM. In the full implementation (E9.4), I'll help you craft a compelling story that includes:

- **Value Proposition** - Why this company is attractive
- **Growth Opportunities** - Paths to value creation
- **Competitive Advantages** - Defensible moats
- **Financial Highlights** - Key metrics and trends

**Current Phase:** ${phase}`
  }

  if (messageLower.includes('outline') || messageLower.includes('structure') || messageLower.includes('section')) {
    return `I can help you create a CIM outline. Typical sections include:

1. **Executive Summary** - High-level overview
2. **Company Overview** - History, mission, culture
3. **Products/Services** - What the company offers
4. **Market Opportunity** - Industry and competitive landscape
5. **Financial Performance** - Historical and projected
6. **Growth Strategy** - Plans for expansion
7. **Investment Highlights** - Why to invest now

In E9.4, we'll collaboratively define your custom outline.

**Current Phase:** ${phase}`
  }

  // Default response
  return `Thank you for your message! The CIM Builder interface is now ready for testing.

**What's Working Now (E9.3):**
- 3-panel responsive layout
- Sources panel with Documents, Findings, and Q&A
- Click-to-reference functionality
- Conversation history
- Slide preview with navigation
- Structure tree with progress icons

**Coming in E9.4:**
- AI-powered agent responses
- Buyer persona definition workflow
- Investment thesis creation
- Outline collaboration
- Content generation with RAG

**Current Phase:** ${phase}

Feel free to explore the UI or ask me about buyer personas, investment thesis, or CIM structure!`
}
