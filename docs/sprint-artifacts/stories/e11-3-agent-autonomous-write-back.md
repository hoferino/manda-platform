# Story 11.3: Agent-Autonomous Knowledge Write-Back

**Status:** done

---

## Story

As a **conversational agent**,
I want **to autonomously recognize and persist user-provided facts to Graphiti without requiring user confirmation**,
so that **valuable analyst insights are captured immediately for future retrieval, the knowledge base stays up-to-date with corrections, and users experience frictionless fact capture without "do you want me to save this?" prompts**.

---

## Acceptance Criteria

1. **AC1:** Agent autonomously detects factual assertions (not questions, greetings, or meta-conversation)
2. **AC2:** Agent calls `index_to_knowledge_base` tool for: analyst corrections, confirmed facts, new information
3. **AC3:** Agent does NOT persist: questions, greetings, opinions without facts, conversation meta
4. **AC4:** Graphiti auto-handles: entity extraction, resolution, deduplication, contradiction invalidation
5. **AC5:** Agent confirms naturally: "Got it, I've noted that..." (no "do you want me to save this?")
6. **AC6:** Persisted facts immediately retrievable in same session (hot path, not background)
7. **AC7:** Source attribution: all persisted facts include source_type (correction, confirmation, new_info)

---

## Tasks / Subtasks

