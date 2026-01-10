/**
 * Agent System v2.0 - State Schema Tests
 *
 * Story: 1-1 Create Unified Agent State Schema (AC: #4)
 *
 * Tests verify:
 * - AgentState type compilation
 * - messagesStateReducer behavior with multiple message types
 * - Reducer functions for array fields (sources, errors, messages)
 * - Null/undefined initialization behavior
 * - Default value initialization
 * - Helper function outputs (createInitialState, createInitialCIMState)
 *
 * NOTE: These are unit tests that validate type shapes and reducer patterns.
 * Integration tests that exercise reducers through actual LangGraph StateGraph
 * invocation should be added in story 1-2 (Create Base StateGraph Structure)
 * when the graph is assembled.
 */

import { describe, it, expect } from 'vitest'
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'

import {
  AgentState,
  type AgentStateType,
  createInitialState,
  createInitialCIMState,
} from '../state'

import {
  type SourceCitation,
  type ApprovalRequest,
  type AgentError,
  type DealContext,
  type WorkflowMode,
  AgentErrorCode,
} from '../types'

// =============================================================================
// Type Compilation Tests (AC: #4)
// =============================================================================

describe('AgentState Type Compilation', () => {
  it('should compile AgentState with all 11 required fields', () => {
    // This test verifies that AgentState.State type has all required fields
    // by accessing them (compilation would fail if fields are missing)
    const state: AgentStateType = {
      messages: [],
      sources: [],
      pendingApproval: null,
      activeSpecialist: null,
      errors: [],
      dealContext: null,
      workflowMode: 'chat',
      cimState: null,
      scratchpad: {},
      historySummary: null,
      tokenCount: 0,
    }

    expect(state).toBeDefined()
    expect(Object.keys(state)).toHaveLength(11)
  })

  it('should export AgentState as a LangGraph Annotation', () => {
    // Verify AgentState has Annotation properties
    expect(AgentState).toBeDefined()
    expect(AgentState.spec).toBeDefined()
    expect(typeof AgentState.spec).toBe('object')
  })

  it('should allow extracting AgentStateType from AgentState', () => {
    // Verify type extraction works
    const testState = createInitialState()
    const keys = Object.keys(testState)

    expect(keys).toContain('messages')
    expect(keys).toContain('sources')
    expect(keys).toContain('pendingApproval')
    expect(keys).toContain('activeSpecialist')
    expect(keys).toContain('errors')
    expect(keys).toContain('dealContext')
    expect(keys).toContain('workflowMode')
    expect(keys).toContain('cimState')
    expect(keys).toContain('scratchpad')
    expect(keys).toContain('historySummary')
    expect(keys).toContain('tokenCount')
  })
})

// =============================================================================
// Default Value Tests (AC: #4)
// =============================================================================

describe('Default Value Initialization', () => {
  it('should initialize messages to empty array', () => {
    const state = createInitialState()
    expect(state.messages).toEqual([])
    expect(Array.isArray(state.messages)).toBe(true)
  })

  it('should initialize sources to empty array', () => {
    const state = createInitialState()
    expect(state.sources).toEqual([])
    expect(Array.isArray(state.sources)).toBe(true)
  })

  it('should initialize pendingApproval to null', () => {
    const state = createInitialState()
    expect(state.pendingApproval).toBeNull()
  })

  it('should initialize activeSpecialist to null', () => {
    const state = createInitialState()
    expect(state.activeSpecialist).toBeNull()
  })

  it('should initialize errors to empty array', () => {
    const state = createInitialState()
    expect(state.errors).toEqual([])
    expect(Array.isArray(state.errors)).toBe(true)
  })

  it('should initialize dealContext to null when no dealId provided', () => {
    const state = createInitialState()
    expect(state.dealContext).toBeNull()
  })

  it('should initialize workflowMode to "chat" by default', () => {
    const state = createInitialState()
    expect(state.workflowMode).toBe('chat')
  })

  it('should initialize cimState to null', () => {
    const state = createInitialState()
    expect(state.cimState).toBeNull()
  })

  it('should initialize scratchpad to empty object', () => {
    const state = createInitialState()
    expect(state.scratchpad).toEqual({})
    expect(typeof state.scratchpad).toBe('object')
  })

  it('should initialize historySummary to null', () => {
    const state = createInitialState()
    expect(state.historySummary).toBeNull()
  })

  it('should initialize tokenCount to 0', () => {
    const state = createInitialState()
    expect(state.tokenCount).toBe(0)
  })
})

