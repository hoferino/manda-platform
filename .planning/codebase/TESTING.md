# Testing Patterns

**Analysis Date:** 2026-01-20

## Test Framework

**Frontend (TypeScript/Next.js):**

**Runner:**
- Vitest
- Config: `manda-app/vitest.config.ts`
- Environment: jsdom (browser-like DOM)
- Parallelization: Enabled (threads pool with auto-detected CPU cores)
- Test discovery: `**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}`
- Excluded: `node_modules`, `.next`, `dist`, `e2e`

**Assertion Library:**
- Vitest built-in assertions (`expect`)
- @testing-library/jest-dom for DOM matchers

**Run Commands:**
```bash
npm run test:run                    # Run all unit tests
npm run test:integration           # Integration tests (RUN_INTEGRATION_TESTS=true)
npm run test:coverage              # Unit tests with coverage report
npm run test:ui                    # Vitest UI mode
npm run test:affected              # Run only changed tests
```

**E2E Testing (Playwright):**

**Runner:**
- Playwright Test
- Config: `manda-app/playwright.config.ts`
- Target: http://localhost:3000 (dev server must be running)

**Run Commands:**
```bash
npm run test:e2e                   # Run all E2E tests
npm run test:e2e:ui                # Playwright UI mode
npm run test:e2e:headed            # Run tests with visible browser
npm run test:e2e:report            # Open test report
npm run test:smoke                 # Legacy smoke tests
npm run test:p0                    # P0 critical tests
npm run test:auth                  # Authentication tests
```

**Backend (Python):**

**Runner:**
- pytest
- Config: `manda-processing/pyproject.toml`
- Async mode: auto-enabled
- Test discovery: `tests/` directory

**Assertion Library:**
- pytest built-in assertions
- unittest.mock for mocking

**Run Commands:**
```bash
pytest                             # Run all tests
pytest tests/unit/test_api/test_health.py  # Single file
pytest --cov=src --cov-report=html         # With coverage
pytest -m "not integration"        # Skip integration tests
pytest -m integration             # Only integration tests
```

## Test File Organization

**Frontend Structure:**

**Unit & Integration Tests (Co-located):**
- `__tests__/` - Unit tests for shared code
  - `__tests__/lib/` - Library utilities
  - `__tests__/lib/hooks/` - React hooks
  - `__tests__/lib/services/` - Business logic
  - `__tests__/api/` - API layer tests
  - `__tests__/components/` - Component tests
  - `__tests__/stores/` - State management tests

**Co-located Tests (Next to source):**
- `lib/agent/utils/qa-category.test.ts` - Next to source
- `lib/utils/finding-qa-mapping.test.ts` - Next to source

**Integration Tests:**
- `vitest.integration.config.ts` - Separate config file
- Run with: `RUN_INTEGRATION_TESTS=true npm run test:integration`
- Requires external services (Supabase, LLM APIs)

**E2E Tests:**
- Location: `e2e/` directory
- Organized by priority/type:
  - `e2e/p0/` - P0 critical tests (auth, document-processing, chat)
  - `e2e/smoke/` - Legacy smoke tests (happy paths)
  - `e2e/` - Other tests (data-room, IRL, QA)

**Naming Convention:**
- `*.test.ts` or `*.spec.ts` for unit tests
- `*.spec.ts` for E2E tests
- Test class names: `Test<ComponentName>` or `describe('...')`

**Backend Structure:**

**Unit Tests:**
- `tests/unit/test_api/` - API endpoint tests
- `tests/unit/test_jobs/` - Job handler tests
- `tests/unit/test_parsers/` - Document parser tests
- `tests/unit/test_financial/` - Financial analysis tests
- `tests/unit/test_graphiti/` - Knowledge graph tests

**Integration Tests:**
- `tests/integration/` - External service integration
- `tests/integration/test_graphiti_ingestion.py` - Graphiti + Neo4j
- `tests/integration/test_context_knowledge.py` - Context loading

**Fixtures:**
- `tests/conftest.py` - Shared pytest fixtures
- `tests/fixtures/` - Custom fixture modules
- Example: `context_knowledge.py` for mock knowledge data

**Test Markers:**
```python
@pytest.mark.integration  # Mark integration tests
@pytest.mark.slow        # Mark slow tests
```

## Test Structure

