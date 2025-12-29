# Manda Platform - Comprehensive Test Strategy

**Document Status:** Draft
**Created:** 2025-12-23
**Author:** Murat (Test Architect Agent)
**Version:** 1.0

---

## Executive Summary

This test strategy provides comprehensive coverage for the Manda M&A Intelligence Platform, focusing on the two highest-risk areas identified:

1. **Document Processing Pipeline** (P0) - Upload → Parsing → Analysis → Knowledge Graph
2. **Chat & Knowledge Retrieval** (P0) - Conversational AI, Write-back, Intent Classification

Risk assessment based on **Probability × Impact** scoring from test architecture knowledge base.

---

## 1. Test Levels Overview

| Level | Coverage Target | Tools | Execution Time |
|-------|-----------------|-------|----------------|
| **Unit** | Business logic, utilities | Vitest, pytest | < 30s |
| **Integration** | API endpoints, DB operations | Vitest, pytest + fixtures | 2-5 min |
| **E2E** | Critical user journeys | Playwright MCP | 5-15 min |
| **Contract** | Service-to-service APIs | Pact (future) | 1-2 min |

---

## 2. Priority Matrix (Risk-Based)

### P0 - Critical (Must Test) - Risk Score 6-9

| Feature | Probability | Impact | Risk Score | Rationale |
|---------|-------------|--------|------------|-----------|
| Authentication Flow | Low | Critical | 6 | Access control, Supabase Auth |
| Document Upload | Medium | Critical | 6-9 | Core value, GCS integration |
| Document Processing Pipeline | High | Critical | 9 | Complex async, Docling + Gemini |
| Chat Message Send/Receive | Medium | High | 6 | Core user interaction |
| Knowledge Retrieval (Hybrid Search) | High | High | 9 | Graphiti + Voyage, accuracy-critical |
| Knowledge Write-back | High | High | 9 | Data integrity, multi-system |
| Multi-tenant Isolation | Low | Critical | 6 | Security, RLS enforcement |

### P1 - High (Should Test) - Risk Score 4-5

| Feature | Probability | Impact | Risk Score |
|---------|-------------|--------|------------|
| Project CRUD | Low | Medium | 4 |
| Conversation Management | Medium | Medium | 4-5 |
| Q&A Workflow | Medium | Medium | 4-5 |
| Knowledge Explorer Search | Medium | Medium | 4-5 |
| Quick Actions | Medium | Medium | 4-5 |
| File Attachment in Chat | Medium | Medium | 4-5 |

### P2 - Medium (Nice to Test) - Risk Score 2-3

| Feature | Probability | Impact | Risk Score |
|---------|-------------|--------|------------|
| Dashboard Display | Low | Low | 2 |
| IRL Checklist | Low | Medium | 3 |
| CIM Builder (new) | High | Medium | 4-5 |
| Deliverables | Low | Low | 2 |

---

## 3. E2E Test Cases - Document Processing Pipeline (P0)

### DP-001: Document Upload - Happy Path
**Priority:** P0 | **Risk:** Critical | **Automation:** Required

```gherkin
Feature: Document Upload Pipeline
  As an M&A analyst
  I want to upload documents to the data room
  So that they are processed and available for analysis

  @p0 @smoke @document-processing
  Scenario: Upload PDF document successfully
    Given I am logged in as "maxi.hoefer@gmx.net"
    And I am on the data room page for project "Edge Case Test Deal"
    When I click the "Upload" button
    And I select a PDF file "sample-cim.pdf" (< 50MB)
    Then I should see the document appear in the file list
    And the document status should show "Uploading" or "Processing"
    And within 90 seconds the status should change to "Processed" or "Analyzed"
    And the document should be searchable in Knowledge Explorer
```

**Test Data Requirements:**
- Sample PDF: `e2e/fixtures/sample-cim.pdf` (existing)
- Sample DOCX: `e2e/fixtures/sample-contract.docx` (create)
- Sample XLSX: `e2e/fixtures/sample-financials.xlsx` (create)

**Selectors (from live exploration):**
- Upload button: `button:has-text("Upload")`
- File input: `input[type="file"]`
- Status indicators: `[data-status="processed"], [data-status="analyzed"]`

---

### DP-002: Document Upload - Large File Handling
**Priority:** P0 | **Risk:** High | **Automation:** Required

```gherkin
  @p0 @edge-case
  Scenario: Upload large document (> 10MB)
    Given I am on the data room page
    When I upload a PDF file of 15MB
    Then I should see upload progress indicator
    And the upload should complete within 60 seconds
    And processing should complete within 3 minutes
```

