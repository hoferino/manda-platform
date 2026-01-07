/**
 * Tool Result Isolation Module
 *
 * Implements the "Isolate" strategy from LangChain's Context Engineering research.
 * Tool executions return concise summaries to the LLM context while storing full
 * results separately, preserving context window tokens for meaningful conversation.
 *
 * Story: E11.1 - Tool Result Isolation
 * Story: E13.8 - Redis Caching Layer (AC: #2, #10)
 *
 * @see https://blog.langchain.com/context-engineering-for-agents/ - "Isolate" strategy
 */

import type { StructuredToolInterface } from '@langchain/core/tools'
import { estimateTokens } from './context'
import {
  cacheToolResult as cacheToRedis,
  getToolResult as getFromRedis,
  type ToolResultCacheEntry as RedisToolResultEntry,
} from '@/lib/cache/tool-result-cache'

// ============================================================================
// Types
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
 * Cache for storing full tool results outside LLM context
 */
export type ToolResultCache = Map<string, ToolResultCacheEntry>

/**
 * Configuration for tool isolation
 */
export interface IsolationConfig {
  /** Maximum cache entries (oldest evicted first) */
  maxEntries: number
  /** Cache TTL in milliseconds */
  ttlMs: number
  /** Enable verbose logging */
  verbose: boolean
}

/**
 * Default isolation configuration
 */
export const DEFAULT_ISOLATION_CONFIG: IsolationConfig = {
  maxEntries: 50,
  ttlMs: 30 * 60 * 1000, // 30 minutes
  verbose: false,
}

/**
 * Parsed result structure for summarizers
 */
interface ParsedResult {
  success: boolean
  data?: Record<string, unknown>
  error?: string
}

/**
 * Metrics for token savings tracking
 */
export interface IsolationMetrics {
  toolCallId: string
  tool: string
  fullTokens: number
  summaryTokens: number
  savings: number
  savingsPercent: number
}

// ============================================================================
// Cache Operations
// ============================================================================

/**
 * Create a new tool result cache
 */
export function createToolResultCache(): ToolResultCache {
  return new Map()
}

/**
 * Store a tool result in the cache
 *
 * Story: E11.1 - Tool Result Isolation (AC: #2)
 * Story: E13.8 - Redis Caching Layer (AC: #2, #10)
 *
 * Stores in both:
 * - Local Map (for same-request access, backward compatibility)
 * - Redis (for cross-instance sharing, survives restarts)
 */
