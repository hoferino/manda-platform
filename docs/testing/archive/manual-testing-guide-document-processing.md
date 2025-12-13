# Manual Testing Guide: Document Processing Pipeline

**Tester:** Max
**Date Created:** 2025-12-12
**Focus:** End-to-end document processing validation
**Risk Level:** CRITICAL (Core intelligence layer)

---

## Overview

This guide walks you through **manual validation** of the complete document processing pipeline:

```
Upload → GCS → manda-processing → Docling → Chunking → Embeddings → Neo4j → RAG
```

**Key Findings from Code Review:**
- ✅ Docling parser is **fully implemented** in `manda-processing`
- ✅ **pg-boss is used** - it's the shared job queue database
- ✅ Next.js handlers are **PLACEHOLDERS** (intentional - Python does the work)
- ✅ Python service has **real job handlers** via direct SQL to pg-boss
- ✅ Upload flow triggers webhook → Python enqueues job → Python workers process

---

## Architecture Summary

### The pg-boss + Python Worker Architecture

**CRITICAL UNDERSTANDING:**
Both Next.js and Python share the **same pg-boss database tables** in Supabase Postgres:

```
┌────────────────────────────────────────────────────────────┐
│                   SHARED JOB QUEUE                         │
│                (pg-boss tables in Supabase)                │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  [Next.js TypeScript]          [Python Workers]           │
│         │                             │                   │
│         ├─► Can enqueue jobs    ◄─────┤ Dequeue jobs      │
│         │   (currently unused)        │ Process jobs      │
│         │                             │ Complete jobs     │
│         │                             │                   │
│         └─► Placeholders ──X          └─► Real handlers   │
│             (E1.8 scaffolds)              (E3.x epics)    │
│             Not used yet                  ACTIVE NOW      │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Why Placeholders?**
- Next.js handlers were scaffolded in Epic 1 for **future use**
- Epic 3 implemented the **actual logic in Python** (better for ML/data tasks)
- Python interacts with pg-boss via **direct SQL** (asyncpg)
- Both systems use the **same queue** - fully compatible

---

## Actual Flow (Confirmed from Code)

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: Upload & Webhook Trigger                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Next.js Upload API]                                           │
│         │                                                       │
│         ├─► Upload to GCS (manda-documents-dev)                 │
│         ├─► Create document record in Supabase                  │
│         └─► POST to manda-processing webhook                    │
│                                                                 │
│  File: manda-app/app/api/documents/upload/route.ts             │
│  Webhook: ${MANDA_PROCESSING_API_URL}/webhooks/document-uploaded│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: Job Enqueuing (Python Webhook Handler)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Webhook Endpoint] /webhooks/document-uploaded                 │
│         │                                                       │
│         ├─► Receives: document_id, deal_id, gcs_path, etc.      │
│         └─► Enqueues job to pg-boss queue                       │
│                  │                                              │
│                  └─► INSERT INTO pgboss.job (...)               │
│                      name='document-parse'                      │
│                      state='created'                            │
│                                                                 │
│  File: manda-processing/src/api/routes/webhooks.py             │
│  File: manda-processing/src/jobs/queue.py (JobQueue class)     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: Job Processing (Python Worker)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Worker Process] Polls pg-boss queue                           │
│         │                                                       │
│         ├─► Dequeues job: UPDATE pgboss.job SET state='active' │
│         │                                                       │
│         └─► [ParseDocumentHandler]                              │
│                  │                                              │
│                  ├─► Download from GCS                          │
│                  ├─► Parse with Docling                         │
│                  ├─► Chunk text (512-1024 tokens)               │
│                  ├─► Store chunks in document_chunks            │
│                  ├─► Update document status to 'parsed'         │
│                  ├─► Mark stage complete                        │
│                  └─► Enqueue next job: 'generate-embeddings'    │
│                                                                 │
│  File: manda-processing/src/jobs/handlers/parse_document.py    │
│  File: manda-processing/src/parsers/docling_parser.py          │
│  File: manda-processing/src/parsers/chunker.py                 │
│  File: manda-processing/src/jobs/worker.py                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: Storage & Embeddings                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Chunks] → Write to Supabase (document_chunks table)           │
│                       │                                         │
│                       ▼                                         │
│              Generate Embeddings (OpenAI API)                   │
│              Model: text-embedding-3-large (3072 dims)          │
│                       │                                         │
│                       ▼                                         │
│              Store in pgvector (embeddings column)              │
│                                                                 │
│  [Document Analysis] → Extract Findings                         │
│                       │                                         │
│                       └─► findings table (with embeddings)      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PHASE 4: Knowledge Graph (Neo4j)                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Findings] → Create Neo4j nodes                                │
│                       │                                         │
│                       ├─► Document nodes                        │
│                       ├─► Finding nodes                         │
│                       └─► Relationships                         │
│                            │                                    │
│                            ├─► FROM_DOCUMENT                    │
│                            ├─► SUPPORTS                         │
│                            ├─► CONTRADICTS                      │
│                            └─► SUPERSEDES                       │
│                                                                 │
│  File: manda-app/lib/neo4j/operations.ts                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PHASE 5: RAG Retrieval                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Agent Query] → Hybrid Search                                  │
│                       │                                         │
│                       ├─► pgvector semantic search              │
│                       └─► Neo4j relationship traversal          │
│                            │                                    │
│                            ▼                                    │
│                   Ranked Results with Sources                   │
│                                                                 │
│  File: manda-app/lib/agent/cim/utils/content-retrieval.ts     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Pre-Test Setup

### 1. Check Environment Variables

Verify these are set in `manda-app/.env.local`:

```bash
# In manda-app directory
cd /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app

