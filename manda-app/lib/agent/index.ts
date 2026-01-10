/**
 * Agent Module Barrel Export
 *
 * Exports all agent-related functionality for the M&A Due Diligence Assistant.
 *
 * Story 1.7: Removed legacy executor exports (createChatAgent, executeChat, etc.)
 * Use @/lib/agent/v2 for new agent functionality.
 *
 * Stories:
 * - E5.2 - Implement LangChain Agent with 11 Chat Tools
 * - E11.2 - Conversation Summarization
 * - E11.4 - Intent-Aware Knowledge Retrieval
 * - Story 1.7 - Remove Legacy Agent Code
 */

// Intent classification (E11.4)
// Note: intent.ts is retained despite v2 migration due to dependencies in:
// - retrieval.ts (classifyIntent, shouldRetrieve)
// - lib/llm/routing.ts (ComplexityLevel, MODEL_BY_COMPLEXITY)
// - lib/llm/client.ts (ComplexityLevel)
// - tools/tool-loader.ts (TOOLS_BY_COMPLEXITY, EnhancedIntentResult)
// TODO: Consider extracting shared types to a dedicated types file in future cleanup.
export {
  classifyIntent,
  classifyIntentAsync,
  shouldRetrieve,
  getIntentDescription,
  isSemanticRouterAvailable,
  getSemanticRouterStatus,
  INTENT_EXAMPLES,
  FALLBACK_PATTERNS,
  type IntentType,
  type IntentClassificationResult,
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
