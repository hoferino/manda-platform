/**
 * Agent Tools Barrel Export
 *
 * Exports all 11 chat tools for the LangChain agent.
 * Story: E5.2 - Implement LangChain Agent with 11 Chat Tools
 *
 * Tool Categories:
 * - Knowledge Tools: query_knowledge_base, update_knowledge_base, validate_finding, update_knowledge_graph
 * - Intelligence Tools: detect_contradictions, find_gaps
 * - Document Tools: get_document_info, trigger_analysis
 * - Workflow Tools: suggest_questions, add_to_qa, create_irl
 */

// Knowledge Tools
export {
  queryKnowledgeBaseTool,
  updateKnowledgeBaseTool,
  validateFindingTool,
  updateKnowledgeGraphTool,
} from './knowledge-tools'

// Intelligence Tools
export {
  detectContradictionsTool,
  findGapsTool,
} from './intelligence-tools'

// Document Tools
export {
  getDocumentInfoTool,
  triggerAnalysisTool,
} from './document-tools'

// Workflow Tools
export {
  suggestQuestionsTool,
  addToQATool,
  createIRLTool,
} from './workflow-tools'

// Re-export utilities
export * from './utils'

/**
 * All chat tools array for AgentExecutor
 * Order matters for tool selection priority
 */
export { allChatTools } from './all-tools'
