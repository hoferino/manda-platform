# CIM Workflow: Current vs Subgraph Architecture Comparison

---
title: CIM Subgraph Architecture Analysis
version: 1.0
status: Reference (Superseded by Decision)
stream: CIM MVP
last-updated: 2026-01-09
superseded-by: cim-builder-architecture-evaluation.md (2026-01-14)
---

> **Note:** This document provides technical analysis of subgraph architecture options.
> The final decision is documented in [cim-builder-architecture-evaluation.md](cim-builder-architecture-evaluation.md).
> **Recommendation:** Keep current flat LangGraph + enhanced prompts + Claude model swap.

## Executive Summary

The current CIM workflow uses a **flat 3-node graph** with LLM-driven routing via tool calls. A **subgraph architecture** would restructure this into hierarchical graphs that map directly to workflow phases, providing better isolation, simpler prompts, and clearer state management.

---

## Current Architecture Analysis

### Graph Structure (3 Nodes)

```
START → agent → shouldContinue() → tools → post_tool → agent (loop)
                      ↓
                     END (no tool calls)
```

**Files:**
- `manda-app/lib/agent/cim-mvp/graph.ts` - Graph definition
- `manda-app/lib/agent/cim-mvp/state.ts` - State schema
- `manda-app/lib/agent/cim-mvp/prompts.ts` - Dynamic prompts
- `manda-app/lib/agent/cim-mvp/tools.ts` - All tools (15+)

### How Stages Work Today

| Aspect | Current Implementation |
|--------|----------------------|
| **Stage Tracking** | `state.workflowProgress.currentStage` (string enum) |
| **Stage Transitions** | LLM calls `advance_workflow(targetStage)` tool |
| **Stage Instructions** | `getWorkflowStageInstructions(stage)` → injected into prompt |
| **Tool Availability** | ALL tools available at ALL stages |
| **State Updates** | Single `postToolNode` (250+ lines) handles everything |

### The 7 Workflow Stages

```
welcome → buyer_persona → hero_concept → investment_thesis → outline → building_sections → complete
```

### Current Pain Points

1. **Monolithic postToolNode** - 250+ lines processing all tool results
2. **All tools always available** - LLM can call any tool at any stage (relies on prompt guidance)
3. **Complex prompt engineering** - Stage-specific instructions embedded in one giant function
4. **No natural phase boundaries** - Graph doesn't know about stages, just loops
5. **Hard to test in isolation** - Can't test "outline creation" separately from "slide building"
6. **State management sprawl** - All state fields live in one flat schema

---

## Proposed Subgraph Architecture

### Hierarchical Structure

```
                         ┌─────────────────────────┐
                         │      CIM Parent Graph   │
                         │                         │
                         │  ┌─────────────────┐   │
                         │  │ phaseRouter     │   │
                         │  └────────┬────────┘   │
                         │           │            │
          ┌──────────────┼───────────┼────────────┼──────────────┐
          │              │           │            │              │
          ▼              ▼           ▼            ▼              ▼
   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
   │  Discovery  │ │   Thesis    │ │   Outline   │ │   Content   │
   │  Subgraph   │ │  Subgraph   │ │  Subgraph   │ │  Subgraph   │
   └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘

   - welcome        - hero_concept  - outline      - building_sections
   - buyer_persona  - thesis        - structure    - slides
                                                   - review
```

### Subgraph 1: Discovery (Welcome + Buyer Persona)

**Responsibility:** Understand who we're building for

**Internal State:**
```typescript
interface DiscoveryState {
  hasGreeted: boolean
  buyerType: string | null
  motivations: string[]
  concerns: string[]
}
```

**Shared State (with parent):**
```typescript
messages: BaseMessage[]  // Conversation history
buyerPersona: BuyerPersona | null  // Output to parent
```

**Tools (scoped):**
- `save_buyer_persona`
- `advance_workflow` (can only go to "hero_concept")

**Exit Condition:** `buyerPersona !== null` → returns to parent with persona

### Subgraph 2: Thesis (Hero Concept + Investment Thesis)

**Responsibility:** Define the narrative foundation

**Internal State:**
```typescript
interface ThesisState {
  heroOptions: string[]  // 3 options presented
  selectedHero: string | null
  draftThesis: { asset: string, timing: string, opportunity: string } | null
  thesisApproved: boolean
}
```

**Shared State (with parent):**
```typescript
messages: BaseMessage[]
buyerPersona: BuyerPersona  // Input from parent (read-only)
heroContext: HeroContext | null  // Output to parent
gatheredContext: GatheredContext  // Accumulates data
```

