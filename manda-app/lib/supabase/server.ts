/**
 * Supabase Server Client
 * Use this client in Server Components, Server Actions, and Route Handlers
 * Handles server-side authentication and database queries with cookie management
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/supabase/types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  )
}

/**
 * Create a Supabase client that authenticates from an Authorization header
 * Use this in API routes that need to support Bearer token authentication
 * (e.g., for CLI tools, benchmarks, external integrations)
 *
 * Uses the standard createClient from @supabase/supabase-js which properly
 * handles access tokens via Authorization header (unlike createServerClient
 * which is cookie-based).
 *
 * @param authHeader - The Authorization header value (e.g., "Bearer <token>")
 */
export async function createClientFromAuthHeader(authHeader: string | null) {
  // Parse the Bearer token
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null

  if (!token) {
    return null
  }

  // Use the standard Supabase client with the access token
  // This client properly handles JWT tokens for authentication
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')

  const client = createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )

  return client
}

/**
 * Supabase Admin Client (Service Role)
 * Use this ONLY in trusted server-side contexts where you need to bypass RLS
 * NEVER expose this client or its operations to the client-side
 */
export async function createAdminClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Ignore errors from Server Components
          }
        },
      },
    }
  )
}