# Check critical env vars
grep "MANDA_PROCESSING" .env.local
grep "GOOGLE_APPLICATION_CREDENTIALS" .env.local
grep "GCS_BUCKET_NAME" .env.local
grep "OPENAI_API_KEY" .env.local
grep "NEO4J" .env.local
```

**Expected:**
```
MANDA_PROCESSING_API_URL=http://localhost:8001
MANDA_PROCESSING_API_KEY=<your-key>
GOOGLE_APPLICATION_CREDENTIALS=/path/to/manda-storage-key.json
GCS_BUCKET_NAME=manda-documents-dev
OPENAI_API_KEY=sk-...
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=mandadev123
```

### 2. Start All Services

Open **5 terminal windows** (or use tmux/screen):

#### Terminal 1: Neo4j
```bash
cd /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app
docker-compose -f docker-compose.dev.yml up -d

# Verify running
docker ps | grep neo4j

# Expected output:
# CONTAINER ID   IMAGE        STATUS
# abc123...      neo4j:5.x    Up 30 seconds
```

#### Terminal 2: manda-processing Python Service (API + Worker)
```bash
cd /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-processing

# Activate virtual environment if needed
source venv/bin/activate  # or however you manage Python env

# Start the FastAPI service (webhook receiver + job enqueuer)
# Option A: If using uvicorn/FastAPI
uvicorn src.main:app --reload --port 8001 --host 0.0.0.0

# Option B: If there's a start script
python -m src.main

# Option C: Check for docker-compose
docker-compose up

# Keep this terminal open to watch logs
```

**CHECKPOINT:** Does the service start without errors? You should see:
- `Uvicorn running on http://0.0.0.0:8001` (or similar)
- No import errors
- No missing dependencies

**IMPORTANT:** You also need to start the **worker process** that actually processes jobs from pg-boss queue.

Open **Terminal 5** (or split Terminal 2):
```bash
cd /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-processing

# Activate virtual environment
source venv/bin/activate

# Start the worker process
python -m src.jobs.worker

# OR if there's a specific worker command:
python -m src.jobs.__main__
```

**Expected Worker Output:**
```
Worker starting...
Registered handlers: document-parse, generate-embeddings, analyze-document
Polling for jobs...
```

**Why Two Processes?**
- **FastAPI service** (Terminal 2): Receives webhooks, enqueues jobs to pg-boss
- **Worker process** (Terminal 5): Polls pg-boss queue, executes job handlers

Both are needed for the pipeline to work!

#### Terminal 3: Next.js App
```bash
cd /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app
npm run dev

# Expected:
# ▲ Next.js 15.x
# - Local: http://localhost:3000
```

#### Terminal 4: Monitoring/Queries
Keep this free for running database queries and debugging commands.

