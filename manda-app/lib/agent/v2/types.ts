/**
 * Agent System v2.0 - Type Definitions
 *
 * Story: 1-1 Create Unified Agent State Schema (AC: #2, #3)
 *
 * All type interfaces for the unified agent state schema.
 * Follows naming conventions:
 * - Interfaces use PascalCase
 * - Enum values use UPPER_SNAKE_CASE
 * - Fields use camelCase
 *
 * References:
 * - [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#State Management]
 * - [Source: _bmad-output/planning-artifacts/agent-system-prd.md#FR1-FR5]
 */

// =============================================================================
// Workflow Mode
// =============================================================================

/**
 * Workflow mode determines the graph entry point and context filtering.
 * Used by workflowRouter middleware to set system prompts.
 *
 * Note: Q&A is NOT a workflow mode - it's a cross-cutting tool available
 * in all workflows for tracking client questions (sell-side).
 */
export type WorkflowMode = 'chat' | 'cim' | 'irl'

// =============================================================================
// Source Citation (AC: #2)
// =============================================================================

/**
 * Source reference for citations in responses.
 * Tracks document attribution for transparency and verifiability.
 */
export interface SourceCitation {
  /** UUID from Supabase documents table */
  documentId: string
  /** Human-readable document name/title */
  documentName: string
  /** Location within document (optional) */
  location?: {
    /** Page number (for PDFs) */
    page?: number
    /** Section heading or title */
    section?: string
    /** Paragraph index */
    paragraph?: number
  }
  /** Relevant text excerpt from document */
  snippet: string
  /** Relevance score from retrieval (0-1) */
  relevanceScore: number
  /** When this source was retrieved (ISO 8601) */
  retrievedAt: string
}

// =============================================================================
// Approval Request (AC: #2)
// =============================================================================

/**
 * Base fields included in all approval requests.
 */
export interface ApprovalRequestBase {
  /** Unique request ID */
  requestId: string
  /** When approval was requested (ISO 8601) */
  requestedAt: string
  /** User-facing approval prompt */
  prompt: string
  /** Optional timeout in milliseconds */
  timeout?: number
}

/**
 * Q&A modification approval - for changes to Q&A items.
 */
export interface QAModificationApproval extends ApprovalRequestBase {
  type: 'qa_modification'
  operation: 'add' | 'edit' | 'delete'
  targetId: string
  data: unknown
}

/**
 * Plan approval - for complex multi-step operations.
 */
export interface PlanApproval extends ApprovalRequestBase {
  type: 'plan_approval'
  steps: string[]
  estimatedImpact: string
}

/**
 * Knowledge base update approval - for adding facts to knowledge graph.
 */
export interface KnowledgeBaseUpdateApproval extends ApprovalRequestBase {
  type: 'knowledge_base_update'
  fact: string
  source: string
  confidence: number
}

/**
 * Destructive action approval - for irreversible operations.
 */
export interface DestructiveActionApproval extends ApprovalRequestBase {
  type: 'destructive_action'
  action: string
  warning: string
}

/**
 * Discriminated union of all approval request types.
 * Use `type` field to discriminate between variants.
 */
export type ApprovalRequest =
  | QAModificationApproval
  | PlanApproval
  | KnowledgeBaseUpdateApproval
  | DestructiveActionApproval

// =============================================================================
// Agent Error (AC: #2)
// =============================================================================

/**
 * Error codes for agent operations.
 * Used for structured error handling and recovery decisions.
 */
export enum AgentErrorCode {
  /** LLM call failed (rate limit, timeout, etc.) */
  LLM_ERROR = 'LLM_ERROR',
  /** Specialist/tool execution failed */
  TOOL_ERROR = 'TOOL_ERROR',
  /** Invalid state transition */
  STATE_ERROR = 'STATE_ERROR',
  /** Deal context loading failed */
  CONTEXT_ERROR = 'CONTEXT_ERROR',
  /** User rejected HITL approval */
  APPROVAL_REJECTED = 'APPROVAL_REJECTED',
  /** SSE connection issue */
  STREAMING_ERROR = 'STREAMING_ERROR',
  /** Redis operation failed (non-fatal) */
  CACHE_ERROR = 'CACHE_ERROR',
}

