/**
 * Benchmark Report Generator
 *
 * Generates JSON and Markdown reports from benchmark results.
 * Story: E13.7 - Performance Benchmarking Suite (AC: #4)
 */

import {
  calculateTierMetrics,
  groupByTier,
  compareToTargets,
  formatDuration,
  formatCost,
  formatPercent,
} from './metrics'
import type {
  BenchmarkResult,
  BenchmarkReport,
  TierMetrics,
  TargetComparison,
} from './types'
import { TARGET_METRICS } from './types'
import type { ComplexityLevel } from '@/lib/agent/intent'

/**
 * Generate a complete benchmark report from results
 */
export function generateReport(
  results: BenchmarkResult[],
  runId: string,
  environment: string,
  totalDurationMs: number
): BenchmarkReport {
  const grouped = groupByTier(results)

  const byTier: Record<ComplexityLevel, TierMetrics> = {
    simple: calculateTierMetrics(grouped.simple),
    medium: calculateTierMetrics(grouped.medium),
    complex: calculateTierMetrics(grouped.complex),
  }

  // Calculate target comparisons for each tier
  const targetComparisons: TargetComparison[] = []
  for (const tier of ['simple', 'medium', 'complex'] as ComplexityLevel[]) {
    const comparisons = compareToTargets(tier, byTier[tier], TARGET_METRICS)
    targetComparisons.push(...comparisons)
  }

  // Calculate overall metrics
  const totalSuccessful = results.filter((r) => r.success).length
  const totalClassificationCorrect = results.filter(
    (r) => r.classificationCorrect
  ).length
  const totalIntentCorrect = results.filter((r) => r.intentCorrect).length
  const totalCost = results.reduce((sum, r) => sum + r.costUsd, 0)

  return {
    runId,
    timestamp: new Date().toISOString(),
    environment,
    totalQueries: results.length,
    successCount: totalSuccessful,
    failureCount: results.length - totalSuccessful,
    overallClassificationAccuracy:
      results.length > 0 ? totalClassificationCorrect / results.length : 0,
    overallIntentAccuracy:
      results.length > 0 ? totalIntentCorrect / results.length : 0,
    byTier,
    targetComparisons,
    failures: results.filter((r) => !r.success),
    totalCostUsd: totalCost,
    totalDurationMs,
  }
}

/**
 * Generate ASCII histogram for TTFT distribution
 */
function generateHistogram(values: number[], maxWidth: number = 30): string {
  if (values.length === 0) return 'No data'

  // Define buckets
  const buckets = [
    { label: '<100ms', max: 100 },
    { label: '<500ms', max: 500 },
    { label: '<1s', max: 1000 },
    { label: '<3s', max: 3000 },
    { label: '<10s', max: 10000 },
    { label: '>10s', max: Infinity },
  ]

  // Count values in each bucket
  const counts = buckets.map((bucket) => ({
    ...bucket,
    count: values.filter(
      (v) =>
        v <= bucket.max &&
        v > (buckets[buckets.indexOf(bucket) - 1]?.max ?? 0)
    ).length,
  }))

  const maxCount = Math.max(...counts.map((b) => b.count))

  // Generate bars
  const lines = counts.map((bucket) => {
    const barLength =
      maxCount > 0 ? Math.round((bucket.count / maxCount) * maxWidth) : 0
    const bar = '█'.repeat(barLength)
    const percent = ((bucket.count / values.length) * 100).toFixed(0)
    return `${bucket.label.padEnd(8)} ${bar.padEnd(maxWidth)} ${percent}%`
  })

  return lines.join('\n')
}

/**
 * Generate Markdown report
 */