**Service Summary:**
You should now have running:
1. ✅ Neo4j (Docker container)
2. ✅ manda-processing FastAPI service (port 8001) - webhook receiver
3. ✅ manda-processing Worker - job processor
4. ✅ Next.js app (port 3000)
5. ✅ Terminal for queries/debugging

### 3. Verify Service Health

#### Check manda-processing is reachable
```bash
# Terminal 4
curl http://localhost:8001/health

# Expected: {"status": "healthy"} or similar
```

#### Check Neo4j Browser
- Open: http://localhost:7474
- Login: `neo4j` / `mandadev123`
- Should see Neo4j Browser dashboard

#### Check Supabase Connection
- Open: https://supabase.com/dashboard/project/cymfyqussypehaeebedn
- Navigate to SQL Editor
- Run: `SELECT COUNT(*) FROM documents;`

#### Check pg-boss Queue Status
```sql
-- Run in Supabase SQL Editor
-- Check if pg-boss tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'pgboss'
ORDER BY table_name;

-- Expected tables:
-- pgboss.archive
-- pgboss.job
-- pgboss.schedule
-- pgboss.version

-- Check job queue status
SELECT name, state, COUNT(*) as count
FROM pgboss.job
GROUP BY name, state
ORDER BY name, state;

-- Expected: Initially empty or showing previous jobs
```

If pg-boss tables don't exist, you need to run the migration (check Next.js app startup - it should auto-create).

---

## Test Suite

---

## PHASE 1: Upload & GCS Storage

### Test 1.1: Basic File Upload

**Objective:** Verify file uploads to GCS and database record is created.

**Steps:**
1. Open http://localhost:3000
2. Login with your credentials
3. Navigate to an existing deal (or create one)
4. Go to **Data Room** tab
5. Click **Upload** or drag-and-drop a test PDF file

**Test File:** Use a simple PDF (e.g., company overview, 5-10 pages)

**What to Watch:**

**In Terminal 2 (FastAPI Service)**, you should see:
```
POST /webhooks/document-uploaded
Received document-uploaded webhook
document_id: abc-123-xyz
deal_id: deal-uuid
gcs_path: gs://manda-documents-dev/...
Job enqueued: job-xyz
```

**In Terminal 5 (Worker)**, you should see:
```
Jobs dequeued: count=1, name=document-parse
Processing parse_document job
File downloaded, starting parse
Document parsed successfully
Chunks created: 15
Job completed: job-xyz
Enqueued next job: generate-embeddings
```

**In Terminal 3 (Next.js)**, you should see:
```
Document processing job enqueued: {documentId: 'abc-123', jobId: 'job-xyz'}
```

**Validation:**

#### Database Check (Supabase SQL Editor):
```sql
-- Check document was created
SELECT id, name, upload_status, processing_status, gcs_object_path, created_at
FROM documents
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:**
- `upload_status`: `"completed"`
- `processing_status`: `"pending"` (initially, then changes)
- `gcs_object_path`: Should have path like `deals/{deal-id}/{filename}`

#### GCS Bucket Check:
```bash
# Terminal 4
~/google-cloud-sdk/bin/gsutil ls gs://manda-documents-dev/deals/

# Expected: List of deal folders
# Then drill down:
~/google-cloud-sdk/bin/gsutil ls gs://manda-documents-dev/deals/{YOUR_DEAL_ID}/

# Expected: Your uploaded file
```

#### pg-boss Queue Check:
```sql
-- Monitor the job queue
SELECT id, name, state, priority, retry_count, created_on, started_on
FROM pgboss.job
WHERE name = 'document-parse'
ORDER BY created_on DESC
LIMIT 5;

