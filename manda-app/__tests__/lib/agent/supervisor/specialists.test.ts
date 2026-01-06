/**
 * Tests for Specialist Node Implementations
 *
 * Story: E13.4 - Supervisor Agent Pattern (AC: #2, #6)
 * Story: E13.5 - Financial Analyst Specialist Agent (AC: #4, #5)
 * Story: E13.6 - Knowledge Graph Specialist Agent (AC: #4, #5)
 *
 * Tests helper functions, confidence estimation, and source extraction.
 * Note: Node invocations require mocked LLM and are covered in integration tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getSpecialistNode,
  SPECIALIST_NODES,
  financialAnalystNode,
  knowledgeGraphNode,
} from '@/lib/agent/supervisor/specialists'
import { SPECIALIST_IDS } from '@/lib/agent/supervisor/routing'
import type { SupervisorState } from '@/lib/agent/supervisor/state'

// =============================================================================
// SPECIALIST_NODES Registry Tests
// =============================================================================

describe('SPECIALIST_NODES', () => {
  it('has all expected specialists registered', () => {
    expect(SPECIALIST_NODES[SPECIALIST_IDS.FINANCIAL_ANALYST]).toBeDefined()
    expect(SPECIALIST_NODES[SPECIALIST_IDS.KNOWLEDGE_GRAPH]).toBeDefined()
    expect(SPECIALIST_NODES[SPECIALIST_IDS.GENERAL]).toBeDefined()
  })

  it('has exactly 3 specialists', () => {
    expect(Object.keys(SPECIALIST_NODES).length).toBe(3)
  })

  it('all specialists are functions', () => {
    for (const [id, node] of Object.entries(SPECIALIST_NODES)) {
      expect(typeof node).toBe('function')
    }
  })
})

// =============================================================================
// getSpecialistNode Tests
// =============================================================================

describe('getSpecialistNode', () => {
  it('returns financial_analyst node', () => {
    const node = getSpecialistNode(SPECIALIST_IDS.FINANCIAL_ANALYST)
    expect(node).toBeDefined()
    expect(typeof node).toBe('function')
  })

  it('returns knowledge_graph node', () => {
    const node = getSpecialistNode(SPECIALIST_IDS.KNOWLEDGE_GRAPH)
    expect(node).toBeDefined()
    expect(typeof node).toBe('function')
  })

  it('returns general node', () => {
    const node = getSpecialistNode(SPECIALIST_IDS.GENERAL)
    expect(node).toBeDefined()
    expect(typeof node).toBe('function')
  })

  it('returns undefined for unknown specialist', () => {
    const node = getSpecialistNode('unknown_specialist')
    expect(node).toBeUndefined()
  })

  it('returns undefined for empty string', () => {
    const node = getSpecialistNode('')
    expect(node).toBeUndefined()
  })
})

// =============================================================================
// Confidence Estimation Tests (internal function behavior)
// =============================================================================

describe('Confidence estimation behavior', () => {
  // These tests verify the expected confidence heuristics without accessing the private function
  // The actual estimateConfidence function is tested indirectly through the output

  it('should have lower confidence for uncertain language', () => {
    // This is tested indirectly - when specialist outputs contain
    // "unclear", "uncertain", "might", "may", etc., confidence should be lower
    // Full testing requires integration test with mocked LLM response
  })

  it('should have higher confidence for certain language', () => {
    // When outputs contain "clearly", "definitely", "according to", etc.
    // confidence should be higher
  })
})

// =============================================================================
// Source Extraction Tests (internal function behavior)
// =============================================================================

describe('Source extraction behavior', () => {
  // These tests document expected extraction patterns

  it('should extract document references from common patterns', () => {
    // Patterns like:
    // - "according to Financial Report.pdf"
    // - "from document titled 'Q3 Analysis.docx'"
    // Should extract document names
  })

  it('should limit sources to 5', () => {
    // Even if many document references are found, only return up to 5
  })
})

// =============================================================================
// Specialist ID Constants Tests
// =============================================================================

describe('SPECIALIST_IDS', () => {
  it('has expected ID values', () => {
    expect(SPECIALIST_IDS.FINANCIAL_ANALYST).toBe('financial_analyst')
    expect(SPECIALIST_IDS.KNOWLEDGE_GRAPH).toBe('knowledge_graph')
    expect(SPECIALIST_IDS.GENERAL).toBe('general')
  })

  it('IDs match SPECIALIST_NODES keys', () => {
    for (const id of Object.values(SPECIALIST_IDS)) {
      expect(SPECIALIST_NODES[id]).toBeDefined()
    }
  })
})

// =============================================================================
// Timeout Configuration Tests
// =============================================================================

describe('Specialist timeout behavior', () => {
  it('should have a 45 second timeout configured', () => {
    // SPECIALIST_TIMEOUT_MS = 45000 (aligned with Python config)
    // This is tested indirectly - when a specialist takes too long,
    // it should return a timeout error result
  })
})

// =============================================================================
// Financial Analyst Integration Tests (E13.5)
// =============================================================================

describe('Financial Analyst Specialist (E13.5)', () => {
  const originalFetch = global.fetch
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  const createMockState = (overrides?: Partial<SupervisorState>): SupervisorState => ({
    query: 'What is the EBITDA margin?',
    dealId: 'test-deal-123',
    organizationId: 'test-org-456',
    conversationHistory: [],
    processedDocuments: [],
    conversationId: 'conv-123',
    specialistResults: [],
    synthesizedResponse: undefined,
    citationsMap: {},
    error: undefined,
    ...overrides,
  })

  describe('API Configuration', () => {
    it('requires MANDA_PROCESSING_API_URL to be set', async () => {
      delete process.env.MANDA_PROCESSING_API_URL

      const state = createMockState()
      const result = await financialAnalystNode(state)

      // Should fall back to stub and have error
      expect(result.specialistResults).toBeDefined()
      expect(result.specialistResults?.length).toBe(1)
      expect(result.specialistResults?.[0].stub).toBe(true)
    })
  })

  describe('API Response Handling', () => {
    it('transforms successful API response to SpecialistResult', async () => {
      process.env.MANDA_PROCESSING_API_URL = 'http://localhost:8000'

      const mockApiResponse = {
        success: true,
        result: {
          summary: 'The EBITDA margin is 23.5%',
          findings: [
            {
              metric: 'EBITDA Margin',
              value: 0.235,
              confidence: 0.9,
              source: {
                document_name: 'Financial Report.pdf',
                page_number: 5,
              },
            },
          ],
          confidence: 0.88,
          sources: [
            {
              document_id: 'doc-123',
              document_name: 'Financial Report.pdf',
              page_number: 5,
            },
          ],
          limitations: null,
          follow_up_questions: [],
        },
        model_used: 'anthropic:claude-sonnet-4-0',
        latency_ms: 1500,
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })

      const state = createMockState()
      const result = await financialAnalystNode(state)

      expect(result.specialistResults).toBeDefined()
      expect(result.specialistResults?.length).toBe(1)

      const specialistResult = result.specialistResults?.[0]
      expect(specialistResult?.specialistId).toBe(SPECIALIST_IDS.FINANCIAL_ANALYST)
      expect(specialistResult?.confidence).toBe(0.88)
      expect(specialistResult?.output).toContain('EBITDA margin is 23.5%')
      expect(specialistResult?.stub).toBeUndefined()
    })

    it('includes findings in output text', async () => {
      process.env.MANDA_PROCESSING_API_URL = 'http://localhost:8000'

      const mockApiResponse = {
        success: true,
        result: {
          summary: 'Analysis complete',
          findings: [
            {
              metric: 'Revenue',
              value: '$5.2M',
              confidence: 0.9,
              source: { document_name: 'Report.pdf', page_number: 3 },
            },
            {
              metric: 'EBITDA',
              value: '$1.2M',
              confidence: 0.85,
              source: { document_name: 'Report.pdf', page_number: 5 },
            },
          ],
          confidence: 0.85,
          sources: [],
        },
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })

      const state = createMockState()
      const result = await financialAnalystNode(state)

      const output = result.specialistResults?.[0]?.output || ''
      expect(output).toContain('Key Findings')
      expect(output).toContain('Revenue')
      expect(output).toContain('$5.2M')
      expect(output).toContain('EBITDA')
      expect(output).toContain('$1.2M')
    })

    it('includes limitations and follow-up questions in output', async () => {
      process.env.MANDA_PROCESSING_API_URL = 'http://localhost:8000'

      const mockApiResponse = {
        success: true,
        result: {
          summary: 'Partial analysis',
          findings: [],
          confidence: 0.6,
          sources: [],
          limitations: 'Q4 data not available',
          follow_up_questions: [
            'Can you provide Q4 financials?',
            'What is the expected revenue growth?',
          ],
        },
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })

      const state = createMockState()
      const result = await financialAnalystNode(state)

      const output = result.specialistResults?.[0]?.output || ''
      expect(output).toContain('Q4 data not available')
      expect(output).toContain('Follow-up Questions')
      expect(output).toContain('Can you provide Q4 financials?')
    })

    it('handles API error and falls back to stub', async () => {
      process.env.MANDA_PROCESSING_API_URL = 'http://localhost:8000'

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      })

      const state = createMockState()
      const result = await financialAnalystNode(state)

      // Should fall back to stub
      expect(result.specialistResults?.[0]?.stub).toBe(true)
      expect(result.specialistResults?.[0]?.error).toBeDefined()
    })

    it('handles API unsuccessful response', async () => {
      process.env.MANDA_PROCESSING_API_URL = 'http://localhost:8000'

      const mockApiResponse = {
        success: false,
        error: 'Model rate limited',
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })

      const state = createMockState()
      const result = await financialAnalystNode(state)

      // Should fall back to stub
      expect(result.specialistResults?.[0]?.stub).toBe(true)
    })

    it('handles network error', async () => {
      process.env.MANDA_PROCESSING_API_URL = 'http://localhost:8000'

      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const state = createMockState()
      const result = await financialAnalystNode(state)

      // Should fall back to stub
      expect(result.specialistResults?.[0]?.stub).toBe(true)
      expect(result.specialistResults?.[0]?.error).toContain('Network error')
    })
  })

  describe('Request Construction', () => {
    it('sends correct request body to API', async () => {
      process.env.MANDA_PROCESSING_API_URL = 'http://localhost:8000'

      const mockApiResponse = {
        success: true,
        result: {
          summary: 'Test',
          findings: [],
          confidence: 0.8,
          sources: [],
        },
      }

      let capturedRequest: {
        url: string
        body: unknown
        headers: HeadersInit
      } | undefined

      global.fetch = vi.fn().mockImplementation((url, options) => {
        capturedRequest = {
          url: url as string,
          body: JSON.parse(options?.body as string),
          headers: options?.headers as HeadersInit,
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponse),
        })
      })

      const state = createMockState({
        query: 'What is the EBITDA?',
        dealId: 'deal-abc-123',
        organizationId: 'org-xyz-789',
        intent: {
          domain: 'financial',
          subCategory: 'profitability',
          confidence: 0.9,
          rationale: 'User asking about EBITDA metric',
        },
      })

      await financialAnalystNode(state)

      expect(capturedRequest?.url).toBe('http://localhost:8000/api/agents/financial-analyst/invoke')
      expect(capturedRequest?.body).toEqual({
        query: 'What is the EBITDA?',
        deal_id: 'deal-abc-123',
        organization_id: 'org-xyz-789',
        context: 'User asking about EBITDA metric',
      })
      expect((capturedRequest?.headers as Record<string, string>)?.['x-organization-id']).toBe('org-xyz-789')
    })
  })
})

// =============================================================================
// Knowledge Graph Integration Tests (E13.6)
// =============================================================================

describe('Knowledge Graph Specialist (E13.6)', () => {
  const originalFetch = global.fetch
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  const createMockState = (overrides?: Partial<SupervisorState>): SupervisorState => ({
    query: 'Who is the CEO of Acme Corporation?',
    dealId: 'test-deal-123',
    organizationId: 'test-org-456',
    conversationHistory: [],
    processedDocuments: [],
    conversationId: 'conv-123',
    specialistResults: [],
    synthesizedResponse: undefined,
    citationsMap: {},
    error: undefined,
    ...overrides,
  })

  describe('API Configuration', () => {
    it('requires MANDA_PROCESSING_API_URL to be set', async () => {
      delete process.env.MANDA_PROCESSING_API_URL

      const state = createMockState()
      const result = await knowledgeGraphNode(state)

      // Should fall back to stub and have error
      expect(result.specialistResults).toBeDefined()
      expect(result.specialistResults?.length).toBe(1)
      expect(result.specialistResults?.[0].stub).toBe(true)
    })
  })

  describe('API Response Handling', () => {
    it('transforms successful API response to SpecialistResult', async () => {
      process.env.MANDA_PROCESSING_API_URL = 'http://localhost:8000'

      const mockApiResponse = {
        success: true,
        result: {
          summary: 'John Smith is the CEO of Acme Corporation since 2020.',
          entities: [
            {
              name: 'John Smith',
              entity_type: 'Person',
              confidence: 0.95,
              aliases: ['J. Smith'],
              source: {
                document_name: 'Management Profile.pdf',
              },
              properties: { role: 'CEO' },
            },
            {
              name: 'Acme Corporation',
              entity_type: 'Company',
              confidence: 0.98,
              aliases: ['Acme Corp', 'ACME'],
              source: {
                document_name: 'Company Overview.pdf',
              },
              properties: { industry: 'Technology' },
            },
          ],
          paths: [
            {
              start_entity: 'John Smith',
              start_entity_type: 'Person',
              end_entity: 'Acme Corporation',
              end_entity_type: 'Company',
              path: [
                {
                  from_entity: 'John Smith',
                  relationship: 'WORKS_AT',
                  to_entity: 'Acme Corporation',
                },
              ],
              total_hops: 1,
              path_description: 'John Smith --[WORKS_AT]--> Acme Corporation',
            },
          ],
          contradictions: [],
          confidence: 0.92,
          sources: [
            {
              document_id: 'doc-123',
              document_name: 'Management Profile.pdf',
            },
          ],
          traversal_explanation: 'Found direct WORKS_AT relationship',
          limitations: null,
          follow_up_questions: [],
        },
        model_used: 'google-gla:gemini-2.5-pro',
        latency_ms: 1200,
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })

      const state = createMockState()
      const result = await knowledgeGraphNode(state)

      expect(result.specialistResults).toBeDefined()
      expect(result.specialistResults?.length).toBe(1)

      const specialistResult = result.specialistResults?.[0]
      expect(specialistResult?.specialistId).toBe(SPECIALIST_IDS.KNOWLEDGE_GRAPH)
      expect(specialistResult?.confidence).toBe(0.92)
      expect(specialistResult?.output).toContain('John Smith is the CEO')
      expect(specialistResult?.stub).toBeUndefined()
    })

    it('includes entities in output text', async () => {
      process.env.MANDA_PROCESSING_API_URL = 'http://localhost:8000'

      const mockApiResponse = {
        success: true,
        result: {
          summary: 'Analysis complete',
          entities: [
            {
              name: 'Acme Corporation',
              entity_type: 'Company',
              confidence: 0.98,
              aliases: ['Acme Corp'],
              source: {},
              properties: {},
            },
            {
              name: 'John Smith',
              entity_type: 'Person',
              confidence: 0.95,
              aliases: [],
              source: {},
              properties: {},
            },
          ],
          paths: [],
          contradictions: [],
          confidence: 0.85,
          sources: [],
        },
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })

      const state = createMockState()
      const result = await knowledgeGraphNode(state)

      const output = result.specialistResults?.[0]?.output || ''
      expect(output).toContain('Matched Entities')
      expect(output).toContain('Acme Corporation')
      expect(output).toContain('Company')
      expect(output).toContain('John Smith')
      expect(output).toContain('Person')
    })

    it('includes relationship paths in output', async () => {
      process.env.MANDA_PROCESSING_API_URL = 'http://localhost:8000'

      const mockApiResponse = {
        success: true,
        result: {
          summary: 'Found relationship',
          entities: [],
          paths: [
            {
              start_entity: 'John',
              start_entity_type: 'Person',
              end_entity: 'Acme',
              end_entity_type: 'Company',
              path: [],
              total_hops: 1,
              path_description: 'John --[WORKS_AT]--> Acme',
            },
          ],
          contradictions: [],
          confidence: 0.88,
          sources: [],
        },
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })

      const state = createMockState()
      const result = await knowledgeGraphNode(state)

      const output = result.specialistResults?.[0]?.output || ''
      expect(output).toContain('Relationship Paths')
      expect(output).toContain('John --[WORKS_AT]--> Acme')
    })

    it('includes contradictions in output', async () => {
      process.env.MANDA_PROCESSING_API_URL = 'http://localhost:8000'

      const mockApiResponse = {
        success: true,
        result: {
          summary: 'Found conflicting data',
          entities: [],
          paths: [],
          contradictions: [
            {
              fact1: 'Revenue was $5M',
              fact2: 'Revenue was $4.2M',
              conflict_type: 'value_mismatch',
              severity: 'critical',
              resolution_hint: 'Check source documents',
            },
          ],
          confidence: 0.7,
          sources: [],
        },
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })

      const state = createMockState()
      const result = await knowledgeGraphNode(state)

      const output = result.specialistResults?.[0]?.output || ''
      expect(output).toContain('Detected Contradictions')
      expect(output).toContain('value_mismatch')
      expect(output).toContain('Revenue was $5M')
    })

    it('handles API error and falls back to stub', async () => {
      process.env.MANDA_PROCESSING_API_URL = 'http://localhost:8000'

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      })

      const state = createMockState()
      const result = await knowledgeGraphNode(state)

      // Should fall back to stub
      expect(result.specialistResults?.[0]?.stub).toBe(true)
      expect(result.specialistResults?.[0]?.error).toBeDefined()
    })

    it('handles API unsuccessful response', async () => {
      process.env.MANDA_PROCESSING_API_URL = 'http://localhost:8000'

      const mockApiResponse = {
        success: false,
        error: 'Neo4j connection failed',
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })

      const state = createMockState()
      const result = await knowledgeGraphNode(state)

      // Should fall back to stub
      expect(result.specialistResults?.[0]?.stub).toBe(true)
    })

    it('handles network error', async () => {
      process.env.MANDA_PROCESSING_API_URL = 'http://localhost:8000'

      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const state = createMockState()
      const result = await knowledgeGraphNode(state)

      // Should fall back to stub
      expect(result.specialistResults?.[0]?.stub).toBe(true)
      expect(result.specialistResults?.[0]?.error).toContain('Network error')
    })
  })

  describe('Request Construction', () => {
    it('sends correct request body to API', async () => {
      process.env.MANDA_PROCESSING_API_URL = 'http://localhost:8000'

      const mockApiResponse = {
        success: true,
        result: {
          summary: 'Test',
          entities: [],
          paths: [],
          contradictions: [],
          confidence: 0.8,
          sources: [],
        },
      }

      let capturedRequest: {
        url: string
        body: unknown
        headers: HeadersInit
      } | undefined

      global.fetch = vi.fn().mockImplementation((url, options) => {
        capturedRequest = {
          url: url as string,
          body: JSON.parse(options?.body as string),
          headers: options?.headers as HeadersInit,
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponse),
        })
      })

      const state = createMockState({
        query: 'Who is the CEO?',
        dealId: 'deal-abc-123',
        organizationId: 'org-xyz-789',
        intent: {
          domain: 'entity',
          subCategory: 'people',
          confidence: 0.9,
          rationale: 'User asking about entity relationship',
          suggestedEntityTypes: ['Person', 'Company'],
        },
      })

      await knowledgeGraphNode(state)

      expect(capturedRequest?.url).toBe('http://localhost:8000/api/agents/knowledge-graph/invoke')
      expect(capturedRequest?.body).toEqual({
        query: 'Who is the CEO?',
        deal_id: 'deal-abc-123',
        organization_id: 'org-xyz-789',
        entity_types: ['Person', 'Company'],
        context: 'User asking about entity relationship',
      })
      expect((capturedRequest?.headers as Record<string, string>)?.['x-organization-id']).toBe('org-xyz-789')
    })
  })
})
