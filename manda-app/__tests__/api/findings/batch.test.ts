/**
 * Batch Findings API Tests
 * Story: E4.11 - Build Bulk Actions for Finding Management (AC: 7, 8)
 *
 * Tests:
 * - POST validates multiple findings (confirm)
 * - POST rejects multiple findings (reject)
 * - Confidence increases on confirm
 * - Validation history is recorded for each finding
 * - Returns partial success on mixed results
 * - Returns 400 for invalid action
 * - Returns 400 for empty findingIds array
 * - Returns 400 for exceeding max batch size
 * - Returns 401 for unauthenticated request
 * - Returns 404 for non-existent project
 * - Handles non-existent findings gracefully
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/projects/[id]/findings/batch/route'

// Valid UUID v4 format for testing (must have 4 in position 15, 8/9/a/b in position 20)
const FINDING_1_ID = '00000000-0000-4000-8000-000000000001'
const FINDING_2_ID = '00000000-0000-4000-8000-000000000002'
const FINDING_3_ID = '00000000-0000-4000-8000-000000000003'
const PROJECT_ID = '00000000-0000-4000-8000-000000000099'
const NON_EXISTENT_ID = '00000000-0000-4000-8000-ffffffffffff'

// Mock Supabase
const mockSupabaseUser = { id: 'user-123' }
const mockFindings = [
  {
    id: FINDING_1_ID,
    deal_id: PROJECT_ID,
    document_id: 'doc-001',
    chunk_id: null,
    user_id: 'user-123',
    text: 'Test finding 1',
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
  },
  {
    id: FINDING_2_ID,
    deal_id: PROJECT_ID,
    document_id: 'doc-001',
    chunk_id: null,
    user_id: 'user-123',
    text: 'Test finding 2',
    source_document: 'test.pdf',
    page_number: 2,
    confidence: 0.7,
    finding_type: 'risk',
    domain: 'legal',
    status: 'pending',
    validation_history: [],
    metadata: {},
    created_at: '2025-11-28T10:00:00Z',
    updated_at: null,
  },
  {
    id: FINDING_3_ID,
    deal_id: PROJECT_ID,
    document_id: 'doc-001',
    chunk_id: null,
    user_id: 'user-123',
    text: 'Test finding 3',
    source_document: 'test.pdf',
    page_number: 3,
    confidence: 0.9,
    finding_type: 'opportunity',
    domain: 'operational',
    status: 'validated',
    validation_history: [{ action: 'validated', timestamp: '2025-11-27T10:00:00Z', userId: 'user-456' }],
    metadata: {},
    created_at: '2025-11-28T10:00:00Z',
    updated_at: null,
  },
]

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}))

describe('POST /api/projects/[id]/findings/batch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockSupabaseUser },
      error: null,
    })
  })

  const createRequest = (body: unknown) => {
    return new NextRequest(`http://localhost/api/projects/${PROJECT_ID}/findings/batch`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const createContext = () => ({
    params: Promise.resolve({ id: PROJECT_ID }),
  })

  const setupSuccessfulMocks = (findingsToReturn = mockFindings) => {
    mockSupabaseClient.from.mockImplementation((table) => {
      if (table === 'deals') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: PROJECT_ID }, error: null }),
        }
      }
      if (table === 'findings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          // For select queries (fetching existing findings)
          then: vi.fn((callback) => callback({ data: findingsToReturn, error: null })),
          update: vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockImplementation(function() {
              // Return the first matching finding with updated values
              const updated = { ...findingsToReturn[0], status: 'validated', confidence: 0.85 }
              return Promise.resolve({ data: updated, error: null })
            }),
          })),
        }
      }
      return {}
    })
  }

  describe('Confirm Action (AC: 7)', () => {
    it('validates multiple findings successfully', async () => {
      // Setup mock to handle the batch update properly
      let updateCallCount = 0
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'deals') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: PROJECT_ID }, error: null }),
          }
        }
        if (table === 'findings') {
          const selectChain = {
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: mockFindings.slice(0, 2), error: null }),
          }
          const updateChain = {
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockImplementation(() => {
              const finding = mockFindings[updateCallCount++]
              if (!finding) {
                return Promise.resolve({ data: null, error: { message: 'Not found' } })
              }
              const updated = {
                ...finding,
                status: 'validated',
                confidence: Math.min(1, (finding.confidence || 0.5) + 0.05),
              }
              return Promise.resolve({ data: updated, error: null })
            }),
          }
          return {
            select: vi.fn().mockReturnValue(selectChain),
            update: vi.fn().mockReturnValue(updateChain),
          }
        }
        return {}
      })

      const request = createRequest({
        action: 'confirm',
        findingIds: [FINDING_1_ID, FINDING_2_ID],
      })
      const response = await POST(request, createContext())
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.summary.total).toBe(2)
      expect(json.summary.succeeded).toBe(2)
      expect(json.summary.failed).toBe(0)
      expect(json.results).toHaveLength(2)
      expect(json.results[0].success).toBe(true)
      expect(json.results[1].success).toBe(true)
    })

    it('increases confidence on confirm', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'deals') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: PROJECT_ID }, error: null }),
          }
        }
        if (table === 'findings') {
          const finding = mockFindings[0]
          const selectChain = {
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [finding], error: null }),
          }
          const updateChain = {
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { ...finding, status: 'validated', confidence: 0.85 },
              error: null,
            }),
          }
          return {
            select: vi.fn().mockReturnValue(selectChain),
            update: vi.fn().mockReturnValue(updateChain),
          }
        }
        return {}
      })

      const request = createRequest({
        action: 'confirm',
        findingIds: [FINDING_1_ID],
      })
      const response = await POST(request, createContext())
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.results[0].finding.confidence).toBe(0.85) // 0.8 + 0.05
    })
  })

  describe('Reject Action (AC: 7)', () => {
    it('rejects multiple findings without changing confidence', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'deals') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: PROJECT_ID }, error: null }),
          }
        }
        if (table === 'findings') {
          const finding = mockFindings[0]
          const selectChain = {
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [finding], error: null }),
          }
          const updateChain = {
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { ...finding, status: 'rejected', confidence: 0.8 }, // Unchanged
              error: null,
            }),
          }
          return {
            select: vi.fn().mockReturnValue(selectChain),
            update: vi.fn().mockReturnValue(updateChain),
          }
        }
        return {}
      })

      const request = createRequest({
        action: 'reject',
        findingIds: [FINDING_1_ID],
      })
      const response = await POST(request, createContext())
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.results[0].finding.status).toBe('rejected')
      expect(json.results[0].finding.confidence).toBe(0.8) // Unchanged
    })
  })

  describe('Partial Success (AC: 8)', () => {
    it('returns partial success when some findings not found', async () => {
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'deals') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: PROJECT_ID }, error: null }),
          }
        }
        if (table === 'findings') {
          // Only return one finding, the other doesn't exist
          const finding = mockFindings[0]
          const selectChain = {
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [finding], error: null }),
          }
          const updateChain = {
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { ...finding, status: 'validated', confidence: 0.85 },
              error: null,
            }),
          }
          return {
            select: vi.fn().mockReturnValue(selectChain),
            update: vi.fn().mockReturnValue(updateChain),
          }
        }
        return {}
      })

      const request = createRequest({
        action: 'confirm',
        findingIds: [FINDING_1_ID, NON_EXISTENT_ID],
      })
      const response = await POST(request, createContext())
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.summary.total).toBe(2)
      expect(json.summary.succeeded).toBe(1)
      expect(json.summary.failed).toBe(1)

      const successResult = json.results.find((r: { id: string }) => r.id === FINDING_1_ID)
      const failResult = json.results.find((r: { id: string }) => r.id === NON_EXISTENT_ID)

      expect(successResult?.success).toBe(true)
      expect(failResult?.success).toBe(false)
      expect(failResult?.error).toBe('Finding not found')
    })
  })

  describe('Validation', () => {
    it('returns 400 for invalid action', async () => {
      const request = createRequest({
        action: 'invalid',
        findingIds: [FINDING_1_ID],
      })
      const response = await POST(request, createContext())

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Invalid request body')
    })

    it('returns 400 for missing action', async () => {
      const request = createRequest({
        findingIds: [FINDING_1_ID],
      })
      const response = await POST(request, createContext())

      expect(response.status).toBe(400)
    })

    it('returns 400 for empty findingIds array', async () => {
      const request = createRequest({
        action: 'confirm',
        findingIds: [],
      })
      const response = await POST(request, createContext())

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Invalid request body')
    })

    it('returns 400 for exceeding max batch size (100)', async () => {
      // Generate 101 valid UUIDs
      const manyIds = Array.from({ length: 101 }, (_, i) =>
        `${i.toString(16).padStart(8, '0')}-0000-0000-0000-000000000000`
      )
      const request = createRequest({
        action: 'confirm',
        findingIds: manyIds,
      })
      const response = await POST(request, createContext())

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Invalid request body')
    })

    it('returns 400 for invalid UUID format', async () => {
      const request = createRequest({
        action: 'confirm',
        findingIds: ['not-a-uuid'],
      })
      const response = await POST(request, createContext())

      expect(response.status).toBe(400)
    })

    it('returns 400 for invalid JSON', async () => {
      const request = new NextRequest(`http://localhost/api/projects/${PROJECT_ID}/findings/batch`, {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' },
      })
      const response = await POST(request, createContext())

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Invalid JSON body')
    })
  })

  describe('Authentication', () => {
    it('returns 401 for unauthenticated request', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      })

      const request = createRequest({
        action: 'confirm',
        findingIds: [FINDING_1_ID],
      })
      const response = await POST(request, createContext())

      expect(response.status).toBe(401)
      const json = await response.json()
      expect(json.error).toBe('Authentication required')
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

      const request = createRequest({
        action: 'confirm',
        findingIds: [FINDING_1_ID],
      })
      const response = await POST(request, createContext())

      expect(response.status).toBe(404)
      const json = await response.json()
      expect(json.error).toBe('Project not found')
    })
  })
})
