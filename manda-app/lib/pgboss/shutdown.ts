/**
 * pg-boss Graceful Shutdown Handler
 * Handles SIGTERM/SIGINT signals to gracefully stop job processing
 * Story: E1.8 - Configure pg-boss Job Queue (AC: #8)
 */

import { closePgBoss, forceClosePgBoss, isPgBossRunning } from './client'
import { closeNeo4jDriver } from '../neo4j'

// Track if shutdown is in progress
let isShuttingDown = false

/**
 * Gracefully shutdown all services
 * Called on SIGTERM/SIGINT signals
 */
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    console.log(`[shutdown] Already shutting down, ignoring ${signal}`)
    return
  }

  isShuttingDown = true
  console.log(`[shutdown] ${signal} received, starting graceful shutdown...`)

  const shutdownTimeout = setTimeout(async () => {
    console.log('[shutdown] Graceful shutdown timeout, forcing exit...')
    await forceClosePgBoss()
    process.exit(1)
  }, 30000) // 30 second timeout

  try {
    // Stop pg-boss gracefully (completes current jobs)
    if (isPgBossRunning()) {
      console.log('[shutdown] Stopping pg-boss workers...')
      await closePgBoss()
      console.log('[shutdown] pg-boss stopped')
    }

    // Close Neo4j driver
    console.log('[shutdown] Closing Neo4j connection...')
    await closeNeo4jDriver()
    console.log('[shutdown] Neo4j connection closed')

    clearTimeout(shutdownTimeout)
    console.log('[shutdown] Graceful shutdown complete')
    process.exit(0)
  } catch (error) {
    console.error('[shutdown] Error during shutdown:', error)
    clearTimeout(shutdownTimeout)
    process.exit(1)
  }
}

/**
 * Register shutdown handlers
 * Call this during application startup
 */
export function registerShutdownHandlers(): void {
  // Handle SIGTERM (docker stop, kubernetes, etc.)
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))

  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    console.error('[shutdown] Uncaught exception:', error)
    await gracefulShutdown('uncaughtException')
  })

  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason, promise) => {
    console.error('[shutdown] Unhandled rejection at:', promise, 'reason:', reason)
    // Don't exit on unhandled rejection, just log
  })

  console.log('[shutdown] Shutdown handlers registered')
}

/**
 * Check if shutdown is in progress
 */
export function isShutdownInProgress(): boolean {
  return isShuttingDown
}
