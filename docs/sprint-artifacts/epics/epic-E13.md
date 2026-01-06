# Epic 13: Agent Orchestration Optimization

**Epic ID:** E13
**Jira Issue:** SCRUM-13
**Priority:** P1
**Points:** 46
**Stories:** 9

**User Value:** The conversational agent responds faster for simple queries (<500ms TTFT vs 19s), uses appropriate models based on query complexity, and provides more accurate responses through specialized agent routing. Cost per query drops significantly for routine questions.

---

## Problem Statement

### Current Situation

LangSmith trace analysis (2026-01-06) revealed performance issues:
- **19.4s Time-to-First-Token (TTFT)** even for simple queries
- **8,577 input tokens** per request (all 18 tools loaded regardless of need)
- **~3,750 token system prompt** loaded for every query
- **No model selection** — same model used for "hello" as for complex financial analysis
- **ReAct pattern overhead** — tool reasoning even when no tools needed

### Root Causes

1. **No Intent Classification for Complexity** — E11.4 classifies intent type (factual, analytical, etc.) but not complexity (simple, medium, complex)
2. **All Tools Always Loaded** — 18 tools (~3-4K tokens) in context regardless of query
3. **Single Model Strategy** — No routing to fast/cheap models for simple queries
4. **No Specialist Agents** — Complex queries use same generic agent vs domain specialists

### Vision: Intelligent Agent Orchestration

```
User Query → Intent + Complexity Classification
                    ↓
    ┌───────────────┼───────────────┐
    ↓               ↓               ↓
  SIMPLE         MEDIUM          COMPLEX
  Gemini 3       Gemini Pro      Claude Sonnet
  Flash          3-5 tools       + Specialists
  0 tools        <3s             5-15s
  <500ms
```

**Target Improvements:**
| Metric | Current | Target |
|--------|---------|--------|
| Simple Query TTFT | 19.4s | <500ms |
| Token Usage (Simple) | 8,577 | <2,000 |
| Cost per Simple Query | ~$0.001 | ~$0.0001 |

---

## Dependencies

- **E11.4 (Intent-Aware Retrieval):** Extend IntentClassifier with complexity scoring
- **E11.5 (Pydantic AI):** Use existing type-safe agent infrastructure
- **E11.6 (Model Configuration):** Extend models.yaml for routing matrix
- **E12.11 (LangSmith):** Use for performance validation
- **Supabase PostgreSQL:** For LangGraph checkpoint storage (E13.9)
- **Upstash Redis:** For distributed caching (E13.8) — serverless-native, no connection pooling needed

---

## Stories

### E13.1: Enhanced Intent Classification with Complexity Scoring

**Story ID:** E13.1
**Points:** 5
**Priority:** P0

**Description:**
Extend the existing IntentClassifier (from E11.4) to include complexity scoring. Complexity determines model selection and tool loading strategy.

**Acceptance Criteria:**
- [ ] Add `complexity` field to intent classification result (simple, medium, complex)
- [ ] Implement complexity scoring heuristics:
  - Simple: greetings, meta questions, single-fact lookups
  - Medium: factual queries requiring 1-3 tool calls
  - Complex: analytical queries, cross-domain analysis, multi-step workflows
- [ ] Add keyword/pattern detection for complexity indicators
- [ ] Create 50+ test cases covering complexity edge cases
- [ ] Update IntentClassifier cache to include complexity
- [ ] Log complexity classification to LangSmith trace metadata

**Technical Notes:**
```typescript
interface EnhancedIntent {
  type: 'factual' | 'analytical' | 'procedural' | 'conversational' | 'correction';
  complexity: 'simple' | 'medium' | 'complex';
  confidence: number;
  suggestedTools: string[];  // NEW: Pre-select tools based on intent
  suggestedModel: string;    // NEW: Model recommendation
}
```

**Complexity Signals:**
- Simple: <10 words, greeting patterns, "what is", single entity
- Medium: "compare", "find all", "summarize", specific document reference
- Complex: "analyze", "across all", financial terms + time ranges, "contradictions"

**Files to modify:**
- `manda-app/lib/agent/intent.ts`
- `manda-app/lib/agent/types.ts`
- `manda-app/__tests__/agent/intent.test.ts`

