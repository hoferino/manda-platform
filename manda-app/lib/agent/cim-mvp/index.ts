/**
 * CIM MVP Agent
 *
 * Simplified CIM workflow agent for MVP testing.
 * Uses JSON knowledge file from manda-analyze skill.
 *
 * Story: CIM MVP Fast Track
 *
 * Usage:
 * ```typescript
 * import { cimMVPGraph, streamCIMMVP } from '@/lib/agent/cim-mvp'
 *
 * // Simple invoke
 * const result = await cimMVPGraph.invoke({
 *   messages: [new HumanMessage('Help me build the executive summary')],
 * })
 *
 * // Streaming with events
 * for await (const event of streamCIMMVP(message, threadId)) {
 *   // Handle token, slide_update, sources events
 * }
 * ```
 */

// Graph
export { cimMVPGraph, createCIMMVPGraph, getCIMMVPGraph } from './graph'

// State
export {
  CIMMVPState,
  type CIMMVPStateType,
  type CIMPhase,
  type SlideUpdate,
  type SlideComponent,
  type SourceCitation,
} from './state'

// Types
export type {
  KnowledgeFile,
  Finding,
  Executive,
  Location,
  Competitor,
  HistoricalFinancial,
  CIMMVPStreamEvent,
} from './types'

// Tools
export { cimMVPTools } from './tools'

// Prompts
export { getSystemPrompt, getPhaseDescription, getAllPhases } from './prompts'

// Knowledge loader
export {
  loadKnowledge,
  searchKnowledge,
  getKnowledgeForSection,
  getFindingsForSection,
  getCompanyMetadata,
  getDataGaps,
  getDataSummary,
  formatSectionContext,
  clearKnowledgeCache,
} from './knowledge-loader'

// =============================================================================
// Streaming Helper
// =============================================================================

import { HumanMessage } from '@langchain/core/messages'
import { getCIMMVPGraph } from './graph'
import type { CIMMVPStreamEvent } from './types'
import type { CIMMVPStateType } from './state'

/**
 * Stream CIM MVP agent responses
 *
 * Yields events for tokens, slide updates, sources, and completion.
 *
 * @param message - User message
 * @param threadId - Conversation thread ID for persistence
 * @param knowledgePath - Optional path to knowledge.json
 * @yields CIMMVPStreamEvent
 */
export async function* streamCIMMVP(
  message: string,
  threadId: string,
  knowledgePath?: string
): AsyncGenerator<CIMMVPStreamEvent> {
  const config = {
    configurable: { thread_id: threadId },
  }

  const input = {
    messages: [new HumanMessage(message)],
    knowledgePath: knowledgePath || '',
  } as Partial<CIMMVPStateType>

  try {
    // Get graph with checkpointer for persistence
    const graph = await getCIMMVPGraph()

    // Stream the graph execution
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = await graph.stream(input as any, {
      ...config,
      streamMode: 'values',
    })

    let lastMessageCount = 0
    let lastSlideUpdate: string | null = null
    let lastPhase: string | null = null

    for await (const state of stream) {
      const timestamp = new Date().toISOString()

      // Check for new messages
      if (state.messages && state.messages.length > lastMessageCount) {
        const newMessages = state.messages.slice(lastMessageCount)
        lastMessageCount = state.messages.length

        for (const msg of newMessages) {
          // Check for AI messages - handle both class instances and plain objects
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const msgAny = msg as any
          const msgType = typeof msgAny._getType === 'function' ? msgAny._getType() : msgAny.type
          const isAIMessage = msgType === 'ai' || msgType === 'AIMessage' || msg.constructor?.name === 'AIMessage'

          // Only yield AI messages with content (skip tool calls)
          const hasToolCalls = msgAny.tool_calls && msgAny.tool_calls.length > 0
          if (isAIMessage && msg.content && !hasToolCalls) {
            const content = typeof msg.content === 'string'
              ? msg.content
              : JSON.stringify(msg.content)

            console.log('[streamCIMMVP] Yielding token:', content.substring(0, 100) + '...')

            yield {
              type: 'token',
              content,
              timestamp,
            }
          }
        }
      }

      // Check for phase changes (only yield when changed)
      if (state.currentPhase && state.currentPhase !== lastPhase) {
        lastPhase = state.currentPhase
        yield {
          type: 'phase_change',
          phase: state.currentPhase,
          timestamp,
        }
      }

      // Check for slide updates
      if (state.pendingSlideUpdate) {
        const slideId = state.pendingSlideUpdate.slideId
        if (slideId !== lastSlideUpdate) {
          lastSlideUpdate = slideId
          yield {
            type: 'slide_update',
            slide: state.pendingSlideUpdate,
            timestamp,
          }
        }
      }

      // Check for sources
      if (state.sourcesUsed && state.sourcesUsed.length > 0) {
        yield {
          type: 'sources',
          sources: state.sourcesUsed,
          timestamp,
        }
      }
    }

    // Done event
    yield {
      type: 'done',
      conversationId: threadId,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    yield {
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }
  }
}

/**
 * Execute CIM MVP agent (non-streaming)
 *
 * @param message - User message
 * @param threadId - Conversation thread ID
 * @param knowledgePath - Optional path to knowledge.json
 * @returns Final state with response
 */
export async function executeCIMMVP(
  message: string,
  threadId: string,
  knowledgePath?: string
): Promise<{
  response: string
  currentPhase: string
  slideUpdates: unknown[]
  error: string | null
}> {
  const config = {
    configurable: { thread_id: threadId },
  }

  const input = {
    messages: [new HumanMessage(message)],
    knowledgePath: knowledgePath || '',
  } as Partial<CIMMVPStateType>

  // Get graph with checkpointer for persistence
  const graph = await getCIMMVPGraph()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await graph.invoke(input as any, config)

  // Extract the last AI message as the response
  const lastAIMessage = result.messages
    .filter((m: { _getType?: () => string }) => m._getType?.() === 'ai')
    .pop()

  const response = lastAIMessage?.content
    ? typeof lastAIMessage.content === 'string'
      ? lastAIMessage.content
      : JSON.stringify(lastAIMessage.content)
    : ''

  return {
    response,
    currentPhase: result.currentPhase,
    slideUpdates: result.allSlideUpdates || [],
    error: result.error || null,
  }
}
