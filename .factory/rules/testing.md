# Testing Conventions

## File Organization

- **Frontend**:
  - Test files live next to source: `Component.tsx` → `Component.test.tsx`
  - Integration tests go in `__tests__/integration/`
  - E2E tests go in `e2e/`

- **Backend**:
  - Test files in `tests/` directory mirroring `src/` structure
  - Unit tests: `tests/unit/`
  - Integration tests: `tests/integration/`
  - E2E tests: `tests/e2e/`

## Test Structure

- Use descriptive test names: "should [action] when [condition]"
- Arrange-Act-Assert (AAA) pattern for test structure
- One assertion per test when possible
- Use `beforeEach` for common setup, not `beforeAll`
- Use `afterEach` for cleanup, not `afterAll`

## Frontend Testing

### Unit Tests (Vitest)
- Test functions/components in isolation
- Mock @/ imports with vi.mock()
- Use `render` from `@testing-library/react`
- Use act() wrappers for state updates
- Test behavior, not implementation details

### Integration Tests
- Require `RUN_INTEGRATION_TESTS=true` env var
- Test component interaction with real dependencies
- Mock external APIs (Supabase, OpenAI, etc.)
- Use MSW (Mock Service Worker) for API mocking

### E2E Tests (Playwright)
- Test full user flows end-to-end
- Use Page Object Model pattern
- Wait for elements with proper locators
- Test against running dev server

## Backend Testing

### Unit Tests
- Mock all external dependencies (database, APIs, etc.)
- Focus on business logic
- Use pytest fixtures for common test data
- Test error paths and edge cases

### Integration Tests
- Require `RUN_INTEGRATION_TESTS=true` env var
- Use real dependencies (database, queue)
- Clean up test data after each test
- Use transaction rollbacks for database tests
- Mark with `@pytest.mark.integration`

### E2E Tests
- Test complete workflows (e.g., document upload → processing)
- Use Docker Compose for service orchestration
- Test against running services
- Verify end state (database, queue, knowledge graph)

## Mocking

- Mock at the boundary (API calls, database queries)
- Don't mock internal modules/functions
- Use pytest-mock for function mocking
- Use moto for AWS service mocking (S3, SQS, etc.)
- Use testcontainers for Docker-based integration tests

 Coverage

- Maintain 80%+ code coverage
- Use `pytest --cov=src --cov-report=html`
- Configure coverage thresholds in pyproject.toml
- Exclude generated code from coverage

## Test Data

- Use `faker` library for generating realistic test data
- Create fixtures for commonly used entities
- Keep test data minimal but realistic
- Use deterministic fake data (seer faker seeds)

## Performance Tests

- Use pytest-benchmark for performance regression tests
- Test with realistic data volumes
- Monitor memory usage
- Profile slow tests

## Error Testing

- Test error paths explicitly
- Verify error messages are informative
- Test error handling and recovery
- Verify logging on errors
