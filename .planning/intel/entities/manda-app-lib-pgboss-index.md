---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/pgboss/index.ts
type: module
updated: 2026-01-20
status: active
---

# index.ts

## Purpose

Barrel export for the pg-boss PostgreSQL-based job queue module. Provides client management, job type definitions, handler registration, job enqueueing functions, and graceful shutdown handling. Enables background processing for document parsing, analysis, graph updates, and pattern detection with priority and scheduling support.

## Exports

- Client: `getPgBoss`, `getPgBossSync`, `isPgBossRunning`, `closePgBoss`, `forceClosePgBoss`, `verifyPgBossConnection`
- Job types: `JOB_TYPES`, `DEFAULT_JOB_OPTIONS`, `DEFAULT_WORKER_CONFIG`, `JobType`, `TestJobPayload`, `DocumentParseJobPayload`, `AnalyzeDocumentJobPayload`, `UpdateGraphJobPayload`, `DetectContradictionsJobPayload`, `DetectPatternsJobPayload`, `JobResult`, `TestJobResult`, `DocumentParseResult`, `AnalyzeDocumentResult`, `EnqueueOptions`, `WorkerConfig`
- Handler registration: `registerJobHandlers`, `isHandlerRegistered`, `getRegisteredHandlers`, `clearRegisteredHandlers`
- Enqueue functions: `enqueueTestJob`, `enqueueDocumentParse`, `enqueueAnalyzeDocument`, `enqueueUpdateGraph`, `enqueueDetectContradictions`, `enqueueDetectPatterns`, `enqueueHighPriority`, `enqueueScheduled`
- Handlers: `testJobHandler`, `documentParseHandler`, `analyzeDocumentHandler`, `updateGraphHandler`
- Shutdown: `registerShutdownHandlers`, `isShutdownInProgress`

## Dependencies

- [[manda-app-lib-pgboss-client]] - pg-boss client management
- [[manda-app-lib-pgboss-jobs]] - Job type definitions
- [[manda-app-lib-pgboss-register-handlers]] - Handler registration
- [[manda-app-lib-pgboss-enqueue]] - Job enqueueing
- [[manda-app-lib-pgboss-handlers]] - Job handlers
- [[manda-app-lib-pgboss-shutdown]] - Graceful shutdown

## Used By

TBD

## Notes

pg-boss uses PostgreSQL for job persistence, enabling shared queue between Next.js (enqueue) and Python workers (process). Supports priority queuing and scheduled jobs. Graceful shutdown ensures jobs complete before process exit.
