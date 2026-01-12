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
  type ComponentType,
  type LayoutType,
  type WorkflowStage,
  type WorkflowProgress,
  type SectionProgress,
  type SlideProgress,
  type BuyerPersona,
  type HeroContext,
  type CIMSection,
  type CIMOutline,
  type ComponentPosition,
  type ComponentStyle,
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
 * Yields events for tokens, slide updates, sources, workflow progress, and completion.
 * Story 5: Added workflow_progress, outline_created, outline_updated, section_started events
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

    // Get current state to know how many messages already exist
    // This prevents re-yielding old messages from checkpointed state
    const currentState = await graph.getState(config)
    const existingMessageCount = currentState.values?.messages?.length || 0
    console.log(`[streamCIMMVP] Thread ${threadId} has ${existingMessageCount} existing messages`)

    // Stream the graph execution
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = await graph.stream(input as any, {
      ...config,
      streamMode: 'values',
    })

    // Start from existing count + 1 (for the new human message we just sent)
    let lastMessageCount = existingMessageCount + 1
    let lastSlideUpdate: string | null = null
    let lastPhase: string | null = null

    // Story 5: Track workflow state for change detection
    let previousWorkflowStage = currentState.values?.workflowProgress?.currentStage || null
    let previousOutline = currentState.values?.cimOutline || null
    let previousSectionId = currentState.values?.workflowProgress?.currentSectionId || null
    let outlineWasCreated = !!previousOutline

    for await (const state of stream) {
      const timestamp = new Date().toISOString()

      // ===========================================
      // Story 5.1: Detect workflow progress change
      // ===========================================
      if (state.workflowProgress?.currentStage &&
          state.workflowProgress.currentStage !== previousWorkflowStage) {
        yield {
          type: 'workflow_progress',
          data: {
            currentStage: state.workflowProgress.currentStage,
            completedStages: state.workflowProgress.completedStages || [],
            currentSectionId: state.workflowProgress.currentSectionId || null,
            sectionProgressSummary: Object.fromEntries(
              Object.entries(state.workflowProgress.sectionProgress || {})
                .map(([id, p]) => [id, (p as { status: string }).status])
            ),
          },
          timestamp,
        }
        console.log(`[streamCIMMVP] Workflow progress: ${previousWorkflowStage} → ${state.workflowProgress.currentStage}`)
        previousWorkflowStage = state.workflowProgress.currentStage
      }

      // ===========================================
      // Story 5.2: Detect outline creation
      // ===========================================
      if (state.cimOutline && !outlineWasCreated) {
        yield {
          type: 'outline_created',
          data: {
            sections: state.cimOutline.sections,
          },
          timestamp,
        }
        console.log(`[streamCIMMVP] Outline created with ${state.cimOutline.sections.length} sections`)
        outlineWasCreated = true
        previousOutline = state.cimOutline
      }

      // ===========================================
      // Story 5.3: Detect outline updates (after initial creation)
      // ===========================================
      if (state.cimOutline && outlineWasCreated && previousOutline) {
        const currentSections = JSON.stringify(state.cimOutline.sections)
        const previousSections = JSON.stringify(previousOutline.sections)
        if (currentSections !== previousSections) {
          yield {
            type: 'outline_updated',
            data: {
              sections: state.cimOutline.sections,
            },
            timestamp,
          }
          console.log(`[streamCIMMVP] Outline updated`)
          previousOutline = state.cimOutline
        }
      }

      // ===========================================
      // Story 5.4: Detect section start
      // ===========================================
      if (state.workflowProgress?.currentSectionId &&
          state.workflowProgress.currentSectionId !== previousSectionId) {
        const sectionId = state.workflowProgress.currentSectionId
        const section = state.cimOutline?.sections?.find(
          (s: { id: string }) => s.id === sectionId
        )
        yield {
          type: 'section_started',
          data: {
            sectionId,
            sectionTitle: section?.title || 'Unknown Section',
          },
          timestamp,
        }
        console.log(`[streamCIMMVP] Section started: ${sectionId}`)
        previousSectionId = sectionId
      }

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

          // Only yield AI messages with content (skip tool calls and empty content)
          const hasToolCalls = msgAny.tool_calls && msgAny.tool_calls.length > 0
          if (isAIMessage && msg.content && !hasToolCalls) {
            // Convert content to string
            const content = typeof msg.content === 'string'
              ? msg.content
              : Array.isArray(msg.content) && msg.content.length === 0
                ? '' // Empty array means no text content
                : JSON.stringify(msg.content)

            // Skip empty content (e.g., when AI only made tool calls)
            if (!content || content === '[]' || content.trim() === '') {
              continue
            }

            console.log('[streamCIMMVP] Yielding token:', content.substring(0, 100) + '...')

            yield {
              type: 'token',
              content,
              timestamp,
            }
          }
        }
      }

      // Check for phase changes (legacy, only yield when changed)
      if (state.currentPhase && state.currentPhase !== lastPhase) {
        lastPhase = state.currentPhase
        yield {
          type: 'phase_change',
          phase: state.currentPhase,
          timestamp,
        }
      }

      // Check for slide updates (Story 5.7: enhanced with layoutType)
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
