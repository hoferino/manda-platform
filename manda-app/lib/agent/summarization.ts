/**
 * Conversation Summarization Module
 *
 * LLM-based summarization of conversation history with multi-level fallbacks.
 * Story: E11.2 - Conversation Summarization
 *
 * Features:
 * - LLM-based summarization with M&A-optimized prompt
 * - LRU cache with TTL and lastMessageHash invalidation
 * - Multi-level graceful degradation (LLM → fallback → truncation)
 * - 3-second timeout protection
 * - Token budget enforcement (7K effective)
 *
 * Pipeline:
 * 1. Check if summarization needed (>20 messages OR >7000 tokens)
 * 2. Check cache for existing valid summary
 * 3. Generate summary via LLM with timeout
 * 4. Fall back gracefully on failure
 * 5. Return [SystemMessage(summary), ...last10Messages]
 */

import { SystemMessage, trimMessages } from '@langchain/core/messages'
import type { BaseMessage, AIMessage } from '@langchain/core/messages'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'

// =============================================================================
// Configuration
// =============================================================================

/** Messages kept verbatim (not summarized) */
export const MESSAGES_TO_KEEP = 10

/** Summarization trigger: message count threshold */
export const SUMMARIZATION_THRESHOLD_MESSAGES = 20

/** Summarization trigger: token threshold (7K effective with 1K safety margin from 8K) */
export const SUMMARIZATION_THRESHOLD_TOKENS = 7000

/** Timeout for LLM summarization in milliseconds */
export const SUMMARIZATION_TIMEOUT_MS = 3000

/** Target output length for summary */
export const SUMMARY_TARGET_TOKENS = 400

/** Cache TTL in milliseconds (30 minutes) */
export const CACHE_TTL_MS = 30 * 60 * 1000

/** Maximum cache entries (LRU eviction) */
export const MAX_CACHE_SIZE = 50

// =============================================================================
// Types
// =============================================================================

/**
 * Summarization metrics for observability (AC: #7)
 */
export interface SummarizationMetrics {
  /** Token count before summarization */
  tokensBeforeSummary: number
  /** Token count after summarization */
  tokensAfterSummary: number
  /** Tokens saved by summarization */
  tokensSaved: number
  /** Compression ratio (tokensAfter / tokensBefore) */
  compressionRatio: number
  /** Latency in milliseconds */
  latencyMs: number
  /** Number of messages that were summarized */
  messagesSummarized: number
  /** Number of messages kept verbatim */
  messagesKept: number
  /** Whether result came from cache */
  cacheHit: boolean
  /** Whether summarization succeeded */
  success: boolean
  /** Method used for summarization */
  method: 'llm' | 'fallback' | 'truncation'
}

/**
 * Configuration for summarization
 */
export interface SummarizationConfig {
  /** Maximum messages to keep verbatim (default: 10) */
  messagesToKeep?: number
  /** Message count threshold for triggering summarization (default: 20) */
  messageThreshold?: number
  /** Token threshold for triggering summarization (default: 7000) */
  tokenThreshold?: number
  /** Timeout for LLM call in ms (default: 3000) */
  timeoutMs?: number
  /** Deal ID for cache key generation */
  dealId?: string
}

/**
 * Result from summarization
 */
export interface SummarizationResult {
  /** Modified messages: [SystemMessage(summary), ...recentMessages] */
  messages: BaseMessage[]
  /** Summary text (empty if not summarized) */
  summaryText: string
  /** Metrics for observability */
  metrics: SummarizationMetrics
}

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

// =============================================================================
// M&A-Optimized Summarization Prompt (AC: #2)
// =============================================================================

/**
 * Summarization prompt optimized for M&A due diligence conversations
 *
 * Priority order:
 * 1. Analyst corrections (highest priority)
 * 2. Key metrics (revenue, EBITDA, margins)
 * 3. Critical findings (risks, red flags)
 * 4. Entities (companies, people, time periods)
 * 5. Q&A (only if directly relevant)
 */
export const SUMMARIZATION_PROMPT = `You are summarizing a conversation between an M&A analyst and an AI assistant.

Your summary must fit within 400 tokens. Format as a concise narrative.

Include in order of priority:
1. **Analyst Corrections** - Facts the analyst corrected (mark with "Corrected:")
2. **Key Metrics** - Revenue, EBITDA, margins, employee counts, deal terms
3. **Critical Findings** - Risks, red flags, opportunities identified
4. **Entities** - Company names, people, time periods (Q3 2024, FY2025)
5. **Questions & Answers** - Only if directly relevant to due diligence

Exclude: greetings, pleasantries, meta-conversation, tool usage discussions.

Example output:
"Corrected: Q3 revenue was $5.2M (not $4.8M as initially stated). Company has 150 employees (confirmed). EBITDA margins declined from 22% to 18% YoY. Key risks: customer concentration (top 3 = 65% revenue), EU regulatory exposure. Management: CEO John Smith (15yr experience)."

Summarize the following conversation:`

