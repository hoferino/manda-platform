/**
 * Agent System v2.0 - Thread ID Utilities
 *
 * Story: 1-3 Connect PostgresSaver Checkpointer (AC: #2)
 *
 * Thread ID generation and parsing for v2 agent system.
 * Thread IDs provide isolation boundaries for checkpointer state.
 *
 * Formats (using ':' delimiter to support UUIDs with hyphens):
 * - Chat/IRL: {workflowMode}:{dealId}:{userId}:{conversationId}
 * - CIM: cim:{dealId}:{cimId} (deal-scoped, no userId)
 *
 * References:
 * - [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Thread ID Pattern]
 * - [Source: CLAUDE.md#Thread ID Pattern]
 */

import type { WorkflowMode } from '../types'

// =============================================================================
// Constants
// =============================================================================

/**
 * Delimiter used to separate thread ID components.
 * Using ':' instead of '-' to support UUIDs which contain hyphens.
 */
const THREAD_ID_DELIMITER = ':'

/**
 * Pattern for validating thread ID component values.
 * Allows alphanumeric, hyphens (for UUIDs), and underscores.
 * Disallows the delimiter character and other special chars.
 */
const VALID_COMPONENT_PATTERN = /^[a-zA-Z0-9_-]+$/

// =============================================================================
// Types
// =============================================================================

/**
 * Parsed components from a v2 thread ID.
 * Used for routing, logging, and RLS policies.
 */
export interface ParsedThreadId {
  workflowMode: 'chat' | 'cim' | 'irl'
  dealId: string
  userId: string | null // null for CIM (deal-scoped)
  conversationId: string // conversationId for chat/irl, cimId for CIM
}

// =============================================================================
// Thread ID Creation
// =============================================================================

/**
 * Validate that a thread ID component contains only allowed characters.
 * @throws Error if component contains invalid characters
 */
function validateComponent(name: string, value: string): void {
  if (!value) {
    throw new Error(`${name} is required and cannot be empty`)
  }
  if (!VALID_COMPONENT_PATTERN.test(value)) {
    throw new Error(
      `${name} contains invalid characters. Only alphanumeric, hyphens, and underscores are allowed.`
    )
  }
}

/**
 * Create a v2 thread ID for graph invocation.
 *
 * Uses ':' as delimiter to support UUIDs with hyphens in component values.
 *
 * @param workflowMode - 'chat' | 'cim' | 'irl'
 * @param dealId - Deal UUID (required)
 * @param userId - User UUID (required for chat/irl, omit for CIM)
 * @param conversationId - Conversation UUID or CIM ID
 * @returns Thread ID string
 * @throws Error if required parameters are empty or contain invalid characters
 *
 * @example Chat mode
 * createV2ThreadId('chat', 'deal-123', 'user-456', 'conv-789')
 * // Returns: 'chat:deal-123:user-456:conv-789'
 *
 * @example CIM mode (deal-scoped, no user)
 * createV2ThreadId('cim', 'deal-123', undefined, 'cim-001')
 * // Returns: 'cim:deal-123:cim-001'
 *
 * @example With UUIDs
 * createV2ThreadId('chat', '550e8400-e29b-41d4-a716-446655440000', 'user-123', 'conv-456')
 * // Returns: 'chat:550e8400-e29b-41d4-a716-446655440000:user-123:conv-456'
 */
export function createV2ThreadId(
  workflowMode: WorkflowMode,
  dealId: string,
  userId: string | undefined,
  conversationId: string
): string {
  // Validate all components
  validateComponent('dealId', dealId)
  validateComponent('conversationId', conversationId)

  if (workflowMode === 'cim') {
    // CIM is deal-scoped (collaborative), no userId
    return `cim${THREAD_ID_DELIMITER}${dealId}${THREAD_ID_DELIMITER}${conversationId}`
  }

  if (!userId) {
    throw new Error('userId is required for chat/irl modes')
  }
  validateComponent('userId', userId)

  return `${workflowMode}${THREAD_ID_DELIMITER}${dealId}${THREAD_ID_DELIMITER}${userId}${THREAD_ID_DELIMITER}${conversationId}`
}

// =============================================================================
// Thread ID Parsing
// =============================================================================

/**
 * Parse a v2 thread ID into its components.
 *
 * Thread IDs use ':' as delimiter to support UUIDs with hyphens.
 *
 * @param threadId - Thread ID string to parse
 * @returns ParsedThreadId or null if invalid format
 *
 * @example
 * parseV2ThreadId('chat:deal123:user456:conv789')
 * // Returns: { workflowMode: 'chat', dealId: 'deal123', userId: 'user456', conversationId: 'conv789' }
 *
 * parseV2ThreadId('cim:deal123:cim001')
 * // Returns: { workflowMode: 'cim', dealId: 'deal123', userId: null, conversationId: 'cim001' }
 *
 * parseV2ThreadId('chat:550e8400-e29b-41d4-a716-446655440000:user-123:conv-456')
 * // Returns: { workflowMode: 'chat', dealId: '550e8400-e29b-41d4-a716-446655440000', userId: 'user-123', conversationId: 'conv-456' }
 *
 * parseV2ThreadId('invalid')
 * // Returns: null
 */
export function parseV2ThreadId(threadId: string): ParsedThreadId | null {
  if (!threadId || typeof threadId !== 'string') {
    return null
  }

  const parts = threadId.split(THREAD_ID_DELIMITER)

  // CIM format: cim:{dealId}:{cimId} (3 parts)
  if (parts[0] === 'cim' && parts.length === 3) {
    const [, dealId, conversationId] = parts
    if (dealId && conversationId) {
      return {
        workflowMode: 'cim',
        dealId,
        userId: null,
        conversationId,
      }
    }
  }

  // Chat/IRL format: {mode}:{dealId}:{userId}:{conversationId} (4 parts)
  if ((parts[0] === 'chat' || parts[0] === 'irl') && parts.length === 4) {
    const [mode, dealId, userId, conversationId] = parts
    if (dealId && userId && conversationId) {
      return {
        workflowMode: mode as 'chat' | 'irl',
        dealId,
        userId,
        conversationId,
      }
    }
  }

  return null
}
