/**
 * Agent System v2.0 - Error Utilities
 *
 * Story: 1-6 Implement Basic Error Recovery (AC: #1)
 *
 * Error factory, detection, and logging utilities for the agent system.
 * These utilities provide structured error handling with proper classification
 * and user-friendly messaging.
 *
 * References:
 * - [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Error Handling Patterns]
 * - [Source: _bmad-output/planning-artifacts/agent-system-prd.md#FR52-FR55]
 */

import type { AgentError } from '../types'
import { AgentErrorCode } from '../types'

// =============================================================================
// Error Factory
// =============================================================================

/**
 * Create a structured AgentError with required fields.
 *
 * @param code - Error classification code
 * @param message - Technical error message (for logging)
 * @param options - Optional additional fields
 * @returns Structured AgentError
 *
 * @example
 * ```typescript
 * const error = createAgentError(
 *   AgentErrorCode.LLM_ERROR,
 *   'Rate limit exceeded',
 *   { details: { retryAfter: 60 }, nodeId: 'supervisor' }
 * )
 * ```
 */
export function createAgentError(
  code: AgentErrorCode,
  message: string,
  options?: {
    details?: unknown
    recoverable?: boolean
    nodeId?: string
  }
): AgentError {
  return {
    code,
    message,
    details: options?.details,
    recoverable: options?.recoverable ?? isDefaultRecoverable(code),
    timestamp: new Date().toISOString(),
    nodeId: options?.nodeId,
  }
}

/**
 * Determine default recoverability based on error code.
 * LLM_ERROR, CACHE_ERROR, and CONTEXT_ERROR are typically recoverable.
 */
function isDefaultRecoverable(code: AgentErrorCode): boolean {
  return (
    code === AgentErrorCode.LLM_ERROR ||
    code === AgentErrorCode.CACHE_ERROR ||
    code === AgentErrorCode.CONTEXT_ERROR
  )
}

// =============================================================================
// Error Classification
// =============================================================================

/**
 * Check if an error is recoverable (can be retried or continued from).
 *
 * @param error - AgentError to check
 * @returns True if error is marked as recoverable
 */
export function isRecoverableError(error: AgentError): boolean {
  return error.recoverable
}

// =============================================================================
// User-Friendly Messages
// =============================================================================

/**
 * User-friendly message mappings by error code.
 * These messages are safe to show to end users.
 */
const USER_FRIENDLY_MESSAGES: Record<AgentErrorCode, string> = {
  [AgentErrorCode.LLM_ERROR]: "I'm having trouble thinking. Let me try again.",
  [AgentErrorCode.TOOL_ERROR]: "I couldn't access that information.",
  [AgentErrorCode.STATE_ERROR]: 'Something went wrong. Please refresh.',
  [AgentErrorCode.CONTEXT_ERROR]: "I couldn't load the deal context.",
  [AgentErrorCode.APPROVAL_REJECTED]: "Got it, I won't proceed with that.",
  [AgentErrorCode.STREAMING_ERROR]: 'Connection interrupted. Please try again.',
  // CACHE_ERROR uses error.message directly (silent to user)
  [AgentErrorCode.CACHE_ERROR]: '', // Placeholder - handled specially
}

/**
 * Map error code to user-friendly message.
 * Technical details are hidden; users see helpful guidance.
 *
 * @param error - AgentError to convert
 * @returns User-friendly message string
 *
 * @example
 * ```typescript
 * const error = createAgentError(AgentErrorCode.LLM_ERROR, 'HTTP 429')
 * const message = toUserFriendlyMessage(error)
 * // "I'm having trouble thinking. Let me try again."
 * ```
 */
export function toUserFriendlyMessage(error: AgentError): string {
  // CACHE_ERROR uses the original message (usually silent/internal)
  if (error.code === AgentErrorCode.CACHE_ERROR) {
    return error.message
  }

  return (
    USER_FRIENDLY_MESSAGES[error.code] || 'An unexpected error occurred.'
  )
}

// =============================================================================
// Error Detection
// =============================================================================

/**
 * Detect LLM-specific errors from Vertex AI / LangChain.
 * Checks for rate limits, timeouts, model overload, and auth errors.
 *
 * @param err - Unknown error value to classify
 * @returns True if error is LLM-related
 *
 * @example
 * ```typescript
 * try {
 *   await llm.invoke(messages)
 * } catch (err) {
 *   if (isLLMError(err)) {
 *     // Retry with backoff (unless it's an auth error)
 *   }
 * }
 * ```
 */
export function isLLMError(err: unknown): boolean {
  if (!(err instanceof Error)) return false

  const message = err.message.toLowerCase()
  const name = err.name.toLowerCase()

  // Rate limit (429)
  if (message.includes('rate limit') || message.includes('429')) return true

  // Timeout errors
  if (
    name === 'aborterror' ||
    message.includes('timeout') ||
    message.includes('etimedout')
  )
    return true

  // Model overload (503)
  if (message.includes('overloaded') || message.includes('503')) return true

  // Invalid API key (401) - still an LLM error, but not retryable
  if (message.includes('unauthorized') || message.includes('401')) return true

  // LangChain-specific error patterns
  if (
    message.includes('anthropic') ||
    message.includes('vertex') ||
    message.includes('openai')
  ) {
    if (message.includes('error') || message.includes('failed')) return true
  }

  return false
}

/**
 * Detect authentication errors (subset of LLM errors).
 * Auth errors should NOT be retried - the credentials are invalid.
 *
 * @param err - Unknown error value to classify
 * @returns True if error is an authentication/authorization error
 *
 * @example
 * ```typescript
 * if (isLLMError(err) && !isAuthError(err)) {
 *   // Safe to retry
 * }
 * ```
 */
export function isAuthError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const message = err.message.toLowerCase()
  return (
    message.includes('unauthorized') ||
    message.includes('401') ||
    message.includes('invalid api key') ||
    message.includes('authentication failed') ||
    message.includes('forbidden') ||
    message.includes('403')
  )
}

/**
 * Detect tool/specialist errors.
 * Checks for tool execution failures, specialist issues, and Graphiti errors.
 *
 * @param err - Unknown error value to classify
 * @returns True if error is tool-related
 */
export function isToolError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const message = err.message.toLowerCase()
  return (
    message.includes('tool') ||
    message.includes('specialist') ||
    message.includes('graphiti')
  )
}

// =============================================================================
// Error Logging
// =============================================================================

/**
 * Log error with full context for debugging.
 * Uses console.error for local dev; LangSmith for production tracing.
 *
 * @param error - AgentError to log
 * @param context - Additional context (threadId, userId, etc.)
 *
 * @example
 * ```typescript
 * logError(agentError, {
 *   threadId: 'chat:deal123:user456:conv789',
 *   workflowMode: 'chat',
 *   userId: 'user456',
 * })
 * ```
 */
export function logError(
  error: AgentError,
  context: Record<string, unknown>
): void {
  // Always log to console for local debugging
  console.error('[AgentError]', {
    code: error.code,
    message: error.message,
    nodeId: error.nodeId,
    recoverable: error.recoverable,
    timestamp: error.timestamp,
    ...context,
  })

  // LangSmith tracing happens automatically via graph metadata.
  // TODO(Story 9-1): Add custom LangSmith event emission for error tracking.
  // This will enable error aggregation and alerting in production.
  // See: _bmad-output/planning-artifacts/agent-system-epics.md#Epic 9
}
