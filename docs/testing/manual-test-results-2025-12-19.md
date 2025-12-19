# Manual Test Results: 2025-12-19

**Tester:** [YOUR NAME]
**Environment:** localhost
**Build:** (current main branch)

---

## Quick Start - Test Execution Plan

### Prerequisites Checklist

Before testing, ensure:
- [ ] Test user account exists in Supabase with superadmin role
- [ ] Sample CIM PDF available (place in `manda-app/e2e/fixtures/sample-cim.pdf`)
- [ ] All environment variables configured (`.env.local`)

### Step 1: Start All Services (5 minutes)

Open 4 terminal windows:

**Terminal 1 - Neo4j:**
```bash
cd /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform
docker-compose -f docker-compose.dev.yml up -d
# Wait for "healthy" status
docker logs -f neo4j
```

**Terminal 2 - FastAPI:**
```bash
cd /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-processing
python3 -m uvicorn src.main:app --port 8000
```

**Terminal 3 - Worker:**
```bash
cd /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-processing
python3 -m src.jobs
```

**Terminal 4 - Next.js:**
```bash
cd /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app
npm run dev
```

### Step 2: Verify Services (1 minute)

```bash
# FastAPI health check
curl http://localhost:8000/health

# Next.js running check
curl -s http://localhost:3000 | head -5

# Neo4j connection
docker exec neo4j cypher-shell -u neo4j -p mandadev123 "RETURN 'healthy'"
```

All should return success/200.

### Step 3: Execute Manual Tests (15-20 minutes)

Follow the detailed steps in `docs/testing/manual-test-plan-happy-paths.md`.

**Test Order:**
1. HP-001: New Deal Creation (2 min)
2. HP-002: Document Upload (2 min)
3. HP-003: Chat Simple Query (1 min)
4. HP-004: Chat Knowledge Write-Back (2 min)
5. HP-005: Q&A Workflow (2 min)
6. HP-006: Search Across Deal (1 min)

### Step 4: Run Automated Smoke Tests (Optional)

```bash
cd manda-app

# Set credentials
export E2E_TEST_EMAIL="your-test-email@example.com"
export E2E_TEST_PASSWORD="your-test-password"

# Run smoke tests
npm run test:smoke
```

---

## Test Execution Summary

| Test | Status | Duration | Notes |
|------|--------|----------|-------|
| HP-001: New Deal Creation | ⏳ PENDING | - | |
| HP-002: Document Upload | ⏳ PENDING | - | |
| HP-003: Chat Simple Query | ⏳ PENDING | - | |
| HP-004: Chat Knowledge Write-Back | ⏳ PENDING | - | |
| HP-005: Q&A Workflow | ⏳ PENDING | - | |
| HP-006: Search Across Deal | ⏳ PENDING | - | |

**Instructions:** Update each row after executing the test:
- Status: ✅ PASS / ❌ FAIL / ⚠️ PARTIAL
- Duration: Time in minutes
- Notes: Any observations

---

## Environment Status Check

**Services Required:**
- [ ] Next.js (port 3000)
- [ ] FastAPI (port 8000)
- [ ] Worker (background process)
- [ ] Neo4j (ports 7474, 7687)
- [ ] Supabase (cloud connection)

---

## Automated Smoke Tests

Automated Playwright smoke tests have been created to cover all 6 happy paths:

**Test Files Created:**
- `manda-app/e2e/smoke/happy-paths.spec.ts` - 6 test cases
- `manda-app/e2e/fixtures/README.md` - Fixture requirements

**Run Command:**
```bash
cd manda-app
npm run test:smoke
```

**Test List:**
```
[smoke] › smoke/happy-paths.spec.ts:24:7 › HP-001: Create new deal via wizard
[smoke] › smoke/happy-paths.spec.ts:76:7 › HP-002: Upload document to data-room
[smoke] › smoke/happy-paths.spec.ts:98:7 › HP-003: Chat simple query
[smoke] › smoke/happy-paths.spec.ts:119:7 › HP-004: Chat knowledge write-back
[smoke] › smoke/happy-paths.spec.ts:151:7 › HP-005: Q&A workflow
[smoke] › smoke/happy-paths.spec.ts:178:7 › HP-006: Search in knowledge-explorer
```

---

## Issues Found

| ID | Test | Severity | Description | Status |
|----|------|----------|-------------|--------|
| - | - | - | (Record issues here during testing) | - |

**Severity Guide:**
- Critical: Blocks happy path, must fix before production
- High: Major functionality broken, fix soon
- Medium: Works but UX/polish issue
- Low: Minor cosmetic/enhancement

---

## Notes

- All test artifacts and automation are in place
- Manual execution is deferred to the user
- Update this document with results after testing
- If any critical issues found, document them and create fixes
