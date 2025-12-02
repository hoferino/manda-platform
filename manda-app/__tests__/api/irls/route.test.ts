/**
 * IRL Creation API Tests
 *
 * Story: E6.1 - Build IRL Builder UI with Template Selection (AC8, AC9)
 */

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { POST, GET } from '@/app/api/projects/[id]/irls/route'

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Mock the template service
vi.mock('@/lib/services/irl-templates', () => ({
  getTemplate: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { getTemplate } from '@/lib/services/irl-templates'

const mockTemplate = {
  id: 'tech-ma',
  name: 'Tech M&A',
  description: 'Tech M&A template',
  dealType: 'tech_ma',
  categories: [
    {
      name: 'Financial',
      items: [
        { name: 'Financial Statements', description: 'Annual statements', priority: 'high' },
        { name: 'Revenue Analysis', priority: 'medium' },
      ],
    },
    {
      name: 'Legal',
      items: [{ name: 'Contracts', description: 'Material contracts', priority: 'high' }],
    },
  ],
}

describe('IRL API', () => {
  let mockSupabase: any
  let mockAuth: any
  let mockProjectQuery: any
  let mockIRLInsert: any
  let mockIRLItemsInsert: any
  let mockIRLSelect: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mock auth
    mockAuth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      }),
    }

    // Setup mock project query
    mockProjectQuery = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'project-123' },
        error: null,
      }),
    }

    // Setup mock IRL insert
    // Note: The database schema uses 'name' instead of 'title'
    mockIRLInsert = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'irl-123',
          deal_id: 'project-123',
          name: 'Test IRL', // DB schema uses 'name'
          template_type: null,
          progress_percent: 0,
          sections: [],
          user_id: 'user-123',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
        error: null,
      }),
    }

    // Setup mock IRL items insert
    mockIRLItemsInsert = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'item-1',
            irl_id: 'irl-123',
            category: 'Financial',
            item_name: 'Financial Statements',
            description: 'Annual statements',
            priority: 'high',
            status: 'not_started',
            sort_order: 0,
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
          },
        ],
        error: null,
      }),
    }

    // Setup mock IRL select (for GET)
    mockIRLSelect = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'irl-123',
            deal_id: 'project-123',
            title: 'Test IRL',
            template_type: 'tech-ma',
            source_file_name: null,
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
          },
        ],
        error: null,
      }),
    }

    // Track which call number we're on
    let fromCallCount = 0

    mockSupabase = {
      auth: mockAuth,
      from: vi.fn((table: string) => {
        fromCallCount++
        if (table === 'deals') {
          return mockProjectQuery
        }
        if (table === 'irls') {
          // Check if this is an insert or select call
          if (fromCallCount === 2) {
            return mockIRLInsert
          }
          return mockIRLSelect
        }
        if (table === 'irl_items') {
          return mockIRLItemsInsert
        }
        return mockProjectQuery
      }),
    }

    ;(createClient as Mock).mockResolvedValue(mockSupabase)
  })

  describe('POST /api/projects/[id]/irls', () => {
    describe('validation', () => {
      it('should return 400 for missing title', async () => {
        const request = new NextRequest('http://localhost/api/projects/project-123/irls', {
          method: 'POST',
          body: JSON.stringify({}),
        })

        const response = await POST(request, { params: Promise.resolve({ id: 'project-123' }) })

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.error).toBe('Invalid request body')
      })

      it('should return 400 for empty title', async () => {
        const request = new NextRequest('http://localhost/api/projects/project-123/irls', {
          method: 'POST',
          body: JSON.stringify({ title: '' }),
        })

        const response = await POST(request, { params: Promise.resolve({ id: 'project-123' }) })

        expect(response.status).toBe(400)
      })
    })

    describe('authentication', () => {
      it('should return 401 if not authenticated', async () => {
        mockAuth.getUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Not authenticated' },
        })

        const request = new NextRequest('http://localhost/api/projects/project-123/irls', {
          method: 'POST',
          body: JSON.stringify({ title: 'Test IRL' }),
        })

        const response = await POST(request, { params: Promise.resolve({ id: 'project-123' }) })

        expect(response.status).toBe(401)
      })
    })

    describe('project access', () => {
      it('should return 404 if project not found', async () => {
        mockProjectQuery.single.mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        })

        const request = new NextRequest('http://localhost/api/projects/project-123/irls', {
          method: 'POST',
          body: JSON.stringify({ title: 'Test IRL' }),
        })

        const response = await POST(request, { params: Promise.resolve({ id: 'project-123' }) })

        expect(response.status).toBe(404)
      })
    })

    describe('blank IRL creation (AC9)', () => {
      it('should create blank IRL when no templateId provided', async () => {
        const request = new NextRequest('http://localhost/api/projects/project-123/irls', {
          method: 'POST',
          body: JSON.stringify({ title: 'My Custom IRL' }),
        })

        const response = await POST(request, { params: Promise.resolve({ id: 'project-123' }) })
        const data = await response.json()

        expect(response.status).toBe(201)
        expect(data.irl).toBeDefined()
        expect(data.irl.title).toBe('Test IRL')
        expect(data.items).toBeUndefined() // No items for blank IRL
      })
    })

    describe('template-based IRL creation (AC8)', () => {
      it('should create IRL with template items when templateId provided', async () => {
        ;(getTemplate as Mock).mockResolvedValue(mockTemplate)

        // Update mock to return template_type
        mockIRLInsert.single.mockResolvedValue({
          data: {
            id: 'irl-123',
            deal_id: 'project-123',
            name: 'Tech M&A IRL', // DB schema uses 'name'
            template_type: 'tech-ma',
            progress_percent: 0,
            sections: [],
            user_id: 'user-123',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
          },
          error: null,
        })

        const request = new NextRequest('http://localhost/api/projects/project-123/irls', {
          method: 'POST',
          body: JSON.stringify({ title: 'Tech M&A IRL', templateId: 'tech-ma' }),
        })

        const response = await POST(request, { params: Promise.resolve({ id: 'project-123' }) })
        const data = await response.json()

        expect(response.status).toBe(201)
        expect(data.irl).toBeDefined()
        expect(data.irl.templateType).toBe('tech-ma')
        expect(data.items).toBeDefined()
      })

      it('should return 404 if template not found', async () => {
        ;(getTemplate as Mock).mockResolvedValue(null)

        const request = new NextRequest('http://localhost/api/projects/project-123/irls', {
          method: 'POST',
          body: JSON.stringify({ title: 'Test IRL', templateId: 'non-existent' }),
        })

        const response = await POST(request, { params: Promise.resolve({ id: 'project-123' }) })

        expect(response.status).toBe(404)
        const data = await response.json()
        expect(data.error).toBe('Template not found')
      })
    })
  })

  describe('GET /api/projects/[id]/irls', () => {
    it('should return 401 if not authenticated', async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      })

      const request = new NextRequest('http://localhost/api/projects/project-123/irls')

      const response = await GET(request, { params: Promise.resolve({ id: 'project-123' }) })

      expect(response.status).toBe(401)
    })

    it('should return 404 if project not found', async () => {
      mockProjectQuery.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      const request = new NextRequest('http://localhost/api/projects/project-123/irls')

      const response = await GET(request, { params: Promise.resolve({ id: 'project-123' }) })

      expect(response.status).toBe(404)
    })
  })
})
