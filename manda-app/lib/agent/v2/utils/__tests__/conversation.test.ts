/**
 * Conversation ID Utilities - Unit Tests
 *
 * Story: 1-4 Implement Thread ID Generation and Management
 * Code Review: Added tests for isValidConversationId edge cases
 */

import { describe, it, expect } from 'vitest'
import { generateConversationId, isValidConversationId } from '../conversation'

describe('generateConversationId', () => {
  it('returns a valid UUID v4 string', () => {
    const id = generateConversationId()

    // Should be a string
    expect(typeof id).toBe('string')

    // Should match UUID v4 format
    const uuidV4Pattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    expect(id).toMatch(uuidV4Pattern)
  })

  it('generates unique IDs on each call', () => {
    const ids = new Set<string>()

    // Generate 100 IDs and verify uniqueness
    for (let i = 0; i < 100; i++) {
      ids.add(generateConversationId())
    }

    expect(ids.size).toBe(100)
  })

  it('generated IDs pass isValidConversationId check', () => {
    const id = generateConversationId()
    expect(isValidConversationId(id)).toBe(true)
  })
})

describe('isValidConversationId', () => {
  describe('valid UUIDs', () => {
    it('returns true for valid UUID v4', () => {
      expect(isValidConversationId('550e8400-e29b-41d4-a716-446655440000')).toBe(
        true
      )
    })

    it('returns true for UUID v4 with lowercase hex', () => {
      expect(isValidConversationId('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d')).toBe(
        true
      )
    })

    it('returns true for UUID v4 with uppercase hex', () => {
      expect(isValidConversationId('A1B2C3D4-E5F6-4A7B-8C9D-0E1F2A3B4C5D')).toBe(
        true
      )
    })

    it('returns true for UUID v4 with mixed case', () => {
      expect(isValidConversationId('A1b2C3d4-E5f6-4A7b-8C9d-0E1f2A3b4C5d')).toBe(
        true
      )
    })
  })

  describe('invalid inputs', () => {
    it('returns false for null', () => {
      expect(isValidConversationId(null as unknown as string)).toBe(false)
    })

    it('returns false for undefined', () => {
      expect(isValidConversationId(undefined as unknown as string)).toBe(false)
    })

    it('returns false for empty string', () => {
      expect(isValidConversationId('')).toBe(false)
    })

    it('returns false for non-string values', () => {
      expect(isValidConversationId(123 as unknown as string)).toBe(false)
      expect(isValidConversationId({} as unknown as string)).toBe(false)
      expect(isValidConversationId([] as unknown as string)).toBe(false)
    })

    it('returns false for random string', () => {
      expect(isValidConversationId('not-a-uuid')).toBe(false)
      expect(isValidConversationId('hello-world')).toBe(false)
    })

    it('returns false for UUID without hyphens', () => {
      expect(isValidConversationId('550e8400e29b41d4a716446655440000')).toBe(
        false
      )
    })

    it('returns false for UUID with wrong hyphen positions', () => {
      expect(isValidConversationId('550e-8400-e29b-41d4-a716446655440000')).toBe(
        false
      )
    })
  })

  describe('UUID version validation (v4 only)', () => {
    it('returns false for UUID v1 (time-based)', () => {
      // UUID v1 has version digit 1 in position 14
      expect(isValidConversationId('550e8400-e29b-11d4-a716-446655440000')).toBe(
        false
      )
    })

    it('returns false for UUID v3 (MD5 hash)', () => {
      // UUID v3 has version digit 3 in position 14
      expect(isValidConversationId('550e8400-e29b-31d4-a716-446655440000')).toBe(
        false
      )
    })

    it('returns false for UUID v5 (SHA-1 hash)', () => {
      // UUID v5 has version digit 5 in position 14
      expect(isValidConversationId('550e8400-e29b-51d4-a716-446655440000')).toBe(
        false
      )
    })

    it('returns true for UUID v4 (random)', () => {
      // UUID v4 has version digit 4 in position 14
      expect(isValidConversationId('550e8400-e29b-41d4-a716-446655440000')).toBe(
        true
      )
    })
  })

  describe('variant validation', () => {
    it('returns true for variant 1 (8, 9, a, b)', () => {
      expect(isValidConversationId('550e8400-e29b-41d4-8716-446655440000')).toBe(
        true
      )
      expect(isValidConversationId('550e8400-e29b-41d4-9716-446655440000')).toBe(
        true
      )
      expect(isValidConversationId('550e8400-e29b-41d4-a716-446655440000')).toBe(
        true
      )
      expect(isValidConversationId('550e8400-e29b-41d4-b716-446655440000')).toBe(
        true
      )
    })

    it('returns false for invalid variant (c, d, e, f, 0-7)', () => {
      expect(isValidConversationId('550e8400-e29b-41d4-c716-446655440000')).toBe(
        false
      )
      expect(isValidConversationId('550e8400-e29b-41d4-d716-446655440000')).toBe(
        false
      )
      expect(isValidConversationId('550e8400-e29b-41d4-0716-446655440000')).toBe(
        false
      )
      expect(isValidConversationId('550e8400-e29b-41d4-7716-446655440000')).toBe(
        false
      )
    })
  })
})
