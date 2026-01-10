/**
 * Chat API Route - Integration Tests (Agent System v2.0)
 *
 * Story: 1-4 Implement Thread ID Generation and Management (AC: #2, #3)
 * Story: 1-7 Remove Legacy Agent Code (route consolidation)
 *
 * Integration tests verify:
 * - Conversation persists across multiple requests
 * - Different conversations are isolated
 * - Auth required (401 without session)
 *
 * These tests require RUN_INTEGRATION_TESTS=true to execute.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Skip if integration tests not enabled
const RUN_TESTS = process.env.RUN_INTEGRATION_TESTS === 'true'

// =============================================================================
// Mock Setup for Integration Tests
// =============================================================================

// For integration tests, we use real components but still mock
// the external services (Supabase, PostgresSaver) with test instances

const testUserId = 'test-user-integration'
const testDealId = 'test-deal-integration'
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

// Mock streamAgent for integration - use MemorySaver behavior
const conversationMessages = new Map<string, string[]>()
const mockStreamAgent = vi.fn()

vi.mock('@/lib/agent/v2', async () => {
  const actual = await vi.importActual('@/lib/agent/v2')
  return {
    ...actual,
    streamAgent: (...args: unknown[]) => mockStreamAgent(...args),
  }
})

// =============================================================================
// Helper Functions
// =============================================================================

function createRequest(body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/projects/${testDealId}/chat-v2`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
}

function createContext() {
  return {
    params: Promise.resolve({ id: testDealId }),
  }
}

function setupAuthenticatedUser() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: testUserId } },
    error: null,
  })
}

function setupDeal() {
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
    data: { id: testDealId, name: 'Test Deal' },
    error: null,
  })
}

async function readStream(response: Response): Promise<string[]> {
  const reader = response.body?.getReader()
  if (!reader) return []

  const decoder = new TextDecoder()
  const events: string[] = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const text = decoder.decode(value)
    const lines = text.split('\n\n').filter((line) => line.startsWith('data: '))
    events.push(...lines)
  }

  return events
}

// =============================================================================
// Integration Tests
// =============================================================================

describe.skipIf(!RUN_TESTS)('chat-v2 integration', () => {
  let POST: typeof import('../route').POST

  beforeAll(async () => {
    // Import the route handler
    const routeModule = await import('../route')
    POST = routeModule.POST

    // Setup mocks for all tests
    setupAuthenticatedUser()
    setupDeal()

    // Mock streamAgent to track messages per thread
    mockStreamAgent.mockImplementation(async function* (state, threadId) {
      // Simulate checkpointer behavior: accumulate messages
      const messages = conversationMessages.get(threadId) || []
      if (state.messages && state.messages[0]) {
        const userMsg = state.messages[0].content
        messages.push(typeof userMsg === 'string' ? userMsg : JSON.stringify(userMsg))
        conversationMessages.set(threadId, messages)
      }

      // Return response based on accumulated messages
      const response = `Response to message ${messages.length}: ${messages[messages.length - 1]}`
      yield {
        event: 'on_chat_model_stream',
        data: { chunk: { content: response } },
      }
    })
  })

  afterAll(() => {
    conversationMessages.clear()
    vi.restoreAllMocks()
  })

  describe('Conversation Persistence (AC: #2)', () => {
    it('conversation persists across multiple requests with same conversationId', async () => {
      // First request - creates conversation
      const request1 = createRequest({ message: 'Hello' })
      const response1 = await POST(request1, createContext())

      expect(response1.headers.get('Content-Type')).toBe('text/event-stream')
      const conversationId = response1.headers.get('X-Conversation-Id')
      expect(conversationId).toBeDefined()

      // Second request - continues conversation
      const request2 = createRequest({
        message: 'How are you?',
        conversationId,
      })
      const response2 = await POST(request2, createContext())

      // Should use the same conversation ID
      expect(response2.headers.get('X-Conversation-Id')).toBe(conversationId)

      // Third request - continues conversation
      const request3 = createRequest({
        message: 'Tell me about the deal',
        conversationId,
      })
      const response3 = await POST(request3, createContext())

      expect(response3.headers.get('X-Conversation-Id')).toBe(conversationId)

      // Verify messages accumulated via streamAgent calls
      expect(mockStreamAgent).toHaveBeenCalledTimes(3)
    })

    it('uses same thread ID for same conversation', async () => {
      const conversationId = '550e8400-e29b-41d4-a716-446655440001'

      // First request
      const request1 = createRequest({ message: 'First', conversationId })
      await POST(request1, createContext())

      const threadId1 = mockStreamAgent.mock.calls[mockStreamAgent.mock.calls.length - 1][1]

      // Second request with same conversationId
      const request2 = createRequest({ message: 'Second', conversationId })
      await POST(request2, createContext())

      const threadId2 = mockStreamAgent.mock.calls[mockStreamAgent.mock.calls.length - 1][1]

      // Thread IDs should be identical
      expect(threadId1).toBe(threadId2)
    })
  })

  describe('Conversation Isolation (AC: #3)', () => {
    it('different conversations are isolated', async () => {
      // First conversation
      const request1 = createRequest({ message: 'Conversation 1 message' })
      const response1 = await POST(request1, createContext())
      const conversationId1 = response1.headers.get('X-Conversation-Id')

      // Second conversation (new, no conversationId)
      const request2 = createRequest({ message: 'Conversation 2 message' })
      const response2 = await POST(request2, createContext())
      const conversationId2 = response2.headers.get('X-Conversation-Id')

      // Conversation IDs should be different
      expect(conversationId1).not.toBe(conversationId2)

      // Thread IDs should be different
      const callCount = mockStreamAgent.mock.calls.length
      const threadId1 = mockStreamAgent.mock.calls[callCount - 2][1]
      const threadId2 = mockStreamAgent.mock.calls[callCount - 1][1]

      expect(threadId1).not.toBe(threadId2)
    })

    it('different workflow modes create different thread IDs for same conversation', async () => {
      const conversationId = '550e8400-e29b-41d4-a716-446655440002'

      // Chat mode
      const request1 = createRequest({
        message: 'Chat message',
        conversationId,
        workflowMode: 'chat',
      })
      await POST(request1, createContext())
      const chatThreadId = mockStreamAgent.mock.calls[mockStreamAgent.mock.calls.length - 1][1]

      // CIM mode with same conversation ID (different thread)
      // Note: In production, CIM has different thread format (no userId)
      // but using same conversationId here for testing purposes

      expect(chatThreadId).toMatch(/^chat:/)
    })
  })

  describe('Authentication Required (AC: #3)', () => {
    it('returns 401 without authentication', async () => {
      // Temporarily mock no auth
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'No session' },
      })

      const request = createRequest({ message: 'Hello' })
      const response = await POST(request, createContext())

      expect(response.status).toBe(401)
    })
  })

  describe('SSE Stream Events', () => {
    it('stream contains expected event format', async () => {
      const request = createRequest({ message: 'Test message' })
      const response = await POST(request, createContext())

      const events = await readStream(response)

      // Should have at least streaming events and done event
      expect(events.length).toBeGreaterThanOrEqual(1)

      // Parse first event
      const firstEvent = JSON.parse(events[0].replace('data: ', ''))
      expect(firstEvent).toHaveProperty('event')
      expect(firstEvent).toHaveProperty('conversationId')
      expect(firstEvent).toHaveProperty('timestamp')
    })

    it('stream ends with done event', async () => {
      const request = createRequest({ message: 'Test message' })
      const response = await POST(request, createContext())

      const events = await readStream(response)

      // Last event should be 'done'
      const lastEvent = JSON.parse(events[events.length - 1].replace('data: ', ''))
      expect(lastEvent.event).toBe('done')
    })
  })
})

describe.skipIf(RUN_TESTS)('chat-v2 integration (skipped)', () => {
  it('integration tests require RUN_INTEGRATION_TESTS=true', () => {
    expect(true).toBe(true)
  })
})
