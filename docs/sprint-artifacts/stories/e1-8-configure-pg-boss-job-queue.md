# Story 1.8: Configure pg-boss Job Queue

Status: ready-for-dev

## Story

As a **developer**,
I want **pg-boss job queue configured for background processing**,
so that **the platform can handle asynchronous tasks like document parsing and LLM analysis without blocking user requests**.

## Context

This story sets up pg-boss as the background job queue for the Manda platform. pg-boss is a PostgreSQL-based job queue that uses the existing database infrastructure (no additional Redis dependency needed for MVP). It enables asynchronous processing of long-running tasks such as document parsing (Epic 3), embedding generation, and LLM analysis. The queue supports exactly-once delivery, retries with exponential backoff, and job monitoring.

**Architecture Context:** pg-boss uses PostgreSQL's SKIP LOCKED feature for efficient job distribution. It's production-proven (used by hey.com for millions of jobs/day) and simplifies infrastructure by reusing the existing Postgres database.

## Acceptance Criteria

### AC1: pg-boss Installation and Configuration
**Given** the PostgreSQL database is running (E1.3)
**When** I install pg-boss
**Then** the package is installed: `pg-boss`
**And** pg-boss tables are created in a dedicated schema (e.g., `pgboss`)
**And** The job queue is initialized with default configuration
**And** Connection uses the existing Supabase PostgreSQL database

### AC2: Job Queue Initialization
**Given** pg-boss is installed
**When** the application starts
**Then** pg-boss initializes and creates required tables
**And** Worker processes start listening for jobs
**And** The queue is ready to accept job submissions
**And** No errors are logged during initialization

### AC3: Job Enqueue and Processing
**Given** pg-boss is running
**When** I enqueue a test job:
  ```typescript
  await boss.send('test-job', { message: 'Hello, pg-boss!' })
  ```
**Then** the job is stored in the `pgboss.job` table
**And** a worker picks up the job
**And** the job handler executes successfully
**And** the job status updates to "completed"
**When** I query the job status
**Then** I can retrieve job metadata (status, created_at, completed_at)

### AC4: Job Handlers Registration
**Given** I define job handlers
**When** I register handlers for specific job types:
  ```typescript
  await boss.work('document-parse', async (job) => {
    // Parse document logic
    return { status: 'success' }
  })
  ```
**Then** workers listen for jobs of that type
**And** handlers execute when jobs are enqueued
**And** handlers can return results stored in job metadata

### AC5: Job Retry Logic
**Given** a job handler that fails
**When** I enqueue a job that throws an error
**Then** the job is retried up to 3 times (default)
**And** retries use exponential backoff (1s, 2s, 4s, etc.)
**When** all retries are exhausted
**Then** the job status is set to "failed"
**And** the error message is stored in job metadata
**And** I can query failed jobs for debugging

### AC6: Job Monitoring and Status
**Given** jobs are enqueued
**When** I query job status via API
**Then** I can retrieve:
  - Job ID
  - Job type
  - Status (active, completed, failed, retry, expired)
  - Created_at, started_at, completed_at timestamps
  - Retry count
  - Error message (if failed)
**And** I can filter jobs by status
**And** I can filter jobs by type

### AC7: Dead Letter Queue
**Given** a job fails after all retries
**When** the job is marked as "failed"
**Then** the job remains in the database for inspection
**And** I can query failed jobs: `SELECT * FROM pgboss.job WHERE state = 'failed'`
**And** I can manually retry failed jobs (optional, for debugging)

### AC8: Worker Health and Graceful Shutdown
**Given** worker processes are running
**When** I send a SIGTERM signal (shutdown)
**Then** workers complete current jobs before stopping
**And** No jobs are left in "active" state (all marked "retry" or "completed")
**And** Workers close database connections gracefully
**When** I restart the application
**Then** workers resume processing queued jobs

