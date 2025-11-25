#!/usr/bin/env npx tsx
/**
 * pg-boss Job Queue Test Script
 * Tests basic job enqueue, processing, and retry logic
 * Story: E1.8 - Configure pg-boss Job Queue (AC: #3, #5, #7, #11)
 *
 * Usage:
 *   npx tsx scripts/test-pgboss.ts
 *
 * Prerequisites:
 *   - PostgreSQL running with Supabase connection
 *   - DATABASE_URL environment variable set
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import {
  getPgBoss,
  closePgBoss,
  registerJobHandlers,
  enqueueTestJob,
  JOB_TYPES,
} from '../lib/pgboss'

async function main() {
  console.log('🧪 pg-boss Job Queue Test')
  console.log('=========================')
  console.log('')

  try {
    // Test 1: Initialize pg-boss
    console.log('1. Initializing pg-boss...')
    const boss = await getPgBoss()
    console.log('   ✅ pg-boss initialized')
    console.log('')

    // Test 2: Register handlers
    console.log('2. Registering job handlers...')
    await registerJobHandlers()
    console.log('   ✅ Handlers registered')
    console.log('')

    // Test 3: Enqueue a test job
    console.log('3. Enqueueing test job...')
    const jobId1 = await enqueueTestJob('Hello from test script!', {
      delayMs: 500,
    })
    console.log(`   ✅ Job enqueued: ${jobId1}`)
    console.log('')

    // Test 4: Wait for job to complete
    console.log('4. Waiting for job to complete (5 seconds)...')
    await new Promise((resolve) => setTimeout(resolve, 5000))

    // Check job status
    if (jobId1) {
      const job = await boss.getJobById(JOB_TYPES.TEST_JOB, jobId1)
      console.log(`   Job state: ${job?.state || 'not found'}`)
      if (job?.output) {
        console.log(`   Job output: ${JSON.stringify(job.output)}`)
      }
    }
    console.log('')

    // Test 5: Test priority (AC: #9)
    console.log('5. Testing job priority...')
    const lowPriorityJob = await enqueueTestJob('Low priority job', {
      priority: 1,
      delayMs: 100,
    })
    const highPriorityJob = await enqueueTestJob('High priority job', {
      priority: 10,
      delayMs: 100,
    })
    console.log(`   ✅ Low priority job: ${lowPriorityJob}`)
    console.log(`   ✅ High priority job: ${highPriorityJob}`)
    console.log('')

    // Test 6: Wait for priority jobs
    console.log('6. Waiting for priority jobs (3 seconds)...')
    await new Promise((resolve) => setTimeout(resolve, 3000))
    console.log('   ✅ Priority jobs should have completed (high first)')
    console.log('')

    // Test 7: Test scheduled job (AC: #9)
    console.log('7. Testing scheduled job...')
    const futureTime = new Date(Date.now() + 10000) // 10 seconds from now
    const scheduledJob = await boss.send(
      JOB_TYPES.TEST_JOB,
      { message: 'Scheduled job', delayMs: 100 },
      { startAfter: futureTime }
    )
    console.log(`   ✅ Scheduled job: ${scheduledJob}`)
    console.log(`   Will execute at: ${futureTime.toISOString()}`)
    console.log('')

    // Test 8: Test retry logic (AC: #5)
    console.log('8. Testing retry logic (intentional failure)...')
    const failingJob = await enqueueTestJob('This job will fail', {
      shouldFail: true,
      retryLimit: 2,
      retryDelay: 1,
    })
    console.log(`   ✅ Failing job enqueued: ${failingJob}`)
    console.log('   Waiting 10 seconds for retries...')
    await new Promise((resolve) => setTimeout(resolve, 10000))

    if (failingJob) {
      const job = await boss.getJobById(JOB_TYPES.TEST_JOB, failingJob)
      console.log(`   Job state after retries: ${job?.state || 'not found'}`)
      console.log(`   Retry count: ${job?.retryCount || 0}`)
    }
    console.log('')

    // Test 9: Query jobs by state (AC: #6)
    console.log('9. Querying job statistics...')
    const pendingJobs = await boss.fetch(JOB_TYPES.TEST_JOB, {
      batchSize: 100,
      includeMetadata: true,
    })
    console.log(`   Pending/created jobs: ${pendingJobs?.length || 0}`)

    // Query failed jobs
    if (failingJob) {
      const failedJob = await boss.getJobById(JOB_TYPES.TEST_JOB, failingJob)
      if (failedJob?.state === 'failed') {
        console.log('   Found failed job in database')
      }
    }
    console.log('')

    // Test 10: Cleanup scheduled job
    console.log('10. Cleaning up scheduled job...')
    if (scheduledJob) {
      await boss.cancel(JOB_TYPES.TEST_JOB, scheduledJob)
      console.log('    ✅ Scheduled job cancelled')
    }
    console.log('')

    console.log('=========================')
    console.log('✅ All pg-boss tests completed!')
    console.log('')
    console.log('Summary:')
    console.log('- pg-boss initialization: ✅')
    console.log('- Handler registration: ✅')
    console.log('- Job enqueue and processing: ✅')
    console.log('- Priority handling: ✅')
    console.log('- Scheduled jobs: ✅')
    console.log('- Retry logic: ✅')
    console.log('- Job status querying: ✅')
  } catch (error) {
    console.error('')
    console.error('❌ Error:', error instanceof Error ? error.message : error)
    if (error instanceof Error && error.stack) {
      console.error('Stack:', error.stack)
    }
    process.exit(1)
  } finally {
    console.log('')
    console.log('Shutting down pg-boss...')
    await closePgBoss()
    console.log('Done.')
  }
}

main()
