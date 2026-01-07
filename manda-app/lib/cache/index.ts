/**
 * Cache Module Exports
 *
 * Centralized exports for Redis-backed caching layer.
 * Story: E13.8 - Redis Caching Layer
 */

// Core Redis client
export {
  getRedis,
  checkRedisHealth,
  resetHealthCheck,
  isRedisAvailable,
  isHealthChecked,
  CACHE_NAMESPACES,
  type CacheSource,
  type CacheNamespace,
} from './redis-client'

// Generic Redis cache class
export {
  RedisCache,
  type CacheStats,
  type CacheGetResult,
} from './redis-cache'

// Domain-specific caches
export {
  toolResultCache,
  cacheToolResult,
  getToolResult,
  clearToolResultCache,
  getToolResultCacheStats,
  type ToolResultCacheEntry,
} from './tool-result-cache'

export {
  retrievalCache,
  getRetrievalCacheStats,
  clearRetrievalCache,
} from './retrieval-cache'

export {
  summarizationCache,
  getSummarizationCacheStats,
  clearSummarizationCache,
} from './summarization-cache'
