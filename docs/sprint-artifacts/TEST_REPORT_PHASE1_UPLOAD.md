# Test Report: Phase 1 - Upload & GCS Storage

**Test Date:** 2025-12-12 17:19 CET
**Tester:** Murat (TEA Agent - Master Test Architect)
**Test Subject:** Document upload flow with webhook → pg-boss → worker
**Status:** ❌ FAILED - Schema Mismatch

---

## Test Execution Summary

### What Was Tested
- User uploaded a PDF file through Next.js UI
- Expected: File → GCS → Next.js webhook → Python FastAPI → pg-boss job → worker processes

### What Actually Happened
1. ✅ File uploaded successfully to Next.js
2. ✅ Next.js POST webhook to Python FastAPI (`POST /webhooks/document-uploaded`)
3. ❌ **Python failed to enqueue job** - Schema mismatch error
4. ❌ Worker never received job (nothing to process)
5. ❌ API queue queries also failing (separate typo)

---

## Critical Errors Found

### Error 1: Missing Column `expire_in`

**Location:** [manda-processing/src/jobs/queue.py:136-148](../../../manda-processing/src/jobs/queue.py#L136-L148)

**Error Message:**
```
asyncpg.exceptions.UndefinedColumnError: column "expire_in" of relation "job" does not exist
```

**Stack Trace:**
```python
File "manda-processing/src/jobs/queue.py", line 136, in enqueue
    await conn.execute(
        f"""
        INSERT INTO {self._schema}.job (
            id, name, data, priority,
            retry_limit, retry_delay, retry_backoff,
            expire_in, start_after, singleton_key,  # <-- expire_in doesn't exist!
            state, created_on
        ) VALUES (...)
        """
    )
```

**Root Cause:**
The Python code is trying to manually construct SQL INSERT statements assuming a custom schema, but pg-boss (the npm library used by Next.js) creates its own schema with different column names.

**Impact:** ❌ **BLOCKING** - Document processing completely broken

---

### Error 2: Column Name Typo `createdon` vs `created_on`

**Location:** [manda-processing/src/api/routes/processing.py:174](../../../manda-processing/src/api/routes/processing.py#L174)

**Error Message:**
```
column j.createdon does not exist
HINT: Perhaps you meant to reference the column "j.created_on"
```

**SQL Query:**
```python
SELECT
    j.id,
    j.name,
    j.state,
    j.data,
    j.createdon,  # <-- TYPO! Should be j.created_on
    j.startedon,  # <-- Likely also wrong
    j.retry_count
FROM pgboss.job j
```

**Impact:** ❌ **BLOCKING** - Queue visibility API broken (500 errors)

---

## Affected Files

### Files with Schema Issues:
1. `manda-processing/src/jobs/queue.py` - Lines 136-160 (enqueue method)
2. `manda-processing/src/api/routes/processing.py` - Lines 174, 186, 226, 228 (queue query)
3. `manda-processing/tests/unit/test_api/test_processing.py` - Mock data with wrong column names

---

## Root Cause Analysis

### The Problem: Manual SQL vs pg-boss Schema

**What We Assumed:**
- Python code could manually INSERT into pg-boss tables
- Column names would match our custom naming (`expire_in`, `start_after`, etc.)

**What Actually Exists:**
- pg-boss npm library (v11.x) creates its own schema automatically
- Column names follow pg-boss conventions (need to verify exact names)
- Schema is managed by the library, not by our code

**Architecture Issue:**
The Python service is trying to directly manipulate pg-boss tables with raw SQL, but the schema was created by the TypeScript pg-boss library which may use different conventions.

---

## Next Steps - Recommended Fixes

### Option 1: Query Actual pg-boss Schema ✅ RECOMMENDED
1. Connect to Supabase and inspect actual column names in `pgboss.job` table
2. Update Python code to match exact schema
3. Fix all column name references (`createdon` → `created_on`, etc.)

### Option 2: Use pg-boss Library on Python Side
1. Find Python pg-boss client library (if exists)
2. Replace manual SQL with library calls
3. Ensures schema compatibility

### Option 3: Redesign - Use pg-boss Only from Next.js
1. Move job enqueuing to Next.js (TypeScript)
2. Python workers only dequeue and process
3. Reduces schema mismatch risk

---

## Immediate Actions Required

1. **Inspect pg-boss Schema**
   ```sql
   -- Run in Supabase SQL Editor
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_schema = 'pgboss'
   AND table_name = 'job'
   ORDER BY ordinal_position;
   ```

2. **Fix queue.py Enqueue Method**
   - Remove `expire_in` column (doesn't exist)
   - Use correct column names
   - Match pg-boss v11 schema exactly

3. **Fix processing.py API Query**
   - Change `j.createdon` → `j.created_on`
   - Change `j.startedon` → `j.started_on`
   - Verify all other column names

4. **Update Tests**
   - Fix mock data in test files
   - Match real schema

---

## Test Evidence

### FastAPI Logs (Error Output)
```
[2025-12-12T16:19:34.799761Z] [error] Failed to enqueue document parse job
document_id=0f484344-dfa5-47cf-82b0-d1b6f5d1abc7
error='column "expire_in" of relation "job" does not exist'

Traceback:
  File "src/jobs/queue.py", line 136, in enqueue
    await conn.execute(...)
  asyncpg.exceptions.UndefinedColumnError: column "expire_in" of relation "job" does not exist
```

### Next.js Logs (Webhook Error)
```
Processing webhook failed: {
  status: 500,
  error: {
    detail: 'Failed to enqueue parsing job: column "expire_in" of relation "job" does not exist'
  },
  documentId: '0f484344-dfa5-47cf-82b0-d1b6f5d1abc7'
}
```

### API Queue Errors (Repeated)
```
[error] Error fetching queue jobs
error='column j.createdon does not exist
HINT:  Perhaps you meant to reference the column "j.created_on".'
project_id=863d2224-4f3a-45df-af22-f1068211fdc8
```

---

## Recommendations

### Priority 1: Schema Discovery
Before making code changes, we MUST know the exact pg-boss schema. The pg-boss v11 library creates tables automatically but we need to see what it actually created.

### Priority 2: Fix Schema Mismatches
Once schema is known, update Python code to match exactly.

### Priority 3: Add Schema Validation
Consider adding runtime schema validation to catch these issues early in development.

---

## Testing Status

| Phase | Test | Status | Notes |
|-------|------|--------|-------|
| **Phase 1** | **Upload & GCS Storage** | ❌ **FAILED** | Schema mismatch blocking |
| Phase 1.1 | File upload to Next.js | ✅ PASSED | Upload succeeded |
| Phase 1.2 | GCS storage | ⚠️ UNKNOWN | Likely succeeded but not verified |
| Phase 1.3 | Webhook trigger | ✅ PASSED | Webhook reached FastAPI |
| Phase 1.4 | Job enqueue | ❌ FAILED | Schema error |
| Phase 1.5 | Worker processing | ❌ BLOCKED | No job to process |
| Phase 2 | Docling Parsing | ⏸️ BLOCKED | Can't test until Phase 1 passes |
| Phase 3 | Embeddings | ⏸️ BLOCKED | Can't test until Phase 1 passes |
| Phase 4 | Neo4j Graph | ⏸️ BLOCKED | Can't test until Phase 1 passes |
| Phase 5 | RAG Retrieval | ⏸️ BLOCKED | Can't test until Phase 1 passes |

---

## Document ID for Debugging

**Uploaded Document:**
- Document ID: `0f484344-dfa5-47cf-82b0-d1b6f5d1abc7`
- Deal/Project ID: `863d2224-4f3a-45df-af22-f1068211fdc8`

This document should exist in Supabase `documents` table and GCS bucket (if upload completed).

---

**Report Prepared By:** Murat (Master Test Architect)
**For:** Max
**Next Action:** Inspect pg-boss schema and fix Python code to match