---

### DP-003: Document Upload - Error Handling
**Priority:** P0 | **Risk:** High | **Automation:** Required

```gherkin
  @p0 @error-handling
  Scenario: Upload unsupported file type
    Given I am on the data room page
    When I attempt to upload a ".exe" file
    Then I should see an error message "Unsupported file type"
    And the file should not appear in the document list

  @p0 @error-handling
  Scenario: Upload when processing service unavailable
    Given the processing service is unavailable
    When I upload a document
    Then I should see a graceful error message
    And I should be offered a retry option
```

---

### DP-004: Document Processing Status Tracking
**Priority:** P0 | **Risk:** High | **Automation:** Required

```gherkin
  @p0 @processing
  Scenario: Track document through processing pipeline
    Given I have uploaded a document
    When the document is being processed
    Then I should see status progression:
      | Status | Description |
      | pending | Document received |
      | processing | Parsing with Docling |
      | analyzing | Analyzing with Gemini |
      | ingesting | Indexing to Graphiti |
      | processed | Complete |
    And I should be able to view the document at any stage
```

---

## 4. E2E Test Cases - Chat & Knowledge Retrieval (P0)

### CH-001: Basic Chat Query - Happy Path
**Priority:** P0 | **Risk:** Critical | **Automation:** Required

```gherkin
Feature: Chat & Knowledge Retrieval
  As an M&A analyst
  I want to ask questions about my deal documents
  So that I can get AI-powered answers with citations

  @p0 @smoke @chat
  Scenario: Send a simple factual query
    Given I am logged in and on the chat page for a project with documents
    And the project has processed documents in the knowledge base
    When I type "What is the company revenue?" in the chat input
    And I press Enter or click Send
    Then I should see a loading/streaming indicator
    And within 30 seconds I should see an assistant response
    And the response should contain relevant content
    And the response should include source citations
```

**Selectors (from live exploration):**
- Chat input: `textbox[placeholder*="Ask a question"]` or `[data-testid="chat-message-input"]`
- Send button: `button:has-text("Send")` or `button[aria-label="Send message"]`
- Assistant message: `[data-role="assistant"]`, `.assistant-message`
- Citation links: `[data-testid="citation-link"]`

---

### CH-002: Knowledge Write-back (Correction)
**Priority:** P0 | **Risk:** Critical | **Automation:** Required

```gherkin
  @p0 @knowledge-writeback
  Scenario: User corrects a fact and system remembers
    Given I am in a chat conversation
    When I send "The Q3 revenue was actually $5.2M, not $4.8M"
    Then the assistant should acknowledge the correction
    And when I start a new conversation and ask "What was Q3 revenue?"
    Then the response should mention "$5.2M"
    And the response should indicate it was a user-provided correction
```

**Backend API to test:**
- `POST /api/graphiti/ingest` with `source_type: "correction"`

---

### CH-003: Knowledge Write-back (New Information)
**Priority:** P0 | **Risk:** High | **Automation:** Required

```gherkin
  @p0 @knowledge-writeback
  Scenario: User provides new factual information
    Given I am in a chat conversation
    When I send "The CEO mentioned they're planning to expand to Europe in Q2 2025"
    Then the assistant should acknowledge storing this information
    And when I later ask "What are the expansion plans?"
    Then the response should include the Europe Q2 2025 expansion
```

---

### CH-004: Conversation History Persistence
**Priority:** P1 | **Risk:** Medium | **Automation:** Required

```gherkin
  @p1 @conversation
  Scenario: Conversation persists across page refreshes
    Given I have an active conversation with 3 messages
    When I refresh the page
    Then I should see the same conversation in the sidebar
    And when I select it, all 3 messages should be visible
    And the context indicator should show the correct message count
```

**Selectors:**
- Conversation sidebar: `.conversation-sidebar`, `[data-testid="conversation-list"]`
- Context indicator: Text matching "Context includes X messages"

---

### CH-005: New Conversation Creation
**Priority:** P1 | **Risk:** Medium | **Automation:** Required

```gherkin
  @p1 @conversation
  Scenario: Create new conversation
    Given I have an existing conversation
    When I click the "New conversation" button
    Then the chat area should be cleared
    And I should see the welcome message with example prompts
    And when I send a message, a new conversation should be created
```

---

### CH-006: Quick Actions
**Priority:** P1 | **Risk:** Medium | **Automation:** Required

