/**
 * Tests for Retrieval Cache
 *
 * Story: E13.8 - Redis Caching Layer (AC: #9)
 * Tests cover: Retrieval caching with Redis backend (fallback mode)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @upstash/redis to simulate no Redis available
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    zadd: vi.fn(),
    zrange: vi.fn(),
    zcard: vi.fn(),
    zremrangebyrank: vi.fn(),
    incr: vi.fn(),
    ping: vi.fn().mockRejectedValue(new Error('No Redis')),
    pipeline: vi.fn(() => ({
      setex: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    })),
  })),
}))

// Import after mocking
import {
  retrievalCache,
  getRetrievalCacheStats,
  clearRetrievalCache,
  type CachedRetrievalResult,
} from '@/lib/cache/retrieval-cache'
import { resetHealthCheck } from '@/lib/cache/redis-client'

describe('Retrieval Cache', () => {
  const mockResult: CachedRetrievalResult = {
    context: 'Company A has revenue of $10M in Q3 2024',
    entities: ['Company A', 'Q3 2024'],
    timestamp: Date.now(),
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    resetHealthCheck()
    await clearRetrievalCache()
  })

  describe('generateKey', () => {
    it('should generate consistent key from query and dealId', () => {
      const key1 = retrievalCache.generateKey('Q3 revenue', 'deal-123')
      const key2 = retrievalCache.generateKey('revenue Q3', 'deal-123')

      // Keys should be the same (word order independent)
      expect(key1).toBe(key2)
    })

    it('should include dealId in key', () => {
      const key = retrievalCache.generateKey('revenue', 'deal-123')

      expect(key).toContain('deal-123')
    })

    it('should filter short words (3 chars or less)', () => {
      const key = retrievalCache.generateKey('is the revenue', 'deal-123')

      // "is", "the" should be filtered (<=3 chars)
      // Note: "what" has 4 chars so it wouldn't be filtered
      expect(key).not.toContain('_is_')
      expect(key).not.toContain('_the_')
      expect(key).toContain('revenue')
    })
  })

  describe('get/set', () => {
    it('should store and retrieve retrieval result', async () => {
      const key = retrievalCache.generateKey('test query for caching', 'deal-123')

      await retrievalCache.set(key, mockResult)
      const result = await retrievalCache.get(key)

      expect(result).toEqual(mockResult)
    })

    it('should return null for missing key', async () => {
      const result = await retrievalCache.get('non-existent-key')

      expect(result).toBeNull()
    })
  })

  describe('has', () => {
    it('should return true for existing key', async () => {
      const key = retrievalCache.generateKey('test query for cache check', 'deal-123')
      await retrievalCache.set(key, mockResult)

      const exists = await retrievalCache.has(key)

      expect(exists).toBe(true)
    })

    it('should return false for missing key', async () => {
      const exists = await retrievalCache.has('missing-key')

      expect(exists).toBe(false)
    })
  })

  describe('clear', () => {
    it('should clear all entries', async () => {
      const key = retrievalCache.generateKey('test query to clear', 'deal-123')
      await retrievalCache.set(key, mockResult)

      await clearRetrievalCache()

      const result = await retrievalCache.get(key)
      expect(result).toBeNull()
    })
  })

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      const stats = await getRetrievalCacheStats()

      expect(stats).toHaveProperty('size')
      expect(stats).toHaveProperty('hits')
      expect(stats).toHaveProperty('misses')
      expect(stats).toHaveProperty('hitRate')
    })
  })
})
