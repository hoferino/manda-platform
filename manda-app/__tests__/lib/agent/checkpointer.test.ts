/**
 * Checkpointer Unit Tests
 *
 * Story: E13.9 - PostgreSQL Checkpointer for LangGraph (AC: #11)
 *
 * Tests the checkpointer module including:
 * - Successful PostgresSaver initialization
 * - Fallback to MemorySaver when DATABASE_URL not set
 * - Fallback to MemorySaver when connection fails
 * - Thread ID creation and parsing
 * - Observability functions
 *
 * References:
 * - [Source: docs/sprint-artifacts/stories/e13-9-postgresql-checkpointer.md]
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MemorySaver } from '@langchain/langgraph'

// Mock PostgresSaver before importing checkpointer
// The mock factory must be self-contained (no external references)
vi.mock('@langchain/langgraph-checkpoint-postgres', () => {
  // Create mock class inside the factory
  const mockSetup = vi.fn().mockResolvedValue(undefined)
  const mockPut = vi.fn().mockResolvedValue(undefined)
  const mockGet = vi.fn().mockResolvedValue(null)
  const mockList = vi.fn().mockResolvedValue([])

  class MockPostgresSaver {
    setup = mockSetup
    put = mockPut
    get = mockGet
    list = mockList

    static fromConnString = vi.fn().mockImplementation(() => new MockPostgresSaver())
  }

  return {
    PostgresSaver: MockPostgresSaver,
  }
})

import {
  getCheckpointer,
  resetCheckpointer,
  isUsingPostgres,
  isCheckpointerInitialized,
  getCheckpointMetadata,
  logCheckpointOperation,
  createCIMThreadId,
  createSupervisorThreadId,
  parseDealIdFromThreadId,
} from '@/lib/agent/checkpointer'
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres'

describe('Checkpointer', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset checkpointer state before each test
    resetCheckpointer()
    // Reset mocks
    vi.clearAllMocks()
    // Restore environment
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('getCheckpointer', () => {
    it('should return MemorySaver when DATABASE_URL is not set', async () => {
      delete process.env.DATABASE_URL

      const checkpointer = await getCheckpointer()

      expect(checkpointer).toBeInstanceOf(MemorySaver)
      expect(isUsingPostgres()).toBe(false)
    })

    it('should initialize PostgresSaver when DATABASE_URL is set', async () => {
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'

      const checkpointer = await getCheckpointer()

      expect(PostgresSaver.fromConnString).toHaveBeenCalledWith(
        'postgresql://test:test@localhost:5432/test'
      )
      expect(isCheckpointerInitialized()).toBe(true)
    })

    it('should return cached instance on subsequent calls', async () => {
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'

      const first = await getCheckpointer()
      const second = await getCheckpointer()

      expect(first).toBe(second)
      // fromConnString should only be called once
      expect(PostgresSaver.fromConnString).toHaveBeenCalledTimes(1)
    })

    it('should fall back to MemorySaver when PostgresSaver.setup() fails', async () => {
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'

      // Mock setup to throw
      const mockPostgresSaver = {
        setup: vi.fn().mockRejectedValue(new Error('Connection failed')),
      }
      vi.mocked(PostgresSaver.fromConnString).mockReturnValue(mockPostgresSaver as unknown as PostgresSaver)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const checkpointer = await getCheckpointer()

      expect(checkpointer).toBeInstanceOf(MemorySaver)
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Checkpointer] PostgresSaver initialization failed:',
        expect.any(Error)
      )
      expect(warnSpy).toHaveBeenCalledWith(
        '[Checkpointer] Falling back to in-memory MemorySaver'
      )

      consoleSpy.mockRestore()
      warnSpy.mockRestore()
    })

    it('should handle concurrent initialization calls', async () => {
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'

      // Start multiple concurrent calls
      const promises = [
        getCheckpointer(),
        getCheckpointer(),
        getCheckpointer(),
      ]

      const results = await Promise.all(promises)

      // All should return the same instance
      expect(results[0]).toBe(results[1])
      expect(results[1]).toBe(results[2])
      // fromConnString should only be called once
      expect(PostgresSaver.fromConnString).toHaveBeenCalledTimes(1)
    })
  })

  describe('resetCheckpointer', () => {
    it('should reset initialized state', async () => {
      delete process.env.DATABASE_URL
      await getCheckpointer()
      expect(isCheckpointerInitialized()).toBe(true)

      resetCheckpointer()

      expect(isCheckpointerInitialized()).toBe(false)
    })

    it('should allow re-initialization after reset', async () => {
      delete process.env.DATABASE_URL

      const first = await getCheckpointer()
      resetCheckpointer()
      const second = await getCheckpointer()

      // Should be different instances after reset
      expect(first).not.toBe(second)
    })
  })

  describe('isUsingPostgres', () => {
    it('should return false when using MemorySaver', async () => {
      delete process.env.DATABASE_URL
      await getCheckpointer()

      expect(isUsingPostgres()).toBe(false)
    })
  })

  describe('getCheckpointMetadata', () => {
    it('should return metadata with MemorySaver type', async () => {
      delete process.env.DATABASE_URL
      await getCheckpointer()

      const metadata = getCheckpointMetadata()

      expect(metadata.checkpointer_type).toBe('MemorySaver')
      expect(metadata.checkpointer_initialized).toBe(true)
      expect(metadata.checkpointer_durable).toBe(false)
      expect(metadata.checkpoint_metadata_at).toBeDefined()
    })

    it('should include timestamp in ISO format', async () => {
      delete process.env.DATABASE_URL
      await getCheckpointer()

      const metadata = getCheckpointMetadata()
      const timestamp = metadata.checkpoint_metadata_at as string

      expect(() => new Date(timestamp)).not.toThrow()
    })
  })

  describe('logCheckpointOperation', () => {
    it('should log structured JSON', async () => {
      delete process.env.DATABASE_URL
      await getCheckpointer()

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      logCheckpointOperation('init', 'test-thread', { extra: 'data' })

      expect(consoleSpy).toHaveBeenCalledTimes(1)
      const loggedJson = JSON.parse(consoleSpy.mock.calls[0]?.[0] ?? '{}')

      expect(loggedJson.event).toBe('checkpoint_operation')
      expect(loggedJson.operation).toBe('init')
      expect(loggedJson.checkpointer_type).toBe('MemorySaver')
      expect(loggedJson.thread_id).toBe('test-thread')
      expect(loggedJson.extra).toBe('data')
      expect(loggedJson.timestamp).toBeDefined()

      consoleSpy.mockRestore()
    })
  })
})

describe('Thread ID Helpers', () => {
  describe('createCIMThreadId', () => {
    it('should create thread ID with correct format', () => {
      const threadId = createCIMThreadId('deal-123', 'cim-456')
      expect(threadId).toBe('cim-deal-123-cim-456')
    })

    it('should handle UUID-style IDs', () => {
      const dealId = '550e8400-e29b-41d4-a716-446655440000'
      const cimId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
      const threadId = createCIMThreadId(dealId, cimId)
      expect(threadId).toBe(`cim-${dealId}-${cimId}`)
    })
  })

  describe('createSupervisorThreadId', () => {
    it('should create thread ID with current timestamp when not provided', () => {
      const before = Date.now()
      const threadId = createSupervisorThreadId('deal-123')
      const after = Date.now()

      expect(threadId).toMatch(/^supervisor-deal-123-\d+$/)

      // Extract timestamp and verify it's within range
      const timestamp = parseInt(threadId.split('-').pop() ?? '0', 10)
      expect(timestamp).toBeGreaterThanOrEqual(before)
      expect(timestamp).toBeLessThanOrEqual(after)
    })

    it('should use provided timestamp', () => {
      const timestamp = 1704067200000
      const threadId = createSupervisorThreadId('deal-123', timestamp)
      expect(threadId).toBe('supervisor-deal-123-1704067200000')
    })
  })

  describe('parseDealIdFromThreadId', () => {
    it('should parse deal ID from CIM thread ID with simple IDs', () => {
      // Thread format: cim-{dealId}-{cimId}
      // With simple IDs like 'deal123' and 'cim456'
      const dealId = parseDealIdFromThreadId('cim-deal123-cim456')
      expect(dealId).toBe('deal123')
    })

    it('should parse deal ID from supervisor thread ID', () => {
      // Thread format: supervisor-{dealId}-{timestamp}
      const dealId = parseDealIdFromThreadId('supervisor-deal123-1704067200000')
      expect(dealId).toBe('deal123')
    })

    it('should parse UUID deal ID from CIM thread', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000'
      const cimId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
      const threadId = `cim-${uuid}-${cimId}`
      const dealId = parseDealIdFromThreadId(threadId)
      expect(dealId).toBe(uuid)
    })

    it('should return null for invalid thread ID format', () => {
      expect(parseDealIdFromThreadId('invalid')).toBeNull()
      expect(parseDealIdFromThreadId('')).toBeNull()
      expect(parseDealIdFromThreadId('other-deal-123-cim-456')).toBeNull()
    })

    it('should return null for partial thread ID', () => {
      expect(parseDealIdFromThreadId('cim-')).toBeNull()
      expect(parseDealIdFromThreadId('supervisor-')).toBeNull()
    })
  })
})
