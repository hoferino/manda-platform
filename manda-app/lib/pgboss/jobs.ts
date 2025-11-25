/**
 * pg-boss Job Type Definitions
 * Defines all job types and their payload schemas
 * Story: E1.8 - Configure pg-boss Job Queue (AC: #3, #4)
 */

// ===================
// Job Type Constants
// ===================

/**
 * All available job types in the system
 * Add new job types here as they're implemented
 */
export const JOB_TYPES = {
  // Testing
  TEST_JOB: 'test-job',

  // Document Processing (Epic 3)
  DOCUMENT_PARSE: 'document-parse',
  GENERATE_EMBEDDINGS: 'generate-embeddings',
  ANALYZE_DOCUMENT: 'analyze-document',

  // Knowledge Graph (Epic 3/4)
  UPDATE_GRAPH: 'update-graph',

  // Pattern Detection (Epic 4)
  DETECT_CONTRADICTIONS: 'detect-contradictions',
  DETECT_PATTERNS: 'detect-patterns',
} as const

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES]

// ===================
// Job Payload Types
// ===================

/**
 * Test job payload - for testing and development
 */
export interface TestJobPayload {
  message: string
  shouldFail?: boolean // For testing retry logic
  delayMs?: number // Simulate processing time
}

/**
 * Document parse job payload - for parsing uploaded documents
 * Will be used in Epic 3 with Docling
 */
export interface DocumentParseJobPayload {
  document_id: string
  deal_id: string
  user_id: string
  file_path: string
  file_type: 'pdf' | 'docx' | 'xlsx' | 'txt'
  priority?: number
}

/**
 * Generate embeddings job payload - for creating vector embeddings
 * Will be used in Epic 3 with OpenAI
 */
export interface GenerateEmbeddingsJobPayload {
  document_id: string
  deal_id: string
  chunks: Array<{
    id: string
    text: string
    metadata: Record<string, unknown>
  }>
}

/**
 * Analyze document job payload - for LLM analysis
 * Will be used in Epic 3 with Gemini 3.0 Pro
 */
export interface AnalyzeDocumentJobPayload {
  document_id: string
  deal_id: string
  user_id: string
  analysis_type: 'extract_findings' | 'categorize' | 'summarize'
  content?: string // Document content if already parsed
}

/**
 * Update graph job payload - for Neo4j knowledge graph updates
 * Will be used in Epic 3/4
 */
export interface UpdateGraphJobPayload {
  deal_id: string
  action: 'add_finding' | 'add_document' | 'create_relationship' | 'bulk_import'
  data: Record<string, unknown>
}

/**
 * Detect contradictions job payload - for finding data contradictions
 * Will be used in Epic 4
 */
export interface DetectContradictionsJobPayload {
  deal_id: string
  finding_ids?: string[] // Specific findings to check, or all if not provided
  date_referenced?: string // Focus on specific time period
}

/**
 * Detect patterns job payload - for cross-domain pattern detection
 * Will be used in Epic 4
 */
export interface DetectPatternsJobPayload {
  deal_id: string
  categories?: string[] // Categories to analyze
  min_confidence?: number // Minimum confidence threshold
}

// ===================
// Job Result Types
// ===================

/**
 * Generic job result structure
 */
export interface JobResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  metadata?: {
    duration_ms: number
    processed_at: string
  }
}

/**
 * Test job result
 */
export interface TestJobResult {
  status: 'success' | 'failed'
  message: string
  timestamp: string
}

/**
 * Document parse result
 */
export interface DocumentParseResult {
  document_id: string
  pages_parsed: number
  chunks_created: number
  metadata_extracted: Record<string, unknown>
}

/**
 * Generate embeddings result
 */
export interface GenerateEmbeddingsResult {
  document_id: string
  embeddings_created: number
  model_used: string
}

/**
 * Analyze document result
 */
export interface AnalyzeDocumentResult {
  document_id: string
  findings_extracted: number
  categories_identified: string[]
}

// ===================
// Job Options Types
// ===================

/**
 * Options for enqueueing jobs
 */
export interface EnqueueOptions {
  priority?: number // 0-100, higher = more priority
  retryLimit?: number // Number of retry attempts
  retryDelay?: number // Initial delay in seconds
  retryBackoff?: boolean // Use exponential backoff
  startAfter?: Date | string // Scheduled start time
  expireInSeconds?: number // Job expiration
  singletonKey?: string // Prevent duplicate jobs
}

/**
 * Default job options by job type
 */
export const DEFAULT_JOB_OPTIONS: Record<JobType, EnqueueOptions> = {
  [JOB_TYPES.TEST_JOB]: {
    priority: 1,
    retryLimit: 3,
    retryDelay: 1,
    retryBackoff: true,
  },
  [JOB_TYPES.DOCUMENT_PARSE]: {
    priority: 5,
    retryLimit: 3,
    retryDelay: 5,
    retryBackoff: true,
    expireInSeconds: 3600, // 1 hour
  },
  [JOB_TYPES.GENERATE_EMBEDDINGS]: {
    priority: 4,
    retryLimit: 3,
    retryDelay: 2,
    retryBackoff: true,
    expireInSeconds: 1800, // 30 minutes
  },
  [JOB_TYPES.ANALYZE_DOCUMENT]: {
    priority: 3,
    retryLimit: 3,
    retryDelay: 5,
    retryBackoff: true,
    expireInSeconds: 3600, // 1 hour
  },
  [JOB_TYPES.UPDATE_GRAPH]: {
    priority: 6,
    retryLimit: 5,
    retryDelay: 1,
    retryBackoff: true,
    expireInSeconds: 300, // 5 minutes
  },
  [JOB_TYPES.DETECT_CONTRADICTIONS]: {
    priority: 2,
    retryLimit: 3,
    retryDelay: 10,
    retryBackoff: true,
    expireInSeconds: 3600, // 1 hour
  },
  [JOB_TYPES.DETECT_PATTERNS]: {
    priority: 2,
    retryLimit: 3,
    retryDelay: 10,
    retryBackoff: true,
    expireInSeconds: 3600, // 1 hour
  },
}

// ===================
// Worker Configuration
// ===================

/**
 * Worker configuration for each job type
 * pg-boss v12 uses batchSize for concurrent job processing
 */
export interface WorkerConfig {
  batchSize: number // Number of jobs to fetch at once
  pollingIntervalSeconds?: number // Polling interval
}

/**
 * Default worker configuration by job type
 */
export const DEFAULT_WORKER_CONFIG: Record<JobType, WorkerConfig> = {
  [JOB_TYPES.TEST_JOB]: {
    batchSize: 5,
    pollingIntervalSeconds: 2,
  },
  [JOB_TYPES.DOCUMENT_PARSE]: {
    batchSize: 3, // Limit due to resource intensity
    pollingIntervalSeconds: 5,
  },
  [JOB_TYPES.GENERATE_EMBEDDINGS]: {
    batchSize: 5,
    pollingIntervalSeconds: 2,
  },
  [JOB_TYPES.ANALYZE_DOCUMENT]: {
    batchSize: 3, // Limit due to LLM API rate limits
    pollingIntervalSeconds: 5,
  },
  [JOB_TYPES.UPDATE_GRAPH]: {
    batchSize: 10, // Fast operations
    pollingIntervalSeconds: 1,
  },
  [JOB_TYPES.DETECT_CONTRADICTIONS]: {
    batchSize: 2,
    pollingIntervalSeconds: 10,
  },
  [JOB_TYPES.DETECT_PATTERNS]: {
    batchSize: 2,
    pollingIntervalSeconds: 10,
  },
}
