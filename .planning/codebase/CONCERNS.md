# Codebase Concerns

**Analysis Date:** 2026-01-20

## Tech Debt

**Backend Service Initialization:**
- Issue: Multiple `TODO` comments in `src/main.py` (lines 85-86, 92-93) indicate that critical startup/shutdown operations are not implemented
- Files: `manda-processing/src/main.py`
- Impact: Database connection pooling and job queue worker lifecycle are not managed. This can lead to connection leaks, improper resource cleanup, and cascading failures during service restarts
- Fix approach: Implement database pool initialization in `lifespan()` startup, add job queue initialization, and implement graceful shutdown with pool closure and worker termination

**Temporary Multi-Tenant Isolation Workaround:**
- Issue: `src/graphiti/retrieval.py:236` uses `deal_id` as both `organization_id` and `deal_id` with a TODO for E12.9
- Files: `manda-processing/src/graphiti/retrieval.py`
- Impact: Multi-tenant isolation is not properly enforced for knowledge graph retrieval. Organizations can query data outside their scope if organization_id is not properly populated from the request
- Fix approach: Update API schema and GraphitiClient to accept organization_id from request headers/context, then update retrieval service to use actual organization_id

**Graphiti Tool Exposure Limitation:**
- Issue: `src/agents/tools/financial_tools.py:588` contains TODO commenting that GraphitiClient needs a public search method
- Files: `manda-processing/src/agents/tools/financial_tools.py`
- Impact: Financial tools cannot directly search Graphiti; they must work around private implementation details
- Fix approach: Expose a public `GraphitiClient.search()` method that financial tools can call directly

**Source Attribution TODO in Chat Route:**
- Issue: `app/api/projects/[id]/chat/route.ts` line 252 and `lib/agent/v2/nodes/retrieval.ts` have TODOs indicating source extraction is not fully wired
- Files: `app/api/projects/[id]/chat/route.ts`, `lib/agent/v2/nodes/retrieval.ts`
- Impact: Chat responses lack proper source citations; sources array remains empty in done events even after retrieval node completes
- Fix approach: Wire retrieval node to populate sources in state, then extract sources in chat route's done event

**Unused Context Loader Middleware:**
- Issue: `lib/agent/v2/middleware/context-loader.ts` is documented as needing deletion but remains in codebase (Epic 3 retro TODO)
- Files: `lib/agent/v2/middleware/context-loader.ts`
- Impact: Unused code creates confusion about active middleware patterns and bloats the agent system
- Fix approach: Remove context-loader middleware file and any imports referencing it after verifying no active dependents

---

## Known Bugs

**React State Update Loop in Knowledge Explorer:**
- Symptoms: Page crashes with "Maximum update depth exceeded" error when navigating to Contradiction Detection
- Files: Components in `components/knowledge-explorer/` (likely involving refs)
- Trigger: Navigate to Knowledge Explorer → Contradiction Detection tab
- Stack trace: Error originates from `node_modules_df35e7ca._.js` suggesting component ref handling issue
- Workaround: Avoid Knowledge Explorer page; use alternative gap/contradiction workflows
- Priority: CRITICAL (blocks Knowledge Explorer feature)

**Session Authentication Propagation Failure:**
- Symptoms: 401 Unauthorized errors on subsequent API calls after successful login
- Files: `lib/supabase/middleware.ts`, various API routes
- Trigger: Login successfully, then navigate to project pages and attempt to upload documents or access protected endpoints
- Root cause: Session token/cookie not properly forwarded to API routes in Next.js middleware or SSR client configuration
- Affected endpoints: `/api/processing/queue`, `/api/projects/[id]/folders`, `/api/projects/[id]/conversations`, `/api/projects/[id]/irls/templates`
- Workaround: Restart browser/clear cookies and attempt re-login
- Priority: CRITICAL (blocks most features after login)

