/**
 * Supervisor Graph Implementation
 *
 * Story: E13.4 - Supervisor Agent Pattern (AC: #1, #4, #5)
 *
 * LangGraph StateGraph implementation for multi-agent supervisor.
 * Routes complex queries to specialist agents and synthesizes responses.
 *
 * Graph Flow:
 * START → classify → route → [specialists in parallel] → synthesize → END
 *
 * References:
 * - [Source: docs/sprint-artifacts/stories/e13-4-supervisor-agent-pattern.md]
 * - [External: https://docs.langchain.com/oss/javascript/langgraph/graph-api]
 */

import { StateGraph, START, END, MemorySaver, Send } from '@langchain/langgraph'
import {
  SupervisorStateAnnotation,
  type SupervisorState,
  createInitialState,
} from './state'
import {
  routeToSpecialists,
  createDecisionFromRouting,
  SPECIALIST_IDS,
  type RoutingResult,
} from './routing'
import {
  financialAnalystNode,
  knowledgeGraphNode,
  generalAgentNode,
} from './specialists'
import { synthesizeResults, getSynthesisStats } from './synthesis'
import { classifyIntentAsync, type EnhancedIntentResult } from '../intent'

// =============================================================================
// Invocation Types
// =============================================================================

/**
 * Options for invoking the supervisor agent
 * Story: E13.4 - Supervisor Agent Pattern
 *
 * @example
 * ```typescript
 * const options: SupervisorInvokeOptions = {
 *   query: 'What is the EBITDA margin trend?',
 *   dealId: 'deal-123',
 *   userId: 'user-456',
 *   organizationId: 'org-789', // Optional
 *   intent: classifiedIntent, // Optional - skips classification if provided
 * }
 * ```
 */
export interface SupervisorInvokeOptions {
  /** User query to process. Must be non-empty, max 10,000 characters. */
  query: string
  /** Deal ID for context isolation (used for document retrieval). Required. */
  dealId: string
  /** User ID for permission checks and audit logging. Required. */
  userId: string
  /** Organization ID for multi-tenant isolation (E12.9). Optional. */
  organizationId?: string
  /** Pre-classified intent from E13.1. If provided, skips classification step. */
  intent?: EnhancedIntentResult
  /** Thread ID for conversation memory via LangGraph checkpointer. Optional. */
  threadId?: string
}

/**
 * Result from supervisor invocation
 * Story: E13.4 - Supervisor Agent Pattern
 *
 * Contains the synthesized response, confidence scores, sources, and metadata
 * about which specialists contributed and timing metrics.
 *
 * @example
 * ```typescript
 * const result = await invokeSupervisor(options)
 * console.log(result.content) // The AI response
 * console.log(result.specialists) // ['financial_analyst', 'knowledge_graph']
 * console.log(result.wasSynthesized) // true if multiple specialists
 * ```
 */
export interface SupervisorInvokeResult {
  /** Final response content - the synthesized answer to the user's query */
  content: string
  /** Aggregate confidence score (0-1) - weighted average from specialists */
  confidence: number
  /** Source references - deduplicated across all specialists */
  sources: Array<{
    /** Document ID from Supabase */
    documentId?: string
    /** Human-readable document name */
    documentName?: string
    /** Chunk or passage ID from Graphiti */
    chunkId?: string
    /** Relevance score from retrieval (0-1) */
    relevanceScore?: number
    /** Text snippet for attribution */
    snippet?: string
  }>
  /** IDs of specialists that contributed to the response */
  specialists: string[]
  /** True if response was synthesized from multiple specialist outputs */
  wasSynthesized: boolean
  /** Routing decision details for observability */
  routing: {
    /** Specialists that were selected by the router */
    selectedSpecialists: string[]
    /** Human-readable explanation of routing decision */
    rationale: string
    /** True if specialists ran in parallel */
    isParallel: boolean
  }
  /** Timing metrics for performance monitoring */
  metrics: {
    /** Total end-to-end latency in milliseconds */
    totalLatencyMs: number
    /** Time spent on intent classification (if not pre-classified) */
    classifyLatencyMs?: number
    /** Time spent on routing decision */
    routeLatencyMs?: number
    /** Time spent on result synthesis */
    synthesizeLatencyMs?: number
  }
}