export function generateMarkdownReport(report: BenchmarkReport): string {
  const lines: string[] = []

  // Header
  lines.push(`# Benchmark Report`)
  lines.push(``)
  lines.push(`**Run ID:** ${report.runId}`)
  lines.push(`**Timestamp:** ${report.timestamp}`)
  lines.push(`**Environment:** ${report.environment}`)
  lines.push(`**Duration:** ${formatDuration(report.totalDurationMs)}`)
  lines.push(`**Total Cost:** ${formatCost(report.totalCostUsd)}`)
  lines.push(``)

  // Summary
  lines.push(`## Summary`)
  lines.push(``)
  lines.push(`| Metric | Value |`)
  lines.push(`|--------|-------|`)
  lines.push(`| Total Queries | ${report.totalQueries} |`)
  lines.push(`| Successful | ${report.successCount} |`)
  lines.push(`| Failed | ${report.failureCount} |`)
  lines.push(
    `| Classification Accuracy | ${formatPercent(report.overallClassificationAccuracy)} |`
  )
  lines.push(
    `| Intent Accuracy | ${formatPercent(report.overallIntentAccuracy)} |`
  )
  lines.push(``)

  // Per-tier breakdown
  lines.push(`## Results by Tier`)
  lines.push(``)

  for (const tier of ['simple', 'medium', 'complex'] as ComplexityLevel[]) {
    const metrics = report.byTier[tier]
    const comparisons = report.targetComparisons.filter((c) => c.tier === tier)

    lines.push(`### ${tier.charAt(0).toUpperCase() + tier.slice(1)} Tier`)
    lines.push(``)
    lines.push(`| Metric | Value | Target | Status |`)
    lines.push(`|--------|-------|--------|--------|`)

    // TTFT
    const ttftComp = comparisons.find((c) => c.metric === 'ttftP95Ms')
    lines.push(
      `| TTFT P95 | ${formatDuration(metrics.ttft.p95)} | ${formatDuration(ttftComp?.target ?? 0)} | ${ttftComp?.passed ? '✅' : '❌'} |`
    )

    // Cost
    const costComp = comparisons.find((c) => c.metric === 'costUsd')
    lines.push(
      `| Avg Cost | ${formatCost(metrics.cost.average)} | ${formatCost(costComp?.target ?? 0)} | ${costComp?.passed ? '✅' : '❌'} |`
    )

    // Tokens
    const tokenComp = comparisons.find((c) => c.metric === 'inputTokens')
    lines.push(
      `| Avg Input Tokens | ${Math.round(metrics.tokens.avgInput)} | ${tokenComp?.target ?? 0} | ${tokenComp?.passed ? '✅' : '❌'} |`
    )

    lines.push(``)

    // Additional metrics
    lines.push(`**Additional Metrics:**`)
    lines.push(`- Query Count: ${metrics.queryCount}`)
    lines.push(`- Success Rate: ${formatPercent(metrics.successCount / Math.max(metrics.queryCount, 1))}`)
    lines.push(
      `- Classification Accuracy: ${formatPercent(metrics.classificationAccuracy)}`
    )
    lines.push(`- TTFT P50: ${formatDuration(metrics.ttft.p50)}`)
    lines.push(`- TTFT P99: ${formatDuration(metrics.ttft.p99)}`)
    lines.push(`- Latency P95: ${formatDuration(metrics.latency.p95)}`)
    lines.push(``)
  }

  // Target comparison summary
  lines.push(`## Target Comparison`)
  lines.push(``)

  const passed = report.targetComparisons.filter((c) => c.passed).length
  const total = report.targetComparisons.length
  const passRate = total > 0 ? (passed / total) * 100 : 0

  lines.push(`**Overall:** ${passed}/${total} targets met (${passRate.toFixed(0)}%)`)
  lines.push(``)

  // Failed targets
  const failedTargets = report.targetComparisons.filter((c) => !c.passed)
  if (failedTargets.length > 0) {
    lines.push(`### Failed Targets`)
    lines.push(``)
    lines.push(`| Tier | Metric | Target | Actual | Diff |`)
    lines.push(`|------|--------|--------|--------|------|`)

    for (const target of failedTargets) {
      const actualFormatted =
        target.metric === 'ttftP95Ms'
          ? formatDuration(target.actual)
          : target.metric === 'costUsd'
            ? formatCost(target.actual)
            : Math.round(target.actual).toString()

      const targetFormatted =
        target.metric === 'ttftP95Ms'
          ? formatDuration(target.target)
          : target.metric === 'costUsd'
            ? formatCost(target.target)
            : target.target.toString()

      lines.push(
        `| ${target.tier} | ${target.metric} | ${targetFormatted} | ${actualFormatted} | +${target.percentDiff.toFixed(0)}% |`
      )
    }
    lines.push(``)
  }

  // Failures section
  if (report.failures.length > 0) {
    lines.push(`## Failed Queries`)
    lines.push(``)
    lines.push(`| Query ID | Error |`)
    lines.push(`|----------|-------|`)

    for (const failure of report.failures.slice(0, 10)) {
      const error = failure.error?.substring(0, 50) ?? 'Unknown error'
      lines.push(`| ${failure.queryId} | ${error}... |`)
    }

    if (report.failures.length > 10) {
      lines.push(`| ... | (${report.failures.length - 10} more) |`)
    }
    lines.push(``)
  }

  // Footer
  lines.push(`---`)
  lines.push(`*Generated by Manda Benchmark Suite*`)

  return lines.join('\n')
}

