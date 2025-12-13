# Manda Platform - Testing & Operations Guide

**Document Status:** Active Reference
**Consolidated:** 2025-12-13
**Last Testing Session:** 2025-12-12
**Owner:** Max

---

## Executive Summary

This document consolidates all testing documentation, service configuration, and operational procedures for the Manda Platform. It serves as the single source of truth for running, testing, and debugging the document processing pipeline.

---

## Table of Contents

1. [Environment Setup](#1-environment-setup)
2. [Service Configuration](#2-service-configuration)
3. [Document Processing Pipeline](#3-document-processing-pipeline)
4. [Testing Procedures](#4-testing-procedures)
5. [Troubleshooting](#5-troubleshooting)
6. [Test Results Summary](#6-test-results-summary)

---

## 1. Environment Setup

### Prerequisites

- Node.js 18+
- Python 3.11+ (tested with 3.14)
- Docker Desktop
- Access to Supabase project
- Google Cloud Storage configured
- API keys: OpenAI, Google Gemini

### Required Services

| Service | Port | Purpose | How to Start |
|---------|------|---------|--------------|
| **Neo4j** | 7474/7687 | Knowledge graph | `docker-compose -f docker-compose.dev.yml up -d` |
| **FastAPI** | 8000 | Webhook receiver, job enqueuer | `cd manda-processing && python3 -m uvicorn src.main:app --port 8000` |
| **Worker** | - | Job processor | `cd manda-processing && python3 -m src.jobs` |
| **Next.js** | 3000 | Web UI | `cd manda-app && npm run dev` |

### Environment Variables

#### manda-processing/.env
```bash
# Database (Transaction mode for concurrent workers)
DATABASE_URL=postgresql://...@aws-1-eu-west-3.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://[project].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Security
API_KEY=[your-api-key]

# Google Cloud Storage
GCS_BUCKET=manda-documents-dev
GCS_PROJECT_ID=manda-platform
GOOGLE_APPLICATION_CREDENTIALS=/path/to/manda-storage-key.json

# OpenAI Embeddings
OPENAI_API_KEY=sk-proj-...
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIMENSIONS=3072

# Google Gemini
GOOGLE_API_KEY=AIzaSy...
LLM_MODEL=gemini-2.5-flash

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=mandadev123
```

#### manda-app/.env.local
```bash
# Database (must match processing service)
DATABASE_URL=postgresql://...@aws-1-eu-west-3.pooler.supabase.com:6543/postgres
```

---

## 2. Service Configuration

### Database Connection

**Critical**: Use **Transaction mode (port 6543)**, not Session mode (port 5432).

- Session mode has connection limits (pool_size = max clients)
- Transaction mode allows many concurrent connections
- Required for 5 concurrent worker poll loops

**Pool Configuration** (`manda-processing/src/db/pool.py`):
```python
_pool = await asyncpg.create_pool(
    settings.database_url,
    min_size=5,
    max_size=20,
    statement_cache_size=0,  # Required for pgbouncer Transaction mode
)
```

### pg-boss Job Queue

The platform uses pg-boss as a shared queue between Next.js and Python:

```
Next.js (TypeScript)           Python Workers
      │                              │
      ├─► Enqueue jobs (webhook) ◄───┤ Dequeue & process
      │                              │
      └──────────────────────────────┘
           SHARED pg-boss QUEUE
         (Postgres tables in Supabase)
```

**Job Types**:
| Job Name | Batch Size | Interval | Purpose |
|----------|------------|----------|---------|
| `document-parse` | 3 | 5s | Docling ML parsing |
| `generate-embeddings` | 5 | 2s | OpenAI embeddings |
| `analyze-document` | 3 | 5s | Gemini analysis |
| `extract-financials` | 3 | 5s | Financial extraction |

### Neo4j Knowledge Graph

**Role**: Stores finding relationships and enables graph queries for contradiction detection.

**Current Status**: Configured and running, but sync from PostgreSQL not yet implemented (planned for Epic 4).

**Access**:
- Browser: http://localhost:7474
- Bolt: bolt://localhost:7687
- Credentials: neo4j / mandadev123

---

## 3. Document Processing Pipeline

### Complete Flow

```
1. Upload Document (User)
   ↓
2. Next.js /api/documents/upload
   ├─ Upload to GCS
   ├─ Create document record (upload_status: 'completed', processing_status: 'pending')
   ├─ Return to client (document visible immediately)
   └─ POST webhook to manda-processing
       ↓
3. Worker: document-parse job (~14s)
   ├─ Download from GCS
   ├─ Docling ML parsing (StandardPdfPipeline, MPS accelerator)
   ├─ Text chunking with token counting
   └─ Store chunks (processing_status: 'parsed')
       ↓
4. Worker: generate-embeddings job (~2s)
   ├─ OpenAI text-embedding-3-large (3072 dimensions)
   ├─ Batch processing (100 chunks per batch)
   └─ Store in pgvector (processing_status: 'embedded')
       ↓
5. Worker: analyze-document job (~5-10s)
   ├─ Google Gemini 2.5 Flash
   ├─ Extract structured findings
   └─ Store findings (processing_status: 'analyzed')
       ↓
6. Worker: extract-financials job (if applicable)
   └─ Financial data extraction
```

### Key Design Principles

1. **Immediate Document Visibility**: Documents appear in UI within 2 seconds of upload
2. **Non-Blocking Processing**: Users can interact with documents while processing continues
3. **Real-time Updates**: Processing status updates via Supabase Realtime WebSocket
4. **Graceful Degradation**: Failed analysis doesn't prevent document access

### Performance Metrics

| Stage | Time | Notes |
|-------|------|-------|
| Upload | ~2s | File to GCS + DB record |
| Time to UI Visibility | <2s | Immediate after upload |
| Document Parsing | ~14s | Docling ML processing |
| Embedding Generation | ~1.6s | OpenAI API call |
| Analysis (Gemini) | ~5-10s | Depends on document size |
| **Total Processing** | ~23-28s | Complete pipeline |

### Cost Estimates

| Component | Cost | Notes |
|-----------|------|-------|
| OpenAI Embeddings | $0.13/1M tokens | text-embedding-3-large |
| Gemini 2.5 Flash | $0.30 input + $2.50 output/1M tokens | Analysis |
| GCS Storage | ~$0.02/GB/month | Pay as you go |
| Neo4j | $0 | Self-hosted Community Edition |

---

## 4. Testing Procedures

### Quick Health Check

```bash
# FastAPI
curl http://localhost:8000/health

# Next.js
curl -s http://localhost:3000 | grep -i title

# Neo4j
docker exec neo4j cypher-shell -u neo4j -p mandadev123 "RETURN 'healthy'"
```

### User Journey Tests

#### Journey 1: Deal Setup & IRL Foundation (E1, E6)
- [ ] Login successfully
- [ ] Create new deal with name and description
- [ ] Create IRL for the deal
- [ ] Add IRL items (document requests)
- [ ] AI suggests IRL items based on deal type
- [ ] Upload document and link to IRL item
- [ ] Progress bar updates correctly

#### Journey 2: Document Processing (E2, E3)
- [ ] Upload document to data room
- [ ] Document appears immediately in UI
- [ ] Processing status badge updates in real-time
- [ ] Document preview available
- [ ] Chunks visible in database after parsing

#### Journey 3: Knowledge Exploration (E4)
- [ ] View findings in Knowledge Explorer
- [ ] Filter findings by category
- [ ] Validate/reject findings
- [ ] View contradictions (when detected)

#### Journey 4: Chat Interface (E5)
- [ ] Send message to chat
- [ ] Agent responds with sources
- [ ] Source citations clickable
- [ ] Follow-up questions work

### Database Verification Queries

```sql
-- Queue summary
SELECT name, state, COUNT(*) as count
FROM pgboss.job
GROUP BY name, state
ORDER BY name, state;

-- Recent jobs
SELECT id, name, state, retry_count, created_on, started_on, completed_on
FROM pgboss.job
ORDER BY created_on DESC
LIMIT 10;

-- Document status
SELECT id, name, processing_status, upload_status, created_at
FROM documents
ORDER BY created_at DESC
LIMIT 10;

-- Findings
SELECT id, document_id, finding_type, content, confidence_score
FROM findings
ORDER BY created_at DESC
LIMIT 10;

-- Chunks
SELECT document_id, COUNT(*) as chunks, SUM(token_count) as total_tokens
FROM document_chunks
GROUP BY document_id;
```

### Neo4j Verification Queries

```cypher
-- All nodes
MATCH (n) RETURN labels(n), count(*);

-- All relationships
MATCH ()-[r]->() RETURN type(r), count(*);

-- Findings
MATCH (f:Finding)
RETURN f.id, f.type, f.content, f.confidence
ORDER BY f.created_at DESC
LIMIT 10;
```

---

## 5. Troubleshooting

### Issue: Connection Pool Exhaustion

**Error**: `MaxClientsInSessionMode: max clients reached`

**Solution**:
1. Switch to Transaction mode (port 6543)
2. Add `statement_cache_size=0` to pool config
3. Restart all services

### Issue: pg-boss Column Mismatch

**Error**: `column "expire_in" of relation "job" does not exist`

**Cause**: pg-boss v9 vs v10 schema differences

**Solution**: Use `expire_seconds` (integer) instead of `expire_in` (interval)

### Issue: Queue Foreign Key Violation

**Error**: `Key (name)=(document-parse) is not present in table "queue"`

**Solution**: Queue auto-registration implemented - ensure `ensure_queue()` is called before enqueue

### Issue: Python Module Caching

**Symptom**: Code changes not taking effect after restart

**Solution**:
```bash
# Clear Python cache
find src -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null

# Force kill all Python processes
pkill -9 python3

# Restart worker
python3 -m src.jobs > worker.log 2>&1 &
```

### Issue: Environment Variables Not Loading

**Symptom**: Validation errors for required settings

**Solution**:
1. Kill all Python processes
2. Clear `__pycache__`
3. Verify `.env` file exists and is readable
4. Restart services fresh

### Issue: LangChain Dependency Missing

**Error**: `ModuleNotFoundError: No module named 'langchain_core'`

**Solution**:
```bash
pip3 install langchain-core langchain-google-genai
```

---

## 6. Test Results Summary

### Testing Session: 2025-12-12

**Phases Tested**:
- Phase 1: Upload & GCS Storage
- Phase 2: Docling Parsing & Chunking
- Phase 3: Embedding Generation
- Phase 4: Gemini Analysis (setup complete, ready for testing)

**Results**:

| Phase | Status | Notes |
|-------|--------|-------|
| Upload | PASSED | 77,865 bytes uploaded in ~2s |
| GCS Storage | PASSED | File stored at correct path |
| Webhook | PASSED | POST to processing service <100ms |
| Job Enqueue | PASSED | pg-boss queue working |
| Parsing | PASSED | Docling ML in 13.77s |
| Chunking | PASSED | 1 chunk, 867 tokens |
| Embeddings | PASSED | 3072 dimensions, $0.000113 cost |
| UI Visibility | PASSED | Immediate after upload |
| Real-time Updates | PASSED | WebSocket <500ms latency |

**Issues Fixed**:
1. Database connection pool exhaustion → Transaction mode
2. pg-boss schema mismatch → expire_seconds
3. Queue registration missing → auto-registration
4. Python module caching → cache clearing
5. Missing dependencies → installed docling, openai, langchain

**Production Readiness Assessment**:
- Architecture: Production-ready
- Error Handling: Graceful degradation
- Performance: Acceptable for MVP (<20s total)
- Scalability: Queue-based with horizontal scaling potential
- UX: Immediate visibility, real-time updates

---

## Appendix A: Dependencies

### Python (manda-processing)

| Package | Version | Purpose |
|---------|---------|---------|
| docling | Latest | ML-based PDF parsing |
| openai | 2.11.0 | Embeddings API |
| langchain-core | 1.2.0 | Message abstractions |
| langchain-google-genai | 4.0.0 | Gemini integration |
| google-genai | 1.55.0 | Google AI SDK |
| asyncpg | Latest | PostgreSQL async driver |
| google-cloud-storage | Latest | GCS file storage |
| neo4j | Latest | Knowledge graph driver |

### Node.js (manda-app)

See `package.json` for complete list.

---

## Appendix B: File Locations

**Python Processing Service**:
- `manda-processing/src/api/routes/webhooks.py` - Webhook receiver
- `manda-processing/src/jobs/queue.py` - JobQueue class
- `manda-processing/src/jobs/worker.py` - Worker process
- `manda-processing/src/jobs/handlers/` - Job handlers
- `manda-processing/src/db/pool.py` - Database pool config

**Next.js App**:
- `manda-app/app/api/documents/upload/route.ts` - Upload API
- `manda-app/lib/pgboss/handlers/` - Placeholder handlers (future)

**Configuration**:
- `manda-processing/.env` - Python environment
- `manda-app/.env.local` - Next.js environment
- `manda-app/docker-compose.dev.yml` - Docker services

---

*Consolidated from: MANUAL_TEST_COMPLETE_SUMMARY.md, MANUAL_TEST_PHASE1_CHANGES.md, SERVICES_RUNNING.md, LANGCHAIN_DEPENDENCY_FIXED.md, NEO4J_ARCHITECTURE_EXPLAINED.md, architecture-clarification-pgboss.md, PHASE4_GEMINI_SETUP_COMPLETE.md, PHASE4_GEMINI_TEST_COMPLETE.md, PHASE4_NEO4J_PGVECTOR_TEST_PLAN.md, TEST_REPORT_PHASE1_UPLOAD.md, manual-testing-guide-document-processing.md, testing-sprint-plan.md*
