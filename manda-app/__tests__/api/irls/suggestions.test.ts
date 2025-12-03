/**
 * IRL Suggestions API Tests
 *
 * Tests for POST /api/projects/[id]/irls/suggestions endpoint.
 * Story: E6.3 - Implement AI-Assisted IRL Auto-Generation from Documents
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/projects/[id]/irls/suggestions/route'

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'deals') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'deal-123',
                    name: 'Test Deal',
                    irl_template: 'tech_ma',
                    industry: 'Technology',
                  },
                  error: null,
                }),
              })),
            })),
          }
        }
        if (table === 'documents') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: 'doc-1', name: 'financials.pdf', mime_type: 'application/pdf', folder_path: '/financials' },
                ],
                error: null,
              }),
            })),
          }
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        }
      }),
    })
  ),
}))

// Mock IRL services
vi.mock('@/lib/services/irls', () => ({
  getIRLWithItems: vi.fn().mockResolvedValue({
    id: 'irl-123',
    dealId: 'deal-123',
    title: 'Test IRL',
    items: [
      { id: 'item-1', category: 'Financial', itemName: 'Budget' },
    ],
  }),
}))

// Mock IRL templates
vi.mock('@/lib/services/irl-templates', () => ({
  getTemplate: vi.fn().mockResolvedValue({
    id: 'tech-ma',
    name: 'Tech M&A',
    categories: [
      {
        name: 'Financial',
        items: [
          { name: 'Audited Financial Statements', priority: 'high', description: 'Annual audited statements' },
          { name: 'ARR/MRR Analysis', priority: 'high', description: 'Revenue breakdown' },
        ],
      },
      {
        name: 'Legal',
        items: [
          { name: 'Cap Table', priority: 'high', description: 'Fully diluted cap table' },
        ],
      },
    ],
  }),
}))

function createMockRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/projects/deal-123/irls/suggestions', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

describe('IRL Suggestions API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/projects/[id]/irls/suggestions', () => {
    it('should return suggestions based on deal type', async () => {
      const request = createMockRequest({
        dealType: 'tech_ma',
      })

      const context = {
        params: Promise.resolve({ id: 'deal-123' }),
      }

      const response = await POST(request, context)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.suggestions).toBeDefined()
      expect(Array.isArray(data.suggestions)).toBe(true)
      expect(data.dealType).toBe('tech_ma')
    })

    it('should filter out items already in IRL', async () => {
      const request = createMockRequest({
        irlId: '123e4567-e89b-12d3-a456-426614174000',
        dealType: 'tech_ma',
      })

      const context = {
        params: Promise.resolve({ id: 'deal-123' }),
      }

      const response = await POST(request, context)
      expect(response.status).toBe(200)

      const data = await response.json()
      // Budget is in the IRL, so shouldn't be in suggestions
      const hasBudget = data.suggestions.some(
        (s: { itemName: string }) => s.itemName.toLowerCase() === 'budget'
      )
      expect(hasBudget).toBe(false)
    })

    it('should return 400 for invalid request body', async () => {
      const request = createMockRequest({
        irlId: 'not-a-uuid', // Invalid UUID
      })

      const context = {
        params: Promise.resolve({ id: 'deal-123' }),
      }

      const response = await POST(request, context)
      expect(response.status).toBe(400)
    })

    it('should include document count in response', async () => {
      const request = createMockRequest({
        dealType: 'tech_ma',
      })

      const context = {
        params: Promise.resolve({ id: 'deal-123' }),
      }

      const response = await POST(request, context)
      const data = await response.json()

      expect(data.documentsAnalyzed).toBeDefined()
      expect(typeof data.documentsAnalyzed).toBe('number')
    })

    it('should return suggestions with required fields', async () => {
      const request = createMockRequest({
        dealType: 'tech_ma',
      })

      const context = {
        params: Promise.resolve({ id: 'deal-123' }),
      }

      const response = await POST(request, context)
      const data = await response.json()

      if (data.suggestions.length > 0) {
        const suggestion = data.suggestions[0]
        expect(suggestion.category).toBeDefined()
        expect(suggestion.itemName).toBeDefined()
        expect(suggestion.priority).toBeDefined()
        expect(suggestion.rationale).toBeDefined()
        expect(['high', 'medium', 'low']).toContain(suggestion.priority)
      }
    })
  })
})

describe('IRL Suggestions - Authentication', () => {
  it('should return 401 when not authenticated', async () => {
    // Override the mock for this test
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Not authenticated' },
        }),
      },
      from: vi.fn(),
    } as never)

    const request = createMockRequest({ dealType: 'tech_ma' })
    const context = { params: Promise.resolve({ id: 'deal-123' }) }

    const response = await POST(request, context)
    expect(response.status).toBe(401)
  })
})
