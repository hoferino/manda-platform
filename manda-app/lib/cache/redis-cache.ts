/**
 * Generic Redis Cache Class
 *
 * Redis-backed cache with TTL, maxEntries (ZSET-based), and fallback support.
 * Story: E13.8 - Redis Caching Layer (AC: #1, #5, #6)
 * Action Item: Epic 2 Retro - Updated for ioredis compatibility
 *
 * Features:
 * - Generic type-safe caching
 * - TTL-based expiry
 * - ZSET-based maxEntries enforcement (LRU eviction)
 * - Automatic fallback to in-memory Map when Redis unavailable
 * - Atomic stats counters (hits, misses, fallbacks)
 * - Graceful degradation on any Redis error
 * - LangSmith-compatible logging for observability (AC: #6)
 */

import {
  getRedis,
  checkRedisHealth,
  isHealthChecked,
  type CacheSource,
} from './redis-client'

// ============================================================================
// Types
// ============================================================================

/**
 * Entry in the fallback in-memory cache
 */
interface FallbackEntry<T> {
  value: T
  expires: number
}

/**
 * Cache statistics
 */
export interface CacheStats {
  size: number
  hits: number
  misses: number
  fallbacks: number
  hitRate: number
  source: CacheSource
}

/**
 * Result from a cache get operation
 */
export interface CacheGetResult<T> {
  value: T | null
  source: CacheSource
  hit: boolean
  latencyMs: number
}

// ============================================================================
// RedisCache Class
// ============================================================================

/**
 * Generic Redis cache with automatic fallback
 *
 * Usage:
 * ```typescript
 * const cache = new RedisCache<MyType>('cache:myprefix:', 300, 50)
 * await cache.set('key1', myValue)
 * const result = await cache.get('key1')
 * ```
 */
export class RedisCache<T> {
  private readonly namespace: string
  private readonly indexKey: string
  private readonly ttlSeconds: number
  private readonly maxEntries: number

  // Fallback in-memory cache
  private readonly fallback = new Map<string, FallbackEntry<T>>()

  // Local stats counters (fallback when Redis unavailable)
  private localHits = 0
  private localMisses = 0
  private localFallbacks = 0

  // Stats keys in Redis
  private readonly statsKeys: { hits: string; misses: string; fallbacks: string }

  constructor(namespace: string, ttlSeconds: number, maxEntries: number) {
    this.namespace = namespace
    this.indexKey = `${namespace}index`
    this.ttlSeconds = ttlSeconds
    this.maxEntries = maxEntries

    this.statsKeys = {
      hits: `${namespace}stats:hits`,
      misses: `${namespace}stats:misses`,
      fallbacks: `${namespace}stats:fallbacks`,
    }
  }

  /**
   * Get a value from cache
   *
   * Story: E13.8 (AC: #5 - graceful degradation)
   */
  async get(key: string): Promise<CacheGetResult<T>> {
    const startTime = performance.now()
    const fullKey = `${this.namespace}${key}`

    // Ensure health check has run
    if (!isHealthChecked()) {
      await checkRedisHealth()
    }

    const redis = getRedis()

    // Try Redis first
    if (redis) {
      try {
        // ioredis returns string | null, need to parse JSON
        const rawValue = await redis.get(fullKey)
        const latencyMs = Math.round(performance.now() - startTime)

        if (rawValue !== null) {
          // Parse JSON to get typed value
          const value = JSON.parse(rawValue) as T

          // Cache hit - update index score (refresh access time for LRU)
          await this.recordHit()
          // ioredis zadd syntax: zadd(key, score, member)
          await redis.zadd(this.indexKey, Date.now(), fullKey).catch(() => {})

          // AC #6: Log for LangSmith observability
          console.log(
            `[cache] hit namespace=${this.namespace} key=${key} source=redis latency_ms=${latencyMs}`
          )
          return { value, source: 'redis', hit: true, latencyMs }
        }

        // Cache miss
        await this.recordMiss()
        // AC #6: Log for LangSmith observability
        console.log(
          `[cache] miss namespace=${this.namespace} key=${key} source=redis latency_ms=${latencyMs}`
        )
        return { value: null, source: 'redis', hit: false, latencyMs }
      } catch (error) {
        console.warn(`[RedisCache] Redis get failed, falling back:`, error)
        await this.recordFallback()
        // Fall through to fallback
      }
    }

    // Fallback to in-memory
    const fallbackResult = this.getFallback(key)
    const latencyMs = Math.round(performance.now() - startTime)

    if (fallbackResult) {
      this.localHits++
      // AC #6: Log for LangSmith observability
      console.log(
        `[cache] hit namespace=${this.namespace} key=${key} source=fallback latency_ms=${latencyMs}`
      )
      return { value: fallbackResult, source: 'fallback', hit: true, latencyMs }
    }

    this.localMisses++
    // AC #6: Log for LangSmith observability
    console.log(
      `[cache] miss namespace=${this.namespace} key=${key} source=fallback latency_ms=${latencyMs}`
    )
    return { value: null, source: 'fallback', hit: false, latencyMs }
  }

