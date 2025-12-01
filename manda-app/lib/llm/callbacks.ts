/**
 * LLM Callback Handlers
 *
 * Token counting, cost tracking, and logging callbacks for LLM operations.
 * Story: E5.1 - Integrate LLM via LangChain (Model-Agnostic)
 *
 * Features:
 * - Token usage tracking per request
 * - Cost estimation based on provider pricing
 * - Request/response timing
 * - Structured logging for observability
 */

import { BaseCallbackHandler } from '@langchain/core/callbacks/base'
import type { Serialized } from '@langchain/core/load/serializable'
import type { LLMResult } from '@langchain/core/outputs'

import { type LLMProvider, TOKEN_COSTS } from './config'

/**
 * Token usage statistics for a single request
 */
export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCostUSD: number
}

/**
 * Request metadata for logging
 */
export interface RequestMetadata {
  requestId: string
  provider: LLMProvider
  model: string
  startTime: number
  endTime?: number
  durationMs?: number
  tokenUsage?: TokenUsage
  error?: string
}

/**
 * Generates a unique request ID
 */
function generateRequestId(): string {
  return `llm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Calculates estimated cost based on token usage and provider pricing
 */
export function calculateCost(
  provider: LLMProvider,
  inputTokens: number,
  outputTokens: number
): number {
  const costs = TOKEN_COSTS[provider]
  // Costs are per 1M tokens
  const inputCost = (inputTokens / 1_000_000) * costs.input
  const outputCost = (outputTokens / 1_000_000) * costs.output
  return parseFloat((inputCost + outputCost).toFixed(6))
}

/**
 * Token Counting Callback Handler
 *
 * Tracks token usage across LLM requests and provides cost estimation.
 */
export class TokenCountingHandler extends BaseCallbackHandler {
  name = 'TokenCountingHandler'

  private provider: LLMProvider
  private model: string
  private currentRequest: RequestMetadata | null = null
  private totalUsage: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCostUSD: 0,
  }

  constructor(provider: LLMProvider, model: string) {
    super()
    this.provider = provider
    this.model = model
  }

  override async handleLLMStart(
    llm: Serialized,
    prompts: string[],
    runId: string
  ): Promise<void> {
    this.currentRequest = {
      requestId: generateRequestId(),
      provider: this.provider,
      model: this.model,
      startTime: Date.now(),
    }

    if (process.env.NODE_ENV === 'development' || process.env.ENABLE_LLM_LOGGING === 'true') {
      console.log(JSON.stringify({
        event: 'llm_request_start',
        requestId: this.currentRequest.requestId,
        provider: this.provider,
        model: this.model,
        runId,
        promptCount: prompts.length,
        timestamp: new Date().toISOString(),
      }))
    }
  }

  override async handleLLMEnd(output: LLMResult, runId: string): Promise<void> {
    if (!this.currentRequest) return

    this.currentRequest.endTime = Date.now()
    this.currentRequest.durationMs =
      this.currentRequest.endTime - this.currentRequest.startTime

    // Extract token usage from LLM response
    // Different providers return usage in different formats
    const usage = output.llmOutput?.tokenUsage || output.llmOutput?.usage || {}
    const inputTokens =
      usage.promptTokens || usage.prompt_tokens || usage.input_tokens || 0
    const outputTokens =
      usage.completionTokens ||
      usage.completion_tokens ||
      usage.output_tokens ||
      0
    const totalTokens = inputTokens + outputTokens

    const estimatedCostUSD = calculateCost(
      this.provider,
      inputTokens,
      outputTokens
    )

    this.currentRequest.tokenUsage = {
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCostUSD,
    }

    // Accumulate totals
    this.totalUsage.inputTokens += inputTokens
    this.totalUsage.outputTokens += outputTokens
    this.totalUsage.totalTokens += totalTokens
    this.totalUsage.estimatedCostUSD += estimatedCostUSD

    // Log completion
    if (process.env.NODE_ENV === 'development' || process.env.ENABLE_LLM_LOGGING === 'true') {
      console.log(JSON.stringify({
        event: 'llm_request_complete',
        requestId: this.currentRequest.requestId,
        provider: this.provider,
        model: this.model,
        runId,
        durationMs: this.currentRequest.durationMs,
        tokenUsage: this.currentRequest.tokenUsage,
        timestamp: new Date().toISOString(),
      }))
    }
  }

  override async handleLLMError(
    err: Error,
    runId: string
  ): Promise<void> {
    if (!this.currentRequest) return

    this.currentRequest.endTime = Date.now()
    this.currentRequest.durationMs =
      this.currentRequest.endTime - this.currentRequest.startTime
    this.currentRequest.error = err.message

    console.error(JSON.stringify({
      event: 'llm_request_error',
      requestId: this.currentRequest.requestId,
      provider: this.provider,
      model: this.model,
      runId,
      durationMs: this.currentRequest.durationMs,
      error: err.message,
      timestamp: new Date().toISOString(),
    }))
  }

  /**
   * Gets the current accumulated token usage
   */
  getTotalUsage(): TokenUsage {
    return { ...this.totalUsage }
  }

  /**
   * Gets the last request metadata
   */
  getLastRequest(): RequestMetadata | null {
    return this.currentRequest ? { ...this.currentRequest } : null
  }

  /**
   * Resets all accumulated usage data
   */
  reset(): void {
    this.totalUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCostUSD: 0,
    }
    this.currentRequest = null
  }
}

/**
 * Creates a token counting callback handler
 */
export function createTokenCountingHandler(
  provider: LLMProvider,
  model: string
): TokenCountingHandler {
  return new TokenCountingHandler(provider, model)
}

/**
 * Logging Callback Handler
 *
 * Provides detailed structured logging for debugging and observability.
 */
export class LoggingHandler extends BaseCallbackHandler {
  name = 'LoggingHandler'

  private verbose: boolean

  constructor(verbose = false) {
    super()
    this.verbose = verbose
  }

  override async handleLLMStart(
    llm: Serialized,
    prompts: string[],
    runId: string
  ): Promise<void> {
    if (this.verbose) {
      console.log(JSON.stringify({
        event: 'llm_start',
        runId,
        llmType: llm.id?.[llm.id.length - 1] || 'unknown',
        promptLength: prompts.reduce((acc, p) => acc + p.length, 0),
        timestamp: new Date().toISOString(),
      }))
    }
  }

  override async handleLLMEnd(output: LLMResult, runId: string): Promise<void> {
    if (this.verbose) {
      console.log(JSON.stringify({
        event: 'llm_end',
        runId,
        generationCount: output.generations.length,
        timestamp: new Date().toISOString(),
      }))
    }
  }

  // Note: handleRetry is not part of BaseCallbackHandler, using custom method
  onRetry(
    err: Error,
    runId: string
  ): void {
    console.warn(JSON.stringify({
      event: 'llm_retry',
      runId,
      error: err.message,
      timestamp: new Date().toISOString(),
    }))
  }
}

/**
 * Creates a logging callback handler
 */
export function createLoggingHandler(verbose = false): LoggingHandler {
  return new LoggingHandler(verbose)
}

/**
 * Creates the standard set of callback handlers for production use
 */
export function createStandardCallbacks(
  provider: LLMProvider,
  model: string,
  options?: { verbose?: boolean }
): BaseCallbackHandler[] {
  const handlers: BaseCallbackHandler[] = [
    createTokenCountingHandler(provider, model),
  ]

  if (options?.verbose || process.env.NODE_ENV === 'development') {
    handlers.push(createLoggingHandler(true))
  }

  return handlers
}
