---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/agent/index.ts
type: module
updated: 2026-01-20
status: active
---

# index.ts

## Purpose

Barrel export for the agent module, centralizing all agent-related functionality for the M&A Due Diligence Assistant. Exports intent classification, pre-model retrieval, conversation summarization, tool isolation, system prompts, streaming support, and all agent tools. Legacy executor exports were removed in Story 1.7.

## Exports

- Intent classification: `classifyIntent`, `classifyIntentAsync`, `shouldRetrieve`, `getIntentDescription`, `isSemanticRouterAvailable`, `getSemanticRouterStatus`, `INTENT_EXAMPLES`, `FALLBACK_PATTERNS`, `IntentType`, `IntentClassificationResult`
- Pre-model retrieval: `preModelRetrievalHook`, `RetrievalCache`, `retrievalCache`, `formatRetrievedContext`, `RETRIEVAL_MAX_TOKENS`, `CACHE_TTL_MS`, `MAX_CACHE_SIZE`, `LATENCY_TARGET_MS`, `PreModelHookResult`, `RetrievalMetrics`
- Summarization: `summarizeConversationHistory`, `summarizeWithTimeout`, `SummarizationCache`, `summarizationCache`, `shouldSummarize`, `hashMessage`, `getCacheKey`, `extractTopicsFromMessages`, `estimateTokens`, `estimateMessageTokens`, `estimateMessagesTokens`, `createTokenCounter`, `trimMessagesWithLLM`, plus constants and types
- Tool isolation: `createToolResultCache`, `isolateToolResult`, `getToolResult`, `cacheToolResult`, `clearExpiredEntries`, `getCacheStats`, `createIsolatedTool`, `isolateAllTools`, `summarizeForLLM`, `createMetricsTracker`, `IsolationMetricsTracker`, `DEFAULT_ISOLATION_CONFIG`, plus types
- System prompts: `AGENT_SYSTEM_PROMPT`, `TOOL_USAGE_PROMPT`, `getSystemPrompt`, `getSystemPromptWithContext`
- Streaming: `createSSEStream`, `getSSEHeaders`, `formatSSEEvent`, `AgentStreamHandler`, `parseSourceCitations`, `generateFollowupSuggestions`, plus SSE event types
- Tools: `allChatTools`, `TOOL_NAMES`, `TOOL_COUNT`, `TOOL_CATEGORIES`, `getToolByName`, `validateToolCount`, plus individual tools and utilities
- Schemas: All exports from ./schemas

## Dependencies

- [[manda-app-lib-agent-intent]] - Intent classification
- [[manda-app-lib-agent-retrieval]] - Pre-model retrieval hook
- [[manda-app-lib-agent-summarization]] - Conversation summarization
- [[manda-app-lib-agent-tool-isolation]] - Tool isolation
- [[manda-app-lib-agent-prompts]] - System prompts
- [[manda-app-lib-agent-streaming]] - SSE streaming support
- [[manda-app-lib-agent-tools-all-tools]] - All agent tools
- [[manda-app-lib-agent-tools-knowledge-tools]] - Knowledge tools
- [[manda-app-lib-agent-tools-intelligence-tools]] - Intelligence tools
- [[manda-app-lib-agent-tools-document-tools]] - Document tools
- [[manda-app-lib-agent-tools-workflow-tools]] - Workflow tools
- [[manda-app-lib-agent-tools-utils]] - Tool utilities
- [[manda-app-lib-agent-schemas]] - Agent schemas

## Used By

TBD

## Notes

For new agent functionality, use @/lib/agent/v2. This barrel file retains intent.ts exports due to dependencies in retrieval.ts, lib/llm/routing.ts, lib/llm/client.ts, and tools/tool-loader.ts.