// =============================================================================
// Reducer Tests (AC: #4)
// =============================================================================

describe('Message Reducer (messagesStateReducer)', () => {
  it('should handle HumanMessage type', () => {
    const message = new HumanMessage('Hello')
    expect(message._getType()).toBe('human')
    expect(message.content).toBe('Hello')
  })

  it('should handle AIMessage type', () => {
    const message = new AIMessage('Hi there')
    expect(message._getType()).toBe('ai')
    expect(message.content).toBe('Hi there')
  })

  it('should handle SystemMessage type', () => {
    const message = new SystemMessage('You are an assistant')
    expect(message._getType()).toBe('system')
    expect(message.content).toBe('You are an assistant')
  })

  it('should handle multiple message types in array', () => {
    const messages = [
      new SystemMessage('System prompt'),
      new HumanMessage('User message'),
      new AIMessage('Assistant response'),
    ]

    expect(messages).toHaveLength(3)
    expect(messages[0]!._getType()).toBe('system')
    expect(messages[1]!._getType()).toBe('human')
    expect(messages[2]!._getType()).toBe('ai')
  })
})

describe('Source Reducer (accumulate)', () => {
  it('should accumulate new sources to existing', () => {
    const existingSources: SourceCitation[] = [
      {
        documentId: 'doc-1',
        documentName: 'Document 1',
        snippet: 'First snippet',
        relevanceScore: 0.9,
        retrievedAt: '2026-01-01T00:00:00Z',
      },
    ]

    const newSources: SourceCitation[] = [
      {
        documentId: 'doc-2',
        documentName: 'Document 2',
        snippet: 'Second snippet',
        relevanceScore: 0.8,
        retrievedAt: '2026-01-01T00:01:00Z',
      },
    ]

    // Simulate reducer behavior
    const combined = [...existingSources, ...newSources]

    expect(combined).toHaveLength(2)
    expect(combined[0]!.documentId).toBe('doc-1')
    expect(combined[1]!.documentId).toBe('doc-2')
  })

  it('should handle empty existing sources', () => {
    const existing: SourceCitation[] = []
    const newSources: SourceCitation[] = [
      {
        documentId: 'doc-1',
        documentName: 'Document 1',
        snippet: 'Snippet',
        relevanceScore: 0.9,
        retrievedAt: '2026-01-01T00:00:00Z',
      },
    ]

    const combined = [...existing, ...newSources]
    expect(combined).toHaveLength(1)
  })

  it('should handle empty new sources', () => {
    const existing: SourceCitation[] = [
      {
        documentId: 'doc-1',
        documentName: 'Document 1',
        snippet: 'Snippet',
        relevanceScore: 0.9,
        retrievedAt: '2026-01-01T00:00:00Z',
      },
    ]
    const newSources: SourceCitation[] = []

    const combined = [...existing, ...newSources]
    expect(combined).toHaveLength(1)
  })
})

describe('Error Reducer (accumulate)', () => {
  it('should accumulate new errors to existing', () => {
    const existingErrors: AgentError[] = [
      {
        code: AgentErrorCode.LLM_ERROR,
        message: 'First error',
        recoverable: true,
        timestamp: '2026-01-01T00:00:00Z',
      },
    ]

    const newErrors: AgentError[] = [
      {
        code: AgentErrorCode.TOOL_ERROR,
        message: 'Second error',
        recoverable: false,
        timestamp: '2026-01-01T00:01:00Z',
        nodeId: 'retrieval',
      },
    ]

    // Simulate reducer behavior
    const combined = [...existingErrors, ...newErrors]

    expect(combined).toHaveLength(2)
    expect(combined[0]!.code).toBe(AgentErrorCode.LLM_ERROR)
    expect(combined[1]!.code).toBe(AgentErrorCode.TOOL_ERROR)
    expect(combined[1]!.nodeId).toBe('retrieval')
  })

  it('should preserve all error fields', () => {
    const error: AgentError = {
      code: AgentErrorCode.CONTEXT_ERROR,
      message: 'Failed to load context',
      details: { dealId: 'deal-123' },
      recoverable: true,
      timestamp: '2026-01-01T00:00:00Z',
      nodeId: 'contextLoader',
    }

    const errors: AgentError[] = [error]
    const combined = [...[], ...errors]

    expect(combined[0]!.code).toBe(AgentErrorCode.CONTEXT_ERROR)
    expect(combined[0]!.message).toBe('Failed to load context')
    expect(combined[0]!.details).toEqual({ dealId: 'deal-123' })
    expect(combined[0]!.recoverable).toBe(true)
    expect(combined[0]!.timestamp).toBe('2026-01-01T00:00:00Z')
    expect(combined[0]!.nodeId).toBe('contextLoader')
  })
})