-- Expected states:
-- 'created' → just enqueued
-- 'active' → worker is processing
-- 'completed' → finished successfully
-- 'retry' → failed, will retry
-- 'failed' → permanently failed
```

**What to Watch:**
- Job should transition: `created` → `active` → `completed` (within seconds)
- If stuck in `created` → Worker not running
- If stuck in `active` → Worker crashed or hung
- If `retry` or `failed` → Check error in output column

**Pass Criteria:**
- ✅ File appears in GCS bucket
- ✅ Document record created in Supabase
- ✅ `upload_status` = `"completed"`
- ✅ Webhook triggered (logs in Terminal 2)
- ✅ Job created in pg-boss queue
- ✅ Worker picks up and processes job

**Fail/Debug:**
- ❌ No webhook log → Check `MANDA_PROCESSING_API_URL` and `API_KEY` env vars
- ❌ File not in GCS → Check `GOOGLE_APPLICATION_CREDENTIALS` path
- ❌ Database error → Check Supabase connection
- ❌ Job not created → Check pg-boss tables exist
- ❌ Job stuck in `created` → Worker not running (start Terminal 5)
- ❌ Job failed → Check worker logs and error output

---

### Test 1.2: Upload Status Updates

**Objective:** Verify `processing_status` changes as pipeline progresses.

**Steps:**
1. Immediately after upload, query database every 5-10 seconds

```sql
-- Run this repeatedly
SELECT id, name, processing_status, updated_at
FROM documents
WHERE id = '{YOUR_DOCUMENT_ID}'
```

**Expected Progression:**
1. `processing_status`: `"pending"` (just after upload)
2. `processing_status`: `"processing"` (manda-processing starts)
3. `processing_status`: `"completed"` (all done)

**Alternative:** `"failed"` if errors occur

**Watch For:**
- How long does it take to go from `pending` → `completed`?
- Record this time (baseline for performance)

**Pass Criteria:**
- ✅ Status progresses through states
- ✅ Final status is `"completed"`
- ✅ `updated_at` timestamp changes

---

## PHASE 2: Docling Parsing & Chunking

### Test 2.1: Chunk Creation

**Objective:** Verify Docling parses the document and creates chunks.

**Steps:**
1. Wait for `processing_status` = `"completed"` (from Test 1.2)
2. Query `document_chunks` table:

```sql
-- Check chunks for your document
SELECT
  id,
  chunk_index,
  page_number,
  chunk_type,
  LENGTH(content) as content_length,
  token_count,
  embedding IS NOT NULL as has_embedding
FROM document_chunks
WHERE document_id = '{YOUR_DOCUMENT_ID}'
ORDER BY chunk_index
LIMIT 20;
```

**Expected:**
- Multiple rows (10-50+ chunks for a 10-page PDF)
- `chunk_index` starts at 0 and increments
- `page_number` matches PDF pages
- `chunk_type` = `"text"` or `"table"`
- `content_length` between ~500-4000 characters
- `token_count` between 512-1024 (per chunker config)

**Deep Dive - Inspect Chunk Content:**
```sql
-- Read actual chunk content
SELECT chunk_index, page_number, content
FROM document_chunks
WHERE document_id = '{YOUR_DOCUMENT_ID}'
AND chunk_index = 0;
```

**Manual Validation:**
- Does the `content` match what's on page 1 of your PDF?
- Is the text clean (no garbled characters)?
- Are tables preserved (if using `chunk_type = 'table'`)?

**Pass Criteria:**
- ✅ Chunks created (at least 5+ for a multi-page doc)
- ✅ `chunk_index` sequential
- ✅ `page_number` correct
- ✅ `token_count` within 512-1024 range
- ✅ Content is readable and accurate

**Fail/Debug:**
- ❌ No chunks → Check `manda-processing` logs for errors
- ❌ Garbled text → Possible encoding issue in Docling
- ❌ Missing pages → Check if PDF is scanned (OCR needed)

---

### Test 2.2: Table Extraction (If Applicable)

**Objective:** Verify tables are extracted separately.

**Prerequisites:** Your test PDF must contain at least one table.

**Steps:**
```sql
-- Find table chunks
SELECT chunk_index, page_number, content
FROM document_chunks
WHERE document_id = '{YOUR_DOCUMENT_ID}'
AND chunk_type = 'table'
ORDER BY chunk_index;
```

**Expected:**
- Rows where `chunk_type = 'table'`
- `content` should be markdown table format

**Example Output:**
```
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Value 1  | Value 2  | Value 3  |
```

**Also Check `tables` Column:**
```sql
SELECT id, name,
  (SELECT COUNT(*) FROM jsonb_array_elements(metadata->'tables')) as table_count
