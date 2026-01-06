/**
 * Auth Module Tests
 *
 * Story: E13.7 - Performance Benchmarking Suite
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getAuthHeaders, validateAuthConfig } from '../../../scripts/benchmark/auth'

// Store original env
const originalEnv = process.env

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'test-access-token',
          },
        },
        error: null,
      }),
    },
  })),
}))

describe('validateAuthConfig', () => {
  beforeEach(() => {
    // Reset env before each test
    process.env = { ...originalEnv }
    // Clear all auth-related env vars
    delete process.env.BENCHMARK_AUTH_TOKEN
    delete process.env.BENCHMARK_USER_EMAIL
    delete process.env.BENCHMARK_USER_PASSWORD
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should be valid when BENCHMARK_AUTH_TOKEN is set', () => {
    process.env.BENCHMARK_AUTH_TOKEN = 'test-token'

    const result = validateAuthConfig()

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should be valid when user credentials and Supabase config are set', () => {
    process.env.BENCHMARK_USER_EMAIL = 'test@example.com'
    process.env.BENCHMARK_USER_PASSWORD = 'password123'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

    const result = validateAuthConfig()

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should fail when no auth method is configured', () => {
    const result = validateAuthConfig()

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('No auth method configured')
  })

  it('should fail when user credentials set but Supabase URL missing', () => {
    process.env.BENCHMARK_USER_EMAIL = 'test@example.com'
    process.env.BENCHMARK_USER_PASSWORD = 'password123'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
    // Missing: NEXT_PUBLIC_SUPABASE_URL

    const result = validateAuthConfig()

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing NEXT_PUBLIC_SUPABASE_URL')
  })

  it('should fail when user credentials set but Supabase key missing', () => {
    process.env.BENCHMARK_USER_EMAIL = 'test@example.com'
    process.env.BENCHMARK_USER_PASSWORD = 'password123'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    // Missing: NEXT_PUBLIC_SUPABASE_ANON_KEY

    const result = validateAuthConfig()

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY')
  })

  it('should fail when only email is set without password', () => {
    process.env.BENCHMARK_USER_EMAIL = 'test@example.com'
    // Missing password

    const result = validateAuthConfig()

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('No auth method configured')
  })
})

describe('getAuthHeaders', () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.BENCHMARK_AUTH_TOKEN
    delete process.env.BENCHMARK_USER_EMAIL
    delete process.env.BENCHMARK_USER_PASSWORD
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should return headers with token when BENCHMARK_AUTH_TOKEN is set', async () => {
    process.env.BENCHMARK_AUTH_TOKEN = 'my-service-token'

    const headers = await getAuthHeaders()

    expect(headers.Authorization).toBe('Bearer my-service-token')
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('should throw error when Supabase config is missing', async () => {
    process.env.BENCHMARK_USER_EMAIL = 'test@example.com'
    process.env.BENCHMARK_USER_PASSWORD = 'password123'
    // Missing Supabase config

    await expect(getAuthHeaders()).rejects.toThrow('Missing Supabase configuration')
  })

  it('should throw error when user credentials are missing', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
    // Missing user credentials

    await expect(getAuthHeaders()).rejects.toThrow('Missing auth configuration')
  })
})
