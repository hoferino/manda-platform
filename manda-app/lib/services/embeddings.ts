/**
 * Embedding Service
 *
 * @deprecated E10.8 - This service is deprecated. Use Graphiti hybrid search instead.
 *
 * Previously: Generated embeddings using OpenAI's text-embedding-3-large model.
 * Story: E4.2 - Implement Semantic Search for Findings (AC: #2, #7)
 *
 * NOW: All embeddings are handled by Graphiti + Voyage AI (1024d) server-side.
 * Use the hybrid search endpoint instead:
 *   POST /api/search/hybrid (manda-processing)
 *
 * This service remains for backwards compatibility during migration.
 * It will be removed in a future release.
 *
 * Old Features (no longer needed):
 * - OpenAI text-embedding-3-large (3072 dimensions) - REPLACED by Voyage 1024d
 * - LRU cache for recent query embeddings - REPLACED by Graphiti caching
 * - Retry logic for transient failures - HANDLED by manda-processing
 */

import OpenAI from 'openai'

// Constants
const EMBEDDING_MODEL = 'text-embedding-3-large'
const EMBEDDING_DIMENSIONS = 3072
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000
const CACHE_MAX_SIZE = 100

/**
 * Simple LRU Cache for embeddings
 */
class EmbeddingCache {
  private cache: Map<string, number[]> = new Map()
  private maxSize: number

  constructor(maxSize: number = CACHE_MAX_SIZE) {
    this.maxSize = maxSize
  }

  get(key: string): number[] | undefined {
    const value = this.cache.get(key)
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key)
      this.cache.set(key, value)
    }
    return value
  }

  set(key: string, value: number[]): void {
    // If key exists, delete it first to update order
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }
    this.cache.set(key, value)
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }
}

// Module-level cache instance
const embeddingCache = new EmbeddingCache()

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Creates an OpenAI client
 */
function createOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }
  return new OpenAI({ apiKey })
}

/**
 * Generate embedding for a text query
 *
 * @deprecated E10.8 - Use Graphiti hybrid search instead (POST /api/search/hybrid)
 * This function remains for backwards compatibility only.
 *
 * @param text - The text to embed
 * @param useCache - Whether to use the LRU cache (default: true)
 * @returns Array of 3072 floating point numbers
 */
export async function generateEmbedding(
  text: string,
  useCache: boolean = true
): Promise<number[]> {
  // Normalize text for cache key
  const normalizedText = text.trim().toLowerCase()

  // Check cache first
  if (useCache) {
    const cached = embeddingCache.get(normalizedText)
    if (cached) {
      return cached
    }
  }

  const openai = createOpenAIClient()
  let lastError: Error | null = null

  // Retry loop with exponential backoff
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text,
        dimensions: EMBEDDING_DIMENSIONS,
      })

      const embedding = response.data[0]?.embedding
      if (!embedding) {
        throw new Error('No embedding returned from OpenAI API')
      }

      // Cache the result
      if (useCache) {
        embeddingCache.set(normalizedText, embedding)
      }

      return embedding
    } catch (error) {
      lastError = error as Error

      // Check if it's a retryable error
      const isRetryable =
        error instanceof Error &&
        (error.message.includes('rate limit') ||
          error.message.includes('timeout') ||
          error.message.includes('503') ||
          error.message.includes('502') ||
          error.message.includes('network'))

      if (isRetryable && attempt < MAX_RETRIES - 1) {
        // Exponential backoff
        await sleep(RETRY_DELAY_MS * Math.pow(2, attempt))
        continue
      }

      // Non-retryable error or max retries exceeded
      break
    }
  }

  throw new Error(
    `Failed to generate embedding after ${MAX_RETRIES} attempts: ${lastError?.message || 'Unknown error'}`
  )
}

/**
 * Clear the embedding cache
 * Useful for testing
 */
export function clearEmbeddingCache(): void {
  embeddingCache.clear()
}

/**
 * Get the current cache size
 * Useful for monitoring
 */
export function getEmbeddingCacheSize(): number {
  return embeddingCache.size
}

/**
 * Export constants for testing
 */
export const CONSTANTS = {
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  MAX_RETRIES,
  RETRY_DELAY_MS,
  CACHE_MAX_SIZE,
}
