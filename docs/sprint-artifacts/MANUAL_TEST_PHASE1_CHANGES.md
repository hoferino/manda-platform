# Manual Testing Phase 1 - Changes Implemented

**Date**: 2025-12-12
**Session**: Document Processing Pipeline Manual Testing
**Status**: Phases 1-3 Complete, Phase 4 In Progress

## Overview

This document details all changes implemented during manual testing of the document processing pipeline, covering upload, parsing, chunking, and embedding generation.

---

## 1. Database Configuration Changes

### 1.1 Switched from Session Mode to Transaction Mode (Port 6543)

**Issue**: Connection pool exhaustion with 5 concurrent worker poll loops accessing Session mode pooler (port 5432).

**Error**:
```
MaxClientsInSessionMode: max clients reached - in Session mode max clients are limited to pool_size
```

**Changes Made**:

#### File: `manda-processing/.env`
```bash
# Changed from Session mode (port 5432) to Transaction mode (port 6543)
DATABASE_URL=postgresql://postgres.cymfyqussypehaeebedn:75bBluzEVtPAY9CG@aws-1-eu-west-3.pooler.supabase.com:6543/postgres
```

#### File: `manda-app/.env.local`
```bash
# Updated to match Python's Transaction mode
DATABASE_URL=postgresql://postgres.cymfyqussypehaeebedn:75bBluzEVtPAY9CG@aws-1-eu-west-3.pooler.supabase.com:6543/postgres
```

#### File: `manda-processing/src/db/pool.py`
**Lines**: 30-40

**Change**: Added `statement_cache_size=0` for pgbouncer Transaction mode compatibility
```python
async def create_pool() -> asyncpg.Pool:
    """Create the database connection pool."""
    global _pool
    if _pool is None:
        settings = get_settings()
        _pool = await asyncpg.create_pool(
            settings.database_url,
            min_size=5,
            max_size=20,
            statement_cache_size=0,  # Required for Supabase Transaction mode (pgbouncer)
        )
        logger.info("Database pool created")
    return _pool
```

**Result**: ✅ All 5 worker poll loops running without connection errors

---

## 2. pg-boss Queue Schema Fixes

### 2.1 Fixed `expire_in` → `expire_seconds` Column Name Mismatch

**Issue**: Python code using pg-boss v9 column name (`expire_in` with interval type) but actual schema uses pg-boss v10 (`expire_seconds` with integer type).

**Error**:
```
asyncpg.exceptions.UndefinedColumnError: column "expire_in" of relation "job" does not exist
```

**Changes Made**:

#### File: `manda-processing/src/jobs/queue.py`
**Lines**: 159-189

**Before**:
```python
# Line 160
expire_in = f"{options.expire_in_seconds} seconds"

# Line 169
expire_in, start_after, singleton_key,

# Line 174
$8::interval, $9, $10,
```

**After**:
```python
# Line 160
expire_seconds = options.expire_in_seconds

# Line 169
expire_seconds, start_after, singleton_key,

# Line 174
$8, $9, $10,  # Changed from interval cast to integer
```

**Result**: ✅ Jobs enqueue successfully without column errors

---

### 2.2 Implemented Queue Auto-Registration

**Issue**: pg-boss requires queue names to be registered in `queue` table before jobs can be enqueued. TypeScript pg-boss library auto-registers queues, but Python implementation didn't.

**Error**:
```
ForeignKeyViolationError: insert or update on table "job_common" violates foreign key constraint "q_fkey"
DETAIL: Key (name)=(document-parse) is not present in table "queue"
```

**Changes Made**:

#### File: `manda-processing/src/jobs/queue.py`
**Lines**: 106-132

**Added `ensure_queue()` method**:
```python
async def ensure_queue(self, name: str) -> None:
    """
    Ensure a queue is registered in pg-boss.

    Args:
        name: Queue name to register
    """
    async with self._pool.acquire() as conn:
        await conn.execute(
            f"""
            INSERT INTO {self._schema}.queue (
                name, policy, retry_limit, retry_delay, retry_backoff,
                expire_seconds, retention_seconds, deletion_seconds,
                partition, table_name, created_on, updated_on
            )
            VALUES (
                $1, 'standard', 3, 30, true,
                300, 86400, 172800,
                false, 'job', NOW(), NOW()
            )
            ON CONFLICT (name) DO NOTHING
            """,
            name,
        )
```

**Lines**: 154-155

**Modified `enqueue()` to call `ensure_queue()`**:
```python
# Ensure the queue is registered
await self.ensure_queue(name)
```

**Result**: ✅ Queues auto-register on first job enqueue

---

## 3. Python Module Caching Resolution

### 3.1 Cleared Python Bytecode Cache

