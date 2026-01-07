/**
 * LangGraph Checkpointer Configuration
 *
 * Story: E13.9 - PostgreSQL Checkpointer for LangGraph
 *
 * Provides durable workflow state persistence using PostgresSaver.
 * Falls back to MemorySaver if PostgreSQL connection fails.
 *
 * Features:
 * - Lazy initialization (don't connect at import time)
 * - Graceful fallback to MemorySaver
 * - Shared singleton instance for all workflows
 * - Structured logging with [Checkpointer] prefix
 *
 * Thread ID Formats:
 * - CIM: cim-{dealId}-{cimId}
 * - Supervisor: supervisor-{dealId}-{timestamp}
 *
 * References:
 * - [Source: docs/sprint-artifacts/stories/e13-9-postgresql-checkpointer.md]
 * - [Source: docs/sprint-artifacts/stories/e13-8-redis-caching-layer.md - Fallback pattern]
 */

import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres'
import { MemorySaver } from '@langchain/langgraph'

// =============================================================================
// Types
// =============================================================================

/**
 * Type for the checkpointer - either PostgresSaver or MemorySaver
 */
export type Checkpointer = PostgresSaver | MemorySaver

// =============================================================================
// Singleton Instance
// =============================================================================

let checkpointerInstance: Checkpointer | null = null
let isInitialized = false
let initializationPromise: Promise<Checkpointer> | null = null

// =============================================================================
// Main API
// =============================================================================

/**
 * Get or create the shared checkpointer
 *
 * Uses PostgresSaver for production, falls back to MemorySaver if unavailable.
 * Implements lazy initialization pattern from E13.8 Redis caching.
 *
 * Story: E13.9 - PostgreSQL Checkpointer (AC: #1, #3)
 *
 * @returns Promise<Checkpointer> - PostgresSaver or MemorySaver instance
 *
 * @example
 * ```typescript
 * const checkpointer = await getCheckpointer()
 * const app = workflow.compile({ checkpointer })
 * ```
 */
export async function getCheckpointer(): Promise<Checkpointer> {
  // Return cached instance if already initialized
  if (checkpointerInstance && isInitialized) {
    return checkpointerInstance
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    return initializationPromise
  }

  // Start initialization
  initializationPromise = initializeCheckpointer()

  try {
    checkpointerInstance = await initializationPromise
    isInitialized = true
    return checkpointerInstance
  } finally {
    initializationPromise = null
  }
}

/**
 * Internal initialization function
 */
