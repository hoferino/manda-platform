/**
 * CIM MVP Query Generator Tests
 *
 * Tests for dynamic query generation based on graph schema.
 * Story: E14-S4 Dynamic CIM Query Generator
 *
 * Note: Full integration tests with LLM require RUN_INTEGRATION_TESTS=true
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchGraphSchema,
  getQueryForSection,
  getSectionDescription,
  invalidateQueryCache,
  invalidateSchemaCache,
  SECTION_DESCRIPTIONS,
  type GraphSchema,
} from '@/lib/agent/cim-mvp/query-generator'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Sample schema for tests
const mockSchema: GraphSchema = {
  entity_types: ['Company', 'Financial_Metric', 'Market_Segment', 'Executive', 'Product'],
  relationship_types: ['HAS_METRIC', 'OPERATES_IN', 'LED_BY', 'OFFERS'],
  entity_counts: {
    Company: 1,
    Financial_Metric: 50,
    Market_Segment: 5,
    Executive: 8,
    Product: 12,
  },
  total_entities: 76,
  total_relationships: 150,
}

describe('Query Generator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear caches before each test
    invalidateQueryCache()
    invalidateSchemaCache()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('fetchGraphSchema', () => {
    it('should return null for empty projectId', async () => {
      const result = await fetchGraphSchema('')
      expect(result).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should return null for whitespace-only projectId', async () => {
      const result = await fetchGraphSchema('   ')
      expect(result).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should fetch schema from backend', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSchema),
      })

      const result = await fetchGraphSchema('project-123')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search/schema/project-123'),
        expect.objectContaining({
          method: 'GET',
        })
      )
      expect(result).toEqual(mockSchema)
    })

    it('should return null on fetch failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      const result = await fetchGraphSchema('project-123')
      expect(result).toBeNull()
    })

    it('should return null for schema with no entity types', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            entity_types: [],
            relationship_types: [],
            entity_counts: {},
          }),
      })

      const result = await fetchGraphSchema('project-123')
      expect(result).toBeNull()
    })

    it('should cache schema and return cached on second call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSchema),
      })

      // First call - should fetch
      const result1 = await fetchGraphSchema('project-schema-cache')
      expect(result1).toEqual(mockSchema)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Second call - should use cache
      const result2 = await fetchGraphSchema('project-schema-cache')
      expect(result2).toEqual(mockSchema)
      expect(mockFetch).toHaveBeenCalledTimes(1) // Still only 1 call
    })

    it('should invalidate schema cache', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSchema),
      })

      // First call
      await fetchGraphSchema('project-invalidate-test')
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Invalidate cache
      invalidateSchemaCache('project-invalidate-test')

      // Second call should fetch again
      await fetchGraphSchema('project-invalidate-test')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('getSectionDescription', () => {
    it('should return exact match for known sections', () => {
      expect(getSectionDescription('executive_summary')).toBe(
        SECTION_DESCRIPTIONS['executive_summary']
      )
      expect(getSectionDescription('financial_performance')).toBe(
        SECTION_DESCRIPTIONS['financial_performance']
      )
    })

    it('should return subsection description when available', () => {
      expect(getSectionDescription('financial_performance.revenue')).toBe(
        SECTION_DESCRIPTIONS['financial_performance.revenue']
      )
    })

    it('should fall back to parent section for unknown subsections', () => {
      expect(getSectionDescription('financial_performance.unknown_metric')).toBe(
        SECTION_DESCRIPTIONS['financial_performance']
      )
    })

    it('should return generic fallback for unknown sections', () => {
      const result = getSectionDescription('completely_unknown_section')
      expect(result).toContain('Information about')
      expect(result).toContain('completely unknown section')
    })
  })

  describe('getQueryForSection', () => {
    it('should return fallback for empty projectId', async () => {
      const result = await getQueryForSection('', 'executive_summary')

      expect(result.source).toBe('fallback')
      expect(result.query).toBe('executive summary')
    })

    it('should return fallback for whitespace projectId', async () => {
      const result = await getQueryForSection('   ', 'market_opportunity')

      expect(result.source).toBe('fallback')
      expect(result.query).toBe('market opportunity')
    })

    it('should return static query when dynamic queries disabled', async () => {
      const result = await getQueryForSection('project-123', 'executive_summary', {
        useDynamicQueries: false,
        staticFallback: 'static executive summary query',
      })

      expect(result.source).toBe('static')
      expect(result.query).toBe('static executive summary query')
      expect(mockFetch).not.toHaveBeenCalled() // No schema fetch
    })

    it('should use staticFallback when schema fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await getQueryForSection('project-123', 'market_opportunity', {
        staticFallback: 'market opportunity fallback query',
      })

      expect(result.source).toBe('fallback')
      expect(result.query).toBe('market opportunity fallback query')
    })

    it('should use section name as fallback when no staticFallback provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await getQueryForSection('project-123', 'competitive_landscape')

      expect(result.source).toBe('fallback')
      expect(result.query).toBe('competitive landscape')
    })

    it('should include latencyMs in result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await getQueryForSection('project-123', 'executive_summary')

      expect(result.latencyMs).toBeDefined()
      expect(typeof result.latencyMs).toBe('number')
      expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe('invalidateQueryCache', () => {
    it('should not throw when clearing empty cache', () => {
      expect(() => invalidateQueryCache()).not.toThrow()
    })

    it('should not throw when clearing specific project from empty cache', () => {
      expect(() => invalidateQueryCache('non-existent-project')).not.toThrow()
    })
  })

  describe('invalidateSchemaCache', () => {
    it('should not throw when clearing empty cache', () => {
      expect(() => invalidateSchemaCache()).not.toThrow()
    })

    it('should not throw when clearing specific project from empty cache', () => {
      expect(() => invalidateSchemaCache('non-existent-project')).not.toThrow()
    })
  })

  describe('SECTION_DESCRIPTIONS', () => {
    it('should have descriptions for all major CIM sections', () => {
      const requiredSections = [
        'executive_summary',
        'company_overview',
        'management_team',
        'products_services',
        'market_opportunity',
        'business_model',
        'financial_performance',
        'competitive_landscape',
        'growth_strategy',
        'risk_factors',
      ]

      requiredSections.forEach((section) => {
        expect(SECTION_DESCRIPTIONS[section]).toBeTruthy()
        expect(typeof SECTION_DESCRIPTIONS[section]).toBe('string')
      })
    })

    it('should have subsection descriptions for financial_performance', () => {
      expect(SECTION_DESCRIPTIONS['financial_performance.revenue']).toBeTruthy()
      expect(SECTION_DESCRIPTIONS['financial_performance.profitability']).toBeTruthy()
    })

    it('should have subsection descriptions for market_opportunity', () => {
      expect(SECTION_DESCRIPTIONS['market_opportunity.market_size']).toBeTruthy()
      expect(SECTION_DESCRIPTIONS['market_opportunity.growth_drivers']).toBeTruthy()
    })
  })
})
