# Epic 11: Agent Context Engineering

**Epic ID:** E11
**Jira Issue:** SCRUM-11
**Priority:** P1

**User Value:** The conversational agent maintains coherent context across long sessions, efficiently retrieves knowledge from the persistent store, and seamlessly indexes user-provided information — enabling the "agent chat from anywhere" vision where users can accomplish any platform task through natural conversation.

> **Note (v4.0):** This epic updated to integrate with Graphiti + Neo4j knowledge architecture. References to pgvector replaced with Graphiti. See [Sprint Change Proposal 2025-12-15](../../sprint-change-proposal-2025-12-15.md).

---

## Problem Statement

### Current Limitations

1. **Context bloat from tool calls** — Each tool invocation adds ~500 tokens (request + result). After 5 tool calls, context is polluted with verbose intermediate data that's no longer needed.

2. **Naive message history** — Current implementation keeps last 10 messages with character-based token estimation. No summarization, no intelligent pruning.

3. **No write-back to knowledge base** — User insights from chat aren't persisted. When a user says "Revenue for Q3 was actually $5.2M, not $4.8M", this correction exists only in chat context, not in the knowledge base.

4. **Context-Knowledge Base disconnect** — The agent queries the knowledge base but doesn't dynamically offload learned information back to it. Context and storage are separate systems.

### Vision: Seamless Context-Knowledge Flow

```
User Input → Agent understands → Indexes to Knowledge Base → Available for future retrieval
                                       ↓
                          Frees context for new work
                                       ↓
                        Long conversation remains coherent
```

**Key Insight:** The Knowledge Base (E10) and Agent Context (E11) are complementary. E10 provides the persistent store; E11 provides the dynamic flow between conversation and storage.

---

## Research Foundation

### LangChain Context Engineering Framework

