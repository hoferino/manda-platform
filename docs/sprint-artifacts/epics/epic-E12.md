# Epic 12: Production Readiness & Observability

**Epic ID:** E12
**Jira Issue:** SCRUM-12
**Priority:** P0

**User Value:** The platform provides full visibility into costs and performance, enabling confident deployment to real users. Issues are caught early through comprehensive testing, costs are tracked per feature, and the system gracefully handles real-world edge cases.

---

## Problem Statement

### Current Situation

With E10 (Knowledge Graph Foundation) and E11 (Agent Context Engineering) complete, the core agent capabilities are solid. However, before going to real users, we need:

1. **No visibility into costs** — We have `log_usage()` that logs to structlog, but no dashboard to visualize token usage, costs per conversation, or costs per feature.

2. **No manual test coverage** — Unit and integration tests pass, but we haven't validated real-world scenarios: what happens with empty files? Huge documents? Non-English text? Network failures?

3. **No alerting** — If Graphiti fails, if embeddings hit rate limits, if costs spike — nobody knows until users complain.

4. **Unknown edge cases** — M&A documents are messy: scanned PDFs, Excel with macros, encrypted files, 500-page CIMs. We haven't stress-tested these.

5. **No multi-tenant data isolation** — Currently no organization concept. When multiple companies use the platform, their confidential M&A data must be strictly isolated. User from Company A must never see Company B's deals, documents, or knowledge graph data.

### Vision: Production-Ready Platform

```
User Action → Feature executes → Costs tracked → Dashboard updated
                    ↓
              If error → Alert fired → Logged with context
                    ↓
              If latency high → Dashboard shows bottleneck
```

---

## Stories

### E12.1: Usage Tracking Database Schema

**Story ID:** E12.1
**Points:** 3
**Priority:** P0

**Description:**
Create database schema to persist LLM usage, costs, and feature metrics. Currently `log_usage()` logs to structlog but data is not queryable.

**Acceptance Criteria:**
- [ ] PostgreSQL table: `llm_usage` with provider, model, tokens, cost, feature, deal_id, timestamp
- [ ] PostgreSQL table: `feature_usage` with feature_name, deal_id, user_id, duration_ms, timestamp
- [ ] TypeScript types generated
- [ ] Python model created
- [ ] Index on (deal_id, timestamp) for efficient queries

**Technical Notes:**
```sql
-- llm_usage: Track every LLM call
CREATE TABLE llm_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id),
  user_id UUID REFERENCES users(id),
  provider VARCHAR(50) NOT NULL,        -- google-gla, anthropic, voyage
  model VARCHAR(100) NOT NULL,          -- gemini-2.5-flash, claude-sonnet-4-0
  feature VARCHAR(100) NOT NULL,        -- chat, document_analysis, extraction
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_usd DECIMAL(10, 6) NOT NULL,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- feature_usage: Track feature-level metrics
CREATE TABLE feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id),
  user_id UUID REFERENCES users(id),
  feature_name VARCHAR(100) NOT NULL,   -- upload_document, chat, search, qa_response
  status VARCHAR(20) NOT NULL,          -- success, error, timeout
  duration_ms INTEGER,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_llm_usage_deal_time ON llm_usage(deal_id, created_at);
CREATE INDEX idx_feature_usage_deal_time ON feature_usage(deal_id, created_at);
```

**Files to create/modify:**
- `supabase/migrations/000XX_usage_tracking.sql`
- `manda-app/lib/supabase/database.types.ts` (regenerate)
- `manda-processing/src/storage/models.py`

---

### E12.2: Usage Logging Integration

**Story ID:** E12.2
**Points:** 5
**Priority:** P0

**Description:**
Integrate usage logging into all LLM calls and feature executions. Persist to database instead of (or in addition to) structlog.

**Acceptance Criteria:**
- [ ] `log_usage()` in pydantic_agent.py writes to `llm_usage` table
- [ ] TypeScript agent calls log to `llm_usage` via Supabase
- [ ] Feature-level tracking for: chat, document_upload, document_analysis, search, qa_response
- [ ] Error tracking captures stack traces and context
- [ ] Batched writes for high-throughput scenarios (optional)