```gherkin
  @p1 @quick-actions
  Scenario: Execute Quick Action - Find Contradictions
    Given I am on the chat page for a project with analyzed documents
    When I click "Find Contradictions" quick action
    Then a pre-filled message should be sent to the assistant
    And the assistant should analyze for contradictions
    And results should include specific document references

  Scenario: Quick Actions disabled when no documents
    Given I am on the chat page for a project with no documents
    Then the quick action buttons should be disabled
    And hovering should show a tooltip explaining why
```

**Selectors (from live exploration):**
- Quick action buttons: `button:has-text("Find Contradictions")`, `button:has-text("Generate Q&A")`
- Disabled state: `button[disabled]`

---

### CH-007: File Upload via Chat
**Priority:** P1 | **Risk:** Medium | **Automation:** Required

```gherkin
  @p1 @chat-upload
  Scenario: Upload document via chat attachment
    Given I am on the chat page
    When I click the "Attach files" button
    And I select a PDF document
    Then I should see upload progress in the chat area
    And the document should be processed
    And I should receive confirmation when processing completes
```

**Selectors:**
- Attach button: `button:has-text("Attach files")` or `button[aria-label="Attach files"]`

---

### CH-008: Chat Error Handling - Streaming Failure
**Priority:** P0 | **Risk:** High | **Automation:** Required

```gherkin
  @p0 @error-handling @chat
  Scenario: Handle streaming response failure gracefully
    Given I am in a chat conversation
    And the LLM service becomes unavailable mid-response
    When the stream fails
    Then I should see an error message in the chat
    And I should see a "Retry" button
    And clicking Retry should resend the last message
```

---

### CH-009: Chat Error Handling - Knowledge Service Unavailable
**Priority:** P0 | **Risk:** High | **Automation:** Required

```gherkin
  @p0 @error-handling @graceful-degradation
  Scenario: Chat works when Graphiti/Neo4j unavailable
    Given the Graphiti service is unavailable
    When I send a chat message
    Then the assistant should still respond
    And the response should indicate limited knowledge access
    And the system should not crash or hang
```

**Note:** E12.6 implemented graceful degradation - returns empty results, not 500 error.

---

## 5. E2E Test Cases - Authentication (P0)

### AU-001: Password Login - Happy Path
**Priority:** P0 | **Risk:** Critical | **Automation:** Required

```gherkin
Feature: Authentication
  @p0 @smoke @auth
  Scenario: Login with valid credentials
    Given I am on the login page
    When I enter email "test@example.com"
    And I enter password "validpassword123"
    And I click "Sign In"
    Then I should be redirected to the projects page
    And I should see "Welcome back" message
```

---

### AU-002: Password Login - Invalid Credentials
**Priority:** P0 | **Risk:** High | **Automation:** Required

```gherkin
  @p0 @auth @error-handling
  Scenario: Login with invalid credentials
    Given I am on the login page
    When I enter invalid credentials
    And I click "Sign In"
    Then I should see "Invalid login credentials" error
    And I should remain on the login page
```

---

### AU-003: Session Persistence
**Priority:** P0 | **Risk:** High | **Automation:** Required

```gherkin
  @p0 @auth @session
  Scenario: Session persists across page navigation
    Given I am logged in
    When I navigate to different project pages
    Then I should remain authenticated
    And when I refresh the page
    Then I should still be authenticated
```

---

### AU-004: Logout
**Priority:** P1 | **Risk:** Medium | **Automation:** Required

```gherkin
  @p1 @auth
  Scenario: User can sign out
    Given I am logged in on the projects page
    When I click "Sign Out"
    Then I should be redirected to the login page
    And navigating to /projects should redirect to login
```

---

## 6. Integration Test Cases - Backend APIs

### API-001: Hybrid Search Endpoint
**Priority:** P0 | **Risk:** Critical | **Automation:** Required

