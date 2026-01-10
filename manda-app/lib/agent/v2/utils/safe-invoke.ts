/**
 * Agent System v2.0 - Safe Invoke Utilities
 *
 * Story: 1-6 Implement Basic Error Recovery (AC: #1, #2)
 *
 * Safe wrappers for graph invocation that catch errors and return
 * structured results instead of throwing.
 *
 * References:
 * - [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Error Handling Patterns]
 * - [Source: manda-app/lib/agent/v2/invoke.ts]
 */

import type { RunnableConfig } from '@langchain/core/runnables'
import type { StreamEvent } from '@langchain/core/tracers/log_stream'

import { invokeAgent, streamAgent } from '../invoke'
import {
  createAgentError,
  isLLMError,
  isAuthError,
  isToolError,
  logError,
} from './errors'
import type { AgentStateType } from '../state'
import type { AgentError } from '../types'
import { AgentErrorCode } from '../types'

// =============================================================================
// Result Types
// =============================================================================

/**
 * Result tuple for safe invoke operations.
 * Either result is present and error is null, or vice versa.
 */
export interface SafeInvokeResult {
  result: AgentStateType | null
  error: AgentError | null
}

/**
 * Error event type for safe streaming.
 */
export interface SafeStreamErrorEvent {
  type: 'error'
  error: AgentError
}

// =============================================================================
// Safe Invoke
// =============================================================================

/**
 * Safely invoke the agent graph with error handling.
 * Returns { result, error } tuple - never throws.
 *
 * @param state - Initial or continuing agent state
 * @param threadId - Thread ID for state isolation
 * @param config - Optional LangChain config
 * @returns Promise of { result, error } where one is always null
 *
 * @example
 * ```typescript
 * const { result, error } = await safeInvokeAgent(state, threadId)
 * if (error) {
 *   if (isRecoverableError(error)) {
 *     // Retry logic
 *   } else {
 *     // Handle fatal error
 *   }
 * } else {
 *   // Process result
 * }
 * ```
 */
export async function safeInvokeAgent(
  state: AgentStateType,
  threadId: string,
  config?: RunnableConfig
): Promise<SafeInvokeResult> {
  try {
    const result = await invokeAgent(state, threadId, config)
    return { result, error: null }
  } catch (err) {
    const agentError = classifyError(err, threadId)
    logError(agentError, { threadId, workflowMode: state.workflowMode })
    return { result: null, error: agentError }
  }
}

// =============================================================================
// Safe Stream
// =============================================================================

/**
 * Safely stream agent graph execution with error handling.
 * Yields events normally, then yields error event if stream fails.
 *
 * @param state - Initial or continuing agent state
 * @param threadId - Thread ID for state isolation
 * @param config - Optional LangChain config
 * @yields StreamEvent objects, with error event on failure
 *
 * @example
 * ```typescript
 * for await (const event of safeStreamAgent(state, threadId)) {
 *   if (event.type === 'error') {
 *     // Handle error, stream will end after this
 *     handleError(event.error)
 *   } else {
 *     // Process normal stream event
 *     processEvent(event)
 *   }
 * }
 * ```
 */
export async function* safeStreamAgent(
  state: AgentStateType,
  threadId: string,
  config?: RunnableConfig
): AsyncGenerator<StreamEvent | SafeStreamErrorEvent> {
  try {
    for await (const event of streamAgent(state, threadId, config)) {
      yield event
    }
  } catch (err) {
    const agentError = classifyError(err, threadId)
    logError(agentError, { threadId, workflowMode: state.workflowMode })
    yield { type: 'error' as const, error: agentError }
  }
}

// =============================================================================
// Error Classification
// =============================================================================

/**
 * Classify unknown errors into AgentError with appropriate code.
 *
 * Classification priority:
 * 1. Auth errors (401, 403) -> LLM_ERROR (NOT recoverable - don't retry)
 * 2. LLM errors (rate limit, timeout, model overload) -> LLM_ERROR (recoverable)
 * 3. Tool/specialist errors -> TOOL_ERROR (not recoverable, but can continue)
 * 4. Unknown errors -> STATE_ERROR (not recoverable, halt)
 *
 * @param err - Unknown error value to classify
 * @param threadId - Thread ID for context in error details
 * @returns Structured AgentError with appropriate code
 */
export function classifyError(err: unknown, threadId: string): AgentError {
  // Auth errors - LLM-related but NOT recoverable (don't retry invalid credentials)
  if (isAuthError(err)) {
    return createAgentError(AgentErrorCode.LLM_ERROR, 'Authentication failed', {
      details: { originalError: String(err), threadId },
      recoverable: false, // Auth errors should NOT be retried
    })
  }

  // LLM errors (rate limit, timeout, model overload) - recoverable
  if (isLLMError(err)) {
    return createAgentError(AgentErrorCode.LLM_ERROR, 'LLM call failed', {
      details: { originalError: String(err), threadId },
      recoverable: true,
    })
  }

  // Tool/specialist errors
  if (isToolError(err)) {
    return createAgentError(AgentErrorCode.TOOL_ERROR, 'Tool execution failed', {
      details: { originalError: String(err), threadId },
      recoverable: false, // Continue without tool result
    })
  }

  // Default to STATE_ERROR for unknown errors
  return createAgentError(AgentErrorCode.STATE_ERROR, 'Unexpected error', {
    details: { originalError: String(err), threadId },
    recoverable: false,
  })
}
