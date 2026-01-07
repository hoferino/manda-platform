/**
 * Pre-Model Retrieval Hook
 *
 * Proactively retrieves relevant knowledge before LLM generation.
 * Story: E11.4 - Intent-Aware Knowledge Retrieval (AC: #3, #4, #5, #6, #7)
 *
 * Pipeline:
 * 1. Classify user intent (skip for greetings/meta)
 * 2. Check cache for topic match
 * 3. Call Graphiti hybrid search (E10.7)
 * 4. Format and inject context into system prompt
 *
 * Features:
 * - Intent-based retrieval skipping (AC: #2)
 * - Token budget enforcement (AC: #5)
 * - LRU caching with TTL (AC: #6)
 * - Latency tracking (AC: #7)
 * - Graceful degradation when Graphiti unavailable
 */

import { SystemMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'

import {
  classifyIntent,
  classifyIntentAsync,
  shouldRetrieve,
  type IntentType,
  type IntentClassificationResult,
} from './intent'

// =============================================================================
// Configuration
// =============================================================================

const PROCESSING_API_URL = process.env.PROCESSING_API_URL || 'http://localhost:8000'
const PROCESSING_API_KEY = process.env.PROCESSING_API_KEY || ''

/** Maximum tokens for retrieval context (AC: #5) - configurable via env */
const RETRIEVAL_MAX_TOKENS = parseInt(process.env.RETRIEVAL_MAX_TOKENS || '2000', 10)

/** Cache TTL in milliseconds (AC: #6) - default 5 minutes */
const CACHE_TTL_MS = parseInt(process.env.RETRIEVAL_CACHE_TTL_MS || '300000', 10)

/** Maximum cache entries (LRU eviction) */
const MAX_CACHE_SIZE = 20

/** Latency warning threshold in ms (AC: #7) */
const LATENCY_TARGET_MS = 500

// =============================================================================
// Types
// =============================================================================

// CachedResult type moved to lib/cache/retrieval-cache.ts as CachedRetrievalResult
// Story: E13.8 - Redis Caching Layer (AC: #3)

/**
 * Result from the pre-model retrieval hook
 */
export interface PreModelHookResult {
  /** Modified messages with injected context (if retrieved) */
  messages: BaseMessage[]
  /** Retrieval latency in milliseconds */
  retrievalLatencyMs: number
  /** Whether result came from cache */
  cacheHit: boolean
  /** Whether retrieval was skipped (greeting/meta intent) */
  skipped: boolean
  /** Intent classification result */
  intent: IntentType
  /** Extracted entities from search results */
  entities?: string[]
}

/**
 * Result from Graphiti hybrid search
 */
interface HybridSearchResult {
  content: string
  score: number
  citation?: {
    type: string
    title: string
    page?: number
  }
}

/**
 * Response from Graphiti hybrid search API
 */
interface HybridSearchResponse {
  results: HybridSearchResult[]
  entities: string[]
  latency_ms: number
}

/**
 * Retrieval metrics for monitoring
 */
export interface RetrievalMetrics {
  latencyMs: number
  cacheHit: boolean
  skipped: boolean
  intent: IntentType
  resultCount?: number
  tokenCount?: number
}

// =============================================================================
// Retrieval Cache (AC: #6)
// Story: E13.8 - Redis Caching Layer (AC: #3, #10)
// =============================================================================

import {
  retrievalCache as redisRetrievalCache,
  type CachedRetrievalResult,
} from '@/lib/cache/retrieval-cache'

/**
 * Redis-backed retrieval cache wrapper
 *
 * Story: E13.8 - Redis Caching Layer (AC: #3, #10)
 * - Migrated from in-memory Map to Redis
 * - Async API for all operations
 * - Graceful fallback to in-memory when Redis unavailable
 *
 * Key: topic-based key from query + dealId
 * Value: CachedResult with context and timestamp
 *
 * Features:
 * - TTL-based expiry (5 minutes)
 * - ZSET-based max entries (20 entries)
 * - Topic-based key generation (ignores word order)
 * - Cross-instance cache sharing via Redis
 */
export class RetrievalCache {
  /**
   * Generate cache key from query and dealId
   *
   * Extracts significant words (length > 3) and sorts them
   * for topic-based matching (e.g., "Q3 revenue" matches "revenue Q3")
   */
  generateKey(query: string, dealId: string): string {
    return redisRetrievalCache.generateKey(query, dealId)
  }

  /**
   * Get cached result if valid (not expired)
   *
   * Story: E13.8 (AC: #3, #10 - async API)
   */
  async get(key: string): Promise<CachedRetrievalResult | null> {
    return redisRetrievalCache.get(key)
  }

  /**
   * Set cached result
   *
   * Story: E13.8 (AC: #3, #10 - async API)
   */
  async set(key: string, value: CachedRetrievalResult): Promise<void> {
    await redisRetrievalCache.set(key, value)
  }

  /**
   * Check if key exists (async version)
   */
  async has(key: string): Promise<boolean> {
    return redisRetrievalCache.has(key)
  }

  /**
   * Clear the cache
   */
  async clear(): Promise<void> {
    await redisRetrievalCache.clear()
  }

  /**
   * Get cache stats for monitoring
   */
  async getStats(): Promise<{ size: number; maxSize: number; ttlMs: number }> {
    return redisRetrievalCache.getStats()
  }
}

// Global cache instance (delegates to Redis-backed cache)
const retrievalCache = new RetrievalCache()

// =============================================================================
// Token Budget Enforcement (AC: #5)
// =============================================================================

/**
 * Format retrieved results with token budget enforcement
 *
 * @param results - Search results from Graphiti
 * @param maxTokens - Maximum tokens to include (default: RETRIEVAL_MAX_TOKENS)
 * @returns Formatted context string within token budget
 */
function formatRetrievedContext(
  results: HybridSearchResult[],
  maxTokens: number = RETRIEVAL_MAX_TOKENS
): { context: string; tokenCount: number } {
  let context = ''
  let estimatedTokens = 0

  for (const result of results) {
    // Format source citation
    const source = result.citation?.title || 'Unknown'
    const page = result.citation?.page ? ` (p${result.citation.page})` : ''
    let line = `- ${result.content} [Source: ${source}${page}]\n`

    // Estimate tokens (~4 chars per token)
    let lineTokens = Math.ceil(line.length / 4)

    // If this single result exceeds budget, truncate it to fit
    // This ensures we always return at least partial context from the first result
    if (lineTokens > maxTokens - estimatedTokens) {
      const remainingTokens = maxTokens - estimatedTokens
      if (remainingTokens > 50) {
        // Only truncate if we have meaningful space left (50+ tokens)
        // Calculate max chars we can use (~4 chars per token, minus citation overhead)
        const citationSuffix = `... [Source: ${source}${page}]\n`
        const citationTokens = Math.ceil(citationSuffix.length / 4)
        const contentTokens = remainingTokens - citationTokens
        const maxContentChars = contentTokens * 4

        if (maxContentChars > 100) {
          // Only truncate if we can show meaningful content
          const truncatedContent = result.content.slice(0, maxContentChars)
          line = `- ${truncatedContent}${citationSuffix}`
          lineTokens = Math.ceil(line.length / 4)
        } else {
          // Not enough space for meaningful content, skip this result
          break
        }
      } else {
        // Not enough space left, stop adding results
        break
      }
    }

    context += line
    estimatedTokens += lineTokens

    // Check if we've reached the budget
    if (estimatedTokens >= maxTokens) {
      break
    }
  }

  return {
    context: context.trim(),
    tokenCount: estimatedTokens,
  }
}

// =============================================================================
// Graphiti Search
// =============================================================================

import { logFeatureUsage } from '@/lib/observability/usage'

/**
 * Entity from Graphiti search (simplified for this module)
 */
interface GraphitiEntity {
  name: string
  type: string
  properties?: Record<string, unknown>
}

/**
 * Safely fetch Graphiti entities with graceful degradation.
 * Story: E12.6 - Error Handling & Graceful Degradation (AC: #1)
 * If Graphiti is unavailable, returns empty results instead of failing.
 * Chat continues with basic vector search only.
 */
export async function safeGraphitiSearch(
  query: string,
  dealId: string,
  options?: { organizationId?: string }
): Promise<GraphitiEntity[]> {
  try {
    const result = await callGraphitiSearch(query, dealId)
    if (!result) return []
    // Map results to entity format
    return result.entities?.map((name) => ({ name, type: 'entity' })) ?? []
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : ''
    const isGraphitiError = msg.includes('neo4j') || msg.includes('graphiti') ||
                            msg.includes('econnrefused') || msg.includes('connection')

    if (isGraphitiError) {
      console.warn('[safeGraphitiSearch] Graphiti unavailable, degrading gracefully:', error)
      logFeatureUsage({
        organizationId: options?.organizationId,
        dealId,
        featureName: 'graphiti_search',
        status: 'error',
        errorMessage: 'Graphiti unavailable - graceful degradation',
        metadata: { degraded: true },
      }).catch(() => {})
      return [] // Chat will use vector search only
    }
    throw error
  }
}

/**
 * Call Graphiti hybrid search API
 *
 * @param query - User query
 * @param dealId - Deal UUID for namespace isolation
 * @returns HybridSearchResponse or null on error
 */
async function callGraphitiSearch(
  query: string,
  dealId: string
): Promise<HybridSearchResponse | null> {
  try {
    const response = await fetch(`${PROCESSING_API_URL}/api/search/hybrid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': PROCESSING_API_KEY,
      },
      body: JSON.stringify({
        query,
        deal_id: dealId,
        num_results: 5, // Top 5 for context injection
      }),
    })

    if (!response.ok) {
      console.warn(`[preModelRetrievalHook] Graphiti search failed: ${response.status}`)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('[preModelRetrievalHook] Graphiti search error:', error)
    return null
  }
}

// =============================================================================
// Pre-Model Retrieval Hook (AC: #3, #4)
// =============================================================================

/**
 * Pre-model retrieval hook for proactive knowledge injection
 *
 * Called before LLM generation to inject relevant knowledge into context.
 * This is the primary defense against hallucinations (per Epic E11 requirements).
 *
 * Pipeline:
 * 1. Extract last user message
 * 2. Classify intent (skip for greeting/meta)
 * 3. Check cache for topic match
 * 4. Call Graphiti hybrid search if needed
 * 5. Format and inject context as SystemMessage
 *
 * @param messages - Current conversation messages
 * @param dealId - Deal UUID for namespace isolation
 * @returns PreModelHookResult with modified messages and metrics
 *
 * @example
 * ```typescript
 * const result = await preModelRetrievalHook(messages, 'deal-123')
 * if (!result.skipped) {
 *   console.log(`Retrieved context in ${result.retrievalLatencyMs}ms (cache=${result.cacheHit})`)
 * }
 * // Use result.messages for LLM invocation
 * ```
 */
export async function preModelRetrievalHook(
  messages: BaseMessage[],
  dealId: string
): Promise<PreModelHookResult> {
  const startTime = performance.now()

  // Get last user message
  const lastMessage = messages.at(-1)
  const userQuery = typeof lastMessage?.content === 'string' ? lastMessage.content : ''

  // Return early if no query
  if (!userQuery) {
    return {
      messages,
      retrievalLatencyMs: 0,
      cacheHit: false,
      skipped: true,
      intent: 'factual',
    }
  }

  // Classify intent using semantic router (AC: #1, #2)
  // Uses Voyage embeddings for accurate classification, falls back to regex
  const classificationResult = await classifyIntentAsync(userQuery)
  const intent = classificationResult.intent

  console.log(
    `[preModelRetrievalHook] Intent: ${intent} (confidence: ${classificationResult.confidence.toFixed(2)}, method: ${classificationResult.method})`
  )

  // Skip retrieval for non-knowledge intents
  if (!shouldRetrieve(intent)) {
    console.log(`[preModelRetrievalHook] Skipping retrieval for intent: ${intent}`)
    return {
      messages,
      retrievalLatencyMs: Math.round(performance.now() - startTime),
      cacheHit: false,
      skipped: true,
      intent,
    }
  }

  // Check cache (AC: #6)
  // E13.8: Now uses Redis-backed cache with async API
  const cacheKey = retrievalCache.generateKey(userQuery, dealId)
  const cached = await retrievalCache.get(cacheKey)

  if (cached) {
    console.log(`[preModelRetrievalHook] Cache hit for: ${cacheKey}`)
    const contextMessage = new SystemMessage(`Relevant knowledge:\n${cached.context}`)
    return {
      messages: [contextMessage, ...messages],
      retrievalLatencyMs: Math.round(performance.now() - startTime),
      cacheHit: true,
      skipped: false,
      intent,
      entities: cached.entities,
    }
  }

  // Call Graphiti hybrid search (AC: #3)
  const searchResult = await callGraphitiSearch(userQuery, dealId)

  // Graceful degradation: continue without context if search fails
  if (!searchResult || !searchResult.results?.length) {
    return {
      messages,
      retrievalLatencyMs: Math.round(performance.now() - startTime),
      cacheHit: false,
      skipped: false,
      intent,
    }
  }

  // Format context with token budget (AC: #5)
  const { context, tokenCount } = formatRetrievedContext(searchResult.results)

  // Cache the result (AC: #6)
  // E13.8: Now uses Redis-backed cache with async API
  await retrievalCache.set(cacheKey, {
    context,
    entities: searchResult.entities || [],
    timestamp: Date.now(),
  })

  // Inject as system message (AC: #4)
  const contextMessage = new SystemMessage(`Relevant knowledge:\n${context}`)

  // Track latency (AC: #7)
  const latencyMs = Math.round(performance.now() - startTime)
  if (latencyMs > LATENCY_TARGET_MS) {
    console.warn(
      `[preModelRetrievalHook] Latency exceeded target: ${latencyMs}ms > ${LATENCY_TARGET_MS}ms`
    )
  } else {
    console.log(
      `[preModelRetrievalHook] Retrieved ${searchResult.results.length} results in ${latencyMs}ms (${tokenCount} tokens)`
    )
  }

  return {
    messages: [contextMessage, ...messages],
    retrievalLatencyMs: latencyMs,
    cacheHit: false,
    skipped: false,
    intent,
    entities: searchResult.entities,
  }
}

// =============================================================================
// Exports
// =============================================================================

export {
  retrievalCache,
  formatRetrievedContext,
  callGraphitiSearch,
  RETRIEVAL_MAX_TOKENS,
  CACHE_TTL_MS,
  MAX_CACHE_SIZE,
  LATENCY_TARGET_MS,
}