```python
# tests/integration/test_search_api.py

@pytest.mark.asyncio
async def test_hybrid_search_returns_results():
    """POST /api/search/hybrid returns ranked results with citations."""
    response = await client.post(
        "/api/search/hybrid",
        json={
            "query": "What is the company revenue?",
            "deal_id": VALID_DEAL_ID,
            "num_results": 10
        },
        headers={"X-API-Key": API_KEY}
    )
    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert "sources" in data
    assert "latency_ms" in data
    assert data["latency_ms"] < 3000  # Target: < 3 seconds

@pytest.mark.asyncio
async def test_hybrid_search_deal_not_found():
    """POST /api/search/hybrid returns 404 for non-existent deal."""
    response = await client.post(
        "/api/search/hybrid",
        json={
            "query": "test query",
            "deal_id": "00000000-0000-0000-0000-000000000000",
            "num_results": 10
        },
        headers={"X-API-Key": API_KEY}
    )
    assert response.status_code == 404

@pytest.mark.asyncio
async def test_hybrid_search_graceful_degradation():
    """POST /api/search/hybrid returns empty results when Neo4j unavailable."""
    # Mock Neo4j connection failure
    with mock_neo4j_unavailable():
        response = await client.post(
            "/api/search/hybrid",
            json={"query": "test", "deal_id": VALID_DEAL_ID, "num_results": 10},
            headers={"X-API-Key": API_KEY}
        )
    assert response.status_code == 200  # Not 503!
    data = response.json()
    assert data["results"] == []
    assert data["result_count"] == 0
```

---

### API-002: Knowledge Ingest Endpoint
**Priority:** P0 | **Risk:** Critical | **Automation:** Required

```python
# tests/integration/test_graphiti_api.py

@pytest.mark.asyncio
async def test_ingest_correction_success():
    """POST /api/graphiti/ingest accepts user corrections."""
    response = await client.post(
        "/api/graphiti/ingest",
        json={
            "deal_id": VALID_DEAL_ID,
            "content": "The Q3 revenue was $5.2M, not $4.8M as previously stated.",
            "source_type": "correction",
            "message_context": "User corrected revenue figure in chat"
        },
        headers={"X-API-Key": API_KEY}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["episode_count"] >= 1

@pytest.mark.asyncio
async def test_ingest_rate_limiting():
    """POST /api/graphiti/ingest enforces rate limit (10/min/deal)."""
    for i in range(10):
        response = await client.post(
            "/api/graphiti/ingest",
            json={"deal_id": VALID_DEAL_ID, "content": f"Fact {i}", "source_type": "new_info"},
            headers={"X-API-Key": API_KEY}
        )
        assert response.status_code == 200

    # 11th request should be rate limited
    response = await client.post(
        "/api/graphiti/ingest",
        json={"deal_id": VALID_DEAL_ID, "content": "Fact 11", "source_type": "new_info"},
        headers={"X-API-Key": API_KEY}
    )
    assert response.status_code == 429

@pytest.mark.asyncio
async def test_ingest_invalid_deal_id():
    """POST /api/graphiti/ingest validates deal_id format."""
    response = await client.post(
        "/api/graphiti/ingest",
        json={"deal_id": "not-a-uuid", "content": "Test fact", "source_type": "new_info"},
        headers={"X-API-Key": API_KEY}
    )
    assert response.status_code == 422  # Validation error
```

---

### API-003: Document Processing Webhook
**Priority:** P0 | **Risk:** High | **Automation:** Required

```python
# tests/integration/test_webhooks.py

@pytest.mark.asyncio
async def test_gcs_webhook_triggers_processing():
    """POST /api/webhooks/gcs triggers document processing pipeline."""
    response = await client.post(
        "/api/webhooks/gcs",
        json={
            "bucket": "manda-documents-dev",
            "name": f"projects/{PROJECT_ID}/documents/test.pdf",
            "contentType": "application/pdf"
        }
    )
    assert response.status_code == 200

    # Verify job was enqueued
    job = await get_job_by_document(document_id)
    assert job is not None
    assert job["name"] == "document-parse"
```

---

## 7. Unit Test Cases - Frontend Components

### Unit tests for critical components (Vitest + React Testing Library):

```typescript
// components/chat/__tests__/ChatInput.test.tsx

describe('ChatInput', () => {
  it('submits message on Enter key', async () => {
    const onSubmit = vi.fn()
    render(<ChatInput onSubmit={onSubmit} isDisabled={false} isLoading={false} />)

    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'What is revenue?')
    await userEvent.keyboard('{Enter}')

    expect(onSubmit).toHaveBeenCalledWith('What is revenue?')
  })

  it('allows newline with Shift+Enter', async () => {
    const onSubmit = vi.fn()
    render(<ChatInput onSubmit={onSubmit} isDisabled={false} isLoading={false} />)

    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'Line 1{Shift>}{Enter}{/Shift}Line 2')

    expect(onSubmit).not.toHaveBeenCalled()
    expect(input).toHaveValue('Line 1\nLine 2')
  })

  it('disables send when loading', () => {
    render(<ChatInput onSubmit={vi.fn()} isDisabled={false} isLoading={true} />)

    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })

  it('shows character count', async () => {
    render(<ChatInput onSubmit={vi.fn()} isDisabled={false} isLoading={false} />)

    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'Hello')

    expect(screen.getByText('5/10,000')).toBeInTheDocument()
  })
})
```

