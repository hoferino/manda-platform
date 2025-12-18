# Epic 11: Agent Context Engineering

**Epic ID:** E11
**Jira Issue:** SCRUM-11
**Priority:** P1

**User Value:** The conversational agent retrieves relevant knowledge to prevent hallucinations, autonomously persists valuable insights from conversations, and maintains coherent context — enabling the "agent chat from anywhere" vision where users can accomplish any platform task through natural conversation.

> **Note (v4.0):** This epic updated to integrate with Graphiti + Neo4j knowledge architecture. References to pgvector replaced with Graphiti. See [Sprint Change Proposal 2025-12-15](../../sprint-change-proposal-2025-12-15.md).
>
> **Note (v5.0):** Epic reprioritized based on research (2025-12-17). **Retrieval quality** (E11.4) and **agent-autonomous persistence** (E11.3) are now highest priority. Token optimization stories (E11.1, E11.2) moved to backlog — M&A conversations are typically short-to-medium sessions where context window isn't the bottleneck.

---

## Problem Statement

### Current Limitations (Prioritized)

1. **🔴 No intelligent retrieval** — Agent relies on tool-based search but may not know when to search. Complex queries may miss relevant context, leading to hallucinations or incomplete answers.

2. **🔴 No write-back to knowledge base** — User insights from chat aren't persisted. When a user says "Revenue for Q3 was actually $5.2M, not $4.8M", this correction exists only in chat context, not in the knowledge base.

3. **🟡 Naive message history** — Current implementation keeps last 10 messages with character-based token estimation. No summarization, no intelligent pruning.

4. **🟢 Context bloat from tool calls** — Each tool invocation adds ~500 tokens. Lower priority since typical M&A sessions are 10-30 messages, well within context limits.

### Vision: Agent-Autonomous Knowledge Flow

```
User Input → Agent evaluates → Autonomously persists to Graphiti → Available for future retrieval
                                       ↓
                       No user confirmation needed
                                       ↓
                      Agent informs: "I've noted that..."
```

**Key Insight:** Graphiti already handles the hard parts (entity extraction, deduplication, contradiction handling via temporal invalidation). The agent just needs to decide **when** to call `add_episode` — not **how** to extract facts.

**Design Principle:** Users shouldn't validate storage decisions. The agent evaluates autonomously based on:
- Is this a factual assertion (not a question)?
- Is this novel information (not already known)?
- What's the confidence level (analyst source = high)?

---

## Research Foundation

### Story Priority (Revised 2025-12-17)

Based on research into LangChain/LangGraph best practices, Graphiti architecture, and M&A workflow analysis:

| Priority | Story | Rationale |
|----------|-------|-----------|
| **P0** | E11.4 Intent-Aware Retrieval | Prevents hallucinations — the core problem |
| **P0** | E11.3 Agent-Autonomous Write-Back | Captures valuable insights without user friction |
| **P1** | E11.5 Pydantic AI Tools | Type safety for Python backend |
| **P1** | E11.6 Model Configuration | Easy provider switching |
| **P2** | E11.2 Conversation Summarization | Nice-to-have for long sessions |
| **P3** | E11.1 Tool Result Isolation | Token optimization — not the bottleneck |
| **P3** | E11.7 Integration Tests | After core features implemented |

### Graphiti Episode Architecture

