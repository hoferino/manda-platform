/**
 * Agent System v2.0 - Barrel Exports
 *
 * Stories:
 * - 1-1 Create Unified Agent State Schema
 * - 1-2 Create Base StateGraph Structure
 * - 1-3 Connect PostgresSaver Checkpointer
 * - 2-3 Implement Workflow Router Middleware
 *
 * This is the single entry point for all Agent v2 types and utilities.
 * Import from '@/lib/agent/v2' - never use deep path imports.
 *
 * @example
 * ```typescript
 * import { AgentState, createInitialState, type SourceCitation } from '@/lib/agent/v2'
 * import { agentGraph, supervisorNode, createCompiledAgentGraph } from '@/lib/agent/v2'
 * import { invokeAgent, streamAgent, createV2ThreadId } from '@/lib/agent/v2'
 * import { workflowRouterMiddleware, type Middleware } from '@/lib/agent/v2'
 * ```
 */

// Type definitions
export type {
  SourceCitation,
  ApprovalRequest,
  ApprovalRequestBase,
  QAModificationApproval,
  PlanApproval,
  KnowledgeBaseUpdateApproval,
  DestructiveActionApproval,
  AgentError,
  DealContext,
  CIMWorkflowState,
  CIMPhase,
  Slide,
  AgentStreamEvent,
  WorkflowMode,
  // Individual stream event types
  TokenStreamEvent,
  SourceAddedEvent,
  ApprovalRequiredEvent,
  SpecialistProgressEvent,
  ErrorStreamEvent,
  DoneStreamEvent,
} from './types'

export { AgentErrorCode } from './types'

// State schema and helpers
export { AgentState, type AgentStateType } from './state'
export { createInitialState, createInitialCIMState } from './state'

// Graph and nodes (Story 1-2)
export { agentGraph, routeByWorkflowMode } from './graph'
export { supervisorNode, cimPhaseRouterNode } from './nodes'

// Graph factory and invocation helpers (Story 1-3)
export {
  graphBuilder,
  createCompiledAgentGraph,
  resetCompiledGraph,
} from './graph'
export { invokeAgent, streamAgent } from './invoke'

// Thread ID utilities (Story 1-3)
export {
  createV2ThreadId,
  parseV2ThreadId,
  type ParsedThreadId,
} from './utils'

// Conversation ID utilities (Story 1-4)
export { generateConversationId, isValidConversationId } from './utils'

// LLM configuration (Story 2-1)
export { createSupervisorLLM, getSupervisorLLMWithTools } from './llm'

// Error utilities (Story 1-6)
export {
  createAgentError,
  isRecoverableError,
  toUserFriendlyMessage,
  isLLMError,
  isAuthError,
  isToolError,
  logError,
  // Safe invoke utilities
  safeInvokeAgent,
  safeStreamAgent,
  classifyError,
  type SafeInvokeResult,
  type SafeStreamErrorEvent,
  // Retry utilities
  withRetry,
  DEFAULT_RETRY_CONFIG,
  type RetryConfig,
} from './utils'

// Token streaming utilities (Story 2-2)
export { streamAgentWithTokens } from './stream'

// Middleware (Story 2-3)
export type { Middleware } from './middleware'
export { workflowRouterMiddleware, getIRLSystemPrompt } from './middleware'

// Supervisor constants (Story 2-3)
export { SPECIALIST_GUIDANCE } from './nodes/supervisor'