FROM documents
WHERE id = '{YOUR_DOCUMENT_ID}';
```

**Pass Criteria:**
- ✅ Tables detected
- ✅ Table content in markdown format
- ✅ Headers preserved

---

### Test 2.3: Excel File Processing

**Objective:** Verify Excel parsing with formulas.

**Steps:**
1. Upload a test Excel file (.xlsx) with:
   - Multiple sheets
   - At least one formula (e.g., `=SUM(A1:A10)`)
   - A table

2. Wait for processing to complete

3. Query chunks:
```sql
SELECT chunk_index, page_number, chunk_type, content
FROM document_chunks
WHERE document_id = '{YOUR_EXCEL_DOCUMENT_ID}'
ORDER BY chunk_index
LIMIT 10;
```

**Expected:**
- Chunks for each sheet
- Formula values included (not just `=SUM(...)` but the result)
- Tables detected

**Pass Criteria:**
- ✅ Excel file processed
- ✅ Multiple sheets handled
- ✅ Formulas preserved or evaluated

---

## PHASE 3: Embeddings Generation

### Test 3.1: Embedding Creation

**Objective:** Verify OpenAI embeddings are generated and stored.

**Steps:**
```sql
-- Check if embeddings exist
SELECT
  id,
  chunk_index,
  token_count,
  embedding IS NOT NULL as has_embedding,
  array_length(embedding, 1) as embedding_dimensions
FROM document_chunks
WHERE document_id = '{YOUR_DOCUMENT_ID}'
ORDER BY chunk_index
LIMIT 10;
```

**Expected:**
- `has_embedding` = `true` for all chunks
- `embedding_dimensions` = `3072` (OpenAI text-embedding-3-large)

**If Embeddings Are Missing:**
Check manda-processing logs for:
- OpenAI API call errors
- Rate limiting issues
- API key problems

**Pass Criteria:**
- ✅ All chunks have embeddings
- ✅ Embedding dimensions = 3072
- ✅ No NULL embeddings

---

### Test 3.2: Semantic Search Test

**Objective:** Verify pgvector can perform semantic search.

**Steps:**
1. Pick a concept from your uploaded document (e.g., "revenue")
2. Generate a test embedding for that concept (you'll need to call OpenAI API manually or use a helper function)

**Quick Test Using Supabase Function:**
```sql
-- This assumes you have a match_document_chunks function
-- (Check if it exists in your schema)

