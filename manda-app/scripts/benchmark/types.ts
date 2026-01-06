/**
 * Benchmark Types
 *
 * TypeScript interfaces for the performance benchmarking suite.
 * Story: E13.7 - Performance Benchmarking Suite
 */

import type { ComplexityLevel, IntentType } from '@/lib/agent/intent'

/**
 * Query category for grouping benchmark queries
 */
export type QueryCategory =
  | 'greeting'
  | 'meta'
  | 'financial'
  | 'operational'
  | 'legal'
  | 'technical'

/**
 * A single benchmark query with expected classification
 */
export interface BenchmarkQuery {
  /** Unique query ID (e.g., "simple-001") */
  id: string
  /** The actual query text */
  query: string
  /** Expected complexity classification */
  expectedComplexity: ComplexityLevel
  /** Expected intent classification */
  expectedIntent: IntentType
  /** Query category for analysis */
  category: QueryCategory
  /** Expected tool count based on complexity tier */
  expectedToolCount?: number
  /** Optional notes about the query */
  notes?: string
}

/**
 * Result of executing a single benchmark query
 */
export interface BenchmarkResult {
  /** Query ID from BenchmarkQuery */
  queryId: string
  /** The query text */
  query: string
  /** Expected complexity from query definition */
  expectedComplexity: ComplexityLevel
  /** Actual complexity classification by system */
  classifiedComplexity: ComplexityLevel
  /** Whether classification matched expected */
  classificationCorrect: boolean
  /** Expected intent from query definition */
  expectedIntent: IntentType
  /** Actual intent classification by system */
  classifiedIntent: IntentType
  /** Whether intent matched expected */
  intentCorrect: boolean
  /** Model used for response */
  model: string
  /** Number of tools loaded for this query */
  toolsLoaded: number
  /** Specialist agent used (if any) */
  specialistUsed?: string
  /** Time to first token in milliseconds */
  ttftMs: number
  /** Total request latency in milliseconds */
  totalLatencyMs: number
  /** Estimated input tokens (chars / 4) */
  inputTokens: number
  /** Estimated output tokens (chars / 4) */
  outputTokens: number
  /** Calculated cost in USD */
  costUsd: number
  /** LangSmith trace ID (if available) */
  traceId?: string
  /** Whether the query succeeded */
  success: boolean
  /** Error message if failed */
  error?: string
}

/**
 * Percentile statistics for a metric
 */
export interface PercentileStats {
  p50: number
  p95: number
  p99: number
  min: number
  max: number
  mean: number
}

/**
 * Aggregated metrics for a complexity tier
 */
export interface TierMetrics {
  /** Number of queries in this tier */
  queryCount: number
  /** Number of successful queries */
  successCount: number
  /** Classification accuracy (0-1) */
  classificationAccuracy: number
  /** Intent classification accuracy (0-1) */
  intentAccuracy: number
  /** TTFT percentile statistics */
  ttft: PercentileStats
  /** Total latency percentile statistics */
  latency: PercentileStats
  /** Cost statistics */
  cost: {
    total: number
    average: number
    min: number
    max: number
  }
  /** Token statistics */
  tokens: {
    avgInput: number
    avgOutput: number
    totalInput: number
    totalOutput: number
  }
}

/**
 * Target comparison result for a single metric
 */
export interface TargetComparison {
  tier: ComplexityLevel
  metric: string
  target: number
  actual: number
  passed: boolean
  /** Percentage difference from target */
  percentDiff: number
}

/**
 * Complete benchmark report
 */
export interface BenchmarkReport {
  /** Unique run identifier */
  runId: string
  /** ISO timestamp of the run */
  timestamp: string
  /** Environment (dev, staging, production) */
  environment: string
  /** Total number of queries executed */
  totalQueries: number
  /** Number of successful queries */
  successCount: number
  /** Number of failed queries */
  failureCount: number
  /** Overall classification accuracy */
  overallClassificationAccuracy: number
  /** Overall intent accuracy */
  overallIntentAccuracy: number
  /** Metrics broken down by tier */
  byTier: Record<ComplexityLevel, TierMetrics>
  /** Target comparisons */
  targetComparisons: TargetComparison[]
  /** List of failed queries */
  failures: BenchmarkResult[]
  /** Total cost of the benchmark run */
  totalCostUsd: number
  /** Total duration in milliseconds */
  totalDurationMs: number
}

/**
 * Configuration for benchmark runner
 */
export interface BenchmarkConfig {
  /** Base URL for the API */
  apiUrl: string
  /** Deal ID to use for queries */
  dealId: string
  /** Conversation ID (optional, created if not provided) */
  conversationId?: string
  /** Number of concurrent queries */
  concurrency: number
  /** Delay between batches in ms */
  batchDelayMs: number
  /** Whether to run in dry-run mode (classification only) */
  dryRun: boolean
  /** Tiers to benchmark (empty = all) */
  tiers: ComplexityLevel[]
  /** Number of warm-up queries before measurement */
  warmUpQueries: number
  /** Environment name for report */
  environment: string
}

/**
 * Target metrics for each complexity tier
 * From E13 Epic specifications
 */
export const TARGET_METRICS = {
  simple: {
    ttftP95Ms: 500,
    costUsd: 0.0001,
    inputTokens: 2000,
  },
  medium: {
    ttftP95Ms: 3000,
    costUsd: 0.001,
    inputTokens: 4000,
  },
  complex: {
    ttftP95Ms: 15000,
    costUsd: 0.01,
    inputTokens: 10000,
  },
} as const

/**
 * Baseline metrics from pre-E13 LangSmith traces (2026-01-06)
 */
export const BASELINE_METRICS = {
  ttftP95Ms: 19400,
  inputTokens: 8577,
  costUsd: 0.001,
} as const

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Omit<BenchmarkConfig, 'apiUrl' | 'dealId'> = {
  concurrency: 3,
  batchDelayMs: 100,
  dryRun: false,
  tiers: [],
  warmUpQueries: 0,
  environment: 'dev',
}
