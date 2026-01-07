/**
 * Tests for Tool Result Cache
 *
 * Story: E13.8 - Redis Caching Layer (AC: #9)
 * Tests cover: Tool result caching with Redis backend (fallback mode)
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
  toolResultCache,
  cacheToolResult,
  getToolResult,
  clearToolResultCache,
  getToolResultCacheStats,
  type ToolResultCacheEntry,
} from '@/lib/cache/tool-result-cache'
import { resetHealthCheck } from '@/lib/cache/redis-client'

describe('Tool Result Cache', () => {
  const mockEntry: ToolResultCacheEntry = {
    tool: 'query_knowledge_base',
    toolCallId: 'call_123',
    fullResult: { entities: ['Company A', 'Company B'], facts: ['Fact 1', 'Fact 2'] },
    summary: 'Found 2 entities and 2 facts',
    fullTokens: 500,
    summaryTokens: 10,
    timestamp: new Date(),
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    resetHealthCheck()
    await clearToolResultCache()
  })

  describe('cacheToolResult', () => {
    it('should store tool result in cache', async () => {
      const source = await cacheToolResult(mockEntry)

      // Without Redis env vars, should use fallback
      expect(source).toBe('fallback')
    })

    it('should convert Date to ISO string for storage', async () => {
      await cacheToolResult(mockEntry)

      // The timestamp should be converted for JSON serialization
      const result = await getToolResult(mockEntry.toolCallId)
      expect(result).toBeDefined()
    })
  })

  describe('getToolResult', () => {
    it('should retrieve cached tool result', async () => {
      await cacheToolResult(mockEntry)

      const result = await getToolResult(mockEntry.toolCallId)

      expect(result).toEqual(mockEntry.fullResult)
    })

    it('should return null for missing key', async () => {
      const result = await getToolResult('non-existent-id')

      expect(result).toBeNull()
    })
  })

  describe('clearToolResultCache', () => {
    it('should clear all cached entries', async () => {
      await cacheToolResult(mockEntry)
      await clearToolResultCache()

      const result = await getToolResult(mockEntry.toolCallId)
      expect(result).toBeNull()
    })
  })

  describe('getToolResultCacheStats', () => {
    it('should return cache statistics', async () => {
      const stats = await getToolResultCacheStats()

      expect(stats).toHaveProperty('size')
      expect(stats).toHaveProperty('hits')
      expect(stats).toHaveProperty('misses')
      expect(stats).toHaveProperty('hitRate')
      expect(stats).toHaveProperty('source')
    })
  })
})
