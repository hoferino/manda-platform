/**
 * Agent System v2.0 - Retrieval Node Tests
 *
 * Story: 3-1 Implement Retrieval Node with Graphiti Integration
 *
 * Tests covering all 5 Acceptance Criteria:
 * - AC #1: Graphiti integration via callGraphitiSearch
 * - AC #2: Search method selection and latency logging
 * - AC #3: Deal namespace isolation via dealId
 * - AC #4: SourceCitation transformation
 * - AC #5: Graph integration and state preservation
 *
 * Run: cd manda-app && npm run test:run -- lib/agent/v2/nodes/__tests__/retrieval.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HumanMessage, AIMessage } from '@langchain/core/messages'
import { createInitialState } from '../../state'
import { retrievalNode, getSearchMethodForComplexity } from '../retrieval'

// Mock the retrieval module
vi.mock('@/lib/agent/retrieval', () => ({
  callGraphitiSearch: vi.fn(),
}))

// Mock the intent module for complexity classification
vi.mock('@/lib/agent/intent', () => ({
  classifyComplexity: vi.fn().mockReturnValue({ complexity: 'simple', confidence: 0.9 }),
}))

// Import after mocking
import { callGraphitiSearch } from '@/lib/agent/retrieval'
import { classifyComplexity } from '@/lib/agent/intent'

/**
 * Mock Graphiti search result with id field.
 *
 * Note: The actual API response includes citation.id which is NOT in the
 * TypeScript types at lib/agent/retrieval.ts:79-87. This interface matches
 * the REAL API response, not the incomplete TypeScript types.
 */
interface MockHybridSearchResult {
  content: string
  score: number
  citation?: {
    type: string
    title?: string
    page?: number
    id?: string // Present in API response but missing from types
  }
}

interface MockHybridSearchResponse {
  results: MockHybridSearchResult[]
  entities: string[]
  latency_ms: number
}

