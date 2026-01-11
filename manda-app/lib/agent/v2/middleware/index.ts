/**
 * Agent System v2.0 - Middleware Infrastructure
 *
 * Story: 2-3 Implement Workflow Router Middleware (AC: #2)
 *
 * Middleware are functions that transform agent state before
 * the supervisor node processes it. They run in a defined order:
 *
 * Middleware Order (Critical):
 * 1. workflowRouterMiddleware - Set system prompt by mode
 * 2. toolSelectorMiddleware   - Filter tools by mode/permissions (Story 4.1)
 * 3. summarizationMiddleware  - Compress at 70% threshold (Story 4.7)
 *
 * Note: Context loading is handled via:
 * - API route: dealId passed to createInitialState()
 * - Retrieval node: uses dealId for Graphiti queries
 * Context-loader middleware was removed (Epic 3 retro decision 2026-01-11)
 *
 * Middleware Pattern:
 * - Input: Current AgentState
 * - Output: Modified AgentState (new object, not mutated)
 * - Immutable: returns new state, doesn't mutate input
 * - Composable: can be chained with other middleware
 * - Sync or Async: Middleware can return AgentState or Promise<AgentState>
 *
 * References:
 * - [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Context Engineering Strategy]
 * - [Source: CLAUDE.md#Middleware Order (Critical)]
 */

import type { AgentStateType } from '../state'

// =============================================================================
// Middleware Type Definitions (AC: #2, Story 3.1 Task 2.3)
// =============================================================================

/**
 * Synchronous middleware function type.
 *
 * Story: 2-3 Implement Workflow Router Middleware (AC: #2)
 *
 * @example
 * ```typescript
 * const middleware: SyncMiddleware = (state) => ({
 *   ...state,
 *   systemPrompt: 'Modified prompt'
 * })
 * ```
 */
export type SyncMiddleware = (state: AgentStateType) => AgentStateType

/**
 * Asynchronous middleware function type.
 *
 * Story: 3-1 Implement Context Loader Middleware (AC: #4)
 *
 * Used for middleware that performs async operations like:
 * - Database queries (Supabase)
 * - Cache operations (Redis)
 * - External API calls
 *
 * @example
 * ```typescript
 * const middleware: AsyncMiddleware = async (state) => {
 *   const data = await fetchData()
 *   return { ...state, data }
 * }
 * ```
 */
export type AsyncMiddleware = (state: AgentStateType) => Promise<AgentStateType>

/**
 * Unified middleware type - supports both sync and async.
 *
 * Story: 3-1 Implement Context Loader Middleware (Task 2.3)
 *
 * Middleware can be either synchronous or asynchronous.
 * The middleware runner should await all middleware to handle both cases.
 *
 * @example
 * ```typescript
 * // Sync middleware
 * const sync: Middleware = (state) => ({ ...state, foo: 'bar' })
 *
 * // Async middleware
 * const async: Middleware = async (state) => {
 *   const data = await loadData()
 *   return { ...state, data }
 * }
 * ```
 */
export type Middleware = SyncMiddleware | AsyncMiddleware

// =============================================================================
// Middleware Exports
// =============================================================================

export {
  workflowRouterMiddleware,
  getIRLSystemPrompt,
} from './workflow-router'