**Invalid Credentials Accepted in Login:**
- Symptoms: Login form accepts any credentials without validation
- Files: `app/api/auth/login/route.ts`
- Trigger: Submit login form with known invalid email/password combination
- Root cause: Missing credential validation in login handler
- Impact: Security vulnerability; unauthorized access possible
- Priority: CRITICAL (security issue)

**Project Creation Server Error:**
- Symptoms: 500 error on project creation with message "An unexpected response was received from the server"
- Files: `app/api/projects/route.ts` (POST handler)
- Trigger: Submit project creation form
- Root cause: Unhandled exception in project POST handler
- Workaround: Check server logs for detailed error
- Priority: HIGH (blocks core workflow)

**Contradictions Knowledge Graph TODO:**
- Issue: `src/agents/schemas/knowledge_graph.py:167` documents that find_contradictions tool has incomplete implementation as of E13.6
- Files: `manda-processing/src/agents/schemas/knowledge_graph.py`
- Impact: Contradiction detection from knowledge graph returns incomplete results
- Priority: MEDIUM (feature incomplete)

---

## Security Considerations

**Missing Login Credential Validation:**
- Risk: Unauthorized users can login without valid credentials
- Files: `app/api/auth/login/route.ts`
- Current mitigation: None detected
- Recommendations:
  - Implement proper Supabase Auth credential verification in login route
  - Add rate limiting to prevent brute force attacks
  - Log failed authentication attempts
  - Verify that Supabase session tokens are properly validated on all protected endpoints

**Session Token Propagation in SSR:**
- Risk: Session tokens not properly attached to subsequent API requests; authenticated users may lose access mid-session
- Files: `lib/supabase/middleware.ts`, API routes using `createClient()`
- Current mitigation: RLS policies on database level provide some protection
- Recommendations:
  - Audit middleware to ensure session tokens from cookies are properly forwarded
  - Verify `createClient()` properly initializes with server-side session context
  - Add integration tests for session persistence across multiple API calls
  - Implement request interceptor to verify auth header presence on all protected routes

**Multi-Tenant Isolation Using deal_id as organization_id:**
- Risk: Data isolation not properly enforced in knowledge graph queries
- Files: `manda-processing/src/graphiti/retrieval.py:236`
- Current mitigation: Temporary workaround uses deal_id for both org and deal
- Recommendations:
  - Update request schema to include organization_id from auth context
  - Verify all Graphiti queries filter by both organization_id and deal_id
  - Add integration tests for multi-tenant isolation
  - Audit Neo4j group_id construction to ensure organization scoping

**Exposed Development Endpoints in Production:**
- Risk: OpenAPI documentation (`/docs`, `/redoc`) enabled in development but may be left enabled in production
- Files: `manda-processing/src/main.py:104-105`
- Current mitigation: Conditional check on `settings.is_development`
- Recommendations:
  - Verify production environment correctly sets `app_env` to prevent docs exposure
  - Add monitoring alert if `/docs` becomes accessible in production
  - Consider adding basic auth to docs endpoints even in development

---

## Performance Bottlenecks

**Graphiti Hybrid Search Latency Spikes:**
- Problem: Retrieval service targets <3 seconds end-to-end but no timeout handling; slow queries block agent responses
- Files: `manda-processing/src/graphiti/retrieval.py:230-250`
- Cause: Neo4j hybrid search (vector + BM25 + graph) can exceed target latency; graceful degradation returns empty results but doesn't retry or use fallback
- Current behavior: Returns empty RetrievalResult on Graphiti timeout (line 248-254), which breaks agent context
- Improvement path:
  - Add configurable timeout (e.g., 2 seconds) and implement circuit breaker
  - Fallback to vector-only search if hybrid search exceeds timeout
  - Implement retry with exponential backoff for transient failures
  - Add latency percentile monitoring (p50, p95, p99)

