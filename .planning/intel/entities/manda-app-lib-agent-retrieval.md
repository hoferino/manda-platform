---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/agent/retrieval.ts
type: service
updated: 2026-01-20
status: active
---

# retrieval.ts

## Purpose

Implements the pre-model retrieval hook that proactively retrieves relevant knowledge before LLM generation. This is the primary defense against hallucinations. Uses intent classification to skip retrieval for greetings/meta queries, Redis-backed caching for topic matching, Graphiti hybrid search, and token budget enforcement for context injection.

## Exports

- `preModelRetrievalHook(messages, dealId): Promise<PreModelHookResult>` - Main hook for proactive retrieval
- `callGraphitiSearch(query, dealId, searchMethod?, numResults?): Promise<HybridSearchResponse | null>` - Direct Graphiti search call
- `safeGraphitiSearch(query, dealId, options?): Promise<GraphitiEntity[]>` - Graceful degradation wrapper
- `RetrievalCache` - Class wrapping Redis-backed cache operations
- `retrievalCache` - Global cache instance
- `formatRetrievedContext(results, maxTokens?): {context, tokenCount}` - Format results with token budget
- Types: `PreModelHookResult`, `HybridSearchResult`, `HybridSearchResponse`, `RetrievalMetrics`, `SearchMethod`
- Constants: `RETRIEVAL_MAX_TOKENS`, `CACHE_TTL_MS`, `MAX_CACHE_SIZE`, `LATENCY_TARGET_MS`

## Dependencies

- @langchain/core/messages - SystemMessage, BaseMessage
- [[manda-app-lib-agent-intent]] - classifyIntent, classifyIntentAsync, shouldRetrieve
- [[manda-app-lib-cache-retrieval-cache]] - Redis-backed retrieval cache
- [[manda-app-lib-observability-usage]] - logFeatureUsage

## Used By

TBD

## Notes

Pipeline: extract query -> classify intent -> check cache -> call Graphiti -> format context -> inject as SystemMessage. Token budget is 2000 tokens by default. Cache uses topic-based keys (sorted significant words) for matching "Q3 revenue" with "revenue Q3". Graceful degradation continues without context if Graphiti unavailable.
