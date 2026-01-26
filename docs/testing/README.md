# Testing Documentation

---
status: Current
last-updated: 2026-01-26
---

Test documentation and plans for the Manda platform.

## Quick Start

| I want to... | Read... |
|--------------|---------|
| Understand test strategy | [manda-test-strategy.md](manda-test-strategy.md) |
| Run tests | [testing-guide.md](testing-guide.md) |
| Test the agent | [agent-behavior-test-plan.md](agent-behavior-test-plan.md) |
| Run manual tests | [manual-test-plan-happy-paths.md](manual-test-plan-happy-paths.md) |

## Documents

### Strategy & Setup

| Document | Purpose |
|----------|---------|
| [testing-guide.md](testing-guide.md) | Comprehensive test reference - how to run tests |
| [manda-test-strategy.md](manda-test-strategy.md) | Overall testing approach and coverage goals |
| [test-design-system.md](test-design-system.md) | System testability assessment |
| [testsprite-prd.md](testsprite-prd.md) | TestSprite automated testing PRD |

### Test Plans

| Document | Coverage |
|----------|----------|
| [agent-behavior-test-plan.md](agent-behavior-test-plan.md) | Agent behavior validation |
| [manual-test-plan-happy-paths.md](manual-test-plan-happy-paths.md) | Core user flows (P0 scenarios) |
| [manual-test-plan-edge-cases.md](manual-test-plan-edge-cases.md) | Edge cases and error handling |

### Test Results

| Document | Date |
|----------|------|
| [manual-test-results-2025-12-19.md](manual-test-results-2025-12-19.md) | Dec 19, 2025 |
| [manual-test-results-agent.md](manual-test-results-agent.md) | Agent-specific results |

## Running Tests

**Frontend (manda-app):**
```bash
npm run test:run      # Unit tests (Vitest)
npm run test:e2e      # E2E tests (Playwright)
```

**Backend (manda-processing):**
```bash
pytest                # All tests
pytest -v             # Verbose
pytest -k "test_name" # Specific test
```

## Test Coverage Goals

| Area | Target | Current |
|------|--------|---------|
| Unit tests | 80% | See coverage reports |
| Integration tests | Critical paths | In progress |
| E2E tests | Happy paths | See manual test plans |