// =============================================================================
// Graph Nodes (AC: #1)
// =============================================================================

/**
 * Classify node - Classifies intent using E13.1 classifier
 * Story: E13.4 (AC: #1) - Create classify node using classifyIntentAsync()
 */
async function classifyNode(
  state: SupervisorState
): Promise<Partial<SupervisorState>> {
  const startTime = Date.now()

  // Skip if intent already provided
  if (state.intent) {
    console.log('[Supervisor] Using pre-classified intent')
    return {}
  }

  console.log('[Supervisor] Classifying intent...')
  const intent = await classifyIntentAsync(state.query)

  return {
    intent,
    metrics: {
      ...state.metrics,
      classifyLatencyMs: Date.now() - startTime,
    },
  }
}

/**
 * Route node - Determines which specialists to invoke
 * Story: E13.4 (AC: #1) - Create route node using routeToSpecialists()
 */
function routeNode(state: SupervisorState): Partial<SupervisorState> {
  const startTime = Date.now()

  if (!state.intent) {
    console.warn('[Supervisor] No intent available, defaulting to general')
    return {
      decision: {
        selectedSpecialists: [SPECIALIST_IDS.GENERAL],
        rationale: 'No intent classification available',
        isParallel: false,
      },
    }
  }

  const routingResult = routeToSpecialists(state.intent, state.query)
  const decision = createDecisionFromRouting(routingResult, state.intent)

  // Log for LangSmith tracing (AC: #5)
  console.log(
    JSON.stringify({
      event: 'supervisor_routing',
      specialists: routingResult.specialists,
      isParallel: routingResult.isParallel,
      rationale: routingResult.rationale,
      matchedKeywords: routingResult.matchedKeywords,
      intent: state.intent.intent,
      complexity: state.intent.complexity,
      timestamp: new Date().toISOString(),
    })
  )

  return {
    decision,
    metrics: {
      ...state.metrics,
      routeLatencyMs: Date.now() - startTime,
    },
  }
}

/**
 * Synthesize node - Combines specialist results into final response
 * Story: E13.4 (AC: #4) - Implement result synthesis from multiple specialists
 */
async function synthesizeNode(
  state: SupervisorState
): Promise<Partial<SupervisorState>> {
  const startTime = Date.now()

  console.log(
    `[Supervisor] Synthesizing ${state.specialistResults.length} specialist results`
  )

  const synthesizedResponse = await synthesizeResults(state.specialistResults)

  // Log synthesis stats for LangSmith tracing (AC: #5)
  console.log(
    JSON.stringify({
      event: 'supervisor_synthesis',
      ...getSynthesisStats(synthesizedResponse),
      timestamp: new Date().toISOString(),
    })
  )

  return {
    synthesizedResponse,
    metrics: {
      ...state.metrics,
      synthesizeLatencyMs: Date.now() - startTime,
      totalLatencyMs: state.metrics?.startTime
        ? Date.now() - state.metrics.startTime
        : undefined,
    },
  }
}

// =============================================================================
// Conditional Edge Functions
// =============================================================================

/**
 * Router function for conditional edges from route node to specialists
 * Returns Send objects for parallel execution when multiple specialists selected
 *
 * Story: E13.4 (AC: #1) - Add conditional edges from route to specialist nodes
 */
