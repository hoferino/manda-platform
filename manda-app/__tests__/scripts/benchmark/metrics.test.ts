/**
 * Metrics Module Tests
 *
 * Story: E13.7 - Performance Benchmarking Suite (AC: #3)
 */

import { describe, it, expect } from 'vitest'
import {
  estimateTokens,
  calculatePercentiles,
  calculateTierMetrics,
  groupByTier,
  compareToTargets,
  formatDuration,
  formatCost,
  formatPercent,
} from '../../../scripts/benchmark/metrics'
import { TARGET_METRICS } from '../../../scripts/benchmark/types'
import type { BenchmarkResult } from '../../../scripts/benchmark/types'

describe('estimateTokens', () => {
  it('should estimate tokens from text length', () => {
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens('test')).toBe(1) // 4 chars / 4 = 1
    expect(estimateTokens('hello world')).toBe(3) // 11 chars / 4 = 2.75 → 3
    expect(estimateTokens('a'.repeat(100))).toBe(25) // 100 / 4 = 25
  })

  it('should round up fractional tokens', () => {
    expect(estimateTokens('abc')).toBe(1) // 3 / 4 = 0.75 → 1
    expect(estimateTokens('abcde')).toBe(2) // 5 / 4 = 1.25 → 2
  })
})

describe('calculatePercentiles', () => {
  it('should return zeros for empty array', () => {
    const result = calculatePercentiles([])
    expect(result.p50).toBe(0)
    expect(result.p95).toBe(0)
    expect(result.p99).toBe(0)
    expect(result.min).toBe(0)
    expect(result.max).toBe(0)
    expect(result.mean).toBe(0)
  })

  it('should calculate percentiles for single value', () => {
    const result = calculatePercentiles([100])
    expect(result.p50).toBe(100)
    expect(result.p95).toBe(100)
    expect(result.p99).toBe(100)
    expect(result.min).toBe(100)
    expect(result.max).toBe(100)
    expect(result.mean).toBe(100)
  })

  it('should calculate percentiles for multiple values', () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    const result = calculatePercentiles(values)

    expect(result.min).toBe(10)
    expect(result.max).toBe(100)
    expect(result.mean).toBe(55) // (10+20+...+100)/10 = 550/10 = 55
    expect(result.p50).toBe(55) // median
    expect(result.p95).toBeGreaterThan(90)
    expect(result.p99).toBeGreaterThan(95)
  })

  it('should handle unsorted input', () => {
    const values = [50, 10, 90, 30, 70]
    const result = calculatePercentiles(values)

    expect(result.min).toBe(10)
    expect(result.max).toBe(90)
    expect(result.p50).toBe(50)
  })
})

describe('groupByTier', () => {
  const createResult = (
    complexity: 'simple' | 'medium' | 'complex'
  ): BenchmarkResult => ({
    queryId: `test-${complexity}`,
    query: 'test',
    expectedComplexity: complexity,
    classifiedComplexity: complexity,
    classificationCorrect: true,
    expectedIntent: 'factual',
    classifiedIntent: 'factual',
    intentCorrect: true,
    model: 'test',
    toolsLoaded: 0,
    ttftMs: 100,
    totalLatencyMs: 200,
    inputTokens: 50,
    outputTokens: 25,
    costUsd: 0.001,
    success: true,
  })

  it('should group results by expected complexity', () => {
    const results = [
      createResult('simple'),
      createResult('medium'),
      createResult('simple'),
      createResult('complex'),
    ]

    const grouped = groupByTier(results)

    expect(grouped.simple).toHaveLength(2)
    expect(grouped.medium).toHaveLength(1)
    expect(grouped.complex).toHaveLength(1)
  })

  it('should return empty arrays for missing tiers', () => {
    const results = [createResult('simple')]
    const grouped = groupByTier(results)

    expect(grouped.simple).toHaveLength(1)
    expect(grouped.medium).toHaveLength(0)
    expect(grouped.complex).toHaveLength(0)
  })
})