---

### E13.2: Tier-Based Tool Loading

**Story ID:** E13.2
**Points:** 5
**Priority:** P0

**Description:**
Implement dynamic tool loading based on intent complexity. Simple queries load no tools, medium queries load 3-5 relevant tools, complex queries load full tool suite or route to specialists.

**Acceptance Criteria:**
- [ ] Create TOOL_TIERS configuration mapping complexity → tools
- [ ] Implement `getToolsForIntent(intent)` function
- [ ] Modify agent executor to use dynamic tool loading
- [ ] Verify token reduction in LangSmith traces
- [ ] Add fallback: if tool needed but not loaded, escalate complexity
- [ ] Create tests for each tier combination

**Technical Notes:**
```typescript
const TOOL_TIERS = {
  simple: [],  // No tools — direct LLM response
  medium: [
    'search_documents',
    'get_finding',
    'get_qa_item',
    'search_knowledge_graph',
    'get_document_info'
  ],
  complex: 'all'  // Full 18 tools or route to specialist
};
```

**Escalation Logic:**
- If model attempts tool call but tool not in tier → escalate to next tier
- Log escalations to identify classification improvements

**Files to modify:**
- `manda-app/lib/agent/tools/tool-loader.ts` (NEW)
- `manda-app/lib/agent/executor.ts`
- `manda-app/lib/agent/config.ts`

---

### E13.3: Model Selection Matrix

**Story ID:** E13.3
**Points:** 3
**Priority:** P0

**Description:**
Implement model routing based on complexity. Simple queries use fast/cheap models, complex queries use capable/expensive models.

**Acceptance Criteria:**
- [ ] Create model selection matrix in `config/models.yaml`
- [ ] Implement `selectModelForComplexity(complexity)` function
- [ ] Integrate with LLM factory from E11.6
- [ ] Verify model switching in LangSmith traces
- [ ] Add cost tracking per complexity tier
- [ ] Create tests for model selection logic

**Technical Notes:**
```yaml
# config/models.yaml
agent_routing:
  simple:
    provider: google-gla
    model: gemini-2.0-flash-lite
    max_tokens: 500
    temperature: 0.3
  medium:
    provider: google-gla
    model: gemini-2.5-pro
    max_tokens: 2000
    temperature: 0.5
  complex:
    provider: anthropic
    model: claude-sonnet-4-20250514
    max_tokens: 4000
    temperature: 0.7
```

**Files to modify:**
- `manda-app/config/models.yaml`
- `manda-app/lib/llm/routing.ts` (NEW)
- `manda-app/lib/agent/executor.ts`

---

### E13.4: Supervisor Agent Pattern (LangGraph)

**Story ID:** E13.4
**Points:** 8
**Priority:** P1

**Description:**
Implement a supervisor agent that routes complex queries to specialist agents. The supervisor analyzes the query, selects appropriate specialists, and synthesizes results.

**Acceptance Criteria:**
- [ ] Create SupervisorAgent using LangGraph StateGraph
- [ ] Implement routing logic to specialist agents
- [ ] Create shared state schema for multi-agent communication
- [ ] Implement result synthesis from multiple specialists
- [ ] Add supervisor decisions to LangSmith traces
- [ ] Create fallback to general agent if no specialist matches
- [ ] Test with 20+ complex query scenarios

**Technical Notes:**
```typescript
interface SupervisorState {
  query: string;
  intent: EnhancedIntent;
  selectedSpecialists: string[];
  specialistResults: Map<string, SpecialistResult>;
  synthesizedResponse: string;
  sources: SourceReference[];
}

const supervisorGraph = new StateGraph<SupervisorState>()
  .addNode('classify', classifyNode)
  .addNode('route', routeNode)
  .addNode('financial_analyst', financialAnalystNode)
  .addNode('knowledge_graph', knowledgeGraphNode)
  .addNode('synthesize', synthesizeNode)
  .addEdge('classify', 'route')
  .addConditionalEdges('route', routeToSpecialists)
  .addEdge(['financial_analyst', 'knowledge_graph'], 'synthesize');
```

