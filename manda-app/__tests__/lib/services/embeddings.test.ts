/**
 * Embedding Service Tests
 * Story: E4.2 - Implement Semantic Search for Findings (AC: #2, #7)
 *
 * @deprecated E10.8 - PostgreSQL Cleanup
 * These tests are for the deprecated OpenAI embeddings service.
 * Graphiti now handles all embeddings via Voyage AI.
 * Keeping tests for backwards compatibility during transition.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock OpenAI before imports
const mockCreate = vi.fn()

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      embeddings = {
        create: mockCreate,
      }
    },
  }
})

// Import after mock
import {
  generateEmbedding,
  clearEmbeddingCache,
  getEmbeddingCacheSize,
  CONSTANTS,
} from '@/lib/services/embeddings'

describe('Embedding Service', () => {
  const mockEmbedding = Array(3072).fill(0.1)

  beforeEach(() => {
    vi.clearAllMocks()
    clearEmbeddingCache()
    // Set up environment
    process.env.OPENAI_API_KEY = 'test-api-key'

    // Reset mock implementation
    mockCreate.mockResolvedValue({
      data: [{ embedding: mockEmbedding }],
    })
  })

  afterEach(() => {
    clearEmbeddingCache()
  })

  describe('Constants', () => {
    it('uses text-embedding-3-large model', () => {
      expect(CONSTANTS.EMBEDDING_MODEL).toBe('text-embedding-3-large')
    })

    it('generates 3072 dimension embeddings', () => {
      expect(CONSTANTS.EMBEDDING_DIMENSIONS).toBe(3072)
    })

    it('has 3 max retries', () => {
      expect(CONSTANTS.MAX_RETRIES).toBe(3)
    })

    it('has 100 cache max size', () => {
      expect(CONSTANTS.CACHE_MAX_SIZE).toBe(100)
    })
  })

  describe('generateEmbedding', () => {
    it('generates embedding successfully', async () => {
      const result = await generateEmbedding('test query')

      expect(result).toBeDefined()
      expect(result).toHaveLength(3072)
      expect(typeof result[0]).toBe('number')
    })

    it('calls OpenAI with correct parameters', async () => {
      await generateEmbedding('test query')

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-large',
        input: 'test query',
        dimensions: 3072,
      })
    })

    it('caches embeddings by default', async () => {
      // First call
      await generateEmbedding('test query')
      expect(getEmbeddingCacheSize()).toBe(1)
      expect(mockCreate).toHaveBeenCalledTimes(1)

      // Second call with same query should use cache
      await generateEmbedding('test query')
      expect(getEmbeddingCacheSize()).toBe(1) // Still 1, not 2
      expect(mockCreate).toHaveBeenCalledTimes(1) // Not called again

      // Different query should add to cache
      await generateEmbedding('different query')
      expect(getEmbeddingCacheSize()).toBe(2)
      expect(mockCreate).toHaveBeenCalledTimes(2)
    })

    it('normalizes cache keys (lowercase, trim)', async () => {
      await generateEmbedding('Test Query')
      await generateEmbedding('test query')
      await generateEmbedding('  TEST QUERY  ')

      // All should resolve to the same cache key
      expect(getEmbeddingCacheSize()).toBe(1)
      expect(mockCreate).toHaveBeenCalledTimes(1)
    })

    it('can skip cache when useCache=false', async () => {
      await generateEmbedding('test query', false)
      expect(getEmbeddingCacheSize()).toBe(0)
    })

    it('throws error when API key is missing', async () => {
      delete process.env.OPENAI_API_KEY

      await expect(generateEmbedding('test')).rejects.toThrow(
        'OPENAI_API_KEY environment variable is not set'
      )
    })
  })

  describe('Cache Management', () => {
    it('clearEmbeddingCache removes all entries', async () => {
      await generateEmbedding('query1')
      await generateEmbedding('query2')
      expect(getEmbeddingCacheSize()).toBe(2)

      clearEmbeddingCache()
      expect(getEmbeddingCacheSize()).toBe(0)
    })

    it('getEmbeddingCacheSize returns correct count', async () => {
      expect(getEmbeddingCacheSize()).toBe(0)

      await generateEmbedding('query1')
      expect(getEmbeddingCacheSize()).toBe(1)

      await generateEmbedding('query2')
      expect(getEmbeddingCacheSize()).toBe(2)

      await generateEmbedding('query3')
      expect(getEmbeddingCacheSize()).toBe(3)
    })
  })

  describe('Error Handling', () => {
    it('throws error after max retries exceeded', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'))

      await expect(generateEmbedding('test')).rejects.toThrow(
        /Failed to generate embedding after \d+ attempts/
      )
    })

    it('throws error when no embedding returned', async () => {
      mockCreate.mockResolvedValue({ data: [] })

      await expect(generateEmbedding('test')).rejects.toThrow(
        /Failed to generate embedding/
      )
    })
  })
})
