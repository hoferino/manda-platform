/**
 * Agent Tools Barrel Export
 *
 * Exports all 17 chat tools for the LangChain agent.
 * Story: E5.2 - Implement LangChain Agent with 11 Chat Tools
 * Story: E6.3 - Implement AI-Assisted IRL Auto-Generation (+2 tools)
 * Story: E7.1 - Implement Finding Correction via Chat (+3 tools)
 * Story: E8.3 - Agent Tool - add_qa_item() (+1 tool)
 *
 * Tool Categories:
 * - Knowledge Tools: query_knowledge_base, update_knowledge_base, validate_finding, update_knowledge_graph
 * - Correction Tools: correct_finding, get_finding_source, get_correction_history (E7.1)
 * - Intelligence Tools: detect_contradictions, find_gaps
 * - Document Tools: get_document_info, trigger_analysis
 * - Workflow Tools: suggest_questions, add_to_qa, create_irl, generate_irl_suggestions, add_to_irl
 * - Q&A Tools: add_qa_item (E8.3)
 */

// Knowledge Tools
export {
  queryKnowledgeBaseTool,
  updateKnowledgeBaseTool,
  validateFindingTool,
  updateKnowledgeGraphTool,
} from './knowledge-tools'

// Correction Tools (E7.1)
export {
  correctFindingTool,
  getFindingSourceTool,
  getCorrectionHistoryTool,
  correctionTools,
} from './correction-tools'

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

// Q&A Tools (E8.3)
export { addQAItemTool, qaTools } from './qa-tools'

// Re-export utilities
export * from './utils'

/**
 * All chat tools array for AgentExecutor
 * Order matters for tool selection priority
 */
export { allChatTools } from './all-tools'
