/**
 * Agent System v2.0 - Token Streaming Utilities
 *
 * Story: 2-2 Implement Real-Time Token Streaming (AC: #1, #2, #3)
 *
 * Enhances existing streamAgent with token-level extraction for real-time UI streaming.
 * Yields TokenStreamEvent for each token received from the LLM, plus original StreamEvent
 * for state tracking and other event types.
 *
 * References:
 * - [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Streaming Event Patterns]
 * - [Source: manda-app/lib/agent/v2/invoke.ts - streamAgent using streamEvents v2]
 */

import type { StreamEvent } from '@langchain/core/tracers/log_stream'
import type { RunnableConfig } from '@langchain/core/runnables'

import { streamAgent } from './invoke'
import type { AgentStateType } from './state'
import type { TokenStreamEvent } from './types'

// Re-export type for consumers that import from stream.ts directly
export type { TokenStreamEvent } from './types'

// =============================================================================
// Token Streaming Generator
// =============================================================================

/**
 * Stream agent with token-level granularity.
 *
 * Story: 2-2 (AC: #1, #2, #3)
 *
 * Wraps existing streamAgent from invoke.ts, extracting tokens from
 * `on_chat_model_stream` events. This enables real-time character-by-character
 * streaming in the UI without buffering.
 *
 * @param state - Initial or continuing agent state
 * @param threadId - Thread ID for state isolation (use createV2ThreadId)
 * @param config - Optional LangChain config (passed to underlying streamAgent)
 * @yields TokenStreamEvent for each token, plus original StreamEvent for state tracking
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
 */
export async function* streamAgentWithTokens(
  state: AgentStateType,
  threadId: string,
  config?: RunnableConfig
): AsyncGenerator<TokenStreamEvent | StreamEvent> {
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

    // Yield original event for tool events, state tracking, etc.
    yield event
  }
}
