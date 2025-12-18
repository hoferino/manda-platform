/**
 * Pre-Model Retrieval Hook Unit Tests
 *
 * Story: E11.4 - Intent-Aware Knowledge Retrieval (AC: #3, #5, #6, #7)
 * Tests for the pre-model retrieval hook and caching functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import {
  preModelRetrievalHook,
  RetrievalCache,
  retrievalCache,
  formatRetrievedContext,
  RETRIEVAL_MAX_TOKENS,
  CACHE_TTL_MS,
  MAX_CACHE_SIZE,
  LATENCY_TARGET_MS,
} from '@/lib/agent/retrieval'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// ============================================================================
// Test Helpers
// ============================================================================

function createMockSearchResponse(
  results: Array<{ content: string; score: number; citation?: { title: string; page?: number } }>,
  entities: string[] = []
) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        results,
        entities,
        latency_ms: 150,
      }),
  }
}

// ============================================================================
// RetrievalCache Tests (AC: #6)
// ============================================================================

describe('RetrievalCache', () => {
  let cache: RetrievalCache

  beforeEach(() => {
    cache = new RetrievalCache()
  })

  describe('generateKey', () => {
    it('should generate topic-based key from query and dealId', () => {
      const key = cache.generateKey('What is Q3 revenue?', 'deal-123')

      // Key should contain dealId and sorted significant words
      expect(key).toContain('deal-123')
      expect(key).toContain('revenue') // "revenue" is > 3 chars
      expect(key).toContain('what') // "what" is > 3 chars
    })

    it('should filter out short words (<=3 chars)', () => {
      const key = cache.generateKey('What is the Q3 revenue?', 'deal-123')

      // "is", "the", "Q3" should be filtered out (<=3 chars)
      expect(key).not.toContain(':is_')
      expect(key).not.toContain(':the_')
    })

    it('should produce same key for reordered words (topic matching)', () => {
      const key1 = cache.generateKey('Q3 revenue data', 'deal-123')
      const key2 = cache.generateKey('revenue data Q3', 'deal-123')

      // Same significant words, should produce same key
      expect(key1).toBe(key2)
    })

    it('should produce different keys for different deals', () => {
      const key1 = cache.generateKey('Q3 revenue', 'deal-123')
      const key2 = cache.generateKey('Q3 revenue', 'deal-456')

      expect(key1).not.toBe(key2)
    })
  })

  describe('get/set', () => {
    it('should store and retrieve cached result', () => {
      const entry = {
        context: 'Test context',
        entities: ['Entity1'],
        timestamp: Date.now(),
      }

      cache.set('test-key', entry)
      const retrieved = cache.get('test-key')

      expect(retrieved).toEqual(entry)
    })

    it('should return undefined for non-existent key', () => {
      expect(cache.get('nonexistent')).toBeUndefined()
    })

    it('should return undefined and delete expired entry', () => {
      const shortTTLCache = new RetrievalCache(100) // 100ms TTL

      const entry = {
        context: 'Test',
        entities: [],
        timestamp: Date.now() - 200, // 200ms ago - expired
      }

      shortTTLCache.set('expired-key', entry)
      expect(shortTTLCache.get('expired-key')).toBeUndefined()
    })
  })

  describe('LRU eviction', () => {
    it('should evict oldest entry when at max capacity', () => {
      const smallCache = new RetrievalCache(CACHE_TTL_MS, 2) // Max 2 entries

      smallCache.set('key1', { context: '1', entities: [], timestamp: Date.now() - 100 })
      smallCache.set('key2', { context: '2', entities: [], timestamp: Date.now() })
      smallCache.set('key3', { context: '3', entities: [], timestamp: Date.now() }) // Should evict key1

      expect(smallCache.has('key1')).toBe(false)
      expect(smallCache.has('key2')).toBe(true)
      expect(smallCache.has('key3')).toBe(true)
    })
  })

  describe('getStats', () => {
    it('should return cache statistics', () => {
      const stats = cache.getStats()

      expect(stats.size).toBe(0)
      expect(stats.maxSize).toBe(MAX_CACHE_SIZE)
      expect(stats.ttlMs).toBe(CACHE_TTL_MS)
    })
  })
})

// ============================================================================
// formatRetrievedContext Tests (AC: #5 - Token budget)
// ============================================================================

describe('formatRetrievedContext', () => {
  it('should format results with source citations', () => {
    const results = [
      {
        content: 'Q3 revenue was $5.2M',
        score: 0.95,
        citation: { type: 'document', title: 'Financial Report', page: 12 },
      },
    ]

    const { context } = formatRetrievedContext(results)

    expect(context).toContain('Q3 revenue was $5.2M')
    expect(context).toContain('Financial Report')
    expect(context).toContain('p12')
  })

  it('should handle missing citation', () => {
    const results = [{ content: 'Some fact', score: 0.8 }]

    const { context } = formatRetrievedContext(results)

    expect(context).toContain('Some fact')
    expect(context).toContain('Unknown')
  })

  it('should enforce token budget', () => {
    // Create results that would exceed budget
    const results = Array.from({ length: 20 }, (_, i) => ({
      content: 'A'.repeat(500), // ~125 tokens each
      score: 0.9,
      citation: { type: 'document', title: `Doc${i}` },
    }))

    const { context, tokenCount } = formatRetrievedContext(results, 500) // Small budget

    expect(tokenCount).toBeLessThanOrEqual(500)
    // Should have truncated - not all 20 results
    expect(context.split('\n').length).toBeLessThan(20)
  })

  it('should return empty string for empty results', () => {
    const { context, tokenCount } = formatRetrievedContext([])

    expect(context).toBe('')
    expect(tokenCount).toBe(0)
  })
})

// ============================================================================
// preModelRetrievalHook Tests (AC: #3, #4, #7)
// ============================================================================

describe('preModelRetrievalHook', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    retrievalCache.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Intent-based skipping (AC: #2)', () => {
    it('should skip retrieval for greetings', async () => {
      const messages = [new HumanMessage('Hello!')]
      const result = await preModelRetrievalHook(messages, 'deal-123')

      expect(result.skipped).toBe(true)
      expect(result.intent).toBe('greeting')
      expect(result.messages).toEqual(messages) // Unchanged
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should skip retrieval for meta questions', async () => {
      const messages = [new HumanMessage('What can you do?')]
      const result = await preModelRetrievalHook(messages, 'deal-123')

      expect(result.skipped).toBe(true)
      expect(result.intent).toBe('meta')
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('Factual/Task retrieval (AC: #3, #4)', () => {
    it('should retrieve and inject context for factual queries', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockSearchResponse([
          { content: 'Q3 revenue was $5.2M', score: 0.95, citation: { title: 'Report' } },
        ])
      )

      const messages = [new HumanMessage('What was Q3 revenue?')]
      const result = await preModelRetrievalHook(messages, 'deal-123')

      expect(result.skipped).toBe(false)
      expect(result.intent).toBe('factual')
      expect(result.messages.length).toBe(2) // Context + original
      expect(result.messages[0]).toBeInstanceOf(SystemMessage)
      const contextContent = result.messages[0]?.content as string
      expect(contextContent).toContain('Relevant knowledge')
      expect(contextContent).toContain('Q3 revenue')
    })

    it('should call Graphiti hybrid search with correct params', async () => {
      mockFetch.mockResolvedValueOnce(createMockSearchResponse([]))

      const messages = [new HumanMessage('Tell me about EBITDA')]
      await preModelRetrievalHook(messages, 'deal-123')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search/hybrid'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('deal-123'),
        })
      )
    })
  })

  describe('Caching (AC: #6)', () => {
    it('should use cache for repeated similar queries', async () => {
      // First call - cache miss
      mockFetch.mockResolvedValueOnce(
        createMockSearchResponse([{ content: 'Revenue data', score: 0.9 }], ['Revenue'])
      )

      await preModelRetrievalHook([new HumanMessage('Q3 revenue')], 'deal-123')
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Reset mock but don't clear cache
      mockFetch.mockReset()

      // Second call with similar query - should hit cache
      const result = await preModelRetrievalHook(
        [new HumanMessage('revenue Q3')], // Same words, different order
        'deal-123'
      )

      expect(result.cacheHit).toBe(true)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should not use cache for different deals', async () => {
      mockFetch.mockResolvedValue(createMockSearchResponse([{ content: 'Data', score: 0.9 }]))

      await preModelRetrievalHook([new HumanMessage('Revenue data')], 'deal-123')
      await preModelRetrievalHook([new HumanMessage('Revenue data')], 'deal-456')

      // Should have called fetch twice - different deals
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('Graceful degradation', () => {
    it('should return original messages if search fails', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

      const messages = [new HumanMessage('What is the revenue?')]
      const result = await preModelRetrievalHook(messages, 'deal-123')

      expect(result.skipped).toBe(false)
      expect(result.messages).toEqual(messages) // Unchanged
    })

    it('should return original messages if search throws', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const messages = [new HumanMessage('What is the revenue?')]
      const result = await preModelRetrievalHook(messages, 'deal-123')

      expect(result.messages).toEqual(messages) // Unchanged
    })

    it('should return original messages if no results', async () => {
      mockFetch.mockResolvedValueOnce(createMockSearchResponse([]))

      const messages = [new HumanMessage('What is the revenue?')]
      const result = await preModelRetrievalHook(messages, 'deal-123')

      expect(result.messages).toEqual(messages) // No context to inject
    })
  })

  describe('Latency tracking (AC: #7)', () => {
    it('should return retrieval latency', async () => {
      mockFetch.mockResolvedValueOnce(createMockSearchResponse([{ content: 'Data', score: 0.9 }]))

      const result = await preModelRetrievalHook([new HumanMessage('Revenue')], 'deal-123')

      expect(result.retrievalLatencyMs).toBeGreaterThanOrEqual(0)
      expect(typeof result.retrievalLatencyMs).toBe('number')
    })

    it('should return zero latency for skipped retrieval', async () => {
      const result = await preModelRetrievalHook([new HumanMessage('Hello')], 'deal-123')

      expect(result.retrievalLatencyMs).toBeLessThan(50) // Very fast - just classification
    })
  })

  describe('Edge cases', () => {
    it('should handle empty messages', async () => {
      const result = await preModelRetrievalHook([], 'deal-123')

      expect(result.skipped).toBe(true)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should handle non-string message content', async () => {
      const messages = [
        { content: { text: 'Complex content' } } as unknown as HumanMessage,
      ]

      const result = await preModelRetrievalHook(messages, 'deal-123')

      expect(result.skipped).toBe(true)
    })
  })
})

// ============================================================================
// Configuration Constants Tests
// ============================================================================

describe('Configuration Constants', () => {
  it('should have reasonable default values', () => {
    expect(RETRIEVAL_MAX_TOKENS).toBeGreaterThan(0)
    expect(RETRIEVAL_MAX_TOKENS).toBeLessThanOrEqual(4000) // Reasonable limit

    expect(CACHE_TTL_MS).toBeGreaterThan(0)
    expect(CACHE_TTL_MS).toBe(5 * 60 * 1000) // 5 minutes default

    expect(MAX_CACHE_SIZE).toBeGreaterThan(0)
    expect(MAX_CACHE_SIZE).toBe(20) // Default

    expect(LATENCY_TARGET_MS).toBe(500)
  })
})