**Tools (scoped):**
- `knowledge_search`
- `save_context`
- `save_hero_concept`
- `advance_workflow` (can only go to "outline")

**Exit Condition:** `heroContext !== null && thesisApproved` → returns to parent

### Subgraph 3: Outline (Structure Definition)

**Responsibility:** Define CIM sections

**Internal State:**
```typescript
interface OutlineState {
  proposedSections: CIMSection[]
  userFeedback: string[]
  outlineApproved: boolean
}
```

**Shared State:**
```typescript
messages: BaseMessage[]
buyerPersona: BuyerPersona  // Read-only
heroContext: HeroContext  // Read-only
cimOutline: CIMOutline | null  // Output to parent
sectionProgress: Record<string, SectionProgress>  // Initialized here
```

**Tools (scoped):**
- `create_outline`
- `update_outline`
- `advance_workflow` (can only go to "building_sections")

**Exit Condition:** `cimOutline !== null && sectionProgress initialized`

### Subgraph 4: Content (Section Building)

**Responsibility:** Build slides for each section

**This is where the complexity lives - it has its OWN nested subgraph:**

```
                    Content Subgraph
                          │
           ┌──────────────┼──────────────┐
           ▼              ▼              ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │   Section   │ │    Slide    │ │   Review    │
    │   Router    │ │   Builder   │ │  & Balance  │
    └─────────────┘ └─────────────┘ └─────────────┘
```

**Internal State:**
```typescript
interface ContentState {
  currentSectionId: string | null
  currentSlideId: string | null
  pendingContentApproval: boolean
  pendingVisualApproval: boolean
}
```

**Shared State:**
```typescript
cimOutline: CIMOutline  // Read-only structure
sectionProgress: Record<string, SectionProgress>  // Updated here
allSlideUpdates: SlideUpdate[]  // Slides created
```

**Tools (scoped):**
- `start_section`
- `update_slide`
- `knowledge_search`
- `get_section_context`
- `save_context`

**Exit Condition:** All sections have `status: 'complete'`

---

## Side-by-Side Comparison

| Aspect | Current (Flat Graph) | Subgraphs |
|--------|---------------------|-----------|
| **Graph Nodes** | 3 nodes (agent, tools, post_tool) | 10+ nodes across 4-5 subgraphs |
| **Stage Tracking** | String in state (`currentStage`) | Current subgraph = current stage |
| **Tool Scoping** | All 15+ tools always available | 3-5 tools per subgraph |
| **State Management** | Single 400-line state.ts | Separate state per subgraph + shared |
| **Prompt Complexity** | 500+ line getSystemPrompt() | Focused prompt per subgraph |
| **postToolNode** | 250+ lines handling all cases | Small, scoped per subgraph |
| **Error Isolation** | Any error affects whole graph | Errors contained in subgraph |
| **Testing** | Must test entire flow | Unit test each subgraph |
| **Code Organization** | 4 large files | Many small, focused files |

---

## Key Benefits of Subgraphs

### 1. Natural Phase Boundaries
```typescript
// Current: LLM decides when to advance
agent.call(advance_workflow("outline", "persona complete"))

// Subgraph: Graph structure enforces phase
discoverySubgraph.compile()  // Returns to parent when done
// Parent routes to next subgraph based on state
```

### 2. Scoped Tool Availability
```typescript
// Current: All tools bound to single agent
const agent = createReactAgent({ tools: ALL_15_TOOLS })

// Subgraph: Tools scoped to phase
const discoveryAgent = createReactAgent({
  tools: [saveBuyerPersona, saveContext]  // Only relevant tools
})
```

### 3. Simpler Prompts
```typescript
// Current: One giant prompt with all stage instructions
getSystemPrompt(state)  // 500+ lines, checks currentStage

// Subgraph: Focused prompt per phase
getDiscoveryPrompt()  // 50 lines, just buyer persona logic
getThesisPrompt()     // 50 lines, just hero/thesis logic
```

### 4. Clear State Ownership
```typescript
// Current: Flat state with all fields
CIMMVPState = {
  messages, workflowProgress, buyerPersona, heroContext,
  cimOutline, gatheredContext, allSlideUpdates, ...
}

// Subgraph: Hierarchical state
ParentState = { currentPhase, buyerPersona, heroContext, cimOutline }
DiscoveryState = { hasGreeted, buyerType, motivations }  // Private
ThesisState = { heroOptions, selectedHero, draftThesis }  // Private
```

