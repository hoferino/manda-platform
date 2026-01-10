/**
 * Agent System v2.0 - Unified State Schema
 *
 * Story: 1-1 Create Unified Agent State Schema (AC: #1, #3, #5)
 *
 * Single state schema for all workflows using LangGraph Annotation.Root().
 * Supports the 4-pillar context engineering approach:
 * - Write (scratchpad)
 * - Select (dealContext)
 * - Compress (historySummary/tokenCount)
 * - Isolate (workflowMode filtering)
 *
 * References:
 * - [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#State Management]
 * - [External: https://langchain-ai.github.io/langgraphjs/how-tos/define-state/]
 */

import { Annotation, messagesStateReducer } from '@langchain/langgraph'
import type { BaseMessage } from '@langchain/core/messages'

import type {
  SourceCitation,
  ApprovalRequest,
  AgentError,
  DealContext,
  CIMWorkflowState,
  WorkflowMode,
} from './types'

// =============================================================================
// AgentState Annotation (AC: #1)
// =============================================================================

/**
 * Unified agent state schema using LangGraph Annotation.
 *
 * This state flows through all nodes in the agent graph.
 * Uses reducers for proper state updates:
 * - Replace: scalar values (dealContext, workflowMode)
 * - Append: messagesStateReducer for messages (handles ID-based updates)
 * - Accumulate: concat for arrays (sources, errors)
 *
 * All 12 required fields per AC #1 + Story 2.3:
 * 1. messages - conversation history with messagesStateReducer
 * 2. sources - attribution tracking (accumulate)
 * 3. pendingApproval - HITL approval state (replace)
 * 4. activeSpecialist - current specialist (replace)
 * 5. errors - error history (accumulate)
 * 6. dealContext - deal metadata (replace)
 * 7. workflowMode - graph entry point (replace)
 * 8. cimState - CIM workflow state (replace)
 * 9. scratchpad - agent notes (replace/merge)
 * 10. historySummary - compressed history (replace)
 * 11. tokenCount - context usage tracking (replace)
 * 12. systemPrompt - workflow-specific system prompt (replace, Story 2.3)
 *
 * @example
 * ```typescript
 * const graph = new StateGraph(AgentState)
 *   .addNode('supervisor', supervisorNode)
 *   .addNode('retrieval', retrievalNode)
 *   .compile({ checkpointer })
 * ```
 */
export const AgentState = Annotation.Root({
  /**
   * Conversation history with LangChain message types.
   * Uses messagesStateReducer for ID-based message updates.
   */
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  /**
   * Source citations for all responses in this conversation.
   * Accumulates - new sources are appended to existing.
   */
  sources: Annotation<SourceCitation[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  /**
   * Pending approval request for human-in-the-loop.
   * Null when no approval is pending.
   */
  pendingApproval: Annotation<ApprovalRequest | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /**
   * Currently active specialist agent ID.
   * Null when no specialist is active.
   * Examples: 'financial-analyst', 'document-researcher', 'kg-expert'
   */
  activeSpecialist: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /**
   * Error history with structured error codes.
   * Accumulates - new errors are appended to existing.
   */
  errors: Annotation<AgentError[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  /**
   * Deal context loaded once per thread.
   * Contains deal metadata for tenant isolation and context.
   */
  dealContext: Annotation<DealContext | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /**
   * Workflow mode determines graph entry point.
   * Routes to appropriate system prompt and tool filtering.
   */
  workflowMode: Annotation<WorkflowMode>({
    reducer: (_, next) => next,
    default: () => 'chat',
  }),

  /**
   * CIM Builder workflow-specific state.
   * Null for non-CIM workflows.
   */
  cimState: Annotation<CIMWorkflowState | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /**
   * Agent notes and intermediate computations.
   * Used by specialists to share context without polluting messages.
   * Merge behavior: shallow merge of new keys into existing.
   */
  scratchpad: Annotation<Record<string, unknown>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),

  /**
   * Compressed conversation history summary.
   * Created when tokenCount exceeds 70% of context window.
   */
  historySummary: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /**
   * Current token count for context window management.
   * Used by summarization middleware to decide when to compress.
   */
  tokenCount: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),

  /**
   * System prompt set by workflow-router middleware.
   * Supervisor reads this field instead of building inline.
   * Story: 2-3 Implement Workflow Router Middleware (AC: #3, #5)
   */
  systemPrompt: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
})

/**
 * TypeScript type for AgentState.
 * Use this for function signatures and type annotations.
 */
export type AgentStateType = typeof AgentState.State

// =============================================================================
// Helper Functions (AC: #5)
// =============================================================================

/**
 * Create initial state for a new agent conversation.
 *
 * @param workflowMode - Initial workflow mode (defaults to 'chat')
 * @param dealId - Optional deal ID for context loading
 * @param userId - Optional user ID for permission checks
 * @returns Initial AgentState ready for graph execution
 *
 * @remarks
 * When `dealId` is provided, creates a partial DealContext with empty
 * `dealName` and `projectId` fields. These MUST be populated by the
 * contextLoader middleware before the graph processes user messages.
 * The contextLoader middleware (story 3-1) is responsible for:
 * 1. Fetching full deal metadata from Supabase
 * 2. Replacing the partial context with complete data
 * 3. Failing fast if the deal doesn't exist or user lacks access
 *
 * @example
 * ```typescript
 * const state = createInitialState('chat', 'deal-123', 'user-456')
 * const result = await graph.invoke(state, { configurable: { thread_id } })
 * ```
 */
export function createInitialState(
  workflowMode: WorkflowMode = 'chat',
  dealId?: string,
  userId?: string
): AgentStateType {
  return {
    messages: [],
    sources: [],
    pendingApproval: null,
    activeSpecialist: null,
    errors: [],
    dealContext: dealId
      ? {
          dealId,
          dealName: '', // To be populated by context loader
          projectId: '', // To be populated by context loader
          status: 'active',
          documentCount: 0,
          createdAt: new Date().toISOString(),
        }
      : null,
    workflowMode,
    cimState: null,
    scratchpad: userId ? { userId } : {},
    historySummary: null,
    tokenCount: 0,
    systemPrompt: null, // To be set by workflow-router middleware
  }
}

/**
 * Create initial state for a CIM Builder workflow.
 *
 * @param cimId - CIM document ID
 * @param dealId - Deal ID for context
 * @param userId - User ID for permissions
 * @returns Initial AgentState configured for CIM workflow
 *
 * @example
 * ```typescript
 * const state = createInitialCIMState('cim-001', 'deal-123', 'user-456')
 * const result = await graph.invoke(state, { configurable: { thread_id: `cim-${dealId}-${cimId}` } })
 * ```
 */
export function createInitialCIMState(
  cimId: string,
  dealId: string,
  userId: string
): AgentStateType {
  return {
    messages: [],
    sources: [],
    pendingApproval: null,
    activeSpecialist: null,
    errors: [],
    dealContext: {
      dealId,
      dealName: '', // To be populated by context loader
      projectId: '', // To be populated by context loader
      status: 'active',
      documentCount: 0,
      createdAt: new Date().toISOString(),
    },
    workflowMode: 'cim',
    cimState: {
      cimId,
      currentPhase: 'persona',
      completedPhases: [],
      buyerPersona: null,
      investmentThesis: null,
      outline: null,
      slides: [],
      dependencyGraph: {},
      isComplete: false,
    },
    scratchpad: { userId },
    historySummary: null,
    tokenCount: 0,
    systemPrompt: null, // To be set by workflow-router middleware
  }
}