**Files to create:**
- `manda-app/lib/agent/supervisor/graph.ts`
- `manda-app/lib/agent/supervisor/state.ts`
- `manda-app/lib/agent/supervisor/routing.ts`

---

### E13.5: Financial Analyst Specialist Agent

**Story ID:** E13.5
**Points:** 5
**Priority:** P1

**Description:**
Create a specialized agent for financial analysis queries. This agent has deep knowledge of financial metrics, ratios, and M&A-specific calculations.

**Acceptance Criteria:**
- [ ] Create FinancialAnalystAgent with Pydantic AI
- [ ] Implement financial-specific tools: `analyze_financials`, `compare_periods`, `calculate_ratios`
- [ ] Create financial analysis system prompt with M&A context
- [ ] Register as specialist in supervisor routing
- [ ] Test with 15+ financial query scenarios
- [ ] Verify improved accuracy on financial queries vs general agent

**Technical Notes:**
```python
# manda-processing/src/agents/financial_analyst.py
from pydantic_ai import Agent, RunContext

financial_analyst = Agent(
    'anthropic:claude-sonnet-4-20250514',
    system_prompt="""You are an expert M&A financial analyst specializing in:
    - Quality of Earnings analysis
    - Working capital normalization
    - EBITDA adjustments and add-backs
    - Revenue recognition patterns
    - Financial projection validation

    Always cite specific line items and provide supporting calculations.""",
    tools=[analyze_financials, compare_periods, calculate_ratios, get_financial_metrics]
)
```

**Files to create:**
- `manda-processing/src/agents/financial_analyst.py`
- `manda-processing/src/agents/tools/financial_tools.py`

---

### E13.6: Knowledge Graph Specialist Agent

**Story ID:** E13.6
**Points:** 5
**Priority:** P1

**Description:**
Create a specialized agent for knowledge graph queries. This agent excels at entity resolution, relationship traversal, and contradiction detection.

**Acceptance Criteria:**
- [ ] Create KnowledgeGraphAgent with Pydantic AI
- [ ] Implement KG-specific tools: `traverse_relationships`, `find_contradictions`, `resolve_entity`
- [ ] Create KG-focused system prompt
- [ ] Register as specialist in supervisor routing
- [ ] Test with 15+ KG query scenarios
- [ ] Verify improved entity resolution accuracy

**Technical Notes:**
```python
# manda-processing/src/agents/knowledge_graph.py
knowledge_graph_agent = Agent(
    'google-gla:gemini-2.5-pro',
    system_prompt="""You are a knowledge graph specialist for M&A intelligence.

    Your expertise:
    - Entity resolution across documents (companies, people, metrics)
    - Temporal fact tracking (valid_at, invalid_at windows)
    - Contradiction detection and explanation
    - Relationship path analysis (who works where, who acquired whom)

    Always explain the graph traversal path in your responses.""",
    tools=[traverse_relationships, find_contradictions, resolve_entity, search_graphiti]
)
```

**Files to create:**
- `manda-processing/src/agents/knowledge_graph.py`
- `manda-processing/src/agents/tools/kg_tools.py`

---

### E13.7: Performance Benchmarking Suite

**Story ID:** E13.7
**Points:** 5
**Priority:** P2

**Description:**
Create a comprehensive benchmarking suite to measure and validate agent performance improvements.

**Acceptance Criteria:**
- [ ] Create benchmark dataset with 100+ queries across complexity tiers
- [ ] Implement automated benchmark runner
- [ ] Measure: TTFT, total latency, tokens, cost per query
- [ ] Generate comparison reports (before/after optimization)
- [ ] Integrate with LangSmith for trace collection
- [ ] Create CI job for regression detection
- [ ] Document baseline metrics and targets

**Technical Notes:**
```typescript
interface BenchmarkResult {
  query: string;
  complexity: string;
  ttft_ms: number;
  total_latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  model_used: string;
  tools_loaded: string[];
  specialist_used?: string;
}

// Target metrics
const TARGETS = {
  simple: { ttft_ms: 500, cost_usd: 0.0001 },
  medium: { ttft_ms: 3000, cost_usd: 0.001 },
  complex: { ttft_ms: 15000, cost_usd: 0.01 }
};
```