### 5. Better Human-in-the-Loop
```typescript
// Current: Implicit approval via conversation
// Agent just keeps going, hopes user approves

// Subgraph: Explicit interrupt points
thesisSubgraph.addInterrupt("thesis_approval", {
  before: "advance_to_outline",
  message: "Does this investment thesis look correct?"
})
```

---

## What Would Need to Change

### Files to Create
```
lib/agent/cim-mvp/subgraphs/
├── discovery/
│   ├── graph.ts      # Discovery subgraph definition
│   ├── state.ts      # DiscoveryState (private + shared)
│   ├── prompts.ts    # Discovery-specific prompts
│   └── tools.ts      # Just save_buyer_persona, save_context
├── thesis/
│   ├── graph.ts
│   ├── state.ts
│   ├── prompts.ts
│   └── tools.ts
├── outline/
│   └── ...
├── content/
│   └── ...
└── parent-graph.ts   # Orchestrates subgraphs
```

### Files to Modify
- `graph.ts` → Becomes orchestrator that routes to subgraphs
- `state.ts` → Split into parent state + subgraph states
- `prompts.ts` → Split into focused prompts per subgraph
- `tools.ts` → Split into tool groups per subgraph

---

## Recommendation

**For MVP:** Stay with current flat graph approach - it works and is simpler.