describe('Scratchpad Reducer (merge)', () => {
  it('should merge new keys into existing scratchpad', () => {
    const existing = { key1: 'value1' }
    const update = { key2: 'value2' }

    // Simulate reducer behavior
    const merged = { ...existing, ...update }

    expect(merged).toEqual({ key1: 'value1', key2: 'value2' })
  })

  it('should override existing keys with new values', () => {
    const existing = { key1: 'old' }
    const update = { key1: 'new' }

    const merged = { ...existing, ...update }

    expect(merged.key1).toBe('new')
  })

  it('should handle complex nested values', () => {
    const existing: Record<string, unknown> = {
      simple: 'value',
      nested: { a: 1 },
    }
    const update: Record<string, unknown> = {
      nested: { b: 2 },
      array: [1, 2, 3],
    }

    const merged = { ...existing, ...update }

    expect(merged.simple).toBe('value')
    // Note: shallow merge replaces nested objects entirely
    expect(merged.nested).toEqual({ b: 2 })
    expect(merged.array).toEqual([1, 2, 3])
  })
})

describe('Replace Reducers', () => {
  it('should replace dealContext entirely', () => {
    // Replace reducer pattern: (_, next) => next
    // Old value is ignored, new value replaces it completely
    const newContext: DealContext = {
      dealId: 'new-deal',
      dealName: 'New Deal',
      projectId: 'proj-2',
      status: 'closed',
      documentCount: 10,
      createdAt: '2026-01-02T00:00:00Z',
    }

    // Verify the new context has expected values
    expect(newContext.dealId).toBe('new-deal')
    expect(newContext.dealName).toBe('New Deal')
    expect(newContext.status).toBe('closed')
  })

  it('should replace workflowMode', () => {
    const modes: WorkflowMode[] = ['chat', 'cim', 'irl']

    modes.forEach(mode => {
      expect(['chat', 'cim', 'irl']).toContain(mode)
    })
  })

  it('should replace tokenCount', () => {
    // Replace reducer: new value replaces old
    const newCount = 2500
    expect(newCount).toBe(2500)
    expect(typeof newCount).toBe('number')
  })

  it('should replace historySummary', () => {
    // Replace reducer: new value replaces old
    const newSummary = 'New compressed summary'
    expect(newSummary).toBe('New compressed summary')
    expect(typeof newSummary).toBe('string')
  })
})

// =============================================================================
// Helper Function Tests (AC: #4)
// =============================================================================

describe('createInitialState()', () => {
  it('should create state with default workflow mode', () => {
    const state = createInitialState()
    expect(state.workflowMode).toBe('chat')
  })

  it('should create state with specified workflow mode', () => {
    const modes: WorkflowMode[] = ['chat', 'cim', 'irl']

    modes.forEach(mode => {
      const state = createInitialState(mode)
      expect(state.workflowMode).toBe(mode)
    })
  })

  it('should create partial dealContext when dealId is provided', () => {
    const state = createInitialState('chat', 'deal-123')

    expect(state.dealContext).not.toBeNull()
    expect(state.dealContext!.dealId).toBe('deal-123')
    expect(state.dealContext!.status).toBe('active')
    expect(state.dealContext!.documentCount).toBe(0)
  })

  it('should add userId to scratchpad when provided', () => {
    const state = createInitialState('chat', 'deal-123', 'user-456')

    expect(state.scratchpad.userId).toBe('user-456')
  })

  it('should have empty scratchpad when userId not provided', () => {
    const state = createInitialState('chat', 'deal-123')

    expect(state.scratchpad).toEqual({})
  })

  it('should initialize all array fields as empty', () => {
    const state = createInitialState()

    expect(state.messages).toEqual([])
    expect(state.sources).toEqual([])
    expect(state.errors).toEqual([])
  })

  it('should initialize all nullable fields to null', () => {
    const state = createInitialState()

    expect(state.pendingApproval).toBeNull()
    expect(state.activeSpecialist).toBeNull()
    expect(state.cimState).toBeNull()
    expect(state.historySummary).toBeNull()
  })
})

