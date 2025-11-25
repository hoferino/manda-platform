/**
 * Job Enqueue Functions
 * Type-safe functions for enqueueing jobs
 * Story: E1.8 - Configure pg-boss Job Queue (AC: #3, #9)
 */

import { getPgBoss } from './client'
import {
  JOB_TYPES,
  DEFAULT_JOB_OPTIONS,
  type TestJobPayload,
  type DocumentParseJobPayload,
  type GenerateEmbeddingsJobPayload,
  type AnalyzeDocumentJobPayload,
  type UpdateGraphJobPayload,
  type DetectContradictionsJobPayload,
  type DetectPatternsJobPayload,
  type EnqueueOptions,
} from './jobs'

/**
 * Merge custom options with defaults
 */
function mergeOptions(
  jobType: keyof typeof JOB_TYPES,
  customOptions?: EnqueueOptions
): EnqueueOptions {
  const defaults = DEFAULT_JOB_OPTIONS[JOB_TYPES[jobType]]
  return { ...defaults, ...customOptions }
}

/**
 * Convert EnqueueOptions to pg-boss SendOptions
 */
function toSendOptions(options: EnqueueOptions): Record<string, unknown> {
  const sendOptions: Record<string, unknown> = {}

  if (options.priority !== undefined) sendOptions.priority = options.priority
  if (options.retryLimit !== undefined)
    sendOptions.retryLimit = options.retryLimit
  if (options.retryDelay !== undefined)
    sendOptions.retryDelay = options.retryDelay
  if (options.retryBackoff !== undefined)
    sendOptions.retryBackoff = options.retryBackoff
  if (options.startAfter !== undefined)
    sendOptions.startAfter = options.startAfter
  if (options.expireInSeconds !== undefined)
    sendOptions.expireInSeconds = options.expireInSeconds
  if (options.singletonKey !== undefined)
    sendOptions.singletonKey = options.singletonKey

  return sendOptions
}

// ===================
// Test Job
// ===================

/**
 * Enqueue a test job
 * @param message - Test message to process
 * @param options - Optional job options
 * @returns Job ID
 */
export async function enqueueTestJob(
  message: string,
  options?: EnqueueOptions & { shouldFail?: boolean; delayMs?: number }
): Promise<string | null> {
  const boss = await getPgBoss()
  const mergedOptions = mergeOptions('TEST_JOB', options)

  const payload: TestJobPayload = {
    message,
    shouldFail: options?.shouldFail,
    delayMs: options?.delayMs,
  }

  const jobId = await boss.send(
    JOB_TYPES.TEST_JOB,
    payload,
    toSendOptions(mergedOptions)
  )

  console.log(`[enqueue] Test job enqueued: ${jobId}`)
  return jobId
}

// ===================
// Document Processing Jobs
// ===================

/**
 * Enqueue a document parse job
 * @param data - Document parse payload
 * @param options - Optional job options
 * @returns Job ID
 */
export async function enqueueDocumentParse(
  data: DocumentParseJobPayload,
  options?: EnqueueOptions
): Promise<string | null> {
  const boss = await getPgBoss()
  const mergedOptions = mergeOptions('DOCUMENT_PARSE', options)

  // Use document_id as singleton key to prevent duplicate parsing
  const sendOptions = {
    ...toSendOptions(mergedOptions),
    singletonKey: data.document_id,
  }

  const jobId = await boss.send(JOB_TYPES.DOCUMENT_PARSE, data, sendOptions)

  console.log(
    `[enqueue] Document parse job enqueued: ${jobId} (doc: ${data.document_id})`
  )
  return jobId
}

/**
 * Enqueue a generate embeddings job
 * @param data - Embeddings payload
 * @param options - Optional job options
 * @returns Job ID
 */
export async function enqueueGenerateEmbeddings(
  data: GenerateEmbeddingsJobPayload,
  options?: EnqueueOptions
): Promise<string | null> {
  const boss = await getPgBoss()
  const mergedOptions = mergeOptions('GENERATE_EMBEDDINGS', options)

  const jobId = await boss.send(
    JOB_TYPES.GENERATE_EMBEDDINGS,
    data,
    toSendOptions(mergedOptions)
  )

  console.log(
    `[enqueue] Generate embeddings job enqueued: ${jobId} (doc: ${data.document_id})`
  )
  return jobId
}