/**
 * Structured error with code, message, and recovery information.
 */
export interface AgentError {
  /** Error classification code */
  code: AgentErrorCode
  /** User-friendly error message */
  message: string
  /** Debug information (stack trace, request details) */
  details?: unknown
  /** Whether operation can be retried */
  recoverable: boolean
  /** When error occurred (ISO 8601) */
  timestamp: string
  /** Which graph node failed (for debugging) */
  nodeId?: string
}

// =============================================================================
// Deal Context (AC: #2)
// =============================================================================

/**
 * Deal metadata loaded once per thread.
 * Provides tenant isolation and deal-specific context.
 */
export interface DealContext {
  /** UUID from Supabase deals table */
  dealId: string
  /** Human-readable deal name */
  dealName: string
  /** Project/tenant ID for RLS */
  projectId: string
  /** Optional organization scope */
  organizationId?: string
  /** Deal lifecycle status */
  status: 'active' | 'closed' | 'archived'
  /** Number of uploaded documents */
  documentCount: number
  /** When deal was created (ISO 8601) */
  createdAt: string
  /** Extensible metadata for future use */
  metadata?: Record<string, unknown>
}

// =============================================================================
// CIM Workflow State (AC: #2)
// =============================================================================

/**
 * CIM Builder workflow phases.
 * Ordered sequence of phases for the CIM creation process.
 */
export type CIMPhase = 'persona' | 'outline' | 'content' | 'visuals' | 'export'

/**
 * Individual slide in the CIM document.
 */
export interface Slide {
  /** Unique slide ID */
  id: string
  /** Slide title/heading */
  title: string
  /** Slide content (markdown) */
  content: string
  /** Slide completion status */
  status: 'pending' | 'draft' | 'complete'
}

/**
 * CIM workflow-specific state.
 * Tracks progress through the CIM Builder multi-phase workflow.
 */
export interface CIMWorkflowState {
  /** CIM document ID */
  cimId: string
  /** Current workflow phase */
  currentPhase: CIMPhase
  /** Phases already completed */
  completedPhases: CIMPhase[]
  /** Target buyer description */
  buyerPersona: string | null
  /** Investment rationale */
  investmentThesis: string | null
  /** CIM section outline */
  outline: string[] | null
  /** Generated slides */
  slides: Slide[]
  /** Slide dependencies (slide ID -> dependent slide IDs) */
  dependencyGraph: Record<string, string[]>
  /** Whether CIM workflow is complete */
  isComplete: boolean
}

// =============================================================================
// Agent Stream Events (AC: #2 - for streaming)
// =============================================================================

/**
 * Token streaming event - partial response content.
 */
export interface TokenStreamEvent {
  type: 'token'
  content: string
  timestamp: string
}

/**
 * Source added event - when a source is referenced.
 */
export interface SourceAddedEvent {
  type: 'source_added'
  source: SourceCitation
  timestamp: string
}

/**
 * Approval required event - HITL interrupt.
 */
export interface ApprovalRequiredEvent {
  type: 'approval_required'
  request: ApprovalRequest
  timestamp: string
}

/**
 * Specialist progress event - during specialist execution.
 */
export interface SpecialistProgressEvent {
  type: 'specialist_progress'
  specialistId: string
  status: 'started' | 'thinking' | 'completed' | 'error'
  message?: string
  timestamp: string
}

/**
 * Error event - non-fatal error during processing.
 */
export interface ErrorStreamEvent {
  type: 'error'
  error: AgentError
  timestamp: string
}

/**
 * Done event - final state after completion.
 */
export interface DoneStreamEvent {
  type: 'done'
  messageId: string
  sources: SourceCitation[]
  timestamp: string
}

/**
 * Discriminated union of all stream event types.
 * Used for SSE streaming to the frontend.
 */
export type AgentStreamEvent =
  | TokenStreamEvent
  | SourceAddedEvent
  | ApprovalRequiredEvent
  | SpecialistProgressEvent
  | ErrorStreamEvent
  | DoneStreamEvent