/**
 * Compare two reports (baseline vs current)
 */
export interface ReportComparison {
  improved: string[]
  regressed: string[]
  unchanged: string[]
  summary: string
}

export function compareReports(
  baseline: BenchmarkReport,
  current: BenchmarkReport,
  regressionThreshold: number = 0.2
): ReportComparison {
  const improved: string[] = []
  const regressed: string[] = []
  const unchanged: string[] = []

  for (const tier of ['simple', 'medium', 'complex'] as ComplexityLevel[]) {
    const baselineMetrics = baseline.byTier[tier]
    const currentMetrics = current.byTier[tier]

    // TTFT comparison
    const ttftDiff =
      (currentMetrics.ttft.p95 - baselineMetrics.ttft.p95) /
      Math.max(baselineMetrics.ttft.p95, 1)
    if (ttftDiff < -0.1) {
      improved.push(
        `${tier} TTFT P95: ${formatDuration(baselineMetrics.ttft.p95)} → ${formatDuration(currentMetrics.ttft.p95)} (${(ttftDiff * 100).toFixed(0)}%)`
      )
    } else if (ttftDiff > regressionThreshold) {
      regressed.push(
        `${tier} TTFT P95: ${formatDuration(baselineMetrics.ttft.p95)} → ${formatDuration(currentMetrics.ttft.p95)} (+${(ttftDiff * 100).toFixed(0)}%)`
      )
    } else {
      unchanged.push(`${tier} TTFT P95`)
    }

    // Cost comparison
    const costDiff =
      (currentMetrics.cost.average - baselineMetrics.cost.average) /
      Math.max(baselineMetrics.cost.average, 0.000001)
    if (costDiff < -0.1) {
      improved.push(
        `${tier} Cost: ${formatCost(baselineMetrics.cost.average)} → ${formatCost(currentMetrics.cost.average)} (${(costDiff * 100).toFixed(0)}%)`
      )
    } else if (costDiff > regressionThreshold * 2.5) {
      // 50% threshold for cost
      regressed.push(
        `${tier} Cost: ${formatCost(baselineMetrics.cost.average)} → ${formatCost(currentMetrics.cost.average)} (+${(costDiff * 100).toFixed(0)}%)`
      )
    } else {
      unchanged.push(`${tier} Cost`)
    }
  }

  const summary = regressed.length > 0
    ? `❌ REGRESSION DETECTED: ${regressed.length} metrics regressed`
    : improved.length > 0
      ? `✅ IMPROVED: ${improved.length} metrics improved`
      : `➖ No significant changes`

  return { improved, regressed, unchanged, summary }
}

/**
 * Generate comparison report as Markdown
 */
export function generateComparisonMarkdown(
  comparison: ReportComparison,
  baseline: BenchmarkReport,
  current: BenchmarkReport
): string {
  const lines: string[] = []

  lines.push(`# Benchmark Comparison`)
  lines.push(``)
  lines.push(`**Baseline:** ${baseline.runId} (${baseline.timestamp})`)
  lines.push(`**Current:** ${current.runId} (${current.timestamp})`)
  lines.push(``)
  lines.push(`## Summary`)
  lines.push(``)
  lines.push(comparison.summary)
  lines.push(``)

  if (comparison.improved.length > 0) {
    lines.push(`### Improvements ✅`)
    lines.push(``)
    for (const item of comparison.improved) {
      lines.push(`- ${item}`)
    }
    lines.push(``)
  }

  if (comparison.regressed.length > 0) {
    lines.push(`### Regressions ❌`)
    lines.push(``)
    for (const item of comparison.regressed) {
      lines.push(`- ${item}`)
    }
    lines.push(``)
  }

  if (comparison.unchanged.length > 0) {
    lines.push(`### Unchanged`)
    lines.push(``)
    lines.push(`${comparison.unchanged.join(', ')}`)
    lines.push(``)
  }

  return lines.join('\n')
}
