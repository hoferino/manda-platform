/**
 * Chat v2 API Route - Unit Tests
 *
 * Story: 1-4 Implement Thread ID Generation and Management (AC: #1)
 *
 * Tests:
 * - New conversation generates conversationId
 * - Existing conversationId is reused
 * - Thread ID format matches pattern
 * - Validation errors return 400
 * - Auth errors return 401
 * - Deal not found returns 404
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../route'

// =============================================================================
// Mocks
// =============================================================================

// Mock Supabase client
const mockGetUser = vi.fn()
const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: () => mockFrom(),
  }),
}))

// Mock v2 agent exports
const mockSafeStreamAgent = vi.fn()

vi.mock('@/lib/agent/v2', async () => {
  const actual = await vi.importActual('@/lib/agent/v2')
  return {
    ...actual,
    safeStreamAgent: (...args: unknown[]) => mockSafeStreamAgent(...args),
  }
})

// =============================================================================
// Test Helpers
// =============================================================================

function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/projects/test-deal-id/chat-v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

function createContext(dealId = 'test-deal-id') {
  return {
    params: Promise.resolve({ id: dealId }),
  }
}

function setupAuthenticatedUser(userId = 'test-user-id') {
  mockGetUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  })
}

function setupDeal(dealId = 'test-deal-id', dealName = 'Test Deal') {
  mockFrom.mockReturnValue({
    select: () => mockSelect(),
  })
  mockSelect.mockReturnValue({
    eq: () => mockEq(),
  })
  mockEq.mockReturnValue({
    single: () => mockSingle(),
  })
  mockSingle.mockResolvedValue({
    data: { id: dealId, name: dealName },
    error: null,
  })
}

function setupDealNotFound() {
  mockFrom.mockReturnValue({
    select: () => mockSelect(),
  })
  mockSelect.mockReturnValue({
    eq: () => mockEq(),
  })
  mockEq.mockReturnValue({
    single: () => mockSingle(),
  })
  mockSingle.mockResolvedValue({
    data: null,
    error: { message: 'Deal not found' },
  })
}

async function* mockStreamGenerator() {
  yield { event: 'on_chat_model_stream', data: { chunk: 'Hello' } }
  yield { event: 'on_chat_model_stream', data: { chunk: ' World' } }
}

// =============================================================================
// Tests
// =============================================================================

describe('POST /api/projects/[id]/chat-v2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: streaming works
    mockSafeStreamAgent.mockImplementation(() => mockStreamGenerator())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Authentication (AC: #3)', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'No session' },
      })

      const request = createRequest({ message: 'Hello' })
      const response = await POST(request, createContext())

      expect(response.status).toBe(401)
      const json = await response.json()
      expect(json.error).toBe('Unauthorized')
    })

    it('returns 401 when auth error occurs', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Auth error' },
      })

      const request = createRequest({ message: 'Hello' })
      const response = await POST(request, createContext())

      expect(response.status).toBe(401)
    })
  })

  describe('Deal Access (AC: #3)', () => {
    beforeEach(() => {
      setupAuthenticatedUser()
    })

    it('returns 404 when deal is not found', async () => {
      setupDealNotFound()

      const request = createRequest({ message: 'Hello' })
      const response = await POST(request, createContext())

      expect(response.status).toBe(404)
      const json = await response.json()
      expect(json.error).toBe('Deal not found')
    })

    it('proceeds when deal exists and user has access', async () => {
      setupDeal()

      const request = createRequest({ message: 'Hello' })
      const response = await POST(request, createContext())

      // Should return SSE stream, not JSON error
      expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    })
  })

  describe('Request Validation (AC: #1)', () => {
    beforeEach(() => {
      setupAuthenticatedUser()
      setupDeal()
    })

    it('returns 400 when message is missing', async () => {
      const request = createRequest({})
      const response = await POST(request, createContext())

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Invalid request')
      expect(json.details.message).toBeDefined()
    })

    it('returns 400 when message is empty', async () => {
      const request = createRequest({ message: '' })
      const response = await POST(request, createContext())

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Invalid request')
    })

    it('returns 400 when conversationId is not a valid UUID', async () => {
      const request = createRequest({
        message: 'Hello',
        conversationId: 'invalid-not-uuid',
      })
      const response = await POST(request, createContext())

      expect(response.status).toBe(400)
    })

    it('returns 400 when workflowMode is invalid', async () => {
      const request = createRequest({
        message: 'Hello',
        workflowMode: 'invalid_mode',
      })
      const response = await POST(request, createContext())

      expect(response.status).toBe(400)
    })

    it('returns 400 when body is not valid JSON', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/projects/test-deal-id/chat-v2',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'not valid json',
        }
      )

      const response = await POST(request, createContext())

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe('Invalid JSON body')
    })
  })

  describe('Conversation ID Generation (AC: #1)', () => {
    beforeEach(() => {
      setupAuthenticatedUser()
      setupDeal()
    })

    it('generates new conversationId when not provided', async () => {
      const request = createRequest({ message: 'Hello' })
      const response = await POST(request, createContext())

      expect(response.headers.get('Content-Type')).toBe('text/event-stream')

      const conversationId = response.headers.get('X-Conversation-Id')
      expect(conversationId).toBeDefined()
      expect(conversationId).not.toBe('')

      // Should be a valid UUID format
      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      expect(conversationId).toMatch(uuidPattern)
    })

    it('reuses existing conversationId when provided', async () => {
      const existingConversationId = '550e8400-e29b-41d4-a716-446655440000'
      const request = createRequest({
        message: 'Hello',
        conversationId: existingConversationId,
      })
      const response = await POST(request, createContext())

      const returnedConversationId = response.headers.get('X-Conversation-Id')
      expect(returnedConversationId).toBe(existingConversationId)
    })
  })

  describe('Thread ID Format (AC: #1)', () => {
    beforeEach(() => {
      setupAuthenticatedUser('user-123')
      setupDeal('deal-456')
    })

    it('calls streamAgent with correct thread ID format', async () => {
      const conversationId = '550e8400-e29b-41d4-a716-446655440000'
      const request = createRequest({
        message: 'Hello',
        conversationId,
        workflowMode: 'chat',
      })

      await POST(request, createContext('deal-456'))

      // Verify streamAgent was called with the correct thread ID format
      expect(mockSafeStreamAgent).toHaveBeenCalledWith(
        expect.any(Object), // state
        'chat:deal-456:user-123:550e8400-e29b-41d4-a716-446655440000', // thread ID
        expect.any(Object) // config
      )
    })

    it('uses : delimiter to support UUIDs with hyphens', async () => {
      const conversationId = '550e8400-e29b-41d4-a716-446655440000'
      const request = createRequest({
        message: 'Hello',
        conversationId,
      })

      await POST(request, createContext('deal-456'))

      // The thread ID should use : as delimiter (not -)
      const threadId = mockSafeStreamAgent.mock.calls[0]![1]
      expect(threadId).toContain(':')
      expect(threadId.split(':').length).toBe(4) // mode:dealId:userId:conversationId
    })
  })

  describe('SSE Streaming (AC: #1, #2)', () => {
    beforeEach(() => {
      setupAuthenticatedUser()
      setupDeal()
    })

    it('returns proper SSE headers', async () => {
      const request = createRequest({ message: 'Hello' })
      const response = await POST(request, createContext())

      expect(response.headers.get('Content-Type')).toBe('text/event-stream')
      expect(response.headers.get('Cache-Control')).toBe('no-cache')
      expect(response.headers.get('Connection')).toBe('keep-alive')
      expect(response.headers.get('X-Agent-Version')).toBe('v2')
    })

    it('includes X-Conversation-Id in response headers', async () => {
      const request = createRequest({ message: 'Hello' })
      const response = await POST(request, createContext())

      expect(response.headers.get('X-Conversation-Id')).toBeDefined()
    })

    it('includes X-Thread-Id in response headers for debugging', async () => {
      const request = createRequest({ message: 'Hello' })
      const response = await POST(request, createContext())

      expect(response.headers.get('X-Thread-Id')).toBeDefined()
    })
  })

  describe('Workflow Mode Handling', () => {
    beforeEach(() => {
      setupAuthenticatedUser()
      setupDeal()
    })

    it('defaults to chat workflow mode', async () => {
      const request = createRequest({ message: 'Hello' })
      await POST(request, createContext())

      const threadId = mockSafeStreamAgent.mock.calls[0]![1]
      expect(threadId).toMatch(/^chat:/)
    })

    it('respects chat workflow mode', async () => {
      const request = createRequest({ message: 'Hello', workflowMode: 'chat' })
      await POST(request, createContext())

      const threadId = mockSafeStreamAgent.mock.calls[0]![1]
      expect(threadId).toMatch(/^chat:/)
    })

    it('respects cim workflow mode', async () => {
      const request = createRequest({ message: 'Hello', workflowMode: 'cim' })
      await POST(request, createContext())

      const threadId = mockSafeStreamAgent.mock.calls[0]![1]
      expect(threadId).toMatch(/^cim:/)
    })

    it('respects irl workflow mode', async () => {
      const request = createRequest({ message: 'Hello', workflowMode: 'irl' })
      await POST(request, createContext())

      const threadId = mockSafeStreamAgent.mock.calls[0]![1]
      expect(threadId).toMatch(/^irl:/)
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      setupAuthenticatedUser()
      setupDeal()
    })

    it('handles stream errors gracefully', async () => {
      mockSafeStreamAgent.mockImplementation(async function* () {
        yield { event: 'on_chat_model_stream', data: { chunk: 'Hello' } }
        throw new Error('Stream failed')
      })

      const request = createRequest({ message: 'Hello' })
      const response = await POST(request, createContext())

      // Should still return SSE stream (error is sent as SSE event)
      expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    })
  })
})
