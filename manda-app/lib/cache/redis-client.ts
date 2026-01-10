/**
 * Redis Client Module
 *
 * Core ioredis client with health checking and graceful degradation.
 * Story: E13.8 - Redis Caching Layer (AC: #1, #5)
 * Action Item: Epic 2 Retro - Migrate from Upstash to ioredis for self-hosted Redis
 *
 * Features:
 * - Lazy-initialized Redis client
 * - Health check on first operation
 * - Graceful degradation to in-memory fallback
 * - Structured logging for cache events
 * - Works with both local Docker Redis and self-hosted production Redis
 *
 * Environment Variables:
 * - REDIS_URL: Redis connection URL (e.g., redis://localhost:6379)
 * - REDIS_CACHE_ENABLED: Set to 'false' to disable Redis caching
 */

import Redis from 'ioredis'

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

/**
 * Get the default Redis URL based on environment
 * Local dev: redis://localhost:6379
 * Production: From REDIS_URL env var
 */
function getRedisUrl(): string | null {
  // First check explicit REDIS_URL
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL
  }

  // Legacy support: Check old Upstash env vars (for gradual migration)
  if (process.env.UPSTASH_REDIS_REST_URL) {
    console.warn(
      '[cache] UPSTASH_REDIS_REST_URL is deprecated. Please migrate to REDIS_URL for self-hosted Redis.'
    )
    return null // Upstash uses REST API, can't use with ioredis
  }

  // No Redis URL configured
  return null
}

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

  const redisUrl = getRedisUrl()
  if (!redisUrl) {
    return null
  }

  // Lazy initialization
  if (!redisClient) {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          // Stop retrying after 3 attempts
          return null
        }
        // Exponential backoff: 100ms, 200ms, 400ms
        return Math.min(times * 100, 400)
      },
      // Don't throw on connection errors - we handle graceful degradation
      enableOfflineQueue: false,
      // Reasonable timeouts for caching operations
      connectTimeout: 5000,
      commandTimeout: 3000,
    })

    // Handle connection errors gracefully
    redisClient.on('error', (error) => {
      console.warn('[cache] Redis connection error:', error.message)
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
    // Disconnect and clean up
    try {
      await redisClient?.quit()
    } catch {
      // Ignore cleanup errors
    }
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
  if (redisClient) {
    redisClient.quit().catch(() => {})
    redisClient = null
  }
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

/**
 * Gracefully disconnect Redis client (for cleanup)
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit()
    } catch {
      // Ignore disconnect errors
    }
    redisClient = null
    healthChecked = false
    healthCheckPassed = false
  }
}
