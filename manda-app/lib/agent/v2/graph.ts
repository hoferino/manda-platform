/**
 * Agent System v2.0 - StateGraph Definition
 *
 * Story: 1-2 Create Base StateGraph Structure (AC: #1, #3, #4)
 *
 * Single StateGraph with conditional entry points for different workflow modes.
 * This is the core infrastructure that all subsequent node implementations depend on.
 *
 * Architecture: Single graph serving all workflows via conditional entry points.
 * Per Decision 1: "The same graph serving different agent personas or workflows
 * by adjusting runtime configuration parameters."
 *
 * References:
 * - [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Decision 1]
 * - [Source: CLAUDE.md#Agent System v2.0]
 * - [External: https://langchain-ai.github.io/langgraphjs/concepts/low_level/]
 */

import { StateGraph, START, END } from '@langchain/langgraph'

import { AgentState, type AgentStateType } from './state'
import { supervisorNode, cimPhaseRouterNode, retrievalNode } from './nodes'
import { getCheckpointer } from '@/lib/agent/checkpointer'

// =============================================================================
// Router Function (AC: #4)
// =============================================================================

/**
 * Router function from START - always goes to retrieval first.
 *
 * Story 3.1/3.3: All requests go through retrieval to populate
 * state.sources before supervisor handles them.
 *
 * @param _state - Current agent state (unused)
 * @returns 'retrieval' node name
 */
function routeFromStart(_state: AgentStateType): string {
  return 'retrieval'
}

/**
 * Router function - determines next node after retrieval based on workflowMode.
 *
 * Routes:
 * - 'cim' → 'cim/phaseRouter' node for CIM Builder workflow
 * - 'chat', 'irl' → 'supervisor' node (default)
 *
 * Note: Q&A is NOT a workflow mode - it's a cross-cutting tool available
 * in all workflows for tracking client questions (sell-side).
 *
 * @param state - Current agent state with workflowMode field
 * @returns Node name to route to
 */
function routeByWorkflowMode(state: AgentStateType): string {
  switch (state.workflowMode) {
    case 'cim':
      return 'cim/phaseRouter'
    default:
      // chat, irl all route to supervisor
      return 'supervisor'
  }
}

// =============================================================================
// StateGraph Definition (AC: #1, #3)
// =============================================================================

/**
 * Build the agent graph with conditional entry points.
 *
 * Graph Structure (Story 3.1, 3.3):
 * ```
 *                         ┌─── supervisor ───┐
 *                         │                  │
 * START ─── retrieval ────┤                  ├──── END
 *                         │                  │
 *                         └─ cim/phaseRouter ┘
 * ```
 *
 * Flow:
 * 1. START always routes to retrieval (populates state.sources)
 * 2. Retrieval routes to supervisor or cim/phaseRouter based on workflowMode
 * 3. Supervisor/CIM route to END (specialist routing added in Epic 4)
 *
 * Note: Using chained builder pattern for proper type inference of node names.
 *
 * Exported for Story 1.3 to compile with checkpointer.
 */
export const graphBuilder = new StateGraph(AgentState)
  // Add nodes - names MUST match routing targets
  .addNode('supervisor', supervisorNode)
  .addNode('cim/phaseRouter', cimPhaseRouterNode)
  // Story 3.1: Retrieval node - called before supervisor for context enrichment
  .addNode('retrieval', retrievalNode)
  // Conditional entry from START - routes based on workflowMode
  // Using array format for pathMap as this is the standard pattern in this codebase
  .addConditionalEdges(START, routeFromStart, [
    'retrieval', // All paths go through retrieval first
  ])
  // Retrieval routes to appropriate handler based on workflow mode
  .addConditionalEdges('retrieval', routeByWorkflowMode, [
    'supervisor',
    'cim/phaseRouter',
  ])
  // Placeholder edges to END (will be replaced in later stories)
  // Story 2.1: supervisor → retrieval/specialists
  // Story 6.1: cim/phaseRouter → CIM phase nodes
  .addEdge('supervisor', END)
  .addEdge('cim/phaseRouter', END)

// =============================================================================
// Compiled Graph Export (AC: #3)
// =============================================================================

/**
 * Compiled agent graph ready for execution.
 *
 * The graph is stateless - state is passed per invocation via invoke() or stream().
 * Checkpointer NOT added here - Story 1.3 will add PostgresSaver.
 *
 * @example
 * ```typescript
 * import { agentGraph, createInitialState } from '@/lib/agent/v2'
 *
 * const state = createInitialState('chat', dealId, userId)
 * const result = await agentGraph.invoke(state)
 * ```
 *
 * @example With streaming
 * ```typescript
 * for await (const event of agentGraph.stream(state)) {
 *   console.log(event)
 * }
 * ```
 */
export const agentGraph = graphBuilder.compile()

/**
 * Export the router functions for testing and extension.
 * Can be used to verify routing logic or extend with custom routing.
 */
export { routeFromStart, routeByWorkflowMode }

// =============================================================================
// Compiled Graph with Checkpointer (Story 1.3)
// =============================================================================

/**
 * Type of the compiled agent graph.
 * Inferred from graphBuilder.compile() to avoid version-specific generics.
 */
type CompiledAgentGraph = ReturnType<typeof graphBuilder.compile>

// Module-level singleton cache
let compiledGraph: CompiledAgentGraph | null = null
let compilationPromise: Promise<CompiledAgentGraph> | null = null

/**
 * Get or create the compiled agent graph with PostgresSaver checkpointer.
 * Uses singleton caching - graph is compiled once per process.
 * Thread-safe: concurrent calls wait for same compilation.
 *
 * Story: 1-3 Connect PostgresSaver Checkpointer (AC: #1)
 *
 * @returns Compiled StateGraph with checkpointer attached
 *
 * @example
 * ```typescript
 * const graph = await createCompiledAgentGraph()
 * const result = await graph.invoke(state, { configurable: { thread_id } })
 * ```
 */
export async function createCompiledAgentGraph(): Promise<CompiledAgentGraph> {
  // Return cached instance
  if (compiledGraph) {
    return compiledGraph
  }

  // If compilation in progress, wait for it (prevents concurrent compilation)
  if (compilationPromise) {
    return compilationPromise
  }

  // Start compilation
  compilationPromise = (async () => {
    const checkpointer = await getCheckpointer()
    const graph = graphBuilder.compile({ checkpointer })
    compiledGraph = graph
    return graph
  })()

  try {
    return await compilationPromise
  } finally {
    compilationPromise = null
  }
}

/**
 * Reset compiled graph (for testing only).
 * Call this in test beforeEach along with resetCheckpointer().
 *
 * Story: 1-3 Connect PostgresSaver Checkpointer
 */
export function resetCompiledGraph(): void {
  compiledGraph = null
  compilationPromise = null
}
