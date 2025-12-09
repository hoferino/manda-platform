/**
 * Q&A API Route Tests
 * Story: E8.1 - Q&A Data Model and CRUD API
 * Tests for all Q&A API endpoints
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/projects/[id]/qa/route'
import { GET as GET_ITEM, PUT, DELETE } from '@/app/api/projects/[id]/qa/[itemId]/route'
import { GET as GET_SUMMARY } from '@/app/api/projects/[id]/qa/summary/route'

// Mock Supabase
const mockUser = { id: 'user-123', email: 'test@example.com' }
const mockProject = { id: 'project-123' }

const mockQAItem = {
  id: 'qa-item-123',
  deal_id: 'project-123',
  question: 'What is the revenue growth rate?',
  category: 'Financials',
  priority: 'high',
  answer: null,
  comment: null,
  source_finding_id: null,
  created_by: 'user-123',
  date_added: '2024-01-15T10:00:00Z',
  date_answered: null,
  updated_at: '2024-01-15T10:00:00Z',
}

// Supabase mock setup
let mockSupabase: {
  auth: { getUser: ReturnType<typeof vi.fn> }
  from: ReturnType<typeof vi.fn>
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

function createMockRequest(
  url: string,
  options: { method?: string; body?: Record<string, unknown> } = {}
): NextRequest {
  const fullUrl = `http://localhost:3000${url}`
  const request = new NextRequest(fullUrl, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  return request
}

function createRouteContext(params: { id: string }): { params: Promise<{ id: string }> }
function createRouteContext(params: { id: string; itemId: string }): { params: Promise<{ id: string; itemId: string }> }
function createRouteContext(params: { id: string; itemId?: string }) {
  return { params: Promise.resolve(params) }
}

describe('Q&A API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mock Supabase
    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
      from: vi.fn(),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ============================================================================
  // GET /api/projects/[id]/qa Tests
  // ============================================================================

  describe('GET /api/projects/[id]/qa', () => {
    it('should return 401 if not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('Not authenticated') })

      const request = createMockRequest('/api/projects/project-123/qa')
      const context = createRouteContext({ id: 'project-123' })

      const response = await GET(request, context)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
    })

    it('should return 404 if project not found', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      })

      const request = createMockRequest('/api/projects/non-existent/qa')
      const context = createRouteContext({ id: 'non-existent' })

      const response = await GET(request, context)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Project not found')
    })

    it('should return Q&A items with pagination info (AC: #2)', async () => {
      // Mock project check
      const projectQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
      }

      // Mock Q&A items query
      const qaQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [mockQAItem],
          error: null,
          count: 1,
        }),
      }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'deals') return projectQuery
        if (table === 'qa_items') return qaQuery
        return projectQuery
      })

      const request = createMockRequest('/api/projects/project-123/qa')
      const context = createRouteContext({ id: 'project-123' })

      const response = await GET(request, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.items).toHaveLength(1)
      expect(data.items[0].id).toBe('qa-item-123')
      expect(data.items[0].question).toBe('What is the revenue growth rate?')
      expect(data.total).toBe(1)
      expect(data.hasMore).toBe(false)
    })

    it('should apply category filter (AC: #2)', async () => {
      const projectQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
      }

      const qaQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [mockQAItem],
          error: null,
          count: 1,
        }),
      }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'deals') return projectQuery
        return qaQuery
      })

      const request = createMockRequest('/api/projects/project-123/qa?category=Financials')
      const context = createRouteContext({ id: 'project-123' })

      const response = await GET(request, context)

      expect(response.status).toBe(200)
      // Verify eq was called with category filter
      expect(qaQuery.eq).toHaveBeenCalled()
    })

    it('should apply status=pending filter (AC: #2)', async () => {
      const projectQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
      }

      const qaQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [mockQAItem],
          error: null,
          count: 1,
        }),
      }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'deals') return projectQuery
        return qaQuery
      })

      const request = createMockRequest('/api/projects/project-123/qa?status=pending')
      const context = createRouteContext({ id: 'project-123' })

      const response = await GET(request, context)

      expect(response.status).toBe(200)
      // Verify is was called for date_answered IS NULL
      expect(qaQuery.is).toHaveBeenCalledWith('date_answered', null)
    })
  })

  // ============================================================================
  // POST /api/projects/[id]/qa Tests
  // ============================================================================

  describe('POST /api/projects/[id]/qa', () => {
    it('should create Q&A item and return 201 (AC: #1)', async () => {
      const projectQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
      }

      const insertQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockQAItem, error: null }),
      }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'deals') return projectQuery
        if (table === 'qa_items') return insertQuery
        return projectQuery
      })

      const request = createMockRequest('/api/projects/project-123/qa', {
        method: 'POST',
        body: {
          question: 'What is the revenue growth rate?',
          category: 'Financials',
          priority: 'high',
        },
      })
      const context = createRouteContext({ id: 'project-123' })

      const response = await POST(request, context)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.item).toBeDefined()
      expect(data.item.id).toBe('qa-item-123')
      expect(data.item.question).toBe('What is the revenue growth rate?')
    })

    it('should return 400 for invalid request body', async () => {
      const request = createMockRequest('/api/projects/project-123/qa', {
        method: 'POST',
        body: {
          question: 'Short?', // Too short
          category: 'InvalidCategory',
        },
      })
      const context = createRouteContext({ id: 'project-123' })

      const response = await POST(request, context)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request body')
    })
  })

  // ============================================================================
  // GET /api/projects/[id]/qa/[itemId] Tests
  // ============================================================================

  describe('GET /api/projects/[id]/qa/[itemId]', () => {
    it('should return single Q&A item', async () => {
      const qaQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockQAItem, error: null }),
      }

      mockSupabase.from.mockReturnValue(qaQuery)

      const request = createMockRequest('/api/projects/project-123/qa/qa-item-123')
      const context = createRouteContext({ id: 'project-123', itemId: 'qa-item-123' })

      const response = await GET_ITEM(request, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.item.id).toBe('qa-item-123')
    })

    it('should return 404 if item not found', async () => {
      const qaQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      }

      mockSupabase.from.mockReturnValue(qaQuery)

      const request = createMockRequest('/api/projects/project-123/qa/non-existent')
      const context = createRouteContext({ id: 'project-123', itemId: 'non-existent' })

      const response = await GET_ITEM(request, context)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Q&A item not found')
    })
  })

  // ============================================================================
  // PUT /api/projects/[id]/qa/[itemId] Tests
  // ============================================================================

  describe('PUT /api/projects/[id]/qa/[itemId]', () => {
    it('should update item with current updated_at (AC: #3)', async () => {
      const updatedItem = { ...mockQAItem, question: 'Updated question here?', updated_at: '2024-01-16T10:00:00Z' }

      const updateQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [updatedItem], error: null }),
      }

      mockSupabase.from.mockReturnValue(updateQuery)

      const request = createMockRequest('/api/projects/project-123/qa/qa-item-123', {
        method: 'PUT',
        body: {
          question: 'Updated question here?',
          updatedAt: '2024-01-15T10:00:00Z',
        },
      })
      const context = createRouteContext({ id: 'project-123', itemId: 'qa-item-123' })

      const response = await PUT(request, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.item.question).toBe('Updated question here?')
    })

    it('should return 409 Conflict with stale updated_at (AC: #4)', async () => {
      // Update returns empty array (no rows matched - optimistic locking failed)
      const updateQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      }

      // Fetch current item for conflict response
      const fetchQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockQAItem, error: null }),
      }

      let callCount = 0
      mockSupabase.from.mockImplementation(() => {
        callCount++
        if (callCount === 1) return updateQuery
        return fetchQuery
      })

      const request = createMockRequest('/api/projects/project-123/qa/qa-item-123', {
        method: 'PUT',
        body: {
          question: 'Updated question here?',
          updatedAt: '2024-01-14T10:00:00Z', // Stale timestamp
        },
      })
      const context = createRouteContext({ id: 'project-123', itemId: 'qa-item-123' })

      const response = await PUT(request, context)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.type).toBe('conflict')
      expect(data.message).toContain('modified by another user')
      expect(data.currentItem).toBeDefined()
      expect(data.yourChanges).toBeDefined()
    })

    it('should require updatedAt for optimistic locking', async () => {
      const request = createMockRequest('/api/projects/project-123/qa/qa-item-123', {
        method: 'PUT',
        body: {
          question: 'Updated question here?',
          // Missing updatedAt
        },
      })
      const context = createRouteContext({ id: 'project-123', itemId: 'qa-item-123' })

      const response = await PUT(request, context)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request body')
    })
  })

  // ============================================================================
  // DELETE /api/projects/[id]/qa/[itemId] Tests
  // ============================================================================

  describe('DELETE /api/projects/[id]/qa/[itemId]', () => {
    it('should delete item and return 204 (AC: #5)', async () => {
      const fetchQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'qa-item-123' }, error: null }),
      }

      const deleteQuery = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(), // Chainable eq for deal_id
      }
      // Second eq call resolves the chain
      deleteQuery.eq.mockImplementation(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }))

      let callCount = 0
      mockSupabase.from.mockImplementation(() => {
        callCount++
        if (callCount === 1) return fetchQuery
        return deleteQuery
      })

      const request = createMockRequest('/api/projects/project-123/qa/qa-item-123', {
        method: 'DELETE',
      })
      const context = createRouteContext({ id: 'project-123', itemId: 'qa-item-123' })

      const response = await DELETE(request, context)

      expect(response.status).toBe(204)
    })

    it('should return 404 if item not found', async () => {
      const fetchQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      }

      mockSupabase.from.mockReturnValue(fetchQuery)

      const request = createMockRequest('/api/projects/project-123/qa/non-existent', {
        method: 'DELETE',
      })
      const context = createRouteContext({ id: 'project-123', itemId: 'non-existent' })

      const response = await DELETE(request, context)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Q&A item not found')
    })
  })

  // ============================================================================
  // GET /api/projects/[id]/qa/summary Tests
  // ============================================================================

  describe('GET /api/projects/[id]/qa/summary', () => {
    it('should return summary statistics (AC: #7)', async () => {
      const projectQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
      }

      const qaItems = [
        { category: 'Financials', priority: 'high', date_answered: null },
        { category: 'Financials', priority: 'medium', date_answered: '2024-01-20T10:00:00Z' },
        { category: 'Legal', priority: 'low', date_answered: null },
      ]

      const summaryQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: qaItems, error: null }),
      }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'deals') return projectQuery
        return summaryQuery
      })

      const request = createMockRequest('/api/projects/project-123/qa/summary')
      const context = createRouteContext({ id: 'project-123' })

      const response = await GET_SUMMARY(request, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.summary).toBeDefined()
      expect(data.summary.total).toBe(3)
      expect(data.summary.pending).toBe(2)
      expect(data.summary.answered).toBe(1)
      expect(data.summary.byCategory.Financials).toBe(2)
      expect(data.summary.byCategory.Legal).toBe(1)
      expect(data.summary.byPriority.high).toBe(1)
      expect(data.summary.byPriority.medium).toBe(1)
      expect(data.summary.byPriority.low).toBe(1)
    })

    it('should return zeros for empty project', async () => {
      const projectQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
      }

      const summaryQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'deals') return projectQuery
        return summaryQuery
      })

      const request = createMockRequest('/api/projects/project-123/qa/summary')
      const context = createRouteContext({ id: 'project-123' })

      const response = await GET_SUMMARY(request, context)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.summary.total).toBe(0)
      expect(data.summary.pending).toBe(0)
      expect(data.summary.answered).toBe(0)
    })
  })
})