function routeToSpecialistNodes(
  state: SupervisorState
): Array<Send> | string {
  const specialists = state.decision?.selectedSpecialists ?? [SPECIALIST_IDS.GENERAL]

  // Handle edge case: empty specialists array (should not happen, but be defensive)
  if (specialists.length === 0) {
    console.warn('[Supervisor] No specialists selected, defaulting to general')
    return SPECIALIST_IDS.GENERAL
  }

  // If single specialist, return node name directly
  if (specialists.length === 1) {
    return specialists[0] ?? SPECIALIST_IDS.GENERAL
  }

  // Multiple specialists - use Send for parallel execution
  return specialists.map(
    specialist => new Send(specialist, state)
  )
}

// =============================================================================
// Graph Construction (AC: #1)
// =============================================================================

/**
 * Create the supervisor graph
 * Story: E13.4 (AC: #1) - Create SupervisorAgent using LangGraph StateGraph
 *
 * Graph structure:
 * - START → classify → route → [specialists] → synthesize → END
 * - Specialists run in parallel when multiple are selected
 * - MemorySaver used for checkpointing (TODO: PostgresSaver in E13.9)
 *
 * @returns Compiled StateGraph
 */
export function createSupervisorGraph() {
  // TODO: E13.9 - Replace with PostgresSaver when implemented
  const checkpointer = new MemorySaver()

  const workflow = new StateGraph(SupervisorStateAnnotation)
    // Add nodes
    .addNode('classify', classifyNode)
    .addNode('route', routeNode)
    .addNode(SPECIALIST_IDS.FINANCIAL_ANALYST, financialAnalystNode)
    .addNode(SPECIALIST_IDS.KNOWLEDGE_GRAPH, knowledgeGraphNode)
    .addNode(SPECIALIST_IDS.GENERAL, generalAgentNode)
    .addNode('synthesize', synthesizeNode)

    // Add edges from START
    .addEdge(START, 'classify')
    .addEdge('classify', 'route')

    // Conditional edges from route to specialists
    .addConditionalEdges('route', routeToSpecialistNodes, [
      SPECIALIST_IDS.FINANCIAL_ANALYST,
      SPECIALIST_IDS.KNOWLEDGE_GRAPH,
      SPECIALIST_IDS.GENERAL,
    ])

    // All specialists lead to synthesize
    .addEdge(SPECIALIST_IDS.FINANCIAL_ANALYST, 'synthesize')
    .addEdge(SPECIALIST_IDS.KNOWLEDGE_GRAPH, 'synthesize')
    .addEdge(SPECIALIST_IDS.GENERAL, 'synthesize')

    // Synthesize leads to END
    .addEdge('synthesize', END)

  // Compile with checkpointer
  return workflow.compile({ checkpointer })
}

// =============================================================================
// Main Invocation Function
// =============================================================================

/**
 * Invoke the supervisor graph
 * Story: E13.4 - Main entry point for supervisor invocation
 *
 * @param options - Invocation options
 * @returns SupervisorInvokeResult with response and metadata
 *
 * @example
 * ```typescript
 * const result = await invokeSupervisor({
 *   query: 'What is the EBITDA margin trend?',
 *   dealId: 'deal-123',
 *   userId: 'user-456',
 *   intent, // Optional pre-classified intent
 * })
 *
 * console.log(result.content) // Synthesized response
 * console.log(result.specialists) // ['financial_analyst']
 * ```
 */
/**
 * Maximum query length to prevent abuse
 */
const MAX_QUERY_LENGTH = 10000

