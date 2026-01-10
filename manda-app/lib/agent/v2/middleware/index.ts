/**
 * Agent System v2.0 - Middleware Infrastructure
 *
 * Story: 2-3 Implement Workflow Router Middleware (AC: #2)
 *
 * Middleware are pure functions that transform agent state before
 * the supervisor node processes it. They run in a defined order:
 *
 * 1. contextLoaderMiddleware  - Load deal context (Story 3.1)
 * 2. workflowRouterMiddleware - Set system prompt by mode ← THIS STORY
 * 3. toolSelectorMiddleware   - Filter tools by mode/permissions (Story 4.1)
 * 4. summarizationMiddleware  - Compress at 70% threshold (Story 4.7)
 *
 * Middleware Pattern:
 * - Input: Current AgentState
 * - Output: Modified AgentState (new object, not mutated)
 * - NO side effects: No LLM calls, no DB queries, no network requests
 * - Synchronous: Returns state directly (not Promise unless truly async)
 *
 * References:
 * - [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Context Engineering Strategy]
 * - [Source: CLAUDE.md#Middleware Order (Critical)]
 */

import type { AgentStateType } from '../state'

// =============================================================================
// Middleware Type Definition (AC: #2)
// =============================================================================

/**
 * Middleware function type.
 *
 * Story: 2-3 Implement Workflow Router Middleware (AC: #2)
 *
 * A middleware transforms agent state synchronously.
 * - Pure function: no side effects
 * - Immutable: returns new state object, doesn't mutate input
 * - Composable: can be chained with other middleware
 *
 * @example
 * ```typescript
 * const middleware: Middleware = (state) => ({
 *   ...state,
 *   systemPrompt: 'Modified prompt'
 * })
 * ```
 */
export type Middleware = (state: AgentStateType) => AgentStateType

// =============================================================================
// Middleware Exports
// =============================================================================

export {
  workflowRouterMiddleware,
  getIRLSystemPrompt,
} from './workflow-router'
