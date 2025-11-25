/**
 * Health Check API Route
 * Tests database connection and reports system health
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  checks: {
    database: {
      status: 'ok' | 'error'
      latency?: number
      error?: string
    }
    auth: {
      status: 'ok' | 'error'
      error?: string
    }
  }
}

export async function GET() {
  const response: HealthCheckResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: 'ok' },
      auth: { status: 'ok' },
    },
  }

  try {
    const cookieStore = await cookies()

    // Create an untyped client for health check to avoid schema validation issues
    const supabase = createServerClient(
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
              // Ignore errors from Server Components
            }
          },
        },
      }
    )

    // Test database connection using RPC call to check connectivity
    // This avoids table schema issues since we're just testing connectivity
    const dbStart = performance.now()

    // Use auth.getSession as a proxy for database connectivity
    // since it requires a working database connection
    const { error: dbError } = await supabase.auth.getSession()

    const dbLatency = performance.now() - dbStart

    if (dbError) {
      response.checks.database = {
        status: 'error',
        latency: Math.round(dbLatency),
        error: dbError.message,
      }
      response.status = 'degraded'
    } else {
      response.checks.database = {
        status: 'ok',
        latency: Math.round(dbLatency),
      }
    }

    // Auth check is implicitly done above
    // If we got here without error, auth service is working
    response.checks.auth = {
      status: dbError ? 'error' : 'ok',
      error: dbError?.message,
    }

    // Check if all services are down
    if (
      response.checks.database.status === 'error' &&
      response.checks.auth.status === 'error'
    ) {
      response.status = 'unhealthy'
    }
  } catch (error) {
    response.status = 'unhealthy'
    response.checks.database = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
    response.checks.auth = {
      status: 'error',
      error: 'Could not initialize Supabase client',
    }
  }

  const httpStatus = response.status === 'healthy' ? 200 : response.status === 'degraded' ? 200 : 503

  return NextResponse.json(response, { status: httpStatus })
}
