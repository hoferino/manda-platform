/**
 * Agent System v2.0 - Retry Utilities Tests
 *
 * Story: 1-6 Implement Basic Error Recovery (AC: #1)
 *
 * Tests for exponential backoff retry logic with jitter.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  withRetry,
  type RetryConfig,
  DEFAULT_RETRY_CONFIG,
} from '../retry'
import { isLLMError } from '../errors'

describe('retry utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('withRetry', () => {
    it('returns result on first success', async () => {
      const fn = vi.fn().mockResolvedValue('success')

      const result = await withRetry(fn)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('retries on recoverable error and succeeds', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValue('success')

      const resultPromise = withRetry(fn)

      // Fast-forward through the retry delay
      await vi.advanceTimersByTimeAsync(2000)

      const result = await resultPromise

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('throws after max retries', async () => {
      vi.useRealTimers() // Use real timers for this test

      const fn = vi
        .fn()
        .mockRejectedValue(new Error('Rate limit exceeded'))

      // Use very short delays for the test
      const config: RetryConfig = {
        maxRetries: 2,
        baseDelay: 1, // 1ms
        maxDelay: 10,
        jitter: 0,
      }

      await expect(withRetry(fn, config)).rejects.toThrow('Rate limit exceeded')
      expect(fn).toHaveBeenCalledTimes(3) // Initial + 2 retries

      vi.useFakeTimers() // Restore fake timers for other tests
    })

    it('does not retry non-recoverable errors', async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(new Error('Something completely unexpected'))

      await expect(withRetry(fn)).rejects.toThrow('Something completely unexpected')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('uses custom shouldRetry function', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Custom retryable'))
        .mockResolvedValue('success')

      const customConfig: RetryConfig = {
        shouldRetry: (err) => err instanceof Error && err.message.includes('Custom'),
        maxRetries: 2,
        baseDelay: 100,
      }

      const resultPromise = withRetry(fn, customConfig)

      await vi.advanceTimersByTimeAsync(200)

      const result = await resultPromise

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('applies exponential backoff', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValue('success')

      const config: RetryConfig = {
        maxRetries: 3,
        baseDelay: 100,
        maxDelay: 10000,
        jitter: 0, // Disable jitter for predictable delays
      }

      const resultPromise = withRetry(fn, config)

      // First call fails immediately
      expect(fn).toHaveBeenCalledTimes(1)

      // Wait for first retry (baseDelay = 100ms)
      await vi.advanceTimersByTimeAsync(100)
      expect(fn).toHaveBeenCalledTimes(2)

      // Wait for second retry (baseDelay * 2 = 200ms)
      await vi.advanceTimersByTimeAsync(200)
      expect(fn).toHaveBeenCalledTimes(3)

      await resultPromise
    })

    it('respects maxDelay cap', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValue('success')

      const config: RetryConfig = {
        maxRetries: 5,
        baseDelay: 1000,
        maxDelay: 2000, // Cap at 2 seconds
        jitter: 0,
      }

      const resultPromise = withRetry(fn, config)

      // Delays: 1000, 2000, 2000, 2000 (capped)
      await vi.advanceTimersByTimeAsync(1000)
      expect(fn).toHaveBeenCalledTimes(2)

      await vi.advanceTimersByTimeAsync(2000)
      expect(fn).toHaveBeenCalledTimes(3)

      await vi.advanceTimersByTimeAsync(2000)
      expect(fn).toHaveBeenCalledTimes(4)

      await vi.advanceTimersByTimeAsync(2000)
      expect(fn).toHaveBeenCalledTimes(5)

      await resultPromise
    })

    it('calls onRetry callback', async () => {
      const onRetry = vi.fn()
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValue('success')

      const resultPromise = withRetry(fn, { onRetry })

      await vi.advanceTimersByTimeAsync(2000)

      await resultPromise

      expect(onRetry).toHaveBeenCalledTimes(1)
      expect(onRetry).toHaveBeenCalledWith(
        expect.any(Error),
        1,
        expect.any(Number)
      )
    })

    it('does not retry auth errors (401)', async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(new Error('HTTP 401 Unauthorized'))

      await expect(withRetry(fn)).rejects.toThrow('HTTP 401 Unauthorized')
      expect(fn).toHaveBeenCalledTimes(1) // No retries for auth errors
    })

    it('does not retry auth errors (403)', async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(new Error('HTTP 403 Forbidden'))

      await expect(withRetry(fn)).rejects.toThrow('HTTP 403 Forbidden')
      expect(fn).toHaveBeenCalledTimes(1) // No retries for auth errors
    })

    it('does not retry invalid API key errors', async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(new Error('Invalid API key'))

      await expect(withRetry(fn)).rejects.toThrow('Invalid API key')
      expect(fn).toHaveBeenCalledTimes(1) // No retries for auth errors
    })
  })

  describe('DEFAULT_RETRY_CONFIG', () => {
    it('has sensible defaults', () => {
      expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3)
      expect(DEFAULT_RETRY_CONFIG.baseDelay).toBe(1000)
      expect(DEFAULT_RETRY_CONFIG.maxDelay).toBe(30000)
      expect(DEFAULT_RETRY_CONFIG.jitter).toBe(0.2)
    })

    it('retries transient LLM errors but not auth errors', () => {
      // Rate limit error - should retry
      expect(DEFAULT_RETRY_CONFIG.shouldRetry(new Error('Rate limit exceeded'))).toBe(true)

      // Timeout error - should retry
      expect(DEFAULT_RETRY_CONFIG.shouldRetry(new Error('Request timeout'))).toBe(true)

      // Auth errors - should NOT retry
      expect(DEFAULT_RETRY_CONFIG.shouldRetry(new Error('HTTP 401 Unauthorized'))).toBe(false)
      expect(DEFAULT_RETRY_CONFIG.shouldRetry(new Error('HTTP 403 Forbidden'))).toBe(false)
      expect(DEFAULT_RETRY_CONFIG.shouldRetry(new Error('Invalid API key'))).toBe(false)

      // Unknown error - should not retry
      expect(DEFAULT_RETRY_CONFIG.shouldRetry(new Error('Unknown error'))).toBe(false)
    })
  })
})
