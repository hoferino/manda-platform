/**
 * Redis Client Module
 *
 * Core Upstash Redis client with health checking and graceful degradation.
 * Story: E13.8 - Redis Caching Layer (AC: #1, #5)
 *
 * Features:
 * - Lazy-initialized Redis client
 * - Health check on first operation
 * - Graceful degradation to in-memory fallback
 * - Structured logging for cache events
 */

import { Redis } from '@upstash/redis'

// ============================================================================
// Types
// ============================================================================

/**
 * Cache source for observability
 */
export type CacheSource = 'redis' | 'fallback'

/**
 * Cache namespace prefixes (per architecture spec)
 */
export const CACHE_NAMESPACES = {
  toolResult: 'cache:tool:',
  retrieval: 'cache:retrieval:',
  summary: 'cache:summary:',
} as const

export type CacheNamespace = keyof typeof CACHE_NAMESPACES

// ============================================================================
// Module State
// ============================================================================

/** Singleton Redis client instance */
let redisClient: Redis | null = null

/** Health check state */
let healthChecked = false
let healthCheckPassed = false

/** Cache enabled flag (can be disabled via env) */
const isCacheEnabled = () => process.env.REDIS_CACHE_ENABLED !== 'false'

// ============================================================================
// Client Management
// ============================================================================

/**
 * Get the Redis client instance (lazy-initialized)
 *
 * Returns null if Redis is not configured or disabled.
 * Caller should fall back to in-memory cache when null.
 */
export function getRedis(): Redis | null {
  // Check if Redis is explicitly disabled
  if (!isCacheEnabled()) {
    return null
  }

  // Check for required env vars
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }

  // Lazy initialization
  if (!redisClient) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  }

  return redisClient
}

/**
 * Check Redis health on first operation
 *
 * Story: E13.8 - Redis Caching Layer (AC: #1)
 * - Returns true if Redis is healthy and ready
 * - Returns false if Redis unavailable (logs warning, enables fallback)
 * - Only performs actual ping once per process lifecycle
 */
export async function checkRedisHealth(): Promise<boolean> {
  // Return cached result if already checked
  if (healthChecked) {
    return healthCheckPassed
  }

  const redis = getRedis()
  if (!redis) {
    console.warn('[cache] Redis not configured, using in-memory fallback')
    healthChecked = true
    healthCheckPassed = false
    return false
  }

  try {
    await redis.ping()
    console.log('[cache] Redis connection healthy')
    healthChecked = true
    healthCheckPassed = true
    return true
  } catch (error) {
    console.warn('[cache] Redis health check failed, using fallback:', error)
    redisClient = null
    healthChecked = true
    healthCheckPassed = false
    return false
  }
}

/**
 * Reset health check state (for testing)
 */
export function resetHealthCheck(): void {
  healthChecked = false
  healthCheckPassed = false
  redisClient = null
}

/**
 * Check if Redis is currently available (non-blocking)
 *
 * Returns the result of the last health check.
 * Does not perform a new health check.
 */
export function isRedisAvailable(): boolean {
  return healthChecked && healthCheckPassed
}

/**
 * Check if Redis has been health-checked yet
 */
export function isHealthChecked(): boolean {
  return healthChecked
}