**Technical Notes:**
```typescript
// manda-app/lib/observability/usage.ts
export async function logLLMUsage(params: {
  dealId: string;
  userId: string;
  provider: string;
  model: string;
  feature: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs?: number;
}) {
  await supabase.from('llm_usage').insert(params);
}

// Integrate into agent executor
const startTime = Date.now();
const result = await llm.invoke(messages);
await logLLMUsage({
  dealId: state.dealId,
  userId: state.userId,
  provider: 'anthropic',
  model: 'claude-sonnet-4-0',
  feature: 'chat',
  inputTokens: result.usage.input_tokens,
  outputTokens: result.usage.output_tokens,
  costUsd: calculateCost(result.usage),
  latencyMs: Date.now() - startTime,
});
```

```python
# manda-processing/src/observability/usage.py
async def log_llm_usage(
    db: SupabaseClient,
    deal_id: str,
    provider: str,
    model: str,
    feature: str,
    input_tokens: int,
    output_tokens: int,
    cost_usd: float,
    latency_ms: int | None = None,
) -> None:
    await db.table('llm_usage').insert({
        'deal_id': deal_id,
        'provider': provider,
        'model': model,
        'feature': feature,
        'input_tokens': input_tokens,
        'output_tokens': output_tokens,
        'cost_usd': cost_usd,
        'latency_ms': latency_ms,
    }).execute()
```

**Files to create/modify:**
- `manda-app/lib/observability/usage.ts` (new)
- `manda-app/lib/agent/executor.ts`
- `manda-processing/src/observability/usage.py` (new)
- `manda-processing/src/llm/pydantic_agent.py`
- `manda-processing/src/jobs/handlers/analyze_document.py`

---

### E12.3: Developer Dashboard - Usage Metrics

**Story ID:** E12.3
**Points:** 8
**Priority:** P0

**Description:**
Create developer-only dashboard showing usage metrics: costs by deal, costs by feature, token usage over time, error rates. This is for the platform developer (Max) only, not end users.

**Acceptance Criteria:**
- [ ] Dashboard page at `/dev/usage` (protected by superadmin role)
- [ ] Chart: Total cost over time (day/week/month view)
- [ ] Chart: Cost breakdown by feature (pie chart)
- [ ] Chart: Cost breakdown by model/provider
- [ ] Table: Per-deal cost summary (deal name, total cost, conversations, documents)
- [ ] Table: Recent errors with context
- [ ] Date range filter
- [ ] Export to CSV

**Technical Notes:**
```typescript
// manda-app/app/admin/usage/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, LineChart, PieChart } from "@/components/charts"

export default async function UsageDashboard() {
  const { data: dailyCosts } = await supabase.rpc('get_daily_costs', {
    start_date: thirtyDaysAgo,
    end_date: today
  });

  const { data: featureCosts } = await supabase.rpc('get_costs_by_feature');

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle>Daily Costs</CardTitle></CardHeader>
        <CardContent>
          <LineChart data={dailyCosts} xKey="date" yKey="cost_usd" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Cost by Feature</CardTitle></CardHeader>
        <CardContent>
          <PieChart data={featureCosts} labelKey="feature" valueKey="cost_usd" />
        </CardContent>
      </Card>
      {/* More charts... */}
    </div>
  );
}
```

**Database Functions:**
```sql
-- Get daily costs
CREATE FUNCTION get_daily_costs(start_date DATE, end_date DATE)
RETURNS TABLE(date DATE, cost_usd DECIMAL, tokens INTEGER) AS $$
  SELECT
    DATE(created_at) as date,
    SUM(cost_usd) as cost_usd,
    SUM(input_tokens + output_tokens) as tokens
  FROM llm_usage
  WHERE created_at >= start_date AND created_at <= end_date
  GROUP BY DATE(created_at)
  ORDER BY date;
$$ LANGUAGE sql;

-- Get costs by feature
CREATE FUNCTION get_costs_by_feature()
RETURNS TABLE(feature VARCHAR, cost_usd DECIMAL, call_count INTEGER) AS $$
  SELECT
    feature,
    SUM(cost_usd) as cost_usd,
    COUNT(*) as call_count
  FROM llm_usage
  GROUP BY feature
  ORDER BY cost_usd DESC;
$$ LANGUAGE sql;
```

**Files to create/modify:**
- `manda-app/app/admin/usage/page.tsx` (new)
- `manda-app/components/admin/usage-charts.tsx` (new)
- `supabase/migrations/000XX_usage_functions.sql`

---

### E12.4: Manual Test Plan - Happy Paths

**Story ID:** E12.4
**Points:** 5
**Priority:** P0

