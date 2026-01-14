# CIM Builder Architecture Evaluation

**Date:** 2026-01-14
**Author:** Max + Claude (Party Mode Analysis)
**Status:** Recommendation Ready - Pending Validation

---

## Problem Statement

The current LangGraph-based CIM MVP agent feels mechanical and over-engineered compared to a natural Claude conversation. The v3 prototype (`.claude/commands/manda-cim-company-overview-v3.md`) demonstrates the desired conversational flow.

**Requirements:**

| Requirement | Priority | Notes |
|-------------|----------|-------|
| Natural conversation | HIGH | Like Claude Code/ChatGPT, not robotic |
| Zero workflow drift | CRITICAL | Must follow stages: welcome → buyer_persona → hero_concept → thesis → outline → building_sections → complete |
| Real-time slide preview | HIGH | Structured JSON format, renders immediately, updates on feedback |
| Jump back/forth | HIGH | User can revisit any previous stage |

---

## Framework Comparison (2025-2026)

### Option A: Claude Agent SDK

**Architecture:**
- Same engine that powers Claude Code
- Agentic loop: gather context → take action → verify → repeat
- Built-in tools: Read, Write, Edit, Bash, Glob, Grep, WebSearch, AskUserQuestion
- Sessions with resume/fork capability
- Subagents for parallel work with isolated context
- MCP integration for external systems

**Strengths:**
- ✅ Natural conversation by design (it IS Claude)
- ✅ Session persistence built-in
- ✅ Context compaction (auto-summarizes when context fills)
- ✅ Hooks for PreToolUse, PostToolUse, Stop events
- ✅ Permission controls

**Weaknesses:**
- ❌ No native workflow stage enforcement - purely agentic
- ❌ Designed for file/code operations, not structured workflows
- ❌ No built-in state machine or graph structure
- ❌ UI integration unclear - designed for CLI, not web apps

**Verdict for CIM Builder:** Would need significant custom scaffolding to enforce workflow stages. The SDK assumes agent autonomy, not structured step-by-step workflows.

---

### Option B: LangGraph (Current)

**Architecture:**
- StateGraph with typed state annotations
- Nodes (functions) + Edges (transitions) + Checkpointer (persistence)
- Conditional routing based on state
- PostgresSaver for durable checkpoints

**Strengths:**
- ✅ Explicit workflow control via graph structure
- ✅ Conditional edges enforce stage transitions
- ✅ State is typed and inspectable
- ✅ Already integrated with Next.js via SSE
- ✅ Already handles slide updates via callbacks

**Weaknesses:**
- ❌ Conversation feels mechanical (the current problem)
- ❌ Steep learning curve
- ❌ Stage prompts are the issue, not the architecture

**Verdict for CIM Builder:** The architecture is sound. The problem is **prompt quality**, not framework choice.

---

### Option C: OpenAI Agents SDK

**Architecture:**
- Lightweight Python framework for multi-agent handoffs
- Four primitives: agents, handoffs, guardrails, tracing
- Provider-agnostic (100+ LLMs)

**Strengths:**
- ✅ Excellent for multi-agent coordination
- ✅ Built-in tracing
- ✅ Very easy to start

**Weaknesses:**
- ❌ Still free-form agentic - no workflow enforcement
- ❌ Newer, smaller community
- ❌ Would require migration from existing system

**Verdict for CIM Builder:** Doesn't solve the workflow enforcement requirement.

---

### Option D: Keep LangGraph, Switch to Claude via @langchain/anthropic

**Architecture:**
- Simple model swap: replace `ChatOpenAI` with `ChatAnthropic`
- Keep all other infrastructure

**Strengths:**
- ✅ Claude is naturally more conversational than GPT-4o
- ✅ All infrastructure preserved (checkpointing, streaming, tools)
- ✅ Minimal code change (~10 lines)
- ✅ Easy to test/rollback

**Weaknesses:**
- ⚠️ LangChain abstraction may limit some Claude-specific features
- ⚠️ May still need prompt tuning

**Verdict for CIM Builder:** Best balance of natural conversation + workflow enforcement.

---

## Key Insight

**The problem is not the framework.**

Looking at the v3 prototype prompt, it achieves natural conversation through:
1. **Detailed stage instructions** with clear goals and exit criteria
2. **Always explain why** - connect every choice to buyer context
3. **Present options with consistent detail** - not vague suggestions
4. **Wait for approval** before proceeding
5. **Carry context forward** - reference previous decisions