### AC9: Job Priority and Scheduling
**Given** pg-boss supports job priorities
**When** I enqueue jobs with different priorities:
  ```typescript
  await boss.send('high-priority-job', data, { priority: 10 })
  await boss.send('low-priority-job', data, { priority: 1 })
  ```
**Then** high-priority jobs are processed first
**When** I enqueue a scheduled job:
  ```typescript
  await boss.send('scheduled-job', data, { startAfter: '2025-12-01T10:00:00Z' })
  ```
**Then** the job is not processed until the scheduled time

### AC10: Environment Configuration
**Given** pg-boss is configured
**When** I check environment variables
**Then** I see:
  - `DATABASE_URL`: PostgreSQL connection string (reused from E1.2)
  - `PGBOSS_SCHEMA`: Schema name for pg-boss tables (default: `pgboss`)
**And** Configuration is documented in `.env.example`
**And** Worker concurrency is configurable (default: 5 concurrent jobs)

## Tasks / Subtasks

- [ ] **Task 1: Install pg-boss** (AC: #1)
  - [ ] Install pg-boss: `npm install pg-boss`
  - [ ] Install TypeScript types: `npm install -D @types/pg-boss`
  - [ ] Verify package version (latest stable: ^8.4.2+)

- [ ] **Task 2: Create pg-boss Client Utility** (AC: #1, #2)
  - [ ] Create `lib/pgboss/client.ts`:
    ```typescript
    import PgBoss from 'pg-boss'

    let boss: PgBoss | null = null

    export async function getPgBoss() {
      if (!boss) {
        boss = new PgBoss({
          connectionString: process.env.DATABASE_URL!,
          schema: process.env.PGBOSS_SCHEMA || 'pgboss',
          max: 10,  // Connection pool size
          retryLimit: 3,  // Default retry attempts
          retryDelay: 1,  // Initial retry delay (seconds)
          retryBackoff: true,  // Exponential backoff
          expireInHours: 24  // Job expiration
        })
        await boss.start()
      }
      return boss
    }

    export async function closePgBoss() {
      if (boss) {
        await boss.stop()
        boss = null
      }
    }
    ```
  - [ ] Initialize pg-boss on application startup
  - [ ] Test database connection and table creation

- [ ] **Task 3: Define Job Types** (AC: #4)
  - [ ] Create `lib/pgboss/jobs.ts` with job type definitions:
    ```typescript
    export const JOB_TYPES = {
      DOCUMENT_PARSE: 'document-parse',
      GENERATE_EMBEDDINGS: 'generate-embeddings',
      ANALYZE_DOCUMENT: 'analyze-document',
      UPDATE_GRAPH: 'update-graph',
      TEST_JOB: 'test-job'
    } as const

    export type JobType = typeof JOB_TYPES[keyof typeof JOB_TYPES]

    export interface DocumentParseJob {
      document_id: string
      deal_id: string
      file_path: string
    }

    export interface GenerateEmbeddingsJob {
      document_id: string
      chunks: string[]
    }
    ```
  - [ ] Add TypeScript types for all job payloads

- [ ] **Task 4: Create Job Handlers** (AC: #3, #4)
  - [ ] Create `lib/pgboss/handlers/test-job.ts`:
    ```typescript
    import { Job } from 'pg-boss'

    export async function testJobHandler(job: Job<{ message: string }>) {
      console.log('Processing test job:', job.data.message)
      // Simulate work
      await new Promise(resolve => setTimeout(resolve, 1000))
      return { status: 'success', timestamp: new Date().toISOString() }
    }
    ```
  - [ ] Create placeholder handlers for future job types:
    - `document-parse-handler.ts` (Epic 3)
    - `generate-embeddings-handler.ts` (Epic 3)
    - `analyze-document-handler.ts` (Epic 3)
    - `update-graph-handler.ts` (Epic 3)
  - [ ] Handlers should throw errors for retry logic testing

- [ ] **Task 5: Register Job Handlers** (AC: #4)
  - [ ] Create `lib/pgboss/register-handlers.ts`:
    ```typescript
    import { getPgBoss } from './client'
    import { testJobHandler } from './handlers/test-job'
    import { JOB_TYPES } from './jobs'

    export async function registerJobHandlers() {
      const boss = await getPgBoss()

      await boss.work(JOB_TYPES.TEST_JOB, { teamSize: 5 }, testJobHandler)
      // Register other handlers as they're implemented
    }
    ```
  - [ ] Call `registerJobHandlers()` on application startup
  - [ ] Configure concurrency (teamSize) per job type

- [ ] **Task 6: Create Job Enqueue API** (AC: #3)
  - [ ] Create `lib/pgboss/enqueue.ts`:
    ```typescript
    import { getPgBoss } from './client'
    import { JOB_TYPES, DocumentParseJob } from './jobs'

    export async function enqueueDocumentParse(data: DocumentParseJob) {
      const boss = await getPgBoss()
      const jobId = await boss.send(JOB_TYPES.DOCUMENT_PARSE, data, {
        priority: 5,
        retryLimit: 3,
        retryDelay: 1,
        retryBackoff: true
      })
      return jobId
    }

    export async function enqueueTestJob(message: string) {
      const boss = await getPgBoss()
      const jobId = await boss.send(JOB_TYPES.TEST_JOB, { message })
      return jobId
    }
    ```
  - [ ] Add enqueue functions for all job types

- [ ] **Task 7: Test Job Enqueue and Processing** (AC: #3, #5)
  - [ ] Create test script: `scripts/test-pgboss.ts`
  - [ ] Enqueue test job
  - [ ] Verify job appears in database: `SELECT * FROM pgboss.job WHERE name = 'test-job'`
  - [ ] Verify worker processes job
  - [ ] Verify job status updates to "completed"
  - [ ] Test failed job retry logic (throw error in handler)
  - [ ] Verify exponential backoff (check retry timestamps)

- [ ] **Task 8: Create Job Status API Endpoint** (AC: #6)
  - [ ] Create `app/api/jobs/[jobId]/route.ts`:
    ```typescript
    const boss = await getPgBoss()
    const job = await boss.getJobById(params.jobId)

    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 })
    }

    return Response.json({
      id: job.id,
      name: job.name,
      state: job.state,
      created_at: job.createdon,
      started_at: job.startedon,
      completed_at: job.completedon,
      retry_count: job.retrycount,
      error: job.output?.error
    })
    ```
  - [ ] Create list endpoint: `app/api/jobs/route.ts` (filter by status, type)
  - [ ] Test endpoints with Postman or curl

- [ ] **Task 9: Implement Graceful Shutdown** (AC: #8)
  - [ ] Add shutdown handler to application:
    ```typescript
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, shutting down gracefully...')
      await closePgBoss()
      process.exit(0)
    })
    ```
  - [ ] Test shutdown: Start workers, enqueue jobs, send SIGTERM
  - [ ] Verify current jobs complete before shutdown
  - [ ] Verify no jobs left in "active" state

- [ ] **Task 10: Configure Environment Variables** (AC: #10)
  - [ ] Add to `.env.local`:
    ```bash
    # pg-boss uses DATABASE_URL from E1.2
    PGBOSS_SCHEMA=pgboss
    PGBOSS_CONCURRENCY=5  # Max concurrent jobs
    ```
  - [ ] Update `.env.example` with placeholder values
  - [ ] Document environment variables in README

- [ ] **Task 11: Test Retry Logic** (AC: #5, #7)
  - [ ] Create failing test job handler (always throws error)
  - [ ] Enqueue job
  - [ ] Verify job retries 3 times
  - [ ] Verify exponential backoff (1s, 2s, 4s)
  - [ ] Verify final state is "failed"
  - [ ] Query failed jobs: `SELECT * FROM pgboss.job WHERE state = 'failed'`

- [ ] **Task 12: Test Priority and Scheduling** (AC: #9)
  - [ ] Enqueue jobs with different priorities (1, 5, 10)
  - [ ] Verify high-priority jobs process first
  - [ ] Enqueue scheduled job (startAfter: 1 minute in future)
  - [ ] Verify job is not processed until scheduled time
  - [ ] Verify job processes after scheduled time passes

- [ ] **Task 13: Performance Testing** (AC: #6)
  - [ ] Enqueue 100 test jobs
  - [ ] Measure total processing time
  - [ ] Verify concurrent processing (teamSize: 5 → ~5 jobs at once)
  - [ ] Monitor database load
  - [ ] Optimize concurrency settings if needed

- [ ] **Task 14: Documentation** (AC: All)
  - [ ] Document pg-boss setup in README
  - [ ] Document job types and handlers
  - [ ] Add example job enqueue and status queries
  - [ ] Document retry logic and error handling
  - [ ] Document graceful shutdown behavior

## Dev Notes

### Technology Stack (Epic 1 Tech Spec)

**Job Queue:**
- **pg-boss**: PostgreSQL-based job queue
  - Docs: [pg-boss GitHub](https://github.com/timgit/pg-boss)
  - npm: [pg-boss Package](https://www.npmjs.com/package/pg-boss)
  - Version: ^8.4.2+ (latest stable)

**Key Features:**
- Exactly-once delivery semantics
- Retry logic with exponential backoff
- Job priority and scheduling
- Dead letter queue (failed jobs)
- Built on PostgreSQL SKIP LOCKED
- Production-proven (hey.com uses for millions of jobs/day)

### Why pg-boss?

**Advantages:**
- ✅ No additional infrastructure (uses existing PostgreSQL)
- ✅ Simple setup (one npm package)
- ✅ Transactional guarantees (ACID from PostgreSQL)
- ✅ Easy to monitor (SQL queries on job table)
- ✅ Production-proven at scale

**Alternative (Phase 2):**
- Redis + Bull: More features, higher throughput, requires Redis infrastructure
- Migrate to Bull if pg-boss becomes a bottleneck (unlikely in MVP)

### pg-boss Architecture

**Database Schema:**
pg-boss creates tables in a dedicated schema (default: `pgboss`):
- `pgboss.job`: All jobs (active, completed, failed)
- `pgboss.archive`: Completed jobs (moved after retention period)
- `pgboss.schedule`: Scheduled jobs
- `pgboss.version`: Schema version

**Job States:**
- `created`: Job enqueued, not yet picked up
- `retry`: Job failed, waiting for retry
- `active`: Job currently being processed
- `completed`: Job finished successfully
- `failed`: Job exhausted all retries
- `expired`: Job not completed within expiration time

**Worker Process:**
1. Worker polls database for jobs: `SELECT ... FROM pgboss.job WHERE state = 'created' FOR UPDATE SKIP LOCKED`
2. Worker locks job and updates state to `active`
3. Worker executes job handler
4. On success: Update state to `completed`
5. On failure: Update state to `retry` (or `failed` if retries exhausted)

### Job Types and Handlers

**Planned Job Types (Epic 1-5):**
1. `document-parse`: Parse uploaded documents with Docling (Epic 3)
2. `generate-embeddings`: Generate vector embeddings with OpenAI (Epic 3)
3. `analyze-document`: LLM analysis of document content (Epic 3)
4. `update-graph`: Update Neo4j knowledge graph (Epic 3)
5. `test-job`: Testing and development

**Handler Pattern:**
```typescript
async function jobHandler(job: Job<JobPayload>) {
  try {
    // Process job
    const result = await processJob(job.data)
    return result  // Stored in job.output
  } catch (error) {
    // Throw error to trigger retry
    throw new Error(`Job failed: ${error.message}`)
  }
}
```

### Retry Configuration

**Default Retry Settings:**
- `retryLimit`: 3 attempts
- `retryDelay`: 1 second (initial)
- `retryBackoff`: true (exponential: 1s, 2s, 4s)
- `expireInHours`: 24 hours (job expires if not completed)

**Retry Delays:**
- Attempt 1: Immediate
- Attempt 2: 1 second delay
- Attempt 3: 2 seconds delay
- Attempt 4: 4 seconds delay
- After 3 retries: State → `failed`

**Custom Retry Logic:**
```typescript
await boss.send('job-type', data, {
  retryLimit: 5,  // 5 attempts
  retryDelay: 2,  // 2 seconds initial delay
  retryBackoff: true
})
```

### Job Monitoring

**Query Job Status:**
```sql
-- Get job by ID
SELECT * FROM pgboss.job WHERE id = $1;

-- Get all failed jobs
SELECT * FROM pgboss.job WHERE state = 'failed';

-- Get jobs by type
SELECT * FROM pgboss.job WHERE name = 'document-parse';

-- Get jobs by status and type
SELECT * FROM pgboss.job WHERE state = 'active' AND name = 'analyze-document';
```

**Programmatic Monitoring:**
```typescript
const boss = await getPgBoss()

// Get job by ID
const job = await boss.getJobById(jobId)

// Get all jobs of a type
const jobs = await boss.fetch('document-parse', 100)  // Fetch up to 100 jobs
```

### Performance Considerations

**Concurrency:**
- Configure `teamSize` per job type (default: 1)
- Higher concurrency → more jobs processed in parallel
- Balance concurrency with database load

**Connection Pooling:**
- pg-boss reuses database connection pool
- Configure `max` connections (default: 10)
- Monitor connection usage in production

**Job Cleanup:**
- Completed jobs archived after retention period
- Failed jobs retained for debugging (manual cleanup)
- Configure `archiveCompletedAfterSeconds` (default: varies)

### Non-Functional Requirements

**Reliability (NFR-REL-002):**
- Exactly-once delivery semantics
- Jobs persist across restarts
- Graceful shutdown completes current jobs

**Performance:**
- Job enqueue: <100ms
- Job pickup: <1 second (polling interval)
- Concurrent processing (teamSize configurable)

**Observability (NFR-OBS-001):**
- Job status queryable via SQL
- Job monitoring API endpoint
- Error logs for failed jobs

### Testing Strategy

**Unit Tests:**
- Test job enqueue functions
- Test job handler logic (isolated)

**Integration Tests:**
- Test full job lifecycle (enqueue → process → complete)
- Test retry logic (failing handler)
- Test priority and scheduling

**Performance Tests:**
- Enqueue 100 jobs, measure throughput
- Test concurrent processing (teamSize: 5)

### References

**Architecture:**
- [Source: docs/manda-architecture.md#Background-Processing]
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#pg-boss-Job-Queue]

**Epic Specification:**
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#AC-7-Background-Job-Queue]
- [Source: docs/epics.md#Epic-1-Story-E1.8]

**Official Documentation:**
- [pg-boss GitHub](https://github.com/timgit/pg-boss)
- [pg-boss npm Package](https://www.npmjs.com/package/pg-boss)

### Security Considerations

**Database Access:**
- pg-boss uses same database connection as application
- RLS policies do NOT apply to pg-boss tables (dedicated schema)
- Job data should include user_id for authorization checks in handlers

**Job Data Validation:**
- Validate job payload before processing
- Sanitize user inputs in job data
- Never trust job data from database (could be tampered)

### Prerequisites

- **E1.2** (Supabase Auth) provides database connection
- **E1.3** (PostgreSQL Schema) database must be running

### Dependencies

- **Epic 3** (Document Processing) will use job queue for parsing, embeddings, analysis
- **Epic 4** (Pattern Detection) will use job queue for background analysis

## Dev Agent Record

### Context Reference

[Story Context XML](./e1-8-configure-pg-boss-job-queue.context.xml)

### Agent Model Used

_To be filled by dev agent_

### Debug Log References

_To be filled by dev agent during implementation_

### Completion Notes List

_To be filled by dev agent after completion_

### File List

_To be filled by dev agent with created/modified/deleted files_

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2025-11-24 | Max (SM Agent) | Initial story draft created from Epic 1 tech spec |
