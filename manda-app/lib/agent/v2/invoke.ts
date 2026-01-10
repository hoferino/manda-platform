/**
 * Agent System v2.0 - Graph Invocation Helpers
 *
 * Story: 1-3 Connect PostgresSaver Checkpointer (AC: #1, #2)
 *
 * Helper functions for invoking the agent graph with proper checkpointer
 * configuration and thread isolation.
 *
 * References:
 * - [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#State Management]
 * - [External: https://langchain-ai.github.io/langgraphjs/how-tos/persistence/]
 */

import type { RunnableConfig } from '@langchain/core/runnables'
import type { StreamEvent } from '@langchain/core/tracers/log_stream'

import { getCheckpointMetadata } from '@/lib/agent/checkpointer'
import type { AgentStateType } from './state'
import { createCompiledAgentGraph } from './graph'

// =============================================================================
// Invoke Helper
// =============================================================================

/**
 * Invoke the agent graph with checkpointer and thread isolation.
 *
 * Story: 1-3 Connect PostgresSaver Checkpointer (AC: #1, #2)
 *
 * @param state - Initial or continuing agent state
 * @param threadId - Thread ID for state isolation (use createV2ThreadId)
 * @param config - Optional LangChain config (merged, not replaced)
 * @returns Final agent state after graph execution
 *
 * @example
 * ```typescript
 * const threadId = createV2ThreadId('chat', dealId, userId, conversationId)
 * const state = createInitialState('chat')
 * state.messages = [new HumanMessage('Hello')]
 * const result = await invokeAgent(state, threadId)
 * ```
 */
export async function invokeAgent(
  state: AgentStateType,
  threadId: string,
  config?: RunnableConfig
): Promise<AgentStateType> {
  const graph = await createCompiledAgentGraph()

  return graph.invoke(state, {
    ...config,
    configurable: {
      thread_id: threadId,
      ...config?.configurable,
    },
    metadata: {
      ...getCheckpointMetadata(),
      thread_id: threadId, // Also in metadata for LangSmith visibility
      ...config?.metadata,
    },
  })
}

// =============================================================================
// Stream Helper
// =============================================================================

/**
 * Stream agent graph execution with checkpointer and thread isolation.
 * Yields LangGraph stream events with timestamps.
 *
 * Story: 1-3 Connect PostgresSaver Checkpointer (AC: #1, #2)
 *
 * @param state - Initial or continuing agent state
 * @param threadId - Thread ID for state isolation
 * @param config - Optional LangChain config
 * @yields StreamEvent objects from graph.streamEvents()
 *
 * @example
 * ```typescript
 * const threadId = createV2ThreadId('chat', dealId, userId, conversationId)
 * const state = createInitialState('chat')
 * state.messages = [new HumanMessage('Hello')]
 *
 * for await (const event of streamAgent(state, threadId)) {
 *   console.log(event.event, event.data)
 * }
 * ```
 */
export async function* streamAgent(
  state: AgentStateType,
  threadId: string,
  config?: RunnableConfig
): AsyncGenerator<StreamEvent> {
  const graph = await createCompiledAgentGraph()

  const streamConfig: RunnableConfig = {
    ...config,
    configurable: {
      thread_id: threadId,
      ...config?.configurable,
    },
    metadata: {
      ...getCheckpointMetadata(),
      thread_id: threadId,
      ...config?.metadata,
    },
  }

  // streamEvents expects version to be part of the options, not a separate parameter
  const streamOptions = {
    ...streamConfig,
    version: 'v2' as const,
  }

  for await (const event of graph.streamEvents(state, streamOptions)) {
    yield event
  }
}
