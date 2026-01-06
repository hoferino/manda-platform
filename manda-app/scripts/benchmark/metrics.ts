/**
 * Benchmark Metrics Collection
 *
 * Utilities for collecting and calculating benchmark metrics.
 * Story: E13.7 - Performance Benchmarking Suite (AC: #3)
 */

import { quantile, mean, min, max } from 'simple-statistics'
import { calculateModelCost as calculateCost } from '@/lib/llm/config'
import type {
  BenchmarkResult,
  PercentileStats,
  TierMetrics,
  TargetComparison,
  TARGET_METRICS,
} from './types'
import type { ComplexityLevel } from '@/lib/agent/intent'

/**
 * Estimate token count from text content
 * Uses chars/4 approximation (standard for English text)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Calculate cost for a query using model-specific pricing
 */
export function calculateModelCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  return calculateCost(model, inputTokens, outputTokens)
}

/**
 * Calculate percentile statistics for a numeric array
 */
export function calculatePercentiles(values: number[]): PercentileStats {
  if (values.length === 0) {
    return { p50: 0, p95: 0, p99: 0, min: 0, max: 0, mean: 0 }
  }

  // Sort values for quantile calculation
  const sorted = [...values].sort((a, b) => a - b)

  return {
    p50: quantile(sorted, 0.5),
    p95: quantile(sorted, 0.95),
    p99: quantile(sorted, 0.99),
    min: min(sorted),
    max: max(sorted),
    mean: mean(sorted),
  }
}

/**
 * Calculate tier metrics from benchmark results
 */
export function calculateTierMetrics(results: BenchmarkResult[]): TierMetrics {
  const successful = results.filter((r) => r.success)
  const ttftValues = successful.map((r) => r.ttftMs)
  const latencyValues = successful.map((r) => r.totalLatencyMs)
  const costValues = successful.map((r) => r.costUsd)
  const inputTokenValues = successful.map((r) => r.inputTokens)
  const outputTokenValues = successful.map((r) => r.outputTokens)

  const classificationCorrect = results.filter(
    (r) => r.classificationCorrect
  ).length
  const intentCorrect = results.filter((r) => r.intentCorrect).length

  return {
    queryCount: results.length,
    successCount: successful.length,
    classificationAccuracy:
      results.length > 0 ? classificationCorrect / results.length : 0,
    intentAccuracy: results.length > 0 ? intentCorrect / results.length : 0,
    ttft: calculatePercentiles(ttftValues),
    latency: calculatePercentiles(latencyValues),
    cost: {
      total: costValues.reduce((sum, c) => sum + c, 0),
      average: costValues.length > 0 ? mean(costValues) : 0,
      min: costValues.length > 0 ? min(costValues) : 0,
      max: costValues.length > 0 ? max(costValues) : 0,
    },
    tokens: {
      avgInput: inputTokenValues.length > 0 ? mean(inputTokenValues) : 0,
      avgOutput: outputTokenValues.length > 0 ? mean(outputTokenValues) : 0,
      totalInput: inputTokenValues.reduce((sum, t) => sum + t, 0),
      totalOutput: outputTokenValues.reduce((sum, t) => sum + t, 0),
    },
  }
}

/**
 * Group results by complexity tier
 */
export function groupByTier(
  results: BenchmarkResult[]
): Record<ComplexityLevel, BenchmarkResult[]> {
  const grouped: Record<ComplexityLevel, BenchmarkResult[]> = {
    simple: [],
    medium: [],
    complex: [],
  }

  for (const result of results) {
    // Use expected complexity for grouping (what we intended to test)
    grouped[result.expectedComplexity].push(result)
  }

  return grouped
}

/**
 * Compare tier metrics against targets
 */
export function compareToTargets(
  tier: ComplexityLevel,
  metrics: TierMetrics,
  targets: typeof TARGET_METRICS
): TargetComparison[] {
  const tierTargets = targets[tier]
  const comparisons: TargetComparison[] = []

  // TTFT P95 comparison
  comparisons.push({
    tier,
    metric: 'ttftP95Ms',
    target: tierTargets.ttftP95Ms,
    actual: metrics.ttft.p95,
    passed: metrics.ttft.p95 <= tierTargets.ttftP95Ms,
    percentDiff:
      tierTargets.ttftP95Ms > 0
        ? ((metrics.ttft.p95 - tierTargets.ttftP95Ms) / tierTargets.ttftP95Ms) *
          100
        : 0,
  })

  // Cost comparison (average)
  comparisons.push({
    tier,
    metric: 'costUsd',
    target: tierTargets.costUsd,
    actual: metrics.cost.average,
    passed: metrics.cost.average <= tierTargets.costUsd,
    percentDiff:
      tierTargets.costUsd > 0
        ? ((metrics.cost.average - tierTargets.costUsd) / tierTargets.costUsd) *
          100
        : 0,
  })

  // Input tokens comparison (average)
  comparisons.push({
    tier,
    metric: 'inputTokens',
    target: tierTargets.inputTokens,
    actual: metrics.tokens.avgInput,
    passed: metrics.tokens.avgInput <= tierTargets.inputTokens,
    percentDiff:
      tierTargets.inputTokens > 0
        ? ((metrics.tokens.avgInput - tierTargets.inputTokens) /
            tierTargets.inputTokens) *
          100
        : 0,
  })

  return comparisons
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`
  } else {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.round((ms % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }
}

/**
 * Format cost in USD
 */
export function formatCost(usd: number): string {
  if (usd < 0.0001) {
    return `$${usd.toExponential(2)}`
  } else if (usd < 0.01) {
    return `$${usd.toFixed(6)}`
  } else if (usd < 1) {
    return `$${usd.toFixed(4)}`
  } else {
    return `$${usd.toFixed(2)}`
  }
}

/**
 * Format percentage
 */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}