async function initializeCheckpointer(): Promise<Checkpointer> {
  const connectionString = process.env.DATABASE_URL

  // Fallback: No connection string
  if (!connectionString) {
    console.warn('[Checkpointer] DATABASE_URL not set, using in-memory fallback')
    const memorySaver = new MemorySaver()
    logCheckpointOperation('init', undefined, { reason: 'no_database_url' })
    return memorySaver
  }

  // ISSUE 5 fix: Warn if not using Transaction mode (port 6543)
  // Session mode (5432) can cause connection exhaustion in serverless
  try {
    const url = new URL(connectionString)
    if (url.port && url.port !== '6543') {
      console.warn(
        `[Checkpointer] DATABASE_URL uses port ${url.port}. ` +
        'Consider using Transaction mode (port 6543) for serverless environments.'
      )
    }
  } catch {
    // Invalid URL format - PostgresSaver will handle the error
  }

  try {
    // Use Transaction mode connection (port 6543) for pooling
    // PostgresSaver uses direct pg connection, bypassing Supabase RLS
    // (RLS policies in migration are for Supabase client access only)
    const checkpointer = PostgresSaver.fromConnString(connectionString)

    // Initialize tables on first use
    // This creates langgraph_checkpoints and langgraph_checkpoint_writes tables
    await checkpointer.setup()

    console.log('[Checkpointer] PostgresSaver initialized successfully')
    logCheckpointOperation('init', undefined, { backend: 'postgres', durable: true })
    return checkpointer
  } catch (error) {
    // Log error details for debugging
    console.error('[Checkpointer] PostgresSaver initialization failed:', error)
    console.warn('[Checkpointer] Falling back to in-memory MemorySaver')

    // Fallback: Use MemorySaver if PostgreSQL fails
    const memorySaver = new MemorySaver()
    logCheckpointOperation('init', undefined, {
      reason: 'postgres_connection_failed',
      error: error instanceof Error ? error.message : 'unknown',
    })
    return memorySaver
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Reset checkpointer instance (for testing)
 *
 * Clears the singleton instance to allow fresh initialization.
 * Useful in tests to reset state between test cases.
 *
 * @example
 * ```typescript
 * beforeEach(() => {
 *   resetCheckpointer()
 * })
 * ```
 */
export function resetCheckpointer(): void {
  checkpointerInstance = null
  isInitialized = false
  initializationPromise = null
}

/**
 * Check if checkpointer is using PostgreSQL (not fallback)
 *
 * Useful for observability and metrics to know if durable
 * persistence is active.
 *
 * @returns boolean - true if using PostgresSaver
 */
export function isUsingPostgres(): boolean {
  return checkpointerInstance instanceof PostgresSaver
}

/**
 * Check if checkpointer has been initialized
 *
 * @returns boolean - true if checkpointer is ready
 */
export function isCheckpointerInitialized(): boolean {
  return isInitialized && checkpointerInstance !== null
}

/**
 * Get checkpoint metadata for LangSmith traces
 *
 * Story: E13.9 (AC: #9) - Add checkpoint metrics to LangSmith traces
 *
 * Returns metadata about the checkpointer state that can be included
 * in LangSmith trace config.metadata for observability.
 *
 * @returns Record<string, unknown> - Metadata for traces
 *
 * @example
 * ```typescript
 * const config = {
 *   metadata: {
 *     ...getCheckpointMetadata(),
 *     dealId,
 *     userId,
 *   }
 * }
 * await workflow.invoke(state, config)
 * ```
 */
export function getCheckpointMetadata(): Record<string, unknown> {
  return {
    checkpointer_type: isUsingPostgres() ? 'PostgresSaver' : 'MemorySaver',
    checkpointer_initialized: isCheckpointerInitialized(),
    checkpointer_durable: isUsingPostgres(),
    // Timestamp for when metadata was captured
    checkpoint_metadata_at: new Date().toISOString(),
  }
}

/**
 * Log checkpoint operation for observability
 *
 * Story: E13.9 (AC: #9) - Structured logging for checkpoint operations
 *
 * @param operation - Operation type (init, get, put, list)
 * @param threadId - Thread ID for the operation
 * @param metadata - Additional metadata
 */
export function logCheckpointOperation(
  operation: 'init' | 'get' | 'put' | 'list' | 'cleanup',
  threadId?: string,
  metadata?: Record<string, unknown>
): void {
  const logEntry = {
    event: 'checkpoint_operation',
    operation,
    checkpointer_type: isUsingPostgres() ? 'PostgresSaver' : 'MemorySaver',
    thread_id: threadId,
    timestamp: new Date().toISOString(),
    ...metadata,
  }
  console.log(JSON.stringify(logEntry))
}

// =============================================================================
// Thread ID Helpers
// =============================================================================

/**
 * Create a thread ID for CIM workflow
 *
 * Format: cim-{dealId}-{cimId}
 *
 * @param dealId - Deal ID (UUID)
 * @param cimId - CIM ID (UUID)
 * @returns Thread ID string
 *
 * @example
 * ```typescript
 * const threadId = createCIMThreadId('deal-123', 'cim-456')
 * // Returns: 'cim-deal-123-cim-456'
 * ```
 */
export function createCIMThreadId(dealId: string, cimId: string): string {
  return `cim-${dealId}-${cimId}`
}

/**
 * Create a thread ID for Supervisor graph
 *
 * Format: supervisor-{dealId}-{timestamp}
 *
 * @param dealId - Deal ID (UUID)
 * @param timestamp - Optional timestamp (defaults to Date.now())
 * @returns Thread ID string
 *
 * @example
 * ```typescript
 * const threadId = createSupervisorThreadId('deal-123')
 * // Returns: 'supervisor-deal-123-1704067200000'
 * ```
 */
export function createSupervisorThreadId(dealId: string, timestamp?: number): string {
  const ts = timestamp ?? Date.now()
  return `supervisor-${dealId}-${ts}`
}

/**
 * Parse deal ID from thread ID
 *
 * Extracts the deal UUID from CIM or Supervisor thread IDs.
 * Used by RLS policies for tenant isolation.
 *
 * Thread formats:
 * - CIM: cim-{dealId}-{cimId} where dealId is a UUID (36 chars)
 * - Supervisor: supervisor-{dealId}-{timestamp} where dealId is a UUID
 *
 * @param threadId - Thread ID string
 * @returns Deal ID or null if not parseable
 *
 * @example
 * ```typescript
 * parseDealIdFromThreadId('cim-550e8400-e29b-41d4-a716-446655440000-6ba7b810-9dad-11d1-80b4-00c04fd430c8')
 * // Returns: '550e8400-e29b-41d4-a716-446655440000'
 * parseDealIdFromThreadId('supervisor-550e8400-e29b-41d4-a716-446655440000-1704067200000')
 * // Returns: '550e8400-e29b-41d4-a716-446655440000'
 * parseDealIdFromThreadId('invalid') // Returns: null
 * ```
 */
export function parseDealIdFromThreadId(threadId: string): string | null {
  // Extract UUID deal ID from thread ID
  // UUID format: 8-4-4-4-12 hex characters (36 chars total including hyphens)
  const uuidPattern = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

  // CIM format: cim-{uuid}-{uuid or other id}
  const cimMatch = threadId.match(new RegExp(`^cim-(${uuidPattern})-`, 'i'))
  if (cimMatch) {
    return cimMatch[1] ?? null
  }

  // Supervisor format: supervisor-{uuid}-{timestamp}
  const supervisorMatch = threadId.match(new RegExp(`^supervisor-(${uuidPattern})-`, 'i'))
  if (supervisorMatch) {
    return supervisorMatch[1] ?? null
  }

  // For simple IDs (non-UUID), extract first segment after prefix
  // This handles formats like cim-deal123-cim456
  const simpleMatch = threadId.match(/^(?:cim|supervisor)-([a-zA-Z0-9]+)-/)
  if (simpleMatch) {
    return simpleMatch[1] ?? null
  }

  return null
}
