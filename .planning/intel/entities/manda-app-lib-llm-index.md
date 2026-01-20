---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/llm/index.ts
type: module
updated: 2026-01-20
status: active
---

# index.ts

## Purpose

Barrel export for all LLM-related functionality. Provides configuration management, client factories with fallback support, model routing based on query complexity, callback handlers for token counting and logging, and Zod schemas for structured outputs. Supports multiple providers (Anthropic, Google, OpenAI) with model-agnostic abstractions.

## Exports

- Configuration: `LLMConfig`, `LLMProvider`, `LLMConfigSchema`, `DEFAULT_MODELS`, `TOKEN_COSTS`, `TOKEN_COSTS_BY_MODEL`, `DEFAULT_CONFIG`, `getLLMConfig`, `getLLMProvider`, `getLLMModel`, `getAPIKey`, `getTokenCosts`, `calculateModelCost`, `isLangSmithEnabled`, `getLangSmithConfig`, `CONSTANTS`
- Client Factory: `createLLMClient`, `createLLMClientForProvider`, `createLLMClientWithFallback`, `LLMClient`, `CreateLLMClientOptions`
- Model Routing: `MODEL_ROUTING_CONFIG`, `selectModelForComplexity`, `getFallbackConfig`, `getEffectiveModelConfig`, `isGoogleAvailable`, `isAnthropicAvailable`, `getTierFromModel`, `formatModelSelection`
- Callbacks: `TokenUsage`, `RequestMetadata`, `calculateCost`, `TokenCountingHandler`, `LoggingHandler`, `createTokenCountingHandler`, `createLoggingHandler`, `createStandardCallbacks`
- Schemas: `BaseResponseSchema`, `ErrorResponseSchema`, `FindingSchema`, `FindingsResponseSchema`, `SourceCitationSchema`, `ChatResponseSchema`, `QAPairSchema`, `QAListResponseSchema`, `ContradictionSchema`, `ContradictionsResponseSchema`, `GapSchema`, `GapsResponseSchema`, `Schemas`
- Schema types: `ErrorResponse`, `Finding`, `FindingsResponse`, `SourceCitation`, `ChatResponse`, `QAPair`, `QAListResponse`, `Contradiction`, `ContradictionsResponse`, `Gap`, `GapsResponse`
- Utilities: `withStructuredOutput`, `validateResponse`, `safeParseResponse`, `describeSchema`

## Dependencies

- [[manda-app-lib-llm-config]] - LLM configuration
- [[manda-app-lib-llm-client]] - Client factories
- [[manda-app-lib-llm-routing]] - Model routing logic
- [[manda-app-lib-llm-callbacks]] - Callback handlers
- [[manda-app-lib-llm-types]] - Schemas and types

## Used By

TBD

## Notes

Model routing uses complexity tiers (simple/medium/complex) to select appropriate models and control costs. Fallback support enables graceful degradation when primary providers are unavailable.