**Files to create:**
- `manda-app/scripts/benchmark/run-benchmarks.ts`
- `manda-app/scripts/benchmark/queries.json`
- `manda-app/scripts/benchmark/report-generator.ts`

---

### E13.8: Redis Caching Layer

**Story ID:** E13.8
**Points:** 5
**Priority:** P1

**Description:**
Migrate three in-memory caches to Redis for cross-instance sharing and cold start resilience. Currently, tool result cache, retrieval cache, and summarization cache are in-memory Maps that reset on process restart and aren't shared across serverless instances.

**Acceptance Criteria:**
- [ ] Set up Upstash Redis client with connection pooling
- [ ] Migrate tool result cache (50 entries, 30min TTL) to Redis
- [ ] Migrate retrieval cache (20 entries, 5min TTL) to Redis
- [ ] Migrate summarization cache (50 entries, 30min TTL) to Redis
- [ ] Add cache namespace prefixes for isolation (`cache:tool:`, `cache:retrieval:`, `cache:summary:`)
- [ ] Implement graceful degradation: fall back to in-memory if Redis unavailable
- [ ] Add cache hit/miss metrics to LangSmith traces
- [ ] Verify cross-instance cache sharing in deployed environment
- [ ] Document Redis connection configuration in `.env.example`

**Technical Notes:**
```typescript
// lib/cache/redis-client.ts
import { Redis } from "@upstash/redis"

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export const cacheNamespaces = {
  toolResult: "cache:tool:",
  retrieval: "cache:retrieval:",
  summary: "cache:summary:",
} as const

// Generic cache wrapper with fallback
export class RedisCache<T> {
  private fallback = new Map<string, { value: T; expires: number }>()

  constructor(
    private namespace: string,
    private ttlSeconds: number
  ) {}

  async get(key: string): Promise<T | null> {
    try {
      return await redis.get<T>(`${this.namespace}${key}`)
    } catch {
      // Fallback to in-memory
      const cached = this.fallback.get(key)
      if (cached && cached.expires > Date.now()) return cached.value
      return null
    }
  }

  async set(key: string, value: T): Promise<void> {
    try {
      await redis.setex(`${this.namespace}${key}`, this.ttlSeconds, value)
    } catch {
      // Fallback to in-memory
      this.fallback.set(key, { value, expires: Date.now() + this.ttlSeconds * 1000 })
    }
  }
}
```

**Why Upstash:**
- Serverless-native (no connection pooling complexity)
- REST API (works in Edge Runtime)
- ~1ms latency from Vercel
- Free tier sufficient for development

**Files to create/modify:**
- `manda-app/lib/cache/redis-client.ts` (NEW)
- `manda-app/lib/cache/index.ts` (NEW)
- `manda-app/lib/agent/tool-isolation.ts` (migrate cache)
- `manda-app/lib/agent/retrieval.ts` (migrate cache)
- `manda-app/lib/agent/summarization.ts` (migrate cache)
- `manda-app/.env.example` (add Redis config)

---

### E13.9: PostgreSQL Checkpointer for LangGraph

**Story ID:** E13.9
**Points:** 5
**Priority:** P1

**Description:**
Replace in-memory `MemorySaver` with PostgreSQL checkpointer for LangGraph workflows. Currently, CIM workflow state is lost on server restart, requiring users to start over on multi-day CIM sessions.

**Acceptance Criteria:**
- [ ] Install `@langchain/langgraph-checkpoint-postgres` package
- [ ] Create `langgraph_checkpoints` table in Supabase
- [ ] Configure PostgresSaver with Supabase connection string
- [ ] Replace MemorySaver in CIM workflow with PostgresSaver
- [ ] Verify CIM state persists across server restarts
- [ ] Add checkpoint cleanup job (delete checkpoints older than 30 days)
- [ ] Test resume from checkpoint after 24+ hours
- [ ] Add checkpoint metrics to LangSmith traces (checkpoint count, size)
- [ ] Document checkpoint table schema and cleanup policy

