/**
 * Tool Result Isolation Unit Tests
 *
 * Story: E11.1 - Tool Result Isolation
 * Tests for the tool result isolation module that implements the "Isolate" strategy
 * from LangChain's Context Engineering research.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createToolResultCache,
  cacheToolResult,
  getToolResult,
  getToolResultAsync,
  clearExpiredEntries,
  getCacheStats,
  isolateToolResult,
  summarizeForLLM,
  createMetricsTracker,
  createIsolatedTool,
  isolateAllTools,
  DEFAULT_ISOLATION_CONFIG,
  type ToolResultCache,
  type ToolResultCacheEntry,
  type IsolationConfig,
} from '@/lib/agent/tool-isolation'
import type { StructuredToolInterface } from '@langchain/core/tools'

// ============================================================================
// Test Helpers
// ============================================================================

function createTestEntry(
  toolCallId: string,
  overrides: Partial<ToolResultCacheEntry> = {}
): ToolResultCacheEntry {
  return {
    tool: 'test_tool',
    toolCallId,
    fullResult: { success: true, data: { items: [1, 2, 3] } },
    summary: '[test_tool] OK. Data: items',
    fullTokens: 100,
    summaryTokens: 10,
    timestamp: new Date(),
    ...overrides,
  }
}

/**
 * Create a mock tool for testing isolation wrapper
 */