**Retrieval Search Method Selection Uses Complexity Classification:**
- Problem: Query complexity classification (`classifyComplexity()` in `lib/agent/intent.ts`) runs on every chat message before retrieval
- Files: `lib/agent/v2/nodes/retrieval.ts:143`, `lib/agent/intent.ts`
- Impact: Complex queries always use hybrid search (~500ms) even for simple follow-up questions
- Improvement path:
  - Cache complexity classification per conversation or user
  - Use conversation history to optimize search method selection
  - Consider user-provided search hints or explicit mode selection

**Document Parsing Not Implemented:**
- Problem: Document processing pipeline stages are stubbed (TODOs in handlers)
- Files: `lib/pgboss/handlers/document-parse.ts:28`, `lib/pgboss/handlers/analyze-document.ts:27`, `lib/pgboss/handlers/update-graph.ts:31`
- Impact: Documents uploaded but not parsed; no knowledge ingested into graph
- Improvement path: Implement parsing handlers after docling/gemini integrations are available

---

## Fragile Areas

**Agent System Version Mismatch:**
- Files: `lib/agent/v2/`, `lib/agent/cim-mvp/`, `lib/agent/orchestrator/` (legacy - deleted)
- Why fragile: System transitioned from v1 orchestrator to v2 with CIM MVP as special case. Mix of patterns makes it easy to:
  - Add new logic to wrong agent system (v2 vs CIM MVP)
  - Use deleted orchestrator imports without noticing
  - Miss new workflow modes (CIM, IRL) when extending v2
- Safe modification:
  - Check CLAUDE.md agent patterns section before modifying
  - Use barrel exports from `lib/agent/v2/` and `lib/agent/cim-mvp/` only, never deep imports
  - Add new workflow modes as dedicated implementations, not conditional branches
- Test coverage: Integration tests skip for LLM APIs (Story 1.0); unit tests have good coverage of state/types

**Knowledge Graph Graphiti Integration Edge Cases:**
- Files: `manda-processing/src/graphiti/client.py`, `src/graphiti/retrieval.py`
- Why fragile:
  - Entity model field naming conflicts (BUG-002 fix: renamed `name` → `company_name`/`full_name`)
  - Reserved group_id format (BUG-004 fix: colon separator incompatible, changed to underscore)
  - Missing deal lookup (BUG-001 fix: `get_deal()` method was missing)
  - Removed column references (BUG-003 fix: pgvector `embedding` column references)
- Safe modification:
  - Before modifying entity models, verify Graphiti reserved attributes
  - Test group_id format changes against actual Graphiti validation
  - Run full pipeline tests after any schema changes
  - Check deprecation docs when upgrading Graphiti/Neo4j versions
- Test coverage: Manual testing documented in `docs/testing/manual-test-results-agent.md`; automated integration tests incomplete

**Source Attribution Incomplete in v2 Agent:**
- Files: `app/api/projects/[id]/chat/route.ts:252`, `lib/agent/v2/nodes/retrieval.ts`
- Why fragile:
  - sources array is populated but not extracted from retrieval node output
  - SSE done event has hardcoded empty sources placeholder
  - If retrieval node output schema changes, sources extraction breaks silently
- Safe modification:
  - Verify sources are populated in retrieval node state update before using
  - Add integration test for sources presence in done event
  - Add console warning if sources remain empty after retrieval

**Session Middleware SSR Client Configuration:**
- Files: `lib/supabase/middleware.ts`, API routes using `createClient()`
- Why fragile:
  - Session propagation broken (401 errors on protected endpoints)
  - No clear contract about when to use server vs client auth clients
  - Middleware may not properly forward auth cookies to Route Handlers
- Safe modification:
  - Always use `createClient()` from `lib/supabase/server.ts` in server components and API routes
  - Verify cookies are included in request before calling protected endpoints
  - Add debug logging for auth context in middleware
  - Test with actual multi-request sessions, not just single requests
- Test coverage: AuthN tested in smoke tests; gaps in session propagation

---

## Scaling Limits

