---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/agent/summarization.ts
type: service
updated: 2026-01-20
status: active
---

# summarization.ts

## Purpose

Provides LLM-based conversation summarization with multi-level fallbacks for context management. Compresses long conversation histories to fit within token budgets while preserving critical M&A due diligence information. Uses Redis-backed caching for cross-instance performance and 3-second timeout protection for reliability.

## Exports

- `MESSAGES_TO_KEEP` - Constant: 10 messages kept verbatim
- `SUMMARIZATION_THRESHOLD_MESSAGES` - Constant: 20 messages triggers summarization
- `SUMMARIZATION_THRESHOLD_TOKENS` - Constant: 7000 tokens triggers summarization
- `SUMMARIZATION_TIMEOUT_MS` - Constant: 3000ms timeout
- `SUMMARY_TARGET_TOKENS` - Constant: 400 tokens target output
- `CACHE_TTL_MS` - Constant: 30 minutes cache TTL
- `MAX_CACHE_SIZE` - Constant: 50 entries max
- `SummarizationMetrics` - Interface for observability metrics
- `SummarizationConfig` - Interface for configuration options
- `SummarizationResult` - Interface for summarization output
- `CachedSummary` - Interface for cache entries
- `SUMMARIZATION_PROMPT` - M&A-optimized prompt prioritizing corrections, metrics, findings
- `hashMessage(msg): string` - Generate cache key hash for a message
- `getCacheKey(messages, dealId): string` - Generate full cache key
- `SummarizationCache` - Class wrapping Redis-backed cache operations
- `summarizationCache` - Global cache instance
- `estimateTokens(text): number` - Character-based token estimation
- `estimateMessageTokens(msg): number` - Estimate tokens for single message
- `estimateMessagesTokens(messages): number` - Estimate tokens for message array
- `createTokenCounter(llm?): (msgs) => Promise<number>` - Create counter for trimMessages API
- `trimMessagesWithLLM(messages, maxTokens, llm?): Promise<BaseMessage[]>` - Trim to token budget
- `shouldSummarize(messages, config?): boolean` - Check if summarization needed
- `extractTopicsFromMessages(messages): string` - Simple topic extraction fallback
- `summarizeConversationHistory(messages, llm, config?): Promise<SummarizationResult>` - Main entry point
- `summarizeWithTimeout(messages, llm, config?): Promise<SummarizationResult>` - Convenience wrapper

## Dependencies

- @langchain/core/messages - BaseMessage, SystemMessage, trimMessages
- @langchain/core/language_models/chat_models - BaseChatModel type
- [[manda-app-lib-cache-summarization-cache]] - Redis-backed cache implementation

## Used By

TBD

## Notes

M&A-optimized prompt prioritizes: analyst corrections, key metrics, critical findings, entities, then Q&A. Graceful degradation: LLM -> topic extraction -> truncation message. Cache invalidation uses lastMessageHash.