SELECT routine_name
FROM information_schema.routines
WHERE routine_name LIKE '%match%';
```

**If `match_document_chunks` exists:**
```sql
-- Test semantic search
-- (You'll need to generate an embedding vector first)

-- Example conceptual query:
SELECT id, chunk_index, content,
       1 - (embedding <=> '[YOUR_QUERY_EMBEDDING]') as similarity
FROM document_chunks
WHERE document_id = '{YOUR_DOCUMENT_ID}'
AND embedding IS NOT NULL
ORDER BY embedding <=> '[YOUR_QUERY_EMBEDDING]'
LIMIT 5;
```

**Note:** Generating the query embedding requires calling OpenAI API. This is easier to test through the agent interface (see Phase 5).

**Pass Criteria:**
- ✅ Semantic search returns relevant chunks
- ✅ Similarity scores ranked correctly

---

## PHASE 4: Neo4j Knowledge Graph

### Test 4.1: Document Node Creation

**Objective:** Verify document creates a node in Neo4j.

**Steps:**
1. Open Neo4j Browser: http://localhost:7474
2. Login: `neo4j` / `mandadev123`
3. Run query:

```cypher
// Find your document node
MATCH (d:Document)
WHERE d.id = '{YOUR_DOCUMENT_ID}'
RETURN d
```

**Expected:**
- One node returned
- Properties include: `id`, `title`, `dealId`, `createdAt`

**Alternative Query - List all documents:**
```cypher
MATCH (d:Document)
RETURN d.id, d.title, d.dealId
ORDER BY d.createdAt DESC
LIMIT 10
```

**Pass Criteria:**
- ✅ Document node exists
- ✅ Properties populated correctly
- ✅ `dealId` matches your deal

---

### Test 4.2: Finding Nodes & Relationships

**Objective:** Verify findings are extracted and linked to documents.

**Steps:**
```cypher
// Find findings linked to your document
MATCH (d:Document {id: '{YOUR_DOCUMENT_ID}'})-[:FROM_DOCUMENT]->(f:Finding)
RETURN f.id, f.title, f.category, f.confidence
LIMIT 20
```

**Expected:**
- Multiple Finding nodes
- Each has `title`, `category`, `confidence`
- `FROM_DOCUMENT` relationship connects them

**Visual Exploration:**
```cypher
// Visualize the graph
MATCH (d:Document {id: '{YOUR_DOCUMENT_ID}'})-[r]-(connected)
RETURN d, r, connected
LIMIT 50
```

This will show a visual graph in Neo4j Browser.

**Pass Criteria:**
- ✅ Finding nodes created
- ✅ FROM_DOCUMENT relationships exist
- ✅ Findings have meaningful titles and categories

**Fail/Debug:**
- ❌ No findings → Check if document analysis ran (check manda-processing logs)
- ❌ No relationships → Check Neo4j operations code

---

### Test 4.3: Multi-Document Relationships

**Objective:** Test SUPPORTS, CONTRADICTS, SUPERSEDES relationships.

**Setup:**
1. Upload a SECOND document that mentions similar facts
   - Example: If Doc 1 says "Revenue: $10M", Doc 2 should also mention revenue

**Steps:**
```cypher
// Find SUPPORTS relationships
MATCH (f1:Finding)-[r:SUPPORTS]->(f2:Finding)
WHERE f1.dealId = '{YOUR_DEAL_ID}'
RETURN f1.title, f2.title, r.confidence
LIMIT 10
```

```cypher
// Find CONTRADICTS relationships
MATCH (f1:Finding)-[r:CONTRADICTS]->(f2:Finding)
WHERE f1.dealId = '{YOUR_DEAL_ID}'
RETURN f1.title, f2.title, r.reason
LIMIT 10
```

**Expected:**
- If two documents corroborate a fact → SUPPORTS relationship
- If they conflict → CONTRADICTS relationship

**Pass Criteria:**
- ✅ SUPPORTS relationships detected (if applicable)
- ✅ CONTRADICTS relationships detected (if conflicting data)
- ✅ Relationship properties include `confidence` or `reason`

**Note:** This depends on the relationship detection logic being implemented in manda-processing. Check if this is active.

---

## PHASE 5: Agent RAG Retrieval

### Test 5.1: Chat Agent Query

**Objective:** Verify agent can retrieve information from processed documents.

**Steps:**
1. Go to your deal in the UI
2. Navigate to **Chat** tab
3. Ask a question about content in your uploaded document

**Example Questions:**
- "What is the company's revenue?"
- "Summarize the financial highlights"
- "What risks are mentioned in the document?"

**What to Watch:**

**In the Chat UI:**
- Agent should respond with relevant information
- Response should include **source citations**
- Source links should point to your uploaded document

**Pass Criteria:**
- ✅ Agent responds (not "I don't know")
- ✅ Response is relevant to document content
- ✅ Sources cited correctly
- ✅ Source links clickable and navigate to document

**Fail/Debug:**
- ❌ "No information found" → Check if embeddings exist
- ❌ Wrong information → Check chunking quality
- ❌ No sources → Check RAG implementation

---

### Test 5.2: Multi-Turn Conversation

**Objective:** Verify agent maintains context and retrieves across turns.

**Steps:**
1. Ask initial question: "What is the company's revenue?"
2. Follow up: "How does that compare to last year?"
3. Follow up: "What are the main drivers?"

**Expected:**
- Agent maintains context (knows "that" refers to revenue)
- Retrieves relevant information for each question
- Synthesizes across multiple chunks/findings

**Pass Criteria:**
- ✅ Context maintained across turns
- ✅ Relevant retrieval for each question
- ✅ Coherent conversation flow

---

### Test 5.3: Hybrid Search (pgvector + Neo4j)

**Objective:** Verify agent uses BOTH vector search AND relationship traversal.

**Setup:**
Upload two related documents (e.g., Q1 financials, Q2 financials).

**Steps:**
Ask: "What is the revenue trend across quarters?"

**Expected Agent Behavior:**
1. Vector search finds "revenue" mentions in both documents
2. Neo4j traversal finds SUPPORTS or SUPERSEDES relationships
3. Agent synthesizes information from both sources

**What to Check in Response:**
- Does agent mention BOTH documents?
- Does agent identify the trend (increase/decrease)?
- Are sources from multiple documents cited?

**Pass Criteria:**
- ✅ Agent retrieves from multiple documents
- ✅ Identifies relationships (supporting/contradicting)
- ✅ Synthesizes coherent answer

---

## PHASE 6: Error Handling & Edge Cases

### Test 6.1: Unsupported File Type

**Steps:**
1. Try uploading a `.txt` or `.zip` file

**Expected:**
- Upload rejected with error message
- No database record created
- No GCS upload

**Pass Criteria:**
- ✅ Clear error message
- ✅ No partial processing

---

### Test 6.2: Large File Upload

**Steps:**
1. Upload a large PDF (>50MB if possible, or configure lower limit for testing)

**Expected:**
- If over limit: Rejected with size error
- If under limit: Processes normally (but may take longer)

**Pass Criteria:**
- ✅ Size validation works
- ✅ Large files process successfully (within limits)

---

### Test 6.3: Corrupted File

**Steps:**
1. Create a corrupted PDF (e.g., rename a `.txt` to `.pdf`)
2. Try uploading

**Expected:**
- Upload succeeds (file uploaded to GCS)
- Processing fails gracefully
- `processing_status` = `"failed"`
- Error logged

**Pass Criteria:**
- ✅ Doesn't crash the system
- ✅ Status updated to `"failed"`
- ✅ Error message logged

---

### Test 6.4: Processing Service Down

**Steps:**
1. Stop `manda-processing` service (Terminal 2)
2. Try uploading a document

**Expected:**
- Upload succeeds (document saved, file in GCS)
- Webhook call fails (logged in Next.js console)
- Document status remains `"pending"`
- Can be retried later when service is back

**Pass Criteria:**
- ✅ Upload doesn't fail
- ✅ Clear error logged
- ✅ Document can be reprocessed when service restarts

---

## Validation Checklist

After completing all tests, verify:

### Data Integrity
- [ ] All uploaded files appear in GCS
- [ ] All documents have database records
- [ ] All documents have chunks (unless failed)
- [ ] All chunks have embeddings
- [ ] All documents have Neo4j nodes
- [ ] Findings linked to documents

### Performance
- [ ] Upload completes in <30 seconds
- [ ] Processing completes in <2 minutes (for 10-page PDF)
- [ ] Agent query responds in <5 seconds
- [ ] No timeout errors

### Quality
- [ ] Chunk content is accurate (matches PDF)
- [ ] Tables extracted correctly
- [ ] Agent retrieval is relevant
- [ ] Source citations are correct
- [ ] Multi-document queries work

### Error Handling
- [ ] Invalid file types rejected
- [ ] Large files rejected/handled
- [ ] Corrupted files don't crash system
- [ ] Service downtime handled gracefully

---

## Known Issues & Limitations

Based on code review:

### Placeholder Implementations
- ❌ `document-parse.ts` handler - PLACEHOLDER (not used, replaced by Python webhook)
- ❌ `analyze-document.ts` handler - PLACEHOLDER (may or may not be implemented in Python)
- ❌ `generate-embeddings.ts` handler - PLACEHOLDER (may or may not be implemented in Python)

### Critical Questions to Answer During Testing
1. **Where does embedding generation happen?**
   - Is it in `manda-processing` Python service?
   - Or somewhere else?

2. **Where does finding extraction happen?**
   - Is `analyze-document` implemented in Python?
   - Or is this done differently?

3. **Where does Neo4j node creation happen?**
   - In `manda-processing`?
   - Or in Next.js after processing completes?

4. **What triggers these steps?**
   - Is there a Python job queue (Celery, RQ, etc.)?
   - Or does the webhook handler do everything synchronously?

### Things to Watch For
- Processing time: How long for a 10-page PDF?
- Memory usage: Does `manda-processing` handle large files?
- Error recovery: If embeddings fail, can it retry?
- Concurrent uploads: What happens if 10 files are uploaded at once?

---

## Debugging Tools

### Check manda-processing Service Logs
```bash
# In Terminal 2 (where service is running)
# Logs should stream in real-time

# Look for:
# - Webhook received
# - File downloaded from GCS
# - Docling parsing started
# - Chunks created
# - Embeddings generated (if applicable)
# - Processing completed
```

### Check Next.js Logs
```bash
# In Terminal 3
# Look for:
# - Upload API called
# - Document record created
# - Webhook POST to manda-processing
# - Response from webhook
```

### Check Database State
```sql
-- Document processing status
SELECT id, name, upload_status, processing_status, created_at, updated_at
FROM documents
ORDER BY created_at DESC
LIMIT 10;

-- Chunks per document
SELECT document_id, COUNT(*) as chunk_count,
       COUNT(embedding) as embeddings_count
FROM document_chunks
GROUP BY document_id
ORDER BY document_id DESC;

-- Findings per deal
SELECT deal_id, COUNT(*) as finding_count
FROM findings
GROUP BY deal_id;
```

### Check Neo4j State
```cypher
// Node counts
MATCH (n) RETURN labels(n) as type, count(n) as count;

// Relationship counts
MATCH ()-[r]->() RETURN type(r) as relationship, count(r) as count;

// Recent documents
MATCH (d:Document)
RETURN d.id, d.title, d.createdAt
ORDER BY d.createdAt DESC
LIMIT 10;
```

### Check GCS State
```bash
# List all files in bucket
~/google-cloud-sdk/bin/gsutil ls -r gs://manda-documents-dev/

# Check specific file metadata
~/google-cloud-sdk/bin/gsutil stat gs://manda-documents-dev/deals/{deal-id}/{filename}
```

---

## Success Criteria

Document processing pipeline is **VALIDATED** when:

1. ✅ Upload → GCS storage works reliably
2. ✅ Webhook triggers manda-processing
3. ✅ Docling parses PDF/Excel/Word correctly
4. ✅ Chunks created with correct token counts
5. ✅ Embeddings generated and stored in pgvector
6. ✅ Findings extracted and stored
7. ✅ Neo4j nodes and relationships created
8. ✅ Agent RAG retrieves relevant information
9. ✅ Sources cited correctly
10. ✅ Multi-document queries work
11. ✅ Error handling prevents crashes

---

## Next Steps After Validation

If tests PASS:
- Document baseline performance metrics
- Note any quality issues (e.g., table extraction accuracy)
- Move to CIM agent testing (depends on this pipeline)

If tests FAIL:
- Identify failure point (which phase?)
- Check logs for root cause
- Fix implementation gaps
- Re-test

---

## Architecture Clarification: pg-boss Design Pattern

### Why Two Services Share One Queue?

This is a **microservices pattern** where:

**Next.js (TypeScript)**
- Lightweight web framework
- Good for API endpoints, SSR, React
- **Placeholder handlers** exist for future flexibility
- Currently only enqueues jobs (via webhook to Python)

**manda-processing (Python)**
- Heavy data processing (Docling, ML, embeddings)
- Better ecosystem for ML/data tasks
- **Real job handlers** for all processing
- Both enqueues AND processes jobs

**pg-boss (Shared Queue)**
- Single source of truth for job state
- Language-agnostic (uses Postgres)
- TypeScript client uses pg-boss npm library
- Python client uses direct SQL (asyncpg)
- Both read/write the same `pgboss.job` table

### Benefits of This Design

1. **Separation of Concerns**
   - Web layer (Next.js) separate from processing layer (Python)
   - Each service uses its strengths

2. **Scalability**
   - Can scale workers independently
   - Can run multiple Python workers in parallel
   - Next.js handles web traffic, Python handles compute

3. **Technology Flexibility**
   - Use Python where it excels (ML, data processing)
   - Use TypeScript where it excels (web, API)

4. **Future Expansion**
   - Can add TypeScript workers later if needed
   - Can add more Python workers for different job types
   - Shared queue coordinates everything

### When Would You Use Next.js Handlers?

The placeholder handlers in Next.js might be used for:
- Lightweight jobs (e.g., sending emails, webhooks)
- Jobs that need access to Next.js context
- Quick prototyping before moving to Python

**For now:** All real processing happens in Python. This is the correct design.

---

**Prepared by:** Murat (Master Test Architect)
**For:** Max
**Last Updated:** 2025-12-12 (Revised with pg-boss architecture clarification)