- [x] **Task 1: Create Knowledge Ingestion API Endpoint** (AC: #4, #6)
  - [x] 1.1: Create `manda-processing/src/api/routes/graphiti.py` with router
  - [x] 1.2: Implement `POST /api/graphiti/ingest` accepting: `deal_id`, `content`, `source_type`, `message_context`
  - [x] 1.3: Call `GraphitiIngestionService.ingest_chat_fact()` internally
  - [x] 1.4: Return `{ success: true, episode_count: int, elapsed_ms: int, estimated_cost_usd: float }`
  - [x] 1.5: Register router in `manda-processing/src/api/main.py`:
    - Add import: `from src.api.routes import ..., graphiti`
    - Add registration: `app.include_router(graphiti.router, tags=["Graphiti"])`

- [x] **Task 2: Create index_to_knowledge_base Tool** (AC: #2, #7)
  - [x] 2.1: Add `IndexToKnowledgeBaseInputSchema` to `manda-app/lib/agent/schemas.ts` (centralized with other tool schemas)
  - [x] 2.2: Add schema to `ToolSchemas` export object in schemas.ts
  - [x] 2.3: Create `indexToKnowledgeBaseTool` in `manda-app/lib/agent/tools/knowledge-tools.ts` (import schema from schemas.ts)
  - [x] 2.4: Implement tool to call `POST ${PROCESSING_API_URL}/api/graphiti/ingest` (follow `queryKnowledgeBaseTool` fetch pattern)
  - [x] 2.5: Return success message with confirmation text
  - [x] 2.6: Add tool to `all-tools.ts` array (update count from 17 to 18)

- [x] **Task 3: Add Persistence Decision Logic to System Prompt** (AC: #1, #3, #5)
  - [x] 3.1: Add new section **within** `TOOL_USAGE_PROMPT` constant in `prompts.ts` (after Q&A Tool Usage section, ~line 365)
  - [x] 3.2: Define PERSIST triggers: corrections ("actually", "not X"), confirmations ("yes, correct"), new data
  - [x] 3.3: Define DO NOT PERSIST triggers: questions, greetings, meta-conversation, opinions
  - [x] 3.4: Add natural confirmation language: "Got it, I've noted that [fact]."
  - [x] 3.5: Include deal context instruction: "Include deal_id from the current conversation context"

- [x] **Task 4: Wire Up Tool in Agent Executor** (AC: #2, #6)
  - [x] 4.1: Import `indexToKnowledgeBaseTool` in `all-tools.ts` from `knowledge-tools`
  - [x] 4.2: Add to `TOOL_CATEGORIES.knowledge` array
  - [x] 4.3: Update `TOOL_COUNT` validation from 17 to 18
  - [x] 4.4: Verify dealId flow: Agent receives dealId in config → system prompt includes deal context → LLM includes deal_id in tool calls

- [x] **Task 5: Create Unit Tests** (AC: #1, #2, #3)
  - [x] 5.1: Create `manda-app/__tests__/lib/agent/knowledge-write-back.test.ts`
  - [x] 5.2: Test tool schema validation (content, source_type, deal_id required)
  - [x] 5.3: Test tool call to manda-processing endpoint (mock fetch)
  - [x] 5.4: Test error handling when endpoint unavailable
  - [x] 5.5: Test source_type enum validation

- [x] **Task 6: Create Integration Tests** (AC: #4, #6)
  - [x] 6.1: Create `manda-processing/tests/integration/test_graphiti_ingest.py`
  - [x] 6.2: Test POST /api/graphiti/ingest with valid payload
  - [x] 6.3: Test Graphiti episode creation (verify in Neo4j)
  - [x] 6.4: Test immediate retrievability via hybrid search
  - [x] 6.5: Test invalid payload handling (missing deal_id, etc.)

- [x] **Task 7: E2E Verification** (AC: #1, #2, #3, #5)
  - [x] 7.1: All unit tests pass (26/26 tests)
  - [x] 7.2: All integration tests pass (47/47 relevant tests)
  - [x] 7.3: Tool count validation passes (18 tools)
  - [x] 7.4: Build verification completed

---

## Dev Notes

### Critical Implementation Details

#### dealId Context Flow (AC#2, #6)

Tools receive `deal_id` via **input parameter**, not from agent config. The flow:

1. **Chat route** creates agent with `dealId: projectId` (see `app/api/projects/[id]/chat/route.ts:186`)
2. **System prompt** includes deal context via `getSystemPromptWithContext(dealName)`
3. **LLM** includes `deal_id` in tool invocations based on prompt instructions
4. **Tool** receives `deal_id` as schema parameter and passes to API

**Key pattern from `query_knowledge_base`:** Uses `filters.dealId` — this new tool uses top-level `deal_id` for simplicity.

#### Environment Configuration

Existing env vars (already configured in manda-app):
```bash
PROCESSING_API_URL=http://localhost:8000  # manda-processing API
PROCESSING_API_KEY=<your-api-key>         # Matches manda-processing auth
```

No new env vars needed — reuses existing configuration from E10.7/E10.8.

#### Schema Location Pattern

All tool schemas are centralized in `manda-app/lib/agent/schemas.ts`:
- Define `IndexToKnowledgeBaseInputSchema` there (not in knowledge-tools.ts)
- Add to `ToolSchemas` export object (~line 511)
- Import in knowledge-tools.ts: `import { IndexToKnowledgeBaseInputSchema } from '../schemas'`

---

### Why Agent-Autonomous (No Confirmation)

**Design Principle:** Users shouldn't validate storage decisions. They don't know what Graphiti is, nor should they care. The agent makes intelligent autonomous decisions.

**Key Insight from Epic E11:** Graphiti already handles the hard parts:
- Entity extraction via LLM (zero-shot, no predefined types)
- Entity resolution via cosine similarity + full-text search
- Fact extraction between resolved entities
- Contradiction handling via **temporal edge invalidation** (not user prompts)

The agent's job is to decide **when** to call `add_episode`, not **how** to extract facts.

### Persistence Decision Logic

**PERSIST when user:**
| Trigger Pattern | Example | Source Type |
|-----------------|---------|-------------|
| Analyst correction | "Actually it was $5.2M, not $4.8M" | `correction` |
| Analyst confirmation | "Yes, that's correct", "confirmed" | `confirmation` |
| New factual info | "The company has 150 employees" | `new_info` |

**DO NOT PERSIST when user:**
| Type | Example | Why |
|------|---------|-----|
| Questions | "What was Q3 revenue?" | Not factual |
| Greetings | "Hello", "Thanks" | Not valuable |
| Meta-conversation | "Summarize what we discussed" | About conversation, not facts |
| Opinions | "I think we should focus on..." | Not verifiable facts |

### System Prompt Addition (Task 3)

Add to `TOOL_USAGE_PROMPT` in `prompts.ts` (after Q&A Tool Usage section ~line 365):

```
### Autonomous Knowledge Persistence (E11.3)

Use **index_to_knowledge_base** autonomously when user provides:
- Corrections ("actually", "not X", "the real number is") → source_type: 'correction'
- Confirmations ("yes, that's correct") → source_type: 'confirmation'
- New facts ("the company has", "revenue was") → source_type: 'new_info'

Do NOT persist: questions, greetings, meta-conversation, opinions.

When persisting, include the deal_id from conversation context.
Confirm naturally: "Got it, I've noted that [fact]."

CRITICAL: Never ask "Would you like me to save this?" — just do it.
```

### Tool Implementation (Task 2)

**Follow existing pattern from `queryKnowledgeBaseTool` (knowledge-tools.ts:92-224):**

1. **Schema** (in schemas.ts):
```typescript
export const IndexToKnowledgeBaseInputSchema = z.object({
  content: z.string().min(10).describe('Factual content to persist'),
  source_type: z.enum(['correction', 'confirmation', 'new_info']),
  deal_id: z.string().uuid().describe('Deal UUID for namespace isolation'),
})
```

2. **Tool** (in knowledge-tools.ts):
- Import schema from `../schemas`
- Use `formatToolResponse()` and `handleToolError()` utilities
- Call `POST ${PROCESSING_API_URL}/api/graphiti/ingest`
- Follow fetch/error pattern from `queryKnowledgeBaseTool` lines 121-144

### API Endpoint Implementation (Task 1)

Create `manda-processing/src/api/routes/graphiti.py`:

**Follow existing route patterns from `search.py` and `webhooks.py`:**

```python
router = APIRouter(prefix="/api/graphiti", tags=["graphiti"])

class IngestRequest(BaseModel):
    deal_id: str = Field(..., description="Deal UUID")
    content: str = Field(..., min_length=10)
    source_type: Literal["correction", "confirmation", "new_info"]
    message_context: str | None = None

class IngestResponse(BaseModel):
    success: bool
    episode_count: int
    elapsed_ms: int
    estimated_cost_usd: float

@router.post("/ingest", response_model=IngestResponse)
async def ingest_chat_fact(request: IngestRequest) -> IngestResponse:
    service = GraphitiIngestionService()
    message_id = f"chat-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"
    result = await service.ingest_chat_fact(
        message_id=message_id,
        deal_id=request.deal_id,
        fact_content=request.content,
        message_context=request.message_context or request.content,
    )
    return IngestResponse(success=True, **asdict(result))
```

**Key:** Reuses `GraphitiIngestionService.ingest_chat_fact()` from E10.5 — no new ingestion logic needed.

### File Structure

```
manda-app/
├── lib/agent/
│   ├── tools/
│   │   ├── knowledge-tools.ts   # MODIFY: Add indexToKnowledgeBaseTool
│   │   └── all-tools.ts         # MODIFY: Add tool, update count 17→18
│   └── prompts.ts               # MODIFY: Add persistence decision logic
└── __tests__/lib/agent/
    └── knowledge-write-back.test.ts  # NEW: Unit tests

manda-processing/
├── src/api/routes/
│   └── graphiti.py              # NEW: Ingest endpoint
└── tests/integration/
    └── test_graphiti_ingest_endpoint.py  # NEW: Integration tests
```

**Files to CREATE (3):**
- `manda-processing/src/api/routes/graphiti.py` - Ingest endpoint
- `manda-app/__tests__/lib/agent/knowledge-write-back.test.ts` - Unit tests
- `manda-processing/tests/integration/test_graphiti_ingest_endpoint.py` - Integration tests

**Files to MODIFY (3):**
- `manda-app/lib/agent/tools/knowledge-tools.ts` - Add `indexToKnowledgeBaseTool`
- `manda-app/lib/agent/tools/all-tools.ts` - Add tool to array, update count
- `manda-app/lib/agent/prompts.ts` - Add persistence decision prompt

### Existing Code Patterns to Follow

**From `knowledge-tools.ts`:**
- Use `formatToolResponse()` and `handleToolError()` utilities
- Use `PROCESSING_API_URL` and `PROCESSING_API_KEY` env vars
- Use Zod schemas for input validation
- Follow existing JSDoc comment patterns

**From `ingestion.py` (E10.5):**
- `GraphitiIngestionService.ingest_chat_fact()` already exists
- Uses `CHAT_CONFIDENCE = 0.90` for analyst facts
- Episode name pattern: `chat-fact-{message_id[:8]}`

**From `all-tools.ts`:**
- Tool categories pattern for organization
- Tool count validation function

**From `prompts.ts`:**
- System prompt structure with sections
- Tool usage guidance format

### Integration with E10.5

E10.5 already implemented `GraphitiIngestionService.ingest_chat_fact()` in `manda-processing/src/graphiti/ingestion.py`. This story creates:

1. **API endpoint** to expose that functionality via HTTP
2. **TypeScript tool** for the agent to call the endpoint
3. **System prompt guidance** for autonomous persistence decisions

No changes to the core ingestion logic are needed.

### Hot Path vs Background

Per AC#6, this uses **hot path** ingestion:
- Agent calls tool → blocks on response
- Fact immediately available for retrieval in same session
- No async job queue (pg-boss) involved

This is intentional for M&A use case where analyst corrections should be immediately available for follow-up queries in the same conversation.

### Graceful Degradation

If manda-processing is unavailable:
- Tool returns failure response
- Agent continues conversation normally
- User is NOT informed of storage failure (per autonomous design)
- Warning logged for monitoring

### Testing Strategy

**Unit Tests (Task 5):**
- Schema validation (Zod)
- Tool behavior with mocked fetch
- Error handling paths

**Integration Tests (Task 6):**
- Actual endpoint call
- Graphiti episode creation
- Search retrievability

**E2E Verification (Task 7):**
- Manual testing in chat interface
- Verify autonomous behavior (no prompts)
- Verify immediate retrievability

### Relationship to E11.4 (Intent-Aware Retrieval)

E11.4 (already done) implemented **pre-model retrieval** — proactively fetching relevant knowledge before agent responds.

E11.3 implements the **write** side — persisting valuable facts from conversation to the knowledge base.

Together they form the **Select + Write** strategies from LangChain's context engineering framework:
- **Select (E11.4):** Pull relevant information in before responding
- **Write (E11.3):** Persist valuable information for future retrieval

---

## Project Structure Notes

### Alignment with Unified Project Structure

- New tool in `manda-app/lib/agent/tools/` - consistent with existing tool modules
- New endpoint in `manda-processing/src/api/routes/` - follows existing route patterns
- Tests in standard test directories
- Uses patterns from E10.5 (ingestion service)

### Detected Variances

- None - this story follows established patterns

---

## References

- [Epic E11: Agent Context Engineering](../epics/epic-E11.md) - Epic context, particularly E11.3 section
- [E10.5 Story: Q&A and Chat Ingestion](../epics/epic-E10.md#e105-qa-and-chat-ingestion) - Ingestion service already implemented
- [E11.4 Story: Intent-Aware Retrieval](./e11-4-intent-aware-knowledge-retrieval.md) - Complementary "Select" strategy
- [E11.1 Story: Tool Result Isolation](./e11-1-tool-result-isolation.md) - Tool patterns
- [LangChain Context Engineering Blog](https://blog.langchain.com/context-engineering-for-agents/) - "Write" strategy
- [Graphiti GitHub](https://github.com/getzep/graphiti) - Episode API and temporal model
- [Source: manda-processing/src/graphiti/ingestion.py] - GraphitiIngestionService.ingest_chat_fact()
- [Source: manda-processing/src/graphiti/client.py] - GraphitiClient.add_episode()
- [Source: manda-app/lib/agent/tools/knowledge-tools.ts] - Existing tool patterns
- [Source: manda-app/lib/agent/prompts.ts] - System prompt structure

---

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### Change Log

- 2025-12-18: Story validated and improved with critical integration details
  - Added router registration steps to Task 1.5
  - Clarified dealId context flow (agent config → prompt → LLM → tool input)
  - Specified schema location in schemas.ts (centralized pattern)
  - Added environment configuration documentation
  - Clarified prompts.ts integration point (within TOOL_USAGE_PROMPT)
  - Consolidated verbose code examples with pattern references
- 2025-12-18: Story created via create-story workflow

### Implementation Summary

**Date:** 2025-12-18

**Files Created:**
- `manda-processing/src/api/routes/graphiti.py` - Ingest endpoint with `POST /api/graphiti/ingest`
- `manda-app/__tests__/lib/agent/knowledge-write-back.test.ts` - 26 unit tests for schema validation, tool behavior, and prompt integration
- `manda-processing/tests/integration/test_graphiti_ingest.py` - Integration tests for endpoint

**Files Modified:**
- `manda-processing/src/main.py` - Added graphiti router registration
- `manda-app/lib/agent/schemas.ts` - Added `IndexToKnowledgeBaseInputSchema`
- `manda-app/lib/agent/tools/knowledge-tools.ts` - Added `indexToKnowledgeBaseTool`
- `manda-app/lib/agent/tools/all-tools.ts` - Added tool to array, updated count 17→18
- `manda-app/lib/agent/prompts.ts` - Added "Autonomous Knowledge Persistence (E11.3)" section
- `manda-app/__tests__/lib/agent/irl-tools.test.ts` - Updated tool count expectation 17→18

**Key Implementation Details:**
1. API endpoint uses lazy import of `GraphitiIngestionService` to avoid circular dependencies
2. Tool implements graceful degradation - continues conversation if manda-processing unavailable
3. System prompt provides clear PERSIST vs DO NOT PERSIST guidance
4. Schema enforces minimum 10 char content, valid UUID for deal_id, enum for source_type
5. All 26 unit tests pass, 47 relevant integration tests pass

### File List

