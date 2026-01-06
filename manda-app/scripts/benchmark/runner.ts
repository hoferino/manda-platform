/**
 * Benchmark Runner
 *
 * Executes benchmark queries and collects metrics.
 * Story: E13.7 - Performance Benchmarking Suite (AC: #2, #3)
 */

import pLimit from 'p-limit'
import { getAuthHeaders } from './auth'
import { estimateTokens, calculateModelCost } from './metrics'
import type {
  BenchmarkQuery,
  BenchmarkResult,
  BenchmarkConfig,
} from './types'
import { DEFAULT_CONFIG } from './types'
import type { ComplexityLevel, IntentType } from '@/lib/agent/intent'

// For dry-run mode, import classification directly
// Note: This requires running via tsx which handles path aliases
let classifyIntentAsync: typeof import('@/lib/agent/intent').classifyIntentAsync

/**
 * Load classification function lazily for dry-run mode
 */
async function loadClassifier(): Promise<void> {
  if (!classifyIntentAsync) {
    const intent = await import('@/lib/agent/intent')
    classifyIntentAsync = intent.classifyIntentAsync
  }
}

/**
 * Execute a single query in dry-run mode (classification only)
 */
async function executeDryRun(query: BenchmarkQuery): Promise<BenchmarkResult> {
  await loadClassifier()

  const startTime = performance.now()
  const result = await classifyIntentAsync(query.query)
  const totalLatencyMs = performance.now() - startTime

  const classifiedComplexity = result.complexity ?? 'medium'
  const classifiedIntent = result.intent

  return {
    queryId: query.id,
    query: query.query,
    expectedComplexity: query.expectedComplexity,
    classifiedComplexity,
    classificationCorrect: query.expectedComplexity === classifiedComplexity,
    expectedIntent: query.expectedIntent,
    classifiedIntent,
    intentCorrect: query.expectedIntent === classifiedIntent,
    model: 'dry-run',
    toolsLoaded: result.suggestedTools?.length ?? 0,
    ttftMs: 0,
    totalLatencyMs,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    success: true,
  }
}

/**
 * Parse SSE stream and extract metrics
 */
interface SSEParseResult {
  ttftMs: number
  totalLatencyMs: number
  fullOutput: string
  model: string
  toolsLoaded: number
  classifiedComplexity: ComplexityLevel
  classifiedIntent: IntentType
  specialistUsed?: string
  traceId?: string
}

async function parseSSEStream(
  response: Response,
  startTime: number
): Promise<SSEParseResult> {
  let ttftMs = 0
  let fullOutput = ''
  let model = 'unknown'
  let toolsLoaded = 0
  let classifiedComplexity: ComplexityLevel = 'medium'
  let classifiedIntent: IntentType = 'factual'
  let specialistUsed: string | undefined
  let traceId: string | undefined
  let firstToken = true

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n')

    for (const line of lines) {
      // Parse event type
      if (line.startsWith('event: ')) {
        const eventType = line.slice(7).trim()
        // Could track event types if needed
        continue
      }

      // Parse data
      if (line.startsWith('data: ')) {
        const data = line.slice(6)

        // Try to parse as JSON (metadata events)
        if (data.startsWith('{')) {
          try {
            const json = JSON.parse(data)

            // Extract metadata from various event types
            if (json.model) model = json.model
            if (json.toolsLoaded) toolsLoaded = json.toolsLoaded
            if (json.complexity) classifiedComplexity = json.complexity
            if (json.intent) classifiedIntent = json.intent
            if (json.specialistUsed) specialistUsed = json.specialistUsed
            if (json.traceId) traceId = json.traceId
          } catch {
            // Not JSON, treat as token content
            if (firstToken && data.trim()) {
              ttftMs = performance.now() - startTime
              firstToken = false
            }
            fullOutput += data
          }
        } else {
          // Plain text token
          if (firstToken && data.trim()) {
            ttftMs = performance.now() - startTime
            firstToken = false
          }
          fullOutput += data
        }
      }
    }
  }

  const totalLatencyMs = performance.now() - startTime

  return {
    ttftMs,
    totalLatencyMs,
    fullOutput,
    model,
    toolsLoaded,
    classifiedComplexity,
    classifiedIntent,
    specialistUsed,
    traceId,
  }
}

/**
 * Execute a single query against the API
 */