**Description:**
Document and execute manual test cases for core user workflows. Focus on happy path scenarios that must work flawlessly.

**Acceptance Criteria:**
- [ ] Test plan document with step-by-step scenarios
- [ ] Execute all scenarios manually
- [ ] Document results and issues found
- [ ] Fix blocking issues
- [ ] Create automated smoke tests for critical paths

**Test Scenarios:**
```markdown
## HP-001: New Deal Creation
1. Login with valid credentials
2. Click "Create Deal"
3. Enter deal name: "Test Acquisition Co"
4. Verify deal appears in dashboard
5. Navigate to deal detail page
Expected: Deal created, visible in list and detail view

## HP-002: Document Upload (PDF)
1. Navigate to deal
2. Click "Upload Document"
3. Select sample CIM PDF (10 pages)
4. Wait for processing
5. Verify status: "Processed"
6. Navigate to findings tab
Expected: Document processed, findings extracted (5+ findings)

## HP-003: Chat - Simple Query
1. Open chat for deal with processed document
2. Ask: "What is the company's revenue?"
3. Wait for response
Expected: Response includes revenue figure with source citation

## HP-004: Chat - Knowledge Write-Back
1. In chat, say: "The Q3 revenue was actually $5.2M"
2. Verify agent responds "Got it, I've noted..."
3. Start new chat session
4. Ask: "What is Q3 revenue?"
Expected: Agent returns $5.2M (not document value)

## HP-005: Q&A Workflow
1. Navigate to Q&A tab
2. Click "Add Question"
3. Enter question about document content
4. Submit answer
5. Verify answer saved
6. Chat: ask related question
Expected: Chat references Q&A answer with appropriate confidence

## HP-006: Search Across Deal
1. Use search bar: "revenue growth"
2. Verify results include:
   - Document findings
   - Q&A items (if relevant)
   - Chat-indexed facts
Expected: Unified search results with source types indicated
```

**Files to create:**
- `docs/testing/manual-test-plan-happy-paths.md`
- `docs/testing/manual-test-results-YYYY-MM-DD.md`

---

### E12.5: Manual Test Plan - Edge Cases & Failures

**Story ID:** E12.5
**Points:** 8
**Priority:** P1

**Description:**
Test edge cases and failure modes that real users will encounter. Document behavior and fix critical issues.

**Acceptance Criteria:**
- [ ] Test plan document with edge case scenarios
- [ ] Execute scenarios manually
- [ ] Document actual behavior vs expected
- [ ] Categorize issues: critical (blocker), high (fix soon), medium (polish)
- [ ] Fix all critical issues

**Test Scenarios:**
```markdown
## EC-001: Empty Document
1. Upload empty PDF (0 bytes)
Expected: Graceful error message, no crash

## EC-002: Huge Document (500+ pages)
1. Upload large CIM PDF (500 pages)
2. Monitor processing time and memory
Expected: Processes within 10 minutes, status updates shown

## EC-003: Scanned PDF (Image-only)
1. Upload scanned PDF without text layer
2. Check if OCR runs
Expected: Either extracts text via OCR or shows "no text found" error

## EC-004: Non-English Document
1. Upload German financial document
2. Ask questions in English
Expected: Extracts content, responds in English

## EC-005: Concurrent Document Uploads
1. Upload 5 documents simultaneously
2. Monitor processing
Expected: All process successfully, no race conditions

## EC-006: Chat with No Documents
1. Open chat for deal with 0 documents
2. Ask: "What is the revenue?"
Expected: Agent says "I don't have any documents for this deal yet"

## EC-007: Very Long Chat (50+ messages)
1. Send 50+ messages in single session
2. Verify summarization kicks in
3. Verify context remains coherent
Expected: Agent maintains context, references earlier topics

## EC-008: Rate Limit Simulation
1. Send rapid-fire messages (10/second)
Expected: Graceful queuing or rate limit message (not crashes)

## EC-009: Network Failure During Upload
1. Start document upload
2. Disconnect network mid-upload
3. Reconnect
Expected: Clear error message, option to retry

## EC-010: Special Characters in Deal Name
1. Create deal: "Test & Co. (2024) - $10M+"
Expected: Deal created successfully, no encoding issues

## EC-011: Malformed Excel
1. Upload Excel with merged cells, hidden sheets
2. Check extraction
Expected: Extracts visible data, handles gracefully

## EC-012: Password-Protected PDF
1. Upload encrypted PDF
Expected: Clear error message "Password-protected files not supported"

## EC-013: Timeout - Long Running Query
1. Ask complex question requiring graph traversal
2. Wait for response
Expected: Response within 30s, or timeout message with retry option

## EC-014: Graphiti/Neo4j Down
1. Stop Neo4j container
2. Ask chat question
Expected: Graceful degradation or clear error (not 500)
```

