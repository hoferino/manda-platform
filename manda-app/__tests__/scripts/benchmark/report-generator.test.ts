/**
 * Report Generator Tests
 *
 * Story: E13.7 - Performance Benchmarking Suite (AC: #4)
 */

import { describe, it, expect } from 'vitest'
import {
  generateReport,
  generateMarkdownReport,
  compareReports,
  generateComparisonMarkdown,
} from '../../../scripts/benchmark/report-generator'
import type { BenchmarkResult, BenchmarkReport } from '../../../scripts/benchmark/types'

const createMockResult = (
  overrides: Partial<BenchmarkResult> = {}
): BenchmarkResult => ({
  queryId: 'test-001',
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
  costUsd: 0.0001,
  success: true,
  ...overrides,
})

describe('generateReport', () => {
  it('should generate a complete report from results', () => {
    const results: BenchmarkResult[] = [
      createMockResult({ queryId: 'simple-001', expectedComplexity: 'simple' }),
      createMockResult({ queryId: 'simple-002', expectedComplexity: 'simple' }),
      createMockResult({ queryId: 'medium-001', expectedComplexity: 'medium' }),
      createMockResult({ queryId: 'complex-001', expectedComplexity: 'complex' }),
    ]

    const report = generateReport(results, 'test-run', 'test', 10000)

    expect(report.runId).toBe('test-run')
    expect(report.environment).toBe('test')
    expect(report.totalQueries).toBe(4)
    expect(report.successCount).toBe(4)
    expect(report.failureCount).toBe(0)
    expect(report.overallClassificationAccuracy).toBe(1)
    expect(report.totalDurationMs).toBe(10000)
  })

  it('should track failed queries', () => {
    const results: BenchmarkResult[] = [
      createMockResult({ success: true }),
      createMockResult({ success: false, error: 'Test error' }),
    ]

    const report = generateReport(results, 'test-run', 'test', 5000)

    expect(report.successCount).toBe(1)
    expect(report.failureCount).toBe(1)
    expect(report.failures).toHaveLength(1)
    expect(report.failures[0]!.error).toBe('Test error')
  })

  it('should calculate overall classification accuracy', () => {
    const results: BenchmarkResult[] = [
      createMockResult({ classificationCorrect: true }),
      createMockResult({ classificationCorrect: true }),
      createMockResult({ classificationCorrect: false }),
      createMockResult({ classificationCorrect: false }),
    ]

    const report = generateReport(results, 'test-run', 'test', 5000)
    expect(report.overallClassificationAccuracy).toBe(0.5)
  })

  it('should calculate total cost', () => {
    const results: BenchmarkResult[] = [
      createMockResult({ costUsd: 0.001 }),
      createMockResult({ costUsd: 0.002 }),
      createMockResult({ costUsd: 0.003 }),
    ]

    const report = generateReport(results, 'test-run', 'test', 5000)
    expect(report.totalCostUsd).toBeCloseTo(0.006)
  })

  it('should group metrics by tier', () => {
    const results: BenchmarkResult[] = [
      createMockResult({ expectedComplexity: 'simple', ttftMs: 100 }),
      createMockResult({ expectedComplexity: 'simple', ttftMs: 200 }),
      createMockResult({ expectedComplexity: 'medium', ttftMs: 1000 }),
      createMockResult({ expectedComplexity: 'complex', ttftMs: 5000 }),
    ]

    const report = generateReport(results, 'test-run', 'test', 5000)

    expect(report.byTier.simple.queryCount).toBe(2)
    expect(report.byTier.medium.queryCount).toBe(1)
    expect(report.byTier.complex.queryCount).toBe(1)
    expect(report.byTier.simple.ttft.mean).toBe(150) // (100 + 200) / 2
  })

  it('should include target comparisons', () => {
    const results: BenchmarkResult[] = [
      createMockResult({ expectedComplexity: 'simple' }),
    ]

    const report = generateReport(results, 'test-run', 'test', 5000)

    // Should have comparisons for each tier (3) x each metric (3) = 9 total
    expect(report.targetComparisons.length).toBeGreaterThan(0)

    // Find simple tier comparisons
    const simpleComparisons = report.targetComparisons.filter(
      (c) => c.tier === 'simple'
    )
    expect(simpleComparisons.length).toBe(3) // TTFT, cost, tokens
  })
})

