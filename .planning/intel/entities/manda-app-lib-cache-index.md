---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/cache/index.ts
type: module
updated: 2026-01-20
status: active
---

# index.ts

## Purpose

Barrel export for the Redis-backed caching layer. Centralizes access to the Redis client, generic cache class, and domain-specific caches for tool results, retrieval, and summarization. Provides a unified import path for all caching functionality across the application.

## Exports

- `getRedis` - Get Redis client instance
- `checkRedisHealth` - Health check function
- `resetHealthCheck` - Reset health check state
- `isRedisAvailable` - Check if Redis is available
- `isHealthChecked` - Check if health check completed
- `CACHE_NAMESPACES` - Cache namespace constants
- `CacheSource` - Type for cache source tracking
- `CacheNamespace` - Type for namespace keys
- `RedisCache` - Generic Redis cache class
- `CacheStats` - Interface for cache statistics
- `CacheGetResult` - Interface for cache get results
- `toolResultCache` - Tool result cache instance
- `cacheToolResult` - Function to cache tool results
- `getToolResult` - Function to retrieve cached tool results
- `clearToolResultCache` - Function to clear tool result cache
- `getToolResultCacheStats` - Function to get tool cache stats
- `ToolResultCacheEntry` - Interface for tool cache entries
- `retrievalCache` - Retrieval cache instance
- `getRetrievalCacheStats` - Function to get retrieval cache stats
- `clearRetrievalCache` - Function to clear retrieval cache
- `summarizationCache` - Summarization cache instance
- `getSummarizationCacheStats` - Function to get summarization cache stats
- `clearSummarizationCache` - Function to clear summarization cache

## Dependencies

- [[manda-app-lib-cache-redis-client]] - Core Redis client
- [[manda-app-lib-cache-redis-cache]] - Generic cache class
- [[manda-app-lib-cache-tool-result-cache]] - Tool result caching
- [[manda-app-lib-cache-retrieval-cache]] - Retrieval result caching
- [[manda-app-lib-cache-summarization-cache]] - Summarization caching

## Used By

TBD
