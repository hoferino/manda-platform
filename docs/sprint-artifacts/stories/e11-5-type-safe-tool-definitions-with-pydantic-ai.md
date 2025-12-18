# Story 11.5: Type-Safe Tool Definitions with Pydantic AI

**Status:** ready-for-dev

---

## Story

As a **platform developer**,
I want **the Python backend (manda-processing) to use Pydantic AI for type-safe agent tool definitions**,
so that **I can catch parameter/dependency errors at write-time in my IDE rather than runtime in production, have autocomplete for tool dependencies, and easily switch LLM providers via config strings**.

---

## Acceptance Criteria

1. **AC1:** Pydantic AI installed and configured in manda-processing (`pydantic-ai>=0.0.40`)
2. **AC2:** Document analysis pipeline migrated to Pydantic AI pattern with type-safe `Agent[Dependencies, Result]`
3. **AC3:** Type-safe dependency injection for Supabase client, Graphiti client, LLM via `RunContext[Dependencies]`
4. **AC4:** IDE autocomplete works for tool parameters and `ctx.deps.*` access
5. **AC5:** Model switching via Pydantic AI string syntax: `'google:gemini-2.5-flash'`, `'anthropic:claude-sonnet-4-0'`
6. **AC6:** Logfire integration for observability (optional - configure via env var)
7. **AC7:** Documentation in code comments for extending with new tools

---

## Tasks / Subtasks

