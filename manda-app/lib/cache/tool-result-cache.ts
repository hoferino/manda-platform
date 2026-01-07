/**
 * Tool Result Cache (Redis-Backed)
 *
 * Stores full tool results outside LLM context.
 * Story: E13.8 - Redis Caching Layer (AC: #2)
 * Story: E11.1 - Tool Result Isolation
 *
 * Features:
 * - 50 entries max, 30 minute TTL (per architecture)
 * - Async API (breaking change from E11.1 sync API)
 * - Graceful fallback to in-memory
 * - Compatible with existing ToolResultCacheEntry interface
 */

import { RedisCache, type CacheStats } from './redis-cache'
import { CACHE_NAMESPACES } from './redis-client'

// ============================================================================
// Types (from tool-isolation.ts)
// ============================================================================

/**
 * Cache entry for isolated tool results
 */
export interface ToolResultCacheEntry {
  tool: string
  toolCallId: string
  fullResult: unknown
  summary: string
  fullTokens: number
  summaryTokens: number
  timestamp: Date
}

/**
 * Serializable version for Redis storage
 */
interface StoredToolResultEntry {
  tool: string
  toolCallId: string
  fullResult: unknown
  summary: string
  fullTokens: number
  summaryTokens: number
  timestamp: string // ISO string for JSON serialization
}

// ============================================================================
// Configuration
// ============================================================================

/** TTL in seconds (30 minutes) */
const TOOL_CACHE_TTL = 30 * 60

/** Max entries */
const TOOL_CACHE_MAX_ENTRIES = 50

// ============================================================================
// Cache Instance
// ============================================================================

/**
 * Global Redis-backed tool result cache
 *
 * Story: E13.8 (AC: #2)
 * - Prefix: cache:tool:
 * - TTL: 30 minutes
 * - Max: 50 entries
 */
export const toolResultCache = new RedisCache<StoredToolResultEntry>(
  CACHE_NAMESPACES.toolResult,
  TOOL_CACHE_TTL,
  TOOL_CACHE_MAX_ENTRIES
)

// ============================================================================
// API Functions (Async versions)
// ============================================================================

/**
 * Store a tool result in the cache
 *
 * Story: E13.8 (AC: #2, #10 - async API)
 *
 * @param entry - Tool result cache entry
 * @returns Cache source (redis or fallback)
 */
export async function cacheToolResult(entry: ToolResultCacheEntry): Promise<'redis' | 'fallback'> {
  // Convert Date to ISO string for JSON serialization
  const stored: StoredToolResultEntry = {
    ...entry,
    timestamp: entry.timestamp.toISOString(),
  }

  return toolResultCache.set(entry.toolCallId, stored)
}

/**
 * Retrieve a cached tool result
 *
 * Story: E13.8 (AC: #2, #10 - async API)
 *
 * @param toolCallId - Tool call ID
 * @returns Full result or null if not found
 */
export async function getToolResult(toolCallId: string): Promise<unknown | null> {
  const result = await toolResultCache.get(toolCallId)

  if (!result.value) {
    return null
  }

  return result.value.fullResult
}

/**
 * Get full cache entry (with metadata)
 *
 * @param toolCallId - Tool call ID
 * @returns Full cache entry or null
 */
export async function getToolResultEntry(toolCallId: string): Promise<ToolResultCacheEntry | null> {
  const result = await toolResultCache.get(toolCallId)

  if (!result.value) {
    return null
  }

  // Convert ISO string back to Date
  return {
    ...result.value,
    timestamp: new Date(result.value.timestamp),
  }
}

/**
 * Clear all tool result cache entries
 */
export async function clearToolResultCache(): Promise<void> {
  await toolResultCache.clear()
}

/**
 * Get tool result cache statistics
 */
export async function getToolResultCacheStats(): Promise<CacheStats> {
  return toolResultCache.getStats()
}
