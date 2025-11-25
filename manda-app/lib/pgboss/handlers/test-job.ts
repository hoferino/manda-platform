/**
 * Test Job Handler
 * For testing and development purposes
 * Story: E1.8 - Configure pg-boss Job Queue (AC: #3, #4, #5)
 */

import type { Job } from 'pg-boss'
import type { TestJobPayload, TestJobResult } from '../jobs'

/**
 * Test job handler
 * pg-boss v12 passes jobs as an array - this processes all jobs in the batch
 */
export async function testJobHandler(
  jobs: Job<TestJobPayload>[]
): Promise<TestJobResult[]> {
  const results: TestJobResult[] = []

  for (const job of jobs) {
    const { message, shouldFail, delayMs } = job.data
    const startTime = Date.now()

    console.log(`[test-job] Processing job ${job.id}: ${message}`)

    // Simulate processing time if specified
    if (delayMs && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }

    // Simulate failure for retry testing
    if (shouldFail) {
      const error = new Error(`Test job intentionally failed: ${message}`)
      console.error(`[test-job] Job ${job.id} failed:`, error.message)
      throw error
    }

    const duration = Date.now() - startTime
    console.log(`[test-job] Job ${job.id} completed in ${duration}ms`)

    results.push({
      status: 'success',
      message: `Processed: ${message}`,
      timestamp: new Date().toISOString(),
    })
  }

  return results
}
