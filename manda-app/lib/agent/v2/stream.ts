/**
 * Agent System v2.0 - Token Streaming Utilities
 *
 * Story: 2-2 Implement Real-Time Token Streaming (AC: #1, #2, #3)
 * Story: 3-2 Implement Source Attribution (AC: #1, #3, #4)
 *
 * Enhances existing streamAgent with token-level extraction for real-time UI streaming.
 * Yields TokenStreamEvent for each token received from the LLM, plus original StreamEvent
 * for state tracking and other event types.
 *
 * After streaming completes, emits SourceAddedEvent for each source in the final state.
 *
 * References:
 * - [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Streaming Event Patterns]
 * - [Source: manda-app/lib/agent/v2/invoke.ts - streamAgent using streamEvents v2]
 */

import type { StreamEvent } from '@langchain/core/tracers/log_stream'
import type { RunnableConfig } from '@langchain/core/runnables'

import { streamAgent } from './invoke'
import type { AgentStateType } from './state'
import type { TokenStreamEvent, SourceAddedEvent, SourceCitation } from './types'
import { deduplicateSources, rankSourcesByRelevance } from './utils/source-attribution'

// Re-export type for consumers that import from stream.ts directly
export type { TokenStreamEvent } from './types'

// =============================================================================
// Token Streaming Generator
// =============================================================================

/** Maximum number of sources to emit (AC: #5) */
const MAX_SOURCES = 5

/**
 * Stream agent with token-level granularity and source attribution.
 *
 * Story: 2-2 (AC: #1, #2, #3)
 * Story: 3-2 (AC: #1, #3, #4)
 *
 * Wraps existing streamAgent from invoke.ts, extracting tokens from
 * `on_chat_model_stream` events. This enables real-time character-by-character
 * streaming in the UI without buffering.
 *
 * After streaming completes, emits SourceAddedEvent for each source found
 * in the final state (deduplicated and ranked by relevance, limited to top 5).
 *
 * @param state - Initial or continuing agent state
 * @param threadId - Thread ID for state isolation (use createV2ThreadId)
 * @param config - Optional LangChain config (passed to underlying streamAgent)
 * @yields TokenStreamEvent for each token, SourceAddedEvent for each source, plus original StreamEvent
 *
 * @example
 * ```typescript
 * const state = createInitialState('chat')
 * state.messages = [new HumanMessage('Hello')]
 *
 * for await (const event of streamAgentWithTokens(state, threadId)) {
 *   if ('type' in event && event.type === 'token') {
 *     // Stream token to UI immediately
 *     appendToUI(event.content)
 *   } else if ('type' in event && event.type === 'source_added') {
 *     // Handle source citation
 *     addSource(event.source)
 *   } else {
 *     // Handle other LangGraph events (tool calls, etc.)
 *     handleStreamEvent(event)
 *   }
 * }
 * ```
 *
 * @remarks
 * - Tokens are yielded immediately without buffering (NFR2: smooth streaming)
 * - Empty/null content chunks are skipped
 * - Array content (tool_use blocks) is skipped - only string tokens are emitted
 * - Original StreamEvent is also yielded for tool events, state tracking, etc.
 * - Sources are deduplicated by documentId+location, ranked by relevance, limited to 5
 * - Each source_added event includes ISO 8601 timestamp
 */
export async function* streamAgentWithTokens(
  state: AgentStateType,
  threadId: string,
  config?: RunnableConfig
): AsyncGenerator<TokenStreamEvent | SourceAddedEvent | StreamEvent> {
  // Track final state from on_chain_end event
  let finalSources: SourceCitation[] = []

  for await (const event of streamAgent(state, threadId, config)) {
    // Extract tokens from chat model stream events
    if (event.event === 'on_chat_model_stream') {
      const chunk = event.data?.chunk
      const content = chunk?.content

      // Only emit string content (skip empty, null, undefined, and arrays)
      if (typeof content === 'string' && content.length > 0) {
        yield {
          type: 'token',
          content,
          timestamp: new Date().toISOString(),
          // Extract node identifier from tags if present
          node: event.tags?.find((t: string) => t.startsWith('node:'))?.replace('node:', ''),
        }
      }
      // Don't yield original on_chat_model_stream event to avoid duplication
      continue
    }

    // Capture final state from graph completion (root runnable ends last)
    // NOTE: 'LangGraph' is the internal name used by @langchain/langgraph for the root graph.
    // If this changes in future versions, source capture will need updating.
    // See: https://js.langchain.com/docs/langgraph/reference/graphs
    if (event.event === 'on_chain_end' && event.name === 'LangGraph') {
      const output = event.data?.output as AgentStateType | undefined
      if (output?.sources && Array.isArray(output.sources)) {
        finalSources = output.sources
      }
      // Don't yield this event - it's internal bookkeeping
      continue
    }

    // Yield original event for tool events, state tracking, etc.
    yield event
  }

  // After streaming completes, emit source_added events (AC: #1, #3)
  if (finalSources.length > 0) {
    const dedupedSources = deduplicateSources(finalSources)
    const topSources = rankSourcesByRelevance(dedupedSources, MAX_SOURCES)

    for (const source of topSources) {
      yield {
        type: 'source_added',
        source,
        timestamp: new Date().toISOString(),
      } satisfies SourceAddedEvent
    }
  }
}