**Files to create:**
- `docs/testing/manual-test-plan-edge-cases.md`
- `docs/testing/issue-tracker.md`

---

### E12.6: Error Handling & Graceful Degradation

**Story ID:** E12.6
**Points:** 5
**Priority:** P1

**Description:**
Improve error handling throughout the platform. Ensure user-friendly messages and graceful degradation when services fail.

**Acceptance Criteria:**
- [ ] Graphiti unavailable → Chat falls back to basic RAG or shows message
- [ ] LLM rate limit → Retry with exponential backoff, then user message
- [ ] Document parsing fails → Clear error with specific reason
- [ ] All errors logged with context (deal_id, user_id, stack trace)
- [ ] User-facing errors never show stack traces
- [ ] Toast notifications for transient errors

**Technical Notes:**
```typescript
// Error boundary for agent chat
try {
  const response = await agentExecutor.invoke(input);
  return response;
} catch (error) {
  if (error instanceof RateLimitError) {
    // Log and retry
    await logFeatureUsage({ feature: 'chat', status: 'rate_limited' });
    await delay(1000 * Math.pow(2, retryCount));
    return retry();
  }

  if (error instanceof GraphitiConnectionError) {
    // Graceful degradation
    await logFeatureUsage({ feature: 'chat', status: 'degraded' });
    return fallbackToBasicRAG(input);
  }

  // Unknown error - log and show generic message
  await logFeatureUsage({
    feature: 'chat',
    status: 'error',
    errorMessage: error.message,
    metadata: { stack: error.stack }
  });

  throw new UserFacingError(
    "I'm having trouble right now. Please try again in a moment."
  );
}
```

**Files to modify:**
- `manda-app/lib/agent/executor.ts`
- `manda-app/lib/agent/tools/*.ts`
- `manda-processing/src/jobs/handlers/*.py`
- `manda-app/components/chat/error-boundary.tsx` (new)

---

### E12.7: Alerting & Monitoring Setup

**Story ID:** E12.7
**Points:** 5
**Priority:** P2

**Description:**
Set up basic alerting for critical failures and cost anomalies.

**Acceptance Criteria:**
- [ ] Alert when error rate > 5% in 5-minute window
- [ ] Alert when daily cost exceeds threshold (configurable)
- [ ] Alert when Graphiti/Neo4j health check fails
- [ ] Alerts sent via email (later: Slack)
- [ ] Alert dashboard showing recent alerts and status
- [ ] Alert acknowledgment and resolution tracking

**Technical Notes:**
```typescript
// Scheduled function (Supabase Edge Function or cron)
export async function checkAlerts() {
  // Check error rate
  const { data: recentErrors } = await supabase
    .from('feature_usage')
    .select('*')
    .eq('status', 'error')
    .gte('created_at', fiveMinutesAgo);

  const { data: recentTotal } = await supabase
    .from('feature_usage')
    .select('*')
    .gte('created_at', fiveMinutesAgo);

  const errorRate = recentErrors.length / recentTotal.length;
  if (errorRate > 0.05) {
    await sendAlert({
      type: 'high_error_rate',
      message: `Error rate ${(errorRate * 100).toFixed(1)}% in last 5 minutes`,
      severity: 'critical'
    });
  }

  // Check daily cost
  const { data: dailyCost } = await supabase.rpc('get_daily_costs', {
    start_date: today,
    end_date: today
  });

  if (dailyCost[0]?.cost_usd > DAILY_COST_THRESHOLD) {
    await sendAlert({
      type: 'cost_anomaly',
      message: `Daily cost $${dailyCost[0].cost_usd} exceeds threshold`,
      severity: 'warning'
    });
  }
}
```

**Files to create:**
- `manda-app/lib/monitoring/alerts.ts`
- `supabase/functions/check-alerts/index.ts` (edge function)
- `manda-app/app/admin/alerts/page.tsx`

---

### E12.8: Performance Profiling & Optimization

**Story ID:** E12.8
**Points:** 5
**Priority:** P2