// =============================================================================
// Hash Utilities
// =============================================================================

/**
 * Generate a hash for a message (for cache key generation)
 *
 * Uses content prefix + type to create a short hash.
 * Avoids relying on message IDs as they may not be stable.
 *
 * For non-ASCII content (e.g., Japanese, Chinese), uses a numeric hash
 * based on character codes to maintain uniqueness.
 */
export function hashMessage(msg: BaseMessage): string {
  const content = typeof msg.content === 'string'
    ? msg.content
    : JSON.stringify(msg.content)
  const typePrefix = msg._getType().slice(0, 2) // 'hu', 'ai', 'sy'
  // Use btoa for base64 encoding (works in both browser and Node 16+)
  try {
    return btoa(`${typePrefix}:${content.slice(0, 100)}`).slice(0, 12)
  } catch {
    // Fallback for non-ASCII content: use character code sum for better uniqueness
    // This preserves hash quality for non-Latin text (Japanese, Chinese, etc.)
    const contentSlice = content.slice(0, 100)
    let hash = 0
    for (let i = 0; i < contentSlice.length; i++) {
      const char = contentSlice.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    const numericHash = Math.abs(hash).toString(36).slice(0, 8)
    return `${typePrefix}:${numericHash}`.slice(0, 12)
  }
}

/**
 * Generate cache key from messages and dealId
 *
 * Key includes:
 * - dealId for namespace isolation
 * - message count
 * - lastMessageHash for invalidation
 */
export function getCacheKey(messages: BaseMessage[], dealId: string): string {
  const lastMessage = messages[messages.length - 1]
  const lastHash = lastMessage ? hashMessage(lastMessage) : 'empty'
  return `${dealId}:${messages.length}:${lastHash}`
}

// =============================================================================
// Summarization Cache (AC: #5)
// =============================================================================

/**
 * LRU cache for summarization results
 *
 * Features:
 * - TTL-based expiry (default 30 minutes)
 * - LRU eviction when max size reached
 * - lastMessageHash for cache invalidation when new messages added
 * - Hit rate tracking for observability (AC: #7)
 */
export class SummarizationCache {
  private cache = new Map<string, CachedSummary>()
  private readonly ttlMs: number
  private readonly maxSize: number
  /** Track cache hits for hit rate calculation (AC: #7) */
  private hits = 0
  private misses = 0
  private fallbackCount = 0

  constructor(ttlMs = CACHE_TTL_MS, maxSize = MAX_CACHE_SIZE) {
    this.ttlMs = ttlMs
    this.maxSize = maxSize
  }

  /**
   * Get cached summary if valid (not expired)
   */
  get(key: string): CachedSummary | undefined {
    const cached = this.cache.get(key)
    if (!cached) {
      this.misses++
      return undefined
    }

    // Check TTL
    if (Date.now() - cached.timestamp > this.ttlMs) {
      this.cache.delete(key)
      this.misses++
      return undefined
    }

    // Move to end for LRU ordering (delete and re-add)
    this.cache.delete(key)
    this.cache.set(key, cached)

    this.hits++
    return cached
  }

  /**
   * Set cached summary with LRU eviction
   */
  set(key: string, value: CachedSummary): void {
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
   * Record a fallback for metrics tracking (AC: #7)
   */
  recordFallback(): void {
    this.fallbackCount++
  }

  /**
   * Get cache stats for monitoring (AC: #7)
   */
  getStats(): {
    size: number
    maxSize: number
    ttlMs: number
    hits: number
    misses: number
    hitRate: number
    fallbackCount: number
    fallbackRate: number
  } {
    const totalRequests = this.hits + this.misses
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
      hits: this.hits,
      misses: this.misses,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
      fallbackCount: this.fallbackCount,
      fallbackRate: totalRequests > 0 ? this.fallbackCount / totalRequests : 0,
    }
  }

  /**
   * Reset stats counters (useful for testing)
   */
  resetStats(): void {
    this.hits = 0
    this.misses = 0
    this.fallbackCount = 0
  }

  /**
   * Delete a specific entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }
}

/**
 * Global cache instance (per-process singleton)
 *
 * Thread-safety notes for serverless/edge environments:
 * - In Vercel Edge Functions: Each isolate has its own cache instance.
 *   Cache is NOT shared across concurrent requests in different isolates.
 * - In Lambda cold starts: Cache is re-initialized on each cold start.
 *   Cache persists across warm invocations within the same container.
 * - In traditional Node.js: Cache is shared across all requests in the process.
 *
 * This is intentional for summarization caching - we get cache benefits within
 * a warm container/isolate lifecycle, but don't risk stale data across deployments.
 */
const summarizationCache = new SummarizationCache()

/**
 * Export the global cache for testing and monitoring
 */
export { summarizationCache }

// =============================================================================
// Token Estimation
// =============================================================================

/**
 * Estimate tokens in a string (~4 chars per token)
 *
 * This is a conservative estimate that avoids WASM dependencies.
 * Used as fallback when LLM tokenCounter is not available.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Estimate tokens in a message
 */
export function estimateMessageTokens(msg: BaseMessage): number {
  const content = typeof msg.content === 'string'
    ? msg.content
    : JSON.stringify(msg.content)
  // Add overhead for role prefix (~4 tokens)
  return estimateTokens(content) + 4
}

/**
 * Estimate tokens in an array of messages
 */
export function estimateMessagesTokens(messages: BaseMessage[]): number {
  return messages.reduce((total, msg) => total + estimateMessageTokens(msg), 0)
}

/**
 * Create a token counter function compatible with trimMessages API (AC: #6)
 *
 * Attempts to use LLM's getNumTokens() method for accurate counting.
 * Falls back to character-based estimation if LLM method unavailable.
 *
 * @param llm - LangChain chat model with optional getNumTokens method
 * @returns Token counter function for trimMessages
 */
export function createTokenCounter(llm?: BaseChatModel): (msgs: BaseMessage[]) => Promise<number> {
  return async (msgs: BaseMessage[]): Promise<number> => {
    // Try to use LLM's native token counter if available
    if (llm && typeof (llm as unknown as { getNumTokens?: (text: string) => Promise<number> }).getNumTokens === 'function') {
      try {
        let total = 0
        for (const msg of msgs) {
          const content = typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content)
          const tokens = await (llm as unknown as { getNumTokens: (text: string) => Promise<number> }).getNumTokens(content)
          total += tokens + 4 // Add overhead for role
        }
        return total
      } catch {
        // Fall through to estimation
      }
    }
    // Fallback to character-based estimation
    return estimateMessagesTokens(msgs)
  }
}

/**
 * Trim messages using LangChain's trimMessages with LLM tokenCounter (AC: #6)
 *
 * Uses the LLM's native token counting when available for accuracy.
 *
 * @param messages - Messages to trim
 * @param maxTokens - Maximum token budget
 * @param llm - LangChain chat model for token counting
 * @returns Trimmed messages within token budget
 */
export async function trimMessagesWithLLM(
  messages: BaseMessage[],
  maxTokens: number,
  llm?: BaseChatModel
): Promise<BaseMessage[]> {
  const tokenCounter = createTokenCounter(llm)

  return trimMessages(messages, {
    maxTokens,
    strategy: 'last',
    tokenCounter,
    includeSystem: true,
  })
}

// =============================================================================
// Summarization Logic
// =============================================================================

/**
 * Check if summarization is needed based on message count and tokens
 *
 * @param messages - Conversation messages
 * @param config - Summarization configuration
 * @returns true if summarization should be triggered
 */
export function shouldSummarize(
  messages: BaseMessage[],
  config?: SummarizationConfig
): boolean {
  const messageThreshold = config?.messageThreshold ?? SUMMARIZATION_THRESHOLD_MESSAGES
  const tokenThreshold = config?.tokenThreshold ?? SUMMARIZATION_THRESHOLD_TOKENS

  // Check message count
  if (messages.length >= messageThreshold) {
    return true
  }

  // Check token count
  const tokenCount = estimateMessagesTokens(messages)
  if (tokenCount >= tokenThreshold) {
    return true
  }

  return false
}

/**
 * Extract topics from messages (simple fallback)
 *
 * Used when LLM summarization fails
 */
export function extractTopicsFromMessages(messages: BaseMessage[]): string {
  const topics = new Set<string>()

  for (const msg of messages) {
    const content = typeof msg.content === 'string'
      ? msg.content
      : JSON.stringify(msg.content)

    // Look for financial metrics
    if (/revenue|EBITDA|margin|profit|earnings/i.test(content)) {
      topics.add('financial metrics')
    }
    // Look for company info
    if (/company|team|management|employee|headcount/i.test(content)) {
      topics.add('company information')
    }
    // Look for financial statements
    if (/P&L|balance sheet|cash flow|financial statement/i.test(content)) {
      topics.add('financial statements')
    }
    // Look for risk factors
    if (/risk|liability|litigation|compliance|regulatory/i.test(content)) {
      topics.add('risk factors')
    }
    // Look for deal terms
    if (/valuation|multiple|deal|acquisition|merger|price/i.test(content)) {
      topics.add('deal terms')
    }
  }

  if (topics.size === 0) {
    return `due diligence analysis`
  }

  return Array.from(topics).join(', ')
}

/**
 * Generate summary using LLM
 *
 * @param messages - Messages to summarize
 * @param llm - LangChain chat model
 * @returns Summary text
 */
async function generateSummaryWithLLM(
  messages: BaseMessage[],
  llm: BaseChatModel
): Promise<string> {
  // Format messages for summarization
  const formattedHistory = messages.map((msg) => {
    const role = msg._getType() === 'human' ? 'Analyst' : 'Assistant'
    const content = typeof msg.content === 'string'
      ? msg.content
      : JSON.stringify(msg.content)
    return `${role}: ${content}`
  }).join('\n\n')

  // Create summarization prompt
  const prompt = `${SUMMARIZATION_PROMPT}\n\n${formattedHistory}`

  // Call LLM
  const response = await llm.invoke([new SystemMessage(prompt)])

  // Extract text from response
  const responseContent = response.content
  if (typeof responseContent === 'string') {
    return responseContent
  }

  // Handle array content (multimodal responses)
  if (Array.isArray(responseContent)) {
    return responseContent
      .filter((part): part is { type: 'text'; text: string } =>
        typeof part === 'object' && part !== null && 'type' in part && part.type === 'text'
      )
      .map((part) => part.text)
      .join('')
  }

  return ''
}

/**
 * Summarize conversation history with timeout and fallbacks
 *
 * Main entry point for conversation summarization.
 * Implements multi-level graceful degradation:
 * 1. LLM summarization (preferred)
 * 2. Topic extraction fallback
 * 3. Truncation message (guaranteed)
 *
 * @param messages - Full conversation history
 * @param llm - LangChain chat model
 * @param config - Summarization configuration
 * @returns SummarizationResult with modified messages and metrics
 */
export async function summarizeConversationHistory(
  messages: BaseMessage[],
  llm: BaseChatModel,
  config?: SummarizationConfig
): Promise<SummarizationResult> {
  const startTime = performance.now()
  const messagesToKeep = config?.messagesToKeep ?? MESSAGES_TO_KEEP
  const timeoutMs = config?.timeoutMs ?? SUMMARIZATION_TIMEOUT_MS
  const dealId = config?.dealId ?? 'default'

  // Calculate initial metrics
  const tokensBeforeSummary = estimateMessagesTokens(messages)

  // If no summarization needed, return as-is
  if (!shouldSummarize(messages, config)) {
    return {
      messages,
      summaryText: '',
      metrics: {
        tokensBeforeSummary,
        tokensAfterSummary: tokensBeforeSummary,
        tokensSaved: 0,
        compressionRatio: 1,
        latencyMs: Math.round(performance.now() - startTime),
        messagesSummarized: 0,
        messagesKept: messages.length,
        cacheHit: false,
        success: true,
        method: 'llm', // Not actually called, but indicates capability
      },
    }
  }

  // Split messages: older to summarize, recent to keep
  const oldMessages = messages.slice(0, -messagesToKeep)
  const recentMessages = messages.slice(-messagesToKeep)
  const messagesSummarized = oldMessages.length

  // Check cache first (AC: #5)
  const cacheKey = getCacheKey(messages, dealId)
  const cached = summarizationCache.get(cacheKey)

  if (cached) {
    const summaryMessage = new SystemMessage(`Previous context: ${cached.summaryText}`)
    const resultMessages = [summaryMessage, ...recentMessages]
    const tokensAfterSummary = estimateMessagesTokens(resultMessages)

    console.log(`[summarization] Cache hit for: ${cacheKey.slice(0, 30)}...`)

    return {
      messages: resultMessages,
      summaryText: cached.summaryText,
      metrics: {
        tokensBeforeSummary,
        tokensAfterSummary,
        tokensSaved: tokensBeforeSummary - tokensAfterSummary,
        compressionRatio: tokensAfterSummary / tokensBeforeSummary,
        latencyMs: Math.round(performance.now() - startTime),
        messagesSummarized,
        messagesKept: recentMessages.length,
        cacheHit: true,
        success: true,
        method: 'llm',
      },
    }
  }

  // Try LLM summarization with timeout (AC: #4)
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Summarization timeout')), timeoutMs)
    )

    const summary = await Promise.race([
      generateSummaryWithLLM(oldMessages, llm),
      timeoutPromise,
    ])

    // Cache the result
    const messageHashes = oldMessages.map(hashMessage)
    const lastMessageForCache = messages[messages.length - 1]
    summarizationCache.set(cacheKey, {
      summaryText: summary,
      messageHashes,
      lastMessageHash: lastMessageForCache ? hashMessage(lastMessageForCache) : 'empty',
      messageCount: messagesSummarized,
      tokenCount: estimateTokens(summary),
      timestamp: Date.now(),
    })

    const summaryMessage = new SystemMessage(`Previous context: ${summary}`)
    const resultMessages = [summaryMessage, ...recentMessages]
    const tokensAfterSummary = estimateMessagesTokens(resultMessages)

    console.log(
      `[summarization] LLM success: ${messagesSummarized} messages → ${estimateTokens(summary)} tokens`
    )

    return {
      messages: resultMessages,
      summaryText: summary,
      metrics: {
        tokensBeforeSummary,
        tokensAfterSummary,
        tokensSaved: tokensBeforeSummary - tokensAfterSummary,
        compressionRatio: tokensAfterSummary / tokensBeforeSummary,
        latencyMs: Math.round(performance.now() - startTime),
        messagesSummarized,
        messagesKept: recentMessages.length,
        cacheHit: false,
        success: true,
        method: 'llm',
      },
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.warn(`[summarization] LLM failed, trying fallback: ${errorMessage}`)

    // Level 1: Simple topic extraction (existing placeholder logic)
    try {
      const fallbackSummary = extractTopicsFromMessages(oldMessages)
      const summaryMessage = new SystemMessage(
        `Previous conversation topics: ${fallbackSummary}. ${messagesSummarized} earlier messages summarized.`
      )
      const resultMessages = [summaryMessage, ...recentMessages]
      const tokensAfterSummary = estimateMessagesTokens(resultMessages)

      console.log(`[summarization] Fallback success: extracted topics`)

      // Record fallback for metrics (AC: #7)
      summarizationCache.recordFallback()

      return {
        messages: resultMessages,
        summaryText: fallbackSummary,
        metrics: {
          tokensBeforeSummary,
          tokensAfterSummary,
          tokensSaved: tokensBeforeSummary - tokensAfterSummary,
          compressionRatio: tokensAfterSummary / tokensBeforeSummary,
          latencyMs: Math.round(performance.now() - startTime),
          messagesSummarized,
          messagesKept: recentMessages.length,
          cacheHit: false,
          success: false,
          method: 'fallback',
        },
      }
    } catch (fallbackError) {
      // Level 2: Basic truncation message (guaranteed to work)
      const fallbackErrorMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      console.warn(`[summarization] Fallback failed, using truncation message:`, fallbackErrorMsg)

      // Record fallback for metrics (AC: #7)
      summarizationCache.recordFallback()

      const truncationMessage = `Earlier conversation included ${messagesSummarized} messages.`
      const summaryMessage = new SystemMessage(truncationMessage)
      const resultMessages = [summaryMessage, ...recentMessages]
      const tokensAfterSummary = estimateMessagesTokens(resultMessages)

      return {
        messages: resultMessages,
        summaryText: truncationMessage,
        metrics: {
          tokensBeforeSummary,
          tokensAfterSummary,
          tokensSaved: tokensBeforeSummary - tokensAfterSummary,
          compressionRatio: tokensAfterSummary / tokensBeforeSummary,
          latencyMs: Math.round(performance.now() - startTime),
          messagesSummarized,
          messagesKept: recentMessages.length,
          cacheHit: false,
          success: false,
          method: 'truncation',
        },
      }
    }
  }
}

/**
 * Summarize with timeout wrapper (convenience function for streamChat integration)
 *
 * @param messages - Full conversation history
 * @param llm - LangChain chat model
 * @param config - Summarization configuration
 * @returns SummarizationResult
 */
export async function summarizeWithTimeout(
  messages: BaseMessage[],
  llm: BaseChatModel,
  config?: SummarizationConfig
): Promise<SummarizationResult> {
  return summarizeConversationHistory(messages, llm, config)
}

// =============================================================================
// Exports
// =============================================================================

export {
  // Re-export for convenience
  type BaseMessage,
  type BaseChatModel,
}