The current CIM MVP prompts in `lib/agent/cim-mvp/prompts.ts` are:
- Too terse
- Missing buyer context integration
- Not presenting data-backed options
- Not explaining "why this matters for you"

---

## Recommendation: Option D + A Combined

**Switch to Claude (via LangChain) + Enhanced Prompts**

### Why This Architecture

| Option | Natural Conv | Zero Drift | Preview | Jump | Effort | Risk |
|--------|--------------|------------|---------|------|--------|------|
| A: Prompts only | ⚠️ 2/5 | ✅ 5/5 | ✅ 5/5 | ✅ 4/5 | Low | Medium |
| B: Claude SDK pure | ✅ 5/5 | ❌ 2/5 | ⚠️ 3/5 | ❌ 2/5 | Very High | High |
| C: Hybrid | ✅ 5/5 | ✅ 5/5 | ⚠️ 4/5 | ✅ 5/5 | Medium-High | Medium |
| **D+A: Claude + Prompts** | ✅ 4/5 | ✅ 5/5 | ✅ 5/5 | ✅ 5/5 | **Low** | **Low** |

### Key Insight

**The problem is NOT the framework—it's the model + prompts.**

- GPT-4o has a "helpful assistant" default that feels robotic
- Claude is naturally more conversational
- LangGraph's workflow enforcement is exactly what we need for zero drift
- Switching the model via `@langchain/anthropic` preserves ALL existing infrastructure

### What We Keep
- ✅ LangGraph StateGraph (workflow enforcement)
- ✅ PostgresSaver (session persistence)
- ✅ SSE streaming (real-time updates)
- ✅ Tool calling (slide updates, context saving)
- ✅ Existing UI integration

### What We Change
1. **Model**: GPT-4o → Claude Sonnet 4.5 (via `@langchain/anthropic`)
2. **Prompts**: Rewrite using v3 prototype as reference
3. **Navigation**: Add `navigate_to_stage` tool for jumping

---

## Implementation Plan

### Phase 1: Model Swap (1-2 hours)

**File:** `manda-app/lib/agent/cim-mvp/graph.ts`

```typescript
// Before
import { ChatOpenAI } from '@langchain/openai'
const baseModel = new ChatOpenAI({
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
})

// After
import { ChatAnthropic } from '@langchain/anthropic'
const baseModel = new ChatAnthropic({
  model: 'claude-sonnet-4-5-20250514',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  temperature: 0.7,
  maxTokens: 4096,
})
```

**Validation:**
- Test SSE streaming still works
- Test all 7 stages progress correctly
- Test tool calling (save_buyer_persona, create_outline, update_slide)

### Phase 2: Prompt Enhancement (4-8 hours)

**File:** `manda-app/lib/agent/cim-mvp/prompts.ts`

Rewrite `getWorkflowStageInstructions()` for each stage using v3 patterns:

| Current Pattern | v3 Pattern |
|-----------------|------------|
| "Call save_buyer_persona when done" | "Wait for user to confirm, then use save_buyer_persona" |
| List what to ask | Explain WHY each question matters for their buyer type |
| Generic options | 3 specific options with data citations from knowledge |
| Move to next stage | Reflect on choice before advancing |

**Key Principles from v3:**
1. **One thing at a time** - Don't bulk generate
2. **Always explain why** - Connect to buyer context
3. **Present options with consistent detail** - All options get equal depth
4. **Content first, then visuals** - Get approval before designing
5. **Carry context forward** - Reference previous decisions

### Phase 3: Stage Navigation (2-4 hours)

**File:** `manda-app/lib/agent/cim-mvp/tools.ts`

Add `navigate_to_stage` tool:

```typescript
const navigateToStageTool = tool(
  async ({ targetStage, reason }) => {
    // Validate: can only go back to completed stages
    // Update workflowProgress.currentStage
    return { navigatedTo: targetStage, reason }
  },
  {
    name: 'navigate_to_stage',
    description: 'Jump to a previous workflow stage to revise decisions',
    schema: z.object({
      targetStage: z.enum(['buyer_persona', 'hero_concept', 'investment_thesis', 'outline', 'building_sections']),
      reason: z.string().describe('Why revisiting this stage'),
    }),
  }
)
```

### Phase 4: Dynamic Welcome (1-2 hours)

**File:** `manda-app/components/cim-builder/ConversationPanel/CIMMessageList.tsx`

