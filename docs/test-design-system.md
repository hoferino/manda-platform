# System-Level Test Design - Manda Platform

**Document Status:** Complete
**Created:** 2025-11-24
**Phase:** Phase 2 - Solutioning (Pre-Implementation)
**Owner:** Max
**Test Architect:** Murat (tea agent)

---

## Executive Summary

This document provides a **system-level testability assessment** for the Manda M&A Intelligence Platform. It analyzes the architecture for testability, identifies critical quality attributes (ASRs), defines test strategy, and flags concerns that must be addressed before sprint planning.

**Key Findings:**
- ✅ **Architecture is testable** with clear service boundaries and mockable interfaces
- ⚠️ **3 high-priority concerns** requiring mitigation (LLM non-determinism, dual database consistency, async processing)
- 📊 **8 Architecturally Significant Requirements (ASRs)** requiring targeted testing
- 🎯 **Hybrid testing pyramid** recommended (30% unit, 30% component, 30% API, 10% E2E)

---

## 1. Architecture Testability Assessment

### 1.1 Controllability

**Score: ✅ PASS (with minor concerns)**

**Strengths:**

1. **Clear Service Boundaries**
   - Platform layer (data services) + Agent layer (intelligence) separation
   - Each layer testable independently
   - Tool-based integration provides natural mock points

2. **Mockable Interfaces**
   - Agent's 15 tools are Pydantic-validated functions
   - Can stub platform responses for agent testing
   - LangChain LLM adapters are mockable

3. **Event-Driven Architecture**
   - Document upload → processing → knowledge base update flow
   - Can inject synthetic events for testing
   - pg-boss queue enables test job injection

4. **Background Workers**
   - Decoupled from API layer
   - Can invoke workers directly in tests (bypass queue)
   - Results inspectable via database queries

5. **Type Safety**
   - Pydantic v2 models enable test data generation
   - Structured inputs/outputs make assertions straightforward
   - Schema-driven validation catches errors early

**Concerns:**

⚠️ **LLM Non-Determinism**
- **Issue:** Multi-model strategy (Gemini, Claude, OpenAI) introduces variability
- **Impact:** Cannot assert exact outputs in tests
- **Mitigation:**
  - Mock LLM calls in tests
  - Use `temperature=0` for deterministic outputs
  - Record/replay pattern (VCR for HTTP)
  - Test structural properties (has sources, confidence >70%) not exact text

⚠️ **Neo4j State Management**
- **Issue:** Graph mutations need careful setup/teardown for test isolation
- **Impact:** Tests can interfere with each other if not properly isolated
- **Mitigation:**
  - Test-specific graph namespaces (e.g., `test_deal_12345` prefix)
  - Transaction rollback after tests
  - Fixture builders for complex graph setups

---

### 1.2 Observability

**Score: ✅ PASS**

**Strengths:**

1. **Structured Logging**
   - FastAPI + Pydantic provides request/response logging
   - Every API call traceable with request ID
   - Error stack traces captured

2. **Database Query Tracing**
   - PostgreSQL queries logged in development
   - Neo4j Cypher queries traceable
   - Query performance analyzable (EXPLAIN plans)

3. **Processing Status Tracking**
   - Background jobs track status: queued → processing → complete/error
   - pg-boss provides job introspection
   - Document processing stages visible in database

4. **Workflow State Inspection**
   - LangGraph checkpoints enable workflow state inspection at any phase
   - CIM workflow state stored in `cim_workflow_states` table
   - Conversation history persisted for debugging

5. **Source Attribution**
   - Every finding linked to source document + page number
   - Neo4j `EXTRACTED_FROM` relationships preserve lineage
   - Enables validation of agent outputs

**Recommendations:**

📊 **Add Structured Logging for Agent Tool Calls**
- Log which tool was called, inputs, outputs, duration
- Enables debugging agent behavior in production
- Supports performance analysis

📊 **Implement Metrics Collection**
- Processing time per document
- LLM token usage per query
- Error rates by component
- Knowledge base query latency (p50, p95, p99)

---

### 1.3 Reliability

**Score: ⚠️ CONCERNS**

**Strengths:**

1. **RLS Policies**
   - User data isolation prevents cross-contamination in tests
   - Each test user operates in isolated data space
   - Supabase enforces RLS automatically

2. **Idempotent Processing**
   - Document processing can be retried safely
   - Re-processing same document produces same results
   - Enables retry logic for flaky operations

3. **Transactional Updates**
   - PostgreSQL ACID guarantees for knowledge base
   - Atomic updates within single database
   - Rollback on error

**Concerns:**

