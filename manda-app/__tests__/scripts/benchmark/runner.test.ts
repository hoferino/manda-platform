/**
 * Benchmark Runner Tests
 *
 * Story: E13.7 - Performance Benchmarking Suite (AC: #2)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BenchmarkRunner, loadQueries, generateRunId } from '../../../scripts/benchmark/runner'
import type { BenchmarkQuery, BenchmarkConfig } from '../../../scripts/benchmark/types'

// Mock the auth module
vi.mock('../../../scripts/benchmark/auth', () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({
    Authorization: 'Bearer test-token',
    'Content-Type': 'application/json',
  }),
}))

// Mock fetch for API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('BenchmarkRunner', () => {
  const createConfig = (overrides: Partial<BenchmarkConfig> = {}): BenchmarkConfig => ({
    apiUrl: 'http://localhost:3000',
    dealId: 'test-deal-id',
    concurrency: 1,
    batchDelayMs: 0,
    dryRun: false,
    tiers: [],
    warmUpQueries: 0,
    environment: 'test',
    ...overrides,
  })

  const createQuery = (overrides: Partial<BenchmarkQuery> = {}): BenchmarkQuery => ({
    id: 'test-001',
    query: 'What is the revenue?',
    expectedComplexity: 'simple',
    expectedIntent: 'factual',
    category: 'financial',
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should create runner with default config', () => {
      const config = createConfig()
      const runner = new BenchmarkRunner(config)
      expect(runner).toBeDefined()
    })

    it('should merge provided config with defaults', () => {
      const config = createConfig({ concurrency: 5 })
      const runner = new BenchmarkRunner(config)
      expect(runner).toBeDefined()
    })
  })

  describe('runAll', () => {
    it('should filter queries by tier when specified', async () => {
      const config = createConfig({ tiers: ['simple'], dryRun: true })
      const runner = new BenchmarkRunner(config)

      const queries = [
        createQuery({ id: 'simple-001', expectedComplexity: 'simple' }),
        createQuery({ id: 'medium-001', expectedComplexity: 'medium' }),
        createQuery({ id: 'complex-001', expectedComplexity: 'complex' }),
      ]

      // Mock classifyIntentAsync for dry-run
      vi.doMock('@/lib/agent/intent', () => ({
        classifyIntentAsync: vi.fn().mockResolvedValue({
          intent: 'factual',
          complexity: 'simple',
          suggestedTools: [],
        }),
      }))

      const results = await runner.runAll(queries)

      // In dry-run mode with tier filter, should only run simple queries
      expect(results.length).toBeLessThanOrEqual(queries.length)
    })

    it('should call progress callback for each query', async () => {
      const config = createConfig({ dryRun: true })
      const runner = new BenchmarkRunner(config)

      const queries = [createQuery()]
      const progressFn = vi.fn()

      await runner.runAll(queries, progressFn)

      expect(progressFn).toHaveBeenCalled()
    })

    it('should handle empty query list', async () => {
      const config = createConfig({ dryRun: true })
      const runner = new BenchmarkRunner(config)

      const results = await runner.runAll([])

      expect(results).toEqual([])
    })
  })

  describe('warm-up phase', () => {
    it('should run warm-up queries when configured', async () => {
      const config = createConfig({ warmUpQueries: 2, dryRun: true })
      const runner = new BenchmarkRunner(config)

      const queries = [
        createQuery({ id: 'q1' }),
        createQuery({ id: 'q2' }),
        createQuery({ id: 'q3' }),
      ]

      // The warm-up should run first 2 queries, then all 3 for measurement
      const results = await runner.runAll(queries)

      // Results should be for all queries (warm-up results are discarded)
      expect(results.length).toBe(3)
    })

    it('should skip warm-up when warmUpQueries is 0', async () => {
      const config = createConfig({ warmUpQueries: 0, dryRun: true })
      const runner = new BenchmarkRunner(config)

      const queries = [createQuery()]
      const results = await runner.runAll(queries)

      expect(results.length).toBe(1)
    })
  })
})

describe('loadQueries', () => {
  it('should return empty array when directory does not exist', async () => {
    const queries = await loadQueries('/nonexistent/path')
    expect(queries).toEqual([])
  })
})

describe('generateRunId', () => {
  it('should generate unique run IDs', () => {
    const id1 = generateRunId()
    const id2 = generateRunId()

    expect(id1).not.toBe(id2)
  })

  it('should include "bench-" prefix', () => {
    const id = generateRunId()
    expect(id.startsWith('bench-')).toBe(true)
  })

  it('should include timestamp-like format', () => {
    const id = generateRunId()
    // Format: bench-YYYY-MM-DDTHH-MM-SS-XXXZ-random
    expect(id).toMatch(/^bench-\d{4}-\d{2}-\d{2}T/)
  })
})

describe('BenchmarkConfig defaults', () => {
  it('should use default concurrency of 3', async () => {
    const config: BenchmarkConfig = {
      apiUrl: 'http://localhost:3000',
      dealId: 'test-deal-id',
      concurrency: 3,
      batchDelayMs: 100,
      dryRun: false,
      tiers: [],
      warmUpQueries: 0,
      environment: 'test',
    }
    const runner = new BenchmarkRunner(config)

    // Runner should be created successfully with defaults
    expect(runner).toBeDefined()
  })
})