Replace hardcoded welcome with API call that checks knowledge status:

```typescript
// On component mount, call agent with [SYSTEM] Initialize message
// Agent responds with dynamic welcome based on knowledge.json availability
```

---

## Files to Modify

| File | Change | Priority |
|------|--------|----------|
| `lib/agent/cim-mvp/graph.ts` | Swap ChatOpenAI → ChatAnthropic | P0 |
| `lib/agent/cim-mvp/prompts.ts` | Rewrite all stage instructions | P0 |
| `lib/agent/cim-mvp/tools.ts` | Add navigate_to_stage tool | P1 |
| `components/cim-builder/ConversationPanel/CIMMessageList.tsx` | Dynamic welcome | P2 |

---

## Verification Plan

1. **Model Swap Test:**
   - Start new CIM conversation
   - Verify streaming works
   - Verify workflow advances through all 7 stages
   - Check LangGraph Studio traces

2. **Conversation Quality Test:**
   - Compare response tone to v3 prototype
   - Verify knowledge is used in hero_concept options
   - Verify buyer context carries through stages

3. **Navigation Test:**
   - Complete outline stage
   - Say "let's go back to hero concept"
   - Verify state updates correctly
   - Verify conversation resumes appropriately

4. **Slide Preview Test:**
   - Reach building_sections stage
   - Create a slide
   - Verify preview renders immediately
   - Request changes, verify preview updates

---

## Testing Log Reference

See `_bmad-output/testing/cim-mvp-testing-log.md` for detailed testing session results.

---

## Cross-Reference: Subgraph Architecture Document

The existing [cim-subgraph-architecture.md](cim-subgraph-architecture.md) provides complementary analysis that **aligns with this recommendation**.

### Alignment Points

| Topic | This Document | Subgraph Doc | Reconciled View |
|-------|---------------|--------------|-----------------|
| **MVP Architecture** | Keep flat LangGraph | "For MVP: Stay with current flat graph" | ✅ Aligned |
| **Root Cause** | Model + prompts, not framework | "The architecture is sound" | ✅ Aligned |
| **V2 Path** | Future consideration | Detailed subgraph design | ✅ Complementary |

### Key Additions from Subgraph Document

