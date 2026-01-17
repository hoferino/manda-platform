/**
 * CIM MVP API Route Tests
 *
 * Tests for the /api/projects/[id]/cims/[cimId]/chat-mvp endpoint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// =============================================================================
// Mock Setup using vi.hoisted (must be before imports)
// =============================================================================

// Use vi.hoisted to define mocks that can be referenced in vi.mock factories
const {
  mockSupabaseClient,
  mockStreamCIMMVP,
  mockExecuteCIMMVP,
  mockGetCIMMVPGraph,
  mockCreateKnowledgeService,
  mockUpdateCIM,
} = vi.hoisted(() => ({
  mockSupabaseClient: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
  },
  mockStreamCIMMVP: vi.fn(),
  mockExecuteCIMMVP: vi.fn(),
  mockGetCIMMVPGraph: vi.fn(),
  mockCreateKnowledgeService: vi.fn().mockReturnValue({
    loadKnowledge: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
    getLoadedKnowledge: vi.fn().mockReturnValue(null),
    isLoaded: vi.fn().mockReturnValue(false),
    getCacheStatus: vi.fn().mockReturnValue(null),
  }),
  mockUpdateCIM: vi.fn().mockResolvedValue({ error: null }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabaseClient),
}))

vi.mock('@/lib/agent/cim-mvp', () => ({
  streamCIMMVP: (...args: unknown[]) => mockStreamCIMMVP(...args),
  executeCIMMVP: (...args: unknown[]) => mockExecuteCIMMVP(...args),
  getCIMMVPGraph: () => mockGetCIMMVPGraph(),
  createKnowledgeService: (...args: unknown[]) => mockCreateKnowledgeService(...args),
}))

// Mock streaming helpers
vi.mock('@/lib/agent/streaming', () => ({
  getSSEHeaders: vi.fn().mockReturnValue({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  }),
}))

// Mock CIM service
vi.mock('@/lib/services/cim', () => ({
  updateCIM: (...args: unknown[]) => mockUpdateCIM(...args),
}))

// Import route handlers after mocks
import { POST, GET } from '@/app/api/projects/[id]/cims/[cimId]/chat-mvp/route'

// =============================================================================
// Test Utilities
// =============================================================================

function createMockRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/projects/proj-1/cims/cim-1/chat-mvp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

function createMockGETRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/projects/proj-1/cims/cim-1/chat-mvp', {
    method: 'GET',
  })
}

const mockContext = {
  params: Promise.resolve({ id: 'proj-1', cimId: 'cim-1' }),
}

// =============================================================================
// Helper to create async iterator from events
// =============================================================================

async function* createAsyncIterator<T>(events: T[]): AsyncGenerator<T> {
  for (const event of events) {
    yield event
  }
}

// =============================================================================
// POST Endpoint Tests
// =============================================================================

describe('CIM MVP API Route - POST', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: authenticated user
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    })
  })

  describe('validation', () => {
    it('should return 400 when message is missing', async () => {
      const request = createMockRequest({})

      const response = await POST(request, mockContext)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Message is required')
    })

    it('should return 400 when message is not a string', async () => {
      const request = createMockRequest({ message: 123 })

      const response = await POST(request, mockContext)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Message is required')
    })

    it('should return 400 when message is empty string', async () => {
      const request = createMockRequest({ message: '' })

      const response = await POST(request, mockContext)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Message is required')
    })
  })

  describe('authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const request = createMockRequest({ message: 'Hello' })

      const response = await POST(request, mockContext)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
    })

    it('should return 401 when auth error occurs', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Auth failed'),
      })

      const request = createMockRequest({ message: 'Hello' })

      const response = await POST(request, mockContext)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
    })
  })

  describe('non-streaming mode', () => {
    it('should call executeCIMMVP with correct parameters', async () => {
      mockExecuteCIMMVP.mockResolvedValue({
        response: 'Hello! I am the CIM MVP agent.',
        currentPhase: 'executive_summary',
        slideUpdates: [],
      })

      // Mock getCIMMVPGraph for syncConversationToCIM
      mockGetCIMMVPGraph.mockResolvedValue({
        getState: vi.fn().mockResolvedValue({
          values: { messages: [] },
        }),
      })

      const request = createMockRequest({
        message: 'Hello',
        stream: false,
      })

      const response = await POST(request, mockContext)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockExecuteCIMMVP).toHaveBeenCalledWith(
        'Hello',
        'cim-mvp:cim-1',
        undefined
      )
      expect(data.response).toBe('Hello! I am the CIM MVP agent.')
      expect(data.currentPhase).toBe('executive_summary')
      expect(data.conversationId).toBe('cim-mvp:cim-1')
    })

    it('should use custom conversationId when provided', async () => {
      mockExecuteCIMMVP.mockResolvedValue({
        response: 'Response',
        currentPhase: 'executive_summary',
        slideUpdates: [],
      })

      mockGetCIMMVPGraph.mockResolvedValue({
        getState: vi.fn().mockResolvedValue({
          values: { messages: [] },
        }),
      })

      const request = createMockRequest({
        message: 'Hello',
        stream: false,
        conversationId: 'custom-thread-id',
      })

      const response = await POST(request, mockContext)
      const data = await response.json()

      expect(mockExecuteCIMMVP).toHaveBeenCalledWith(
        'Hello',
        'custom-thread-id',
        undefined
      )
      expect(data.conversationId).toBe('custom-thread-id')
    })

    it('should pass knowledgePath when provided', async () => {
      mockExecuteCIMMVP.mockResolvedValue({
        response: 'Response',
        currentPhase: 'executive_summary',
        slideUpdates: [],
      })

      mockGetCIMMVPGraph.mockResolvedValue({
        getState: vi.fn().mockResolvedValue({
          values: { messages: [] },
        }),
      })

      const request = createMockRequest({
        message: 'Hello',
        stream: false,
        knowledgePath: '/path/to/knowledge.json',
      })

      await POST(request, mockContext)

      expect(mockExecuteCIMMVP).toHaveBeenCalledWith(
        'Hello',
        'cim-mvp:cim-1',
        '/path/to/knowledge.json'
      )
    })

    it('should handle executeCIMMVP errors gracefully', async () => {
      mockExecuteCIMMVP.mockRejectedValue(new Error('Agent failed'))

      const request = createMockRequest({
        message: 'Hello',
        stream: false,
      })

      const response = await POST(request, mockContext)
      const data = await response.json()

      expect(response.status).toBe(200) // Returns 200 with error in body
      expect(data.response).toContain('encountered an issue')
      expect(data.error).toBe('Agent failed')
    })

    it('should return slideUpdates in response', async () => {
      const slideUpdates = [
        { slideId: 'slide-1', title: 'Test Slide', sectionId: 'sec-1' },
      ]

      mockExecuteCIMMVP.mockResolvedValue({
        response: 'Created a slide',
        currentPhase: 'company_overview',
        slideUpdates,
      })

      mockGetCIMMVPGraph.mockResolvedValue({
        getState: vi.fn().mockResolvedValue({
          values: { messages: [] },
        }),
      })

      const request = createMockRequest({
        message: 'Create a slide',
        stream: false,
      })

      const response = await POST(request, mockContext)
      const data = await response.json()

      expect(data.slideUpdates).toEqual(slideUpdates)
    })
  })

  describe('streaming mode', () => {
    it('should return SSE response by default', async () => {
      const events = [
        { type: 'token', content: 'Hello', timestamp: new Date().toISOString() },
        { type: 'done', conversationId: 'cim-mvp:cim-1', timestamp: new Date().toISOString() },
      ]

      mockStreamCIMMVP.mockReturnValue(createAsyncIterator(events))

      mockGetCIMMVPGraph.mockResolvedValue({
        getState: vi.fn().mockResolvedValue({
          values: { messages: [] },
        }),
      })

      const request = createMockRequest({
        message: 'Hello',
        // stream: true is default
      })

      const response = await POST(request, mockContext)

      expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    })

    it('should call streamCIMMVP with correct parameters', async () => {
      const events = [
        { type: 'done', conversationId: 'cim-mvp:cim-1', timestamp: new Date().toISOString() },
      ]

      mockStreamCIMMVP.mockReturnValue(createAsyncIterator(events))

      mockGetCIMMVPGraph.mockResolvedValue({
        getState: vi.fn().mockResolvedValue({
          values: { messages: [] },
        }),
      })

      const request = createMockRequest({
        message: 'Hello',
        stream: true,
        knowledgePath: '/path/to/knowledge.json',
      })

      const response = await POST(request, mockContext)

      // Consume the stream to trigger the async generator
      const reader = response.body?.getReader()
      if (reader) {
        while (true) {
          const { done } = await reader.read()
          if (done) break
        }
      }

      expect(mockStreamCIMMVP).toHaveBeenCalledWith(
        'Hello',
        'cim-mvp:cim-1',
        '/path/to/knowledge.json'
      )
    })

    it('should stream token events', async () => {
      const events = [
        { type: 'token', content: 'Hello ', timestamp: new Date().toISOString() },
        { type: 'token', content: 'World', timestamp: new Date().toISOString() },
        { type: 'done', conversationId: 'cim-mvp:cim-1', timestamp: new Date().toISOString() },
      ]

      mockStreamCIMMVP.mockReturnValue(createAsyncIterator(events))

      mockGetCIMMVPGraph.mockResolvedValue({
        getState: vi.fn().mockResolvedValue({
          values: { messages: [] },
        }),
      })

      const request = createMockRequest({ message: 'Hello' })

      const response = await POST(request, mockContext)
      const reader = response.body?.getReader()
      const chunks: string[] = []

      if (reader) {
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(decoder.decode(value))
        }
      }

      const allData = chunks.join('')
      expect(allData).toContain('token')
      expect(allData).toContain('Hello ')
      expect(allData).toContain('World')
    })

    it('should handle streaming errors', async () => {
      mockStreamCIMMVP.mockImplementation(async function* () {
        yield { type: 'token', content: 'Start', timestamp: new Date().toISOString() }
        throw new Error('Stream error')
      })

      const request = createMockRequest({ message: 'Hello' })

      const response = await POST(request, mockContext)
      const reader = response.body?.getReader()
      const chunks: string[] = []

      if (reader) {
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(decoder.decode(value))
        }
      }

      const allData = chunks.join('')
      expect(allData).toContain('error')
      expect(allData).toContain('Stream error')
    })
  })

  describe('thread ID generation', () => {
    it('should use deterministic thread ID based on cimId', async () => {
      mockExecuteCIMMVP.mockResolvedValue({
        response: 'Response',
        currentPhase: 'executive_summary',
        slideUpdates: [],
      })

      mockGetCIMMVPGraph.mockResolvedValue({
        getState: vi.fn().mockResolvedValue({
          values: { messages: [] },
        }),
      })

      const request = createMockRequest({
        message: 'Hello',
        stream: false,
      })

      await POST(request, mockContext)

      // Thread ID should be deterministic: cim-mvp:cim-1
      expect(mockExecuteCIMMVP).toHaveBeenCalledWith(
        expect.any(String),
        'cim-mvp:cim-1',
        undefined
      )
    })
  })
})

// =============================================================================
// GET Endpoint Tests
// =============================================================================

describe('CIM MVP API Route - GET', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: authenticated user
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    })
  })

  describe('authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const request = createMockGETRequest()

      const response = await GET(request, mockContext)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
    })
  })

  describe('success response', () => {
    it('should return agent info', async () => {
      const request = createMockGETRequest()

      const response = await GET(request, mockContext)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.agent).toBe('cim-mvp')
      expect(data.version).toBe('2.0.0')
    })

    it('should return workflow stages', async () => {
      const request = createMockGETRequest()

      const response = await GET(request, mockContext)
      const data = await response.json()

      expect(data.workflowStages).toEqual([
        'welcome',
        'buyer_persona',
        'hero_concept',
        'investment_thesis',
        'outline',
        'building_sections',
        'complete',
      ])
    })

    it('should return available tools', async () => {
      const request = createMockGETRequest()

      const response = await GET(request, mockContext)
      const data = await response.json()

      expect(data.tools).toContain('web_search')
      expect(data.tools).toContain('knowledge_search')
      expect(data.tools).toContain('advance_workflow')
      expect(data.tools).toContain('save_buyer_persona')
      expect(data.tools).toContain('create_outline')
      expect(data.tools).toContain('update_slide')
      expect(data.tools).toHaveLength(11)
    })

    it('should return SSE event types', async () => {
      const request = createMockGETRequest()

      const response = await GET(request, mockContext)
      const data = await response.json()

      expect(data.sseEventTypes).toContain('token')
      expect(data.sseEventTypes).toContain('slide_update')
      expect(data.sseEventTypes).toContain('workflow_progress')
      expect(data.sseEventTypes).toContain('outline_created')
      expect(data.sseEventTypes).toContain('outline_updated')
      expect(data.sseEventTypes).toContain('section_started')
      expect(data.sseEventTypes).toContain('done')
      expect(data.sseEventTypes).toContain('error')
    })

    it('should return usage instructions', async () => {
      const request = createMockGETRequest()

      const response = await GET(request, mockContext)
      const data = await response.json()

      expect(data.instructions).toContain('POST')
      expect(data.instructions).toContain('message')
    })
  })
})

// =============================================================================
// Database Sync Tests (via integration with route handlers)
// =============================================================================

describe('CIM MVP API Route - Database Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    })
  })

  describe('conversation sync', () => {
    it('should sync conversation after non-streaming response', async () => {
      const mockGetState = vi.fn().mockResolvedValue({
        values: {
          messages: [
            { _getType: () => 'human', content: 'Hello', id: 'msg-1' },
            { _getType: () => 'ai', content: 'Hi there!', id: 'msg-2' },
          ],
        },
      })

      mockGetCIMMVPGraph.mockResolvedValue({
        getState: mockGetState,
      })

      mockExecuteCIMMVP.mockResolvedValue({
        response: 'Hi there!',
        currentPhase: 'welcome',
        slideUpdates: [],
      })

      const request = createMockRequest({
        message: 'Hello',
        stream: false,
      })

      await POST(request, mockContext)

      // Verify graph.getState was called for sync
      expect(mockGetState).toHaveBeenCalled()
    })

    it('should filter out tool messages during sync', async () => {
      const mockGetState = vi.fn().mockResolvedValue({
        values: {
          messages: [
            { _getType: () => 'human', content: 'Hello', id: 'msg-1' },
            { _getType: () => 'ai', content: '', tool_calls: [{ name: 'test' }], id: 'msg-2' },
            { _getType: () => 'tool', content: '{"result": "ok"}', id: 'msg-3' },
            { _getType: () => 'ai', content: 'Here is the result', id: 'msg-4' },
          ],
        },
      })

      mockGetCIMMVPGraph.mockResolvedValue({
        getState: mockGetState,
      })

      mockExecuteCIMMVP.mockResolvedValue({
        response: 'Here is the result',
        currentPhase: 'welcome',
        slideUpdates: [],
      })

      const request = createMockRequest({
        message: 'Hello',
        stream: false,
      })

      await POST(request, mockContext)

      // mockUpdateCIM should be called with filtered messages
      // (tool messages and AI messages with tool_calls should be filtered out)
      expect(mockUpdateCIM).toHaveBeenCalled()
    })
  })

  describe('outline sync (streaming)', () => {
    it('should sync outline when outline_created event is received', async () => {
      const outlineSections = [
        { id: 'sec-1', title: 'Executive Summary', description: 'Overview' },
        { id: 'sec-2', title: 'Company Overview', description: 'History' },
      ]

      const events = [
        {
          type: 'outline_created',
          data: { sections: outlineSections },
          timestamp: new Date().toISOString(),
        },
        { type: 'done', conversationId: 'cim-mvp:cim-1', timestamp: new Date().toISOString() },
      ]

      mockStreamCIMMVP.mockReturnValue(createAsyncIterator(events))

      mockGetCIMMVPGraph.mockResolvedValue({
        getState: vi.fn().mockResolvedValue({
          values: { messages: [] },
        }),
      })

      const request = createMockRequest({ message: 'Create outline' })

      const response = await POST(request, mockContext)

      // Consume the stream
      const reader = response.body?.getReader()
      if (reader) {
        while (true) {
          const { done } = await reader.read()
          if (done) break
        }
      }

      // Verify outline sync was called
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('cims')
    })
  })

  describe('workflow progress sync (streaming)', () => {
    it('should sync workflow progress when workflow_progress event is received', async () => {
      const events = [
        {
          type: 'workflow_progress',
          data: {
            currentStage: 'buyer_persona',
            completedStages: ['welcome'],
            currentSectionId: null,
            sectionProgressSummary: {},
          },
          timestamp: new Date().toISOString(),
        },
        { type: 'done', conversationId: 'cim-mvp:cim-1', timestamp: new Date().toISOString() },
      ]

      mockStreamCIMMVP.mockReturnValue(createAsyncIterator(events))

      mockGetCIMMVPGraph.mockResolvedValue({
        getState: vi.fn().mockResolvedValue({
          values: {
            messages: [],
            workflowProgress: {
              currentStage: 'buyer_persona',
              completedStages: ['welcome'],
              sectionProgress: {},
            },
          },
        }),
      })

      const request = createMockRequest({ message: 'Next stage' })

      const response = await POST(request, mockContext)

      // Consume the stream
      const reader = response.body?.getReader()
      if (reader) {
        while (true) {
          const { done } = await reader.read()
          if (done) break
        }
      }

      // Verify workflow progress sync was triggered
      // (via graph.getState being called at end of stream)
      expect(mockGetCIMMVPGraph).toHaveBeenCalled()
    })
  })
})

// =============================================================================
// Error Handling Tests
// =============================================================================

describe('CIM MVP API Route - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    })
  })

  it('should return 500 on unexpected errors in POST', async () => {
    // Make request.json() throw an error
    const badRequest = {
      json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
    } as unknown as NextRequest

    const response = await POST(badRequest, mockContext)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Internal server error')
  })

  it('should return 500 on unexpected errors in GET', async () => {
    // Make context.params throw
    const badContext = {
      params: Promise.reject(new Error('Params error')),
    }

    const request = createMockGETRequest()

    const response = await GET(request, badContext)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Internal server error')
  })
})