function createMockTool(
  name: string,
  returnValue: unknown
): StructuredToolInterface {
  return {
    name,
    description: `Mock tool: ${name}`,
    schema: { type: 'object', properties: {} },
    invoke: vi.fn().mockResolvedValue(returnValue),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

// ============================================================================
// Cache Operations Tests
// ============================================================================

describe('Tool Result Cache', () => {
  let cache: ToolResultCache

  beforeEach(() => {
    cache = createToolResultCache()
  })

  describe('createToolResultCache', () => {
    it('should create an empty Map', () => {
      expect(cache).toBeInstanceOf(Map)
      expect(cache.size).toBe(0)
    })
  })

  describe('cacheToolResult', () => {
    it('should store entry in cache', () => {
      const entry = createTestEntry('call_1')
      cacheToolResult(cache, entry)

      expect(cache.size).toBe(1)
      expect(cache.has('call_1')).toBe(true)
    })

    it('should evict oldest entry when at capacity', () => {
      const config: IsolationConfig = { ...DEFAULT_ISOLATION_CONFIG, maxEntries: 2 }

      // Add first entry with older timestamp
      const entry1 = createTestEntry('call_1', {
        timestamp: new Date(Date.now() - 1000),
      })
      cacheToolResult(cache, entry1, config)

      // Add second entry
      const entry2 = createTestEntry('call_2')
      cacheToolResult(cache, entry2, config)

      // Add third entry - should evict call_1 (oldest)
      const entry3 = createTestEntry('call_3')
      cacheToolResult(cache, entry3, config)

      expect(cache.size).toBe(2)
      expect(cache.has('call_1')).toBe(false)
      expect(cache.has('call_2')).toBe(true)
      expect(cache.has('call_3')).toBe(true)
    })
  })

  describe('getToolResult', () => {
    it('should retrieve cached result', () => {
      const entry = createTestEntry('call_1')
      cacheToolResult(cache, entry)

      const result = getToolResult(cache, 'call_1')
      expect(result).toEqual(entry.fullResult)
    })

    it('should return null for non-existent entry', () => {
      const result = getToolResult(cache, 'nonexistent')
      expect(result).toBeNull()
    })

    it('should return null and delete expired entry', () => {
      const config: IsolationConfig = { ...DEFAULT_ISOLATION_CONFIG, ttlMs: 100 }

      // Add entry with old timestamp
      const entry = createTestEntry('call_old', {
        timestamp: new Date(Date.now() - 200),
      })
      cache.set('call_old', entry)

      const result = getToolResult(cache, 'call_old', config)

      expect(result).toBeNull()
      expect(cache.has('call_old')).toBe(false)
    })
  })

  describe('clearExpiredEntries', () => {
    it('should clear only expired entries', () => {
      const config: IsolationConfig = { ...DEFAULT_ISOLATION_CONFIG, ttlMs: 100 }

      // Add expired entry
      const expiredEntry = createTestEntry('call_expired', {
        timestamp: new Date(Date.now() - 200),
      })
      cache.set('call_expired', expiredEntry)

      // Add valid entry
      const validEntry = createTestEntry('call_valid')
      cache.set('call_valid', validEntry)

      const cleared = clearExpiredEntries(cache, config)

      expect(cleared).toBe(1)
      expect(cache.has('call_expired')).toBe(false)
      expect(cache.has('call_valid')).toBe(true)
    })
  })

  describe('getCacheStats', () => {
    it('should aggregate token statistics', () => {
      const entry1 = createTestEntry('call_1', {
        fullTokens: 100,
        summaryTokens: 10,
      })
      const entry2 = createTestEntry('call_2', {
        fullTokens: 200,
        summaryTokens: 20,
      })

      cache.set('call_1', entry1)
      cache.set('call_2', entry2)

      const stats = getCacheStats(cache)

      expect(stats.size).toBe(2)
      expect(stats.totalFullTokens).toBe(300)
      expect(stats.totalSummaryTokens).toBe(30)
      expect(stats.totalSavings).toBe(270)
    })
  })
})

// ============================================================================
// Tool Result Isolation Tests
// ============================================================================

describe('isolateToolResult', () => {
  it('should generate concise summary and cache entry', () => {
    const fullResult = {
      success: true,
      data: {
        findings: [
          {
            content: 'Q3 revenue was $5.2M, representing a 15% increase from Q2',
            confidence: 0.92,
            source: { documentName: 'fin.pdf' },
          },
          {
            content: 'Growth rate of 15% year over year',
            confidence: 0.88,
            source: { documentName: 'fin.pdf' },
          },
        ],
      },
    }

    const { summary, cacheEntry, metrics } = isolateToolResult(
      'query_knowledge_base',
      'call_123',
      fullResult
    )

    // Summary should be concise
    expect(summary).toContain('[query_knowledge_base]')
    expect(summary).toContain('2 finding')
    expect(summary).toContain('fin.pdf')
    expect(summary.length).toBeLessThan(300)

    // Cache entry should contain full result
    expect(cacheEntry.fullResult).toEqual(fullResult)
    expect(cacheEntry.tool).toBe('query_knowledge_base')
    expect(cacheEntry.toolCallId).toBe('call_123')

    // Metrics should show savings
    expect(metrics.fullTokens).toBeGreaterThan(metrics.summaryTokens)
    expect(metrics.savings).toBeGreaterThan(0)
    expect(metrics.savingsPercent).toBeGreaterThan(0)
  })

  it('should handle error results', () => {
    const errorResult = {
      success: false,
      error: 'Database connection failed',
    }

    const { summary } = isolateToolResult(
      'query_knowledge_base',
      'call_err',
      errorResult
    )

    expect(summary).toContain('[query_knowledge_base]')
    expect(summary).toContain('Database connection failed')
  })

  it('should handle empty results', () => {
    const emptyResult = {
      success: true,
      data: {
        findings: [],
      },
    }

    const { summary } = isolateToolResult(
      'query_knowledge_base',
      'call_empty',
      emptyResult
    )

    expect(summary).toContain('[query_knowledge_base]')
    expect(summary).toContain('0 finding')
  })
})

// ============================================================================
// Summarizer Tests
// ============================================================================

describe('summarizeForLLM', () => {
  describe('knowledge tools', () => {
    it('should summarize query_knowledge_base results', () => {
      const result = {
        success: true,
        data: {
          findings: [
            { content: 'Revenue was $5M', confidence: 0.9, source: { documentName: 'q3.pdf' } },
          ],
        },
      }

      const summary = summarizeForLLM('query_knowledge_base', result)

      expect(summary).toContain('[query_knowledge_base]')
      expect(summary).toContain('1 finding')
      expect(summary).toContain('q3.pdf')
    })

    it('should summarize update_knowledge_base results', () => {
      const result = { success: true, data: { id: 'find_123' } }
      const summary = summarizeForLLM('update_knowledge_base', result)

      expect(summary).toContain('[update_knowledge_base]')
      expect(summary).toContain('find_123')
      expect(summary).toContain('success')
    })

    it('should summarize validate_finding results', () => {
      const validResult = { success: true, data: { valid: true } }
      const invalidResult = { success: true, data: { valid: false, conflicts: [1, 2] } }

      expect(summarizeForLLM('validate_finding', validResult)).toContain('Valid')
      expect(summarizeForLLM('validate_finding', invalidResult)).toContain('Invalid')
      expect(summarizeForLLM('validate_finding', invalidResult)).toContain('2 conflicts')
    })
  })

  describe('correction tools', () => {
    it('should summarize correct_finding results', () => {
      const result = { success: true, data: { version: 2 } }
      const summary = summarizeForLLM('correct_finding', result)

      expect(summary).toContain('[correct_finding]')
      expect(summary).toContain('version 2')
    })

    it('should summarize get_finding_source results', () => {
      const result = { success: true, data: { documentName: 'contract.pdf' } }
      const summary = summarizeForLLM('get_finding_source', result)

      expect(summary).toContain('[get_finding_source]')
      expect(summary).toContain('contract.pdf')
    })

    it('should summarize get_correction_history results', () => {
      const result = { success: true, data: { history: [1, 2, 3] } }
      const summary = summarizeForLLM('get_correction_history', result)

      expect(summary).toContain('3 entries')
    })
  })

  describe('intelligence tools', () => {
    it('should summarize detect_contradictions results', () => {
      const result = { success: true, data: { contradictions: [1, 2] } }
      const summary = summarizeForLLM('detect_contradictions', result)

      expect(summary).toContain('[detect_contradictions]')
      expect(summary).toContain('2 contradiction')
    })

    it('should summarize find_gaps results', () => {
      const result = {
        success: true,
        data: {
          gaps: [
            { category: 'financial' },
            { category: 'legal' },
            { category: 'financial' },
          ],
        },
      }
      const summary = summarizeForLLM('find_gaps', result)

      expect(summary).toContain('[find_gaps]')
      expect(summary).toContain('3 gap')
      expect(summary).toContain('financial')
      expect(summary).toContain('legal')
    })
  })

  describe('document tools', () => {
    it('should summarize get_document_info results', () => {
      const result = { success: true, data: { name: 'report.pdf', chunkCount: 25 } }
      const summary = summarizeForLLM('get_document_info', result)

      expect(summary).toContain('[get_document_info]')
      expect(summary).toContain('report.pdf')
      expect(summary).toContain('25 chunks')
    })

    it('should summarize trigger_analysis results', () => {
      const result = { success: true, data: { jobId: 'job_456' } }
      const summary = summarizeForLLM('trigger_analysis', result)

      expect(summary).toContain('[trigger_analysis]')
      expect(summary).toContain('job_456')
      expect(summary).toContain('started')
    })
  })

  describe('workflow tools', () => {
    it('should summarize suggest_questions results', () => {
      const result = { success: true, data: { questions: ['Q1?', 'Q2?', 'Q3?'] } }
      const summary = summarizeForLLM('suggest_questions', result)

      expect(summary).toContain('[suggest]')
      expect(summary).toContain('3 questions')
    })

    it('should summarize add_to_qa results', () => {
      const result = { success: true, data: { id: 'qa_789' } }
      const summary = summarizeForLLM('add_to_qa', result)

      expect(summary).toContain('Q&A')
      expect(summary).toContain('qa_789')
    })

    it('should summarize add_qa_item results', () => {
      const result = { success: true, data: { id: 'qa_item_123' } }
      const summary = summarizeForLLM('add_qa_item', result)

      expect(summary).toContain('Q&A')
      expect(summary).toContain('qa_item_123')
    })
  })

  describe('remaining knowledge tools', () => {
    it('should summarize update_knowledge_graph results', () => {
      const result = { success: true, data: { relationships: [1, 2, 3] } }
      const summary = summarizeForLLM('update_knowledge_graph', result)

      expect(summary).toContain('[update_knowledge_graph]')
      expect(summary).toContain('3 relationship')
    })

    it('should handle update_knowledge_graph with no relationships', () => {
      const result = { success: true, data: {} }
      const summary = summarizeForLLM('update_knowledge_graph', result)

      expect(summary).toContain('[update_knowledge_graph]')
      expect(summary).toContain('0 relationship')
    })
  })

  describe('remaining workflow tools', () => {
    it('should summarize create_irl results', () => {
      const result = { success: true, data: { id: 'irl_123' } }
      const summary = summarizeForLLM('create_irl', result)

      expect(summary).toContain('[create_IRL]')
      expect(summary).toContain('irl_123')
    })

    it('should summarize generate_irl_suggestions results', () => {
      const result = { success: true, data: { suggestions: ['item1', 'item2'] } }
      const summary = summarizeForLLM('generate_irl_suggestions', result)

      expect(summary).toContain('[suggest]')
      expect(summary).toContain('2 IRL items')
    })

    it('should summarize add_to_irl results', () => {
      const result = { success: true, data: { id: 'irl_item_456' } }
      const summary = summarizeForLLM('add_to_irl', result)

      expect(summary).toContain('IRL')
      expect(summary).toContain('irl_item_456')
    })
  })

  describe('edge cases', () => {
    it('should handle string results', () => {
      const summary = summarizeForLLM('unknown_tool', 'Raw string result')

      expect(summary).toContain('[unknown_tool]')
      expect(summary).toContain('OK')
    })

    it('should handle null/undefined results', () => {
      const summary = summarizeForLLM('unknown_tool', null)

      expect(summary).toContain('[unknown_tool]')
      expect(summary).toContain('Failed')
    })

    it('should use generic summarizer for unknown tools', () => {
      const result = { success: true, data: { key1: 'val1', key2: 'val2' } }
      const summary = summarizeForLLM('custom_tool', result)

      expect(summary).toContain('[custom_tool]')
      expect(summary).toContain('OK')
      expect(summary).toContain('key1')
    })
  })
})

// ============================================================================
// Tool Wrapper Tests (Issue 1 Fix)
// ============================================================================

describe('createIsolatedTool', () => {
  let cache: ToolResultCache

  beforeEach(() => {
    cache = createToolResultCache()
  })

  it('should wrap tool to return summary instead of full result', async () => {
    const fullResult = { success: true, data: { items: [1, 2, 3] } }
    const mockTool = createMockTool('test_tool', fullResult)

    const isolated = createIsolatedTool(mockTool, cache)
    const result = await isolated.invoke({ query: 'test' })

    // Result should be a summary string, not the full result
    expect(typeof result).toBe('string')
    expect(result).toContain('[test_tool]')
    expect(result).toContain('OK')
  })

  it('should cache full result after invocation', async () => {
    const fullResult = { success: true, data: { findings: [{ content: 'test' }] } }
    const mockTool = createMockTool('query_knowledge_base', fullResult)

    const isolated = createIsolatedTool(mockTool, cache)
    await isolated.invoke({ query: 'test' }, { tool_call_id: 'call_abc' } as Record<string, unknown>)

    // Full result should be in cache
    const cached = getToolResult(cache, 'call_abc')
    expect(cached).toEqual(fullResult)
  })

  it('should preserve tool metadata (name, description, schema)', () => {
    const mockTool = createMockTool('my_tool', { success: true })
    mockTool.description = 'My custom description'

    const isolated = createIsolatedTool(mockTool, cache)

    expect(isolated.name).toBe('my_tool')
    expect(isolated.description).toBe('My custom description')
  })

  it('should generate tool call ID when not provided', async () => {
    const mockTool = createMockTool('test_tool', { success: true, data: {} })

    const isolated = createIsolatedTool(mockTool, cache)
    await isolated.invoke({ query: 'test' }) // No tool_call_id in options

    // Cache should have an entry with auto-generated ID
    expect(cache.size).toBe(1)
    const [cachedId] = [...cache.keys()]
    expect(cachedId).toMatch(/^call_\d+_[a-z0-9]+$/)
  })

  it('should call original tool with correct arguments', async () => {
    const mockTool = createMockTool('test_tool', { success: true })

    const isolated = createIsolatedTool(mockTool, cache)
    await isolated.invoke({ query: 'my query' }, { tool_call_id: 'call_123' } as Record<string, unknown>)

    expect(mockTool.invoke).toHaveBeenCalledWith(
      { query: 'my query' },
      { tool_call_id: 'call_123' } as Record<string, unknown>
    )
  })

  it('should handle tool errors gracefully', async () => {
    const mockTool = createMockTool('failing_tool', null)
    ;(mockTool.invoke as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Tool failed'))

    const isolated = createIsolatedTool(mockTool, cache)

    await expect(isolated.invoke({ query: 'test' })).rejects.toThrow('Tool failed')
    // Cache should remain empty on error
    expect(cache.size).toBe(0)
  })
})

describe('isolateAllTools', () => {
  it('should wrap all tools in array', async () => {
    const cache = createToolResultCache()
    const tool1 = createMockTool('tool_1', { success: true, data: { a: 1 } })
    const tool2 = createMockTool('tool_2', { success: true, data: { b: 2 } })

    const isolated = isolateAllTools([tool1, tool2], cache)

    expect(isolated).toHaveLength(2)
    expect(isolated[0]!.name).toBe('tool_1')
    expect(isolated[1]!.name).toBe('tool_2')

    // Both should return summaries
    const result1 = await isolated[0]!.invoke({})
    const result2 = await isolated[1]!.invoke({})

    expect(typeof result1).toBe('string')
    expect(typeof result2).toBe('string')
  })

  it('should share cache across all wrapped tools', async () => {
    const cache = createToolResultCache()
    const tool1 = createMockTool('tool_1', { success: true })
    const tool2 = createMockTool('tool_2', { success: true })

    const isolated = isolateAllTools([tool1, tool2], cache)

    await isolated[0]!.invoke({}, { tool_call_id: 'call_1' } as Record<string, unknown>)
    await isolated[1]!.invoke({}, { tool_call_id: 'call_2' } as Record<string, unknown>)

    // Both results should be in the same cache
    expect(cache.size).toBe(2)
    expect(cache.has('call_1')).toBe(true)
    expect(cache.has('call_2')).toBe(true)
  })
})

// ============================================================================
// Metrics Tracker Tests
// ============================================================================

describe('IsolationMetricsTracker', () => {
  it('should aggregate metrics from multiple tool calls', () => {
    const tracker = createMetricsTracker('test_turn')

    tracker.add({
      toolCallId: 'call_1',
      tool: 'query_knowledge_base',
      fullTokens: 100,
      summaryTokens: 10,
      savings: 90,
      savingsPercent: 90,
    })

    tracker.add({
      toolCallId: 'call_2',
      tool: 'detect_contradictions',
      fullTokens: 200,
      summaryTokens: 20,
      savings: 180,
      savingsPercent: 90,
    })

    const agg = tracker.aggregate()

    expect(agg.turnId).toBe('test_turn')
    expect(agg.toolCalls).toBe(2)
    expect(agg.totalFullTokens).toBe(300)
    expect(agg.totalSummaryTokens).toBe(30)
    expect(agg.totalSavings).toBe(270)
    expect(agg.savingsPercent).toBe(90)
  })

  it('should generate X-Token-Savings header', () => {
    const tracker = createMetricsTracker()

    tracker.add({
      toolCallId: 'call_1',
      tool: 'test',
      fullTokens: 100,
      summaryTokens: 20,
      savings: 80,
      savingsPercent: 80,
    })

    const header = tracker.getTokenSavingsHeader()

    expect(header).toContain('saved=80')
    expect(header).toContain('calls=1')
    expect(header).toContain('percent=80.0')
  })

  it('should reset tracker for new turn', () => {
    const tracker = createMetricsTracker('turn_1')

    tracker.add({
      toolCallId: 'call_1',
      tool: 'test',
      fullTokens: 100,
      summaryTokens: 10,
      savings: 90,
      savingsPercent: 90,
    })

    tracker.reset('turn_2')

    const agg = tracker.aggregate()
    expect(agg.turnId).toBe('turn_2')
    expect(agg.toolCalls).toBe(0)
    expect(agg.totalFullTokens).toBe(0)
  })

  it('should handle empty metrics', () => {
    const tracker = createMetricsTracker()
    const agg = tracker.aggregate()

    expect(agg.toolCalls).toBe(0)
    expect(agg.totalSavings).toBe(0)
    expect(agg.savingsPercent).toBe(0)
  })
})

// ============================================================================
// getToolResultAsync Tests (E13.8 - Redis Cross-Instance Lookup)
// ============================================================================

describe('getToolResultAsync', () => {
  let cache: ToolResultCache

  beforeEach(() => {
    cache = createToolResultCache()
  })

  it('should return result from local cache if present', async () => {
    const entry = createTestEntry('call_local')
    cacheToolResult(cache, entry)

    const result = await getToolResultAsync(cache, 'call_local')

    expect(result).toEqual(entry.fullResult)
  })

  it('should return null for missing key when no Redis', async () => {
    // Without Redis configured, should check local then return null
    const result = await getToolResultAsync(cache, 'non-existent-id')

    expect(result).toBeNull()
  })

  it('should check local cache before Redis', async () => {
    // Store entry only in local cache
    const entry = createTestEntry('call_priority')
    cacheToolResult(cache, entry)

    // getToolResultAsync should find it in local cache first
    const result = await getToolResultAsync(cache, 'call_priority')

    expect(result).toEqual(entry.fullResult)
  })

  it('should handle TTL expiry in local cache', async () => {
    // Directly set an expired entry in the local Map (bypassing cacheToolResult
    // which also writes to Redis with a fresh TTL)
    const entry = createTestEntry('call_expired', {
      timestamp: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago (expired)
    })
    cache.set(entry.toolCallId, entry)

    // Local cache should return null for expired entry
    // Note: getToolResultAsync falls back to Redis if local returns null
    // but without Redis env vars, Redis check also returns null
    const localResult = getToolResult(cache, 'call_expired')
    expect(localResult).toBeNull()
  })
})
