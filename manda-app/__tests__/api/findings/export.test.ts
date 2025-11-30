/**
 * Findings Export API Tests
 * Story: E4.10 - Implement Export Findings to CSV/Excel (AC: #2, #3, #6)
 *
 * Tests:
 * - Validates request body format
 * - Authentication required
 * - Returns 404 for non-existent project
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/projects/[id]/findings/export/route'

// Mock Supabase
const mockSupabaseUser = { id: 'user-123' }
const mockFindings = [
  {
    id: 'finding-1',
    deal_id: 'project-789',
    document_id: 'doc-001',
    chunk_id: null,
    user_id: 'user-123',
    text: 'Revenue increased by 15% YoY',
    source_document: 'financial_model.xlsx',
    page_number: 1,
    confidence: 0.9,
    finding_type: 'metric',
    domain: 'financial',
    status: 'validated',
    validation_history: [],
    metadata: {},
    created_at: '2025-11-28T10:00:00Z',
    updated_at: null,
  },
]

const mockProject = {
  id: 'project-789',
  name: 'Test Deal Project',
}

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}))

describe('POST /api/projects/[id]/findings/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockSupabaseUser },
      error: null,
    })
  })

  const createRequest = (body: unknown) => {
    return new NextRequest('http://localhost/api/projects/project-789/findings/export', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const createContext = () => ({
    params: Promise.resolve({ id: 'project-789' }),
  })

  describe('Validation', () => {
    it('returns 400 for invalid format', async () => {
      const request = createRequest({ format: 'invalid' })
      const response = await POST(request, createContext())

      expect(response.status).toBe(400)
    })

    it('returns 400 for missing format', async () => {
      const request = createRequest({})
      const response = await POST(request, createContext())

      expect(response.status).toBe(400)
    })
  })

  describe('Authentication', () => {
    it('returns 401 for unauthenticated request', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      })

      const request = createRequest({ format: 'csv' })
      const response = await POST(request, createContext())

      expect(response.status).toBe(401)
    })
  })

  describe('Not Found', () => {
    it('returns 404 for non-existent project', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'deals') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }
        }
        return {}
      })

      const request = createRequest({ format: 'csv' })
      const response = await POST(request, createContext())

      expect(response.status).toBe(404)
      const json = await response.json()
      expect(json.error).toBe('Project not found')
    })
  })
})
