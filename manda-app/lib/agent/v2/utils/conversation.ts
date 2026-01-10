/**
 * Agent System v2.0 - Conversation ID Utilities
 *
 * Story: 1-4 Implement Thread ID Generation and Management (AC: #1)
 *
 * UUID generation for new conversations. Each conversation gets a unique
 * identifier that becomes part of the thread ID for checkpointer isolation.
 *
 * References:
 * - [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Thread Management]
 * - [Source: CLAUDE.md#Thread ID Pattern]
 */

import { randomUUID } from 'crypto'

/**
 * Generate a new conversation ID using UUID v4.
 *
 * Used when creating a new conversation thread. The conversation ID
 * is returned to the client so they can resume the conversation later.
 *
 * @returns UUID v4 string
 *
 * @example
 * ```typescript
 * const conversationId = generateConversationId()
 * // Returns: '550e8400-e29b-41d4-a716-446655440000'
 * ```
 */
export function generateConversationId(): string {
  return randomUUID()
}

/**
 * Validate that a string is a valid conversation ID format.
 *
 * Accepts UUID v4 format (with hyphens).
 *
 * @param id - String to validate
 * @returns True if valid UUID format
 *
 * @example
 * ```typescript
 * isValidConversationId('550e8400-e29b-41d4-a716-446655440000') // true
 * isValidConversationId('invalid') // false
 * ```
 */
export function isValidConversationId(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false
  }
  // UUID v4 pattern: 8-4-4-4-12 hex characters
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidPattern.test(id)
}
