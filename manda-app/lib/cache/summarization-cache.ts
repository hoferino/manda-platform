/**
 * Summarization Cache (Redis-Backed)
 *
 * Caches conversation summaries for context compression.
 * Story: E13.8 - Redis Caching Layer (AC: #4)
 * Story: E11.2 - Conversation Summarization
 *
 * Features:
 * - 50 entries max, 30 minute TTL (per architecture)
 * - Atomic hit/miss counters with Redis INCR
 * - Async API (breaking change from E11.2 sync API)
 * - Graceful fallback to in-memory
 * - Compatible with existing CachedSummary interface
 */

import { RedisCache, type CacheStats } from './redis-cache'
import { CACHE_NAMESPACES } from './redis-client'

// ============================================================================
// Types (from summarization.ts)
// ============================================================================

/**
 * Cached summary entry
 */
export interface CachedSummary {
  /** The generated summary text */
  summaryText: string
  /** Content hashes of summarized messages */
  messageHashes: string[]
  /** Hash of the last message (for cache invalidation) */
  lastMessageHash: string
  /** Number of messages that were summarized */
  messageCount: number
  /** Token count of the summary */
  tokenCount: number
  /** Timestamp when cached */
  timestamp: number
  /** Preserved M&A entities */
  entities?: string[]
}

// ============================================================================
// Configuration
// ============================================================================

/** TTL in seconds (30 minutes) */
const SUMMARY_CACHE_TTL = 30 * 60

/** Max entries */
const SUMMARY_CACHE_MAX_ENTRIES = 50

// ============================================================================
// Cache Instance
// ============================================================================

/**
 * Redis-backed summarization cache instance
 *
 * Story: E13.8 (AC: #4)
 * - Prefix: cache:summary:
 * - TTL: 30 minutes
 * - Max: 50 entries
 */
const cache = new RedisCache<CachedSummary>(
  CACHE_NAMESPACES.summary,
  SUMMARY_CACHE_TTL,
  SUMMARY_CACHE_MAX_ENTRIES
)

// ============================================================================
// SummarizationCache Class (API-Compatible with E11.2)
// ============================================================================

/**
 * Summarization Cache with Redis backend
 *
 * Maintains API compatibility with existing SummarizationCache from E11.2
 * but uses async methods internally.
 *
 * Story: E13.8 (AC: #4, #10 - async API migration)
 */
class SummarizationCacheWrapper {
  private readonly ttlMs: number
  private readonly maxSize: number

  constructor(ttlMs = SUMMARY_CACHE_TTL * 1000, maxSize = SUMMARY_CACHE_MAX_ENTRIES) {
    this.ttlMs = ttlMs
    this.maxSize = maxSize
  }

  /**
   * Get cached summary if valid (not expired)
   *
   * Story: E13.8 (AC: #4, #10 - async API)
   */
  async get(key: string): Promise<CachedSummary | null> {
    const result = await cache.get(key)
    return result.value
  }

  /**
   * Set cached summary
   *
   * Story: E13.8 (AC: #4, #10 - async API)
   */
  async set(key: string, value: CachedSummary): Promise<void> {
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
   * Delete a specific entry
   */
  async delete(key: string): Promise<boolean> {
    return cache.delete(key)
  }

  /**
   * Get cache stats for monitoring (AC: #7 from E11.2)
   */
  async getStats(): Promise<CacheStats & { ttlMs: number; maxSize: number; fallbackRate: number }> {
    const stats = await cache.getStats()
    const totalRequests = stats.hits + stats.misses
    return {
      ...stats,
      ttlMs: this.ttlMs,
      maxSize: this.maxSize,
      fallbackRate: totalRequests > 0 ? stats.fallbacks / totalRequests : 0,
    }
  }

  /**
   * Reset stats counters (useful for testing)
   */
  async resetStats(): Promise<void> {
    // Stats are reset when cache is cleared
    await cache.clear()
  }
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Global summarization cache instance
 */
export const summarizationCache = new SummarizationCacheWrapper()

/**
 * Get summarization cache statistics
 */
export async function getSummarizationCacheStats(): Promise<CacheStats> {
  return cache.getStats()
}

/**
 * Clear summarization cache
 */
export async function clearSummarizationCache(): Promise<void> {
  await cache.clear()
}