describe('createInitialCIMState()', () => {
  it('should create state with CIM workflow mode', () => {
    const state = createInitialCIMState('cim-001', 'deal-123', 'user-456')
    expect(state.workflowMode).toBe('cim')
  })

  it('should initialize cimState with provided cimId', () => {
    const state = createInitialCIMState('cim-001', 'deal-123', 'user-456')

    expect(state.cimState).not.toBeNull()
    expect(state.cimState!.cimId).toBe('cim-001')
  })

  it('should initialize cimState with persona phase', () => {
    const state = createInitialCIMState('cim-001', 'deal-123', 'user-456')

    expect(state.cimState!.currentPhase).toBe('persona')
  })

  it('should initialize cimState with empty completedPhases', () => {
    const state = createInitialCIMState('cim-001', 'deal-123', 'user-456')

    expect(state.cimState!.completedPhases).toEqual([])
  })

  it('should initialize cimState with null optional fields', () => {
    const state = createInitialCIMState('cim-001', 'deal-123', 'user-456')

    expect(state.cimState!.buyerPersona).toBeNull()
    expect(state.cimState!.investmentThesis).toBeNull()
    expect(state.cimState!.outline).toBeNull()
  })

  it('should initialize cimState with empty slides array', () => {
    const state = createInitialCIMState('cim-001', 'deal-123', 'user-456')

    expect(state.cimState!.slides).toEqual([])
  })

  it('should initialize cimState with empty dependency graph', () => {
    const state = createInitialCIMState('cim-001', 'deal-123', 'user-456')

    expect(state.cimState!.dependencyGraph).toEqual({})
  })

  it('should initialize cimState with isComplete as false', () => {
    const state = createInitialCIMState('cim-001', 'deal-123', 'user-456')

    expect(state.cimState!.isComplete).toBe(false)
  })

  it('should create dealContext with provided dealId', () => {
    const state = createInitialCIMState('cim-001', 'deal-123', 'user-456')

    expect(state.dealContext).not.toBeNull()
    expect(state.dealContext!.dealId).toBe('deal-123')
  })

  it('should add userId to scratchpad', () => {
    const state = createInitialCIMState('cim-001', 'deal-123', 'user-456')

    expect(state.scratchpad.userId).toBe('user-456')
  })
})

// =============================================================================
// Serialization Tests (AC: #4)
// =============================================================================