**Technical Notes:**
```typescript
// lib/agent/checkpointer.ts
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres"

// Use Supabase connection string (Transaction mode for pooling)
const checkpointer = PostgresSaver.fromConnString(
  process.env.DATABASE_URL!, // Transaction mode port 6543
  { schema: "public" }
)

// Initialize tables (run once)
await checkpointer.setup()
```

```sql
-- Checkpoint table (created by PostgresSaver.setup())
-- Schema reference for documentation
CREATE TABLE IF NOT EXISTS langgraph_checkpoints (
  thread_id TEXT NOT NULL,
  checkpoint_ns TEXT NOT NULL DEFAULT '',
  checkpoint_id TEXT NOT NULL,
  parent_checkpoint_id TEXT,
  type TEXT,
  checkpoint JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
);

-- Index for efficient thread lookups
CREATE INDEX idx_checkpoints_thread ON langgraph_checkpoints(thread_id);

-- Cleanup policy: RLS + scheduled deletion
-- Add deal_id to metadata for multi-tenant isolation
```

**Integration with CIM workflow:**
```typescript
// lib/agent/cim/workflow.ts
import { checkpointer } from "@/lib/agent/checkpointer"

// Replace MemorySaver
const app = workflow.compile({ checkpointer })

// Thread ID format: cim-{cimId}
const config = { configurable: { thread_id: `cim-${cimId}` } }
```

**Cleanup job:**
```typescript
// scripts/cleanup-checkpoints.ts
// Run daily via cron or Supabase scheduled function
await supabase.rpc('cleanup_old_checkpoints', { days_old: 30 })
```

**Files to create/modify:**
- `manda-app/lib/agent/checkpointer.ts` (NEW)
- `manda-app/lib/agent/cim/workflow.ts` (replace MemorySaver)
- `manda-app/lib/agent/cim/executor.ts` (use shared checkpointer)
- `supabase/migrations/000XX_langgraph_checkpoints.sql` (NEW)
- `manda-app/scripts/cleanup-checkpoints.ts` (NEW)
- `package.json` (add @langchain/langgraph-checkpoint-postgres)

---

## Success Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Simple Query TTFT | 19.4s | <500ms | LangSmith P95 |
| Simple Query Cost | $0.001 | $0.0001 | Usage tracking |
| Medium Query TTFT | 19.4s | <3s | LangSmith P95 |
| Token Usage (Simple) | 8,577 | <2,000 | LangSmith |
| Financial Query Accuracy | Baseline TBD | +20% | Eval dataset |
| KG Query Accuracy | Baseline TBD | +15% | Eval dataset |
| Cache Hit Rate (Retrieval) | 0% (no sharing) | >40% | Redis metrics |
| Cold Start Cache Recovery | Lost | Instant | Manual test |
| CIM State Durability | Lost on restart | Survives 30 days | Manual test |

---

## Implementation Order

**Phase 1: Infrastructure Foundation**
1. **E13.8** (Redis Caching) — Cross-instance cache sharing, cold start resilience
2. **E13.9** (PostgreSQL Checkpointer) — CIM state durability

**Phase 2: Classification & Routing**
3. **E13.1** (Intent + Complexity) — Foundation for routing
4. **E13.2** (Tool Loading) — Quick win on token reduction
5. **E13.3** (Model Selection) — Quick win on TTFT

**Phase 3: Measurement**
6. **E13.7** (Benchmarking) — Measure improvements

**Phase 4: Specialist Agents**
7. **E13.4** (Supervisor) — Complex query orchestration
8. **E13.5** (Financial Specialist) — Domain expertise
9. **E13.6** (KG Specialist) — Entity/relationship expertise

**Rationale for Order:**
- Infrastructure (Redis/checkpointer) first: enables reliable testing of later stories
- Classification/routing next: biggest TTFT wins with lowest complexity
- Benchmarking before specialists: establish baseline for measuring specialist impact
- Specialists last: most complex, builds on supervisor foundation

---

## References

- [LangGraph Multi-Agent Patterns](https://langchain-ai.github.io/langgraph/concepts/multi_agent/)
- [Pydantic AI Documentation](https://ai.pydantic.dev/)
- [LangSmith Observability](https://docs.smith.langchain.com/)
- [E11 Agent Context Engineering](epic-E11.md)
- [E12 Production Readiness](epic-E12.md)