**Database Connection Pool Not Initialized:**
- Current capacity: No pooling; each request opens new connection
- Limit: Supabase PostgreSQL (connection mode) limits concurrent connections; no pool means one connection per request until limit
- Scaling path:
  - Initialize pgbouncer pool in `manda-processing/src/main.py` lifespan manager
  - Configure pool size based on expected concurrency (e.g., 20-50)
  - Monitor pool utilization and connection wait times
  - Implement pool drain on shutdown for graceful termination

**Graphiti Neo4j Instance Single Node:**
- Current capacity: Docker-compose single Neo4j instance (development setup)
- Limit: Single node limits read throughput and availability; no failover
- Scaling path:
  - Set up Neo4j Aura (managed) or enterprise cluster for production
  - Implement read replicas for retrieval-heavy workloads
  - Configure replication for high availability
  - Monitor query latency and implement caching for frequently accessed facts

**Voyage API Rate Limiting:**
- Current capacity: No rate limiter on Voyage rerank calls
- Limit: Voyage API has rate limits; reranking large result sets can trigger throttling
- Scaling path:
  - Implement token bucket rate limiter for Voyage API calls
  - Cache rerank results for identical queries across users/deals
  - Reduce num_candidates if approaching rate limits
  - Monitor Voyage quota usage and plan for higher tier if needed

---

## Dependencies at Risk

**Graphiti Core Schema Compatibility:**
- Risk: Custom entity models depend on Graphiti BaseModel internals; reserved attribute names conflict
- Impact: Upgrading Graphiti can break entity model definitions
- Migration plan:
  - Pin Graphiti version with minimum/maximum bounds in requirements
  - Add schema validation tests for each Graphiti upgrade
  - Document all reserved attributes per Graphiti version
  - Maintain field name mapping if upstream reserves new attributes

**Neo4j Vector Index Configuration:**
- Risk: Vector similarity function (`vector.similarity.cosine`) availability depends on Neo4j version
- Impact: Knowledge graph search fails if Neo4j version downgraded or misconfigured
- Migration plan:
  - Document minimum Neo4j version (currently 5.26+)
  - Add health check endpoint to verify vector index availability
  - Implement graceful fallback to BM25-only search if vector index unavailable

**LangChain Streaming Compatibility:**
- Risk: StreamEvent format and token streaming API subject to change in LangChain major versions
- Impact: Streaming events in chat route may break with LangChain upgrade
- Migration plan:
  - Pin LangChain versions with clear upper bounds
  - Maintain wrapper types (TokenStreamEvent, SourceAddedEvent) to isolate from upstream changes
  - Add integration tests for streaming event format on every release

---

## Missing Critical Features

**Database Pool Lifecycle Management:**
- Problem: Backend service has no database connection pooling initialization or graceful shutdown
- Blocks: Proper resource management, graceful service restarts, connection leak prevention
- User Impact: Memory leaks over time; crashed connections not cleaned up; requests queue indefinitely when connections exhausted

**Unified Document Processing Pipeline:**
- Problem: Document upload handlers (document-parse, analyze-document, update-graph) have TODO placeholders but no implementation
- Blocks: Document content cannot be parsed or ingested into knowledge graph
- User Impact: Users can upload documents but they don't appear in search results or chat context

**CIM MVP v2 Integration:**
- Problem: CIM MVP uses standalone implementation (`lib/agent/cim-mvp/`); v2 agent has placeholder for CIM but uses MVP instead
- Blocks: Unified agent architecture; cannot mix CIM tools with general chat tools
- User Impact: CIM workflow isolated from general agent capabilities

**Login Credential Validation:**
- Problem: Login route accepts invalid credentials without verification
- Blocks: Proper authentication; unauthorized access possible
- User Impact: Security vulnerability; any credential combination grants access

