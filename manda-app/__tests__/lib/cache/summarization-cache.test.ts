/**
 * Tests for Summarization Cache
 *
 * Story: E13.8 - Redis Caching Layer (AC: #9)
 * Tests cover: Summarization caching with Redis backend (fallback mode)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock ioredis to simulate no Redis available (REDIS_URL not set)
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
    ping: vi.fn().mockRejectedValue(new Error('No Redis')),
    quit: vi.fn().mockResolvedValue('OK'),
    on: vi.fn(),
    pipeline: vi.fn(() => ({
      setex: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    })),
  })),
}))

// Import after mocking
import {
  summarizationCache,
  getSummarizationCacheStats,
  clearSummarizationCache,
  type CachedSummary,
} from '@/lib/cache/summarization-cache'
import { resetHealthCheck } from '@/lib/cache/redis-client'

describe('Summarization Cache', () => {
  const mockSummary: CachedSummary = {
    summaryText: 'Discussion about Q3 financials with $10M revenue',
    messageHashes: ['hash1', 'hash2', 'hash3'],
    lastMessageHash: 'hash3',
    messageCount: 15,
    tokenCount: 50,
    timestamp: Date.now(),
    entities: ['Company A', '$10M'],
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    resetHealthCheck()
    await clearSummarizationCache()
  })

  describe('get/set', () => {
    it('should store and retrieve summary', async () => {
      const key = 'deal123:15:hash3'

      await summarizationCache.set(key, mockSummary)
      const result = await summarizationCache.get(key)

      expect(result).toEqual(mockSummary)
    })

    it('should return null for missing key', async () => {
      const result = await summarizationCache.get('non-existent-key')

      expect(result).toBeNull()
    })
  })

  describe('has', () => {
    it('should return true for existing key', async () => {
      const key = 'deal123:15:hash3'
      await summarizationCache.set(key, mockSummary)

      const exists = await summarizationCache.has(key)

      expect(exists).toBe(true)
    })

    it('should return false for missing key', async () => {
      const exists = await summarizationCache.has('missing-key')

      expect(exists).toBe(false)
    })
  })

  describe('delete', () => {
    it('should remove specific entry', async () => {
      const key = 'deal123:15:hash3'
      await summarizationCache.set(key, mockSummary)

      const deleted = await summarizationCache.delete(key)

      expect(deleted).toBe(true)
      const result = await summarizationCache.get(key)
      expect(result).toBeNull()
    })
  })

  describe('clear', () => {
    it('should clear all entries', async () => {
      await summarizationCache.set('key1', mockSummary)
      await summarizationCache.set('key2', { ...mockSummary, summaryText: 'Different summary' })

      await clearSummarizationCache()

      const result1 = await summarizationCache.get('key1')
      const result2 = await summarizationCache.get('key2')
      expect(result1).toBeNull()
      expect(result2).toBeNull()
    })
  })

  describe('getStats', () => {
    it('should return cache statistics with all required properties', async () => {
      const stats = await summarizationCache.getStats()

      // Core stats properties from CacheStats
      expect(stats).toHaveProperty('size')
      expect(stats).toHaveProperty('hits')
      expect(stats).toHaveProperty('misses')
      expect(stats).toHaveProperty('hitRate')
      expect(stats).toHaveProperty('ttlMs')
      expect(stats).toHaveProperty('maxSize')
      // fallbackRate is computed from fallbacks
      expect(stats).toHaveProperty('fallbackRate')
      // fallbacks is from CacheStats (base property)
      expect(stats).toHaveProperty('fallbacks')
    })
  })

  describe('resetStats', () => {
    it('should reset stats counters', async () => {
      // This is a no-op that clears the cache in Redis implementation
      await expect(summarizationCache.resetStats()).resolves.not.toThrow()
    })
  })
})

describe('Summarization Cache Stats', () => {
  beforeEach(async () => {
    resetHealthCheck()
    await clearSummarizationCache()
  })

  it('should export getStats function', async () => {
    const stats = await getSummarizationCacheStats()

    expect(stats).toHaveProperty('size')
    expect(stats).toHaveProperty('hitRate')
  })
})