/**
 * Enqueue an analyze document job
 * @param data - Analysis payload
 * @param options - Optional job options
 * @returns Job ID
 */
export async function enqueueAnalyzeDocument(
  data: AnalyzeDocumentJobPayload,
  options?: EnqueueOptions
): Promise<string | null> {
  const boss = await getPgBoss()
  const mergedOptions = mergeOptions('ANALYZE_DOCUMENT', options)

  const jobId = await boss.send(
    JOB_TYPES.ANALYZE_DOCUMENT,
    data,
    toSendOptions(mergedOptions)
  )

  console.log(
    `[enqueue] Analyze document job enqueued: ${jobId} (doc: ${data.document_id})`
  )
  return jobId
}

// ===================
// Knowledge Graph Jobs
// ===================

/**
 * Enqueue an update graph job
 * @param data - Graph update payload
 * @param options - Optional job options
 * @returns Job ID
 */
export async function enqueueUpdateGraph(
  data: UpdateGraphJobPayload,
  options?: EnqueueOptions
): Promise<string | null> {
  const boss = await getPgBoss()
  const mergedOptions = mergeOptions('UPDATE_GRAPH', options)

  const jobId = await boss.send(
    JOB_TYPES.UPDATE_GRAPH,
    data,
    toSendOptions(mergedOptions)
  )

  console.log(
    `[enqueue] Update graph job enqueued: ${jobId} (deal: ${data.deal_id})`
  )
  return jobId
}

/**
 * Enqueue a detect contradictions job
 * @param data - Contradiction detection payload
 * @param options - Optional job options
 * @returns Job ID
 */
export async function enqueueDetectContradictions(
  data: DetectContradictionsJobPayload,
  options?: EnqueueOptions
): Promise<string | null> {
  const boss = await getPgBoss()
  const mergedOptions = mergeOptions('DETECT_CONTRADICTIONS', options)

  const jobId = await boss.send(
    JOB_TYPES.DETECT_CONTRADICTIONS,
    data,
    toSendOptions(mergedOptions)
  )

  console.log(
    `[enqueue] Detect contradictions job enqueued: ${jobId} (deal: ${data.deal_id})`
  )
  return jobId
}

/**
 * Enqueue a detect patterns job
 * @param data - Pattern detection payload
 * @param options - Optional job options
 * @returns Job ID
 */
export async function enqueueDetectPatterns(
  data: DetectPatternsJobPayload,
  options?: EnqueueOptions
): Promise<string | null> {
  const boss = await getPgBoss()
  const mergedOptions = mergeOptions('DETECT_PATTERNS', options)

  const jobId = await boss.send(
    JOB_TYPES.DETECT_PATTERNS,
    data,
    toSendOptions(mergedOptions)
  )

  console.log(
    `[enqueue] Detect patterns job enqueued: ${jobId} (deal: ${data.deal_id})`
  )
  return jobId
}

// ===================
// Priority and Scheduling Helpers
// ===================

/**
 * Enqueue a high-priority job
 * @param jobType - Type of job to enqueue
 * @param data - Job payload
 * @returns Job ID
 */
export async function enqueueHighPriority(
  jobType: string,
  data: unknown
): Promise<string | null> {
  const boss = await getPgBoss()
  const jobId = await boss.send(jobType, data as object, { priority: 10 })
  console.log(`[enqueue] High-priority job enqueued: ${jobId} (type: ${jobType})`)
  return jobId
}

/**
 * Enqueue a scheduled job
 * @param jobType - Type of job to enqueue
 * @param data - Job payload
 * @param startAfter - When to start the job
 * @returns Job ID
 */
export async function enqueueScheduled(
  jobType: string,
  data: unknown,
  startAfter: Date | string
): Promise<string | null> {
  const boss = await getPgBoss()
  const jobId = await boss.send(jobType, data as object, { startAfter })
  console.log(
    `[enqueue] Scheduled job enqueued: ${jobId} (type: ${jobType}, startAfter: ${startAfter})`
  )
  return jobId
}
