/**
 * Tests for Redis Cache Module
 *
 * Story: E13.8 - Redis Caching Layer (AC: #9)
 * Tests cover: RedisCache class with mock Redis client
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock ioredis to simulate no Redis available (graceful fallback testing)
vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    zadd: vi.fn(),
    zrange: vi.fn(),
    zcard: vi.fn(),
    zremrangebyrank: vi.fn(),
    zrem: vi.fn(),
    incr: vi.fn(),
    ping: vi.fn().mockResolvedValue('PONG'),
    quit: vi.fn().mockResolvedValue('OK'),
    on: vi.fn(),
    pipeline: vi.fn(() => ({
      setex: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      del: vi.fn().mockReturnThis(),
      zrem: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    })),
  })),
}))

// Import after mocking
import { RedisCache } from '@/lib/cache/redis-cache'
import { resetHealthCheck } from '@/lib/cache/redis-client'

describe('RedisCache - In-Memory Fallback (no Redis)', () => {
  let cache: RedisCache<{ value: string }>

  beforeEach(() => {
    // Reset health check to simulate no Redis
    resetHealthCheck()
    // Create cache without Redis (env vars not set)
    cache = new RedisCache<{ value: string }>('cache:fallback:', 300, 5)
  })

  it('should store and retrieve values from in-memory cache', async () => {
    // Without REDIS_URL set, should use fallback
    await cache.set('key1', { value: 'value1' })
    const result = await cache.get('key1')

    expect(result.source).toBe('fallback')
    expect(result.value).toEqual({ value: 'value1' })
    expect(result.hit).toBe(true)
  })

  it('should return null for missing key', async () => {
    const result = await cache.get('missing-key')

    expect(result.value).toBeNull()
    expect(result.hit).toBe(false)
    expect(result.source).toBe('fallback')
  })

  it('should include latency in result', async () => {
    await cache.set('test-key', { value: 'test' })
    const result = await cache.get('test-key')

    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    expect(typeof result.latencyMs).toBe('number')
  })

  it('should evict oldest entry when at capacity', async () => {
    // Fill cache to capacity (5 entries)
    for (let i = 0; i < 5; i++) {
      await cache.set(`key${i}`, { value: `value${i}` })
    }

    // Add one more - should evict oldest
    await cache.set('key5', { value: 'value5' })

    // First key should be evicted
    const oldResult = await cache.get('key0')
    expect(oldResult.hit).toBe(false)

    // New key should be present
    const newResult = await cache.get('key5')
    expect(newResult.hit).toBe(true)
  })

  it('should clear all entries', async () => {
    await cache.set('key1', { value: 'value1' })
    await cache.set('key2', { value: 'value2' })

    await cache.clear()

    const result1 = await cache.get('key1')
    const result2 = await cache.get('key2')
    expect(result1.hit).toBe(false)
    expect(result2.hit).toBe(false)
  })

  it('should delete specific entry', async () => {
    await cache.set('delete-me', { value: 'will be deleted' })
    await cache.set('keep-me', { value: 'will be kept' })

    const deleted = await cache.delete('delete-me')

    expect(deleted).toBe(true)
    const result = await cache.get('delete-me')
    expect(result.hit).toBe(false)

    const keptResult = await cache.get('keep-me')
    expect(keptResult.hit).toBe(true)
  })

  it('should return stats for fallback cache', async () => {
    await cache.set('key1', { value: 'value1' })
    await cache.get('key1') // hit
    await cache.get('missing') // miss

    const stats = await cache.getStats()

    expect(stats.source).toBe('fallback')
    expect(stats.size).toBeGreaterThanOrEqual(0)
    expect(typeof stats.hits).toBe('number')
    expect(typeof stats.misses).toBe('number')
    expect(typeof stats.hitRate).toBe('number')
  })
})

describe('RedisCache - TTL Behavior', () => {
  it('should expire entries after TTL', async () => {
    // Create cache with 1 second TTL
    const shortCache = new RedisCache<{ value: string }>('cache:short:', 1, 10)

    await shortCache.set('expiring-key', { value: 'expires-soon' })

    // Should be present immediately
    const immediateResult = await shortCache.get('expiring-key')
    expect(immediateResult.hit).toBe(true)

    // Wait for expiry (1.1 seconds)
    await new Promise(resolve => setTimeout(resolve, 1100))

    // Should be expired now
    const expiredResult = await shortCache.get('expiring-key')
    expect(expiredResult.hit).toBe(false)
  }, 3000) // Increase timeout for this test
})