export async function invokeSupervisor(
  options: SupervisorInvokeOptions
): Promise<SupervisorInvokeResult> {
  const { query, dealId, userId, organizationId, intent, threadId } = options

  // Input validation
  if (!query || typeof query !== 'string') {
    throw new Error('Query is required and must be a string')
  }

  const trimmedQuery = query.trim()
  if (trimmedQuery.length === 0) {
    throw new Error('Query cannot be empty')
  }

  if (trimmedQuery.length > MAX_QUERY_LENGTH) {
    throw new Error(`Query exceeds maximum length of ${MAX_QUERY_LENGTH} characters`)
  }

  if (!dealId || typeof dealId !== 'string') {
    throw new Error('dealId is required')
  }

  if (!userId || typeof userId !== 'string') {
    throw new Error('userId is required')
  }

  console.log(`[Supervisor] Invoked for query: "${trimmedQuery.substring(0, 100)}${trimmedQuery.length > 100 ? '...' : ''}"`)

  // Create graph
  const graph = createSupervisorGraph()

  // Create initial state with validated query
  const initialState = createInitialState(trimmedQuery, dealId, userId, organizationId)

  // Add pre-classified intent if provided
  if (intent) {
    initialState.intent = intent
  }

  // Build config for invocation with LangSmith metadata
  const config: {
    configurable?: { thread_id: string }
    tags?: string[]
    metadata?: Record<string, unknown>
    runName?: string
  } = {
    tags: ['supervisor', 'e13.4'],
    runName: 'SupervisorAgent',
    metadata: {
      dealId,
      userId,
      queryLength: trimmedQuery.length,
      hasPreclassifiedIntent: !!intent,
      intentType: intent?.intent,
      complexity: intent?.complexity ?? 'unknown',
    },
  }

  if (threadId) {
    config.configurable = { thread_id: threadId }
  }

  // Invoke graph with tracing config
  const finalState = await graph.invoke(initialState, config)

  // Extract result
  const response = finalState.synthesizedResponse

  if (!response) {
    // Should not happen, but handle gracefully
    console.error('[Supervisor] No synthesized response in final state')
    return {
      content: 'I was unable to process your query. Please try again.',
      confidence: 0,
      sources: [],
      specialists: [],
      wasSynthesized: false,
      routing: {
        selectedSpecialists: finalState.decision?.selectedSpecialists ?? [],
        rationale: finalState.decision?.rationale ?? 'Unknown',
        isParallel: finalState.decision?.isParallel ?? false,
      },
      metrics: {
        totalLatencyMs: finalState.metrics?.totalLatencyMs ?? 0,
        classifyLatencyMs: finalState.metrics?.classifyLatencyMs,
        routeLatencyMs: finalState.metrics?.routeLatencyMs,
        synthesizeLatencyMs: finalState.metrics?.synthesizeLatencyMs,
      },
    }
  }

  // Log final result for LangSmith tracing (AC: #5)
  console.log(
    JSON.stringify({
      event: 'supervisor_complete',
      specialists: response.specialists,
      confidence: response.confidence,
      sourceCount: response.sources.length,
      wasSynthesized: response.wasSynthesized,
      totalLatencyMs: finalState.metrics?.totalLatencyMs,
      timestamp: new Date().toISOString(),
    })
  )

  return {
    content: response.content,
    confidence: response.confidence,
    sources: response.sources,
    specialists: response.specialists,
    wasSynthesized: response.wasSynthesized,
    routing: {
      selectedSpecialists: finalState.decision?.selectedSpecialists ?? response.specialists,
      rationale: finalState.decision?.rationale ?? 'Direct routing',
      isParallel: finalState.decision?.isParallel ?? false,
    },
    metrics: {
      totalLatencyMs: finalState.metrics?.totalLatencyMs ?? response.totalLatencyMs ?? 0,
      classifyLatencyMs: finalState.metrics?.classifyLatencyMs,
      routeLatencyMs: finalState.metrics?.routeLatencyMs,
      synthesizeLatencyMs: finalState.metrics?.synthesizeLatencyMs,
    },
  }
}

// =============================================================================
// Graph Utilities
// =============================================================================

/**
 * Get supervisor graph metadata for debugging
 */
export function getSupervisorGraphInfo(): {
  nodes: string[]
  specialists: string[]
} {
  return {
    nodes: ['classify', 'route', 'synthesize'],
    specialists: Object.values(SPECIALIST_IDS),
  }
}
