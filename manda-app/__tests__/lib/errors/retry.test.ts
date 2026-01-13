import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { withRetry } from '@/lib/errors/retry'
import { RateLimitError, UserFacingError } from '@/lib/errors/types'

vi.mock('@/lib/observability/usage', () => ({ logFeatureUsage: vi.fn(() => Promise.resolve()) }))

describe('withRetry', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success')
    const result = await withRetry(fn)
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on RateLimitError then succeeds', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new RateLimitError('test', 100)).mockResolvedValue('success')
    const resultPromise = withRetry(fn, { maxRetries: 2, initialDelayMs: 100 })
    await vi.runAllTimersAsync()
    expect(await resultPromise).toBe('success')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('throws UserFacingError after max retries exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new RateLimitError('test', 100))
    const resultPromise = withRetry(fn, { maxRetries: 2, initialDelayMs: 100 })

    // Set up rejection handler AND advance timers concurrently
    // This prevents unhandled rejection warnings
    const [result] = await Promise.allSettled([
      expect(resultPromise).rejects.toBeInstanceOf(UserFacingError),
      vi.runAllTimersAsync(),
    ])

    expect(result.status).toBe('fulfilled')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('does not retry non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('permanent'))
    const resultPromise = withRetry(fn, { maxRetries: 2, retryableErrors: [RateLimitError] })

    // Set up rejection handler AND advance timers concurrently
    const [result] = await Promise.allSettled([
      expect(resultPromise).rejects.toBeInstanceOf(UserFacingError),
      vi.runAllTimersAsync(),
    ])

    expect(result.status).toBe('fulfilled')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('uses exponential backoff with jitter', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new RateLimitError('test', 100))
      .mockRejectedValueOnce(new RateLimitError('test', 100))
      .mockResolvedValue('success')

    const resultPromise = withRetry(fn, {
      maxRetries: 3,
      initialDelayMs: 1000,
      backoffMultiplier: 2,
      jitterFactor: 0, // No jitter for predictable test
    })

    // First call fails immediately
    await vi.advanceTimersByTimeAsync(0)
    expect(fn).toHaveBeenCalledTimes(1)

    // Wait for first retry delay (1000ms)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fn).toHaveBeenCalledTimes(2)

    // Wait for second retry delay (2000ms - exponential backoff)
    await vi.advanceTimersByTimeAsync(2000)
    expect(fn).toHaveBeenCalledTimes(3)

    expect(await resultPromise).toBe('success')
  })

  it('respects rate limit retry-after header', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new RateLimitError('test', 5000)) // retry after 5s
      .mockResolvedValue('success')

    const resultPromise = withRetry(fn, {
      maxRetries: 2,
      initialDelayMs: 100, // Would normally wait 100ms
      jitterFactor: 0,
    })

    // Should wait at least 5000ms (from retryAfterMs), not 100ms
    await vi.advanceTimersByTimeAsync(100)
    expect(fn).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(4900) // Complete the 5000ms
    expect(fn).toHaveBeenCalledTimes(2)

    expect(await resultPromise).toBe('success')
  })
})