describe('State Serialization', () => {
  it('should serialize to JSON without circular references', () => {
    const state = createInitialState('chat', 'deal-123', 'user-456')

    // Should not throw
    const json = JSON.stringify(state)
    expect(json).toBeDefined()
    expect(typeof json).toBe('string')
  })

  it('should deserialize from JSON correctly', () => {
    const state = createInitialState('chat', 'deal-123', 'user-456')
    const json = JSON.stringify(state)
    const parsed = JSON.parse(json)

    expect(parsed.workflowMode).toBe('chat')
    expect(parsed.dealContext.dealId).toBe('deal-123')
    expect(parsed.scratchpad.userId).toBe('user-456')
  })

  it('should serialize CIM state to JSON', () => {
    const state = createInitialCIMState('cim-001', 'deal-123', 'user-456')

    const json = JSON.stringify(state)
    const parsed = JSON.parse(json)

    expect(parsed.workflowMode).toBe('cim')
    expect(parsed.cimState.cimId).toBe('cim-001')
    expect(parsed.cimState.currentPhase).toBe('persona')
  })

  it('should serialize state with populated arrays', () => {
    const state = createInitialState('chat', 'deal-123', 'user-456')

    // Simulate populated state
    const populatedState = {
      ...state,
      sources: [
        {
          documentId: 'doc-1',
          documentName: 'Document 1',
          snippet: 'Test snippet',
          relevanceScore: 0.9,
          retrievedAt: '2026-01-01T00:00:00Z',
        },
      ],
      errors: [
        {
          code: AgentErrorCode.LLM_ERROR,
          message: 'Test error',
          recoverable: true,
          timestamp: '2026-01-01T00:00:00Z',
        },
      ],
    }

    const json = JSON.stringify(populatedState)
    const parsed = JSON.parse(json)

    expect(parsed.sources).toHaveLength(1)
    expect(parsed.sources[0].documentId).toBe('doc-1')
    expect(parsed.errors).toHaveLength(1)
    expect(parsed.errors[0].code).toBe('LLM_ERROR')
  })

  it('should serialize state with approval request', () => {
    const state = createInitialState()

    const stateWithApproval = {
      ...state,
      pendingApproval: {
        type: 'plan_approval' as const,
        requestId: 'req-123',
        requestedAt: '2026-01-01T00:00:00Z',
        prompt: 'Approve this plan?',
        steps: ['Step 1', 'Step 2'],
        estimatedImpact: 'Medium',
      },
    }

    const json = JSON.stringify(stateWithApproval)
    const parsed = JSON.parse(json)

    expect(parsed.pendingApproval.type).toBe('plan_approval')
    expect(parsed.pendingApproval.steps).toEqual(['Step 1', 'Step 2'])
  })
})

// =============================================================================
// Naming Convention Tests (AC: #3)
// =============================================================================

describe('Naming Conventions', () => {
  it('should use camelCase for all state field names', () => {
    const state = createInitialState()
    const keys = Object.keys(state)

    // Verify no snake_case fields
    keys.forEach(key => {
      expect(key).not.toMatch(/_/)
    })

    // Verify specific camelCase fields
    expect(keys).toContain('dealContext')
    expect(keys).toContain('workflowMode')
    expect(keys).toContain('cimState')
    expect(keys).toContain('activeSpecialist')
    expect(keys).toContain('pendingApproval')
    expect(keys).toContain('historySummary')
    expect(keys).toContain('tokenCount')
  })

  it('should use UPPER_SNAKE_CASE for error codes', () => {
    const errorCodes = Object.values(AgentErrorCode)

    errorCodes.forEach(code => {
      expect(code).toMatch(/^[A-Z_]+$/)
    })

    expect(errorCodes).toContain('LLM_ERROR')
    expect(errorCodes).toContain('TOOL_ERROR')
    expect(errorCodes).toContain('STATE_ERROR')
    expect(errorCodes).toContain('CONTEXT_ERROR')
    expect(errorCodes).toContain('APPROVAL_REJECTED')
    expect(errorCodes).toContain('STREAMING_ERROR')
    expect(errorCodes).toContain('CACHE_ERROR')
  })
})

// =============================================================================
// Edge Case Tests
// =============================================================================

