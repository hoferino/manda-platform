/**
 * Findings Validate API Tests
 * Story: E4.3 - Implement Inline Finding Validation (AC: 5)
 *
 * Tests:
 * - POST validates a finding (confirm/reject)
 * - Confidence increases on confirm
 * - Validation history is recorded
 * - Authentication required
 * - Returns 404 for non-existent finding
 * - Returns 400 for invalid action
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/projects/[id]/findings/[findingId]/validate/route'

// Mock Supabase
const mockSupabaseUser = { id: 'user-123' }
const mockFinding = {
  id: 'finding-456',
  deal_id: 'project-789',
  document_id: 'doc-001',
  chunk_id: null,
  user_id: 'user-123',
  text: 'Test finding',
  source_document: 'test.pdf',
  page_number: 1,
  confidence: 0.8,
  finding_type: 'fact',
  domain: 'financial',
  status: 'pending',
  validation_history: [],
  metadata: {},
  created_at: '2025-11-28T10:00:00Z',
  updated_at: null,
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

describe('POST /api/projects/[id]/findings/[findingId]/validate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockSupabaseUser },
      error: null,
    })
  })

  const createRequest = (body: unknown) => {
    return new NextRequest('http://localhost/api/projects/project-789/findings/finding-456/validate', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const createContext = () => ({
    params: Promise.resolve({ id: 'project-789', findingId: 'finding-456' }),
  })

  describe('Confirm Action (AC: 5)', () => {
    it('validates finding and increases confidence', async () => {
      const updatedFinding = {
        ...mockFinding,
        status: 'validated',
        confidence: 0.85,
        validation_history: [{ action: 'validated', timestamp: expect.any(String), userId: 'user-123' }],
      }

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'deals') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'project-789' }, error: null }),
          }
        }
        if (table === 'findings') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValueOnce({ data: mockFinding, error: null }),
            update: vi.fn().mockReturnThis(),
          }
        }
        return {}
      })

      // Need to setup the update chain properly
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'deals') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'project-789' }, error: null }),
          }
        }
        if (table === 'findings') {
          const selectChain = {
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValueOnce({ data: mockFinding, error: null })
              .mockResolvedValueOnce({ data: updatedFinding, error: null }),
          }
          const updateChain = {
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: updatedFinding, error: null }),
          }
          return {
            select: vi.fn().mockReturnValue(selectChain),
            update: vi.fn().mockReturnValue(updateChain),
          }
        }
        return {}
      })

      const request = createRequest({ action: 'confirm' })
      const response = await POST(request, createContext())
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.finding.status).toBe('validated')
      expect(json.finding.confidence).toBe(0.85)
    })
  })

  describe('Reject Action (AC: 5)', () => {
    it('rejects finding without changing confidence', async () => {
      const updatedFinding = {
        ...mockFinding,
        status: 'rejected',
        confidence: 0.8, // Unchanged
      }

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'deals') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'project-789' }, error: null }),
          }
        }
        if (table === 'findings') {
          const selectChain = {
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockFinding, error: null }),
          }
          const updateChain = {
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: updatedFinding, error: null }),
          }
          return {
            select: vi.fn().mockReturnValue(selectChain),
            update: vi.fn().mockReturnValue(updateChain),
          }
        }
        return {}
      })

      const request = createRequest({ action: 'reject' })
      const response = await POST(request, createContext())
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.finding.status).toBe('rejected')
      expect(json.finding.confidence).toBe(0.8)
    })
  })

  describe('Validation', () => {
    it('returns 400 for invalid action', async () => {
      const request = createRequest({ action: 'invalid' })
      const response = await POST(request, createContext())

      expect(response.status).toBe(400)
    })

    it('returns 400 for missing action', async () => {
      const request = createRequest({})
      const response = await POST(request, createContext())

      expect(response.status).toBe(400)
    })

    it('returns 400 for invalid JSON', async () => {
      const request = new NextRequest('http://localhost/api/projects/project-789/findings/finding-456/validate', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' },
      })
      const response = await POST(request, createContext())

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toContain('Invalid JSON')
    })
  })

  describe('Authentication', () => {
    it('returns 401 for unauthenticated request', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      })

      const request = createRequest({ action: 'confirm' })
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

      const request = createRequest({ action: 'confirm' })
      const response = await POST(request, createContext())

      expect(response.status).toBe(404)
      const json = await response.json()
      expect(json.error).toBe('Project not found')
    })

    it('returns 404 for non-existent finding', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'deals') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'project-789' }, error: null }),
          }
        }
        if (table === 'findings') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }
        }
        return {}
      })

      const request = createRequest({ action: 'confirm' })
      const response = await POST(request, createContext())

      expect(response.status).toBe(404)
      const json = await response.json()
      expect(json.error).toBe('Finding not found')
    })
  })
})
