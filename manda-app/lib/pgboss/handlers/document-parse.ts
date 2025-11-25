/**
 * Document Parse Job Handler (Placeholder)
 * Will be implemented in Epic 3 with Docling integration
 * Story: E1.8 - Configure pg-boss Job Queue (AC: #4)
 */

import type { Job } from 'pg-boss'
import type { DocumentParseJobPayload, DocumentParseResult } from '../jobs'

/**
 * Document parse job handler
 * Placeholder implementation - will be replaced in Epic 3
 */
export async function documentParseHandler(
  jobs: Job<DocumentParseJobPayload>[]
): Promise<DocumentParseResult[]> {
  const results: DocumentParseResult[] = []

  for (const job of jobs) {
    const { document_id, deal_id, file_path, file_type } = job.data

    console.log(
      `[document-parse] Processing document ${document_id} (${file_type})`
    )
    console.log(`[document-parse] File: ${file_path}`)
    console.log(`[document-parse] Deal: ${deal_id}`)

    // TODO: Implement in Epic 3
    // 1. Download file from Supabase Storage
    // 2. Parse with Docling
    // 3. Extract text chunks
    // 4. Store chunks in database
    // 5. Trigger embedding generation job

    console.log(
      `[document-parse] Job ${job.id} completed (placeholder implementation)`
    )

    results.push({
      document_id,
      pages_parsed: 0,
      chunks_created: 0,
      metadata_extracted: {
        placeholder: true,
        message: 'Document parsing will be implemented in Epic 3',
      },
    })
  }

  return results
}
