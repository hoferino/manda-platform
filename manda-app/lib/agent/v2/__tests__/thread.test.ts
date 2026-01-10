/**
 * Agent System v2.0 - Thread ID Utilities Tests
 *
 * Story: 1-3 Connect PostgresSaver Checkpointer (AC: #2)
 *
 * Tests verify:
 * - createV2ThreadId generates correct format for all workflow modes
 * - parseV2ThreadId extracts correct components
 * - Error handling for missing/invalid inputs
 * - Special character validation
 * - UUID support (hyphens in component values)
 * - Idempotency of thread ID generation
 */

import { describe, it, expect } from 'vitest'

import { createV2ThreadId, parseV2ThreadId } from '../utils/thread'

// =============================================================================
// createV2ThreadId Tests
// =============================================================================

describe('createV2ThreadId', () => {
  describe('chat mode', () => {
    it('creates thread ID with all 4 components using : delimiter', () => {
      const result = createV2ThreadId('chat', 'deal123', 'user456', 'conv789')
      expect(result).toBe('chat:deal123:user456:conv789')
    })

    it('handles UUIDs with hyphens correctly', () => {
      const result = createV2ThreadId(
        'chat',
        '550e8400-e29b-41d4-a716-446655440000',
        'user-123-abc',
        'conv-456-def'
      )
      expect(result).toBe(
        'chat:550e8400-e29b-41d4-a716-446655440000:user-123-abc:conv-456-def'
      )
    })
  })

  describe('irl mode', () => {
    it('creates thread ID with all 4 components', () => {
      const result = createV2ThreadId('irl', 'deal123', 'user456', 'conv789')
      expect(result).toBe('irl:deal123:user456:conv789')
    })
  })

  describe('cim mode', () => {
    it('creates thread ID with 3 components (no userId)', () => {
      const result = createV2ThreadId('cim', 'deal123', undefined, 'cim001')
      expect(result).toBe('cim:deal123:cim001')
    })

    it('creates CIM thread ID with only 3 parts regardless of userId', () => {
      // CIM is deal-scoped, userId is ignored even if provided
      const result = createV2ThreadId('cim', 'deal123', undefined, 'cim001')
      expect(result).toBe('cim:deal123:cim001')
      expect(result.split(':').length).toBe(3)
    })
  })

  describe('error handling', () => {
    it('throws if dealId is empty', () => {
      expect(() => createV2ThreadId('chat', '', 'user', 'conv')).toThrow(
        'dealId is required and cannot be empty'
      )
    })

    it('throws if conversationId is empty', () => {
      expect(() => createV2ThreadId('chat', 'deal', 'user', '')).toThrow(
        'conversationId is required and cannot be empty'
      )
    })

    it('throws if userId missing for chat mode', () => {
      expect(() =>
        createV2ThreadId('chat', 'deal', undefined, 'conv')
      ).toThrow('userId is required for chat/irl modes')
    })

    it('throws if userId missing for irl mode', () => {
      expect(() => createV2ThreadId('irl', 'deal', undefined, 'conv')).toThrow(
        'userId is required for chat/irl modes'
      )
    })
  })

  describe('special character validation', () => {
    it('throws if dealId contains colon (delimiter)', () => {
      expect(() =>
        createV2ThreadId('chat', 'deal:id', 'user', 'conv')
      ).toThrow('dealId contains invalid characters')
    })

    it('throws if dealId contains spaces', () => {
      expect(() =>
        createV2ThreadId('chat', 'deal id', 'user', 'conv')
      ).toThrow('dealId contains invalid characters')
    })

    it('throws if userId contains special chars', () => {
      expect(() =>
        createV2ThreadId('chat', 'deal', 'user$id', 'conv')
      ).toThrow('userId contains invalid characters')
    })

    it('throws if conversationId contains newlines', () => {
      expect(() =>
        createV2ThreadId('chat', 'deal', 'user', 'conv\nid')
      ).toThrow('conversationId contains invalid characters')
    })

    it('allows hyphens for UUID support', () => {
      // Should NOT throw - hyphens are allowed for UUIDs
      expect(() =>
        createV2ThreadId('chat', 'deal-123', 'user-456', 'conv-789')
      ).not.toThrow()
    })

    it('allows underscores', () => {
      expect(() =>
        createV2ThreadId('chat', 'deal_123', 'user_456', 'conv_789')
      ).not.toThrow()
    })
  })

  describe('idempotency', () => {
    it('same inputs produce same output', () => {
      const a = createV2ThreadId('chat', 'd1', 'u1', 'c1')
      const b = createV2ThreadId('chat', 'd1', 'u1', 'c1')
      expect(a).toBe(b)
    })

    it('different inputs produce different outputs', () => {
      const a = createV2ThreadId('chat', 'd1', 'u1', 'c1')
      const b = createV2ThreadId('chat', 'd1', 'u1', 'c2')
      expect(a).not.toBe(b)
    })
  })
})

// =============================================================================
// parseV2ThreadId Tests
// =============================================================================

