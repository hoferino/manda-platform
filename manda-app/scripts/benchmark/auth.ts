/**
 * Benchmark Authentication Helpers
 *
 * Handles authentication for benchmark API requests.
 * Story: E13.7 - Performance Benchmarking Suite
 */

import { createClient } from '@supabase/supabase-js'

/**
 * Get authentication headers for benchmark API requests
 *
 * Supports two authentication methods:
 * 1. Pre-configured service token (BENCHMARK_AUTH_TOKEN)
 * 2. Test user login (BENCHMARK_USER_EMAIL + BENCHMARK_USER_PASSWORD)
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  // Option 1: Pre-configured service token
  const token = process.env.BENCHMARK_AUTH_TOKEN
  if (token) {
    console.log('[auth] Using pre-configured auth token')
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  }

  // Option 2: Login as test user
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const email = process.env.BENCHMARK_USER_EMAIL
  const password = process.env.BENCHMARK_USER_PASSWORD

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  }

  if (!email || !password) {
    throw new Error(
      'Missing auth configuration. Set either BENCHMARK_AUTH_TOKEN or (BENCHMARK_USER_EMAIL + BENCHMARK_USER_PASSWORD)'
    )
  }

  console.log('[auth] Logging in as test user:', email)

  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw new Error(`Authentication failed: ${error.message}`)
  }

  if (!data.session?.access_token) {
    throw new Error('No access token received from authentication')
  }

  console.log('[auth] Successfully authenticated')

  return {
    Authorization: `Bearer ${data.session.access_token}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Validate that required environment variables are set
 */
export function validateAuthConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check for at least one auth method
  const hasToken = !!process.env.BENCHMARK_AUTH_TOKEN
  const hasUserCreds =
    !!process.env.BENCHMARK_USER_EMAIL && !!process.env.BENCHMARK_USER_PASSWORD

  if (!hasToken && !hasUserCreds) {
    errors.push(
      'No auth method configured. Set BENCHMARK_AUTH_TOKEN or (BENCHMARK_USER_EMAIL + BENCHMARK_USER_PASSWORD)'
    )
  }

  if (!hasToken) {
    // Need Supabase config for user login
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      errors.push('Missing NEXT_PUBLIC_SUPABASE_URL')
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      errors.push('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
