/**
 * Neo4j Health Check API Endpoint
 * Returns Neo4j connection status and schema info
 * Story: E1.7 - Configure Neo4j Graph Database (AC: #8)
 *
 * GET /api/health/neo4j
 */

import { NextResponse } from 'next/server'
import { getSession, getNeo4jSchemaStatus } from '@/lib/neo4j'

export const dynamic = 'force-dynamic'

interface HealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded'
  neo4j: {
    connected: boolean
    responseTimeMs: number
    version?: string
    constraints?: number
    indexes?: number
  }
  error?: string
  timestamp: string
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const startTime = Date.now()
  const timestamp = new Date().toISOString()

  try {
    // Test connection with simple query
    const session = getSession()
    try {
      // Get Neo4j version and verify connection
      const result = await session.run(
        'CALL dbms.components() YIELD name, versions RETURN name, versions[0] AS version'
      )

      const version = result.records[0]?.get('version') as string | undefined
      const responseTimeMs = Date.now() - startTime

      // Get schema status
      let schemaStatus: { constraints: string[]; indexes: string[] } | null = null
      try {
        schemaStatus = await getNeo4jSchemaStatus()
      } catch {
        // Schema query failed, but connection is still healthy
      }

      return NextResponse.json({
        status: 'healthy',
        neo4j: {
          connected: true,
          responseTimeMs,
          version,
          constraints: schemaStatus?.constraints.length,
          indexes: schemaStatus?.indexes.length,
        },
        timestamp,
      })
    } finally {
      await session.close()
    }
  } catch (error) {
    const responseTimeMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Check if it's a connection error vs other error
    const isConnectionError =
      errorMessage.includes('connect') ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('authentication')

    return NextResponse.json(
      {
        status: 'unhealthy',
        neo4j: {
          connected: false,
          responseTimeMs,
        },
        error: errorMessage,
        timestamp,
      },
      { status: isConnectionError ? 503 : 500 }
    )
  }
}