**Description:**
Profile critical paths and optimize bottlenecks identified during manual testing.

**Acceptance Criteria:**
- [ ] Profile: Document upload → processing complete (target: <30s for 10 pages)
- [ ] Profile: Chat query → response (target: <5s)
- [ ] Profile: Search across deal (target: <2s)
- [ ] Identify and fix top 3 bottlenecks
- [ ] Add performance metrics to dashboard

**Technical Notes:**
```typescript
// Add timing to critical operations
const timer = new Timer('document_analysis');

timer.mark('parse_start');
const parsed = await docling.parse(document);
timer.mark('parse_end');

timer.mark('chunk_start');
const chunks = await chunker.chunk(parsed);
timer.mark('chunk_end');

timer.mark('embed_start');
const embeddings = await voyage.embed(chunks);
timer.mark('embed_end');

timer.mark('graphiti_start');
await graphiti.ingest(chunks, embeddings);
timer.mark('graphiti_end');

// Log all timings
await logFeatureUsage({
  feature: 'document_analysis',
  status: 'success',
  durationMs: timer.totalMs(),
  metadata: timer.toJSON()  // { parse: 5000, chunk: 200, embed: 3000, graphiti: 8000 }
});
```

**Files to modify:**
- `manda-app/lib/observability/timer.ts` (new)
- `manda-processing/src/observability/timer.py` (new)
- Critical path handlers

---

### E12.9: Multi-Tenant Data Isolation

**Story ID:** E12.9
**Points:** 13
**Priority:** P0

**Description:**
Implement organization-based multi-tenancy to ensure strict data isolation between companies. Each organization has its own deals, documents, and knowledge graph namespace. Users can belong to multiple organizations (for consultants/advisors). Developer (Max) has superadmin access to all organizations.

**Acceptance Criteria:**
- [ ] `organizations` table with RLS policies
- [ ] `organization_members` junction table (user can belong to multiple orgs)
- [ ] `deals.organization_id` foreign key added
- [ ] All deal-related queries scoped to user's organization(s)
- [ ] Graphiti `group_id` prefixed with `org_id` for namespace isolation
- [ ] API middleware enforces organization boundary on all endpoints
- [ ] Superadmin role bypasses RLS (for developer access)
- [ ] Test: User A cannot access User B's organization data
- [ ] Test: User in multiple orgs can switch between them

**Technical Notes:**

```sql
-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,  -- URL-friendly identifier
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Organization membership (supports multiple orgs per user)
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',  -- superadmin, admin, member
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- Add org to deals
ALTER TABLE deals ADD COLUMN organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_deals_org ON deals(organization_id);

-- Row-Level Security
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- Policy: Users see only their org's deals (superadmin sees all)
CREATE POLICY "org_isolation_deals" ON deals
FOR ALL USING (
  -- Superadmin bypasses
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid() AND role = 'superadmin'
  )
  OR
  -- Regular users see their org's deals
  organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid()
  )
);

-- Similar policies for: documents, findings, qa_items, irl_items, conversations, llm_usage, feature_usage
```

**Graphiti Namespace Isolation:**
```python
# Current (deal-only isolation)
group_id = str(deal_id)

# New (org + deal isolation)
group_id = f"{organization_id}:{deal_id}"

# This ensures Neo4j graph queries are scoped to org+deal
# Even if attacker guesses deal_id, wrong org_id = no results
```

**API Middleware:**
```typescript
// middleware/org-auth.ts
export async function withOrgAuth(req: Request, handler: Handler) {
  const user = await getUser(req);
  const orgId = req.headers.get('x-organization-id');

  // Verify user belongs to this org
  const membership = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .single();

  if (!membership.data) {
    throw new ForbiddenError('Not a member of this organization');
  }

  // Inject org context for downstream use
  req.orgId = orgId;
  req.orgRole = membership.data.role;

  return handler(req);
}
```

**UI Organization Switcher:**
```typescript
// For users in multiple orgs, show org switcher in header
// Store selected org in localStorage + cookie for SSR
// All API calls include x-organization-id header
```