⚠️ **Dual Database Consistency**
- **Issue:** PostgreSQL + Neo4j updates must be atomic but no distributed transaction support
- **Risk:** Finding stored in Postgres but graph update fails → inconsistent state
- **Impact:** Tests may encounter partial state, hard to validate correctness
- **Mitigation:**
  - Implement compensating transactions (saga pattern)
  - Idempotent graph updates (can safely retry)
  - Monitor consistency in tests (validate both databases)

⚠️ **LLM API Failures**
- **Issue:** External LLM dependency (Anthropic, Google, OpenAI) can fail
- **Risk:** Tests fail due to external service downtime (not code bugs)
- **Impact:** Flaky tests, false negatives
- **Mitigation:**
  - Retry logic + exponential backoff (LangChain provides this)
  - Fallback to alternative provider
  - Mock LLM calls in most tests

⚠️ **Document Processing Failures**
- **Issue:** Complex Excel/PDF parsing can fail on edge cases
- **Risk:** Corrupted files, unsupported formats, memory exhaustion
- **Impact:** Tests need diverse document corpus
- **Mitigation:**
  - Robust error handling + partial results storage
  - Graceful degradation (extract what's possible)
  - Test with real M&A documents (anonymized) + synthetic edge cases

---

## 2. Architecturally Significant Requirements (ASRs)

### 2.1 ASR Identification

**Critical Quality Requirements from PRD NFRs:**

| ASR | Quality Attribute | Likelihood | Impact | Risk Score | Testing Approach |
|-----|-------------------|------------|--------|------------|------------------|
| **ASR-1: Hallucination Prevention** | Accuracy (CRITICAL) | High (3) | High (3) | **9** | Source attribution validation, confidence calibration tests |
| **ASR-2: RLS Data Isolation** | Security (CRITICAL) | Medium (2) | Critical (3) | **9** | Multi-user access tests, RLS policy validation |
| **ASR-3: Processing Throughput** | Performance | Medium (2) | High (3) | **6** | Load tests (100MB docs, 500+ doc deals) |
| **ASR-4: Knowledge Base Scalability** | Performance | Medium (2) | High (3) | **6** | Volume tests (10K+ findings, pgvector query latency) |
| **ASR-5: Document Format Support** | Reliability | High (3) | Medium (2) | **6** | Format compatibility tests (Excel formulas, OCR PDFs) |
| **ASR-6: Contradiction Detection Quality** | Accuracy | High (3) | High (3) | **9** | False positive/negative rate tracking |
| **ASR-7: Agent Tool Correctness** | Reliability | High (3) | Medium (2) | **6** | Tool contract tests, Pydantic validation |
| **ASR-8: Workflow State Persistence** | Reliability | Medium (2) | Medium (2) | **4** | LangGraph checkpoint tests, resume capability |

**Scoring Rationale:**
- **Likelihood:** How often will this quality attribute be stressed?
- **Impact:** What's the consequence if this fails?
- **Risk Score:** Likelihood × Impact (prioritizes testing effort)

**Critical ASRs (Score 9):**
1. **ASR-1:** Hallucination destroys user trust → must validate sources
2. **ASR-2:** Security breach exposes sensitive M&A data → must test RLS
3. **ASR-6:** Poor contradiction detection misses critical risks → must measure quality

---

### 2.2 ASR Testing Strategy

#### ASR-1: Hallucination Prevention

**Requirement:** NFR-QUAL-001 (Source attribution for all findings)

**Tests:**

1. **Source Attribution Validation**
   ```python
   def test_finding_has_valid_source():
       finding = extract_finding_from_document(test_doc)
       assert finding.source_document is not None
       assert finding.page_number is not None
       assert finding.confidence >= 0.0 and finding.confidence <= 1.0
   ```

2. **Confidence Calibration**
   - Track LLM confidence vs actual accuracy
   - If confidence >90%, accuracy should be >90%
   - If confidence <50%, flag for human review

3. **Cross-Validation**
   - When multiple documents mention same fact, verify consistency
   - Test contradiction detection algorithm

**Acceptance Criteria:**
- ✅ 100% of findings have source attribution
- ✅ Confidence calibration within ±10% (e.g., 80% confidence → 70-90% accuracy)
- ✅ Cross-document contradictions detected with >80% recall

---

#### ASR-2: RLS Data Isolation

**Requirement:** NFR-SEC-001, NFR-SEC-002 (Data confidentiality, auth/authz)

**Tests:**

1. **Multi-User Access Tests**
   ```python
   def test_user_cannot_access_other_users_deals():
       user_a = create_test_user("user_a")
       user_b = create_test_user("user_b")

       deal_a = create_deal(user_a, "Deal A")

       # User B attempts to access Deal A
       with authenticate_as(user_b):
           response = client.get(f"/api/deals/{deal_a.id}")
           assert response.status_code == 403  # Forbidden
   ```

2. **RLS Policy Validation**
   - Direct database queries (bypassing API) must enforce RLS
   - Test every table with user-specific data

3. **Session Management**
   - Test auth token expiration
   - Test session hijacking prevention

**Acceptance Criteria:**
- ✅ 0 RLS policy violations across all tables
- ✅ 100% of unauthorized access attempts blocked
- ✅ Session security validated (OWASP guidelines)

---

#### ASR-3: Processing Throughput

**Requirement:** NFR-PERF-001 (Document processing within SLOs)

**Tests:**

1. **Large Document Processing**
   ```python
   def test_process_100mb_excel_within_slo():
       large_excel = generate_test_excel(size_mb=100, sheets=20)

       start_time = time.time()
       job_id = submit_processing_job(large_excel)
       wait_for_completion(job_id, timeout_seconds=600)  # 10 min SLO
       duration = time.time() - start_time

       assert duration <= 600, f"Processing took {duration}s (SLO: 600s)"
   ```

2. **Concurrent Processing**
   - Upload 10 documents simultaneously
   - Verify all complete within acceptable time
   - Check worker resource utilization

**Acceptance Criteria:**
- ✅ 100MB Excel (20 sheets) processes in <10 minutes (p95)
- ✅ 10 concurrent documents process without degradation
- ✅ Worker CPU/memory within limits (no OOM)

---

#### ASR-4: Knowledge Base Scalability

**Requirement:** NFR-PERF-002 (Knowledge base queries <2 seconds)

**Tests:**

1. **Volume Tests**
   ```python
   def test_query_performance_with_10k_findings():
       # Seed database with 10K findings
       seed_findings(count=10000, deal_id=test_deal.id)

       start_time = time.time()
       results = query_knowledge_base("revenue growth", limit=10)
       duration = time.time() - start_time

       assert duration <= 2.0, f"Query took {duration}s (SLO: 2.0s)"
       assert len(results) == 10
   ```

2. **pgvector Performance**
   - Test similarity search with varying embedding dimensions
   - Verify indexes are used (EXPLAIN plans)

**Acceptance Criteria:**
- ✅ Knowledge base queries <2s at 10K findings (p95)
- ✅ pgvector indexes used for similarity search
- ✅ Query latency scales sub-linearly with findings count

---

#### ASR-5: Document Format Support

**Requirement:** NFR-QUAL-002 (Support Excel, PDF, Word)

**Tests:**

1. **Format Compatibility Matrix**
   | Format | Test Case | Expected Outcome |
   |--------|-----------|------------------|
   | Excel (.xlsx) | Formulas preserved | Extract formula text + result |
   | Excel (.xlsx) | Pivot tables | Extract underlying data |
   | PDF (native) | Text extraction | Full text with layout |
   | PDF (scanned) | OCR | Text extracted via OCR |
   | Word (.docx) | Tables | Table structure preserved |

2. **Edge Cases**
   - Corrupted files → graceful error
   - Password-protected files → prompt for password
   - Very large files (500MB) → chunked processing

**Acceptance Criteria:**
- ✅ 95% of real M&A documents parse successfully
- ✅ Excel formulas preserved (validation via spot checks)
- ✅ OCR accuracy >90% on scanned PDFs

---

#### ASR-6: Contradiction Detection Quality

**Requirement:** NFR-QUAL-001 (Detect contradictions across documents)

**Tests:**

1. **False Positive/Negative Rate Tracking**
   - Curate dataset of known contradictions (ground truth)
   - Measure: Precision, Recall, F1 score
   - Target: F1 >0.75

2. **Cross-Domain Contradiction Tests**
   - Financial × Operational: "EBITDA $10M" vs "Operating loss $2M"
   - Contracts × Projections: "3-year contract" vs "5-year revenue forecast"
   - Growth × Quality: "100% YoY growth" vs "High customer churn"

**Acceptance Criteria:**
- ✅ Contradiction detection F1 score >0.75
- ✅ False positive rate <20% (precision >80%)
- ✅ Cross-domain patterns detected (11+ pattern types)

---

#### ASR-7: Agent Tool Correctness

**Requirement:** FR-AGENT-002 (12 agent tools functional)

**Tests:**

1. **Tool Contract Tests**
   ```python
   def test_query_knowledge_base_contract():
       # Generate test data from Pydantic schema
       valid_input = KnowledgeQueryInput(
           query="test query",
           filters={"deal_id": "test_deal"},
           limit=10
       )

       output = query_knowledge_base(valid_input)

       # Pydantic validates output schema automatically
       assert isinstance(output, KnowledgeQueryOutput)
       assert len(output.findings) <= 10
       assert output.query_time_ms > 0
   ```

2. **Tool Integration Tests**
   - Test each tool against real platform services
   - Verify error handling (invalid inputs, service failures)

**Acceptance Criteria:**
- ✅ All 15 tools pass contract tests
- ✅ Invalid inputs rejected with clear error messages (Pydantic validation)
- ✅ Tool integration tests pass against test database

---

#### ASR-8: Workflow State Persistence

**Requirement:** FR-CIM-004 (Resume CIM workflow from any phase)

**Tests:**

1. **Checkpoint Save/Resume**
   ```python
   def test_cim_workflow_resume_from_phase_5():
       # Start workflow and progress to phase 5
       workflow_id = start_cim_workflow(deal_id=test_deal.id)
       advance_to_phase(workflow_id, target_phase=5)

       # Simulate interruption (kill process)
       state_before = get_workflow_state(workflow_id)

       # Resume workflow
       resume_cim_workflow(workflow_id)
       state_after = get_workflow_state(workflow_id)

       assert state_after.current_phase == 5
       assert state_after.buyer_persona == state_before.buyer_persona
   ```

2. **Human-in-the-Loop Interrupt Tests**
   - Workflow pauses at expected phases (3, 4, ...)
   - User input correctly updates state
   - Workflow resumes after user approval

**Acceptance Criteria:**
- ✅ Workflow resumes from any of 14 phases
- ✅ State preserved across interruptions
- ✅ Human-in-the-loop interrupts work at all checkpoints

---

## 3. Test Levels Strategy

### 3.1 Recommended Testing Pyramid

Based on Manda's architecture (web UI + API + background processing + LLM agents + dual databases):

```
        /\
       /E2E\          10% - Critical user journeys (Playwright)
      /------\
     /  API   \       30% - Service contracts, business logic
    /----------\
   / Component  \     30% - React components, tool functions
  /--------------\
 /     Unit       \   30% - Utilities, parsers, validators
/------------------\
```

**Rationale:**
- **Complexity:** Multi-layer architecture (UI, API, workers, databases, LLMs)
- **Async Processing:** Background jobs make E2E tests slow and flaky
- **External Dependencies:** LLM APIs expensive/slow to call in tests
- **Quality Attributes:** ASRs require targeted testing at multiple levels

---

### 3.2 Test Level Breakdown

#### Unit Tests (30%)

**Scope:**
- Pure functions (no I/O)
- Utilities, parsers, validators
- Pydantic models
- Business logic (no database calls)

**Examples:**
- Document parser: Extract text from Excel/PDF
- Confidence calibration: Calculate accuracy metrics
- Finding deduplication: Identify duplicate findings

**Technology:**
- Backend: Pytest
- Frontend: Jest

**Characteristics:**
- Fast (<1ms per test)
- No external dependencies
- Deterministic
- High code coverage target (80%+)

---

#### Component Tests (30%)

**Scope:**
- React components (UI)
- Agent tools (isolated)
- Service classes (mocked dependencies)

**Examples:**
- React: Render `ProjectCard` component with test props
- Agent: `query_knowledge_base()` tool with mocked database
- Service: `DocumentProcessingService` with mocked Docling

**Technology:**
- Frontend: Jest + React Testing Library
- Backend: Pytest with mocks

**Characteristics:**
- Medium speed (10-100ms per test)
- Mocked external dependencies
- Focus on component behavior

---

#### API Tests (30%)

**Scope:**
- FastAPI endpoints
- Service integration
- Database interactions (real PostgreSQL, mocked Neo4j)

**Examples:**
- POST `/api/deals` creates deal in database
- GET `/api/documents/{id}` returns document with RLS enforcement
- POST `/api/chat` invokes agent with mocked LLM

**Technology:**
- Pytest + FastAPI TestClient
- Testcontainers for PostgreSQL
- Mocked Neo4j, mocked LLMs

**Characteristics:**
- Slower (100ms-1s per test)
- Real database (PostgreSQL)
- Mocked external services (LLMs, Neo4j)

---

#### E2E Tests (10%)

**Scope:**
- Critical user journeys
- End-to-end flows across UI + API + workers
- Smoke tests for deployments

**Examples:**
- Upload document → process → query → view findings
- Create project → upload docs → generate IRL → export
- Chat with agent → receive answer with sources

**Technology:**
- Playwright (web UI)
- Real PostgreSQL, real Neo4j
- Mocked LLMs (recorded responses)

**Characteristics:**
- Very slow (10s-60s per test)
- All services running
- High maintenance cost
- Critical paths only

---

## 4. NFR Testing Approach

### 4.1 Security Testing

**ASR-2: RLS Data Isolation (CRITICAL)**

**Tests:**

1. **Authentication & Authorization**
   - Supabase Auth integration (email/password, magic links, OAuth)
   - Session management (token expiration, refresh)
   - Password reset flow

2. **RLS Policy Enforcement**
   - Multi-user tests (User A cannot access User B's deals)
   - Direct database queries (RLS enforced even outside API)
   - Test all tables: deals, documents, findings, insights, conversations

3. **Secret Handling**
   - Environment variables (no hardcoded keys)
   - API key rotation
   - Secure storage (Supabase Vault)

4. **OWASP Top 10**
   - SQL injection: Supabase client prevents (parameterized queries)
   - XSS: React escapes by default
   - CSRF: Tokens on state-changing requests
   - Dependency vulnerabilities: Snyk/Dependabot

**Test Approach:**
- **E2E (Playwright):** Login flows, session management, unauthorized access attempts
- **API (Pytest):** RLS policy tests with multiple test users
- **Security Scanning:** OWASP ZAP, Snyk for dependency vulnerabilities

**Acceptance Criteria:**
- ✅ 0 RLS violations across all tables
- ✅ 100% unauthorized access attempts blocked
- ✅ 0 critical/high vulnerabilities (Snyk scan)
- ✅ OWASP Top 10 validated

---

### 4.2 Performance Testing

**ASR-3: Processing Throughput**
**ASR-4: Knowledge Base Scalability**

**SLOs from NFR-PERF-001, NFR-PERF-002:**
- Chat responses: 3-5 seconds (simple queries)
- Knowledge base queries: <2 seconds
- Document processing: Standard Excel (5-10 sheets) within 5-10 minutes
- Support 500+ documents per deal, 10K+ findings

**Tests:**

1. **Load Testing (k6)**
   - Simulate 10 concurrent users querying knowledge base
   - Measure: Throughput (requests/sec), latency (p50, p95, p99)
   - Target: <2s p95 latency at 10K findings

2. **Volume Testing**
   - Seed database with 500 documents, 10K findings
   - Query knowledge base
   - Measure pgvector query latency
   - Validate: Sub-linear scaling

3. **Document Processing Tests**
   - Upload 100MB Excel (20 sheets)
   - Measure: Parse time, embedding generation time, total processing time
   - Target: <10 minutes

4. **Background Worker Scalability**
   - Queue 100 processing jobs
   - Measure: Queue depth, worker throughput, job latency
   - Validate: Parallelism works (multiple workers process concurrently)

**Test Approach:**
- **Load Testing:** k6 scripts against staging environment
- **Volume Testing:** Pytest with large datasets
- **Profiling:** py-spy for CPU, memory profiling

**Acceptance Criteria:**
- ✅ Knowledge base queries <2s at 10K findings (p95)
- ✅ 100MB Excel processes in <10 minutes (p95)
- ✅ 10 concurrent users supported without degradation
- ✅ Worker parallelism validated (queue clears faster with more workers)

---

### 4.3 Reliability Testing

**ASR-5: Document Format Support**
**ASR-7: Agent Tool Correctness**
**ASR-8: Workflow State Persistence**

**Tests:**

1. **Document Format Support**
   - Test matrix: Excel (.xlsx, .xls), PDF (native, scanned), Word (.docx, .doc)
   - Edge cases: Corrupted files, password-protected, very large (500MB)
   - Validate: Formulas preserved, tables extracted, OCR accuracy >90%

2. **Error Handling**
   - Simulated failures: LLM API timeout, database connection lost, worker crash
   - Validate: Graceful degradation, retry logic, partial results stored

3. **Tool Contract Tests**
   - Generate test data from Pydantic schemas
   - Validate all 15 agent tools
   - Test invalid inputs (Pydantic should reject)

4. **Workflow Persistence**
   - Pause CIM workflow at each of 14 phases
   - Resume and verify state preserved
   - Test: Buyer persona, narrative outline, slides

**Test Approach:**
- **Document Parser Tests:** Real M&A documents (anonymized) + synthetic edge cases
- **Chaos Engineering:** Kill workers mid-processing, verify recovery
- **Contract Tests:** Pytest with Pydantic schema validation
- **Workflow Tests:** LangGraph checkpoint save/resume

**Acceptance Criteria:**
- ✅ 95% of real M&A documents parse successfully
- ✅ Excel formulas preserved (spot check validation)
- ✅ All 15 agent tools pass contract tests
- ✅ Workflow resumes from any of 14 phases
- ✅ Error handling tested for all critical paths

---

## 5. Testability Concerns & Blockers

### 5.1 High Priority Concerns

#### CONCERN-1: LLM Non-Determinism

**Issue:** Gemini/Claude/OpenAI responses vary between runs → flaky tests

**Impact:**
- Cannot assert exact outputs in tests
- Different runs produce different results
- Hard to validate correctness

**Mitigation:**

1. **Use `temperature=0` for Determinism**
   ```python
   llm = ChatAnthropic(model="claude-sonnet-4-5", temperature=0)
   ```

2. **Record/Replay LLM Responses (VCR Pattern)**
   ```python
   # First run: Record LLM response
   with vcr.use_cassette('test_query.yaml'):
       response = agent.query("What is the revenue?")

   # Subsequent runs: Replay recorded response
   with vcr.use_cassette('test_query.yaml'):
       response = agent.query("What is the revenue?")  # Same response
   ```

3. **Test Structural Properties (Not Exact Text)**
   ```python
   def test_query_returns_findings_with_sources():
       response = agent.query("What is the revenue?")

       # Don't assert exact text
       # assert response.text == "Revenue is $10M"  # ❌ Flaky

       # Assert structural properties
       assert len(response.findings) > 0  # ✅ Stable
       assert all(f.source is not None for f in response.findings)
       assert response.confidence >= 0.7
   ```

4. **Mock LLM Calls in Most Tests**
   - Unit/component tests: Always mock
   - API tests: Mock LLM, use real database
   - E2E tests: Use recorded responses (VCR)

**Status:** ⚠️ MANAGEABLE with discipline

**Action Items:**
- [ ] Implement VCR-like recorder for LLM responses (Sprint 0)
- [ ] Document mocking strategy in test guidelines
- [ ] Train team on structural property testing

---

#### CONCERN-2: Dual Database Consistency

**Issue:** PostgreSQL + Neo4j updates must be atomic but no distributed transaction support

**Impact:**
- Test cleanup complex (must clean both databases)
- Risk of inconsistent state in tests
- Hard to validate correctness (must check both databases)

**Example Failure Scenario:**
```python
# Store finding in PostgreSQL
finding = create_finding(text="Revenue is $10M", deal_id=deal.id)  # ✅ Success

# Create graph node in Neo4j
create_graph_node(finding.id)  # ❌ Fails (network error)

# Now inconsistent: Finding in Postgres, not in Neo4j
```

**Mitigation:**

1. **Idempotent Updates**
   ```python
   def create_finding_with_graph(finding_data):
       # Step 1: Create in PostgreSQL (source of truth)
       finding = db.create_finding(finding_data)

       # Step 2: Create graph node (idempotent)
       try:
           graph.create_node(finding.id)
       except Exception as e:
           # Log error, but don't fail (can retry later)
           log.error(f"Graph update failed: {e}")
           # Mark finding as "graph_sync_pending"
           db.update_finding(finding.id, graph_sync_pending=True)

       return finding
   ```

2. **Test-Specific Database Namespaces**
   ```python
   # Use prefixed IDs for test isolation
   test_deal_id = f"test_{uuid.uuid4()}"

   # Cleanup: Delete all nodes with prefix
   def cleanup_test_data():
       db.execute("DELETE FROM deals WHERE id LIKE 'test_%'")
       graph.execute("MATCH (n) WHERE n.id STARTS WITH 'test_' DETACH DELETE n")
   ```

3. **Compensating Transactions (Saga Pattern)**
   ```python
   def create_finding_with_compensation(finding_data):
       try:
           finding = db.create_finding(finding_data)
           graph.create_node(finding.id)
           return finding
       except Exception as e:
           # Compensation: Rollback PostgreSQL change
           db.delete_finding(finding.id)
           raise
   ```

4. **Consistency Monitoring in Tests**
   ```python
   def test_finding_creation_consistency():
       finding = create_finding_with_graph(test_data)

       # Validate both databases
       assert db.get_finding(finding.id) is not None
       assert graph.get_node(finding.id) is not None
   ```

**Status:** ⚠️ MANAGEABLE with careful design

**Action Items:**
- [ ] Implement idempotent graph updates (Epic 3)
- [ ] Add test cleanup utilities for dual database (Sprint 0)
- [ ] Document consistency patterns in architecture guide

---

#### CONCERN-3: Background Processing Timing

**Issue:** Async document processing makes E2E tests timing-sensitive

**Impact:**
- Tests must wait for processing completion → slow
- Timing-sensitive waits → flaky tests
- Hard to debug failures (async stack traces)

**Example Flaky Test:**
```python
def test_document_processing_e2e():
    # Upload document
    doc_id = upload_document(test_file)

    # ❌ WRONG: Fixed sleep (too short → fails, too long → slow)
    time.sleep(10)

    # Check findings
    findings = get_findings(doc_id)
    assert len(findings) > 0  # Flaky: May not be ready yet
```

**Mitigation:**

1. **Poll for Completion with Timeout**
   ```python
   def wait_for_processing(doc_id, timeout=60):
       start = time.time()
       while time.time() - start < timeout:
           doc = get_document(doc_id)
           if doc.status == "processed":
               return doc
           time.sleep(1)  # Poll every second
       raise TimeoutError(f"Document {doc_id} not processed in {timeout}s")

   def test_document_processing_e2e():
       doc_id = upload_document(test_file)
       wait_for_processing(doc_id, timeout=60)  # ✅ Robust

       findings = get_findings(doc_id)
       assert len(findings) > 0
   ```

2. **Test Hooks to Bypass Queue**
   ```python
   # In tests: Invoke worker directly (synchronous)
   def process_document_sync(doc_id):
       worker = DocumentProcessingWorker()
       worker.process(doc_id)  # Runs synchronously

   def test_document_processing_fast():
       doc_id = upload_document(test_file)
       process_document_sync(doc_id)  # No queue, instant

       findings = get_findings(doc_id)
       assert len(findings) > 0
   ```

3. **Separate "Logic" Tests from "E2E Flow" Tests**
   - **Logic Tests (Fast):** Test worker code directly (no queue)
   - **E2E Flow Tests (Slow):** Test full async flow (fewer tests)

**Status:** ✅ ADDRESSABLE with test architecture

**Action Items:**
- [ ] Implement polling utility for async operations (Sprint 0)
- [ ] Add test mode flag to bypass queue (Epic 1)
- [ ] Document async testing patterns in test guidelines

---

### 5.2 Medium Priority Concerns

#### CONCERN-4: Knowledge Graph Test Data Setup

**Issue:** Neo4j graph state complex to seed for tests

**Impact:**
- Test setup verbose (many Cypher queries)
- Hard to maintain (brittle fixtures)
- Slow (graph operations not as fast as SQL inserts)

**Mitigation:**
- Graph fixture builders (factory pattern)
- Test data snapshots (load pre-built graph state)
- Shared fixtures for common scenarios

**Status:** ⏳ DEFER to epic-level test planning

---

#### CONCERN-5: CIM Workflow Human-in-the-Loop Testing

**Issue:** 14-phase workflow with interrupts hard to test E2E

**Impact:**
- Manual testing required for full workflow
- Automated tests cannot simulate human decisions
- Long test execution time (14 phases)

**Mitigation:**
- Unit test each phase in isolation
- Integration test workflow state transitions
- E2E test critical paths only (not all 14 phases every time)
- Automated decision injection for test runs

**Status:** ⏳ DEFER to Epic 9 planning

---

## 6. Recommendations for Sprint 0 (Test Infrastructure)

### Before Starting Epic 1 (Foundation)

#### 1. Set up Test Framework

**Workflow:** `/bmad:bmm:workflows:framework`

**Tasks:**
- [ ] Pytest + FastAPI TestClient (backend)
- [ ] Jest + React Testing Library (frontend)
- [ ] Playwright (E2E)
- [ ] Testcontainers for PostgreSQL
- [ ] Configure test database (separate from dev)

**Deliverables:**
- `tests/` directory structure
- `pytest.ini`, `jest.config.js` configured
- Sample test passing in CI

---

#### 2. Configure CI Pipeline

**Workflow:** `/bmad:bmm:workflows:ci`

**Tasks:**
- [ ] GitHub Actions (or equivalent)
- [ ] Run unit/component tests on every commit
- [ ] Run API tests on PR to main
- [ ] Run E2E tests nightly
- [ ] Code coverage reporting (Codecov)

**Deliverables:**
- `.github/workflows/test.yml`
- CI badge in README
- Coverage report on every PR

---

#### 3. Implement Test Data Factories

**Tasks:**
- [ ] Pydantic model → test data generator
- [ ] Deal/Document/Finding factories
- [ ] Faker for realistic M&A data (company names, financial metrics)
- [ ] Graph fixture builders (Neo4j test data)

**Example:**
```python
# tests/factories.py
from faker import Faker
from pydantic import BaseModel

fake = Faker()

def create_test_deal(**overrides):
    defaults = {
        "name": fake.company(),
        "industry": "Technology",
        "status": "active",
        "user_id": "test_user"
    }
    return Deal(**{**defaults, **overrides})

def create_test_finding(**overrides):
    defaults = {
        "text": fake.sentence(),
        "source_document": "test_doc.pdf",
        "page_number": fake.random_int(1, 50),
        "confidence": fake.random.uniform(0.7, 0.95)
    }
    return Finding(**{**defaults, **overrides})
```

---

#### 4. LLM Mocking Strategy

**Tasks:**
- [ ] VCR-like recorder for LLM responses
- [ ] Mock LangChain LLM adapters in tests
- [ ] Test mode flag to use recorded responses
- [ ] Document mocking patterns

**Example:**
```python
# tests/mocks/llm_mock.py
class MockLLM:
    def __init__(self, recorded_responses):
        self.responses = recorded_responses
        self.call_count = 0

    def invoke(self, prompt):
        response = self.responses[self.call_count]
        self.call_count += 1
        return response

# In test
mock_llm = MockLLM(recorded_responses=[
    "Revenue is $10M according to financial statements.",
    "EBITDA margin is 25%."
])
agent = Agent(llm=mock_llm)
response = agent.query("What is the revenue?")
assert "10M" in response
```

---

## 7. Test Strategy Summary

### 7.1 Testing Pyramid

| Level | Coverage | Speed | Technology | Focus |
|-------|----------|-------|------------|-------|
| Unit | 30% | <1ms | Pytest, Jest | Pure functions, utilities |
| Component | 30% | 10-100ms | RTL, Pytest + mocks | React components, agent tools |
| API | 30% | 100ms-1s | Pytest + TestClient | Endpoints, service integration |
| E2E | 10% | 10s-60s | Playwright | Critical user journeys |

---

### 7.2 Critical ASRs

| ASR | Risk | Testing Approach | Target Metric |
|-----|------|------------------|---------------|
| ASR-1: Hallucination Prevention | 9 | Source attribution validation | 100% findings have sources |
| ASR-2: RLS Data Isolation | 9 | Multi-user access tests | 0 violations |
| ASR-3: Processing Throughput | 6 | Load tests | <10min for 100MB Excel (p95) |
| ASR-4: Knowledge Base Scalability | 6 | Volume tests | <2s queries at 10K findings (p95) |
| ASR-6: Contradiction Detection | 9 | F1 score tracking | F1 >0.75 |

---

### 7.3 Testability Concerns

| Concern | Priority | Status | Action Required |
|---------|----------|--------|-----------------|
| LLM Non-Determinism | High | ⚠️ Manageable | Implement VCR-like recorder (Sprint 0) |
| Dual Database Consistency | High | ⚠️ Manageable | Idempotent updates, test cleanup utilities |
| Background Processing Timing | High | ✅ Addressable | Polling utility, test mode flag |
| Graph Test Data Setup | Medium | ⏳ Deferred | Epic-level planning |
| CIM Workflow Testing | Medium | ⏳ Deferred | Epic 9 planning |

---

## 8. Next Steps

### Immediate Actions (Before Sprint Planning)

1. **Review this document with team** → Align on test strategy
2. **Set up test infrastructure (Sprint 0)** → Framework, CI, factories, mocking
3. **Define DoD for epics** → Include test coverage requirements
4. **Prioritize ASRs** → Focus testing effort on critical quality attributes

### During Epic Development

1. **TDD for Critical Paths** → Write tests first for ASRs
2. **Code Review Checklist** → Verify test coverage, assertions quality
3. **Monitor Test Health** → Flaky tests, slow tests, coverage trends
4. **Continuous Improvement** → Retrospective on test effectiveness

---

## 9. Conclusion

**Manda's architecture is testable** with clear boundaries and mockable interfaces. The primary challenges are:
1. **LLM non-determinism** (mitigated with mocking and structural assertions)
2. **Dual database consistency** (mitigated with idempotent updates)
3. **Async processing timing** (mitigated with polling and test modes)

**Recommendation:** Proceed to sprint planning with the following prerequisites:
- ✅ Test framework set up (Sprint 0)
- ✅ CI pipeline configured
- ✅ Test data factories implemented
- ✅ LLM mocking strategy defined

**Test strategy is risk-based:** Focus on ASRs (hallucination prevention, RLS, contradiction detection) with targeted testing at appropriate levels.

---

**Document Complete**

Generated by: Murat (tea agent)
Date: 2025-11-24
Phase: Phase 2 - Solutioning (Pre-Implementation)
Next Step: Update workflow status with test-design completion
