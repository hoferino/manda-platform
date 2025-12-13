# Architecture Clarification: pg-boss & Python Workers

**Date:** 2025-12-12
**Context:** Manual testing preparation for document processing pipeline

---

## Initial Confusion

When reviewing the codebase, found:
- ❌ Next.js pgboss handlers labeled as "PLACEHOLDER"
- ❓ Unclear if pg-boss was actually being used
- ❓ Unclear where actual processing happened

## Actual Architecture (CONFIRMED)

### pg-boss IS Being Used

pg-boss is the **shared job queue** between Next.js and Python:

```
┌────────────────────────────────────────────────┐
│         SHARED pg-boss QUEUE                   │
│      (Postgres tables in Supabase)             │
├────────────────────────────────────────────────┤
│                                                │
│  Next.js (TypeScript)    Python Workers        │
│        │                        │              │
│        ├─► Enqueue jobs   ◄────┤ Dequeue       │
│        │   (via webhook)       │ Process       │
│        │                       │ Complete      │
│        │                                       │
│        └─► Placeholders ──X    └─► Handlers   │
│            (future use)            (active)    │
│                                                │
└────────────────────────────────────────────────┘
```

### How It Works

**Step-by-Step Flow:**

1. **Next.js Upload API** receives file upload
2. **Next.js** uploads to GCS, creates document record
3. **Next.js** POSTs to Python webhook: `/webhooks/document-uploaded`
4. **Python FastAPI** receives webhook
5. **Python** enqueues job to pg-boss: `INSERT INTO pgboss.job`
6. **Python Worker** polls queue: `UPDATE pgboss.job SET state='active'`
7. **Python Worker** executes handler (parse, embed, analyze)
8. **Python Worker** completes job: `UPDATE pgboss.job SET state='completed'`
9. **Python Worker** enqueues next job (chaining)

**Visual Flow:**

