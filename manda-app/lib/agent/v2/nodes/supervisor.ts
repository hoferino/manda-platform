/**
 * Agent System v2.0 - Supervisor Node
 *
 * Story: 1-2 Create Base StateGraph Structure (AC: #2)
 * Story: 1-6 Implement Basic Error Recovery (AC: #1, #3)
 *
 * Placeholder implementation that passes state unchanged.
 * Full implementation with LLM routing in Story 2.1.
 *
 * The supervisor node is the main entry point for chat, irl, and qa workflows.
 * It routes messages to appropriate handlers based on user intent.
 *
 * Error Handling Pattern (Story 1.6):
 * - LLM errors are caught and added to state.errors
 * - Recoverable errors (LLM_ERROR) can be retried
 * - Fatal errors (STATE_ERROR) halt execution
 * - TOOL_ERROR allows continuation with reduced capability
 *
 * References:
 * - [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Supervisor Node]
 * - [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Error Handling Patterns]
 * - [Source: docs/langgraph-reference.md]
 */

import type { AgentStateType } from '../state'
import type { AgentError } from '../types'
import { AgentErrorCode } from '../types'
import {
  createAgentError,
  isLLMError,
  isRecoverableError,
  logError,
} from '../utils/errors'

/**
 * Node identifier for error tracking.
 */
const NODE_ID = 'supervisor'

/**
 * Supervisor node - routes messages to appropriate handlers.
 *
 * Placeholder implementation - passes state unchanged.
 * Full implementation in Story 2.1 will add:
 * - LLM-based intent detection
 * - Tool calling for specialist routing
 * - Response generation
 *
 * Error Handling (Story 1.6):
 * When Story 2.1 adds LLM calls, errors will be:
 * 1. Caught in try-catch
 * 2. Classified using isLLMError/isToolError
 * 3. Added to state.errors (reducer auto-appends)
 * 4. Logged with context
 * 5. Either retried (if recoverable) or halted
 *
 * @param _state - Current agent state (unused in placeholder)
 * @returns Partial state update (empty for placeholder)
 *
 * @example
 * ```typescript
 * const graphBuilder = new StateGraph(AgentState)
 * graphBuilder.addNode('supervisor', supervisorNode)
 * ```
 *
 * @example Error handling pattern (Story 2.1)
 * ```typescript
 * try {
 *   const response = await llm.invoke(messages)
 *   return { messages: [response] }
 * } catch (err) {
 *   const error = classifyAndLogError(err, state)
 *   if (isRecoverableError(error)) {
 *     // Retry logic (handled by withRetry wrapper)
 *   }
 *   // Return error in state - reducer will append
 *   return { errors: [error] }
 * }
 * ```
 */
export async function supervisorNode(
  _state: AgentStateType
): Promise<Partial<AgentStateType>> {
  // Placeholder: pass through unchanged
  // Story 2.1 will implement LLM routing logic here with error handling:
  //
  // try {
  //   const response = await withRetry(() => llm.invoke(messages))
  //   return { messages: [response] }
  // } catch (err) {
  //   const error = classifyAndLogError(err, _state)
  //   return { errors: [error] }
  // }
  //
  return {}
}

/**
 * Classify error and log with context.
 * Helper for node-level error handling.
 *
 * Story: 1-6 Implement Basic Error Recovery (AC: #1)
 *
 * @param err - Unknown error to classify
 * @param state - Current agent state for context
 * @returns Classified AgentError
 *
 * @internal Used by supervisorNode when Story 2.1 adds LLM calls
 */
export function classifyAndLogError(
  err: unknown,
  state: AgentStateType
): AgentError {
  let error: AgentError

  if (isLLMError(err)) {
    error = createAgentError(AgentErrorCode.LLM_ERROR, 'LLM call failed', {
      details: { originalError: String(err) },
      recoverable: true,
      nodeId: NODE_ID,
    })
  } else {
    error = createAgentError(AgentErrorCode.STATE_ERROR, 'Unexpected error', {
      details: { originalError: String(err) },
      recoverable: false,
      nodeId: NODE_ID,
    })
  }

  // Log with context
  logError(error, {
    nodeId: NODE_ID,
    workflowMode: state.workflowMode,
    dealId: state.dealContext?.dealId,
    messageCount: state.messages.length,
  })

  return error
}

// Re-export for testing
export { isRecoverableError }
