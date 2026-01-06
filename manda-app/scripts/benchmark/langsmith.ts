/**
 * LangSmith Integration
 *
 * Utilities for tagging traces and uploading benchmark results to LangSmith.
 * Story: E13.7 - Performance Benchmarking Suite (AC: #5)
 */

import { Client } from 'langsmith'
import type { BenchmarkResult, BenchmarkReport } from './types'
import type { ComplexityLevel } from '@/lib/agent/intent'

/**
 * LangSmith client singleton
 */
let client: Client | null = null

/**
 * Get or create LangSmith client
 */
function getClient(): Client {
  if (!client) {
    const apiKey = process.env.LANGSMITH_API_KEY
    const endpoint = process.env.LANGSMITH_ENDPOINT

    if (!apiKey) {
      throw new Error('LANGSMITH_API_KEY environment variable is not set')
    }

    client = new Client({
      apiKey,
      apiUrl: endpoint, // Uses default if not set
    })
  }

  return client
}

/**
 * Check if LangSmith is configured
 */
export function isLangSmithConfigured(): boolean {
  return !!process.env.LANGSMITH_API_KEY
}

/**
 * Benchmark metadata for trace tagging
 */
export interface BenchmarkTraceMetadata {
  benchmark: true
  runId: string
  queryId: string
  expectedComplexity: ComplexityLevel
  expectedIntent: string
  category: string
}

/**
 * Tag a trace with benchmark metadata
 *
 * Note: This requires the trace ID to be available, which may need
 * to be extracted from the API response or callback.
 */
export async function tagBenchmarkTrace(
  traceId: string,
  metadata: BenchmarkTraceMetadata
): Promise<void> {
  if (!isLangSmithConfigured()) {
    console.warn('[langsmith] Not configured, skipping trace tagging')
    return
  }

  try {
    const client = getClient()
    await client.updateRun(traceId, {
      extra: { metadata },
    })
    console.log(`[langsmith] Tagged trace ${traceId} with benchmark metadata`)
  } catch (error) {
    console.error('[langsmith] Failed to tag trace:', error)
  }
}

/**
 * Upload benchmark results to a LangSmith dataset
 */
export async function uploadToDataset(
  results: BenchmarkResult[],
  datasetName: string,
  description?: string
): Promise<{ datasetId: string; exampleCount: number }> {
  if (!isLangSmithConfigured()) {
    throw new Error('LangSmith is not configured')
  }

  const client = getClient()

  // Create or get existing dataset
  let dataset
  try {
    dataset = await client.readDataset({ datasetName })
    console.log(`[langsmith] Using existing dataset: ${datasetName}`)
  } catch {
    // Dataset doesn't exist, create it
    dataset = await client.createDataset(datasetName, {
      description: description ?? 'Manda benchmark results',
    })
    console.log(`[langsmith] Created new dataset: ${datasetName}`)
  }

  // Upload examples
  let uploadedCount = 0
  for (const result of results) {
    try {
      await client.createExample(
        {
          query: result.query,
        },
        {
          success: result.success,
          error: result.error,
        },
        {
          datasetId: dataset.id,
          metadata: {
            queryId: result.queryId,
            expectedComplexity: result.expectedComplexity,
            classifiedComplexity: result.classifiedComplexity,
            classificationCorrect: result.classificationCorrect,
            expectedIntent: result.expectedIntent,
            classifiedIntent: result.classifiedIntent,
            intentCorrect: result.intentCorrect,
            ttftMs: result.ttftMs,
            totalLatencyMs: result.totalLatencyMs,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            costUsd: result.costUsd,
            model: result.model,
            toolsLoaded: result.toolsLoaded,
            traceId: result.traceId,
          },
        }
      )
      uploadedCount++
    } catch (error) {
      console.error(
        `[langsmith] Failed to upload example ${result.queryId}:`,
        error
      )
    }
  }

  console.log(
    `[langsmith] Uploaded ${uploadedCount}/${results.length} examples to dataset ${datasetName}`
  )

  return {
    datasetId: dataset.id,
    exampleCount: uploadedCount,
  }
}

/**
 * Upload a complete benchmark report to LangSmith
 *
 * Note: This uploads the report metadata and any failed queries.
 * For full results upload, use uploadToDataset with the original results array.
 */
export async function uploadReport(
  report: BenchmarkReport,
  results: BenchmarkResult[],
  datasetName?: string
): Promise<{ datasetId: string; exampleCount: number }> {
  const name = datasetName ?? `manda-benchmark-${report.runId}`

  const description = `Benchmark run ${report.runId}
Environment: ${report.environment}
Total Queries: ${report.totalQueries}
Success Rate: ${((report.successCount / report.totalQueries) * 100).toFixed(1)}%
Classification Accuracy: ${(report.overallClassificationAccuracy * 100).toFixed(1)}%
Total Cost: $${report.totalCostUsd.toFixed(6)}`

  console.log(`[langsmith] Uploading report to dataset: ${name}`)

  // Upload all results (including failures for debugging)
  return uploadToDataset(results, name, description)
}

/**
 * Get benchmark traces from LangSmith
 *
 * Filter traces with benchmark=true metadata for analysis
 */
export async function getBenchmarkTraces(
  runId?: string,
  limit: number = 100
): Promise<unknown[]> {
  if (!isLangSmithConfigured()) {
    throw new Error('LangSmith is not configured')
  }

  const client = getClient()
  const projectName = process.env.LANGSMITH_PROJECT ?? 'manda-benchmark'

  // List runs with benchmark metadata
  const runs: unknown[] = []

  try {
    for await (const run of client.listRuns({
      projectName,
      filter: runId
        ? `and(eq(extra.metadata.benchmark, true), eq(extra.metadata.runId, "${runId}"))`
        : 'eq(extra.metadata.benchmark, true)',
      limit,
    })) {
      runs.push(run)
    }
  } catch (error) {
    console.error('[langsmith] Failed to list runs:', error)
  }

  return runs
}

/**
 * Generate LangSmith filter query for benchmark traces
 */
export function getLangSmithFilterQuery(runId?: string): string {
  const baseFilter = 'eq(extra.metadata.benchmark, true)'
  if (runId) {
    return `and(${baseFilter}, eq(extra.metadata.runId, "${runId}"))`
  }
  return baseFilter
}
