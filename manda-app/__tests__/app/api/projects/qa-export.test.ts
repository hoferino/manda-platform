/**
 * Q&A Export API Route Tests
 * Story: E8.6 - Excel Export (AC: #1, #4, #5)
 *
 * Tests for GET /api/projects/[id]/qa/export:
 * - Returns valid .xlsx file
 * - Applies filter parameters
 * - Returns correct filename pattern
 * - Returns proper headers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Mock QA service
vi.mock('@/lib/services/qa', () => ({
  getQAItems: vi.fn(),
}))

// Mock QA export service
vi.mock('@/lib/services/qa-export', () => ({
  generateQAExport: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { getQAItems } from '@/lib/services/qa'
import { generateQAExport } from '@/lib/services/qa-export'
import { GET } from '@/app/api/projects/[id]/qa/export/route'

const mockCreateClient = vi.mocked(createClient)
const mockGetQAItems = vi.mocked(getQAItems)
const mockGenerateQAExport = vi.mocked(generateQAExport)

// Helper to create mock request
function createMockRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'))
}

// Helper to create mock context
function createMockContext(projectId: string) {
  return {
    params: Promise.resolve({ id: projectId }),
  }
}

describe('GET /api/projects/[id]/qa/export', () => {
  const mockUser = { id: 'user-1', email: 'test@example.com' }
  const mockProject = { id: 'project-1', name: 'Acme Corp' }
  const mockQAItems = [
    {
      id: '1',
      dealId: 'project-1',
      question: 'What is the revenue?',
      category: 'Financials' as const,
      priority: 'high' as const,
      answer: null,
      comment: null,
      sourceFindingId: null,
      createdBy: 'user-1',
      dateAdded: '2025-12-09T10:00:00Z',
      dateAnswered: null,
      updatedAt: '2025-12-09T10:00:00Z',
    },
  ]
  const mockExportResult = {
    buffer: Buffer.from('mock-excel-data'),
    filename: 'Acme_Corp_QA_List_2025-12-09.xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementations
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
      }),
    }

    mockCreateClient.mockResolvedValue(mockSupabase as never)
    mockGetQAItems.mockResolvedValue(mockQAItems)
    mockGenerateQAExport.mockResolvedValue(mockExportResult)
  })

  it('returns valid .xlsx file (AC #1)', async () => {
    const request = createMockRequest('http://localhost/api/projects/project-1/qa/export')
    const context = createMockContext('project-1')

    const response = await GET(request, context)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe(mockExportResult.contentType)
  })

  it('returns correct headers (AC #5)', async () => {
    const request = createMockRequest('http://localhost/api/projects/project-1/qa/export')
    const context = createMockContext('project-1')

    const response = await GET(request, context)

    expect(response.headers.get('Content-Disposition')).toContain('attachment')
    expect(response.headers.get('Content-Disposition')).toContain(mockExportResult.filename)
    expect(response.headers.get('Content-Length')).toBe(mockExportResult.buffer.length.toString())
    expect(response.headers.get('X-Export-Filename')).toBe(mockExportResult.filename)
    expect(response.headers.get('X-Export-Count')).toBe(mockQAItems.length.toString())
  })

  it('applies category filter (AC #4)', async () => {
    const request = createMockRequest('http://localhost/api/projects/project-1/qa/export?category=Financials')
    const context = createMockContext('project-1')

    await GET(request, context)

    expect(mockGetQAItems).toHaveBeenCalledWith(
      expect.anything(),
      'project-1',
      expect.objectContaining({ category: 'Financials' })
    )
  })

  it('applies priority filter (AC #4)', async () => {
    const request = createMockRequest('http://localhost/api/projects/project-1/qa/export?priority=high')
    const context = createMockContext('project-1')

    await GET(request, context)

    expect(mockGetQAItems).toHaveBeenCalledWith(
      expect.anything(),
      'project-1',
      expect.objectContaining({ priority: 'high' })
    )
  })

  it('applies status filter (AC #4)', async () => {
    const request = createMockRequest('http://localhost/api/projects/project-1/qa/export?status=pending')
    const context = createMockContext('project-1')

    await GET(request, context)

    expect(mockGetQAItems).toHaveBeenCalledWith(
      expect.anything(),
      'project-1',
      expect.objectContaining({ status: 'pending' })
    )
  })

  it('applies multiple filters (AC #4)', async () => {
    const request = createMockRequest('http://localhost/api/projects/project-1/qa/export?category=Legal&priority=medium&status=answered')
    const context = createMockContext('project-1')

    await GET(request, context)

    expect(mockGetQAItems).toHaveBeenCalledWith(
      expect.anything(),
      'project-1',
      expect.objectContaining({
        category: 'Legal',
        priority: 'medium',
        status: 'answered',
      })
    )
  })

  it('returns 401 when not authenticated', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('Not authenticated') }),
      },
    }
    mockCreateClient.mockResolvedValue(mockSupabase as never)

    const request = createMockRequest('http://localhost/api/projects/project-1/qa/export')
    const context = createMockContext('project-1')

    const response = await GET(request, context)

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Authentication required')
  })

  it('returns 404 when project not found', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
      }),
    }
    mockCreateClient.mockResolvedValue(mockSupabase as never)

    const request = createMockRequest('http://localhost/api/projects/unknown/qa/export')
    const context = createMockContext('unknown')

    const response = await GET(request, context)

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe('Project not found')
  })

  it('returns 400 when no items to export', async () => {
    mockGetQAItems.mockResolvedValue([])

    const request = createMockRequest('http://localhost/api/projects/project-1/qa/export')
    const context = createMockContext('project-1')

    const response = await GET(request, context)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('No Q&A items to export')
  })

  it('returns 400 for invalid filter parameters', async () => {
    const request = createMockRequest('http://localhost/api/projects/project-1/qa/export?category=InvalidCategory')
    const context = createMockContext('project-1')

    const response = await GET(request, context)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Invalid filter parameters')
  })

  it('generates export with project name', async () => {
    const request = createMockRequest('http://localhost/api/projects/project-1/qa/export')
    const context = createMockContext('project-1')

    await GET(request, context)

    expect(mockGenerateQAExport).toHaveBeenCalledWith(mockQAItems, 'Acme Corp')
  })

  it('uses default project name when missing', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'project-1', name: null }, error: null }),
      }),
    }
    mockCreateClient.mockResolvedValue(mockSupabase as never)

    const request = createMockRequest('http://localhost/api/projects/project-1/qa/export')
    const context = createMockContext('project-1')

    await GET(request, context)

    expect(mockGenerateQAExport).toHaveBeenCalledWith(mockQAItems, 'Project')
  })
})
