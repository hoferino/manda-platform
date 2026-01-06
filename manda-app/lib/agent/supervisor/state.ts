/**
 * Supervisor State Types and Annotation Schema
 *
 * Story: E13.4 - Supervisor Agent Pattern (AC: #1, #3)
 *
 * Defines the shared state schema for multi-agent communication using LangGraph.
 * Uses LangGraph Annotation for state definition with reducers for parallel aggregation.
 *
 * Architecture:
 * - SupervisorState: Central state flowing through the graph
 * - SpecialistResult: Structured output from each specialist agent
 * - SupervisorDecision: Routing decisions with rationale
 *
 * References:
 * - [Source: docs/sprint-artifacts/stories/e13-4-supervisor-agent-pattern.md]
 * - [External: https://docs.langchain.com/oss/javascript/langgraph/graph-api]
 */

import { Annotation } from '@langchain/langgraph'
import { z } from 'zod'
import type { BaseMessage } from '@langchain/core/messages'
import type { EnhancedIntentResult } from '../intent'

// =============================================================================
// Source Reference Types
// =============================================================================

/**
 * Source reference for citations in responses
 * Matches existing Graphiti source format for consistency
 */
export const SourceReferenceSchema = z.object({
  /** Document ID from Supabase */
  documentId: z.string().optional(),
  /** Document name/title */
  documentName: z.string().optional(),
  /** Chunk or passage ID from Graphiti */
  chunkId: z.string().optional(),
  /** Relevance score from retrieval (0-1) */
  relevanceScore: z.number().min(0).max(1).optional(),
  /** Snippet of content for attribution */
  snippet: z.string().optional(),
})

export type SourceReference = z.infer<typeof SourceReferenceSchema>

// =============================================================================
// Specialist Result Types (AC: #3)
// =============================================================================

/**
 * Structured output from a specialist agent
 * Story: E13.4 (AC: #3) - Create shared state schema for multi-agent communication
 *
 * Each specialist returns this structure, which is aggregated by the supervisor
 * for synthesis into a final response.
 */
export interface SpecialistResult {
  /** Unique identifier for the specialist (financial_analyst, knowledge_graph, general) */
  specialistId: string
  /** The specialist's response content */
  output: string
  /** Confidence score for the response (0-1) */
  confidence: number
  /** Sources used by this specialist */
  sources: SourceReference[]
  /** Execution time in milliseconds */
  timing?: number
  /** Flag indicating this is a stub implementation (E13.5/E13.6 not yet implemented) */
  stub?: boolean
  /** Error message if specialist failed */
  error?: string
}

export const SpecialistResultSchema = z.object({
  specialistId: z.string(),
  output: z.string(),
  confidence: z.number().min(0).max(1),
  sources: z.array(SourceReferenceSchema),
  timing: z.number().optional(),
  stub: z.boolean().optional(),
  error: z.string().optional(),
})

// =============================================================================
// Supervisor Decision Types (AC: #2, #5)
// =============================================================================

/**
 * Routing decision made by supervisor
 * Story: E13.4 (AC: #5) - Add supervisor decisions to LangSmith traces
 *
 * Captures the routing rationale for observability and debugging.
 */
export interface SupervisorDecision {
  /** Selected specialist IDs in execution order */
  selectedSpecialists: string[]
  /** Reasoning for specialist selection */
  rationale: string
  /** Whether multiple specialists will run in parallel */
  isParallel: boolean
  /** Timestamp of decision */
  timestamp?: string
  /** Intent classification that informed the decision */
  intentSignals?: {
    type?: string
    complexity?: string
    keywords?: string[]
  }
}

export const SupervisorDecisionSchema = z.object({
  selectedSpecialists: z.array(z.string()),
  rationale: z.string(),
  isParallel: z.boolean(),
  timestamp: z.string().optional(),
  intentSignals: z.object({
    type: z.string().optional(),
    complexity: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  }).optional(),
})

// =============================================================================
// Synthesized Response Types (AC: #4)
// =============================================================================

/**
 * Final synthesized response from supervisor
 * Story: E13.4 (AC: #4) - Implement result synthesis from multiple specialists
 */
export interface SynthesizedResponse {
  /** Final response content */
  content: string
  /** Aggregate confidence (weighted average from specialists) */
  confidence: number
  /** Deduplicated sources from all specialists */
  sources: SourceReference[]
  /** IDs of specialists that contributed */
  specialists: string[]
  /** Whether response was synthesized from multiple specialists */
  wasSynthesized: boolean
  /** Total time for all specialist execution */
  totalLatencyMs?: number
}

export const SynthesizedResponseSchema = z.object({
  content: z.string(),
  confidence: z.number().min(0).max(1),
  sources: z.array(SourceReferenceSchema),
  specialists: z.array(z.string()),
  wasSynthesized: z.boolean(),
  totalLatencyMs: z.number().optional(),
})

// =============================================================================
// Timing Metrics Types
// =============================================================================

/**
 * Timing metrics for observability
 */