---

## 8. Test Data Management

### Fixtures Strategy

```typescript
// e2e/fixtures/index.ts

export const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'testpassword123'
}

export const TEST_PROJECT = {
  id: '402193e1-a2b8-4994-bbfb-d59e56d2fbd9', // From live exploration
  name: 'Edge Case Test Deal'
}

// Factory for creating test data
export async function createTestProject(overrides = {}) {
  return {
    name: `Test Project ${Date.now()}`,
    companyName: 'Test Company Inc',
    industry: 'saas',
    ...overrides
  }
}
```

### Auth State Persistence

```typescript
// e2e/auth.setup.ts (existing, verified working)

import { test as setup } from '@playwright/test'

setup('authenticate', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!)
  await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!)
  await page.click('button:has-text("Sign In")')
  await page.waitForURL('**/projects')

  // Save auth state for reuse
  await page.context().storageState({ path: 'playwright/.auth/user.json' })
})
```

---

## 9. CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/e2e.yml

name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    services:
      neo4j:
        image: neo4j:5.26-community
        env:
          NEO4J_AUTH: neo4j/testpassword
        ports:
          - 7687:7687

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: 'manda-app/.nvmrc'
          cache: 'npm'
          cache-dependency-path: 'manda-app/package-lock.json'

      - name: Install dependencies
        run: cd manda-app && npm ci

      - name: Install Playwright browsers
        run: cd manda-app && npx playwright install --with-deps chromium

      - name: Run P0 smoke tests
        run: cd manda-app && npx playwright test --grep @p0
        env:
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}

      - name: Upload test artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: manda-app/playwright-report/
          retention-days: 30
```

---

## 10. Execution Strategy

### Test Execution Order

1. **P0 Smoke Suite** (5-10 min) - Run on every PR
   - Authentication
   - Document upload happy path
   - Chat basic query
   - Knowledge write-back

2. **P1 Regression Suite** (15-20 min) - Run on merge to main
   - All P0 tests
   - Conversation management
   - Q&A workflow
   - Quick actions
   - Error handling

3. **Full Suite** (30+ min) - Nightly/weekly
   - All P0, P1, P2 tests
   - Edge cases
   - Performance validation

### Tag-Based Execution

```bash
# P0 only (CI fast path)
npx playwright test --grep @p0

# Smoke tests
npx playwright test --grep @smoke

# Error handling tests
npx playwright test --grep @error-handling

# Full regression
npx playwright test
```

---

## 11. Monitoring & Observability

### Test Health Metrics

- **Flakiness rate**: Target < 2%
- **P0 pass rate**: Target 100%
- **Average execution time**: Track trends
- **Coverage gaps**: Review after each sprint

### Alerts

- P0 test failure → Immediate Slack notification
- Flakiness > 5% → Create tech debt ticket
- Execution time increase > 20% → Investigate

---

## 12. Known Issues & Test Gaps

From live exploration (2025-12-23):

1. **Knowledge Explorer Error**: "Maximum update depth exceeded" - React state loop detected
2. **Processing Queue Error**: "Failed to load queue" - Backend connectivity issue
3. **Missing x-organization-id header**: Header validation error

### Recommended Next Steps

1. Create bug tickets for discovered issues
2. Add regression tests for fixed bugs
3. Implement contract tests for manda-app ↔ manda-processing
4. Add visual regression tests for critical UI components

---

## Appendix A: Selector Reference (from Playwright MCP Exploration)

| Element | Selector | Notes |
|---------|----------|-------|
| Email input | `textbox[name="Email"]` | Login page |
| Password input | `textbox[name="Password"]` | Login page |
| Sign In button | `button:has-text("Sign In")` | Login page |
| Project card | `link[href*="/projects/"]` | Projects list |
| Upload button | `button:has-text("Upload")` | Data Room |
| Chat input | `textbox[placeholder*="Ask a question"]` | Chat page |
| Send button | `button[aria-label="Send message"]` | Chat page |
| Quick actions | `toolbar[aria-label="Quick actions"]` | Chat page |
| Conversation list | Sidebar with conversation items | Chat page |

---

## Appendix B: Environment Configuration

```bash
# .env.test.local
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123
TEST_ENV=local
SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_API_URL=http://localhost:8000
NEO4J_URI=bolt://localhost:7687
```

---

*Generated by Murat (TEA) - Master Test Architect*
*Risk-based testing: depth scales with impact*
