/**
 * Agent Module Barrel Export
 *
 * Exports all agent-related functionality for the M&A Due Diligence Assistant.
 * Story: E5.2 - Implement LangChain Agent with 11 Chat Tools
 */

// Agent executor and core functionality
export {
  createChatAgent,
  executeChat,
  streamChat,
  getAvailableTools,
  ConversationContext,
  convertToLangChainMessages,
  type ChatAgentConfig,
  type ConversationMessage,
} from './executor'

// System prompts
export {
  AGENT_SYSTEM_PROMPT,
  TOOL_USAGE_PROMPT,
  getSystemPrompt,
  getSystemPromptWithContext,
} from './prompts'

// Streaming support
export {
  createSSEStream,
  getSSEHeaders,
  formatSSEEvent,
  AgentStreamHandler,
  parseSourceCitations,
  generateFollowupSuggestions,
  type SSEEvent,
  type SSEEventType,
  type SSETokenEvent,
  type SSEToolStartEvent,
  type SSEToolEndEvent,
  type SSESourcesEvent,
  type SSEDoneEvent,
  type SSEErrorEvent,
} from './streaming'

// Tools
export {
  allChatTools,
  TOOL_NAMES,
  TOOL_COUNT,
  TOOL_CATEGORIES,
  getToolByName,
  validateToolCount,
} from './tools/all-tools'

// Individual tools (for direct use if needed)
export {
  queryKnowledgeBaseTool,
  updateKnowledgeBaseTool,
  validateFindingTool,
  updateKnowledgeGraphTool,
} from './tools/knowledge-tools'

export {
  detectContradictionsTool,
  findGapsTool,
} from './tools/intelligence-tools'

export {
  getDocumentInfoTool,
  triggerAnalysisTool,
} from './tools/document-tools'

export {
  suggestQuestionsTool,
  addToQATool,
  createIRLTool,
} from './tools/workflow-tools'

// Tool utilities
export {
  formatToolResponse,
  handleToolError,
  formatSourceCitation,
  formatSourceCitations,
  formatFindingsForResponse,
  translateConfidence,
  formatTemporalContext,
  groupFindingsByPeriod,
  inferQueryMode,
  type ToolContext,
} from './tools/utils'

// Schemas
export * from './schemas'