**Issue**: Worker processes were loading old cached code from `__pycache__` directories even after code changes and process restarts.

**Symptom**: Fixed code still showing `expire_in` errors despite correct `expire_seconds` in source files.

**Solution**:
```bash
# Clear all __pycache__ directories
find src -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null

# Force kill all Python processes
pkill -9 python3

# Restart worker with fresh imports
python3 -m src.jobs > worker.log 2>&1 &
```

**Result**: ✅ Worker now loads current code properly

---

## 4. Dependency Installations

### 4.1 Installed Docling (Document Parsing ML Library)

**Command**:
```bash
cd manda-processing
pip3 install docling
```

**Dependencies Installed**:
- PyTorch (74.4 MB)
- transformers (12 MB)
- docling core packages
- ~50+ additional packages (~150 MB total)

**Result**: ✅ PDF parsing with ML-based layout detection working

---

### 4.2 Installed OpenAI Python SDK

**Issue**: Embedding generation job failed with `No module named 'openai'`

**Command**:
```bash
pip3 install openai
```

**Dependencies Installed**:
- openai-2.11.0
- distro-1.9.0
- jiter-0.12.0

**Result**: ✅ OpenAI embeddings generation working

---

## 5. Testing Results

### Phase 1: Upload & GCS Storage ✅ PASSED
- File upload from Next.js UI → webhook → job enqueue → GCS storage
- Downloaded 77,865 bytes successfully
- No `expire_in` errors
- Queue auto-registration working

### Phase 2: Docling Parsing & Chunking ✅ PASSED
- Document parsed in 13.77 seconds
- 1 chunk created (867 tokens)
- Chunks stored in `document_chunks` table
- Document status updated to `parsed`

### Phase 3: Embedding Generation ✅ PASSED
- OpenAI client initialized (text-embedding-3-large, 3072 dimensions)
- Embeddings generated successfully
- API call: 867 tokens, $0.000113 cost
- Embeddings stored in `document_chunks.embedding` column
- Document status updated to `embedded`

### Phase 4: Document Analysis ⚠️ FAILED
- analyze-document job failed: `Google API key not configured`
- **Expected**: Gemini API not configured yet
- **Not blocking**: Analysis is optional for Phase 1 testing

---

## 6. Identified Issues (Not Yet Resolved)

### 6.1 SQL Typo in processing.py
**File**: `manda-processing/src/api/routes/processing.py`
**Lines**: 174, 186, 226, 228

**Error**: `column j.createdon does not exist`
**Fix Needed**: Change `createdon` to `created_on`

**Status**: ⚠️ Not fixed yet - does not block current testing

---

### 6.2 Documents Not Showing in Data Room UI
**Symptom**: Documents successfully uploaded, parsed, and embedded but not visible in Next.js data room UI

**Root Cause**: Browser cache / page needed refresh

**Resolution**: ✅ Documents now showing correctly after page refresh
- Supabase Realtime subscription working
- Documents appear immediately after upload
- Processing status updates in real-time
- Manual refresh button functional

**Status**: ✅ RESOLVED

---

## 7. Service Configuration

### Services Running:
1. **Neo4j**: `docker run neo4j` (port 7687)
2. **FastAPI**: `python3 -m uvicorn src.main:app --port 8000` (manda-processing)
3. **Worker**: `python3 -m src.jobs` (manda-processing)
4. **Next.js**: `npm run dev` (port 3000, manda-app)

### Configuration Files Updated:
- `manda-processing/.env` - DATABASE_URL port changed
- `manda-app/.env.local` - DATABASE_URL port changed
- `manda-processing/src/db/pool.py` - Added statement_cache_size=0
- `manda-processing/src/jobs/queue.py` - Fixed expire_seconds, added ensure_queue()

---

## 8. Key Learnings

1. **Python Module Caching**: Clearing `__pycache__` is essential when debugging code changes
2. **Supabase Connection Modes**: Transaction mode (port 6543) required for high-concurrency workers
3. **pg-boss Version Differences**: v9 vs v10 have different column schemas
4. **Queue Registration**: Python pg-boss implementation requires manual queue registration

---

## Next Steps

1. ✅ **Complete**: Basic document processing pipeline (upload → parse → chunk → embed)
2. 🔄 **In Progress**: Investigate data room UI display issue
3. ⏳ **Pending**: Add Google API key for document analysis
4. ⏳ **Pending**: Test Neo4j knowledge graph integration
5. ⏳ **Pending**: Test RAG retrieval performance

---

## Document ID for Testing
- **Latest Successful Upload**: `62e8db01-b272-4fb4-9a24-a33d42c47802`
- **Status**: `embedded`
- **Chunks**: 1 chunk, 867 tokens
- **File**: `brainstorming-session-results.pdf` (77,865 bytes)
