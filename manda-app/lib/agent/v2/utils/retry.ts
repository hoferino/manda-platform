/**
 * Agent System v2.0 - Retry Utilities
 *
 * Story: 1-6 Implement Basic Error Recovery (AC: #1)
 *
 * Exponential backoff retry logic with jitter for transient failures.
 * Used by supervisor node and invoke helpers to retry recoverable errors.
 *
 * References:
 * - [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Error Handling Patterns]
 */

import { isLLMError, isAuthError } from './errors'

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Configuration for retry behavior.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number
  /** Base delay in ms for exponential backoff (default: 1000) */
  baseDelay?: number
  /** Maximum delay in ms (default: 30000) */
  maxDelay?: number
  /** Jitter factor 0-1 (default: 0.2 = 20% variance) */
  jitter?: number
  /** Function to determine if error is retryable (default: isRetryableLLMError) */
  shouldRetry?: (error: unknown) => boolean
  /** Callback on each retry attempt */
  onRetry?: (error: unknown, attempt: number, delay: number) => void
}

/**
 * Check if an error is a retryable LLM error.
 * Returns true for LLM errors that are NOT auth errors.
 * Auth errors (401, 403, invalid API key) should not be retried.
 */
function isRetryableLLMError(err: unknown): boolean {
  return isLLMError(err) && !isAuthError(err)
}

/**
 * Default retry configuration.
 * Uses isRetryableLLMError to determine if error is retryable.
 * Auth errors (401, 403) are NOT retried - only transient errors like rate limits.
 */
export const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  jitter: 0.2,
  shouldRetry: isRetryableLLMError,
  onRetry: () => {},
}

// =============================================================================
// Retry Implementation
// =============================================================================

/**
 * Execute a function with exponential backoff retry.
 *
 * Retries are only attempted for errors where shouldRetry returns true.
 * Uses exponential backoff with jitter to avoid thundering herd.
 *
 * @param fn - Async function to execute
 * @param config - Retry configuration (merged with defaults)
 * @returns Result of fn on success
 * @throws Last error if max retries exceeded
 *
 * @example
 * ```typescript
 * // Retry LLM calls with default config
 * const response = await withRetry(() => llm.invoke(messages))
 *
 * // Custom retry config
 * const response = await withRetry(() => llm.invoke(messages), {
 *   maxRetries: 5,
 *   baseDelay: 2000,
 *   onRetry: (err, attempt) => console.log(`Retry ${attempt}:`, err),
 * })
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: RetryConfig
): Promise<T> {
  const {
    maxRetries,
    baseDelay,
    maxDelay,
    jitter,
    shouldRetry,
    onRetry,
  } = { ...DEFAULT_RETRY_CONFIG, ...config }

  let lastError: unknown = null
  let attempt = 0

  while (attempt <= maxRetries) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Check if error is retryable
      if (!shouldRetry(error)) {
        throw error
      }

      // Check if we've exhausted retries
      if (attempt >= maxRetries) {
        throw error
      }

      // Calculate delay with exponential backoff
      const delay = calculateDelay(attempt, baseDelay, maxDelay, jitter)

      // Notify via callback
      onRetry(error, attempt + 1, delay)

      // Wait before retry
      await sleep(delay)

      attempt++
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate delay with exponential backoff and jitter.
 *
 * Formula: min(maxDelay, baseDelay * 2^attempt * (1 +/- jitter))
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param baseDelay - Base delay in ms
 * @param maxDelay - Maximum delay cap
 * @param jitter - Jitter factor (0-1)
 * @returns Delay in ms
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  jitter: number
): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt)

  // Apply jitter: multiply by random factor in range [1-jitter, 1+jitter]
  const jitterFactor = 1 + (Math.random() * 2 - 1) * jitter

  // Calculate final delay with jitter
  const delayWithJitter = exponentialDelay * jitterFactor

  // Cap at maxDelay
  return Math.min(delayWithJitter, maxDelay)
}

/**
 * Sleep for a specified duration.
 *
 * @param ms - Duration in milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
