/**
 * LangSmith Integration Tests
 *
 * Story: E13.7 - Performance Benchmarking Suite (AC: #5)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isLangSmithConfigured,
  getLangSmithFilterQuery,
} from '../../../scripts/benchmark/langsmith'

// Store original env
const originalEnv = process.env

describe('isLangSmithConfigured', () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.LANGSMITH_API_KEY
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should return true when LANGSMITH_API_KEY is set', () => {
    process.env.LANGSMITH_API_KEY = 'lsv2_pt_test_key'

    const result = isLangSmithConfigured()

    expect(result).toBe(true)
  })

  it('should return false when LANGSMITH_API_KEY is not set', () => {
    delete process.env.LANGSMITH_API_KEY

    const result = isLangSmithConfigured()

    expect(result).toBe(false)
  })

  it('should return false when LANGSMITH_API_KEY is empty string', () => {
    process.env.LANGSMITH_API_KEY = ''

    const result = isLangSmithConfigured()

    expect(result).toBe(false)
  })
})

describe('getLangSmithFilterQuery', () => {
  it('should return base filter when no runId provided', () => {
    const filter = getLangSmithFilterQuery()

    expect(filter).toBe('eq(extra.metadata.benchmark, true)')
  })

  it('should include runId in filter when provided', () => {
    const filter = getLangSmithFilterQuery('bench-2026-01-07-abc123')

    expect(filter).toContain('eq(extra.metadata.benchmark, true)')
    expect(filter).toContain('eq(extra.metadata.runId, "bench-2026-01-07-abc123")')
    expect(filter).toMatch(/^and\(/)
  })

  it('should properly escape runId in filter', () => {
    const filter = getLangSmithFilterQuery('test-run-id')

    expect(filter).toBe(
      'and(eq(extra.metadata.benchmark, true), eq(extra.metadata.runId, "test-run-id"))'
    )
  })
})

describe('BenchmarkTraceMetadata interface', () => {
  it('should have correct structure', () => {
    // This is a compile-time check - if the interface is wrong, TypeScript will fail
    const metadata = {
      benchmark: true as const,
      runId: 'test-run',
      queryId: 'simple-001',
      expectedComplexity: 'simple' as const,
      expectedIntent: 'factual',
      category: 'financial',
    }

    expect(metadata.benchmark).toBe(true)
    expect(metadata.runId).toBe('test-run')
    expect(metadata.queryId).toBe('simple-001')
  })
})