```
┌─────────────────────────────────────────────────────────────────┐
│                     DOCUMENT UPLOAD FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [User Uploads File in UI]                                      │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────────────────┐                              │
│  │  Next.js Upload API          │                              │
│  │  POST /api/documents/upload  │                              │
│  └──────────────────────────────┘                              │
│           │                                                     │
│           ├─► Upload to GCS                                     │
│           ├─► Create document record (Supabase)                 │
│           └─► POST webhook to Python                            │
│                     │                                           │
│                     ▼                                           │
│  ┌──────────────────────────────────────────┐                  │
│  │  Python FastAPI Service                  │                  │
│  │  POST /webhooks/document-uploaded        │                  │
│  └──────────────────────────────────────────┘                  │
│                     │                                           │
│                     ▼                                           │
│  ┌──────────────────────────────────────────┐                  │
│  │  JobQueue.enqueue()                      │                  │
│  │  INSERT INTO pgboss.job                  │                  │
│  │    name='document-parse'                 │                  │
│  │    state='created'                       │                  │
│  │    data={document_id, gcs_path, ...}     │                  │
│  └──────────────────────────────────────────┘                  │
│                     │                                           │
│  ╔═════════════════╧═══════════════════════╗                   │
│  ║      SHARED pg-boss QUEUE                ║                   │
│  ║   (pgboss.job table in Supabase)         ║                   │
│  ╚═══════════════════════════════════════════╝                   │
│                     │                                           │
│                     │ (Polling every few seconds)               │
│                     ▼                                           │
│  ┌──────────────────────────────────────────┐                  │
│  │  Python Worker Process                   │                  │
│  │  python -m src.jobs.worker               │                  │
│  └──────────────────────────────────────────┘                  │
│           │                                                     │
│           ├─► Dequeue job (state='active')                      │
│           ├─► ParseDocumentHandler.handle()                     │
│           │        ├─► Download from GCS                        │
│           │        ├─► Parse with Docling                       │
│           │        ├─► Chunk text                               │
│           │        ├─► Store chunks in DB                       │
│           │        └─► Update doc status                        │
│           ├─► Complete job (state='completed')                  │
│           └─► Enqueue next job: 'generate-embeddings'           │
│                                                                 │
│  Repeat for: generate-embeddings → analyze-document → ...      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Design?

**Technology Alignment:**
- Next.js → Web serving, API endpoints, React UI
- Python → Data processing, ML, Docling, embeddings

**Scalability:**
- Scale web tier (Next.js) separately from compute tier (Python)
- Run multiple Python workers in parallel
- pg-boss coordinates all work

**Language Interoperability:**
- TypeScript pg-boss client (npm library)
- Python pg-boss client (direct SQL via asyncpg)
- Both operate on same Postgres tables
- Fully compatible

### Files Involved

**Next.js:**
- `manda-app/lib/pgboss/handlers/*.ts` - PLACEHOLDERS (future use)
- `manda-app/app/api/documents/upload/route.ts` - Triggers webhook

**Python:**
- `manda-processing/src/api/routes/webhooks.py` - Webhook receiver
- `manda-processing/src/jobs/queue.py` - JobQueue class (SQL-based)
- `manda-processing/src/jobs/worker.py` - Worker process
- `manda-processing/src/jobs/handlers/parse_document.py` - REAL handler
- `manda-processing/src/jobs/handlers/generate_embeddings.py` - REAL handler
- `manda-processing/src/jobs/handlers/analyze_document.py` - REAL handler

### Required Running Processes

For the pipeline to work, you need:

1. ✅ **Neo4j** (Docker) - Knowledge graph
2. ✅ **manda-processing FastAPI** - Webhook receiver + job enqueuer
3. ✅ **manda-processing Worker** - Job processor
4. ✅ **Next.js app** - Web UI + API

**Two Python Processes:**
- `uvicorn src.main:app` (FastAPI service)
- `python -m src.jobs.worker` (Worker)

Both are needed!

---

## Testing Implications

When manually testing document processing:

1. **Watch Terminal 2** (FastAPI) for webhook receipt + job enqueue
2. **Watch Terminal 5** (Worker) for job processing
3. **Query pg-boss queue** to see job state transitions
4. **Verify job chaining** (parse → embeddings → analysis)

### Monitoring pg-boss

```sql
-- See all jobs
SELECT name, state, COUNT(*) as count
FROM pgboss.job
GROUP BY name, state;

-- Track specific job
SELECT id, name, state, retry_count, created_on, started_on, completed_on
FROM pgboss.job
WHERE name = 'document-parse'
ORDER BY created_on DESC
LIMIT 5;

-- Check for failed jobs
SELECT id, name, retry_count, output
FROM pgboss.job
WHERE state = 'failed'
ORDER BY created_on DESC;
```

---

## Common Issues & Troubleshooting

### Issue 1: Jobs Stuck in 'created' State

**Symptoms:**
```sql
SELECT id, name, state FROM pgboss.job WHERE state = 'created';
-- Shows jobs that never get processed
```

**Cause:** Worker process not running or crashed

**Fix:**
```bash
# Check if worker is running
ps aux | grep "src.jobs.worker"

# If not running, start it
cd manda-processing
source venv/bin/activate
python -m src.jobs.worker
```

---

### Issue 2: Jobs Stuck in 'active' State

**Symptoms:**
```sql
SELECT id, name, state, started_on FROM pgboss.job WHERE state = 'active';
-- Shows jobs that started but never finished
```

**Cause:** Worker crashed mid-processing, or job handler has a bug

**Fix:**
```bash
# Check worker logs for errors
# Restart worker process
# Jobs will be retried automatically (up to retry_limit)

# Manually reset stuck job (ONLY IF NECESSARY):
UPDATE pgboss.job
SET state = 'retry', retry_count = retry_count + 1
WHERE id = '[JOB_ID]';
```

---

### Issue 3: Jobs Immediately Fail

**Symptoms:**
```sql
SELECT id, name, state, output FROM pgboss.job WHERE state = 'failed';
-- Shows failed jobs with error in output column
```

**Cause:** Missing dependencies, env vars, or file not found

**Fix:**
1. Check `output` column for error details:
   ```sql
   SELECT output FROM pgboss.job WHERE id = '[JOB_ID]';
   ```
2. Common issues:
   - Missing `MANDA_PROCESSING_API_KEY` env var
   - GCS file doesn't exist
   - Docling import error (missing Python package)
   - Database connection error

---

### Issue 4: pg-boss Tables Don't Exist

**Symptoms:**
```sql
SELECT * FROM pgboss.job;
-- ERROR: relation "pgboss.job" does not exist
```

**Cause:** pg-boss migrations not run

**Fix:**
Next.js app should auto-create tables on first startup. If not:
```bash
cd manda-app
npm run dev
# Wait for "pg-boss schema installed" in logs
```

Or manually create:
```bash
# Check Next.js logs for migration SQL
# OR use pg-boss CLI if installed
```

---

### Issue 5: Worker Can't Connect to Database

**Symptoms:**
```
Worker starting...
ERROR: Failed to create pool: connection refused
```

**Cause:** Wrong `DATABASE_URL` in Python env

**Fix:**
```bash
# Check Python .env file
cd manda-processing
cat .env

# Should have:
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres

# Or copy from Next.js .env:
grep DATABASE_URL ../manda-app/.env.local
```

---

### Issue 6: Webhook Not Reaching Python Service

**Symptoms:**
- Upload succeeds in UI
- No logs in Python FastAPI service
- No job created in pg-boss

**Cause:** `MANDA_PROCESSING_API_URL` wrong or service not running

**Fix:**
```bash
# Verify env var in Next.js
cd manda-app
grep MANDA_PROCESSING_API_URL .env.local

# Should be: http://localhost:8001

# Test webhook manually
curl -X POST http://localhost:8001/webhooks/document-uploaded \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "document_id": "00000000-0000-0000-0000-000000000000",
    "deal_id": "00000000-0000-0000-0000-000000000000",
    "user_id": "00000000-0000-0000-0000-000000000000",
    "gcs_path": "gs://test/test.pdf",
    "file_type": "application/pdf"
  }'

# Expected: {"success": true, "message": "...", "job_id": "..."}
```

---

## Monitoring Best Practices

### Real-Time Job Monitoring

```sql
-- Active jobs right now
SELECT id, name, state, retry_count,
       NOW() - started_on as running_for
FROM pgboss.job
WHERE state = 'active'
ORDER BY started_on DESC;

-- Jobs by state (summary)
SELECT name, state, COUNT(*) as count
FROM pgboss.job
GROUP BY name, state
ORDER BY name, state;

-- Recent failures
SELECT id, name, retry_count, output,
       created_on, started_on, completed_on
FROM pgboss.job
WHERE state = 'failed'
ORDER BY completed_on DESC
LIMIT 10;
```

### Worker Health Check

```bash
# Check worker is running
ps aux | grep worker

# Check worker logs
tail -f /path/to/worker.log

# Or if running in terminal, watch the output

# Expected log pattern:
# Polling for jobs...
# Jobs dequeued: count=1, name=document-parse
# Processing...
# Job completed
# Enqueued next job
```

---

## Conclusion

✅ **pg-boss is actively used** - It's the backbone of the job queue
✅ **Python workers are the real processors** - All heavy lifting happens here
✅ **Next.js placeholders are intentional** - Future expansion capability
✅ **Microservices pattern** - Web layer + compute layer separation
✅ **Both systems share the same queue** - Language-agnostic design

This is a **clean, scalable architecture** that leverages the strengths of each technology.

**Key Takeaway:** Both the FastAPI service AND the worker process must be running for document processing to work!

---

**Author:** Murat (Master Test Architect)
**For:** Max
**Related:** [manual-testing-guide-document-processing.md](manual-testing-guide-document-processing.md)
