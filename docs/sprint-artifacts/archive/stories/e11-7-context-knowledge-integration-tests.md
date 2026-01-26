# Story 11.7: Context-Knowledge Integration Tests

**Status:** done

---

## Story

As a **platform developer**,
I want **comprehensive integration tests validating the flow between conversation context and knowledge base**,
so that **I can ensure the complete E10/E11 pipeline works correctly end-to-end and prevent regressions as the system evolves**.

---

## Acceptance Criteria

1. **AC1:** Test: User provides fact via chat → indexed to KB via Graphiti → retrievable in new session
2. **AC2:** Test: Long conversation → summarization triggered → context remains coherent
3. **AC3:** Test: Tool calls → isolation pattern → token count reduced in LLM context
4. **AC4:** Test: Model switch via config → same behavior with different provider
5. **AC5:** Test: E10 + E11 integration — entities resolved, facts linked across sessions

---

## Tasks / Subtasks

- [x] **Task 1: Create TypeScript Integration Test File** (AC: #1, #2, #3, #5) ✅
  - [x] 1.1: Create `manda-app/__tests__/integration/context-knowledge.test.ts`
  - [x] 1.2: Import test utilities from existing patterns (`__tests__/lib/agent/`)
  - [x] 1.3: Set up mock factories: `createMockLLM()`, `createTestMessages()`, `createMockGraphitiClient()`
  - [x] 1.4: Configure test environment with Vitest async patterns

- [x] **Task 2: Implement User Fact Indexing Test** (AC: #1) ✅
  - [x] 2.1: Create test: `it('indexes user-provided facts to knowledge base')`
  - [x] 2.2: Simulate user message: "Q3 revenue was $5.2M"
  - [x] 2.3: Verify `index_to_knowledge_base` tool called with correct params
  - [x] 2.4: Mock Graphiti `add_episode` response
  - [x] 2.5: Verify fact retrievable via `query_knowledge_base` tool
  - [x] 2.6: Test retrieval in simulated "new session" (fresh context)

- [x] **Task 3: Implement Conversation Summarization Test** (AC: #2) ✅
  - [x] 3.1: Create test: `it('summarizes long conversations while preserving coherence')`
  - [x] 3.2: Generate 25+ test messages (exceeds 20 message threshold)
  - [x] 3.3: Verify summarization triggered (calls `summarizeConversationHistory`)
  - [x] 3.4: Verify older messages replaced with summary
  - [x] 3.5: Verify recent 10 messages kept verbatim
  - [x] 3.6: Verify agent can reference summarized content in response

- [x] **Task 4: Implement Tool Result Isolation Test** (AC: #3) ✅
  - [x] 4.1: Create test: `it('isolates tool results at execution time')`
  - [x] 4.2: Trigger tool calls via isolated tools (query_knowledge_base, find_gaps)
  - [x] 4.3: Verify LLM context receives concise summaries (~50-100 tokens each)
  - [x] 4.4: Verify full results stored in mock cache
  - [x] 4.5: Verify `createMockToolResult()` returns complete data
  - [x] 4.6: Verify token savings logged (expected: 70-80% reduction)

- [x] **Task 5: Create Python Integration Test File** (AC: #4, #5) ✅
  - [x] 5.1: Create `manda-processing/tests/integration/test_context_knowledge.py`
  - [x] 5.2: Add `@pytest.mark.integration` markers
  - [x] 5.3: Create fixtures: `sample_deal_id`, `mock_graphiti_service`, `mock_db_client`
  - [x] 5.4: Set up async test patterns with `@pytest.mark.asyncio`

- [x] **Task 6: Implement Model Switching Test** (AC: #4) ✅
  - [x] 6.1: Create test: `test_model_switch_preserves_behavior()`
  - [x] 6.2: Configure primary model (Gemini) via `models.yaml`
  - [x] 6.3: Configure fallback model (Claude) via `models.yaml`
  - [x] 6.4: Verify config loading and env var override
  - [x] 6.5: Verify response structure matches expected format
  - [x] 6.6: Verify cost tracking functions available

- [x] **Task 7: Implement E10+E11 Integration Test** (AC: #5) ✅
  - [x] 7.1: Create test: `test_entity_resolution_across_sessions()`
  - [x] 7.2: Session 1: Ingest document with "ABC Corporation" entity
  - [x] 7.3: Session 2: Chat mentions "ABC Corp" (variation)
  - [x] 7.4: Verify Graphiti resolves to same entity (mocked)
  - [x] 7.5: Verify facts linked via Neo4j relationships
  - [x] 7.6: Create test: `test_fact_supersession_chain()`
  - [x] 7.7: Ingest document fact: "Revenue $4.8M"
  - [x] 7.8: Chat correction: "Actually $5.2M"
  - [x] 7.9: Verify Graphiti temporal invalidation (old edge marked invalid_at)
  - [x] 7.10: Verify query returns corrected value

- [x] **Task 8: Test Utilities and Helpers** (AC: #1-5) ✅
  - [x] 8.1: Create shared mock factories in `__tests__/utils/integration-helpers.ts`
  - [x] 8.2: Add `createMockGraphitiResponse()` helper
  - [x] 8.3: Add `createMockToolResult()` with isolation support
  - [x] 8.4: Add `verifyTokenSavings()` assertion helper
  - [x] 8.5: Add Python fixtures in `tests/fixtures/context_knowledge.py`

- [x] **Task 9: CI/CD Integration** (AC: #1-5) ✅
  - [x] 9.1: Add integration test script to `package.json`: `"test:integration": "vitest run --config vitest.integration.config.ts"`
  - [x] 9.2: Create `vitest.integration.config.ts` with longer timeouts (30s)
  - [x] 9.3: Add `RUN_INTEGRATION_TESTS=true` environment check
  - [x] 9.4: Configured for GitHub Actions (separate config file)
  - [x] 9.5: Add pytest integration marker handling in `pyproject.toml`

- [x] **Task 10: Error Handling Tests** (AC: #1-5) ✅
  - [x] 10.1: Test Graphiti connection failure → graceful degradation with error message
  - [x] 10.2: Test LLM timeout → fallback to topic extraction (summarization)
  - [x] 10.3: Test invalid data format → validation error with details returned
  - [x] 10.4: Test summarization fallback chain (LLM → fallback → truncation)
  - [x] 10.5: Test missing environment variables → clear error message, skip test gracefully

---

## Dev Notes

### Existing Test Infrastructure to Reuse

**DO NOT reinvent these patterns — extend existing code:**

| Existing File | What to Reuse |
|---------------|---------------|
| `__tests__/lib/agent/summarization.test.ts` | Summarization test patterns, mock LLM factory |
| `__tests__/lib/agent/knowledge-write-back.test.ts` | Knowledge indexing patterns |
| `__tests__/lib/agent/context.test.ts` | Context management patterns |
| `__tests__/llm/integration.test.ts` | LLM provider integration patterns |
| `__tests__/utils/supabase-mock.ts` | Supabase client mocking, data factories (createMockUser, createMockDocument) |
| `tests/integration/test_graphiti_ingest.py` | Graphiti API test patterns |
| `tests/integration/test_model_fallback.py` | Model switching test patterns |

### Test Dependency Versions

Ensure compatibility with existing test infrastructure:

```
# TypeScript (manda-app)
vitest: ^3.0.0          # Matches existing vitest.config.ts
@testing-library/react: ^16.0.0
@testing-library/jest-dom: ^6.0.0

# Python (manda-processing)
pytest: ^8.0.0          # Matches pyproject.toml
pytest-asyncio: ^0.24.0
httpx: ^0.28.0          # For async HTTP testing
```

### Test File Locations

```
manda-app/
├── __tests__/
│   ├── integration/
│   │   └── context-knowledge.test.ts    ← CREATE (Task 1)
│   └── utils/
│       └── integration-helpers.ts       ← CREATE (Task 8)

manda-processing/
└── tests/
    ├── integration/
    │   └── test_context_knowledge.py    ← CREATE (Task 5)
    └── fixtures/
        └── context_knowledge.py         ← CREATE (Task 8)
```

### TypeScript Test Patterns (Vitest)

```typescript
// Use existing mock patterns from summarization.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMockLLM, createTestMessages } from '../utils/integration-helpers'

describe('Context-Knowledge Integration', () => {
  let mockLLM: ReturnType<typeof createMockLLM>
  let mockGraphiti: MockGraphitiClient

  beforeEach(() => {
    mockLLM = createMockLLM('test response')
    mockGraphiti = createMockGraphitiClient()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('indexes user-provided facts to knowledge base', async () => {
    // Arrange
    const userMessage = 'Q3 revenue was actually $5.2M, not $4.8M'

    // Act
    await indexFactToKnowledgeBase(userMessage, mockGraphiti)

    // Assert - Verify mock interactions with specific params
    expect(mockGraphiti.addEpisode).toHaveBeenCalledWith(
      expect.objectContaining({
        episodeBody: expect.stringContaining('$5.2M'),
        source: 'analyst_correction',
        confidence: 0.95
      })
    )
    expect(mockGraphiti.addEpisode).toHaveBeenCalledTimes(1)
  })
})
```

### Python Test Patterns (pytest)

```python
# Use existing patterns from test_graphiti_ingest.py
import pytest
from unittest.mock import MagicMock, AsyncMock, patch

@pytest.fixture
def mock_graphiti_service() -> MagicMock:
    mock = MagicMock()
    mock.add_episode = AsyncMock(return_value={"success": True})
    mock.search = AsyncMock(return_value=[])
    return mock

@pytest.mark.integration
@pytest.mark.asyncio
async def test_entity_resolution_across_sessions(mock_graphiti_service, sample_deal_id):
    # Test implementation
```

### E10 + E11 Integration Dependencies

This story validates the complete pipeline:

```
E10.1 (Graphiti Setup) → E10.4 (Document Ingestion) → E10.5 (Q&A/Chat Ingestion)
                              ↓                              ↓
                         E10.6 (Entity Resolution) ← ← ← ← ←
                              ↓
E11.3 (Knowledge Write-Back) → E11.4 (Intent-Aware Retrieval)
                              ↓
E11.2 (Summarization) → E11.1 (Tool Isolation) → E11.6 (Model Config)
                              ↓
                    E11.7 (THIS STORY - Integration Tests)
```

### Key Integration Points to Test

| From | To | What to Verify |
|------|-----|----------------|
| Chat message | Graphiti add_episode | Content, source_type, confidence |
| Graphiti | Neo4j | Entity nodes created, relationships linked |
| Query | Graphiti search | Hybrid retrieval returns relevant results |
| Graphiti search | Voyage reranker | Results reranked by relevance |
| Tool execution | ToolResultCache | Full results cached, summaries returned |
| Long conversation | Summarization | Older messages replaced, recent preserved |
| Model config | Agent creation | Correct provider instantiated |

### Test Data Fixtures

All test fixtures defined in Task 8 (`integration-helpers.ts` and `context_knowledge.py`):

| Fixture | Location | Purpose |
|---------|----------|---------|
| `TEST_DEAL` | TypeScript | Sample deal with id, name, documents array |
| `FACTS_TO_INDEX` | TypeScript | 3 sample facts (correction, new_info, confirmation) |
| `ENTITY_VARIATIONS` | Python | Entity resolution test cases with expected outcomes |
| `createMockGraphitiResponse()` | TypeScript | Factory for Graphiti API responses |
| `sample_deal_id` | Python fixture | UUID for test isolation |

### Environment Variables Required

```bash
# For TypeScript integration tests
RUN_INTEGRATION_TESTS=true
GRAPHITI_API_URL=http://localhost:8001  # or mock

# For Python integration tests
VOYAGE_API_KEY=your-key  # or skip if not set
NEO4J_URI=bolt://localhost:7687  # or mock
```

### Skip Patterns for CI

```typescript
// Skip if dependencies not available
const shouldSkip = !process.env.RUN_INTEGRATION_TESTS
describe.skipIf(shouldSkip)('Context-Knowledge Integration', () => {
  // tests
})
```

```python
@pytest.mark.skipif(
    not os.getenv("RUN_INTEGRATION_TESTS"),
    reason="Integration tests require RUN_INTEGRATION_TESTS=true"
)
class TestContextKnowledge:
    pass
```

---

## Project Structure Notes

### Alignment

- Test files follow existing `__tests__/` mirroring pattern
- Python tests in `tests/integration/` with pytest markers
- Uses existing mock utilities from E5.x and E10.x stories
- CI integration extends existing GitHub Actions workflow

### Dependencies on Previous Stories

| Story | Dependency |
|-------|------------|
| E10.4 | Document ingestion pipeline (tested) |
| E10.5 | Q&A and chat ingestion (tested) |
| E10.6 | Entity resolution (tested) |
| E10.7 | Hybrid retrieval with reranking (tested) |
| E11.1 | Tool result isolation (if implemented) |
| E11.2 | Conversation summarization (tested) |
| E11.3 | Knowledge write-back (tested) |
| E11.4 | Intent-aware retrieval (tested) |
| E11.6 | Model configuration (tested) |

---

## References

- [Epic E11: Agent Context Engineering](../epics/epic-E11.md#e117-context-knowledge-integration-tests)
- [E11.3 Story: Agent-Autonomous Write-Back](./e11-3-agent-autonomous-write-back.md)
- [E11.6 Story: Model Configuration](./e11-6-model-configuration-and-switching.md)
- [E10 Retrospective](../retrospectives/epic-E10-retrospective.md)
- [Existing: summarization.test.ts](manda-app/__tests__/lib/agent/summarization.test.ts)
- [Existing: test_graphiti_ingest.py](manda-processing/tests/integration/test_graphiti_ingest.py)
- [Existing: test_model_fallback.py](manda-processing/tests/integration/test_model_fallback.py)

---

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

**Implementation Summary (2025-12-18):**

1. **TypeScript Integration Tests (28 tests passing)**
   - Created `manda-app/__tests__/integration/context-knowledge.test.ts`
   - Covers AC#1-5 with comprehensive test suites
   - Tests: User fact indexing, conversation summarization, tool isolation, E10+E11 pipeline

2. **Python Integration Tests (20 tests passing)**
   - Created `manda-processing/tests/integration/test_context_knowledge.py`
   - Covers model switching (AC#4) and E10+E11 integration (AC#5)
   - Tests: Entity resolution, fact supersession, model config, cost tracking

3. **Test Utilities**
   - Created `manda-app/__tests__/utils/integration-helpers.ts` with mock factories
   - Created `manda-processing/tests/fixtures/context_knowledge.py` with Python fixtures

4. **CI/CD Integration**
   - Added `npm run test:integration` script
   - Created `vitest.integration.config.ts` with 30s timeouts
   - Registered pytest `integration` marker in `pyproject.toml`

**Test Coverage:**
- TypeScript: 28 tests across 6 test suites
- Python: 20 tests across 5 test classes

### File List

**Created Files:**
- `manda-app/__tests__/integration/context-knowledge.test.ts` - TypeScript integration tests
- `manda-app/__tests__/utils/integration-helpers.ts` - TypeScript test utilities
- `manda-app/vitest.integration.config.ts` - Integration test config
- `manda-processing/tests/integration/test_context_knowledge.py` - Python integration tests
- `manda-processing/tests/fixtures/context_knowledge.py` - Python test fixtures
- `manda-processing/tests/fixtures/__init__.py` - Fixtures package init

**Modified Files:**
- `manda-app/package.json` - Added test:integration script
- `manda-processing/pyproject.toml` - Added pytest markers
- `docs/sprint-artifacts/sprint-status.yaml` - Updated story status
- `docs/sprint-artifacts/stories/e11-7-context-knowledge-integration-tests.md` - This file

