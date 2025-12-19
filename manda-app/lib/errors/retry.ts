/**
 * Retry utility with exponential backoff and jitter.
 * Story: E12.6 - Error Handling & Graceful Degradation (AC: #2)
 *
 * NOTE: This complements LangChain's built-in FallbackLLM for model switching.
 * Use this for API calls; use LangChain with_fallbacks() for LLM model failover.
 */

import { RateLimitError, LLMServiceError, NetworkError, toUserFacingError } from './types'
import { logFeatureUsage } from '@/lib/observability/usage'

export interface RetryConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  /** Jitter factor (0.0-1.0). 0.2 = +/-20% randomization */
  jitterFactor: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  retryableErrors?: Array<new (...args: any[]) => Error>
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.2, // +/-20% to avoid thundering herd
  retryableErrors: [RateLimitError, LLMServiceError, NetworkError],
}

/** Add jitter to delay to prevent thundering herd */
function addJitter(delayMs: number, jitterFactor: number): number {
  const jitter = delayMs * jitterFactor * (Math.random() * 2 - 1) // +/-jitterFactor
  return Math.max(0, Math.round(delayMs + jitter))
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  context?: { feature?: string; dealId?: string; organizationId?: string; userId?: string }
): Promise<T> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config }
  let lastError: Error | undefined
  let delay = cfg.initialDelayMs

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      const isRetryable =
        cfg.retryableErrors?.some((ErrorClass) => lastError instanceof ErrorClass) ?? false

      if (!isRetryable || attempt === cfg.maxRetries) {
        if (context?.feature) {
          await logFeatureUsage({
            organizationId: context.organizationId,
            dealId: context.dealId,
            userId: context.userId,
            featureName: context.feature,
            status: 'error',
            errorMessage: `Retry exhausted after ${attempt + 1} attempts: ${lastError.message}`,
            metadata: { attempts: attempt + 1, errorType: lastError.constructor.name },
          }).catch(() => {})
        }
        throw toUserFacingError(lastError)
      }

      // Use rate limit's retry-after if available
      if (lastError instanceof RateLimitError && lastError.retryAfterMs) {
        delay = Math.max(delay, lastError.retryAfterMs)
      }

      const jitteredDelay = addJitter(delay, cfg.jitterFactor)
      console.log(`[withRetry] Attempt ${attempt + 1}/${cfg.maxRetries + 1} failed, retrying in ${jitteredDelay}ms`)

      await new Promise((resolve) => setTimeout(resolve, jitteredDelay))
      delay = Math.min(delay * cfg.backoffMultiplier, cfg.maxDelayMs)
    }
  }

  throw toUserFacingError(lastError ?? new Error('Retry failed'))
}
