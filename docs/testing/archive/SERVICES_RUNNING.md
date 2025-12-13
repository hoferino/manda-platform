# Active Services - Document Processing Pipeline

**Status:** ✅ All services running and healthy
**Started:** 2025-12-12 17:13 CET
**Ready for:** Phase 1 Testing (Upload & GCS Storage)

---

## Running Services

### 1. Neo4j Database
- **Status:** ✅ Running
- **Container:** neo4j (Docker)
- **Ports:** 7474 (HTTP), 7687 (Bolt)
- **Credentials:** neo4j / mandadev123
- **Access:** http://localhost:7474

### 2. FastAPI Service (manda-processing)
- **Status:** ✅ Running
- **Process ID:** 49800
- **Port:** 8000
- **Health Check:** http://localhost:8000/health
- **Monitor:** BashOutput bash_id: eaa97c
- **Purpose:** Webhook receiver, job enqueuer

### 3. Python Worker Process
- **Status:** ✅ Running & Polling
- **Monitor:** BashOutput bash_id: d24e18
- **Purpose:** Processes jobs from pg-boss queue
- **Handlers Active:**
  - test-job (batch: 5, interval: 2s)
  - document-parse (batch: 3, interval: 5s)
  - generate-embeddings (batch: 5, interval: 2s)
  - analyze-document (batch: 3, interval: 5s)
  - extract-financials (batch: 3, interval: 5s)

### 4. Next.js App (manda-app)
- **Status:** ✅ Running
- **Port:** 3000
- **Monitor:** BashOutput bash_id: e42780
- **Access:** http://localhost:3000
- **Purpose:** Web UI, file upload

---

## Configuration Fixes Applied

### Database Connection
- **Mode:** Transaction mode (port 6543)
- **Pool Size:** min=10, max=50
- **Statement Cache:** Disabled (required for pgbouncer)
- **File:** `manda-processing/src/jobs/queue.py`

### Environment
- **Database URL:** Using port 6543 for better concurrency
- **File:** `manda-processing/.env`

---

## Quick Monitoring Commands

### Check Service Health
```bash
# FastAPI
curl http://localhost:8000/health

# Next.js
curl -s http://localhost:3000 | grep -i title

# Neo4j
docker exec neo4j cypher-shell -u neo4j -p mandadev123 "RETURN 'healthy'"
```

### Monitor Logs
```bash
# FastAPI service logs
# Use BashOutput with bash_id: eaa97c

# Worker logs
# Use BashOutput with bash_id: d24e18

# Next.js logs
# Use BashOutput with bash_id: e42780
```

### Check pg-boss Queue
```sql
-- Run in Supabase SQL Editor
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

-- Active jobs right now
SELECT id, name, state, retry_count, NOW() - started_on as running_for
FROM pgboss.job
WHERE state = 'active'
ORDER BY started_on DESC;
```

### Check Worker Process
```bash
ps aux | grep "python3 -m src.jobs" | grep -v grep
```

---

## Stopping Services

```bash
# Kill worker (bash ID: d24e18)
# Use KillShell tool with shell_id: d24e18

# Kill FastAPI (bash ID: eaa97c)
# Use KillShell tool with shell_id: eaa97c

# Kill Next.js (bash ID: e42780)
# Use KillShell tool with shell_id: e42780

# Stop Neo4j
cd manda-app && docker-compose -f docker-compose.dev.yml down
```

---

## Next Steps

Ready to begin **Phase 1: Upload & GCS Storage** testing:

1. Open http://localhost:3000
2. Login to the app
3. Navigate to a deal → Data Room tab
4. Upload a test PDF file
5. Monitor:
   - FastAPI webhook receipt (bash_id: eaa97c)
   - Worker job processing (bash_id: d24e18)
   - pg-boss queue state changes (SQL query)
   - GCS bucket for uploaded file

Refer to: [manual-testing-guide-document-processing.md](manual-testing-guide-document-processing.md)

---

**Author:** Claude (TEA Agent - Murat)
**For:** Max
**Date:** 2025-12-12