describe('generateMarkdownReport', () => {
  it('should generate valid markdown', () => {
    const results = [createMockResult()]
    const report = generateReport(results, 'test-run', 'test', 5000)

    const markdown = generateMarkdownReport(report)

    expect(markdown).toContain('# Benchmark Report')
    expect(markdown).toContain('**Run ID:** test-run')
    expect(markdown).toContain('## Summary')
    expect(markdown).toContain('## Results by Tier')
  })

  it('should include summary table', () => {
    const results = [
      createMockResult(),
      createMockResult({ success: false }),
    ]
    const report = generateReport(results, 'test-run', 'test', 5000)

    const markdown = generateMarkdownReport(report)

    expect(markdown).toContain('| Total Queries | 2 |')
    expect(markdown).toContain('| Successful | 1 |')
    expect(markdown).toContain('| Failed | 1 |')
  })

  it('should include tier breakdowns', () => {
    const results = [
      createMockResult({ expectedComplexity: 'simple' }),
      createMockResult({ expectedComplexity: 'medium' }),
      createMockResult({ expectedComplexity: 'complex' }),
    ]
    const report = generateReport(results, 'test-run', 'test', 5000)

    const markdown = generateMarkdownReport(report)

    expect(markdown).toContain('### Simple Tier')
    expect(markdown).toContain('### Medium Tier')
    expect(markdown).toContain('### Complex Tier')
  })

  it('should include target comparison section', () => {
    const results = [createMockResult()]
    const report = generateReport(results, 'test-run', 'test', 5000)

    const markdown = generateMarkdownReport(report)

    expect(markdown).toContain('## Target Comparison')
    expect(markdown).toMatch(/\*\*Overall:\*\* \d+\/\d+ targets met/)
  })

  it('should include failures section when there are failures', () => {
    const results = [
      createMockResult({ success: false, error: 'Connection timeout' }),
    ]
    const report = generateReport(results, 'test-run', 'test', 5000)

    const markdown = generateMarkdownReport(report)

    expect(markdown).toContain('## Failed Queries')
    expect(markdown).toContain('Connection timeout')
  })

  it('should not include failures section when all succeed', () => {
    const results = [createMockResult()]
    const report = generateReport(results, 'test-run', 'test', 5000)

    const markdown = generateMarkdownReport(report)

    expect(markdown).not.toContain('## Failed Queries')
  })
})