describe('calculateTierMetrics', () => {
  const createSuccessResult = (): BenchmarkResult => ({
    queryId: 'test',
    query: 'test query',
    expectedComplexity: 'simple',
    classifiedComplexity: 'simple',
    classificationCorrect: true,
    expectedIntent: 'factual',
    classifiedIntent: 'factual',
    intentCorrect: true,
    model: 'test-model',
    toolsLoaded: 5,
    ttftMs: 100,
    totalLatencyMs: 200,
    inputTokens: 50,
    outputTokens: 25,
    costUsd: 0.001,
    success: true,
  })

  const createFailureResult = (): BenchmarkResult => ({
    ...createSuccessResult(),
    success: false,
    error: 'Test error',
    ttftMs: 0,
    totalLatencyMs: 100,
    costUsd: 0,
  })

  it('should calculate metrics for successful results', () => {
    const results = [createSuccessResult(), createSuccessResult()]
    const metrics = calculateTierMetrics(results)

    expect(metrics.queryCount).toBe(2)
    expect(metrics.successCount).toBe(2)
    expect(metrics.classificationAccuracy).toBe(1)
    expect(metrics.intentAccuracy).toBe(1)
    expect(metrics.ttft.mean).toBe(100)
    expect(metrics.latency.mean).toBe(200)
    expect(metrics.cost.total).toBe(0.002)
    expect(metrics.cost.average).toBe(0.001)
  })

  it('should exclude failed results from timing metrics', () => {
    const results = [createSuccessResult(), createFailureResult()]
    const metrics = calculateTierMetrics(results)

    expect(metrics.queryCount).toBe(2)
    expect(metrics.successCount).toBe(1)
    expect(metrics.ttft.mean).toBe(100) // Only from successful result
  })

  it('should calculate classification accuracy', () => {
    const correct = createSuccessResult()
    const incorrect: BenchmarkResult = {
      ...createSuccessResult(),
      classifiedComplexity: 'medium',
      classificationCorrect: false,
    }

    const metrics = calculateTierMetrics([correct, incorrect])
    expect(metrics.classificationAccuracy).toBe(0.5)
  })

  it('should handle empty results', () => {
    const metrics = calculateTierMetrics([])

    expect(metrics.queryCount).toBe(0)
    expect(metrics.successCount).toBe(0)
    expect(metrics.classificationAccuracy).toBe(0)
    expect(metrics.ttft.mean).toBe(0)
  })
})

