/**
 * All Chat Tools Array
 *
 * Exports all 18 chat tools for the LangChain AgentExecutor.
 * Story: E5.2 - Implement LangChain Agent with 11 Chat Tools
 * Story: E6.3 - Implement AI-Assisted IRL Auto-Generation from Documents (+2 tools)
 * Story: E7.1 - Implement Finding Correction via Chat (+3 tools)
 * Story: E8.3 - Agent Tool - add_qa_item() (+1 tool)
 * Story: E11.3 - Agent-Autonomous Knowledge Write-Back (+1 tool)
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
  indexToKnowledgeBaseTool,
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

// Q&A Tools (E8.3)
import { addQAItemTool } from './qa-tools'

/**
 * All 18 chat tools for the LangChain agent.
 *
 * Order:
 * 1. query_knowledge_base - Primary search tool (most used)
 * 2. index_to_knowledge_base - Autonomous fact persistence (E11.3)
 * 3. correct_finding - Correct findings via chat (E7.1)
 * 4. get_finding_source - Get source before correction (E7.1)
 * 5. detect_contradictions - Due diligence checks
 * 6. find_gaps - Gap analysis
 * 7. get_document_info - Document lookup
 * 8. validate_finding - Before storing findings
 * 9. update_knowledge_base - Store new findings
 * 10. suggest_questions - Q&A generation
 * 11. add_to_qa - Store Q&A items (legacy)
 * 12. add_qa_item - Add Q&A item for client to answer (E8.3)
 * 13. trigger_analysis - Document processing
 * 14. update_knowledge_graph - Graph relationships
 * 15. create_irl - IRL management (stub)
 * 16. generate_irl_suggestions - AI-generated IRL suggestions (E6.3)
 * 17. add_to_irl - Add item to IRL (E6.3)
 * 18. get_correction_history - View correction audit trail (E7.1)
 */
export const allChatTools: StructuredToolInterface[] = [
  // Primary query tool - should be selected for most knowledge questions
  queryKnowledgeBaseTool,

  // Knowledge persistence (E11.3) - autonomous fact capture
  indexToKnowledgeBaseTool,

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

  // Q&A tools (E8.3) - Add questions for client to answer
  addQAItemTool,

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
export const TOOL_COUNT = allChatTools.length // Should be 18

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
  knowledge: ['query_knowledge_base', 'index_to_knowledge_base', 'update_knowledge_base', 'validate_finding', 'update_knowledge_graph'],
  correction: ['correct_finding', 'get_finding_source', 'get_correction_history'],
  intelligence: ['detect_contradictions', 'find_gaps'],
  document: ['get_document_info', 'trigger_analysis'],
  workflow: ['suggest_questions', 'add_to_qa', 'create_irl', 'generate_irl_suggestions', 'add_to_irl'],
  qa: ['add_qa_item'],
} as const

/**
 * Validate that all 18 tools are present
 */
export function validateToolCount(): boolean {
  if (TOOL_COUNT !== 18) {
    console.error(`Expected 18 tools, found ${TOOL_COUNT}`)
    return false
  }
  return true
}
