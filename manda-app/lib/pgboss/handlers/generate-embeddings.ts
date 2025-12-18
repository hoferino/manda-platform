/**
 * Generate Embeddings Job Handler
 *
 * @deprecated E10.8 - PostgreSQL Cleanup
 * This handler is deprecated. The pipeline now skips generate-embeddings
 * and goes directly from parse_document to ingest-graphiti.
 * Graphiti handles all embeddings internally via Voyage AI (1024d).
 *
 * Old pipeline: parse_document -> generate_embeddings -> ingest_graphiti -> analyze_document
 * New pipeline: parse_document -> ingest_graphiti -> analyze_document
 *
 * This file is kept for backwards compatibility with any in-flight jobs.
 *
 * Story: E1.8 - Configure pg-boss Job Queue (AC: #4) - OBSOLETE
 * Story: E10.8 - PostgreSQL Cleanup (DEPRECATED this handler)
 */

import type { Job } from 'pg-boss'
import type {
  GenerateEmbeddingsJobPayload,
  GenerateEmbeddingsResult,
} from '../jobs'

/**
 * Generate embeddings job handler
 *
 * @deprecated E10.8 - Use Graphiti ingestion instead (ingest-graphiti job)
 * This is now a no-op that just logs deprecation and returns success.
 */
export async function generateEmbeddingsHandler(
  jobs: Job<GenerateEmbeddingsJobPayload>[]
): Promise<GenerateEmbeddingsResult[]> {
  const results: GenerateEmbeddingsResult[] = []

  for (const job of jobs) {
    const { document_id, deal_id } = job.data

    // E10.8: This handler is deprecated - log warning and return success
    console.warn(
      `[generate-embeddings] DEPRECATED: Job ${job.id} skipped. ` +
      `Pipeline now uses ingest-graphiti for embeddings. ` +
      `Document: ${document_id}, Deal: ${deal_id}`
    )

    results.push({
      document_id,
      embeddings_created: 0,
      model_used: 'deprecated-e10.8',
    })
  }

  return results
}
