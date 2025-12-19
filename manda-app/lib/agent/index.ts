/**
 * Agent Module Barrel Export
 *
 * Exports all agent-related functionality for the M&A Due Diligence Assistant.
 * Story: E5.2 - Implement LangChain Agent with 11 Chat Tools
 * Story: E11.2 - Conversation Summarization
 * Story: E11.4 - Intent-Aware Knowledge Retrieval
 */

// Agent executor and core functionality
export {
  createChatAgent,
  executeChat,
  streamChat,
  getAvailableTools,
  getAgentToolCache,
  ConversationContext,
  convertToLangChainMessages,
  type ChatAgentConfig,
  type ChatAgentWithCache,
  type ConversationMessage,
  type ChatExecutionOptions,
} from './executor'

// Intent classification (E11.4)
export {
  classifyIntent,
  shouldRetrieve,
  getIntentDescription,
  SKIP_RETRIEVAL_PATTERNS,
  type IntentType,
} from './intent'

// Pre-model retrieval (E11.4)
export {
  preModelRetrievalHook,
  RetrievalCache,
  retrievalCache,
  formatRetrievedContext,
  RETRIEVAL_MAX_TOKENS,
  CACHE_TTL_MS,
  MAX_CACHE_SIZE,
  LATENCY_TARGET_MS,
  type PreModelHookResult,
  type RetrievalMetrics,
} from './retrieval'

// Conversation summarization (E11.2)
export {
  summarizeConversationHistory,
  summarizeWithTimeout,
  SummarizationCache,
  summarizationCache,
  shouldSummarize,
  hashMessage,
  getCacheKey,
  extractTopicsFromMessages,
  estimateTokens,
  estimateMessageTokens,
  estimateMessagesTokens,
  createTokenCounter,
  trimMessagesWithLLM,
  SUMMARIZATION_TIMEOUT_MS,
  SUMMARIZATION_THRESHOLD_MESSAGES,
  SUMMARIZATION_THRESHOLD_TOKENS,
  MESSAGES_TO_KEEP,
  CACHE_TTL_MS as SUMMARIZATION_CACHE_TTL_MS,
  MAX_CACHE_SIZE as SUMMARIZATION_MAX_CACHE_SIZE,
  SUMMARY_TARGET_TOKENS,
  SUMMARIZATION_PROMPT,
  type SummarizationMetrics,
  type SummarizationConfig,
  type SummarizationResult,
  type CachedSummary,
} from './summarization'

// Tool isolation (E11.1)
export {
  createToolResultCache,
  isolateToolResult,
  getToolResult,
  cacheToolResult,
  clearExpiredEntries,
  getCacheStats,
  createIsolatedTool,
  isolateAllTools,
  summarizeForLLM,
  createMetricsTracker,
  IsolationMetricsTracker,
  DEFAULT_ISOLATION_CONFIG,
  type ToolResultCache,
  type ToolResultCacheEntry,
  type IsolationConfig,
  type IsolationMetrics,
  type TurnMetrics,
} from './tool-isolation'

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