**Files to create/modify:**
- `supabase/migrations/000XX_organizations.sql`
- `manda-app/lib/supabase/database.types.ts` (regenerate)
- `manda-app/middleware.ts` (org auth)
- `manda-app/components/org-switcher.tsx` (new)
- `manda-app/lib/auth/org-context.ts` (new)
- `manda-processing/src/graphiti/client.py` (update group_id)
- `manda-processing/src/api/middleware/org_auth.py` (new)
- All API routes (add org scoping)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MULTI-TENANT ISOLATION (E12.9)                        │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    ORGANIZATION LAYER                            │    │
│  │                                                                  │    │
│  │  Organization A          Organization B          Superadmin     │    │
│  │  ├── Users               ├── Users               (sees all)     │    │
│  │  ├── Deals               ├── Deals                              │    │
│  │  └── Neo4j: orgA:*       └── Neo4j: orgB:*                      │    │
│  │                                                                  │    │
│  │  PostgreSQL RLS          Graphiti group_id       API Middleware │    │
│  │  (row filtering)         (namespace prefix)      (org header)   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                    OBSERVABILITY LAYER (E12.1-E12.3)                     │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    USAGE TRACKING (E12.1-E12.2)                  │    │
│  │                                                                  │    │
│  │  LLM Call → log_usage() → llm_usage table                       │    │
│  │  Feature  → log_feature() → feature_usage table                  │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    DEVELOPER DASHBOARD (E12.3)                    │  │
│  │  • Daily costs chart (all orgs - superadmin only)                 │  │
│  │  • Cost by feature breakdown                                      │  │
│  │  • Per-org and per-deal summaries                                 │  │
│  │  • Error log viewer                                               │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│                              ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    ALERTING (E12.7)                               │  │
│  │  • Error rate threshold                                           │  │
│  │  • Cost anomaly detection                                         │  │
│  │  • Service health checks                                          │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Story Priority Matrix

| Priority | Story | Points | Rationale |
|----------|-------|--------|-----------|
| **P0** | E12.9 Multi-Tenant Isolation | 13 | **Security-critical** — must have before any external users |
| **P0** | E12.1 Usage Schema | 3 | Foundation for all tracking |
| **P0** | E12.2 Usage Integration | 5 | Enables cost visibility |
| **P0** | E12.3 Developer Dashboard | 8 | Developer's primary request |
| **P0** | E12.4 Happy Path Tests | 5 | Must work before users |
| **P1** | E12.5 Edge Case Tests | 8 | Real-world robustness |
| **P1** | E12.6 Error Handling | 5 | User experience |
| **P2** | E12.7 Alerting | 5 | Proactive monitoring |
| **P2** | E12.8 Performance | 5 | Optimization |

**Total: 57 points**

### Recommended Execution Order

1. **E12.9** (Multi-Tenant) — Do this first, it touches many files
2. **E12.1 → E12.2 → E12.3** (Usage tracking pipeline)
3. **E12.4 → E12.5** (Manual testing, may surface issues)
4. **E12.6** (Error handling improvements from testing)
5. **E12.7 → E12.8** (Polish)

---

## Dependencies

- **Requires:** E10 (Knowledge Foundation), E11 (Context Engineering) — both complete
- **Requires:** Admin authentication (already exists)
- **Enables:** User rollout, cost forecasting, SLA definitions

---

## Success Criteria

1. **Data isolation verified** — User from Org A cannot access Org B data (API, UI, Neo4j)
2. **Cost visibility** — Developer dashboard shows costs per org, deal, feature, and model
3. **All happy paths pass** — 6/6 core workflows work end-to-end
4. **Critical edge cases handled** — No crashes, graceful errors
5. **Error tracking** — All errors logged with context, viewable in dashboard
6. **Performance acceptable** — Chat <5s, search <2s, upload <30s
7. **Ready for users** — Confidence to onboard first real users with their confidential data

---

## Testing Strategy

### Pre-Deployment Checklist
- [ ] All happy path tests pass (E12.4)
- [ ] Critical edge cases handled (E12.5)
- [ ] Error handling verified (E12.6)
- [ ] Dashboard shows accurate data (E12.3)
- [ ] Performance targets met (E12.8)
- [ ] Alerts configured and tested (E12.7)

---

## References

- [Epic 11 Retrospective](../retrospectives/epic-E11-retrospective.md) — Action items driving this epic
- [Epic 10 Retrospective](../retrospectives/epic-E10-retrospective.md) — Observability gap identified
- [Pydantic AI Agent](../../manda-processing/src/llm/pydantic_agent.py) — Existing log_usage() function
- [LangChain Context Engineering](https://blog.langchain.com/context-engineering-for-agents/) — Framework reference

---

*Epic created: 2025-12-18*
*Status: Ready for Development*
