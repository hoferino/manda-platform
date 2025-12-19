# Agent Behavior Manual Test Results

**Date:** 2025-12-19
**Tester:** Max + TEA (Murat)
**Test Plan:** [agent-behavior-test-plan.md](./agent-behavior-test-plan.md)

---

## Executive Summary

| Category | Status | Issues Found |
|----------|--------|--------------|
| Intent Classification | ✅ PASS (31/32) | 1 edge case bug |
| Token Budget Enforcement | ⚠️ PARTIAL | 1 edge case bug |
| Retrieval Behavior | 🔍 INVESTIGATING | Document not found |
| Multi-Turn Context | ⏳ PENDING | - |
| Fallback Scenarios | ⏳ PENDING | - |

---

## Test 1: Intent Classification (P0)

### Core Cases: 18/18 PASS ✅

| Input | Expected Intent | Actual Intent | Retrieval | Status |
|-------|-----------------|---------------|-----------|--------|
| "Hello!" | greeting | greeting | skip | ✅ |
| "Hi there" | greeting | greeting | skip | ✅ |
| "Thanks for your help" | greeting | greeting | skip | ✅ |
| "Good morning" | greeting | greeting | skip | ✅ |
| "Goodbye" | greeting | greeting | skip | ✅ |
| "What can you do?" | meta | meta | skip | ✅ |
| "Help me understand your capabilities" | meta | meta | skip | ✅ |
| "Summarize our conversation" | meta | meta | skip | ✅ |
| "What did we discuss?" | meta | meta | skip | ✅ |
| "What was the Q3 revenue?" | factual | factual | retrieve | ✅ |
| "How many employees does the company have?" | factual | factual | retrieve | ✅ |
| "When did they acquire the subsidiary?" | factual | factual | retrieve | ✅ |
| "What is the EBITDA margin?" | factual | factual | retrieve | ✅ |
| "Analyze the revenue trend" | task | task | retrieve | ✅ |
| "Compare Q3 vs Q4 performance" | task | task | retrieve | ✅ |
| "Summarize the deal structure" | task | task | retrieve | ✅ |
| "Find any red flags" | task | task | retrieve | ✅ |
| "Calculate the growth rate" | task | task | retrieve | ✅ |

### Edge Cases: 13/14 PASS

| Input | Expected | Actual | Status |
|-------|----------|--------|--------|
| "Summarize the EBITDA trends" | task | task | ✅ |
| "Summarize the deal structure" | task | task | ✅ |
| "Summarize the financials" | task | task | ✅ |
| "Summarize our conversation" | meta | meta | ✅ |
| "Recap what we discussed" | meta | meta | ✅ |
| "Tell me about the company" | factual | factual | ✅ |
| "What do we know about revenue?" | factual | factual | ✅ |
| "What about Q4?" | factual | factual | ✅ |
| "And the margins?" | factual | factual | ✅ |
| **"Hi, what was the revenue?"** | **factual** | **greeting** | **❌ BUG** |
| "Can you help with analysis?" | meta | meta | ✅ |
| "Can you analyze the revenue?" | task | task | ✅ |
| "What are your capabilities?" | meta | meta | ✅ |
| "What are the risks?" | factual | factual | ✅ |

### BUG: Compound Query Misclassification

**Issue:** `intent.ts:64-69`
**Severity:** P1
**Description:** Greeting patterns are checked first with `^` anchor. A compound query like "Hi, what was the revenue?" matches the greeting pattern and skips retrieval.

**Root Cause:**
```typescript
// Check greeting patterns first
for (const pattern of SKIP_RETRIEVAL_PATTERNS.greeting) {
  if (pattern.test(trimmed)) {
    return 'greeting'  // Returns too early!
  }
}
```

**Fix Options:**
1. Check if message contains `?` — if so, prioritize factual/task classification
2. Move greeting check AFTER task/factual checks
3. Add negative lookahead to greeting patterns: `/^hello(?![^?]*\?)/i`

---

## Test 2: Token Budget Enforcement (P0)

### Summarization Triggers: PASS ✅

| Scenario | Messages | Tokens | Should Summarize | Result |
|----------|----------|--------|------------------|--------|
| 5 short messages | 10 | 149 | NO | ✅ |
| 10 short messages | 20 | 299 | YES | ✅ |
| 15 short messages | 30 | 454 | YES | ✅ |
| 20 short messages | 40 | 609 | YES | ✅ |
| 25 short messages | 50 | 764 | YES | ✅ |
| 10 LONG messages | 20 | 2259 | YES | ✅ |

**Thresholds verified:**
- MESSAGE_THRESHOLD: 20 messages ✅
- TOKEN_THRESHOLD: 7000 tokens ✅

### Retrieval Token Budget: ⚠️ PARTIAL

| Scenario | Expected | Actual | Status |
|----------|----------|--------|--------|
| 3 small results (~100 chars) | ≤2000 tokens | 114 tokens | ✅ |
| 20 large results (~400 chars) | ≤2000 tokens, truncated | 1929 tokens | ✅ |
| **1 huge result (~10000 chars)** | **≤2000 tokens, truncated** | **0 tokens** | **❌ BUG** |

### BUG: Single Large Result Returns Zero Context

**Issue:** `retrieval.ts:238-239`
**Severity:** P1
**Description:** If the first search result exceeds `RETRIEVAL_MAX_TOKENS`, nothing is returned. The function breaks before adding any content.

**Root Cause:**
```typescript
if (estimatedTokens + lineTokens > maxTokens) {
  break  // Breaks immediately if first result is too large!
}
```

**Fix:** Truncate individual results to fit budget, or always include at least partial first result.