describe('compareReports', () => {
  const createReport = (
    overrides: Partial<BenchmarkReport>
  ): BenchmarkReport => ({
    runId: 'test',
    timestamp: new Date().toISOString(),
    environment: 'test',
    totalQueries: 10,
    successCount: 10,
    failureCount: 0,
    overallClassificationAccuracy: 1,
    overallIntentAccuracy: 1,
    byTier: {
      simple: {
        queryCount: 4,
        successCount: 4,
        classificationAccuracy: 1,
        intentAccuracy: 1,
        ttft: { p50: 100, p95: 200, p99: 250, min: 50, max: 300, mean: 125 },
        latency: { p50: 200, p95: 400, p99: 500, min: 100, max: 600, mean: 250 },
        cost: { total: 0.004, average: 0.001, min: 0.0008, max: 0.0012 },
        tokens: { avgInput: 100, avgOutput: 50, totalInput: 400, totalOutput: 200 },
      },
      medium: {
        queryCount: 3,
        successCount: 3,
        classificationAccuracy: 1,
        intentAccuracy: 1,
        ttft: { p50: 500, p95: 1000, p99: 1200, min: 300, max: 1500, mean: 600 },
        latency: { p50: 800, p95: 1600, p99: 2000, min: 500, max: 2500, mean: 950 },
        cost: { total: 0.003, average: 0.001, min: 0.0008, max: 0.0012 },
        tokens: { avgInput: 200, avgOutput: 100, totalInput: 600, totalOutput: 300 },
      },
      complex: {
        queryCount: 3,
        successCount: 3,
        classificationAccuracy: 1,
        intentAccuracy: 1,
        ttft: { p50: 2000, p95: 4000, p99: 5000, min: 1000, max: 6000, mean: 2500 },
        latency: { p50: 3000, p95: 6000, p99: 8000, min: 2000, max: 10000, mean: 4000 },
        cost: { total: 0.006, average: 0.002, min: 0.0015, max: 0.0025 },
        tokens: { avgInput: 500, avgOutput: 200, totalInput: 1500, totalOutput: 600 },
      },
    },
    targetComparisons: [],
    failures: [],
    totalCostUsd: 0.013,
    totalDurationMs: 30000,
    ...overrides,
  })

  it('should detect improvements', () => {
    const baseline = createReport({})
    const current = createReport({})

    // Improve TTFT by 50%
    current.byTier.simple.ttft.p95 = 100 // was 200

    const comparison = compareReports(baseline, current)

    expect(comparison.improved.length).toBeGreaterThan(0)
    expect(comparison.improved.some((i) => i.includes('TTFT'))).toBe(true)
    expect(comparison.summary).toContain('IMPROVED')
  })

  it('should detect regressions', () => {
    const baseline = createReport({})
    const current = createReport({})

    // Regress TTFT by 100% (exceeds 20% threshold)
    current.byTier.simple.ttft.p95 = 500 // was 200

    const comparison = compareReports(baseline, current)

    expect(comparison.regressed.length).toBeGreaterThan(0)
    expect(comparison.regressed.some((r) => r.includes('TTFT'))).toBe(true)
    expect(comparison.summary).toContain('REGRESSION')
  })

  it('should mark no changes when metrics are similar', () => {
    const baseline = createReport({})
    const current = createReport({})

    // Only small change (< 10% improvement, < 20% regression)
    current.byTier.simple.ttft.p95 = 195 // was 200, only 2.5% improvement

    const comparison = compareReports(baseline, current)

    expect(comparison.unchanged.length).toBeGreaterThan(0)
  })

  it('should use correct regression threshold', () => {
    const baseline = createReport({})
    const current = createReport({})

    // 15% regression - below 20% threshold
    current.byTier.simple.ttft.p95 = 230 // was 200

    const comparison = compareReports(baseline, current, 0.2)

    expect(comparison.regressed).not.toContainEqual(
      expect.stringContaining('simple TTFT')
    )
  })

  it('should use 50% threshold for cost regressions', () => {
    const baseline = createReport({})
    const current = createReport({})

    // 40% cost increase - below 50% threshold
    current.byTier.simple.cost.average = 0.0014 // was 0.001

    const comparison = compareReports(baseline, current)

    // Should not be marked as regression
    expect(
      comparison.regressed.some((r) => r.includes('simple Cost'))
    ).toBe(false)
  })
})

describe('generateComparisonMarkdown', () => {
  it('should generate comparison markdown', () => {
    const comparison = {
      improved: ['simple TTFT: 200ms → 100ms (-50%)'],
      regressed: ['medium Cost: $0.001 → $0.002 (+100%)'],
      unchanged: ['complex TTFT', 'complex Cost'],
      summary: '✅ IMPROVED: 1 metrics improved',
    }

    const baseline = {
      runId: 'baseline-run',
      timestamp: '2024-01-01T00:00:00Z',
    } as BenchmarkReport

    const current = {
      runId: 'current-run',
      timestamp: '2024-01-02T00:00:00Z',
    } as BenchmarkReport

    const markdown = generateComparisonMarkdown(comparison, baseline, current)

    expect(markdown).toContain('# Benchmark Comparison')
    expect(markdown).toContain('**Baseline:** baseline-run')
    expect(markdown).toContain('**Current:** current-run')
    expect(markdown).toContain('### Improvements')
    expect(markdown).toContain('### Regressions')
    expect(markdown).toContain('simple TTFT')
    expect(markdown).toContain('medium Cost')
  })
})