async function executeQuery(
  query: BenchmarkQuery,
  config: BenchmarkConfig,
  headers: Record<string, string>
): Promise<BenchmarkResult> {
  const startTime = performance.now()

  const url = `${config.apiUrl}/api/projects/${config.dealId}/chat`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...headers,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        message: query.query,
        conversationId: config.conversationId,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const sseResult = await parseSSEStream(response, startTime)

    // Calculate metrics
    const inputTokens = estimateTokens(query.query)
    const outputTokens = estimateTokens(sseResult.fullOutput)
    const costUsd = calculateModelCost(
      sseResult.model,
      inputTokens,
      outputTokens
    )

    return {
      queryId: query.id,
      query: query.query,
      expectedComplexity: query.expectedComplexity,
      classifiedComplexity: sseResult.classifiedComplexity,
      classificationCorrect:
        query.expectedComplexity === sseResult.classifiedComplexity,
      expectedIntent: query.expectedIntent,
      classifiedIntent: sseResult.classifiedIntent,
      intentCorrect: query.expectedIntent === sseResult.classifiedIntent,
      model: sseResult.model,
      toolsLoaded: sseResult.toolsLoaded,
      specialistUsed: sseResult.specialistUsed,
      ttftMs: sseResult.ttftMs,
      totalLatencyMs: sseResult.totalLatencyMs,
      inputTokens,
      outputTokens,
      costUsd,
      traceId: sseResult.traceId,
      success: true,
    }
  } catch (error) {
    const totalLatencyMs = performance.now() - startTime

    return {
      queryId: query.id,
      query: query.query,
      expectedComplexity: query.expectedComplexity,
      classifiedComplexity: 'medium',
      classificationCorrect: false,
      expectedIntent: query.expectedIntent,
      classifiedIntent: 'factual',
      intentCorrect: false,
      model: 'unknown',
      toolsLoaded: 0,
      ttftMs: 0,
      totalLatencyMs,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Progress callback type
 */
export type ProgressCallback = (
  completed: number,
  total: number,
  result: BenchmarkResult
) => void

/**
 * Benchmark Runner class
 */
export class BenchmarkRunner {
  private config: BenchmarkConfig
  private limit: ReturnType<typeof pLimit>

  constructor(config: BenchmarkConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    }
    this.limit = pLimit(this.config.concurrency)
  }

  /**
   * Run a single query with retry logic
   */
  private async runWithRetry(
    query: BenchmarkQuery,
    headers: Record<string, string>
  ): Promise<BenchmarkResult> {
    // First attempt
    let result = this.config.dryRun
      ? await executeDryRun(query)
      : await executeQuery(query, this.config, headers)

    // Retry once on failure
    if (!result.success) {
      console.log(`[runner] Query ${query.id} failed, retrying...`)
      await new Promise((r) => setTimeout(r, 1000))

      result = this.config.dryRun
        ? await executeDryRun(query)
        : await executeQuery(query, this.config, headers)

      if (!result.success) {
        console.error(
          `[runner] Query ${query.id} failed after retry:`,
          result.error
        )
      }
    }

    return result
  }

  /**
   * Run warm-up queries (results discarded)
   */
  async runWarmUp(
    queries: BenchmarkQuery[],
    headers: Record<string, string>
  ): Promise<void> {
    if (this.config.warmUpQueries <= 0) return

    console.log(`[runner] Running ${this.config.warmUpQueries} warm-up queries`)
    const warmUpQueries = queries.slice(0, this.config.warmUpQueries)

    for (const query of warmUpQueries) {
      await this.runWithRetry(query, headers)
    }

    console.log('[runner] Warm-up complete')
  }

  /**
   * Run all benchmark queries
   */
  async runAll(
    queries: BenchmarkQuery[],
    onProgress?: ProgressCallback
  ): Promise<BenchmarkResult[]> {
    // Get auth headers (skip for dry-run)
    const headers = this.config.dryRun ? {} : await getAuthHeaders()

    // Filter by tier if specified
    let filteredQueries = queries
    if (this.config.tiers.length > 0) {
      filteredQueries = queries.filter((q) =>
        this.config.tiers.includes(q.expectedComplexity)
      )
      console.log(
        `[runner] Filtered to ${filteredQueries.length} queries for tiers: ${this.config.tiers.join(', ')}`
      )
    }

    // Run warm-up
    await this.runWarmUp(filteredQueries, headers)

    // Run benchmark
    console.log(`[runner] Starting benchmark of ${filteredQueries.length} queries`)
    const results: BenchmarkResult[] = []
    let completed = 0

    // Process in batches with delay
    for (
      let i = 0;
      i < filteredQueries.length;
      i += this.config.concurrency
    ) {
      const batch = filteredQueries.slice(i, i + this.config.concurrency)

      const batchResults = await Promise.all(
        batch.map((query) =>
          this.limit(async () => {
            const result = await this.runWithRetry(query, headers)
            completed++
            onProgress?.(completed, filteredQueries.length, result)
            return result
          })
        )
      )

      results.push(...batchResults)

      // Delay between batches (except for last batch)
      if (i + this.config.concurrency < filteredQueries.length) {
        await new Promise((r) => setTimeout(r, this.config.batchDelayMs))
      }
    }

    console.log(
      `[runner] Benchmark complete: ${results.filter((r) => r.success).length}/${results.length} successful`
    )

    return results
  }
}

/**
 * Load queries from JSON files
 */
export async function loadQueries(
  queriesDir: string
): Promise<BenchmarkQuery[]> {
  const fs = await import('fs/promises')
  const path = await import('path')

  const queries: BenchmarkQuery[] = []

  for (const tier of ['simple', 'medium', 'complex']) {
    const filePath = path.join(queriesDir, `${tier}.json`)

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const tierQueries = JSON.parse(content) as BenchmarkQuery[]
      queries.push(...tierQueries)
    } catch (error) {
      console.warn(`[runner] Could not load ${tier}.json:`, error)
    }
  }

  return queries
}

/**
 * Generate a unique run ID
 */
export function generateRunId(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const randomSuffix = Math.random().toString(36).substring(2, 8)
  return `bench-${timestamp}-${randomSuffix}`
}
