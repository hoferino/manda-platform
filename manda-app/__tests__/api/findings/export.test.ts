/**
 * Findings Export API Tests
 * Story: E4.10 - Implement Export Findings to CSV/Excel (AC: #2, #3, #6)
 * Story: E4.12 - Implement Export Findings Feature (Advanced) (AC: #4, #5, #6, #8)
 *
 * Tests:
 * - Validates request body format
 * - Authentication required
 * - Returns 404 for non-existent project
 * - Field selection support
 * - Export scope (all, filtered, selected)
 * - Report format generation
 * - Filter criteria inclusion
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/projects/[id]/findings/export/route'

// Mock Supabase
const mockSupabaseUser = { id: 'user-123' }
// Use valid v4 UUIDs (version nibble = 4, variant nibble = 8-b)
const MOCK_FINDING_ID_1 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
const MOCK_FINDING_ID_2 = '550e8400-e29b-41d4-a716-446655440000'
const mockFindings = [
  {
    id: MOCK_FINDING_ID_1,
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
  {
    id: MOCK_FINDING_ID_2,
    deal_id: 'project-789',
    document_id: 'doc-002',
    chunk_id: null,
    user_id: 'user-123',
    text: 'Legal risk identified in contract clause 5.2',
    source_document: 'contract.pdf',
    page_number: 12,
    confidence: 0.75,
    finding_type: 'risk',
    domain: 'legal',
    status: 'pending',
    validation_history: [],
    metadata: {},
    created_at: '2025-11-28T11:00:00Z',
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

  const setupSuccessMocks = () => {
    mockSupabaseClient.from.mockImplementation((table) => {
      if (table === 'deals') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
        }
      }
      if (table === 'findings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockFindings, error: null }),
        }
      }
      return {}
    })
  }

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

    it('accepts csv format', async () => {
      setupSuccessMocks()
      const request = createRequest({ format: 'csv' })
      const response = await POST(request, createContext())

      expect(response.status).toBe(200)
    })

    it('accepts xlsx format', async () => {
      setupSuccessMocks()
      const request = createRequest({ format: 'xlsx' })
      const response = await POST(request, createContext())

      expect(response.status).toBe(200)
    })

    it('accepts report format', async () => {
      setupSuccessMocks()
      const request = createRequest({ format: 'report' })
      const response = await POST(request, createContext())

      expect(response.status).toBe(200)
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

  describe('Field Selection (E4.12)', () => {
    it('exports with default fields when not specified', async () => {
      setupSuccessMocks()
      const request = createRequest({ format: 'csv' })
      const response = await POST(request, createContext())

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toContain('text/csv')
    })

    it('accepts custom field selection', async () => {
      setupSuccessMocks()
      const request = createRequest({
        format: 'csv',
        fields: ['text', 'domain'],
      })
      const response = await POST(request, createContext())

      expect(response.status).toBe(200)
    })

    it('returns 400 when all fields are invalid', async () => {
      setupSuccessMocks()
      const request = createRequest({
        format: 'csv',
        fields: ['invalid1', 'invalid2'],
      })
      const response = await POST(request, createContext())

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('At least one valid field must be selected')
    })

    it('filters out invalid fields but keeps valid ones', async () => {
      setupSuccessMocks()
      const request = createRequest({
        format: 'csv',
        fields: ['text', 'invalid_field', 'domain'],
      })
      const response = await POST(request, createContext())

      expect(response.status).toBe(200)
    })
  })

  describe('Export Scope (E4.12)', () => {
    it('defaults to filtered scope', async () => {
      setupSuccessMocks()
      const request = createRequest({ format: 'csv' })
      await POST(request, createContext())

      // Verify query was built (via mock inspection)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('findings')
    })

    it('exports all findings for all scope', async () => {
      setupSuccessMocks()
      const request = createRequest({
        format: 'csv',
        scope: 'all',
      })
      const response = await POST(request, createContext())

      expect(response.status).toBe(200)
    })

    it('exports filtered findings for filtered scope', async () => {
      setupSuccessMocks()
      const request = createRequest({
        format: 'csv',
        scope: 'filtered',
        filters: {
          domain: ['financial'],
        },
      })
      const response = await POST(request, createContext())

      expect(response.status).toBe(200)
    })

    it('exports selected findings for selected scope', async () => {
      setupSuccessMocks()
      const request = createRequest({
        format: 'csv',
        scope: 'selected',
        findingIds: [MOCK_FINDING_ID_1], // UUID format required
      })
      const response = await POST(request, createContext())

      expect(response.status).toBe(200)
    })

    it('returns 400 for selected scope without findingIds', async () => {
      setupSuccessMocks()
      const request = createRequest({
        format: 'csv',
        scope: 'selected',
      })
      const response = await POST(request, createContext())

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('findingIds required for selected scope')
    })

    it('returns 400 for selected scope with empty findingIds', async () => {
      setupSuccessMocks()
      const request = createRequest({
        format: 'csv',
        scope: 'selected',
        findingIds: [],
      })
      const response = await POST(request, createContext())

      expect(response.status).toBe(400)
    })
  })

  describe('Filter Criteria Inclusion (E4.12)', () => {
    it('accepts includeFilterCriteria true', async () => {
      setupSuccessMocks()
      const request = createRequest({
        format: 'csv',
        includeFilterCriteria: true,
        filters: {
          domain: ['financial'],
        },
      })
      const response = await POST(request, createContext())

      expect(response.status).toBe(200)
    })

    it('accepts includeFilterCriteria with search query', async () => {
      setupSuccessMocks()
      const request = createRequest({
        format: 'csv',
        includeFilterCriteria: true,
        searchQuery: 'revenue',
      })
      const response = await POST(request, createContext())

      expect(response.status).toBe(200)
    })

    it('accepts includeFilterCriteria false', async () => {
      setupSuccessMocks()
      const request = createRequest({
        format: 'csv',
        includeFilterCriteria: false,
      })
      const response = await POST(request, createContext())

      expect(response.status).toBe(200)
    })
  })

  describe('Report Format (E4.12)', () => {
    it('generates HTML report with correct content type', async () => {
      setupSuccessMocks()
      const request = createRequest({ format: 'report' })
      const response = await POST(request, createContext())

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
    })

    it('generates report with filter criteria when requested', async () => {
      setupSuccessMocks()
      const request = createRequest({
        format: 'report',
        includeFilterCriteria: true,
        filters: {
          domain: ['financial'],
        },
      })
      const response = await POST(request, createContext())

      expect(response.status).toBe(200)
    })
  })

  describe('Response Headers (E4.12)', () => {
    it('includes X-Export-Count header', async () => {
      setupSuccessMocks()
      const request = createRequest({ format: 'csv' })
      const response = await POST(request, createContext())

      expect(response.headers.get('X-Export-Count')).toBe('2')
    })

    it('includes X-Export-Filename header for filtered scope', async () => {
      setupSuccessMocks()
      const request = createRequest({
        format: 'csv',
        scope: 'filtered',
      })
      const response = await POST(request, createContext())

      const filename = response.headers.get('X-Export-Filename')
      expect(filename).toBeTruthy()
      expect(filename).toContain('findings-filtered-')
      expect(filename).toContain('.csv')
    })

    it('includes X-Export-Filename header for all scope', async () => {
      setupSuccessMocks()
      const request = createRequest({
        format: 'csv',
        scope: 'all',
      })
      const response = await POST(request, createContext())

      const filename = response.headers.get('X-Export-Filename')
      expect(filename).toBeTruthy()
      expect(filename).toContain('findings-all-')
      expect(filename).toContain('.csv')
    })

    it('includes correct content type for xlsx', async () => {
      setupSuccessMocks()
      const request = createRequest({ format: 'xlsx' })
      const response = await POST(request, createContext())

      expect(response.headers.get('Content-Type')).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
    })

    it('includes correct content type for report (html)', async () => {
      setupSuccessMocks()
      const request = createRequest({ format: 'report' })
      const response = await POST(request, createContext())

      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
    })

    it('includes Content-Disposition header', async () => {
      setupSuccessMocks()
      const request = createRequest({ format: 'csv' })
      const response = await POST(request, createContext())

      const disposition = response.headers.get('Content-Disposition')
      expect(disposition).toBeTruthy()
      expect(disposition).toContain('attachment')
      expect(disposition).toContain('filename=')
    })
  })

  describe('No Findings', () => {
    it('returns 400 when no findings to export', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'deals') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
          }
        }
        if (table === 'findings') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
        return {}
      })

      const request = createRequest({ format: 'csv' })
      const response = await POST(request, createContext())

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('No findings to export')
    })
  })
})