  /**
   * Set a value in cache
   *
   * Story: E13.8 (AC: #5 - graceful degradation)
   * Uses ZSET pattern for maxEntries enforcement
   */
  async set(key: string, value: T): Promise<CacheSource> {
    const fullKey = `${this.namespace}${key}`
    const now = Date.now()

    // Ensure health check has run
    if (!isHealthChecked()) {
      await checkRedisHealth()
    }

    const redis = getRedis()

    if (redis) {
      try {
        // Pipeline: set value + add to index + trim excess
        const pipeline = redis.pipeline()

        // Set the value with TTL (JSON stringified)
        pipeline.setex(fullKey, this.ttlSeconds, JSON.stringify(value))

        // Add to ZSET index with timestamp as score
        // ioredis zadd syntax: zadd(key, score, member)
        pipeline.zadd(this.indexKey, now, fullKey)

        // Execute pipeline
        await pipeline.exec()

        // Trim excess entries (keep only newest maxEntries)
        await this.trimExcessEntries(redis)

        return 'redis'
      } catch (error) {
        console.warn(`[RedisCache] Redis set failed, falling back:`, error)
        await this.recordFallback()
        // Fall through to fallback
      }
    }

    // Fallback to in-memory
    this.setFallback(key, value)
    return 'fallback'
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<boolean> {
    const fullKey = `${this.namespace}${key}`

    // Ensure health check has run
    if (!isHealthChecked()) {
      await checkRedisHealth()
    }

    const redis = getRedis()

    if (redis) {
      try {
        const pipeline = redis.pipeline()
        pipeline.del(fullKey)
        pipeline.zrem(this.indexKey, fullKey)
        await pipeline.exec()
        return true
      } catch (error) {
        console.warn(`[RedisCache] Redis delete failed:`, error)
        // Fall through to fallback
      }
    }

    // Delete from fallback
    return this.fallback.delete(key)
  }

  /**
   * Clear all entries in this namespace
   */
  async clear(): Promise<void> {
    // Ensure health check has run
    if (!isHealthChecked()) {
      await checkRedisHealth()
    }

    const redis = getRedis()

    if (redis) {
      try {
        // Get all keys in the index
        const keys = await redis.zrange(this.indexKey, 0, -1)
        if (keys.length > 0) {
          // ioredis returns string[]
          await redis.del(...keys)
        }
        await redis.del(this.indexKey)
        // Reset stats
        await redis.del(this.statsKeys.hits, this.statsKeys.misses, this.statsKeys.fallbacks)
      } catch (error) {
        console.warn(`[RedisCache] Redis clear failed:`, error)
      }
    }

    // Clear fallback
    this.fallback.clear()
    this.localHits = 0
    this.localMisses = 0
    this.localFallbacks = 0
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    // Ensure health check has run
    if (!isHealthChecked()) {
      await checkRedisHealth()
    }

    const redis = getRedis()

    if (redis) {
      try {
        const [hitsRaw, missesRaw, fallbacksRaw, size] = await Promise.all([
          redis.get(this.statsKeys.hits),
          redis.get(this.statsKeys.misses),
          redis.get(this.statsKeys.fallbacks),
          redis.zcard(this.indexKey),
        ])

        // Parse string values to numbers (ioredis returns strings)
        const hits = hitsRaw ? parseInt(hitsRaw, 10) : 0
        const misses = missesRaw ? parseInt(missesRaw, 10) : 0
        const fallbacks = fallbacksRaw ? parseInt(fallbacksRaw, 10) : 0

        const totalHits = hits + this.localHits
        const totalMisses = misses + this.localMisses
        const totalRequests = totalHits + totalMisses

        return {
          size: size ?? 0,
          hits: totalHits,
          misses: totalMisses,
          fallbacks: fallbacks + this.localFallbacks,
          hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
          source: 'redis',
        }
      } catch (error) {
        console.warn(`[RedisCache] Redis getStats failed:`, error)
        // Fall through to fallback stats
      }
    }

    // Return fallback stats
    const totalRequests = this.localHits + this.localMisses
    return {
      size: this.fallback.size,
      hits: this.localHits,
      misses: this.localMisses,
      fallbacks: this.localFallbacks,
      hitRate: totalRequests > 0 ? this.localHits / totalRequests : 0,
      source: 'fallback',
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Trim excess entries beyond maxEntries (ZSET-based LRU)
   */
  private async trimExcessEntries(redis: ReturnType<typeof getRedis>): Promise<void> {
    if (!redis) return

    try {
      // Get current count
      const count = await redis.zcard(this.indexKey)
      if (count <= this.maxEntries) return

      // Get keys to remove (oldest entries beyond maxEntries)
      const excess = count - this.maxEntries
      const keysToRemove = await redis.zrange(this.indexKey, 0, excess - 1)

      if (keysToRemove.length > 0) {
        // Delete the keys and remove from index
        // ioredis returns string[]
        await redis.del(...keysToRemove)
        await redis.zremrangebyrank(this.indexKey, 0, excess - 1)
      }
    } catch (error) {
      // Non-critical: trimming is best-effort, cache still works with extra entries
      // Next set() will retry trimming
      console.warn(`[RedisCache] trimExcessEntries failed for ${this.namespace}:`, error)
    }
  }

  /**
   * Get from fallback cache
   */
  private getFallback(key: string): T | null {
    const entry = this.fallback.get(key)
    if (!entry) return null

    // Check TTL
    if (Date.now() > entry.expires) {
      this.fallback.delete(key)
      return null
    }

    return entry.value
  }

  /**
   * Set in fallback cache
   */
  private setFallback(key: string, value: T): void {
    // Evict oldest if at capacity
    if (this.fallback.size >= this.maxEntries) {
      this.evictOldestFallback()
    }

    this.fallback.set(key, {
      value,
      expires: Date.now() + this.ttlSeconds * 1000,
    })
  }

  /**
   * Evict oldest entry from fallback cache
   */
  private evictOldestFallback(): void {
    let oldestKey: string | null = null
    let oldestExpires = Infinity

    this.fallback.forEach((entry, key) => {
      if (entry.expires < oldestExpires) {
        oldestKey = key
        oldestExpires = entry.expires
      }
    })

    if (oldestKey) {
      this.fallback.delete(oldestKey)
    }
  }

  /**
   * Record a cache hit in Redis stats
   */
  private async recordHit(): Promise<void> {
    const redis = getRedis()
    if (redis) {
      try {
        await redis.incr(this.statsKeys.hits)
      } catch {
        this.localHits++
      }
    } else {
      this.localHits++
    }
  }

  /**
   * Record a cache miss in Redis stats
   */
  private async recordMiss(): Promise<void> {
    const redis = getRedis()
    if (redis) {
      try {
        await redis.incr(this.statsKeys.misses)
      } catch {
        this.localMisses++
      }
    } else {
      this.localMisses++
    }
  }

  /**
   * Record a fallback event in Redis stats
   */
  private async recordFallback(): Promise<void> {
    this.localFallbacks++
    const redis = getRedis()
    if (redis) {
      try {
        await redis.incr(this.statsKeys.fallbacks)
      } catch {
        // Already recorded locally
      }
    }
  }
}