describe('parseV2ThreadId', () => {
  describe('chat mode parsing', () => {
    it('parses chat thread ID correctly', () => {
      const result = parseV2ThreadId('chat:deal123:user456:conv789')
      expect(result).toEqual({
        workflowMode: 'chat',
        dealId: 'deal123',
        userId: 'user456',
        conversationId: 'conv789',
      })
    })

    it('parses chat thread ID with UUID deal ID correctly', () => {
      const result = parseV2ThreadId(
        'chat:550e8400-e29b-41d4-a716-446655440000:user123:conv456'
      )
      expect(result).toEqual({
        workflowMode: 'chat',
        dealId: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'user123',
        conversationId: 'conv456',
      })
    })

    it('parses chat thread ID with UUIDs in all positions', () => {
      const result = parseV2ThreadId(
        'chat:550e8400-e29b-41d4-a716-446655440000:user-abc-123:conv-def-456'
      )
      expect(result).toEqual({
        workflowMode: 'chat',
        dealId: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'user-abc-123',
        conversationId: 'conv-def-456',
      })
    })
  })

  describe('irl mode parsing', () => {
    it('parses irl thread ID correctly', () => {
      const result = parseV2ThreadId('irl:deal123:user456:conv789')
      expect(result).toEqual({
        workflowMode: 'irl',
        dealId: 'deal123',
        userId: 'user456',
        conversationId: 'conv789',
      })
    })
  })

  describe('cim mode parsing', () => {
    it('parses CIM thread ID correctly (userId is null)', () => {
      const result = parseV2ThreadId('cim:deal123:cim001')
      expect(result).toEqual({
        workflowMode: 'cim',
        dealId: 'deal123',
        userId: null,
        conversationId: 'cim001',
      })
    })

    it('parses CIM thread ID with hyphenated cimId', () => {
      const result = parseV2ThreadId('cim:deal123:cim-001-draft')
      expect(result).toEqual({
        workflowMode: 'cim',
        dealId: 'deal123',
        userId: null,
        conversationId: 'cim-001-draft',
      })
    })

    it('parses CIM thread ID with UUID dealId', () => {
      const result = parseV2ThreadId(
        'cim:550e8400-e29b-41d4-a716-446655440000:cim001'
      )
      expect(result).toEqual({
        workflowMode: 'cim',
        dealId: '550e8400-e29b-41d4-a716-446655440000',
        userId: null,
        conversationId: 'cim001',
      })
    })
  })

  describe('invalid formats', () => {
    it('returns null for invalid format - no prefix', () => {
      expect(parseV2ThreadId('invalid')).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(parseV2ThreadId('')).toBeNull()
    })

    it('returns null for chat with only 2 components', () => {
      expect(parseV2ThreadId('chat:only:two')).toBeNull()
    })

    it('returns null for chat with only 3 components', () => {
      expect(parseV2ThreadId('chat:deal:user')).toBeNull()
    })

    it('returns null for chat with 5 components', () => {
      expect(parseV2ThreadId('chat:a:b:c:d')).toBeNull()
    })

    it('returns null for cim with only 2 components', () => {
      expect(parseV2ThreadId('cim:deal')).toBeNull()
    })

    it('returns null for cim with 4 components', () => {
      expect(parseV2ThreadId('cim:deal:user:conv')).toBeNull()
    })

    it('returns null for unknown workflow mode', () => {
      expect(parseV2ThreadId('unknown:deal:user:conv')).toBeNull()
    })

    it('returns null for null input', () => {
      expect(parseV2ThreadId(null as unknown as string)).toBeNull()
    })

    it('returns null for undefined input', () => {
      expect(parseV2ThreadId(undefined as unknown as string)).toBeNull()
    })

    it('returns null for non-string input', () => {
      expect(parseV2ThreadId(123 as unknown as string)).toBeNull()
    })

    it('returns null for old hyphen-delimited format', () => {
      // Should NOT parse old format - we use : now
      expect(parseV2ThreadId('chat-deal-user-conv')).toBeNull()
    })
  })

  describe('roundtrip', () => {
    it('creates and parses chat thread ID roundtrip', () => {
      const threadId = createV2ThreadId('chat', 'deal1', 'user1', 'conv1')
      const parsed = parseV2ThreadId(threadId)
      expect(parsed).toEqual({
        workflowMode: 'chat',
        dealId: 'deal1',
        userId: 'user1',
        conversationId: 'conv1',
      })
    })

    it('creates and parses CIM thread ID roundtrip', () => {
      const threadId = createV2ThreadId('cim', 'deal1', undefined, 'cim1')
      const parsed = parseV2ThreadId(threadId)
      expect(parsed).toEqual({
        workflowMode: 'cim',
        dealId: 'deal1',
        userId: null,
        conversationId: 'cim1',
      })
    })

    it('creates and parses irl thread ID roundtrip', () => {
      const threadId = createV2ThreadId('irl', 'deal1', 'user1', 'irl1')
      const parsed = parseV2ThreadId(threadId)
      expect(parsed).toEqual({
        workflowMode: 'irl',
        dealId: 'deal1',
        userId: 'user1',
        conversationId: 'irl1',
      })
    })

    it('creates and parses UUID-containing thread ID roundtrip', () => {
      const dealId = '550e8400-e29b-41d4-a716-446655440000'
      const userId = 'user-abc-123-def'
      const convId = 'conv-ghi-456-jkl'

      const threadId = createV2ThreadId('chat', dealId, userId, convId)
      const parsed = parseV2ThreadId(threadId)

      expect(parsed).toEqual({
        workflowMode: 'chat',
        dealId,
        userId,
        conversationId: convId,
      })
    })
  })
})