Based on [LangChain's Context Engineering blog post](https://blog.langchain.com/context-engineering-for-agents/), there are four strategies:

| Strategy | Description | Our Application |
|----------|-------------|-----------------|
| **Write** | Persist information outside context window | Write findings/entities to Graphiti + Neo4j (E10) |
| **Select** | Pull relevant information in | Graphiti hybrid retrieval + reranking before responding |
| **Compress** | Token-efficient management | Summarize tool results, prune old messages |
| **Isolate** | Strategic context splitting | Keep tool results outside context until needed |

### LangGraph Memory Capabilities

From [LangGraph Short-term Memory docs](https://docs.langchain.com/oss/python/langchain/short-term-memory):

- **Checkpointing** — Persist agent state across steps (already implemented)
- **SummarizationMiddleware** — Built-in summarization for message history
- **trim_messages** — Utility for token-aware message pruning
- **Long-term memory** — Cross-session persistence via stores (aligns with E10)

### Pydantic AI Benefits

Based on [Pydantic AI documentation](https://ai.pydantic.dev/):

**What is Type Safety?**
Type safety means catching errors at write-time (in your IDE) rather than runtime (in production). In the context of AI agents:

| Without Type Safety | With Type Safety |
|---------------------|------------------|
| LLM calls tool with wrong argument type → Runtime error | IDE shows error before you run code |
| Tool expects `deal_id: UUID` but gets `string` → Crashes | Type checker catches mismatch |
| Agent accesses undefined dependency → Production failure | Autocomplete shows available deps |

**Pydantic AI Key Features:**
- **Model agnostic** — Switch between Anthropic, OpenAI, Gemini, etc. with config change
- **Type-safe tools** — Tool parameters validated against schemas
- **Dependency injection** — `RunContext[Dependencies]` ensures type-safe access to database, services
- **Structured outputs** — Pydantic models guarantee response format
- **Observability** — Native Logfire integration for tracing

**Migration Path:**
```python
# Current (Zod schemas in TypeScript, Pydantic in Python)
# After E11 (Unified Pydantic AI for Python, enhanced Zod for TypeScript)
```

---

## Functional Requirements

- **FR-CTX-001:** Tool call results compressed or pruned after agent responds
- **FR-CTX-002:** Long conversations summarized to maintain coherence
- **FR-CTX-003:** User-provided facts indexed to knowledge base from chat
- **FR-CTX-004:** Context retrieves relevant knowledge before each response
- **FR-CTX-005:** Type-safe tool definitions with validation
- **FR-CTX-006:** Model switching without code changes

---

## Stories

### E11.1: Tool Call Context Compression

**Story ID:** E11.1
**Points:** 5

**Description:**
Implement post-response hook that compresses or removes tool call artifacts from conversation history after the agent produces a final response.

**Acceptance Criteria:**
- [ ] After agent response, tool calls and results are summarized or removed
- [ ] Summary preserves key information (what tool was used, key result)
- [ ] Full tool results available in debug logs but not in context
- [ ] Configurable: full removal vs. compression
- [ ] Token savings measured and logged

**Technical Notes:**
```typescript
// Post-response hook
const postResponseHook = (state: AgentState) => {
  const compressed = compressToolCalls(state.messages)
  return { messages: compressed }
}

function compressToolCalls(messages: Message[]): Message[] {
  return messages.map(msg => {
    if (msg.role === 'tool') {
      // Compress: "query_knowledge_base returned 5 findings about Q3 revenue"
      return { ...msg, content: summarizeToolResult(msg) }
    }
    return msg
  })
}
```

**Files to modify:**
- `manda-app/lib/agent/executor.ts`
- `manda-app/lib/agent/context.ts`
- New: `manda-app/lib/agent/compression.ts`

---

### E11.2: Conversation Summarization

**Story ID:** E11.2
**Points:** 5

**Description:**
Implement LangGraph's SummarizationMiddleware pattern to summarize older conversation segments, preserving context while freeing tokens.

**Acceptance Criteria:**
- [ ] When conversation exceeds threshold (e.g., 20 messages), older messages summarized
- [ ] Summary includes: topics discussed, decisions made, key facts learned
- [ ] Recent messages (last 10) kept verbatim
- [ ] Summarization runs asynchronously, doesn't block response
- [ ] Summary stored in agent state for retrieval

**Technical Notes:**
```typescript
// LangGraph summarization pattern
const summarizationNode = async (state: AgentState) => {
  if (state.messages.length > 20) {
    const toSummarize = state.messages.slice(0, -10)
    const recent = state.messages.slice(-10)

    const summary = await llm.invoke([
      { role: 'system', content: SUMMARIZATION_PROMPT },
      ...toSummarize
    ])

    return {
      messages: [
        { role: 'system', content: `Previous context: ${summary}` },
        ...recent
      ],
      summaryCreatedAt: new Date()
    }
  }
  return state
}
```

**Files to modify:**
- `manda-app/lib/agent/executor.ts`
- `manda-app/lib/agent/context.ts`
- New: `manda-app/lib/agent/summarization.ts`

---

### E11.3: Knowledge Base Write-Back from Chat

**Story ID:** E11.3
**Points:** 8

**Description:**
Enable the agent to recognize user-provided facts in conversation and index them to the knowledge base (Graphiti + Neo4j), making them available for future retrieval.

**Acceptance Criteria:**
- [ ] Agent detects when user provides factual information (not questions)
- [ ] Facts extracted with: content, source="analyst_chat", confidence, time_period
- [ ] Facts ingested to Graphiti as episodes (E10.5 integration)
- [ ] Entities extracted and resolved automatically
- [ ] Agent confirms: "I've noted that Q3 revenue was $5.2M in the knowledge base"
- [ ] Duplicate detection: don't re-index known facts

**Example Flow:**
```
User: "Actually, the Q3 revenue was $5.2M, not $4.8M as stated in the document"
Agent: [Extracts fact] → [Creates Graphiti episode] → [Entity resolution]
       → [Old fact marked invalid_at, SUPERSEDES relationship created]
       → "Got it. I've updated the knowledge base with Q3 revenue of $5.2M
          and noted this supersedes the previous $4.8M figure from financials.xlsx"
```

**Technical Notes:**
- New tool: `index_user_fact` — calls Graphiti ingestion API (E10.5)
- Integrate with E10 Graphiti pipeline for entity extraction and resolution
- Confidence score: 0.95 for analyst-provided facts (higher than document-extracted)

**Files to modify:**
- `manda-app/lib/agent/tools/knowledge.ts` — add `index_user_fact` tool
- `manda-app/lib/agent/tools/index.ts` — register tool
- Integration with E10 Neo4j sync

---

### E11.4: Intent-Aware Knowledge Retrieval

**Story ID:** E11.4
**Points:** 5

**Description:**
Implement intent-aware pre-model hook that retrieves relevant context from the knowledge base only when the user query requires factual knowledge. Skip retrieval for greetings, meta-questions, and conversation management.

**Acceptance Criteria:**
- [ ] Intent classification before retrieval (greeting, meta, factual, task)
- [ ] Skip retrieval for non-knowledge intents (greetings, "summarize our chat", etc.)
- [ ] For factual/task intents, use Graphiti hybrid retrieval + Voyage reranking (E10.7)
- [ ] Retrieved context injected into system prompt
- [ ] Token budget for retrieval context (max 2000 tokens)
- [ ] Caching: don't re-retrieve for follow-up on same topic

**Technical Notes:**
```typescript
// Intent patterns that don't need KB retrieval
const SKIP_RETRIEVAL_PATTERNS = [
  /^(hi|hello|hey|thanks|bye)/i,           // greetings
  /^(what can you|help me understand)/i,   // meta questions about agent
  /^(summarize|recap|what did we)/i,       // conversation meta
]

const preModelHook = async (state: AgentState) => {
  const lastMessage = state.messages.at(-1)?.content || ''

  // Skip retrieval for non-knowledge intents
  if (SKIP_RETRIEVAL_PATTERNS.some(p => p.test(lastMessage))) {
    return state // No modification
  }

  // Extract query from recent messages
  const query = extractQueryFromMessages(state.messages.slice(-3))

  // Retrieve relevant knowledge via Graphiti + reranking
  const relevantFindings = await graphitiRetrieve(query, { limit: 50, rerankTo: 5 })

  if (relevantFindings.length === 0) {
    return state // No relevant context found
  }

  // Inject into context
  const knowledgeContext = formatFindingsAsContext(relevantFindings)

  return {
    llm_input_messages: [
      { role: 'system', content: `Relevant knowledge:\n${knowledgeContext}` },
      ...state.messages
    ]
  }
}
```

**Design Decision:** The current tool-based approach (agent calls `query_knowledge_base` when needed) remains the primary mechanism. This hook provides *proactive* retrieval for complex queries where the agent might not know to search.

**Files to modify:**
- `manda-app/lib/agent/executor.ts`
- `manda-app/lib/agent/context.ts`
- `manda-app/lib/agent/retrieval.ts` (new)

---

### E11.5: Type-Safe Tool Definitions with Pydantic AI

**Story ID:** E11.5
**Points:** 8

**Description:**
Migrate Python backend (manda-processing) to Pydantic AI for type-safe agent tool definitions, enabling compile-time error detection and improved developer experience.

**Acceptance Criteria:**
- [ ] Pydantic AI installed and configured in manda-processing
- [ ] Existing analysis tools migrated to Pydantic AI pattern
- [ ] Type-safe dependency injection for database, LLM client
- [ ] IDE autocomplete works for tool parameters
- [ ] Logfire integration for observability (optional)
- [ ] Documentation for extending with new tools

**Technical Notes:**
```python
from pydantic_ai import Agent, RunContext
from pydantic import BaseModel

class AnalysisDependencies(BaseModel):
    db: SupabaseClient
    llm: GeminiClient
    deal_id: str

class FindingResult(BaseModel):
    content: str
    finding_type: str
    confidence: float
    source_reference: dict

analysis_agent = Agent(
    'google:gemini-2.5-flash',
    deps_type=AnalysisDependencies,
    result_type=FindingResult,
)

@analysis_agent.tool
async def extract_finding(
    ctx: RunContext[AnalysisDependencies],
    chunk_content: str,
) -> FindingResult:
    """Extract a finding from document chunk."""
    # Type-safe access to ctx.deps.db, ctx.deps.llm
    ...
```

**Files to modify:**
- `manda-processing/pyproject.toml` — add pydantic-ai dependency
- `manda-processing/src/llm/agent.py` (new) — Pydantic AI agent
- `manda-processing/src/llm/tools/` (new) — type-safe tools

---

### E11.6: Model Configuration and Switching

**Story ID:** E11.6
**Points:** 3

**Description:**
Enhance model configuration to support easy switching between providers without code changes, enabling A/B testing and fallback strategies.

**Acceptance Criteria:**
- [ ] Model selection via environment variable or config file
- [ ] Pydantic AI string-based provider syntax: `'anthropic:claude-sonnet-4-0'`
- [ ] Fallback configuration: if primary fails, try secondary
- [ ] Cost tracking per provider
- [ ] A/B testing support: route percentage of requests to different models

**Technical Notes:**
```yaml
# config/models.yaml
agents:
  conversational:
    primary: 'anthropic:claude-sonnet-4-5-20250929'
    fallback: 'google:gemini-2.5-pro'

  extraction:
    primary: 'google:gemini-2.5-flash'
    fallback: 'openai:gpt-4-turbo'

  speed:
    primary: 'google:gemini-2.5-flash-lite'
```

**Files to modify:**
- `manda-app/lib/llm/config.ts` — enhance configuration
- `manda-processing/src/config.py` — add fallback support
- New: `config/models.yaml` — centralized model config

---

### E11.7: Context-Knowledge Integration Tests

**Story ID:** E11.7
**Points:** 5

**Description:**
Create comprehensive integration tests validating the flow between conversation context and knowledge base.

**Acceptance Criteria:**
- [ ] Test: User provides fact → indexed to KB → retrievable in new session
- [ ] Test: Long conversation → summarization → context remains coherent
- [ ] Test: Tool calls → compression → token count reduced
- [ ] Test: Model switch → same behavior with different provider
- [ ] Test: E10 + E11 integration — entities resolved, facts linked

**Test Scenarios:**
```typescript
describe('Context-Knowledge Integration', () => {
  it('indexes user-provided facts to knowledge base', async () => {
    // User says "Q3 revenue was $5.2M"
    // Verify finding created in PostgreSQL
    // Verify Information node in Neo4j
    // Verify retrievable via query_knowledge_base
  })

  it('compresses tool calls after response', async () => {
    // Trigger 3 tool calls
    // Verify token count before and after compression
    // Verify key information preserved in summary
  })

  it('summarizes long conversations', async () => {
    // Send 25 messages
    // Verify summarization triggered
    // Verify older messages replaced with summary
    // Verify agent can reference summarized content
  })
})
```

**Files to create:**
- `manda-app/__tests__/integration/context-knowledge.test.ts`
- `manda-processing/tests/integration/test_pydantic_ai.py`

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AGENT CONTEXT LAYER (E11)                         │
│                                                                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────┐ │
│  │ Pre-Model Hook │  │ Post-Response  │  │ Summarization Middleware   │ │
│  │                │  │ Hook           │  │                            │ │
│  │ • Retrieve KB  │  │ • Compress     │  │ • Summarize older msgs     │ │
│  │ • Inject ctx   │  │   tool calls   │  │ • Preserve recent context  │ │
│  └───────┬────────┘  └───────┬────────┘  └─────────────┬──────────────┘ │
│          │                   │                         │                 │
│          └───────────────────┼─────────────────────────┘                 │
│                              ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    AGENT EXECUTOR (LangGraph)                      │  │
│  │  • ReAct pattern with tool calling                                 │  │
│  │  • SSE streaming                                                   │  │
│  │  • Checkpointing (short-term memory)                               │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│                              ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    KNOWLEDGE BASE (E10)                            │  │
│  │  • pgvector: semantic search                                       │  │
│  │  • Neo4j: entity relationships                                     │  │
│  │  • Ontology: concept-aware extraction                              │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Integration with E10: Knowledge Base 2.0

| E10 Component | E11 Integration |
|---------------|-----------------|
| Graphiti Infrastructure (E10.1) | E11.3-E11.4 use Graphiti client |
| Voyage Embeddings (E10.2) | E11.4 retrieval uses same embeddings |
| Sell-Side Spine Schema (E10.3) | E11.3 facts use same entity types |
| Q&A and Chat Ingestion (E10.5) | E11.3 calls same ingestion pipeline |
| Entity Resolution (E10.6) | E11.3 facts auto-resolved |
| Hybrid Retrieval (E10.7) | E11.4 uses same retrieval + reranking |

---

## Success Criteria

1. **Token efficiency** — 50%+ reduction in context tokens after compression
2. **Long conversations** — 30+ message conversations remain coherent
3. **Knowledge persistence** — User facts retrievable in new sessions
4. **Type safety** — Zero runtime type errors in Pydantic AI tools
5. **Model switching** — Swap providers via config without code changes

---

## Dependencies

- **Requires:** E10 (Knowledge Graph Foundation) — especially Graphiti setup and retrieval pipeline
- **Enables:** "Agent chat from anywhere" vision
- **Parallel:** Can develop E11.1-E11.2 (compression/summarization) while E10 in progress; E11.3-E11.4 need E10.5 and E10.7

---

## References

- [Context Engineering for Agents - LangChain Blog](https://blog.langchain.com/context-engineering-for-agents/)
- [LangGraph Short-term Memory Docs](https://docs.langchain.com/oss/python/langchain/short-term-memory)
- [Pydantic AI Documentation](https://ai.pydantic.dev/)
- [LangGraph Message History Management](https://langchain-ai.github.io/langgraph/how-tos/create-react-agent-manage-message-history/)
- [LangChain Context Engineering Repository](https://github.com/langchain-ai/context_engineering)

---

*Epic created: 2025-12-14*
*Updated: 2025-12-15 (Graphiti integration)*
*Status: Backlog*