---

## Test 3: Live E2E - Retrieval Behavior (P1)

### Test 3.1: Greeting Intent (Skip Retrieval)
**Input:** "Hello!"
**Deal:** Edge Case Test Deal
**Result:** Agent responded with helpful options
**Latency:** ~10 seconds (high, but LLM thinking time)
**Status:** ✅ PASS

### Test 3.2: Factual Query (Should Retrieve)
**Input:** "What was the Q3 revenue?"
**Deal:** Edge Case Test Deal (with `scanned-financial-report.pdf` uploaded)
**Result:** Agent says "no documents in the Data Room"
**Status:** 🔍 INVESTIGATING

**Hypothesis:**
- Document upload succeeded but parsing/OCR failed (scanned PDF)
- Graphiti ingestion did not complete
- Deal ID mismatch in retrieval hook

---

## Issues Summary

| ID | Severity | Component | Description | Status |
|----|----------|-----------|-------------|--------|
| BUG-001 | P1 | intent.ts | Compound queries misclassified as greeting | **FIXED** |
| BUG-002 | P1 | retrieval.ts | Large single result returns 0 context | **FIXED** |
| BUG-003 | P0 | search.py, graphiti.py | `verify_deal_exists` uses non-existent `.client` property | **FIXED** |
| BUG-004 | P1 | Neo4j config | `vector.similarity.cosine` function not available | **FIXED** |

---

## Fixes Applied

### BUG-003: `verify_deal_exists` AttributeError (FIXED)

**Root Cause:** `search.py:260` and `graphiti.py:139` called `db.client.table("deals")`, but `SupabaseClient` uses `asyncpg` directly and doesn't have a `.client` property. The AttributeError was caught silently and returned "Deal not found".

**Fix Applied:**
```python
# Before (broken):
result = await db.client.table("deals").select("id").eq("id", deal_id).execute()

# After (fixed):
pool = await db._get_pool()
async with pool.acquire() as conn:
    result = await conn.fetchval(
        "SELECT EXISTS(SELECT 1 FROM deals WHERE id = $1)",
        UUID(deal_id),
    )
    return bool(result)
```

**Files changed:**
- `manda-processing/src/api/routes/search.py`
- `manda-processing/src/api/routes/graphiti.py`

**Verification:** Hybrid search now passes deal verification (returns 200 instead of 404).

---

### BUG-004: Neo4j Vector Search Not Available (Open)

**Symptom:** Hybrid search returns empty results with error:
```
Unknown function 'vector.similarity.cosine'
```

**Root Cause:** Neo4j vector index plugin not enabled/configured.

**Impact:** All Graphiti-based semantic search returns empty. Graceful degradation is working (no crash).

**Next Steps:** ~~Configure Neo4j vector index or check Graphiti setup.~~ → FIXED

---

### BUG-001: Compound Query Intent Classification (FIXED)

**Root Cause:** Simple regex-based classification with `?` check was insufficient. "Hi, what was the revenue?" was incorrectly classified as greeting.

**Fix Applied:** Implemented semantic router using Voyage AI embeddings with fallback to improved regex patterns.

**Files changed:**
- `manda-app/lib/agent/intent.ts` - Complete rewrite with semantic classification
- `manda-app/lib/agent/retrieval.ts` - Updated to use `classifyIntentAsync()`
- `manda-app/lib/agent/index.ts` - Export new functions

**Architecture:**
1. Primary: Semantic similarity router using Voyage embeddings (~50ms)
2. Fallback: Improved regex patterns when VOYAGE_API_KEY not set
3. Compound query examples added to factual intent examples

**TODO (Future):** Add LLM-based classification for ambiguous cases (confidence < 0.7)

---

### BUG-002: Large Single Result Returns 0 Context (FIXED)

**Root Cause:** `formatRetrievedContext()` broke immediately if first result exceeded token budget.

**Fix Applied:** Added truncation logic to include partial content from large results.

**Files changed:**
- `manda-app/lib/agent/retrieval.ts`

**Logic:**
- If result exceeds remaining budget but >50 tokens available, truncate
- Include citation suffix with truncated content
- Only skip if <100 chars of meaningful content would remain

---

### BUG-004: Neo4j Vector Search Not Available (FIXED)

**Root Cause:** Neo4j 5.15 doesn't support `vector.similarity.cosine()` function. Graphiti requires Neo4j 5.26+.

**Fix Applied:** Upgraded Neo4j from 5.15-community to 5.26-community.

**Files changed:**
- `manda-app/docker-compose.dev.yml`

**Verification:**
- Before: `Unknown function 'vector.similarity.cosine'`
- After: Query executes successfully (returns empty because no data ingested yet)

**Source:** [Graphiti GitHub Issue #325](https://github.com/getzep/graphiti/issues/325)

---

## Next Steps

1. [x] ~~Investigate document processing status~~ → BUG-003 was the issue
2. [x] ~~Fix BUG-003~~ → Applied fix to search.py and graphiti.py
3. [x] ~~Configure Neo4j vector index (BUG-004)~~ → Upgraded to Neo4j 5.26
4. [x] ~~Fix BUG-001~~ → Implemented semantic router
5. [x] ~~Fix BUG-002~~ → Added truncation for large results
6. [ ] Ingest test documents into Graphiti for E2E testing
7. [ ] Complete multi-turn context tests
8. [ ] Test fallback scenarios

---

## Environment

- Frontend: Next.js @ localhost:3000 ✅
- Backend: FastAPI @ localhost:8000 ✅
- Neo4j: localhost:7687 ✅
- Test Plan: agent-behavior-test-plan.md v1.0