**1. Backward Navigation Strategy (Critical Concern #1)**

The subgraph document provides the `Command.PARENT` pattern for V2:
```typescript
return new Command({
  goto: "discovery",
  graph: Command.PARENT,
  update: { invalidatedBy: "buyer_persona_change" }
})
```

**For MVP (this plan):** The `navigate_to_stage` tool handles backward navigation within the flat graph. Cascade invalidation is simplified - agent acknowledges change and guides user through re-evaluation.

**2. Cascade Invalidation Table**

| Changed Element | What Gets Invalidated | What Gets Preserved |
|-----------------|----------------------|---------------------|
| **Buyer Persona** | Hero options, thesis emphasis, slide messaging | Outline structure, raw data |
| **Hero Concept** | Thesis framing, slide "hero moments" | Buyer persona, outline |
| **Investment Thesis** | Slide emphasis, key takeaways | Outline structure |
| **Section Scope** (e.g., "make it leaner") | Section outline (slide count), pending slides in section | Completed slides (may need re-review), other sections |
| **Slide Content** | Other slides in same section (storyline coherence) | Slides in other sections, outline structure |

**Storyline Coherence Rule:** When any slide content changes, the agent must review how it affects:
1. The slide's role in the section narrative (intro → build → climax → bridge)
2. Adjacent slides' transitions and flow
3. Section-level key takeaways

**3. Knowledge Strategy (Critical Concern #2)**

The subgraph document recommends a **hybrid approach** for MVP:
```typescript
const KNOWLEDGE_MODE = process.env.KNOWLEDGE_MODE || 'json'  // 'json' | 'graphiti'
```

This aligns with our current JSON knowledge loader with future Graphiti path.

### Unified Roadmap

| Phase | Focus | Architecture |
|-------|-------|--------------|
| **MVP (Now)** | Claude + Enhanced Prompts | Flat 3-node graph, JSON knowledge |
| **V1.1** | Backward navigation | Add `navigate_to_stage` tool |
| **V2** | Phase isolation | Subgraphs with Command.PARENT |
| **V2+** | Live knowledge | Graphiti integration |

---

## Context Engineering & Token Optimization (2026 Best Practices)

Based on testing (see [cim-mvp-testing-log.md](../testing/cim-mvp-testing-log.md)), we observed:
- **57k input tokens** per request
- **0% cache hit rate**
- **$0.05-0.06 per request** with Claude Haiku 4.5

This section outlines strategies to optimize token usage based on latest 2026 documentation from Anthropic and LangChain.

---

### The Four Context Engineering Strategies (LangChain 2026)

LangChain identifies four core strategies for managing agent context:

| Strategy | Description | CIM MVP Application |
|----------|-------------|---------------------|
| **Write** | Save context outside the window | Store outline, buyer persona, hero concept in state fields |
| **Select** | Pull relevant context when needed | Use `knowledge_search` tool instead of embedding full knowledge |
| **Compress** | Retain only essential tokens | Summarize conversation history after N turns |
| **Isolate** | Split context across components | Use subagents for section-specific slide generation (V2) |

**Current State:**
- ✅ **Write**: Using LangGraph state to persist workflow data
- ⚠️ **Select**: Knowledge summary (10+ findings) always injected - could be more selective
- ❌ **Compress**: No conversation summarization implemented
- ⚠️ **Isolate**: Single flat graph - planned for V2 subgraphs

---

### Anthropic Prompt Caching (Critical for Cost Reduction)

**Why 0% Cache Hit Rate is a Problem:**

Claude Haiku 4.5 pricing:
| Token Type | Price |
|------------|-------|
| Base input | $1.00/MTok |
| Cache write (5m TTL) | $1.25/MTok (+25%) |
| **Cache read** | **$0.10/MTok** (90% savings!) |
| Output | $5.00/MTok |

With 57k input tokens and proper caching:
- **Without cache**: ~$0.057/request
- **With 80% cache hit**: ~$0.015/request (73% savings)

**Minimum Token Requirements:**

| Model | Min Cacheable Tokens |
|-------|---------------------|
| Claude Haiku 4.5 | **4,096 tokens** |
| Claude Sonnet 4.5 | 1,024 tokens |
| Claude Opus 4.5 | 4,096 tokens |

Our system prompt + tools + knowledge summary easily exceeds 4,096 tokens, so caching is viable.

**Implementation Pattern:**

```typescript
// In graph.ts - Structure messages for optimal caching
const systemMessage = {
  type: 'text',
  text: systemPrompt,
  cache_control: { type: 'ephemeral' }  // 5-minute TTL
}

// Cache hierarchy: tools → system → messages
// Place stable content FIRST, dynamic content LAST
```

**Cache Placement Strategy:**

```
┌─────────────────────────────────────────────────┐
│ TOOLS (rarely change)              cache_control│ ← Breakpoint 1
├─────────────────────────────────────────────────┤
│ SYSTEM: Base instructions          cache_control│ ← Breakpoint 2
├─────────────────────────────────────────────────┤
│ SYSTEM: Knowledge summary          cache_control│ ← Breakpoint 3 (updates per session)
├─────────────────────────────────────────────────┤
│ MESSAGES: Conversation history     cache_control│ ← Breakpoint 4 (grows each turn)
├─────────────────────────────────────────────────┤
│ MESSAGES: Latest user message      (no cache)   │ ← Always fresh
└─────────────────────────────────────────────────┘
```

**LangChain Implementation via Middleware:**

```typescript
import { anthropicPromptCachingMiddleware } from 'langchain'

// Add to graph setup
const model = new ChatAnthropic({
  model: 'claude-haiku-4-5-20251001',
  // ... other config
}).pipe(anthropicPromptCachingMiddleware({
  minMessagesToCache: 2,  // Cache after 2 messages
  ttl: '5m'               // or '1h' for longer sessions
}))
```

---

### Conversation Summarization Strategy

For long conversations, implement periodic summarization:

```typescript
// Compress strategy: Summarize after N turns
const MAX_MESSAGES_BEFORE_SUMMARY = 10

function shouldSummarize(messages: Message[]): boolean {
  return messages.length > MAX_MESSAGES_BEFORE_SUMMARY
}

// Add summarization node to graph
async function summarizeNode(state: CIMState): Promise<Partial<CIMState>> {
  if (!shouldSummarize(state.messages)) return {}

  const summary = await summarizeConversation(state.messages)
  return {
    messages: [
      { role: 'system', content: `Previous context: ${summary}` },
      ...state.messages.slice(-4)  // Keep last 4 messages
    ]
  }
}
```

**Token Savings Estimate:**
- 10 messages × 500 tokens avg = 5,000 tokens
- Summary = 500 tokens + last 4 messages (2,000 tokens) = 2,500 tokens
- **50% reduction** in conversation history

---

### Knowledge Context Optimization

**Current Problem:** `getDataSummary()` returns ~1,500 tokens of key findings every request, even when not needed.

**Recommended Changes:**

1. **Lazy Loading**: Only inject knowledge summary for stages that need it:
   ```typescript
   const KNOWLEDGE_REQUIRED_STAGES = ['hero_concept', 'outline', 'building_sections']

   function getSystemPrompt(stage: WorkflowStage): string {
     const base = getBasePrompt()
     if (KNOWLEDGE_REQUIRED_STAGES.includes(stage)) {
       return base + '\n\n' + getDataSummary()
     }
     return base
   }
   ```

2. **Section-Specific Knowledge**: When building sections, only inject relevant findings:
   ```typescript
   // Instead of full summary
   const sectionContext = getFindingsForSection(currentSection)
   ```

3. **Token Budget Per Stage:**
   | Stage | Knowledge Tokens | Notes |
   |-------|-----------------|-------|
   | welcome | 0 | No knowledge needed |
   | buyer_persona | 500 | Basic company info only |
   | hero_concept | 1,500 | Full summary for options |
   | investment_thesis | 800 | Key metrics only |
   | outline | 1,000 | Section summaries |
   | building_sections | 500-2,000 | Per-section context |

---

### Extended Thinking Considerations

**When to Use Extended Thinking:**

| Stage | Thinking Budget | Rationale |
|-------|----------------|-----------|
| hero_concept | 2,048 tokens | Complex option generation |
| investment_thesis | 1,024 tokens | Strategic framing |
| slide design | 2,048 tokens | Layout decisions |
| Other stages | None | Simple conversational |

**Important:** Extended thinking tokens are billed as output tokens ($5/MTok for Haiku). Use judiciously.

**Interleaved Thinking for Tool Use:**

Claude 4 models support thinking between tool calls:
```typescript
// Agent can reason after knowledge_search before calling create_outline
// This improves decision quality without manual chain-of-thought prompts
```

---

### Implementation Priority

| Optimization | Effort | Token Savings | Priority |
|--------------|--------|---------------|----------|
| Prompt caching via middleware | Low | 70-90% on cache hits | **P0** |
| Lazy knowledge injection | Medium | 20-30% | **P1** |
| Conversation summarization | Medium | 30-50% (long sessions) | P2 |
| Section-specific knowledge | Medium | 10-20% | P2 |
| Extended thinking tuning | Low | Cost control | P3 |

**Target Metrics After Optimization:**
| Metric | Current | Target |
|--------|---------|--------|
| Input tokens/request | 57k | 30-40k |
| Cache hit rate | 0% | >70% |
| Cost/request | $0.05-0.06 | $0.01-0.02 |
| TTFT | 2-3s | <1.5s |

---

### LangSmith Monitoring

Track these metrics in LangSmith to validate optimizations:

```typescript
// Add cache metrics to traces
trace.metadata = {
  cache_read_tokens: response.usage.cache_read_input_tokens,
  cache_write_tokens: response.usage.cache_creation_input_tokens,
  cache_hit_rate: cacheReadTokens / (cacheReadTokens + cacheWriteTokens + inputTokens)
}
```

**Dashboard Alerts:**
- Cache hit rate < 50% → Review prompt stability
- Input tokens > 50k → Trigger summarization
- TTFT > 3s → Consider model downgrade or context reduction

---

## Sources

- [Claude Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Building agents with Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [AI Framework Comparison 2025](https://enhancial.substack.com/p/choosing-the-right-ai-framework-a)
- [Comparing AI Agent Frameworks](https://langfuse.com/blog/2025-03-19-ai-agent-comparison)
- [CIM Subgraph Architecture](cim-subgraph-architecture.md) - Internal analysis
- [Anthropic Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) - Official documentation
- [LangChain Context Engineering](https://www.blog.langchain.com/context-engineering-for-agents/) - Four strategies framework
- [LangChain Context Engineering GitHub](https://github.com/langchain-ai/context_engineering) - Implementation examples
- [Anthropic Prompt Caching with LangChain](https://reference.langchain.com/javascript/functions/langchain.index.anthropicPromptCachingMiddleware.html) - Middleware reference
- [Extended Thinking Tips](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/extended-thinking-tips) - Best practices