describe('retrievalNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock performance.now for latency tests
    vi.spyOn(performance, 'now').mockReturnValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('query extraction (AC: #1)', () => {
    it('returns empty sources when no query in messages', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const state = createInitialState('chat', 'deal-123')
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }
      // Empty messages array
      state.messages = []

      const result = await retrievalNode(state)

      expect(result.sources).toEqual([])
      expect(callGraphitiSearch).not.toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalledWith(
        '[retrieval] No query in messages, skipping'
      )

      consoleSpy.mockRestore()
    })

    it('extracts query from last user message', async () => {
      const mockResponse: MockHybridSearchResponse = {
        results: [
          {
            content: 'Revenue was $10M in Q3',
            score: 0.95,
            citation: { type: 'document', title: 'Financial Report', page: 5, id: 'doc-123' },
          },
        ],
        entities: ['Revenue'],
        latency_ms: 100,
      }
      vi.mocked(callGraphitiSearch).mockResolvedValue(mockResponse as never)

      const state = createInitialState('chat', 'deal-123')
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }
      state.messages = [
        new HumanMessage('Hello'),
        new AIMessage('Hi there!'),
        new HumanMessage('What was the Q3 revenue?'),
      ]

      await retrievalNode(state)

      // Should call with query, dealId, and search method (based on complexity)
      expect(callGraphitiSearch).toHaveBeenCalledWith(
        'What was the Q3 revenue?',
        'deal-123',
        'vector' // Default mock returns 'simple' complexity → 'vector' method
      )
    })
  })

  describe('deal context handling (AC: #3)', () => {
    it('returns empty sources when no dealContext', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const state = createInitialState('chat')
      state.dealContext = null
      state.messages = [new HumanMessage('What is the revenue?')]

      const result = await retrievalNode(state)

      expect(result.sources).toEqual([])
      expect(callGraphitiSearch).not.toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalledWith(
        '[retrieval] No dealId in state.dealContext, skipping retrieval'
      )

      consoleSpy.mockRestore()
    })

    it('returns empty sources when dealContext.dealId is missing', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const state = createInitialState('chat')
      // Partial dealContext without dealId (edge case)
      state.dealContext = {
        dealId: '',
        dealName: 'Test',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 0,
        createdAt: new Date().toISOString(),
      }
      state.messages = [new HumanMessage('What is the revenue?')]

      const result = await retrievalNode(state)

      expect(result.sources).toEqual([])
      expect(callGraphitiSearch).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('calls Graphiti with correct dealId for namespace isolation', async () => {
      const mockResponse: MockHybridSearchResponse = {
        results: [],
        entities: [],
        latency_ms: 50,
      }
      vi.mocked(callGraphitiSearch).mockResolvedValue(mockResponse as never)

      const state = createInitialState('chat', 'deal-abc-123')
      state.dealContext = {
        dealId: 'deal-abc-123',
        dealName: 'Alpha Acquisition',
        projectId: 'proj-456',
        organizationId: 'org-789',
        status: 'active',
        documentCount: 10,
        createdAt: new Date().toISOString(),
      }
      state.messages = [new HumanMessage('Find all revenue mentions')]

      await retrievalNode(state)

      expect(callGraphitiSearch).toHaveBeenCalledWith(
        'Find all revenue mentions',
        'deal-abc-123',
        'vector' // Default mock returns 'simple' complexity → 'vector' method
      )
    })
  })

  describe('result transformation (AC: #4)', () => {
    it('transforms Graphiti results to SourceCitation correctly', async () => {
      const mockResponse: MockHybridSearchResponse = {
        results: [
          {
            content: 'EBITDA margin was 25% in 2023',
            score: 0.92,
            citation: {
              type: 'document',
              title: 'Annual Report 2023',
              page: 12,
              id: 'doc-annual-2023',
            },
          },
          {
            content: 'Revenue grew 15% YoY',
            score: 0.88,
            citation: {
              type: 'document',
              title: 'Investor Presentation',
              page: 5,
              id: 'doc-investor-deck',
            },
          },
        ],
        entities: ['EBITDA', 'Revenue'],
        latency_ms: 150,
      }
      vi.mocked(callGraphitiSearch).mockResolvedValue(mockResponse as never)

      const state = createInitialState('chat', 'deal-123')
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }
      state.messages = [new HumanMessage('What is the EBITDA?')]

      const result = await retrievalNode(state)

      expect(result.sources).toHaveLength(2)

      // First source
      expect(result.sources![0]).toMatchObject({
        documentId: 'doc-annual-2023',
        documentName: 'Annual Report 2023',
        location: { page: 12 },
        snippet: 'EBITDA margin was 25% in 2023',
        relevanceScore: 0.92,
      })
      expect(result.sources?.[0]?.retrievedAt).toBeDefined()

      // Second source
      expect(result.sources?.[1]).toMatchObject({
        documentId: 'doc-investor-deck',
        documentName: 'Investor Presentation',
        location: { page: 5 },
        snippet: 'Revenue grew 15% YoY',
        relevanceScore: 0.88,
      })
    })

    it('handles missing citation.id with fallback', async () => {
      const mockResponse: MockHybridSearchResponse = {
        results: [
          {
            content: 'Some content without id',
            score: 0.75,
            citation: {
              type: 'document',
              title: 'Unknown Document',
              // No id field
            },
          },
        ],
        entities: [],
        latency_ms: 100,
      }
      vi.mocked(callGraphitiSearch).mockResolvedValue(mockResponse as never)

      const state = createInitialState('chat', 'deal-123')
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }
      state.messages = [new HumanMessage('Search query')]

      const result = await retrievalNode(state)

      expect(result.sources?.[0]?.documentId).toBe('graphiti-0')
    })

    it('handles missing citation.title with fallback', async () => {
      const mockResponse: MockHybridSearchResponse = {
        results: [
          {
            content: 'Content without title',
            score: 0.80,
            citation: {
              type: 'document',
              id: 'doc-no-title',
              // No title field
            },
          },
        ],
        entities: [],
        latency_ms: 100,
      }
      vi.mocked(callGraphitiSearch).mockResolvedValue(mockResponse as never)

      const state = createInitialState('chat', 'deal-123')
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }
      state.messages = [new HumanMessage('Search query')]

      const result = await retrievalNode(state)

      expect(result.sources?.[0]?.documentName).toBe('Unknown source')
    })

    it('handles missing page number (no location)', async () => {
      const mockResponse: MockHybridSearchResponse = {
        results: [
          {
            content: 'Content without page',
            score: 0.85,
            citation: {
              type: 'document',
              title: 'Document Without Pages',
              id: 'doc-no-page',
              // No page field
            },
          },
        ],
        entities: [],
        latency_ms: 100,
      }
      vi.mocked(callGraphitiSearch).mockResolvedValue(mockResponse as never)

      const state = createInitialState('chat', 'deal-123')
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }
      state.messages = [new HumanMessage('Search query')]

      const result = await retrievalNode(state)

      expect(result.sources?.[0]?.location).toBeUndefined()
    })

    it('includes retrievedAt timestamp on all sources', async () => {
      const now = new Date('2026-01-11T10:00:00Z')
      vi.useFakeTimers()
      vi.setSystemTime(now)

      const mockResponse: MockHybridSearchResponse = {
        results: [
          {
            content: 'Test content',
            score: 0.9,
            citation: { type: 'document', title: 'Test', id: 'doc-1' },
          },
        ],
        entities: [],
        latency_ms: 50,
      }
      vi.mocked(callGraphitiSearch).mockResolvedValue(mockResponse as never)

      const state = createInitialState('chat', 'deal-123')
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }
      state.messages = [new HumanMessage('Query')]

      const result = await retrievalNode(state)

      expect(result.sources?.[0]?.retrievedAt).toBe('2026-01-11T10:00:00.000Z')

      vi.useRealTimers()
    })
  })

  describe('error handling (AC: #1)', () => {
    it('handles Graphiti null response gracefully', async () => {
      vi.mocked(callGraphitiSearch).mockResolvedValue(null as never)

      const state = createInitialState('chat', 'deal-123')
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }
      state.messages = [new HumanMessage('Query')]

      const result = await retrievalNode(state)

      expect(result.sources).toEqual([])
    })

    it('handles Graphiti error gracefully (returns empty sources)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(callGraphitiSearch).mockRejectedValue(new Error('Network error'))

      const state = createInitialState('chat', 'deal-123')
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }
      state.messages = [new HumanMessage('Query')]

      const result = await retrievalNode(state)

      expect(result.sources).toEqual([])
      expect(consoleSpy).toHaveBeenCalledWith(
        '[retrieval] Graphiti search failed:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })

    it('handles empty Graphiti results', async () => {
      const mockResponse: MockHybridSearchResponse = {
        results: [],
        entities: [],
        latency_ms: 50,
      }
      vi.mocked(callGraphitiSearch).mockResolvedValue(mockResponse as never)

      const state = createInitialState('chat', 'deal-123')
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }
      state.messages = [new HumanMessage('Query with no results')]

      const result = await retrievalNode(state)

      expect(result.sources).toEqual([])
    })
  })

  describe('state preservation (AC: #5)', () => {
    it('preserves other state fields unchanged', async () => {
      const mockResponse: MockHybridSearchResponse = {
        results: [
          {
            content: 'Test',
            score: 0.9,
            citation: { type: 'document', title: 'Doc', id: 'doc-1' },
          },
        ],
        entities: [],
        latency_ms: 50,
      }
      vi.mocked(callGraphitiSearch).mockResolvedValue(mockResponse as never)

      const state = createInitialState('chat', 'deal-123')
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }
      state.messages = [new HumanMessage('Query')]
      state.scratchpad = { existingKey: 'existingValue' }
      state.workflowMode = 'chat'
      state.tokenCount = 1000

      const result = await retrievalNode(state)

      // Only sources should be returned
      expect(Object.keys(result)).toEqual(['sources'])
      // Original state fields should not be in the returned partial state
      expect(result).not.toHaveProperty('messages')
      expect(result).not.toHaveProperty('scratchpad')
      expect(result).not.toHaveProperty('workflowMode')
      expect(result).not.toHaveProperty('tokenCount')
    })

    it('does NOT modify messages array', async () => {
      const mockResponse: MockHybridSearchResponse = {
        results: [
          {
            content: 'Result content',
            score: 0.9,
            citation: { type: 'document', title: 'Doc', id: 'doc-1' },
          },
        ],
        entities: [],
        latency_ms: 50,
      }
      vi.mocked(callGraphitiSearch).mockResolvedValue(mockResponse as never)

      const state = createInitialState('chat', 'deal-123')
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }
      const originalMessages = [new HumanMessage('Query')]
      state.messages = originalMessages

      const result = await retrievalNode(state)

      // Result should not include messages
      expect(result.messages).toBeUndefined()
      // Original messages array should not be modified
      expect(state.messages).toBe(originalMessages)
      expect(state.messages).toHaveLength(1)
    })
  })

  describe('latency logging (AC: #2, NFR3)', () => {
    it('logs query execution with latency', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // Mock performance.now to simulate 100ms latency
      let callCount = 0
      vi.spyOn(performance, 'now').mockImplementation(() => {
        callCount++
        return callCount === 1 ? 0 : 100 // Start: 0ms, End: 100ms
      })

      const mockResponse: MockHybridSearchResponse = {
        results: [{ content: 'Test', score: 0.9, citation: { type: 'doc', title: 'Doc', id: 'd1' } }],
        entities: [],
        latency_ms: 100,
      }
      vi.mocked(callGraphitiSearch).mockResolvedValue(mockResponse as never)

      const state = createInitialState('chat', 'deal-123')
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }
      state.messages = [new HumanMessage('Short query')]

      await retrievalNode(state)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[retrieval] query="Short query" dealId=deal-123 complexity=simple method=vector latency=100ms results=1')
      )

      consoleSpy.mockRestore()
    })

    it('logs warning when latency exceeds 500ms', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Mock performance.now to simulate 600ms latency
      let callCount = 0
      vi.spyOn(performance, 'now').mockImplementation(() => {
        callCount++
        return callCount === 1 ? 0 : 600 // Start: 0ms, End: 600ms
      })

      const mockResponse2: MockHybridSearchResponse = {
        results: [{ content: 'Test', score: 0.9, citation: { type: 'doc', title: 'Doc', id: 'd1' } }],
        entities: [],
        latency_ms: 600,
      }
      vi.mocked(callGraphitiSearch).mockResolvedValue(mockResponse2 as never)

      const state = createInitialState('chat', 'deal-123')
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }
      state.messages = [new HumanMessage('Query')]

      await retrievalNode(state)

      expect(warnSpy).toHaveBeenCalledWith(
        '[retrieval] Latency exceeded target: 600ms > 500ms'
      )

      consoleSpy.mockRestore()
      warnSpy.mockRestore()
    })

    it('truncates long queries in log output', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const mockResponse: MockHybridSearchResponse = {
        results: [],
        entities: [],
        latency_ms: 50,
      }
      vi.mocked(callGraphitiSearch).mockResolvedValue(mockResponse as never)

      const state = createInitialState('chat', 'deal-123')
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }
      const longQuery = 'A'.repeat(100) // 100 character query
      state.messages = [new HumanMessage(longQuery)]

      await retrievalNode(state)

      // Should truncate to 50 chars + "..."
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`query="${'A'.repeat(50)}..."`)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('search method selection (AC: #2)', () => {
    it('maps simple complexity to vector search method', () => {
      expect(getSearchMethodForComplexity('simple')).toBe('vector')
    })

    it('maps medium complexity to hybrid search method', () => {
      expect(getSearchMethodForComplexity('medium')).toBe('hybrid')
    })

    it('maps complex complexity to hybrid search method', () => {
      expect(getSearchMethodForComplexity('complex')).toBe('hybrid')
    })

    it('uses vector method for simple queries', async () => {
      vi.mocked(classifyComplexity).mockReturnValue({ complexity: 'simple', confidence: 0.9 })

      const mockResponse: MockHybridSearchResponse = {
        results: [{ content: 'Test', score: 0.9, citation: { type: 'doc', title: 'Doc', id: 'd1' } }],
        entities: [],
        latency_ms: 50,
      }
      vi.mocked(callGraphitiSearch).mockResolvedValue(mockResponse as never)

      const state = createInitialState('chat', 'deal-123')
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }
      state.messages = [new HumanMessage('What is Q3 revenue?')]

      await retrievalNode(state)

      expect(callGraphitiSearch).toHaveBeenCalledWith(
        'What is Q3 revenue?',
        'deal-123',
        'vector'
      )
    })

    it('uses hybrid method for complex queries', async () => {
      vi.mocked(classifyComplexity).mockReturnValue({ complexity: 'complex', confidence: 0.9 })

      const mockResponse: MockHybridSearchResponse = {
        results: [{ content: 'Test', score: 0.9, citation: { type: 'doc', title: 'Doc', id: 'd1' } }],
        entities: [],
        latency_ms: 50,
      }
      vi.mocked(callGraphitiSearch).mockResolvedValue(mockResponse as never)

      const state = createInitialState('chat', 'deal-123')
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }
      state.messages = [new HumanMessage('Analyze revenue trends across all quarters')]

      await retrievalNode(state)

      expect(callGraphitiSearch).toHaveBeenCalledWith(
        'Analyze revenue trends across all quarters',
        'deal-123',
        'hybrid'
      )
    })

    it('logs complexity and method in output', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      vi.mocked(classifyComplexity).mockReturnValue({ complexity: 'medium', confidence: 0.85 })

      const mockResponse: MockHybridSearchResponse = {
        results: [{ content: 'Test', score: 0.9, citation: { type: 'doc', title: 'Doc', id: 'd1' } }],
        entities: [],
        latency_ms: 50,
      }
      vi.mocked(callGraphitiSearch).mockResolvedValue(mockResponse as never)

      const state = createInitialState('chat', 'deal-123')
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }
      state.messages = [new HumanMessage('Compare Q3 vs Q4')]

      await retrievalNode(state)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('complexity=medium')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('method=hybrid')
      )

      consoleSpy.mockRestore()
    })
  })

  describe('edge cases', () => {
    it('handles entirely undefined citation object', async () => {
      const mockResponse: MockHybridSearchResponse = {
        results: [
          {
            content: 'Content with no citation object',
            score: 0.7,
            // citation is completely undefined
          },
        ],
        entities: [],
        latency_ms: 50,
      }
      vi.mocked(callGraphitiSearch).mockResolvedValue(mockResponse as never)

      const state = createInitialState('chat', 'deal-123')
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }
      state.messages = [new HumanMessage('Query')]

      const result = await retrievalNode(state)

      expect(result.sources).toHaveLength(1)
      expect(result.sources?.[0]?.documentId).toBe('graphiti-0')
      expect(result.sources?.[0]?.documentName).toBe('Unknown source')
      expect(result.sources?.[0]?.location).toBeUndefined()
    })

    it('uses AIMessage string content as query when its the last message', async () => {
      // Note: AIMessage with string content IS used as query
      // This is intentional - the retrieval node doesn't distinguish message types
      // It just extracts the last message's content if it's a string
      vi.mocked(classifyComplexity).mockReturnValue({ complexity: 'simple', confidence: 0.9 })

      const mockResponse: MockHybridSearchResponse = {
        results: [{ content: 'Test', score: 0.9, citation: { type: 'doc', title: 'Doc', id: 'd1' } }],
        entities: [],
        latency_ms: 50,
      }
      vi.mocked(callGraphitiSearch).mockResolvedValue(mockResponse as never)

      const state = createInitialState('chat', 'deal-123')
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }
      // Last message is AIMessage with string content
      state.messages = [
        new HumanMessage('Hello'),
        new AIMessage('How can I help you?'),
      ]

      const result = await retrievalNode(state)

      // AIMessage string content IS used as query
      expect(callGraphitiSearch).toHaveBeenCalledWith(
        'How can I help you?',
        'deal-123',
        'vector'
      )
      expect(result.sources).toHaveLength(1)
    })

    it('handles AIMessage with tool_calls (non-string content)', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const state = createInitialState('chat', 'deal-123')
      state.dealContext = {
        dealId: 'deal-123',
        dealName: 'Test Deal',
        projectId: 'proj-123',
        organizationId: 'org-123',
        status: 'active',
        documentCount: 5,
        createdAt: new Date().toISOString(),
      }
      // Create an AIMessage with complex content (simulating tool calls)
      const aiMessage = new AIMessage({
        content: '',
        tool_calls: [{ id: 'tool-1', name: 'search', args: {} }],
      })
      state.messages = [aiMessage]

      const result = await retrievalNode(state)

      expect(result.sources).toEqual([])
      expect(callGraphitiSearch).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })
})