**For V2 (post-MVP):** Refactor to subgraphs when:
1. You need explicit approval checkpoints (human-in-the-loop)
2. Testing becomes painful (can't isolate phases)
3. Prompts become unwieldy (>1000 lines)
4. You want to add parallel section building

The subgraph architecture is **more robust** but requires **more upfront design**. The current approach is **good enough for MVP** where the workflow is linear and relatively simple.

---

---

## Critical Concern #1: Backward Navigation (Going Back in Phases)

### The Problem

During slide creation, user wants to adjust the thesis or buyer persona. This affects EVERYTHING downstream because:
- Buyer persona → drives hero concept options
- Hero concept → drives investment thesis
- Investment thesis → drives outline emphasis
- Outline → drives slide content
- **Change at any point cascades through the rest**

### Current Architecture: No Native Backward Navigation

The flat graph tracks `currentStage` as a string. Going "back" means:
1. User says "let's change the buyer persona"
2. LLM calls `advance_workflow("buyer_persona")`
3. But what happens to the slides already created? The thesis? The outline?

**Problem:** No mechanism to invalidate or re-evaluate downstream artifacts.

### Subgraph Solution: Command.PARENT + State Propagation

With subgraphs, backward navigation is supported via `Command.PARENT`:

```typescript
// Inside Content Subgraph, user wants to change buyer persona
const slideBuilderNode = (state) => {
  if (userWantsToChangeBuyerPersona) {
    return new Command({
      goto: "discovery",  // Go back to Discovery subgraph
      graph: Command.PARENT,  // Navigate UP to parent first
      update: {
        // Flag that downstream artifacts need re-evaluation
        invalidatedBy: "buyer_persona_change",
        preserveOutline: true,  // Keep structure, just update content
      }
    })
  }
}
```

**Key Configuration:** Parent graph must declare valid `ends` for each subgraph:

```typescript
parentGraph.addNode("content", contentSubgraph, {
  ends: ["discovery", "thesis", "outline", "complete"]  // Valid exit points
})
```

### Cascade Invalidation Strategy

When user changes a foundational element, we need to decide:

| Changed Element | What Gets Invalidated | What Gets Preserved |
|-----------------|----------------------|---------------------|
| **Buyer Persona** | Hero options, thesis emphasis, slide messaging | Outline structure (maybe), raw data |
| **Hero Concept** | Investment thesis framing, slide "hero moments" | Buyer persona, outline structure |
| **Investment Thesis** | Slide emphasis/hierarchy, key takeaways | Outline structure, raw slide content |
| **Outline** | Section-to-slide mapping | Individual slide content (re-mapped) |

### Implementation Pattern: "Re-evaluate" vs "Rebuild"

```typescript
interface WorkflowState {
  // Track what's been invalidated
  invalidationChain: {
    source: 'buyer_persona' | 'hero_concept' | 'thesis' | 'outline'
    timestamp: string
    affectedArtifacts: string[]
  } | null

  // Each artifact tracks its "basis"
  heroContext: HeroContext & { basedOn: { buyerPersona: string } }
  investmentThesis: Thesis & { basedOn: { hero: string } }
  slides: Slide[] // Each slide tracks { basedOn: { section, thesis, hero } }
}

// When re-entering a subgraph after backward navigation:
const thesisSubgraph = {
  entryNode: (state) => {
    if (state.invalidationChain?.source === 'buyer_persona') {
      // Don't start fresh - show user what changed
      return {
        prompt: `The buyer persona changed. Your current thesis is:
                 "${state.investmentThesis}"

                 Given the new buyer focus on ${state.buyerPersona.type},
                 should we adjust the thesis? Here's what I'd recommend...`
      }
    }
  }
}
```

---

## Critical Concern #2: Dynamic Knowledge Updates

### The Problem

In production, knowledge lives in Neo4j/Graphiti. During a CIM workflow:
1. User uploads new document → gets indexed to Graphiti
2. Another team member adds findings to the deal
3. User corrects a fact mid-conversation → should persist AND reflect immediately

**How does updated knowledge reach the CIM agent?**

### Current Architecture: Two Different Patterns

| System | Pattern | Update Propagation |
|--------|---------|-------------------|
| **CIM MVP** | JSON file → in-memory cache | Manual cache clear required |
| **V2 Agent** | Graphiti API → Redis cache (5min TTL) | Automatic within 5 minutes |

**CIM MVP has no mechanism for dynamic updates.**

### Knowledge Update Scenarios

#### Scenario 1: New Document Indexed Mid-Workflow

```
t=0:  User starts CIM, knowledge.json has 50 findings
t=5:  New doc uploaded, processing adds 20 more findings to Graphiti
t=10: User asks about revenue breakdown (answer needs new findings)
```

**Current CIM MVP:** Won't see the new 20 findings (cached JSON)
**V2 Agent:** Will see them within 5 minutes (TTL expiry)
**Ideal:** See them immediately

#### Scenario 2: User Correction Mid-Conversation

```
User: "Actually, our revenue is $12M, not $8M like the document says"
```

**Current CIM MVP:** Agent acknowledges, stores in `gatheredContext`, but:
- Not persisted to Neo4j
- Lost if conversation restarts
- Other agents don't see it

**V2 Agent:** Calls `indexToKnowledgeBaseTool`:
- Persists to Graphiti with `source_type: 'correction'`
- Graphiti marks old fact as `invalid_at: now()`
- New fact has `valid_at: now()`
- All queries get correct value

### Solution: Always-On Knowledge Access (No Proactive Notifications)

**Key Principle:** Agent should have full access to the knowledge infrastructure at all times. No proactive notifications, no relevance flagging - just ensure the tools work and always return the latest data.

#### Knowledge Access Tools

The CIM agent should have tools that query the knowledge infrastructure on-demand:

```typescript
// 1. Vector Search - semantic similarity
const vectorSearchTool = tool({
  name: "search_knowledge_semantic",
  description: "Search deal knowledge using semantic similarity (vector search)",
  schema: z.object({
    query: z.string(),
    numResults: z.number().default(10)
  }),
  func: async ({ query, numResults }, { dealId }) => {
    return await graphiti.vectorSearch({
      query,
      dealId,
      numResults
    })
  }
})

// 2. Graph Traversal - relationship-based queries
const graphTraversalTool = tool({
  name: "explore_knowledge_graph",
  description: "Traverse knowledge graph relationships (e.g., find related entities, follow connections)",
  schema: z.object({
    startEntity: z.string(),
    relationship: z.enum(['related_to', 'part_of', 'contradicts', 'supports', 'temporal']),
    depth: z.number().default(2)
  }),
  func: async ({ startEntity, relationship, depth }, { dealId }) => {
    return await graphiti.graphTraversal({
      startEntity,
      relationship,
      depth,
      dealId
    })
  }
})

// 3. Hybrid Search - vector + BM25 + graph
const hybridSearchTool = tool({
  name: "search_knowledge",
  description: "Search deal knowledge using hybrid approach (combines semantic, keyword, and graph)",
  schema: z.object({
    query: z.string(),
    numResults: z.number().default(10)
  }),
  func: async ({ query, numResults }, { dealId }) => {
    return await graphiti.hybridSearch({
      query,
      dealId,
      numResults
    })
  }
})

// 4. Agentic RAG - multi-step retrieval with reasoning
const agenticRAGTool = tool({
  name: "deep_research",
  description: "Multi-step research: formulates sub-queries, retrieves, synthesizes (use for complex questions)",
  schema: z.object({
    question: z.string(),
    maxSteps: z.number().default(3)
  }),
  func: async ({ question, maxSteps }, { dealId }) => {
    // 1. Decompose question into sub-queries
    // 2. Execute each sub-query against knowledge base
    // 3. Synthesize findings
    // 4. Return comprehensive answer with sources
    return await graphiti.agenticRAG({
      question,
      dealId,
      maxSteps
    })
  }
})
```

#### No Caching, Always Fresh

```typescript
// All knowledge queries go directly to Graphiti/Neo4j
// No TTL caching that could return stale results

const knowledgeConfig = {
  cacheEnabled: false,  // Always query live
  timeout: 10000,       // 10s timeout for queries
  fallbackToEmpty: true // Return empty rather than error
}
```

#### Knowledge Flow (Simplified)

```
┌─────────────────────────────────────────────────────────────────┐
│  Knowledge Base (Neo4j + Graphiti)                              │
│  - Entities, facts, relationships                               │
│  - Voyage embeddings (1024-dim)                                 │
│  - Temporal metadata (valid_at, invalid_at)                     │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ Agent queries on-demand
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  CIM Agent Tools                                                │
│  - search_knowledge (hybrid)                                    │
│  - search_knowledge_semantic (vector)                           │
│  - explore_knowledge_graph (traversal)                          │
│  - deep_research (agentic RAG)                                  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ Always returns latest data
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  Agent Response                                                 │
│  - Uses fresh knowledge in slide content                        │
│  - Cites sources from knowledge base                           │
│  - No stale data, no notifications                              │
└─────────────────────────────────────────────────────────────────┘
```

**This ensures:**
- Agent always has access to latest knowledge
- No complexity from relevance flagging
- No user bombardment with notifications
- Multiple retrieval strategies (vector, graph, hybrid, agentic)
- Fresh queries every time, no stale cache

---

## Architecture Recommendation

### Scope Decision: Future Planning Only

This analysis is for **future architecture planning (V2)**. The current MVP will:
- Keep the flat 3-node graph structure
- NOT implement backward navigation or cascade invalidation
- Use a **hybrid knowledge approach** (JSON for dev, Graphiti flag for production)

### For MVP (Now): Hybrid Knowledge Approach

Add a production mode flag that switches knowledge source:

```typescript
// In knowledge-loader.ts or new knowledge-service.ts
const KNOWLEDGE_MODE = process.env.KNOWLEDGE_MODE || 'json'  // 'json' | 'graphiti'

export async function getKnowledge(query: string, dealId: string) {
  if (KNOWLEDGE_MODE === 'graphiti') {
    // Use V2 agent's Graphiti retrieval
    return await callGraphitiSearch({ query, dealId })
  }
  // Default: JSON file (current MVP behavior)
  return searchKnowledge(query)
}
```

**Benefits:**
- Dev/testing uses fast JSON files
- Production uses Graphiti + Neo4j
- Same tool interface, different backend
- Easy A/B testing of knowledge sources

### For V2 (Post-MVP): Full Subgraph Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CIM Parent Graph                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ phaseRouter (decides which subgraph based on state) │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│    ┌──────────┬───────────┼───────────┬──────────┐         │
│    ▼          ▼           ▼           ▼          ▼         │
│ Discovery  Thesis     Outline     Content    Review        │
│ Subgraph   Subgraph   Subgraph    Subgraph   Subgraph     │
│                                                             │
│  Each subgraph:                                            │
│  - Gets fresh knowledge on entry (via input transform)     │
│  - Can navigate to ANY other subgraph (via Command.PARENT) │
│  - Declares what it invalidates when changed               │
│  - Tracks "basedOn" for cascade detection                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Verification

To validate this analysis:
1. Review `graph.ts` lines 61-106 (agentNode) and 125-378 (postToolNode)
2. Review `prompts.ts` lines 29-173 (stage instructions) and 389-533 (getSystemPrompt)
3. Review `state.ts` lines 140-146 (WorkflowProgress) and 278-395 (CIMMVPState)
4. Review `knowledge-loader.ts` for current caching pattern
5. Review `lib/agent/retrieval.ts` for V2 agent's Graphiti integration pattern

## Sources

- [LangGraph Command.PARENT Navigation](https://github.com/langchain-ai/langgraph/issues/3570)
- [LangGraph Subgraph State Management](https://langchain-ai.github.io/langgraphjs/how-tos/subgraph/)
- [LangGraph JS Agents from Scratch](https://github.com/langchain-ai/agents-from-scratch-ts)
