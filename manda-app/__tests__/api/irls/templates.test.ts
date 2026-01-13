/**
 * IRL Templates API Tests
 *
 * Story: E6.1 - Build IRL Builder UI with Template Selection
 * ACs: 4, 5
 */

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as listTemplatesHandler } from '@/app/api/projects/[id]/irls/templates/route'
import { GET as getTemplateHandler } from '@/app/api/projects/[id]/irls/templates/[templateId]/route'

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Mock the template service
vi.mock('@/lib/services/irl-templates', () => ({
  listTemplates: vi.fn(),
  getTemplate: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { listTemplates, getTemplate } from '@/lib/services/irl-templates'

const mockTemplates = [
  {
    id: 'tech-ma',
    name: 'Tech M&A',
    description: 'Tech M&A template',
    dealType: 'tech_ma',
    categories: [
      {
        name: 'Financial',
        items: [
          { name: 'Financial Statements', description: 'Annual statements', priority: 'high' },
          { name: 'Revenue Analysis', description: 'Revenue breakdown', priority: 'high' },
        ],
      },
    ],
  },
  {
    id: 'industrial',
    name: 'Industrial',
    description: 'Industrial template',
    dealType: 'industrial',
    categories: [
      {
        name: 'Operations',
        items: [
          { name: 'Plant List', description: 'Manufacturing facilities', priority: 'high' },
        ],
      },
    ],
  },
]

describe('IRL Templates API', () => {
  let mockSupabase: Record<string, unknown>
  let mockAuth: { getUser: ReturnType<typeof vi.fn> }
  let mockQuery: Record<string, ReturnType<typeof vi.fn>>

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mock auth
    mockAuth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      }),
    }

    // Setup mock query builder
    mockQuery = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'project-123' },
        error: null,
      }),
    }

    mockSupabase = {
      auth: mockAuth,
      from: vi.fn(() => mockQuery),
    }

    ;(createClient as Mock).mockResolvedValue(mockSupabase)
  })

  describe('GET /api/projects/[id]/irls/templates', () => {
    it('should return all templates (AC4)', async () => {
      ;(listTemplates as Mock).mockResolvedValue(mockTemplates)

      const request = new NextRequest('http://localhost/api/projects/project-123/irls/templates')
      const response = await listTemplatesHandler(request, { params: Promise.resolve({ id: 'project-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.templates).toHaveLength(2)
      expect(data.templates[0].id).toBe('tech-ma')
      expect(data.templates[1].id).toBe('industrial')
    })

    it('should include item counts in response', async () => {
      ;(listTemplates as Mock).mockResolvedValue(mockTemplates)

      const request = new NextRequest('http://localhost/api/projects/project-123/irls/templates')
      const response = await listTemplatesHandler(request, { params: Promise.resolve({ id: 'project-123' }) })
      const data = await response.json()

      expect(data.templates[0].totalItems).toBe(2)
      expect(data.templates[0].categoryCount).toBe(1)
    })

    it('should require authentication', async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      })

      const request = new NextRequest('http://localhost/api/projects/project-123/irls/templates')
      const response = await listTemplatesHandler(request, { params: Promise.resolve({ id: 'project-123' }) })

      expect(response.status).toBe(401)
    })

    it('should verify project access', async () => {
      mockQuery.single!.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      const request = new NextRequest('http://localhost/api/projects/project-123/irls/templates')
      const response = await listTemplatesHandler(request, { params: Promise.resolve({ id: 'project-123' }) })

      expect(response.status).toBe(404)
    })

    it('should handle service errors gracefully', async () => {
      ;(listTemplates as Mock).mockRejectedValue(new Error('Service error'))

      const request = new NextRequest('http://localhost/api/projects/project-123/irls/templates')
      const response = await listTemplatesHandler(request, { params: Promise.resolve({ id: 'project-123' }) })

      expect(response.status).toBe(500)
    })
  })

  describe('GET /api/projects/[id]/irls/templates/[templateId]', () => {
    it('should return a single template', async () => {
      ;(getTemplate as Mock).mockResolvedValue(mockTemplates[0])

      const request = new NextRequest('http://localhost/api/projects/project-123/irls/templates/tech-ma')
      const response = await getTemplateHandler(request, {
        params: Promise.resolve({ id: 'project-123', templateId: 'tech-ma' }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.template.id).toBe('tech-ma')
      expect(data.template.name).toBe('Tech M&A')
    })

    it('should return 404 for non-existent template', async () => {
      ;(getTemplate as Mock).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/projects/project-123/irls/templates/non-existent')
      const response = await getTemplateHandler(request, {
        params: Promise.resolve({ id: 'project-123', templateId: 'non-existent' }),
      })

      expect(response.status).toBe(404)
    })

    it('should include item counts in single template response', async () => {
      ;(getTemplate as Mock).mockResolvedValue(mockTemplates[0])

      const request = new NextRequest('http://localhost/api/projects/project-123/irls/templates/tech-ma')
      const response = await getTemplateHandler(request, {
        params: Promise.resolve({ id: 'project-123', templateId: 'tech-ma' }),
      })
      const data = await response.json()

      expect(data.template.totalItems).toBe(2)
      expect(data.template.categoryCount).toBe(1)
    })

    it('should require authentication', async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      })

      const request = new NextRequest('http://localhost/api/projects/project-123/irls/templates/tech-ma')
      const response = await getTemplateHandler(request, {
        params: Promise.resolve({ id: 'project-123', templateId: 'tech-ma' }),
      })

      expect(response.status).toBe(401)
    })
  })
})
