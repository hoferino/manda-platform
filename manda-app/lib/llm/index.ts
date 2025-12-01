/**
 * LLM Module Index
 *
 * Exports all LLM-related functionality for the Manda platform.
 * Story: E5.1 - Integrate LLM via LangChain (Model-Agnostic)
 *
 * @module lib/llm
 */

// Configuration
export {
  type LLMConfig,
  type LLMProvider,
  LLMConfigSchema,
  DEFAULT_MODELS,
  TOKEN_COSTS,
  DEFAULT_CONFIG,
  getLLMConfig,
  getLLMProvider,
  getLLMModel,
  getAPIKey,
  isLangSmithEnabled,
  getLangSmithConfig,
  CONSTANTS,
} from './config'

// Client Factory
export {
  createLLMClient,
  createLLMClientForProvider,
  type LLMClient,
} from './client'

// Callbacks and Observability
export {
  type TokenUsage,
  type RequestMetadata,
  calculateCost,
  TokenCountingHandler,
  LoggingHandler,
  createTokenCountingHandler,
  createLoggingHandler,
  createStandardCallbacks,
} from './callbacks'

// Types and Schemas
export {
  // Schemas
  BaseResponseSchema,
  ErrorResponseSchema,
  FindingSchema,
  FindingsResponseSchema,
  SourceCitationSchema,
  ChatResponseSchema,
  QAPairSchema,
  QAListResponseSchema,
  ContradictionSchema,
  ContradictionsResponseSchema,
  GapSchema,
  GapsResponseSchema,
  Schemas,

  // Types
  type ErrorResponse,
  type Finding,
  type FindingsResponse,
  type SourceCitation,
  type ChatResponse,
  type QAPair,
  type QAListResponse,
  type Contradiction,
  type ContradictionsResponse,
  type Gap,
  type GapsResponse,

  // Utilities
  withStructuredOutput,
  validateResponse,
  safeParseResponse,
  describeSchema,
} from './types'