- [ ] **Task 1: Install Pydantic AI and Configure Dependencies** (AC: #1)
  - [ ] 1.1: Add `pydantic-ai>=0.0.40` to `manda-processing/pyproject.toml`
  - [ ] 1.2: Add optional `logfire>=3.0.0` to dev dependencies for observability
  - [ ] 1.3: Run `pip install -e ".[dev]"` to verify installation
  - [ ] 1.4: Add `LOGFIRE_TOKEN` to `.env.example` (optional)

- [ ] **Task 2: Create Pydantic AI Agent Module** (AC: #2, #3, #4)
  - [ ] 2.1: Create `manda-processing/src/llm/pydantic_agent.py` with `AnalysisDependencies` dataclass
  - [ ] 2.2: Define `AnalysisDependencies` with: `db: SupabaseClient`, `graphiti: GraphitiClient | None`, `deal_id: str`, `document_id: str`
  - [ ] 2.3: Create `analysis_agent = Agent('google:gemini-2.5-flash', deps_type=AnalysisDependencies)`
  - [ ] 2.4: Register system prompt via `@analysis_agent.system_prompt` decorator
  - [ ] 2.5: Verify IDE autocomplete works for `ctx.deps.db`, `ctx.deps.graphiti`

- [ ] **Task 3: Create Type-Safe Tools** (AC: #2, #3, #4, #7)
  - [ ] 3.1: Create `manda-processing/src/llm/tools/__init__.py` package
  - [ ] 3.2: Create `manda-processing/src/llm/tools/extraction_tools.py` with:
    - `@analysis_agent.tool` decorated `extract_finding()`
    - `@analysis_agent.tool` decorated `classify_chunk()`
  - [ ] 3.3: Each tool uses `ctx: RunContext[AnalysisDependencies]` as first param
  - [ ] 3.4: Return Pydantic models (not dicts) for structured output
  - [ ] 3.5: Add comprehensive docstrings (become tool descriptions for LLM)

- [ ] **Task 4: Define Structured Output Models** (AC: #2)
  - [ ] 4.1: Create `manda-processing/src/llm/schemas.py` with Pydantic models:
    - `FindingResult(content: str, finding_type: str, confidence: float, source_reference: dict)`
    - `ChunkClassification(is_financial: bool, content_type: str, confidence: float)`
    - `BatchAnalysisResult(findings: list[FindingResult], tokens_used: int)`
  - [ ] 4.2: Use these as `result_type` on Agent for guaranteed structure

- [ ] **Task 5: Implement Model Configuration** (AC: #5)
  - [ ] 5.1: Add model config settings to `src/config.py`:
    - `pydantic_ai_extraction_model: str = 'google:gemini-2.5-flash'`
    - `pydantic_ai_analysis_model: str = 'google:gemini-2.5-pro'`
    - `pydantic_ai_fallback_model: str = 'anthropic:claude-sonnet-4-0'`
  - [ ] 5.2: Factory function `create_analysis_agent(model: str | None = None) -> Agent`
  - [ ] 5.3: Support env var override: `PYDANTIC_AI_MODEL='anthropic:claude-sonnet-4-0'`

- [ ] **Task 6: Migrate analyze_document Handler** (AC: #2, #3)
  - [ ] 6.1: Refactor `src/jobs/handlers/analyze_document.py` to use Pydantic AI agent
  - [ ] 6.2: Replace `GeminiClient.analyze_batch()` with `analysis_agent.run()`
  - [ ] 6.3: Inject dependencies via `deps=AnalysisDependencies(...)`
  - [ ] 6.4: Preserve existing error handling, retry logic, and metrics

- [ ] **Task 7: Add Logfire Integration (Optional)** (AC: #6)
  - [ ] 7.1: Add conditional Logfire initialization in `src/main.py`:
    ```python
    if settings.logfire_token:
        import logfire
        logfire.configure()
        logfire.instrument_pydantic_ai()
    ```
  - [ ] 7.2: Add `logfire_token: str = ''` to `Settings`

- [ ] **Task 8: Create Unit Tests** (AC: #1, #2, #3, #4, #5)
  - [ ] 8.1: Create `tests/unit/test_llm/test_pydantic_agent.py`
  - [ ] 8.2: Test agent creation with different model strings
  - [ ] 8.3: Test tool execution with mocked dependencies
  - [ ] 8.4: Test structured output validation
  - [ ] 8.5: Test dependency injection via RunContext

- [ ] **Task 9: Integration Testing** (AC: #2, #3, #5)
  - [ ] 9.1: Create `tests/integration/test_pydantic_ai_analysis.py`
  - [ ] 9.2: Test full extraction flow with real LLM (marked `@pytest.mark.integration`)
  - [ ] 9.3: Test model switching between providers
  - [ ] 9.4: Verify token counting and cost tracking

---

## Dev Notes

### Why Pydantic AI for Python Backend

**Problem with current approach:**
- `GeminiClient` uses LangChain with manual prompt construction
- No type-safe dependency injection - dependencies passed via closures/globals
- Tool parameters not validated until runtime (production crashes)
- Model switching requires code changes

**Pydantic AI benefits:**
- **Type safety at write-time:** IDE shows errors before you run code
- **Dependency injection via `RunContext[Deps]`:** Type-checked access to DB, Graphiti
- **Structured outputs:** Pydantic models guarantee response format
- **Model agnostic:** `'google:gemini-2.5-flash'` → `'anthropic:claude-sonnet-4-0'` via config
- **Built-in observability:** Logfire integration for tracing

**Scope clarification:**
- ✅ **In scope:** Python backend (`manda-processing`) - document analysis, extraction
- ❌ **Out of scope:** TypeScript frontend (`manda-app`) - continues using LangChain + Zod

### Existing Code to Preserve

**Keep working (don't break):**
- `src/llm/client.py` - `GeminiClient` kept for backward compatibility during migration
- `src/llm/prompts.py` - Extraction prompts still used
- `src/llm/models.py` - `ModelTier` enum and cost estimation
- `src/jobs/handlers/analyze_document.py` - Migrate but preserve interface

**Patterns to follow:**
- Dataclass pattern from `src/llm/client.py` (`AnalysisResult`, `BatchAnalysisResult`)
- Settings pattern from `src/config.py` (`get_settings()`)
- Handler pattern from `src/jobs/handlers/` (dependency injection via constructor)

### Technical Implementation

**Agent Definition Pattern:**
```python
# manda-processing/src/llm/pydantic_agent.py
from dataclasses import dataclass
from pydantic_ai import Agent, RunContext
from pydantic import BaseModel

from src.storage.supabase_client import SupabaseClient
from src.graphiti.client import get_graphiti_client

@dataclass
class AnalysisDependencies:
    """Type-safe dependencies for extraction tools."""
    db: SupabaseClient
    graphiti: object | None  # GraphitiClient when available
    deal_id: str
    document_id: str
    document_name: str = ""

class FindingResult(BaseModel):
    """Structured finding output validated by Pydantic."""
    content: str
    finding_type: str  # fact, metric, risk, opportunity, assumption
    confidence: float  # 0.0-1.0
    source_reference: dict  # page_number, chunk_id, etc.

# Model string syntax - easily switch providers
analysis_agent = Agent(
    'google:gemini-2.5-flash',  # or 'anthropic:claude-sonnet-4-0'
    deps_type=AnalysisDependencies,
    result_type=list[FindingResult],  # Guarantees structured output
)

@analysis_agent.system_prompt
async def analysis_system_prompt(ctx: RunContext[AnalysisDependencies]) -> str:
    """Dynamic system prompt with context from dependencies."""
    return f"""You are an M&A analyst extracting findings from document: {ctx.deps.document_name}

Extract structured findings with:
- content: the actual finding text
- finding_type: one of [fact, metric, risk, opportunity, assumption]
- confidence: 0.0-1.0 based on source clarity
- source_reference: include page_number if available

Be precise and avoid speculation."""

@analysis_agent.tool
async def classify_chunk(
    ctx: RunContext[AnalysisDependencies],
    chunk_content: str,
    chunk_type: str,
) -> str:
    """Classify a document chunk for extraction priority.

    Args:
        chunk_content: The text content of the chunk
        chunk_type: Type of chunk (text, table, header, etc.)

    Returns:
        Classification result: 'financial', 'operational', 'legal', 'other'

    Docstring becomes tool description for LLM.
    """
    # IDE autocomplete: ctx.deps.db, ctx.deps.graphiti, ctx.deps.deal_id
    # Could query existing findings for context
    existing = await ctx.deps.db.get_findings_by_document(
        UUID(ctx.deps.document_id)
    )

    # Classification logic here
    return "operational"  # Simplified
```

**Handler Migration Pattern:**
```python
# In analyze_document.py - migrate from GeminiClient to Pydantic AI

from src.llm.pydantic_agent import (
    analysis_agent,
    AnalysisDependencies,
    FindingResult,
)

class AnalyzeDocumentHandler:
    async def handle(self, job: Job) -> dict[str, Any]:
        # ... existing document loading ...

        # Create type-safe dependencies
        deps = AnalysisDependencies(
            db=self.db,
            graphiti=get_graphiti_client() if settings.neo4j_uri else None,
            deal_id=str(project_id),
            document_id=str(document_id),
            document_name=document_name,
        )

        # Run agent with structured output
        result = await analysis_agent.run(
            f"Extract findings from this document:\n\n{chunk_content}",
            deps=deps,
        )

        # result.data is list[FindingResult] - guaranteed by Pydantic
        findings = result.data

        # Token usage available
        input_tokens = result.usage.input_tokens
        output_tokens = result.usage.output_tokens
```

**Config Pattern:**
```python
# src/config.py additions

class Settings(BaseSettings):
    # ... existing settings ...

    # Pydantic AI Model Configuration (E11.5)
    pydantic_ai_extraction_model: str = "google:gemini-2.5-flash"
    pydantic_ai_analysis_model: str = "google:gemini-2.5-pro"
    pydantic_ai_fallback_model: str = "anthropic:claude-sonnet-4-0"

    # Logfire (optional observability)
    logfire_token: str = ""
```

### File Structure

```
manda-processing/src/
├── llm/
│   ├── __init__.py           # Existing - add pydantic_agent exports
│   ├── client.py             # KEEP - GeminiClient (backward compat)
│   ├── models.py             # KEEP - ModelTier, cost estimation
│   ├── prompts.py            # KEEP - extraction prompts
│   ├── pydantic_agent.py     # NEW - Pydantic AI agent definition
│   ├── schemas.py            # NEW - Pydantic output models
│   └── tools/                # NEW - type-safe tools package
│       ├── __init__.py
│       └── extraction_tools.py
├── config.py                 # MODIFY - add pydantic_ai settings
├── main.py                   # MODIFY - optional Logfire init
└── jobs/handlers/
    └── analyze_document.py   # MODIFY - use Pydantic AI agent
```

**Files to CREATE (4):**
- `manda-processing/src/llm/pydantic_agent.py` - Agent + dependencies
- `manda-processing/src/llm/schemas.py` - Pydantic output models
- `manda-processing/src/llm/tools/__init__.py` - Tools package
- `manda-processing/src/llm/tools/extraction_tools.py` - Type-safe tools

**Files to MODIFY (4):**
- `manda-processing/pyproject.toml` - Add pydantic-ai dependency
- `manda-processing/src/config.py` - Add model config settings
- `manda-processing/src/main.py` - Optional Logfire init
- `manda-processing/src/jobs/handlers/analyze_document.py` - Use Pydantic AI

### Testing Strategy

**Unit Tests:**
```python
# tests/unit/test_llm/test_pydantic_agent.py
import pytest
from unittest.mock import AsyncMock, MagicMock

from src.llm.pydantic_agent import (
    AnalysisDependencies,
    analysis_agent,
    FindingResult,
)

@pytest.fixture
def mock_deps():
    """Create mock dependencies for testing."""
    return AnalysisDependencies(
        db=MagicMock(),
        graphiti=None,
        deal_id="test-deal-123",
        document_id="test-doc-456",
        document_name="test_document.pdf",
    )

def test_dependencies_type_safety():
    """Verify dependencies dataclass has correct types."""
    deps = AnalysisDependencies(
        db=MagicMock(),
        graphiti=None,
        deal_id="deal-123",
        document_id="doc-456",
    )
    assert deps.deal_id == "deal-123"
    assert deps.graphiti is None

def test_finding_result_validation():
    """Verify FindingResult Pydantic model validates correctly."""
    finding = FindingResult(
        content="Revenue was $5.2M in Q3",
        finding_type="metric",
        confidence=0.92,
        source_reference={"page_number": 12},
    )
    assert finding.confidence == 0.92

def test_finding_result_validation_fails():
    """Verify FindingResult rejects invalid data."""
    with pytest.raises(ValidationError):
        FindingResult(
            content="test",
            finding_type="invalid_type",  # Would fail if we add Literal constraint
            confidence="not_a_float",  # Type error
            source_reference={},
        )

@pytest.mark.asyncio
async def test_agent_model_string_syntax(mock_deps):
    """Verify model string syntax works for switching providers."""
    # This tests that model string is valid syntax
    assert analysis_agent.model == 'google:gemini-2.5-flash'
```

**Integration Tests:**
```python
# tests/integration/test_pydantic_ai_analysis.py
import pytest
from src.llm.pydantic_agent import analysis_agent, AnalysisDependencies

@pytest.mark.integration
@pytest.mark.asyncio
async def test_full_extraction_flow(real_db_client):
    """Test complete extraction with real LLM."""
    deps = AnalysisDependencies(
        db=real_db_client,
        graphiti=None,
        deal_id="test-deal",
        document_id="test-doc",
        document_name="financials.pdf",
    )

    result = await analysis_agent.run(
        "Revenue was $5.2M in Q3 2024, up 15% from Q2.",
        deps=deps,
    )

    # Structured output guaranteed
    assert isinstance(result.data, list)
    assert all(isinstance(f, FindingResult) for f in result.data)
    assert result.usage.input_tokens > 0
```

### Model String Reference

**Pydantic AI supports these provider:model strings:**
```python
# Google Gemini
'google:gemini-2.5-flash'      # $0.30/1M - standard extraction
'google:gemini-2.5-pro'        # $1.25/1M - complex analysis
'google:gemini-2.5-flash-lite' # $0.10/1M - batch processing

# Anthropic Claude
'anthropic:claude-sonnet-4-0'   # Conversation, analysis
'anthropic:claude-haiku-4-0'   # Speed tasks

# OpenAI
'openai:gpt-4-turbo'           # Alternative provider
'openai:gpt-4o'                # Multimodal
```

### E11.1 Reference: Tool Result Isolation

E11.1 (done) implemented tool result isolation for the TypeScript frontend. This story (E11.5) is **Python-backend only** and does not interact with that implementation. However, the same principle applies:

- Tools should return structured, type-safe outputs
- Dependencies injected via `RunContext` (Python) vs closure (TypeScript)
- Both approaches enable IDE autocomplete and type checking

### Previous Work Patterns

From E11.1 implementation:
- `ToolResultCacheEntry` dataclass pattern → similar to `AnalysisDependencies`
- Module-level singleton pattern (e.g., `_gemini_client`) → use `get_settings()` instead
- Test fixtures with mocks → follow same pattern for Pydantic AI tests

From existing `src/llm/client.py`:
- `@retry` decorator with tenacity → keep for network resilience
- Token counting and cost estimation → preserve in Pydantic AI wrapper
- Error classification (`GeminiError`, `GeminiRateLimitError`) → wrap Pydantic AI errors similarly

---

## Project Structure Notes

### Alignment with Unified Project Structure

- New module in `manda-processing/src/llm/` - consistent with existing LLM modules
- Tests in `manda-processing/tests/unit/test_llm/` - follows existing test structure
- Uses Settings pattern from `src/config.py`
- Uses handler pattern from `src/jobs/handlers/`

### Detected Variances

- **New `tools/` package:** First sub-package under `llm/` - acceptable for organization
- **Pydantic AI agent alongside LangChain:** Migration path - both coexist initially

---

## References

- [Epic E11: Agent Context Engineering](../epics/epic-E11.md) - Epic context
- [Pydantic AI Documentation](https://ai.pydantic.dev/) - Official docs
- [Pydantic AI Dependencies](https://ai.pydantic.dev/dependencies/) - RunContext guide
- [Pydantic AI Tools](https://ai.pydantic.dev/tools/) - Tool decoration patterns
- [E11.1 Story: Tool Result Isolation](./e11-1-tool-result-isolation.md) - TypeScript pattern reference
- [Source: docs/manda-architecture.md#Technology Stack] - Current architecture

---

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### Change Log

- 2025-12-18: Story created via create-story workflow with comprehensive developer context

### File List