**Session Persistence Across Requests:**
- Problem: Auth context not properly propagated in middleware; authenticated users receive 401 errors on subsequent API calls
- Blocks: Multi-step workflows; document uploads; any action requiring multiple API calls
- User Impact: Users appear to logout randomly mid-session; workflows broken after initial navigation

---

## Test Coverage Gaps

**Knowledge Explorer Ref Handling:**
- What's not tested: Contradiction Detection tab component rendering and ref updates
- Files: `components/knowledge-explorer/` (specific component unknown)
- Risk: React state loop crashes in production but passes test suite (not exercised)
- Priority: CRITICAL (affects entire Knowledge Explorer feature)

**Session Propagation in Multi-Request Flows:**
- What's not tested: Authenticated sequences (login → upload → process → retrieve)
- Files: Integration test suite (currently mocked or skipped)
- Risk: Session auth works in isolated tests but fails in real workflows
- Priority: CRITICAL (affects all authenticated workflows)

**Project Creation POST Handler:**
- What's not tested: Full project creation flow with error paths
- Files: `app/api/projects/route.ts`
- Risk: Unhandled exception crashes handler; returns 500 without details
- Priority: HIGH (core feature broken)

**Login Credential Validation:**
- What's not tested: Invalid credentials are rejected
- Files: `app/api/auth/login/route.ts`
- Risk: Any password accepted; no protection against brute force
- Priority: CRITICAL (security)

**Graphiti Entity Model Naming Conflicts:**
- What's not tested: Custom entity fields don't conflict with Graphiti reserved attributes
- Files: `manda-processing/src/graphiti/schema/entities.py`
- Risk: Schema changes (rename `name` → `company_name`) silently break on Graphiti upgrade
- Priority: HIGH (data model at risk)

**Multi-Tenant Isolation in Retrieval:**
- What's not tested: Knowledge graph queries respect organization_id boundaries
- Files: `manda-processing/src/graphiti/retrieval.py:236`
- Risk: Users can query knowledge outside their organization
- Priority: CRITICAL (security)

**Voyage Reranker Error Handling:**
- What's not tested: Reranker API timeouts/failures
- Files: `manda-processing/src/graphiti/retrieval.py:260-290` (rerank stage)
- Risk: Slow/failing reranker blocks entire retrieval pipeline
- Priority: MEDIUM (degraded performance)

---

## Recommendations (Priority Order)

1. **CRITICAL - Fix Session Authentication Propagation** (Blocks 80% of features)
   - Audit `lib/supabase/middleware.ts` and API route auth initialization
   - Add integration tests for multi-request authenticated flows
   - Add console logging to debug token/cookie propagation

2. **CRITICAL - Fix Login Credential Validation** (Security vulnerability)
   - Implement Supabase Auth credential verification in login route
   - Add rate limiting to prevent brute force
   - Add failed attempt logging

3. **CRITICAL - Fix React State Loop in Knowledge Explorer** (Feature broken)
   - Debug ref handling in contradiction detection component
   - Add E2E tests for ref-heavy components
   - Consider refactoring from refs to state-based approach

4. **HIGH - Implement Database Pool Initialization** (Resource leak)
   - Add connection pool setup in `src/main.py` lifespan
   - Implement graceful shutdown with pool cleanup
   - Monitor pool utilization

5. **HIGH - Fix Project Creation Server Error** (Core feature broken)
   - Debug unhandled exception in `app/api/projects/route.ts` POST
   - Add proper error logging and user-friendly error messages
   - Add integration tests for project creation flow

6. **MEDIUM - Wire Source Attribution in v2 Agent** (Feature incomplete)
   - Extract sources from retrieval node state
   - Test sources presence in chat done events
   - Update API documentation for sources field

7. **MEDIUM - Implement Document Processing Pipeline** (Feature incomplete)
   - Fill in document-parse, analyze-document, update-graph handlers
   - Add tests for each processing stage
   - Monitor processing queue for stuck jobs

---

*Concerns audit: 2026-01-20*
