/**
 * Chat Orchestrator Module
 *
 * Simplified LangGraph orchestration with three paths:
 * 1. Vanilla - Direct LLM response (greetings, general chat)
 * 2. Retrieval - Neo4j context injection + LLM (document questions)
 * 3. Analysis - Subagent routing (complex analysis)
 */

// Main orchestrator
export {
  invokeOrchestrator,
  streamOrchestrator,
  createOrchestratorGraph,
  orchestratorGraph,
  type OrchestratorInput,
  type OrchestratorResult,
  type OrchestratorCallbacks,
} from './graph'

// Router
export {
  routeMessage,
  isGreeting,
  isMetaQuestion,
  getRoutingMetadata,
  type RoutePath,
  type RouterResult,
} from './router'

// Individual paths (for direct access if needed)
export {
  executeVanillaPath,
  streamVanillaPath,
  type VanillaPathInput,
  type VanillaPathResult,
} from './paths/vanilla'

export {
  executeRetrievalPath,
  streamRetrievalPath,
  type RetrievalPathInput,
  type RetrievalPathResult,
} from './paths/retrieval'

export {
  executeAnalysisPath,
  streamAnalysisPath,
  previewSpecialists,
  type AnalysisPathInput,
  type AnalysisPathResult,
} from './paths/analysis'