**Frontend (Vitest) - Unit Test Example:**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('confidence utilities', () => {
  describe('normalizeConfidence', () => {
    it('should keep values in 0-1 range unchanged', () => {
      expect(normalizeConfidence(0.85)).toBe(0.85)
    })

    it('should convert percentage values to 0-1', () => {
      expect(normalizeConfidence(85)).toBe(0.85)
    })
  })
})
```

**Frontend (Playwright) - E2E Test Example:**

```typescript
import { test, expect } from '@playwright/test'
import { TEST_CONFIG, assertions } from '../fixtures/test-config'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Authentication - P0 Critical @p0 @auth', () => {
  test('AU-001: Login with valid credentials redirects to projects', async ({ page }) => {
    test.skip(
      !TEST_CONFIG.user.email || !TEST_CONFIG.user.password,
      'E2E_TEST_EMAIL and E2E_TEST_PASSWORD required'
    )

    await page.goto('/login')
    await expect(page.getByText('Welcome back')).toBeVisible()

    await page.getByRole('textbox', { name: /email/i }).fill(TEST_CONFIG.user.email)
    await page.getByRole('textbox', { name: /password/i }).fill(TEST_CONFIG.user.password)
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()

    await expect(page).toHaveURL('/projects', {
      timeout: TEST_CONFIG.timeouts.navigation,
    })
  })
})
```

**Backend (pytest) - Unit Test Example:**

```python
from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient

class TestHealthEndpoint:
    """Tests for the /health endpoint."""

    def test_health_returns_200(self, client: TestClient) -> None:
        """Test that /health returns 200 OK."""
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_returns_healthy_status(self, client: TestClient) -> None:
        """Test that /health returns correct JSON structure."""
        response = client.get("/health")
        assert response.json() == {"status": "healthy"}
```

**Setup/Teardown Patterns:**

**Frontend (Vitest):**
- `beforeEach()` - Setup before each test
- `afterEach()` - Cleanup after each test (auto-called via `vitest.setup.ts`)
- `vi.mock()` - Global mocks in setup file

**Backend (pytest):**
- `@pytest.fixture` - Reusable setup/teardown
- Fixtures defined in `conftest.py` for project-wide access
- `setup_method()` / `teardown_method()` in test classes

## Mocking

**Framework:**

**Frontend:**
- Vitest: `vi.mock()`, `vi.fn()`, `vi.spyOn()`
- Location: `vitest.setup.ts` for global mocks

**Backend:**
- unittest.mock: `Mock`, `AsyncMock`, `patch`, `MagicMock`
- pytest fixtures for injected mocks

**Patterns (Frontend):**

```typescript
// Global mock in vitest.setup.ts
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

// Supabase client mock
vi.mock('@/lib/supabase/client', () => ({
  createBrowserClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })),
  }),
}))

// DOM mocks (for Radix UI components)
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
```

**Patterns (Backend):**

```python
from unittest.mock import AsyncMock, patch

def test_ready_returns_200(self, client: TestClient, mock_settings: MagicMock) -> None:
    """Test readiness check."""
    mock_conn = AsyncMock()
    mock_conn.execute = AsyncMock(return_value=None)
    mock_conn.fetchval = AsyncMock(return_value=True)
    mock_conn.close = AsyncMock()

    with patch("asyncpg.connect", return_value=mock_conn):
        response = client.get("/ready")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
```

**What to Mock:**
- External API calls (LLM, Voyage, OpenAI)
- Database connections (Supabase, Neo4j)
- File system operations (GCS)
- Authentication/session management
- Time-dependent functions (for deterministic tests)

**What NOT to Mock:**
- Business logic (confidence calculations, validation)
- Utility functions (parsing, formatting)
- Redux/Zustand state (use real store in unit tests)
- Component renders (use @testing-library/react)

## Fixtures and Factories

**Test Data (Frontend):**

Located in test files or `__tests__/fixtures/`:
```typescript
// Example from confidence.test.ts
const toolResults = [
  {
    result: JSON.stringify({
      data: {
        findings: [
          { confidence: 0.85, sourceDocument: 'report.pdf' },
          { confidence: 0.7, sourceDocument: 'draft.docx' },
        ],
      },
    }),
  },
]
```

**Test Data (Backend):**

Location: `tests/conftest.py` and `tests/fixtures/`

Example from conftest.py:
```python
@pytest.fixture
def client() -> TestClient:
    """Provide a FastAPI test client."""
    from src.main import app
    return TestClient(app)

@pytest.fixture
def mock_settings() -> MagicMock:
    """Provide mock settings."""
    return MagicMock()
```

Custom fixtures in `tests/fixtures/context_knowledge.py`:
```python
def get_mock_knowledge_data() -> dict:
    """Return structured knowledge for testing."""
    return {
        "entities": [...],
        "relationships": [...],
    }