export interface SupervisorMetrics {
  startTime?: number
  classifyLatencyMs?: number
  routeLatencyMs?: number
  synthesizeLatencyMs?: number
  totalLatencyMs?: number
}

// =============================================================================
// Supervisor State Annotation (AC: #1)
// =============================================================================

/**
 * Supervisor state annotation using LangGraph Annotation
 * Story: E13.4 (AC: #1) - Create SupervisorAgent using LangGraph StateGraph
 *
 * This state flows through all nodes in the supervisor graph.
 * Uses reducers for aggregating results from parallel specialists.
 *
 * Usage with StateGraph:
 * ```typescript
 * const graph = new StateGraph(SupervisorStateAnnotation)
 *   .addNode('classify', classifyNode)
 *   .addNode('route', routeNode)
 *   // ...
 *   .compile()
 * ```
 */
export const SupervisorStateAnnotation = Annotation.Root({
  /** Original user query */
  query: Annotation<string>(),

  /** Deal ID for context isolation */
  dealId: Annotation<string>(),

  /** User ID for permission checks */
  userId: Annotation<string>(),

  /** Organization ID for multi-tenant isolation (E12.9) */
  organizationId: Annotation<string | undefined>(),

  /** Intent classification result from E13.1 */
  intent: Annotation<EnhancedIntentResult | undefined>(),

  /** Supervisor routing decision */
  decision: Annotation<SupervisorDecision | undefined>(),

  /**
   * Results from specialist agents (aggregated via reducer)
   * Uses concat reducer to aggregate results from parallel specialist nodes
   */
  specialistResults: Annotation<SpecialistResult[]>({
    reducer: (existing, incoming) => [...existing, ...incoming],
    default: () => [],
  }),

  /** Final synthesized response */
  synthesizedResponse: Annotation<SynthesizedResponse | undefined>(),

  /**
   * Messages for LLM context (optional, for synthesis step)
   * Uses concat reducer for message aggregation
   */
  messages: Annotation<BaseMessage[]>({
    reducer: (existing, incoming) => [...existing, ...incoming],
    default: () => [],
  }),

  /** Error state if supervisor encounters issues */
  error: Annotation<string | undefined>(),

  /** Timing metrics for observability */
  metrics: Annotation<SupervisorMetrics | undefined>(),
})

/**
 * TypeScript type for SupervisorState
 * Use this for function signatures and type annotations
 */
export type SupervisorState = typeof SupervisorStateAnnotation.State

// =============================================================================
// State Factory Functions
// =============================================================================

/**
 * Create initial supervisor state from a query
 *
 * @param query - User's original query
 * @param dealId - Deal ID for context
 * @param userId - User ID for permissions
 * @param organizationId - Optional organization ID for multi-tenant isolation
 * @returns Initial SupervisorState ready for graph execution
 */
export function createInitialState(
  query: string,
  dealId: string,
  userId: string,
  organizationId?: string
): SupervisorState {
  return {
    query,
    dealId,
    userId,
    organizationId,
    intent: undefined,
    decision: undefined,
    specialistResults: [],
    synthesizedResponse: undefined,
    messages: [],
    error: undefined,
    metrics: {
      startTime: Date.now(),
    },
  }
}

/**
 * Create a specialist result (helper for specialist nodes)
 *
 * @param specialistId - The specialist identifier
 * @param output - Response content
 * @param confidence - Confidence score (0-1)
 * @param sources - Source references
 * @param options - Optional timing and stub flag
 * @returns SpecialistResult
 */
export function createSpecialistResult(
  specialistId: string,
  output: string,
  confidence: number,
  sources: SourceReference[] = [],
  options?: { timing?: number; stub?: boolean; error?: string }
): SpecialistResult {
  return {
    specialistId,
    output,
    confidence,
    sources,
    timing: options?.timing,
    stub: options?.stub,
    error: options?.error,
  }
}

/**
 * Create a supervisor decision (helper for routing node)
 *
 * @param selectedSpecialists - Specialists to invoke
 * @param rationale - Reasoning for selection
 * @param isParallel - Whether to run in parallel
 * @param intentSignals - Optional intent signals that informed decision
 * @returns SupervisorDecision
 */
export function createSupervisorDecision(
  selectedSpecialists: string[],
  rationale: string,
  isParallel: boolean,
  intentSignals?: { type?: string; complexity?: string; keywords?: string[] }
): SupervisorDecision {
  return {
    selectedSpecialists,
    rationale,
    isParallel,
    timestamp: new Date().toISOString(),
    intentSignals,
  }
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate a specialist result
 * @returns true if valid, false otherwise
 */
export function isValidSpecialistResult(result: unknown): result is SpecialistResult {
  return SpecialistResultSchema.safeParse(result).success
}

/**
 * Validate synthesized response
 * @returns true if valid, false otherwise
 */
export function isValidSynthesizedResponse(response: unknown): response is SynthesizedResponse {
  return SynthesizedResponseSchema.safeParse(response).success
}