Based on [Zep's Temporal Knowledge Graph paper](https://arxiv.org/html/2501.13956v1) and [Graphiti documentation](https://github.com/getzep/graphiti):

**Key Insight:** Graphiti processes "episodes" (text or JSON) and **automatically** handles:
- Entity extraction via LLM (zero-shot, no predefined types)
- Entity resolution via cosine similarity + full-text search
- Fact extraction between resolved entities
- Contradiction handling via **temporal edge invalidation** (not user prompts)
- Graph persistence via predefined Cypher queries

```python
# All the agent needs to do is call add_episode
# Graphiti handles extraction, resolution, and contradiction detection
await graphiti.add_episode(
    name="analyst_insight",
    episode_body="Q3 revenue was $5.2M, not $4.8M as stated in financials.xlsx",
    source=EpisodeType.text,
    reference_time=datetime.now(),
    source_description="Analyst correction via chat"
)
# → Graphiti auto-extracts: Q3, Revenue, $5.2M, financials.xlsx
# → Graphiti auto-detects: conflict with existing $4.8M edge
# → Graphiti auto-invalidates: old edge marked invalid_at = now
# → User sees: nothing (no confirmation needed)
```

**Implication for E11.3:** The "intelligent evaluation" happens at the agent prompt level (should I persist this?), not in extraction logic (how do I parse this?).

### LangGraph Long-Term Memory

Based on [LangGraph Long-Term Memory announcement](https://blog.langchain.com/launching-long-term-memory-support-in-langgraph/):

**Two approaches for when to persist:**
- **Hot path:** Agent decides before responding (adds latency, immediate persistence)
- **Background:** Async process after response (no latency, delayed persistence)

**For M&A use case:** Hot path is preferred — analyst corrections should be immediately available for follow-up queries in the same session.

### LangChain Context Engineering Framework

Based on [LangChain's Context Engineering blog post](https://blog.langchain.com/context-engineering-for-agents/), there are four strategies:

| Strategy | Description | Our Application |
|----------|-------------|-----------------|
| **Write** | Persist information outside context window | Write findings/entities to Graphiti + Neo4j (E10, E11.3) |
| **Select** | Pull relevant information in | Graphiti hybrid retrieval + reranking before responding (E11.4) |
| **Compress** | Token-efficient management | Summarize long conversations (E11.2) |
| **Isolate** | Strategic context splitting | **Tool Result Isolation (E11.1)** - Return summaries, cache full results |

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

- **FR-CTX-001:** Tool results isolated at execution time — summaries in context, full data in cache
- **FR-CTX-002:** Long conversations summarized using LangGraph patterns to maintain coherence
- **FR-CTX-003:** User-provided facts indexed to knowledge base from chat (Write strategy)
- **FR-CTX-004:** Context retrieves relevant knowledge before each response (Select strategy)
- **FR-CTX-005:** Type-safe tool definitions with Pydantic AI validation (Python backend)
- **FR-CTX-006:** Model switching without code changes

---

## Stories

### E11.1: Tool Result Isolation

**Story ID:** E11.1
**Points:** 5
**Priority:** P3 (Backlog)

> **Note:** Deprioritized (2025-12-17). M&A conversations are typically 10-30 messages — context window isn't the bottleneck. Focus on retrieval quality (E11.4) and autonomous persistence (E11.3) first.

**Description:**
Implement tool result isolation pattern where tool executions return concise summaries to the LLM context while storing full results in a separate cache. This follows LangChain's "Isolate" context engineering strategy.

**Acceptance Criteria:**
- [ ] Tool executions return concise summaries (~50-100 tokens) as ToolMessage content
- [ ] Full tool results stored in separate `ToolResultCache` outside message array
- [ ] Summaries preserve key information (count, confidence, key snippet, sources)
- [ ] Full results accessible via `getToolResult(toolCallId)` for debugging
- [ ] Token savings measured and logged

**Technical Notes:**
```typescript
// Tool isolation at execution time (not post-hoc compression)
export function createIsolatedTool(tool: StructuredTool, cache: ToolResultCache) {
  return {
    ...tool,
    invoke: async (input, options) => {
      const fullResult = await tool.invoke(input, options)
      const summary = summarizeForLLM(tool.name, fullResult)
      cache.set(options.tool_call_id, { fullResult, summary })
      return summary // LLM sees concise summary
    }
  }
}

// Example: 800 tokens → 50 tokens
// Full: { success: true, data: { findings: [...5 items with metadata...] } }
// Summary: "[query_knowledge_base] 5 findings (conf: 0.89-0.95). Key: Q3 revenue $5.2M..."
```

**Why Isolation Instead of Compression:**
- **Compression (old):** Modify messages after agent responds → breaks message integrity
- **Isolation (new):** Return summaries from start → message history stays valid

**Files to modify:**
- New: `manda-app/lib/agent/tool-isolation.ts`
- `manda-app/lib/agent/executor.ts`
- `manda-app/lib/agent/cim/workflow.ts`

---

### E11.2: Conversation Summarization

**Story ID:** E11.2
**Points:** 5
**Priority:** P2 (Nice-to-have)

> **Note:** Lower priority than E11.3/E11.4. Useful for extended sessions but not critical for typical M&A workflows.

**Description:**
Implement conversation summarization using LangGraph's built-in utilities (`trim_messages`, summarization patterns) to compress older conversation segments while preserving context. This implements the **Compress** strategy from LangChain's context engineering framework.

**Acceptance Criteria:**
- [ ] When conversation exceeds threshold (e.g., 20 messages), older messages summarized
- [ ] Summary includes: topics discussed, decisions made, key facts learned
- [ ] Recent messages (last 10) kept verbatim
- [ ] Summarization runs asynchronously, doesn't block response
- [ ] Summary stored in agent state for retrieval
- [ ] Uses LangGraph's `trim_messages` for token-aware pruning

**Technical Notes:**
```typescript
// LangGraph summarization pattern with trim_messages
import { trimMessages } from '@langchain/core/messages'

const summarizationNode = async (state: AgentState) => {
  // First, trim to token budget
  const trimmed = await trimMessages(state.messages, {
    maxTokens: 4000,
    strategy: 'last', // Keep recent messages
    includeSystem: true,
  })

  // If still too many messages, summarize older ones
  if (trimmed.length > 20) {
    const toSummarize = trimmed.slice(0, -10)
    const recent = trimmed.slice(-10)

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
  return { messages: trimmed }
}
```

**Key LangGraph Utilities:**
- `trimMessages` — Token-aware message pruning (built-in)
- State checkpointing — Persist summaries across sessions
- Async node execution — Non-blocking summarization

**Files to modify:**
- `manda-app/lib/agent/executor.ts`
- `manda-app/lib/agent/context.ts`
- New: `manda-app/lib/agent/summarization.ts`

---

### E11.3: Agent-Autonomous Knowledge Write-Back

**Story ID:** E11.3
**Points:** 8
**Priority:** P0 (Critical)

**Description:**
Enable the agent to **autonomously** recognize and persist user-provided facts to Graphiti without requiring user confirmation. The agent evaluates whether information is worth persisting and calls `add_episode` directly. Graphiti handles entity extraction, resolution, and contradiction detection automatically.

**Design Principle:** Users shouldn't validate storage decisions. They don't know what Graphiti is, nor should they care. The agent makes intelligent autonomous decisions.

**Acceptance Criteria:**
- [ ] Agent autonomously detects factual assertions (not questions, greetings, or meta-conversation)
- [ ] Agent calls `add_episode` for: analyst corrections, confirmed facts, new information
- [ ] Agent does NOT persist: questions, greetings, opinions without facts, conversation meta
- [ ] Graphiti auto-handles: entity extraction, resolution, deduplication, contradiction invalidation
- [ ] Agent confirms naturally: "Got it, I've noted that..." (no "do you want me to save this?")
- [ ] Persisted facts immediately retrievable in same session (hot path, not background)

**What to Persist (Agent Decides Autonomously):**
| Trigger | Example | Action |
|---------|---------|--------|
| Analyst correction | "Actually it was $5.2M, not $4.8M" | Persist (confidence: 0.95) |
| Analyst confirmation | "Yes, that revenue figure is correct" | Persist (confidence: 0.90) |
| New factual info | "The company has 150 employees" | Persist (confidence: 0.85) |
| Tool-discovered contradiction | detect_contradictions returns conflict | Persist (confidence: 0.80) |

**What NOT to Persist:**
| Type | Example | Reason |
|------|---------|--------|
| Questions | "What was Q3 revenue?" | Not factual |
| Greetings | "Hello", "Thanks" | Not valuable |
| Meta-conversation | "Summarize what we discussed" | About conversation, not facts |
| Opinions | "I think we should focus on..." | Not verifiable facts |

**Example Flow:**
```
User: "The Q3 revenue was actually $5.2M, not $4.8M as stated in the document"

Agent evaluates (internally, not shown to user):
  ✓ Factual assertion (contains specific data)
  ✓ Correction pattern ("actually", "not X as stated")
  ✓ High confidence source (analyst)
  → Decision: PERSIST

Agent calls:
  graphiti.add_episode(
    episode_body="Q3 revenue was $5.2M (analyst correction, supersedes $4.8M)",
    source_description="Analyst chat correction",
    reference_time=datetime.now()
  )

Graphiti auto-handles:
  → Entity extraction: Q3, Revenue, $5.2M, Company
  → Conflict detection: finds existing $4.8M edge
  → Temporal invalidation: old edge marked invalid_at = now

Agent responds:
  "Got it. I've updated the knowledge base — Q3 revenue is now $5.2M."
  (No "Would you like me to save this?" friction)
```

**Technical Notes:**
```typescript
// Agent prompt includes persistence decision logic
const PERSISTENCE_PROMPT = `
When the user provides factual information, autonomously persist it to the knowledge base.

PERSIST when user:
- Corrects existing information ("actually", "not X", "the real number is")
- Confirms a fact ("yes, that's correct", "confirmed")
- Provides new data ("the company has", "revenue was", "they acquired")

DO NOT PERSIST when user:
- Asks questions
- Greets or thanks
- Discusses the conversation itself
- Expresses opinions without facts

When persisting, call index_to_knowledge_base and then inform the user naturally:
"Got it, I've noted that [fact]."
DO NOT ask "Would you like me to save this?" — just do it.
`

// Tool implementation (simplified — calls Graphiti)
const indexToKnowledgeBaseTool = tool(
  async ({ content, source_type }: { content: string; source_type: string }) => {
    await graphiti.addEpisode({
      name: `analyst_${source_type}`,
      episodeBody: content,
      source: EpisodeType.text,
      referenceTime: new Date(),
      sourceDescription: `Analyst ${source_type} via chat`
    })
    return { success: true, message: 'Indexed to knowledge base' }
  },
  {
    name: 'index_to_knowledge_base',
    description: 'Persist a fact from conversation to the knowledge base. Call autonomously when user provides valuable information.',
    schema: z.object({
      content: z.string().describe('The factual content to persist'),
      source_type: z.enum(['correction', 'confirmation', 'new_info']).describe('Type of information')
    })
  }
)
```

**Files to modify:**
- `manda-app/lib/agent/tools/knowledge-tools.ts` — add `index_to_knowledge_base` tool
- `manda-app/lib/agent/tools/all-tools.ts` — register tool
- `manda-app/lib/agent/prompts.ts` — add persistence decision logic to system prompt
- `manda-processing/src/api/routes/graphiti.py` — expose add_episode endpoint if not exists

---

### E11.4: Intent-Aware Knowledge Retrieval

**Story ID:** E11.4
**Points:** 5
**Priority:** P0 (Critical)

**Description:**
Implement intent-aware pre-model hook that retrieves relevant context from the knowledge base only when the user query requires factual knowledge. Skip retrieval for greetings, meta-questions, and conversation management. **This is the primary defense against hallucinations** — ensuring the agent has relevant facts before responding.

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
Migrate Python backend (manda-processing) to Pydantic AI for type-safe agent tool definitions, enabling compile-time error detection and improved developer experience. **Note:** This applies to Python only — TypeScript tools in manda-app continue using Zod schemas.

**Why Pydantic AI (Python Backend Only):**
- **Type safety** — Catch errors at write-time in IDE, not runtime in production
- **Dependency injection** — `RunContext[Deps]` ensures type-safe access to DB, LLM
- **Structured outputs** — Pydantic models guarantee response format
- **Model agnostic** — Switch between Anthropic, OpenAI, Gemini via config string
- **Observability** — Native Logfire integration for tracing

**Acceptance Criteria:**
- [ ] Pydantic AI installed and configured in manda-processing
- [ ] Document analysis pipeline migrated to Pydantic AI pattern
- [ ] Type-safe dependency injection for Supabase client, Graphiti client, LLM
- [ ] IDE autocomplete works for tool parameters and dependencies
- [ ] Logfire integration for observability (optional)
- [ ] Documentation for extending with new tools

**Technical Notes:**
```python
from pydantic_ai import Agent, RunContext
from pydantic import BaseModel

class AnalysisDependencies(BaseModel):
    """Type-safe dependencies injected into tools"""
    db: SupabaseClient
    graphiti: GraphitiClient
    deal_id: str

class FindingResult(BaseModel):
    """Structured output validated by Pydantic"""
    content: str
    finding_type: str
    confidence: float
    source_reference: dict

# Model string syntax enables easy switching
analysis_agent = Agent(
    'google:gemini-2.5-flash',  # or 'anthropic:claude-sonnet-4-0'
    deps_type=AnalysisDependencies,
    result_type=FindingResult,
)

@analysis_agent.tool
async def extract_finding(
    ctx: RunContext[AnalysisDependencies],  # Type-checked!
    chunk_content: str,
) -> FindingResult:
    """Extract a finding from document chunk.

    Docstring becomes tool description for LLM.
    """
    # IDE autocomplete: ctx.deps.db, ctx.deps.graphiti, ctx.deps.deal_id
    findings = await ctx.deps.graphiti.search(chunk_content)
    ...
```

**Scope:**
- **In scope:** Python backend (manda-processing) document analysis, extraction pipelines
- **Out of scope:** TypeScript tools (continue using Zod + LangChain StructuredTool)

**Files to modify:**
- `manda-processing/pyproject.toml` — add pydantic-ai dependency
- `manda-processing/src/llm/agent.py` (new) — Pydantic AI agent
- `manda-processing/src/llm/tools/` (new) — type-safe tools
- `manda-processing/src/jobs/handlers/` — migrate extraction handlers

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
- [ ] Test: Tool calls → isolation → token count reduced in LLM context
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

  it('isolates tool results at execution time', async () => {
    // Trigger 3 tool calls via isolated tools
    // Verify LLM context receives concise summaries (~50-100 tokens each)
    // Verify full results stored in ToolResultCache
    // Verify getToolResult(toolCallId) returns complete data
    // Verify token savings logged (expected: 70-80% reduction)
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
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                  CONTEXT ENGINEERING STRATEGIES                  │    │
│  │                                                                  │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │    │
│  │  │   ISOLATE   │  │   SELECT    │  │  COMPRESS   │  │  WRITE  │ │    │
│  │  │   (E11.1)   │  │   (E11.4)   │  │   (E11.2)   │  │ (E11.3) │ │    │
│  │  │             │  │             │  │             │  │         │ │    │
│  │  │ Tool result │  │ Pre-model   │  │ Summarize   │  │ Index   │ │    │
│  │  │ summaries   │  │ retrieval   │  │ older msgs  │  │ facts   │ │    │
│  │  │ + cache     │  │ from KB     │  │ trim_msgs   │  │ to KB   │ │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    AGENT EXECUTOR (LangGraph)                      │  │
│  │  • ReAct pattern with isolated tools (summaries in context)        │  │
│  │  • SSE streaming with token savings metrics                        │  │
│  │  • Checkpointing (short-term memory)                               │  │
│  │  • ToolResultCache (full results for debugging)                    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│                              ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    KNOWLEDGE BASE (E10)                            │  │
│  │  • Graphiti: hybrid retrieval (vector + BM25 + graph)              │  │
│  │  • Neo4j: entity relationships and temporal edges                  │  │
│  │  • Voyage AI: embeddings with reranking                            │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Four Context Engineering Strategies (LangChain Framework)

| Strategy | Story | Implementation |
|----------|-------|----------------|
| **Isolate** | E11.1 | Tool wrapper returns summaries, caches full results |
| **Select** | E11.4 | Pre-model hook retrieves relevant KB context |
| **Compress** | E11.2 | `trimMessages` + LLM summarization for long conversations |
| **Write** | E11.3 | Index user-provided facts to Graphiti |

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
- [Memory for Agents - LangChain Blog](https://blog.langchain.com/memory-for-agents/)
- [Long-Term Memory Support in LangGraph](https://blog.langchain.com/launching-long-term-memory-support-in-langgraph/)
- [Zep: Temporal Knowledge Graph Architecture (arXiv)](https://arxiv.org/html/2501.13956v1)
- [Graphiti GitHub Repository](https://github.com/getzep/graphiti)
- [LangGraph Short-term Memory Docs](https://docs.langchain.com/oss/python/langchain/short-term-memory)
- [Pydantic AI Documentation](https://ai.pydantic.dev/)
- [LangGraph Message History Management](https://langchain-ai.github.io/langgraph/how-tos/create-react-agent-manage-message-history/)

---

*Epic created: 2025-12-14*
*Updated: 2025-12-15 (Graphiti integration)*
*Updated: 2025-12-17 (E11.1 Tool Result Isolation pattern, LangChain context engineering research)*
*Updated: 2025-12-17 (v5.0) **Major reprioritization:** E11.4 (retrieval) and E11.3 (autonomous write-back) now P0. E11.1/E11.2 moved to backlog. Research added: Graphiti episode architecture, LangGraph long-term memory, agent-autonomous persistence patterns.*
*Status: Backlog*
