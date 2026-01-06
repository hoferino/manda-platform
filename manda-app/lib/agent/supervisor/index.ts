/**
 * Supervisor Agent Module
 *
 * Story: E13.4 - Supervisor Agent Pattern
 *
 * LangGraph-based supervisor for routing complex queries to specialist agents.
 * Only invoked for queries classified as 'complex' by E13.1 intent classification.
 *
 * Architecture:
 * - Supervisor graph classifies, routes, and synthesizes specialist responses
 * - Specialists: financial_analyst (E13.5), knowledge_graph (E13.6), general (fallback)
 * - Parallel execution for multi-domain queries
 * - Result synthesis with source deduplication
 *
 * Usage:
 * ```typescript
 * import { invokeSupervisor } from '@/lib/agent/supervisor'
 *
 * if (intent.complexity === 'complex') {
 *   const result = await invokeSupervisor({
 *     query: message,
 *     intent,
 *     dealId: projectId,
 *     userId: user.id,
 *   })
 * }
 * ```
 */

// State types and schemas
export {
  // Types
  type SupervisorState,
  type SpecialistResult,
  type SupervisorDecision,
  type SynthesizedResponse,
  type SourceReference,
  type SupervisorMetrics,
  // Schemas (Zod)
  SpecialistResultSchema,
  SupervisorDecisionSchema,
  SynthesizedResponseSchema,
  SourceReferenceSchema,
  // Annotation (LangGraph)
  SupervisorStateAnnotation,
  // Factory functions
  createInitialState,
  createSpecialistResult,
  createSupervisorDecision,
  // Validation helpers
  isValidSpecialistResult,
  isValidSynthesizedResponse,
} from './state'

// Routing logic
export {
  routeToSpecialists,
  createDecisionFromRouting,
  getRoutingRationale,
  shouldRouteToSpecialist,
  getSpecialistKeywords,
  SPECIALIST_ROUTING,
  SPECIALIST_IDS,
  type SpecialistId,
  type RoutingResult,
} from './routing'

// Synthesis logic
export {
  synthesizeResults,
  deduplicateSources,
  calculateAggregateConfidence,
  needsSynthesis,
  getSynthesisStats,
  type SynthesisConfig,
} from './synthesis'

// Specialist nodes
export {
  financialAnalystNode,
  knowledgeGraphNode,
  generalAgentNode,
  getSpecialistNode,
  SPECIALIST_NODES,
  type SpecialistNode,
} from './specialists'

// Graph and invocation
export {
  createSupervisorGraph,
  invokeSupervisor,
  getSupervisorGraphInfo,
  type SupervisorInvokeOptions,
  type SupervisorInvokeResult,
} from './graph'
