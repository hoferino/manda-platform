---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/agent/intent.ts
type: service
updated: 2026-01-20
status: active
---

# intent.ts

## Purpose

Classifies user messages to determine retrieval needs and query complexity. Implements a semantic similarity router using Voyage AI embeddings with regex fallback. Routes queries to appropriate processing tiers (simple/medium/complex) with corresponding tool availability and model selection. Critical for optimizing retrieval performance and model costs.

## Exports

- `IntentType` - Type union: 'greeting' | 'meta' | 'factual' | 'task'
- `ComplexityLevel` - Type union: 'simple' | 'medium' | 'complex'
- `IntentClassificationResult` - Interface with intent, confidence, and method
- `EnhancedIntentResult` - Extended result with complexity and suggested tools/model
- `INTENT_EXAMPLES` - Record of example phrases for each intent type
- `COMPLEXITY_SIGNALS` - Regex patterns for complexity detection
- `WORD_COUNT_FALLBACK` - Word count thresholds for complexity
- `TOOLS_BY_COMPLEXITY` - Tool availability per complexity tier
- `MODEL_BY_COMPLEXITY` - Recommended model per complexity tier
- `FALLBACK_PATTERNS` - Regex patterns for intent classification
- `SKIP_RETRIEVAL_PATTERNS` - Deprecated alias for FALLBACK_PATTERNS
- `classifyComplexity(message): ComplexityResult` - Pattern-based complexity classification
- `hasAllToolsAccess(complexity): boolean` - Check if complexity tier has all tools
- `getSuggestedTools(complexity): string[]` - Get tool list for complexity tier
- `getSuggestedModel(complexity): string` - Get model for complexity tier
- `classifyIntentAsync(message): Promise<EnhancedIntentResult>` - Full async classification with semantic routing
- `getIntentTraceMetadata(result): Record<string, unknown>` - Extract metadata for LangSmith traces
- `classifyIntent(message): IntentType` - Sync regex-only classification (deprecated)
- `classifyIntentWithComplexity(message): EnhancedIntentResult` - Sync classification with complexity
- `shouldRetrieve(intent, complexity?): boolean` - Determine if retrieval needed
- `getIntentDescription(intent): string` - Human-readable intent description
- `isSemanticRouterAvailable(): boolean` - Check if Voyage API key configured
- `getSemanticRouterStatus()` - Get router status for debugging

## Dependencies

- voyageai - VoyageAIClient for embedding generation

## Used By

TBD

## Notes

Semantic router uses voyage-3-lite model for fast, cheap intent classification. Embedding cache initializes lazily on first request. Compound queries (greeting + question) correctly route to factual intent.
