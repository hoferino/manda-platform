/**
 * pg-boss Job Queue Module
 * PostgreSQL-based background job processing
 * Story: E1.8 - Configure pg-boss Job Queue
 *
 * Usage:
 *   import { getPgBoss, enqueueTestJob, registerJobHandlers } from '@/lib/pgboss'
 *
 *   // Initialize and register handlers on app startup
 *   await registerJobHandlers()
 *
 *   // Enqueue a job
 *   const jobId = await enqueueTestJob('Hello, pg-boss!')
 *
 *   // Graceful shutdown
 *   await closePgBoss()
 */

// Client exports
export {
  getPgBoss,
  getPgBossSync,
  isPgBossRunning,
  closePgBoss,
  forceClosePgBoss,
  verifyPgBossConnection,
} from './client'

// Job type exports
export {
  JOB_TYPES,
  DEFAULT_JOB_OPTIONS,
  DEFAULT_WORKER_CONFIG,
  type JobType,
  type TestJobPayload,
  type DocumentParseJobPayload,
  type GenerateEmbeddingsJobPayload,
  type AnalyzeDocumentJobPayload,
  type UpdateGraphJobPayload,
  type DetectContradictionsJobPayload,
  type DetectPatternsJobPayload,
  type JobResult,
  type TestJobResult,
  type DocumentParseResult,
  type GenerateEmbeddingsResult,
  type AnalyzeDocumentResult,
  type EnqueueOptions,
  type WorkerConfig,
} from './jobs'

// Handler registration exports
export {
  registerJobHandlers,
  isHandlerRegistered,
  getRegisteredHandlers,
  clearRegisteredHandlers,
} from './register-handlers'

// Enqueue function exports
export {
  enqueueTestJob,
  enqueueDocumentParse,
  enqueueGenerateEmbeddings,
  enqueueAnalyzeDocument,
  enqueueUpdateGraph,
  enqueueDetectContradictions,
  enqueueDetectPatterns,
  enqueueHighPriority,
  enqueueScheduled,
} from './enqueue'

// Handler exports (for testing or custom registration)
export {
  testJobHandler,
  documentParseHandler,
  generateEmbeddingsHandler,
  analyzeDocumentHandler,
  updateGraphHandler,
} from './handlers'

// Shutdown exports
export {
  registerShutdownHandlers,
  isShutdownInProgress,
} from './shutdown'