export function cacheToolResult(
  cache: ToolResultCache,
  entry: ToolResultCacheEntry,
  config: IsolationConfig = DEFAULT_ISOLATION_CONFIG
): void {
  // Evict oldest if at capacity (local Map only)
  if (cache.size >= config.maxEntries) {
    const oldest = [...cache.entries()].sort(
      (a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime()
    )[0]
    if (oldest) cache.delete(oldest[0])
  }

  // Store in local Map for immediate access
  cache.set(entry.toolCallId, entry)

  // Store in Redis for cross-instance sharing (fire-and-forget, non-blocking)
  // E13.8: Redis cache handles TTL, maxEntries, and fallback automatically
  cacheToRedis(entry).catch((error) => {
    console.warn('[tool-isolation] Redis cache write failed:', error)
  })
}

/**
 * Retrieve a cached tool result (sync - local cache only)
 *
 * Story: E11.1 - Tool Result Isolation (AC: #4)
 *
 * NOTE: For backward compatibility, this is still synchronous and only
 * checks the local Map. Use getToolResultAsync for Redis lookups.
 */
export function getToolResult(
  cache: ToolResultCache,
  toolCallId: string,
  config: IsolationConfig = DEFAULT_ISOLATION_CONFIG
): unknown | null {
  const entry = cache.get(toolCallId)
  if (!entry) return null

  // Check TTL
  if (Date.now() - entry.timestamp.getTime() > config.ttlMs) {
    cache.delete(toolCallId)
    return null
  }

  return entry.fullResult
}

/**
 * Retrieve a cached tool result (async - checks Redis for cross-instance sharing)
 *
 * Story: E13.8 - Redis Caching Layer (AC: #2, #10)
 *
 * Checks in order:
 * 1. Local Map (fastest, same-instance)
 * 2. Redis (cross-instance sharing)
 *
 * @param cache - Local tool result cache
 * @param toolCallId - Tool call ID to look up
 * @param config - Isolation configuration
 * @returns Full tool result or null if not found
 */
export async function getToolResultAsync(
  cache: ToolResultCache,
  toolCallId: string,
  config: IsolationConfig = DEFAULT_ISOLATION_CONFIG
): Promise<unknown | null> {
  // First check local cache (fastest)
  const localResult = getToolResult(cache, toolCallId, config)
  if (localResult !== null) {
    return localResult
  }

  // Check Redis for cross-instance hit
  try {
    const redisResult = await getFromRedis(toolCallId)
    return redisResult
  } catch (error) {
    console.warn('[tool-isolation] Redis cache read failed:', error)
    return null
  }
}

/**
 * Clear expired entries from cache
 */
export function clearExpiredEntries(
  cache: ToolResultCache,
  config: IsolationConfig = DEFAULT_ISOLATION_CONFIG
): number {
  const now = Date.now()
  let cleared = 0

  for (const [id, entry] of cache.entries()) {
    if (now - entry.timestamp.getTime() > config.ttlMs) {
      cache.delete(id)
      cleared++
    }
  }

  return cleared
}

/**
 * Get cache statistics
 */
export function getCacheStats(cache: ToolResultCache): {
  size: number
  totalFullTokens: number
  totalSummaryTokens: number
  totalSavings: number
} {
  let totalFullTokens = 0
  let totalSummaryTokens = 0

  for (const entry of cache.values()) {
    totalFullTokens += entry.fullTokens
    totalSummaryTokens += entry.summaryTokens
  }

  return {
    size: cache.size,
    totalFullTokens,
    totalSummaryTokens,
    totalSavings: totalFullTokens - totalSummaryTokens,
  }
}

// ============================================================================
// Token Tracking (Task 5)
// ============================================================================

/**
 * Aggregated metrics for a conversation turn
 * Story: E11.1 - Tool Result Isolation (AC: #5)
 */
export interface TurnMetrics {
  turnId: string
  toolCalls: number
  totalFullTokens: number
  totalSummaryTokens: number
  totalSavings: number
  savingsPercent: number
  metrics: IsolationMetrics[]
}

/**
 * Metrics tracker for aggregating per-turn statistics
 * Story: E11.1 - Tool Result Isolation (AC: #5)
 */
export class IsolationMetricsTracker {
  private metrics: IsolationMetrics[] = []
  private turnId: string

  constructor(turnId?: string) {
    this.turnId = turnId || `turn_${Date.now()}`
  }

  /**
   * Add metrics from a tool call
   */
  add(metric: IsolationMetrics): void {
    this.metrics.push(metric)
  }

  /**
   * Get aggregated metrics for the turn
   */
  aggregate(): TurnMetrics {
    const totalFullTokens = this.metrics.reduce((sum, m) => sum + m.fullTokens, 0)
    const totalSummaryTokens = this.metrics.reduce((sum, m) => sum + m.summaryTokens, 0)
    const totalSavings = totalFullTokens - totalSummaryTokens
    const savingsPercent = totalFullTokens > 0 ? (totalSavings / totalFullTokens) * 100 : 0

    return {
      turnId: this.turnId,
      toolCalls: this.metrics.length,
      totalFullTokens,
      totalSummaryTokens,
      totalSavings,
      savingsPercent,
      metrics: [...this.metrics],
    }
  }

  /**
   * Get the X-Token-Savings header value
   * Story: E11.1 - Tool Result Isolation (AC: #5)
   */
  getTokenSavingsHeader(): string {
    const agg = this.aggregate()
    return `saved=${agg.totalSavings};calls=${agg.toolCalls};percent=${agg.savingsPercent.toFixed(1)}`
  }

  /**
   * Reset for a new turn
   */
  reset(turnId?: string): void {
    this.metrics = []
    this.turnId = turnId || `turn_${Date.now()}`
  }

  /**
   * Get individual metrics
   */
  getMetrics(): IsolationMetrics[] {
    return [...this.metrics]
  }
}

/**
 * Create a new metrics tracker
 */
export function createMetricsTracker(turnId?: string): IsolationMetricsTracker {
  return new IsolationMetricsTracker(turnId)
}

// ============================================================================
// Tool Result Isolation
// ============================================================================

/**
 * Isolate a tool result: generate summary, cache full result
 *
 * Story: E11.1 - Tool Result Isolation (AC: #1, #2, #3)
 */
export function isolateToolResult(
  toolName: string,
  toolCallId: string,
  fullResult: unknown,
  config: IsolationConfig = DEFAULT_ISOLATION_CONFIG
): { summary: string; cacheEntry: ToolResultCacheEntry; metrics: IsolationMetrics } {
  const summary = summarizeForLLM(toolName, fullResult)
  const fullTokens = estimateTokens(JSON.stringify(fullResult))
  const summaryTokens = estimateTokens(summary)
  const savings = fullTokens - summaryTokens
  const savingsPercent = fullTokens > 0 ? (savings / fullTokens) * 100 : 0

  const cacheEntry: ToolResultCacheEntry = {
    tool: toolName,
    toolCallId,
    fullResult,
    summary,
    fullTokens,
    summaryTokens,
    timestamp: new Date(),
  }

  const metrics: IsolationMetrics = {
    toolCallId,
    tool: toolName,
    fullTokens,
    summaryTokens,
    savings,
    savingsPercent,
  }

  if (config.verbose) {
    console.log(
      `[isolateToolResult] ${toolName}: ${fullTokens} → ${summaryTokens} tokens ` +
        `(saved ${savings}, ${savingsPercent.toFixed(1)}%)`
    )
  }

  return { summary, cacheEntry, metrics }
}

// ============================================================================
// Tool Wrapper
// ============================================================================

/**
 * Create an isolated version of a tool that returns summaries
 *
 * Story: E11.1 - Tool Result Isolation (AC: #1, #2)
 */
export function createIsolatedTool(
  tool: StructuredToolInterface,
  cache: ToolResultCache,
  config: IsolationConfig = DEFAULT_ISOLATION_CONFIG
): StructuredToolInterface {
  // Create a wrapper that intercepts the tool's output
  const originalInvoke = tool.invoke.bind(tool)

  const isolatedTool = Object.create(tool) as StructuredToolInterface

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  isolatedTool.invoke = async (input: unknown, options?: any) => {
    // Execute original tool
    const fullResult = await originalInvoke(input, options as Parameters<typeof originalInvoke>[1])

    // Generate tool call ID (from options if available, otherwise generate)
    const toolCallId =
      (options as { tool_call_id?: string })?.tool_call_id ||
      `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    // Isolate the result
    const { summary, cacheEntry } = isolateToolResult(
      tool.name,
      toolCallId,
      fullResult,
      config
    )

    // Store in cache
    cacheToolResult(cache, cacheEntry, config)

    // Return summary (what LLM will see)
    return summary
  }

  return isolatedTool
}

/**
 * Wrap all tools with isolation
 */
export function isolateAllTools(
  tools: StructuredToolInterface[],
  cache: ToolResultCache,
  config: IsolationConfig = DEFAULT_ISOLATION_CONFIG
): StructuredToolInterface[] {
  return tools.map((tool) => createIsolatedTool(tool, cache, config))
}

// ============================================================================
// Summarizers - Tool-Specific Summary Generation
// ============================================================================

/**
 * Generate LLM-friendly summary for a tool result
 *
 * Story: E11.1 - Tool Result Isolation (AC: #1, #3, #6)
 * Covers all 17 tools organized by TOOL_CATEGORIES
 */
export function summarizeForLLM(toolName: string, result: unknown): string {
  const parsed = parseResult(result)

  switch (toolName) {
    // KNOWLEDGE tools (4)
    case 'query_knowledge_base':
      return summarizeKnowledgeBase(parsed)
    case 'update_knowledge_base':
      return summarizeUpdate(parsed, 'knowledge_base')
    case 'validate_finding':
      return summarizeValidation(parsed)
    case 'update_knowledge_graph':
      return summarizeGraphUpdate(parsed)

    // CORRECTION tools (3)
    case 'correct_finding':
      return summarizeCorrection(parsed)
    case 'get_finding_source':
      return summarizeSourceLookup(parsed)
    case 'get_correction_history':
      return summarizeHistory(parsed, 'corrections')

    // INTELLIGENCE tools (2)
    case 'detect_contradictions':
      return summarizeContradictions(parsed)
    case 'find_gaps':
      return summarizeGaps(parsed)

    // DOCUMENT tools (2)
    case 'get_document_info':
      return summarizeDocument(parsed)
    case 'trigger_analysis':
      return summarizeJobTrigger(parsed, 'analysis')

    // WORKFLOW tools (5)
    case 'suggest_questions':
      return summarizeSuggestions(parsed, 'questions')
    case 'add_to_qa':
    case 'add_qa_item':
      return summarizeAdd(parsed, 'Q&A')
    case 'create_irl':
      return summarizeCreate(parsed, 'IRL')
    case 'generate_irl_suggestions':
      return summarizeSuggestions(parsed, 'IRL items')
    case 'add_to_irl':
      return summarizeAdd(parsed, 'IRL')

    default:
      return summarizeGeneric(toolName, parsed)
  }
}

// ============================================================================
// Summarizer Implementations
// ============================================================================

function summarizeKnowledgeBase(result: ParsedResult): string {
  if (!result.success || !result.data?.findings) {
    return `[query_knowledge_base] ${result.error || 'No findings'}`
  }

  const findings = result.data.findings as Array<{
    content: string
    confidence: number
    source?: { documentName: string }
  }>

  const count = findings.length
  const confidences = findings.map((f) => f.confidence).filter(Boolean)
  const confRange =
    confidences.length > 0
      ? `${Math.min(...confidences).toFixed(2)}-${Math.max(...confidences).toFixed(2)}`
      : 'N/A'

  const keySnippet = findings[0]?.content?.slice(0, 80) || 'Various findings'
  const sources = [
    ...new Set(findings.map((f) => f.source?.documentName).filter(Boolean)),
  ].slice(0, 3)

  // Include entities if from Graphiti
  const entities = (result.data.entities as string[])?.slice(0, 3)

  let summary = `[query_knowledge_base] ${count} finding(s) (conf: ${confRange}). "${keySnippet}..."`
  if (sources.length) summary += ` Sources: ${sources.join(', ')}`
  if (entities?.length) summary += ` Entities: ${entities.join(', ')}`

  return summary
}

function summarizeUpdate(result: ParsedResult, target: string): string {
  if (!result.success) return `[update_${target}] Failed: ${result.error}`
  const id = result.data?.id || result.data?.findingId || 'item'
  return `[update_${target}] Stored ${id} successfully`
}

function summarizeValidation(result: ParsedResult): string {
  if (!result.success) return `[validate_finding] Failed: ${result.error}`
  const valid = result.data?.valid ? 'Valid' : 'Invalid'
  const conflicts = (result.data?.conflicts as unknown[])?.length || 0
  return `[validate_finding] ${valid}${conflicts > 0 ? `, ${conflicts} conflicts` : ''}`
}

function summarizeGraphUpdate(result: ParsedResult): string {
  if (!result.success) return `[update_knowledge_graph] Failed: ${result.error}`
  const rels = (result.data?.relationships as unknown[])?.length || 0
  return `[update_knowledge_graph] Created ${rels} relationship(s)`
}

function summarizeCorrection(result: ParsedResult): string {
  if (!result.success) return `[correct_finding] Failed: ${result.error}`
  return `[correct_finding] Corrected, version ${result.data?.version || 'created'}`
}

function summarizeSourceLookup(result: ParsedResult): string {
  if (!result.success) return `[get_finding_source] Not found: ${result.error}`
  const doc = result.data?.documentName || 'document'
  return `[get_finding_source] Source: ${doc}`
}

function summarizeHistory(result: ParsedResult, type: string): string {
  if (!result.success) return `[get_${type}_history] No history`
  const count = (result.data?.history as unknown[])?.length || 0
  return `[get_${type}_history] ${count} entries`
}

function summarizeContradictions(result: ParsedResult): string {
  if (!result.success || !result.data?.contradictions) {
    return `[detect_contradictions] ${result.error || 'None found'}`
  }
  const count = (result.data.contradictions as unknown[]).length
  return `[detect_contradictions] Found ${count} contradiction(s)`
}

function summarizeGaps(result: ParsedResult): string {
  if (!result.success || !result.data?.gaps) {
    return `[find_gaps] ${result.error || 'None found'}`
  }
  const gaps = result.data.gaps as Array<{ category: string }>
  const categories = [
    ...new Set(gaps.map((g) => g.category).filter(Boolean)),
  ].slice(0, 3)
  return `[find_gaps] ${gaps.length} gap(s). Categories: ${categories.join(', ') || 'Various'}`
}

function summarizeDocument(result: ParsedResult): string {
  if (!result.success) return `[get_document_info] Failed: ${result.error}`
  const name = result.data?.name || 'Document'
  const chunksData = result.data?.chunks
  const chunks = result.data?.chunkCount ||
    (Array.isArray(chunksData) ? chunksData.length : undefined) || '?'
  return `[get_document_info] "${name}" (${chunks} chunks)`
}

function summarizeJobTrigger(result: ParsedResult, type: string): string {
  if (!result.success) return `[trigger_${type}] Failed: ${result.error}`
  const jobId = result.data?.jobId || 'queued'
  return `[trigger_${type}] Job ${jobId} started`
}

function summarizeSuggestions(result: ParsedResult, type: string): string {
  if (!result.success) return `[suggest] Failed: ${result.error}`
  const items =
    result.data?.suggestions || result.data?.questions || result.data?.items || []
  return `[suggest] Generated ${Array.isArray(items) ? items.length : 0} ${type}`
}

function summarizeAdd(result: ParsedResult, target: string): string {
  if (!result.success) return `[add_to_${target}] Failed: ${result.error}`
  const id = result.data?.id || 'item'
  return `[add_to_${target}] Added ${id}`
}

function summarizeCreate(result: ParsedResult, target: string): string {
  if (!result.success) return `[create_${target}] Failed: ${result.error}`
  const id = result.data?.id || 'created'
  return `[create_${target}] Created ${id}`
}

function summarizeGeneric(toolName: string, result: ParsedResult): string {
  if (!result.success) return `[${toolName}] Failed: ${result.error}`
  const keys = Object.keys(result.data || {}).slice(0, 3)
  return `[${toolName}] OK. Data: ${keys.join(', ') || 'none'}`
}

// ============================================================================
// Result Parsing Helpers
// ============================================================================

/**
 * Parse various result formats into a standard structure
 */
function parseResult(result: unknown): ParsedResult {
  // Handle null/undefined
  if (result == null) {
    return { success: false, error: 'No result' }
  }

  // Handle string results (may be JSON or plain text)
  if (typeof result === 'string') {
    try {
      return JSON.parse(result) as ParsedResult
    } catch {
      return { success: true, data: { content: result } }
    }
  }

  // Handle object results
  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>

    // Check for explicit success/error fields
    if ('success' in obj || 'error' in obj) {
      return {
        success: obj.success !== false && !obj.error,
        data: obj.data as Record<string, unknown> | undefined,
        error: obj.error as string | undefined,
      }
    }

    // Treat as successful data
    return { success: true, data: obj as Record<string, unknown> }
  }

  return { success: false, error: 'Invalid result format' }
}
