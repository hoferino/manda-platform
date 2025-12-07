/**
 * All Chat Tools Array
 *
 * Exports all 16 chat tools for the LangChain AgentExecutor.
 * Story: E5.2 - Implement LangChain Agent with 11 Chat Tools
 * Story: E6.3 - Implement AI-Assisted IRL Auto-Generation from Documents (+2 tools)
 * Story: E7.1 - Implement Finding Correction via Chat (+3 tools)
 *
 * Tool order matters for selection priority - more commonly used tools first.
 */

import type { StructuredToolInterface } from '@langchain/core/tools'

// Knowledge Tools
import {
  queryKnowledgeBaseTool,
  updateKnowledgeBaseTool,
  validateFindingTool,
  updateKnowledgeGraphTool,
} from './knowledge-tools'

// Correction Tools (E7.1)
import {
  correctFindingTool,
  getFindingSourceTool,
  getCorrectionHistoryTool,
} from './correction-tools'

// Intelligence Tools
import {
  detectContradictionsTool,
  findGapsTool,
} from './intelligence-tools'

// Document Tools
import {
  getDocumentInfoTool,
  triggerAnalysisTool,
} from './document-tools'

// Workflow Tools
import {
  suggestQuestionsTool,
  addToQATool,
  createIRLTool,
  generateIRLSuggestionsTool,
  addToIRLTool,
} from './workflow-tools'

/**
 * All 16 chat tools for the LangChain agent.
 *
 * Order:
 * 1. query_knowledge_base - Primary search tool (most used)
 * 2. correct_finding - Correct findings via chat (E7.1)
 * 3. get_finding_source - Get source before correction (E7.1)
 * 4. detect_contradictions - Due diligence checks
 * 5. find_gaps - Gap analysis
 * 6. get_document_info - Document lookup
 * 7. validate_finding - Before storing findings
 * 8. update_knowledge_base - Store new findings
 * 9. suggest_questions - Q&A generation
 * 10. add_to_qa - Store Q&A items
 * 11. trigger_analysis - Document processing
 * 12. update_knowledge_graph - Graph relationships
 * 13. create_irl - IRL management (stub)
 * 14. generate_irl_suggestions - AI-generated IRL suggestions (E6.3)
 * 15. add_to_irl - Add item to IRL (E6.3)
 * 16. get_correction_history - View correction audit trail (E7.1)
 */
export const allChatTools: StructuredToolInterface[] = [
  // Primary query tool - should be selected for most knowledge questions
  queryKnowledgeBaseTool,

  // Correction tools (E7.1) - for correcting findings via chat
  correctFindingTool,
  getFindingSourceTool,

  // Intelligence tools - for due diligence and analysis
  detectContradictionsTool,
  findGapsTool,

  // Document tools - for document-specific queries
  getDocumentInfoTool,

  // Validation before storage
  validateFindingTool,

  // Storage tools
  updateKnowledgeBaseTool,

  // Workflow tools - Q&A and suggestions
  suggestQuestionsTool,
  addToQATool,

  // Processing tools
  triggerAnalysisTool,

  // Graph tools
  updateKnowledgeGraphTool,

  // IRL tools
  createIRLTool,
  generateIRLSuggestionsTool,
  addToIRLTool,

  // Audit tools (E7.1)
  getCorrectionHistoryTool,
]

/**
 * Tool names for reference and logging
 */
export const TOOL_NAMES = allChatTools.map((tool) => tool.name)

/**
 * Tool count for validation
 */
export const TOOL_COUNT = allChatTools.length // Should be 13

/**
 * Get tool by name
 */
export function getToolByName(name: string): StructuredToolInterface | undefined {
  return allChatTools.find((tool) => tool.name === name)
}

/**
 * Tool categories for organization
 */
export const TOOL_CATEGORIES = {
  knowledge: ['query_knowledge_base', 'update_knowledge_base', 'validate_finding', 'update_knowledge_graph'],
  correction: ['correct_finding', 'get_finding_source', 'get_correction_history'],
  intelligence: ['detect_contradictions', 'find_gaps'],
  document: ['get_document_info', 'trigger_analysis'],
  workflow: ['suggest_questions', 'add_to_qa', 'create_irl', 'generate_irl_suggestions', 'add_to_irl'],
} as const

/**
 * Validate that all 16 tools are present
 */
export function validateToolCount(): boolean {
  if (TOOL_COUNT !== 16) {
    console.error(`Expected 16 tools, found ${TOOL_COUNT}`)
    return false
  }
  return true
}