```

## Coverage

**Frontend:**

**Requirements:** Not explicitly enforced in CI

**View Coverage:**
```bash
npm run test:coverage
# Generates: coverage/index.html
```

**Backend:**

**Requirements:** Not explicitly enforced

**View Coverage:**
```bash
pytest --cov=src --cov-report=html
# Generates: htmlcov/index.html
```

**Excluded from Coverage:**
```
pragma: no cover
def __repr__
raise NotImplementedError
if TYPE_CHECKING:
```

## Test Types

**Unit Tests (Frontend):**

**Scope:** Individual functions, hooks, utilities
**Approach:**
- Mock external dependencies (API calls, browser APIs)
- Test pure functions with various inputs
- Example: `lib/utils/confidence.test.ts` tests confidence calculation logic
- All global mocks set up in `vitest.setup.ts`

**Unit Tests (Backend):**

**Scope:** Individual functions, API endpoints, parsers
**Approach:**
- Mock external services (database, LLM, storage)
- Use pytest fixtures for setup/teardown
- Example: `tests/unit/test_api/test_health.py` mocks asyncpg connection
- Location: `tests/unit/` directory

**Integration Tests (Frontend):**

**Scope:** Multi-layer features with real backend/database
**Approach:**
- Requires `RUN_INTEGRATION_TESTS=true` environment variable
- Tests with real Supabase/Neo4j/LLM APIs if available
- Separate config: `vitest.integration.config.ts`
- Skipped in standard CI

**Integration Tests (Backend):**

**Scope:** Full job pipelines, database transactions, graph operations
**Approach:**
- Marked with `@pytest.mark.integration`
- Requires external services running (Neo4j, PostgreSQL)
- Example: `tests/integration/test_graphiti_ingestion.py`
- Run with: `pytest -m integration`

**E2E Tests (Playwright):**

**Scope:** Full user workflows across UI and backend
**Approach:**
- Browser automation via Playwright
- Tests with real server (http://localhost:3000)
- Auth state can be pre-loaded or reset per test
- Organized by criticality (P0, smoke, standard)
- Configured in `playwright.config.ts`:
  - Global timeout: 60s
  - Expect timeout: 10s
  - Action timeout: 15s
  - Navigation timeout: 30s

**E2E Test Prioritization:**
- `p0-critical`: Run on every PR (essential features)
- `p0-auth`: Authentication flows (separate from business logic)
- `smoke`: Legacy happy-path scenarios
- Others: Run selectively

## Common Patterns

**Async Testing (Frontend):**

```typescript
it('should send message and stream response', async () => {
  const { result } = renderHook(() => useCIMChat({ projectId: '1', cimId: '2' }))

  await act(async () => {
    await result.current.sendMessage('Hello')
  })

  expect(result.current.messages).toHaveLength(2) // User + assistant
})
```

**Async Testing (Backend):**

```python
@pytest.mark.asyncio
async def test_parse_document_creates_job() -> None:
    """Test that document parsing creates a pg-boss job."""
    result = await parse_document_handler(
        file_path="test.pdf",
        document_id="doc-123",
        project_id="proj-456",
    )
    assert result["status"] == "queued"
```

**Error Testing (Frontend):**

```typescript
it('should handle API errors gracefully', async () => {
  vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

  const { result } = renderHook(() => useCIMChat({ projectId: '1', cimId: '2' }))

  await act(async () => {
    await result.current.sendMessage('Hello')
  })

  expect(result.current.error).toBe('Network error')
})
```

**Error Testing (Backend):**

```python
def test_ready_returns_not_ready_when_db_disconnected(
    self, client: TestClient, mock_settings: MagicMock
) -> None:
    """Test that /ready returns not_ready when database is unavailable."""
    with patch("asyncpg.connect", side_effect=Exception("Connection refused")):
        response = client.get("/ready")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "not_ready"
    assert data["database"] == "disconnected"
```

**Playwright Page Object Pattern:**

```typescript
// Not explicitly shown in codebase, but E2E tests use page interactions directly
await page.goto('/login')
await page.getByRole('textbox', { name: /email/i }).fill(email)
await page.getByRole('button', { name: 'Sign In', exact: true }).click()
await expect(page).toHaveURL('/projects')
```

## Test Configuration Files

**Frontend:**
- `manda-app/vitest.config.ts` - Vitest configuration with jsdom, parallel execution
- `manda-app/vitest.integration.config.ts` - Integration test configuration
- `manda-app/vitest.setup.ts` - Global test setup (mocks, fixtures)
- `manda-app/playwright.config.ts` - Playwright E2E configuration
- `manda-app/e2e/fixtures/test-config.ts` - E2E test constants

**Backend:**
- `manda-processing/pyproject.toml` - pytest configuration in [tool.pytest.ini_options]
- `manda-processing/tests/conftest.py` - pytest fixtures and configuration

---

*Testing analysis: 2026-01-20*
