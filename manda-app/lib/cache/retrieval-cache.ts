/**
 * Retrieval Cache (Redis-Backed)
 *
 * Caches Graphiti hybrid search results.
 * Story: E13.8 - Redis Caching Layer (AC: #3)
 * Story: E11.4 - Intent-Aware Knowledge Retrieval
 *
 * Features:
 * - 20 entries max, 5 minute TTL (per architecture)
 * - Topic-based key generation (matches E11.4)
 * - Async API (breaking change from E11.4 sync API)
 * - Graceful fallback to in-memory
 */

import { RedisCache, type CacheStats } from './redis-cache'
import { CACHE_NAMESPACES } from './redis-client'

// ============================================================================
// Types
// ============================================================================

/**
 * Cached retrieval result
 */
export interface CachedRetrievalResult {
  context: string
  entities: string[]
  timestamp: number
}

// ============================================================================
// Configuration
// ============================================================================

/** TTL in seconds (5 minutes) */
const RETRIEVAL_CACHE_TTL = 5 * 60

/** Max entries */
const RETRIEVAL_CACHE_MAX_ENTRIES = 20

// ============================================================================
// Cache Instance
// ============================================================================

/**
 * Redis-backed retrieval cache instance
 *
 * Story: E13.8 (AC: #3)
 * - Prefix: cache:retrieval:
 * - TTL: 5 minutes
 * - Max: 20 entries
 */
const cache = new RedisCache<CachedRetrievalResult>(
  CACHE_NAMESPACES.retrieval,
  RETRIEVAL_CACHE_TTL,
  RETRIEVAL_CACHE_MAX_ENTRIES
)

// ============================================================================
// RetrievalCache Class (API-Compatible with E11.4)
// ============================================================================

/**
 * Retrieval Cache with Redis backend
 *
 * Maintains API compatibility with existing RetrievalCache from E11.4
 * but uses async methods internally.
 *
 * Story: E13.8 (AC: #3, #10 - async API migration)
 */
class RetrievalCacheWrapper {
  private readonly ttlMs: number
  private readonly maxSize: number

  constructor(ttlMs = RETRIEVAL_CACHE_TTL * 1000, maxSize = RETRIEVAL_CACHE_MAX_ENTRIES) {
    this.ttlMs = ttlMs
    this.maxSize = maxSize
  }

  /**
   * Generate cache key from query and dealId
   *
   * Extracts significant words (length > 3) and sorts them
   * for topic-based matching (e.g., "Q3 revenue" matches "revenue Q3")
   *
   * Preserved from E11.4 RetrievalCache implementation
   */
  generateKey(query: string, dealId: string): string {
    const words = query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .sort()
      .join('_')
    return `${dealId}:${words}`
  }

  /**
   * Get cached result if valid (not expired)
   *
   * Story: E13.8 (AC: #3, #10 - async API)
   */
  async get(key: string): Promise<CachedRetrievalResult | null> {
    const result = await cache.get(key)
    return result.value
  }

  /**
   * Set cached result
   *
   * Story: E13.8 (AC: #3, #10 - async API)
   */
  async set(key: string, value: CachedRetrievalResult): Promise<void> {
    await cache.set(key, value)
  }

  /**
   * Check if key exists (async version)
   */
  async has(key: string): Promise<boolean> {
    const result = await cache.get(key)
    return result.value !== null
  }

  /**
   * Clear the cache
   */
  async clear(): Promise<void> {
    await cache.clear()
  }

  /**
   * Get cache stats for monitoring
   */
  async getStats(): Promise<CacheStats & { ttlMs: number; maxSize: number }> {
    const stats = await cache.getStats()
    return {
      ...stats,
      ttlMs: this.ttlMs,
      maxSize: this.maxSize,
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Global retrieval cache instance
 */
export const retrievalCache = new RetrievalCacheWrapper()

/**
 * Get retrieval cache statistics
 */
export async function getRetrievalCacheStats(): Promise<CacheStats> {
  return cache.getStats()
}

/**
 * Clear retrieval cache
 */
export async function clearRetrievalCache(): Promise<void> {
  await cache.clear()
}
