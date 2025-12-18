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

import { classifyIntent, shouldRetrieve, type IntentType } from './intent'

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

/**
 * Cached retrieval result
 */
interface CachedResult {
  context: string
  entities: string[]
  timestamp: number
}

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
// =============================================================================

/**
 * Simple LRU cache for retrieval results
 *
 * Key: topic-based key from query + dealId
 * Value: CachedResult with context and timestamp
 *
 * Features:
 * - TTL-based expiry (default 5 minutes)
 * - LRU eviction when max size reached
 * - Topic-based key generation (ignores word order)
 */
export class RetrievalCache {
  private cache = new Map<string, CachedResult>()
  private readonly ttlMs: number
  private readonly maxSize: number

  constructor(ttlMs = CACHE_TTL_MS, maxSize = MAX_CACHE_SIZE) {
    this.ttlMs = ttlMs
    this.maxSize = maxSize
  }

  /**
   * Generate cache key from query and dealId
   *
   * Extracts significant words (length > 3) and sorts them
   * for topic-based matching (e.g., "Q3 revenue" matches "revenue Q3")
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
   */
  get(key: string): CachedResult | undefined {
    const cached = this.cache.get(key)
    if (!cached) return undefined

    // Check TTL
    if (Date.now() - cached.timestamp > this.ttlMs) {
      this.cache.delete(key)
      return undefined
    }

    return cached
  }

  /**
   * Set cached result with LRU eviction
   */
  set(key: string, value: CachedResult): void {
    // LRU eviction: delete oldest entry if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) this.cache.delete(oldestKey)
    }

    this.cache.set(key, value)
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== undefined
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache stats for monitoring
   */
  getStats(): { size: number; maxSize: number; ttlMs: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
    }
  }
}

// Global cache instance (per-process)
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
    const line = `- ${result.content} [Source: ${source}${page}]\n`

    // Estimate tokens (~4 chars per token)
    const lineTokens = Math.ceil(line.length / 4)

    // Check budget before adding
    if (estimatedTokens + lineTokens > maxTokens) {
      break
    }

    context += line
    estimatedTokens += lineTokens
  }

  return {
    context: context.trim(),
    tokenCount: estimatedTokens,
  }
}

// =============================================================================
// Graphiti Search
// =============================================================================

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

  // Classify intent (AC: #1, #2)
  const intent = classifyIntent(userQuery)

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
  const cacheKey = retrievalCache.generateKey(userQuery, dealId)
  const cached = retrievalCache.get(cacheKey)

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
  retrievalCache.set(cacheKey, {
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
