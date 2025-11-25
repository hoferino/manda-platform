/**
 * Job Handler Registration
 * Registers all job handlers with pg-boss workers
 * Story: E1.8 - Configure pg-boss Job Queue (AC: #4, #5)
 */

import { getPgBoss } from './client'
import { JOB_TYPES, DEFAULT_WORKER_CONFIG } from './jobs'
import {
  testJobHandler,
  documentParseHandler,
  generateEmbeddingsHandler,
  analyzeDocumentHandler,
  updateGraphHandler,
} from './handlers'

// Track registered handlers to prevent double registration
const registeredHandlers = new Set<string>()

/**
 * Register all job handlers with pg-boss
 * Should be called once during application startup
 */
export async function registerJobHandlers(): Promise<void> {
  const boss = await getPgBoss()

  // Register test job handler
  if (!registeredHandlers.has(JOB_TYPES.TEST_JOB)) {
    const config = DEFAULT_WORKER_CONFIG[JOB_TYPES.TEST_JOB]
    await boss.work(
      JOB_TYPES.TEST_JOB,
      {
        batchSize: config.batchSize,
        pollingIntervalSeconds: config.pollingIntervalSeconds,
      },
      testJobHandler
    )
    registeredHandlers.add(JOB_TYPES.TEST_JOB)
    console.log(`[pg-boss] Registered handler: ${JOB_TYPES.TEST_JOB}`)
  }

  // Register document parse handler (placeholder)
  if (!registeredHandlers.has(JOB_TYPES.DOCUMENT_PARSE)) {
    const config = DEFAULT_WORKER_CONFIG[JOB_TYPES.DOCUMENT_PARSE]
    await boss.work(
      JOB_TYPES.DOCUMENT_PARSE,
      {
        batchSize: config.batchSize,
        pollingIntervalSeconds: config.pollingIntervalSeconds,
      },
      documentParseHandler
    )
    registeredHandlers.add(JOB_TYPES.DOCUMENT_PARSE)
    console.log(`[pg-boss] Registered handler: ${JOB_TYPES.DOCUMENT_PARSE}`)
  }

  // Register generate embeddings handler (placeholder)
  if (!registeredHandlers.has(JOB_TYPES.GENERATE_EMBEDDINGS)) {
    const config = DEFAULT_WORKER_CONFIG[JOB_TYPES.GENERATE_EMBEDDINGS]
    await boss.work(
      JOB_TYPES.GENERATE_EMBEDDINGS,
      {
        batchSize: config.batchSize,
        pollingIntervalSeconds: config.pollingIntervalSeconds,
      },
      generateEmbeddingsHandler
    )
    registeredHandlers.add(JOB_TYPES.GENERATE_EMBEDDINGS)
    console.log(`[pg-boss] Registered handler: ${JOB_TYPES.GENERATE_EMBEDDINGS}`)
  }

  // Register analyze document handler (placeholder)
  if (!registeredHandlers.has(JOB_TYPES.ANALYZE_DOCUMENT)) {
    const config = DEFAULT_WORKER_CONFIG[JOB_TYPES.ANALYZE_DOCUMENT]
    await boss.work(
      JOB_TYPES.ANALYZE_DOCUMENT,
      {
        batchSize: config.batchSize,
        pollingIntervalSeconds: config.pollingIntervalSeconds,
      },
      analyzeDocumentHandler
    )
    registeredHandlers.add(JOB_TYPES.ANALYZE_DOCUMENT)
    console.log(`[pg-boss] Registered handler: ${JOB_TYPES.ANALYZE_DOCUMENT}`)
  }

  // Register update graph handler (placeholder)
  if (!registeredHandlers.has(JOB_TYPES.UPDATE_GRAPH)) {
    const config = DEFAULT_WORKER_CONFIG[JOB_TYPES.UPDATE_GRAPH]
    await boss.work(
      JOB_TYPES.UPDATE_GRAPH,
      {
        batchSize: config.batchSize,
        pollingIntervalSeconds: config.pollingIntervalSeconds,
      },
      updateGraphHandler
    )
    registeredHandlers.add(JOB_TYPES.UPDATE_GRAPH)
    console.log(`[pg-boss] Registered handler: ${JOB_TYPES.UPDATE_GRAPH}`)
  }

  console.log(
    `[pg-boss] All handlers registered (${registeredHandlers.size} handlers)`
  )
}

/**
 * Check if a handler is registered
 */
export function isHandlerRegistered(jobType: string): boolean {
  return registeredHandlers.has(jobType)
}

/**
 * Get list of registered handlers
 */
export function getRegisteredHandlers(): string[] {
  return Array.from(registeredHandlers)
}

/**
 * Clear registered handlers (for testing)
 */
export function clearRegisteredHandlers(): void {
  registeredHandlers.clear()
}