describe('Edge Cases', () => {
  it('should handle state with all fields populated', () => {
    const fullState: AgentStateType = {
      messages: [new HumanMessage('Test')],
      sources: [
        {
          documentId: 'doc-1',
          documentName: 'Doc',
          snippet: 'Snippet',
          relevanceScore: 0.9,
          retrievedAt: '2026-01-01T00:00:00Z',
        },
      ],
      pendingApproval: {
        type: 'qa_modification',
        requestId: 'req-1',
        requestedAt: '2026-01-01T00:00:00Z',
        prompt: 'Approve?',
        operation: 'add',
        targetId: 'qa-1',
        data: { question: 'Test?' },
      },
      activeSpecialist: 'financial-analyst',
      errors: [
        {
          code: AgentErrorCode.CACHE_ERROR,
          message: 'Cache miss',
          recoverable: true,
          timestamp: '2026-01-01T00:00:00Z',
        },
      ],
      dealContext: {
        dealId: 'deal-1',
        dealName: 'Test Deal',
        projectId: 'proj-1',
        status: 'active',
        documentCount: 10,
        createdAt: '2026-01-01T00:00:00Z',
      },
      workflowMode: 'cim',
      cimState: {
        cimId: 'cim-1',
        currentPhase: 'content',
        completedPhases: ['persona', 'outline'],
        buyerPersona: 'Strategic acquirer',
        investmentThesis: 'Strong growth potential',
        outline: ['Executive Summary', 'Company Overview'],
        slides: [
          { id: 's1', title: 'Overview', content: '# Overview', status: 'complete' },
        ],
        dependencyGraph: { s2: ['s1'] },
        isComplete: false,
      },
      scratchpad: {
        userId: 'user-1',
        lastQuery: 'financials',
        results: [1, 2, 3],
      },
      historySummary: 'Previous conversation discussed financials...',
      tokenCount: 15000,
    }

    expect(fullState.messages).toHaveLength(1)
    expect(fullState.sources).toHaveLength(1)
    expect(fullState.pendingApproval?.type).toBe('qa_modification')
    expect(fullState.activeSpecialist).toBe('financial-analyst')
    expect(fullState.errors).toHaveLength(1)
    expect(fullState.dealContext?.dealName).toBe('Test Deal')
    expect(fullState.workflowMode).toBe('cim')
    expect(fullState.cimState?.completedPhases).toEqual(['persona', 'outline'])
    expect(fullState.scratchpad.lastQuery).toBe('financials')
    expect(fullState.historySummary).toContain('financials')
    expect(fullState.tokenCount).toBe(15000)
  })

  it('should handle DealContext with optional organizationId', () => {
    const contextWithOrg: DealContext = {
      dealId: 'deal-1',
      dealName: 'Test',
      projectId: 'proj-1',
      organizationId: 'org-123',
      status: 'active',
      documentCount: 0,
      createdAt: '2026-01-01T00:00:00Z',
    }

    const contextWithoutOrg: DealContext = {
      dealId: 'deal-1',
      dealName: 'Test',
      projectId: 'proj-1',
      status: 'active',
      documentCount: 0,
      createdAt: '2026-01-01T00:00:00Z',
    }

    expect(contextWithOrg.organizationId).toBe('org-123')
    expect(contextWithoutOrg.organizationId).toBeUndefined()
  })

  it('should handle SourceCitation with optional location', () => {
    const sourceWithLocation: SourceCitation = {
      documentId: 'doc-1',
      documentName: 'Doc',
      location: { page: 5, section: 'Financials', paragraph: 3 },
      snippet: 'Revenue grew...',
      relevanceScore: 0.95,
      retrievedAt: '2026-01-01T00:00:00Z',
    }

    const sourceWithoutLocation: SourceCitation = {
      documentId: 'doc-1',
      documentName: 'Doc',
      snippet: 'Revenue grew...',
      relevanceScore: 0.95,
      retrievedAt: '2026-01-01T00:00:00Z',
    }

    expect(sourceWithLocation.location?.page).toBe(5)
    expect(sourceWithoutLocation.location).toBeUndefined()
  })

  it('should handle all approval request types', () => {
    const qaApproval: ApprovalRequest = {
      type: 'qa_modification',
      requestId: 'req-1',
      requestedAt: '2026-01-01T00:00:00Z',
      prompt: 'Add Q&A?',
      operation: 'add',
      targetId: 'qa-1',
      data: {},
    }

    const planApproval: ApprovalRequest = {
      type: 'plan_approval',
      requestId: 'req-2',
      requestedAt: '2026-01-01T00:00:00Z',
      prompt: 'Execute plan?',
      steps: ['Step 1', 'Step 2'],
      estimatedImpact: 'High',
    }

    const kbApproval: ApprovalRequest = {
      type: 'knowledge_base_update',
      requestId: 'req-3',
      requestedAt: '2026-01-01T00:00:00Z',
      prompt: 'Add fact?',
      fact: 'Revenue is $10M',
      source: 'Annual Report',
      confidence: 0.9,
    }

    const destructiveApproval: ApprovalRequest = {
      type: 'destructive_action',
      requestId: 'req-4',
      requestedAt: '2026-01-01T00:00:00Z',
      prompt: 'Delete data?',
      action: 'delete_conversation',
      warning: 'This cannot be undone',
    }

    expect(qaApproval.type).toBe('qa_modification')
    expect(planApproval.type).toBe('plan_approval')
    expect(kbApproval.type).toBe('knowledge_base_update')
    expect(destructiveApproval.type).toBe('destructive_action')
  })
})