describe('compareToTargets', () => {
  it('should pass when metrics are below targets', () => {
    const metrics = {
      queryCount: 10,
      successCount: 10,
      classificationAccuracy: 1,
      intentAccuracy: 1,
      ttft: { p50: 100, p95: 400, p99: 450, min: 50, max: 500, mean: 200 },
      latency: { p50: 200, p95: 800, p99: 900, min: 100, max: 1000, mean: 400 },
      cost: { total: 0.0008, average: 0.00008, min: 0.00005, max: 0.0001 },
      tokens: { avgInput: 1500, avgOutput: 200, totalInput: 15000, totalOutput: 2000 },
    }

    const comparisons = compareToTargets('simple', metrics, TARGET_METRICS)

    const ttftComparison = comparisons.find((c) => c.metric === 'ttftP95Ms')
    expect(ttftComparison?.passed).toBe(true)

    const costComparison = comparisons.find((c) => c.metric === 'costUsd')
    expect(costComparison?.passed).toBe(true)

    const tokenComparison = comparisons.find((c) => c.metric === 'inputTokens')
    expect(tokenComparison?.passed).toBe(true)
  })

  it('should fail when metrics exceed targets', () => {
    const metrics = {
      queryCount: 10,
      successCount: 10,
      classificationAccuracy: 1,
      intentAccuracy: 1,
      ttft: { p50: 1000, p95: 2000, p99: 3000, min: 500, max: 5000, mean: 1500 },
      latency: { p50: 2000, p95: 4000, p99: 6000, min: 1000, max: 10000, mean: 3000 },
      cost: { total: 0.01, average: 0.001, min: 0.0005, max: 0.002 },
      tokens: { avgInput: 5000, avgOutput: 500, totalInput: 50000, totalOutput: 5000 },
    }

    const comparisons = compareToTargets('simple', metrics, TARGET_METRICS)

    // Simple tier targets: TTFT 500ms, cost $0.0001, tokens 2000
    const ttftComparison = comparisons.find((c) => c.metric === 'ttftP95Ms')
    expect(ttftComparison?.passed).toBe(false)
    expect(ttftComparison?.percentDiff).toBeGreaterThan(0)

    const costComparison = comparisons.find((c) => c.metric === 'costUsd')
    expect(costComparison?.passed).toBe(false)

    const tokenComparison = comparisons.find((c) => c.metric === 'inputTokens')
    expect(tokenComparison?.passed).toBe(false)
  })

  it('should use correct targets for each tier', () => {
    const metrics = {
      queryCount: 10,
      successCount: 10,
      classificationAccuracy: 1,
      intentAccuracy: 1,
      ttft: { p50: 1000, p95: 2500, p99: 2800, min: 500, max: 3000, mean: 1500 },
      latency: { p50: 2000, p95: 4000, p99: 6000, min: 1000, max: 10000, mean: 3000 },
      cost: { total: 0.008, average: 0.0008, min: 0.0005, max: 0.001 },
      tokens: { avgInput: 3500, avgOutput: 400, totalInput: 35000, totalOutput: 4000 },
    }

    // Same metrics should pass medium tier targets but fail simple
    const simpleComparisons = compareToTargets('simple', metrics, TARGET_METRICS)
    const mediumComparisons = compareToTargets('medium', metrics, TARGET_METRICS)

    // For simple: TTFT 2500 > 500 (fail), cost 0.0008 > 0.0001 (fail)
    expect(simpleComparisons.find((c) => c.metric === 'ttftP95Ms')?.passed).toBe(false)

    // For medium: TTFT 2500 < 3000 (pass), cost 0.0008 < 0.001 (pass)
    expect(mediumComparisons.find((c) => c.metric === 'ttftP95Ms')?.passed).toBe(true)
    expect(mediumComparisons.find((c) => c.metric === 'costUsd')?.passed).toBe(true)
  })
})

describe('formatDuration', () => {
  it('should format milliseconds', () => {
    expect(formatDuration(100)).toBe('100ms')
    expect(formatDuration(999)).toBe('999ms')
  })

  it('should format seconds', () => {
    expect(formatDuration(1000)).toBe('1.0s')
    expect(formatDuration(1500)).toBe('1.5s')
    expect(formatDuration(59999)).toBe('60.0s')
  })

  it('should format minutes', () => {
    expect(formatDuration(60000)).toBe('1m 0s')
    expect(formatDuration(90000)).toBe('1m 30s')
    expect(formatDuration(150000)).toBe('2m 30s')
  })
})

describe('formatCost', () => {
  it('should format very small costs in scientific notation', () => {
    expect(formatCost(0.00001)).toMatch(/^\$\d\.\d+e/)
  })

  it('should format small costs with high precision', () => {
    expect(formatCost(0.001)).toBe('$0.001000')
    expect(formatCost(0.0001)).toBe('$0.000100')
  })

  it('should format larger costs with lower precision', () => {
    expect(formatCost(1.5)).toBe('$1.50')
    expect(formatCost(10.99)).toBe('$10.99')
  })
})

describe('formatPercent', () => {
  it('should format percentages', () => {
    expect(formatPercent(0)).toBe('0.0%')
    expect(formatPercent(0.5)).toBe('50.0%')
    expect(formatPercent(1)).toBe('100.0%')
    expect(formatPercent(0.123)).toBe('12.3%')
  })
})
