/**
 * pg-boss Client Singleton
 * PostgreSQL-based job queue for background processing
 * Story: E1.8 - Configure pg-boss Job Queue (AC: #1, #2)
 */

import { PgBoss, type ConstructorOptions } from 'pg-boss'

// Singleton instance
let boss: PgBoss | null = null
let isStarting = false
let startPromise: Promise<PgBoss> | null = null

// Get configuration from environment
const getConfig = (): ConstructorOptions => {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  return {
    connectionString,
    schema: process.env.PGBOSS_SCHEMA || 'pgboss',
    // Connection pool settings
    max: 10,
    // Maintenance settings
    maintenanceIntervalSeconds: 120,
  }
}

/**
 * Get or create the pg-boss singleton instance
 * Ensures only one instance is created even with concurrent calls
 */
export async function getPgBoss(): Promise<PgBoss> {
  // Return existing instance if available and started
  if (boss) {
    return boss
  }

  // If already starting, wait for the existing promise
  if (isStarting && startPromise) {
    return startPromise
  }

  // Start new instance
  isStarting = true
  startPromise = (async () => {
    try {
      const config = getConfig()
      boss = new PgBoss(config)

      // Set up error handler
      boss.on('error', (error: Error) => {
        console.error('[pg-boss] Error:', error)
      })

      // Log when wip (work in progress) updates
      boss.on('wip', (data) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[pg-boss] WIP:', JSON.stringify(data))
        }
      })

      // Start pg-boss (creates tables if they don't exist)
      await boss.start()
      console.log('[pg-boss] Started successfully')

      return boss
    } catch (error) {
      boss = null
      isStarting = false
      startPromise = null
      throw error
    }
  })()

  return startPromise
}

/**
 * Get pg-boss instance if already started (non-async version)
 * Returns null if not started yet
 */
export function getPgBossSync(): PgBoss | null {
  return boss
}

/**
 * Check if pg-boss is running
 */
export function isPgBossRunning(): boolean {
  return boss !== null
}

/**
 * Gracefully stop pg-boss (AC: #8)
 * Completes current jobs before stopping
 */
export async function closePgBoss(): Promise<void> {
  if (boss) {
    console.log('[pg-boss] Stopping gracefully...')
    await boss.stop({ graceful: true, timeout: 30000 })
    boss = null
    isStarting = false
    startPromise = null
    console.log('[pg-boss] Stopped')
  }
}

/**
 * Force stop pg-boss (for emergency shutdown)
 */
export async function forceClosePgBoss(): Promise<void> {
  if (boss) {
    console.log('[pg-boss] Force stopping...')
    await boss.stop({ graceful: false })
    boss = null
    isStarting = false
    startPromise = null
    console.log('[pg-boss] Force stopped')
  }
}

/**
 * Verify pg-boss connection and return health status
 */
export async function verifyPgBossConnection(): Promise<{
  connected: boolean
  version?: string
  error?: string
}> {
  try {
    await getPgBoss()
    // pg-boss doesn't have a direct version getter, but if start succeeded, it's connected
    return {
      connected: true,
      version: 'pg-boss connected',
    }
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Export types for convenience
export type { PgBoss }
