/**
 * pg-boss Health Check API Endpoint
 * Returns the health status of the pg-boss job queue
 * Story: E1.8 - Configure pg-boss Job Queue (AC: #8)
 *
 * GET /api/health/pgboss
 */

import { NextResponse } from 'next/server'
import {
  getPgBoss,
  isPgBossRunning,
  getRegisteredHandlers,
} from '@/lib/pgboss'

interface HealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded'
  pgboss: {
    connected: boolean
    running: boolean
    registeredHandlers: string[]
    responseTimeMs: number
  }
  error?: string
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const startTime = Date.now()

  try {
    // Check if pg-boss is already running
    const isRunning = isPgBossRunning()

    // Try to get or initialize pg-boss
    const boss = await getPgBoss()

    // Get registered handlers
    const handlers = getRegisteredHandlers()

    const responseTimeMs = Date.now() - startTime

    return NextResponse.json({
      status: 'healthy',
      pgboss: {
        connected: true,
        running: isRunning,
        registeredHandlers: handlers,
        responseTimeMs,
      },
    })
  } catch (error) {
    const responseTimeMs = Date.now() - startTime
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    console.error('[api/health/pgboss] Error:', errorMessage)

    return NextResponse.json(
      {
        status: 'unhealthy',
        pgboss: {
          connected: false,
          running: false,
          registeredHandlers: [],
          responseTimeMs,
        },
        error: errorMessage,
      },
      { status: 503 }
    )
  }
}
