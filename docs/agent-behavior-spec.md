# Agent Behavior Specification

---
title: Agent Behavior Specification
version: 2.0
status: Complete
stream: Agent System v2.0
last-updated: 2026-01-15
supersedes: v1.0 (2025-11-30)
---

## Purpose

This document is the **single source of truth** for how the Manda conversational agent behaves. It covers the current v2 chat agent and CIM MVP implementations, response formatting, intent detection, and conversation modes.

> **Implementation Status (2026-01-15):**
> - **Chat Agent (v2)**: Production - General conversation with Graphiti retrieval
> - **CIM Builder (cim-mvp)**: Production MVP - Standalone CIM workflow
> - **CIM v2 Integration**: Pending (Story 6.1)

---

## Table of Contents

1. [Current Architecture](#current-architecture)
2. [Chat Agent (v2) Behavior](#chat-agent-v2-behavior)
3. [CIM MVP Agent Behavior](#cim-mvp-agent-behavior)
4. [Response Formatting Rules](#response-formatting-rules)
5. [Source Attribution](#source-attribution)
6. [Uncertainty Handling](#uncertainty-handling)
7. [Testing Strategy](#testing-strategy)

---

## Current Architecture

### Implementation Overview

| Feature | Directory | API Endpoint | Status |
|---------|-----------|--------------|--------|
| Chat | `lib/agent/v2/` | `/api/projects/[id]/chat` | Production |
| CIM Builder | `lib/agent/cim-mvp/` | `/api/projects/[id]/cims/[cimId]/chat-mvp` | MVP (Active) |

### Technology Stack

- **LangGraph**: StateGraph-based agent orchestration
- **Graphiti + Neo4j**: Knowledge graph with hybrid search (vector + BM25 + graph)
- **Voyage voyage-3.5**: 1024-dimension embeddings
- **Voyage rerank-2.5**: Result reranking for improved accuracy
- **PostgresSaver**: Conversation checkpointing and persistence (v2 chat)
- **Convex** (proposed): CIM workflow state and checkpointing - see [ADR-002](architecture-decisions/adr-002-convex-cim-state.md)
- **Vertex AI (Claude Sonnet 4)**: Primary LLM for agent responses

### Knowledge Architecture (Post-E10)

```
User Query
    ↓
Graphiti Hybrid Search (vector + BM25 + graph)
    ↓
Voyage Rerank (top results)
    ↓
Agent Response with Citations
```

**Key Change from v1.0:** pgvector was removed in E10. All embeddings and semantic search now use Graphiti + Neo4j.

---

## Chat Agent (v2) Behavior

### Graph Structure

```
┌─────────────────────────────────────────────────────────┐
│                    v2 StateGraph                         │
├─────────────────────────────────────────────────────────┤
│  Entry Point: workflowRouter (middleware)               │
│       ↓                                                 │
│  Retrieval Node (Graphiti search)                       │
│       ↓                                                 │
│  Supervisor Node (LLM routing + tool calling)           │
│       ↓                                                 │
│  Response (streaming tokens via SSE)                    │
└─────────────────────────────────────────────────────────┘
```

### Workflow Modes

```typescript
type WorkflowMode = 'chat' | 'cim' | 'irl'
```

| Mode | Router Target | Status |
|------|---------------|--------|
| `chat` | Supervisor → Tool Calling | Production |
| `cim` | Placeholder (Story 6.1) | Pending |
| `irl` | Supervisor (fallback) | Future |

### Thread ID Format

```typescript
// v2 chat: {workflowMode}:{dealId}:{userId}:{conversationId}
`chat:${dealId}:${userId}:${conversationId}`
```

### SSE Events (v2 Chat)

```typescript
type AgentStreamEvent =
  | { type: 'token'; content: string; timestamp: string }
  | { type: 'source_added'; source: SourceCitation; timestamp: string }
  | { type: 'done'; state: FinalState; timestamp: string }
  | { type: 'error'; message: string; timestamp: string }
```

### Retrieval Behavior

The retrieval node performs Graphiti hybrid search before the supervisor responds:

1. **Vector Search**: Semantic similarity via Voyage embeddings
2. **BM25 Search**: Keyword matching for precise terms
3. **Graph Traversal**: Follow relationships (SUPERSEDES, CONTRADICTS, SUPPORTS)
4. **Reranking**: Voyage rerank-2.5 improves result relevance

### Supervisor Node

The supervisor uses tool calling to:
- Search knowledge base (pre-retrieval or on-demand)
- Detect contradictions in findings
- Identify information gaps
- Format responses with citations

---

## CIM MVP Agent Behavior

### Overview

The CIM MVP is a **standalone implementation** separate from v2, optimized for the 14-phase CIM workflow.

### Key Files

```
lib/agent/cim-mvp/
├── graph.ts           # LangGraph StateGraph for CIM workflow
├── state.ts           # CIM-specific state schema
├── tools.ts           # CIM tools (save_buyer_persona, create_outline, etc.)
├── prompts.ts         # System prompts per workflow phase
└── knowledge-loader.ts # JSON knowledge file loader
```

### Thread ID Format

```typescript
// CIM MVP: cim-mvp:{cimId}
`cim-mvp:${cimId}`
```

### SSE Events (CIM MVP)

```typescript
type CIMMVPStreamEvent =
  | { type: 'token'; content: string; timestamp: string }
  | { type: 'workflow_progress'; data: WorkflowProgress; timestamp: string }
  | { type: 'outline_created'; data: { sections: OutlineSection[] }; timestamp: string }
  | { type: 'outline_updated'; data: { sections: OutlineSection[] }; timestamp: string }
  | { type: 'section_started'; data: { sectionId: string }; timestamp: string }
  | { type: 'slide_update'; data: SlideUpdate; timestamp: string }
  | { type: 'sources'; data: SourceCitation[]; timestamp: string }
  | { type: 'done'; timestamp: string }
  | { type: 'error'; message: string; timestamp: string }
```

### CIM Tools

| Tool | Purpose |
|------|---------|
| `save_buyer_persona` | Save identified buyer persona |
| `create_outline` | Create CIM section outline |
| `update_outline` | Modify existing outline |
| `generate_slide` | Generate slide content for a section |
| `update_slide` | Update existing slide content |

### Knowledge Loading

CIM MVP loads knowledge from JSON files:
```typescript
const knowledge = await loadKnowledge(knowledgePath)
// Returns structured company data, financials, narrative
```

### State Persistence

**Current:** PostgresSaver + Supabase JSONB columns in `cims` table

**Proposed:** Convex for real-time updates and cascade invalidation
- See [ADR-002](architecture-decisions/adr-002-convex-cim-state.md) for architecture decision
- See [tech-spec-convex-cim-migration.md](sprint-artifacts/tech-specs/tech-spec-convex-cim-migration.md) for implementation

---

## Response Formatting Rules

### Core Principles

1. **Always structured** — no walls of text
2. **No hard length limits** — focus on relevance
3. **Exclude irrelevant information** — concise beats comprehensive
4. **Every factual claim needs a source**

### Adaptive Formatting

| Content Type | Format |
|--------------|--------|
| Single data point | Short prose with inline source |
| List of items / comparisons | Bullet points |
| Trend or narrative | Prose with inline sources |
| Multiple topics | Headers + bullets/prose per section |

### Meta-Commentary Rule

**Brief orientation, then deliver.**

- "Here's the P&L breakdown:" → content
- NOT: "I understand you want me to walk you through the P&L. I'll analyze the financial statements..." → too verbose

One short line of commentary max, then get to the content.

---

## Source Attribution

### Format

Every factual claim must have a source:
- Format: `(source: filename.ext, location)`
- Location: page number, cell reference, section name
- Multiple sources: `(sources: doc1.pdf p.5, doc2.xlsx B15)`

### Example

> Q3 2024 revenue was €5.2M (source: Q3_Report.pdf, p.12).
>
> Note: An earlier management presentation from October estimated €5.0M — this was before final numbers were reported.

---

## Uncertainty Handling

### Response Patterns

| Situation | Agent Response |
|-----------|----------------|
| No findings | "I couldn't find information about X in the uploaded documents. Would you like me to add this to the Q&A list?" |
| Dated findings | Show results + explain: "I found references to X from [date]. Here's what I found: [results]." |
| Low confidence | Show results + explain WHY (source quality, partial data, conflicting sources) |
| Outside scope | "This question isn't covered in the uploaded documents. Would you like me to add it to the Q&A list?" |

**Key rule:** Never just say "I don't know" — always explain WHY and offer a next step.

### Conflict Detection

| Scenario | Is it a Conflict? | Agent Behavior |
|----------|-------------------|----------------|
| 2023 P&L says €4M, 2024 P&L says €5M | **No** — different periods | Return most recent, no warning |
| Two docs from Q3 2024, one says €5M, other says €5.2M | **Maybe** | Check for SUPERSEDES relationship |
| Corrected document exists | **No** — correction chain | Return corrected value, note correction |
| Same period, different sources | **Yes** | Flag as conflict, explain both sources |

---

## Testing Strategy

### Test Pyramid

| Test Type | When | Purpose |
|-----------|------|---------|
| Unit tests (mocked) | Every commit | Code logic, tool routing |
| Integration tests | Manual before release | E2E validation |
| Evaluation dataset | Periodic | Behavior compliance |

### Key Test Categories

1. **Tool Invocation** — Agent calls correct tool for query type
2. **Response Formatting** — Sources cited, structured output
3. **Uncertainty Handling** — Appropriate explanations for gaps
4. **Multi-turn Context** — Context maintained across turns

### Evaluation Dataset (Sample)

| ID | Query | Intent | Key Checks |
|----|-------|--------|------------|
| EVAL-001 | "What's the Q3 revenue?" | Fact lookup | Single answer, source cited |
| EVAL-002 | "Walk me through the P&L" | Deep dive | Structured, trends noted |
| EVAL-003 | "Any red flags?" | Due diligence | Contradictions surfaced |
| EVAL-004 | "Compare forecast to actual" | Comparison | Side-by-side, variance |

---

## API Reference

For detailed API documentation, see:
- **Chat v2**: `lib/agent/README.md`
- **CIM MVP**: `lib/agent/README.md`

### Quick Reference

**Chat (v2):**
```typescript
import { streamAgentWithTokens, createInitialState } from '@/lib/agent/v2'
```

**CIM MVP:**
```typescript
import { streamCIMMVP, executeCIMMVP } from '@/lib/agent/cim-mvp'
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-30 | Max + John (PM) | Initial draft for Epic 5 |
| 1.1 | 2025-11-30 | Max + John (PM) | All prerequisites complete (P1-P4, P7-P8) |
| 2.0 | 2026-01-15 | Max + John (PM) | **Major rewrite**: Updated for v2 chat + CIM MVP implementation. Removed outdated pgvector/orchestrator references. Added current architecture, SSE events, thread ID formats. |

---

## Related Documentation

- **Agent API Reference**: `manda-app/lib/agent/README.md`
- **LangGraph Patterns**: `docs/langgraph-reference.md`
- **Architecture**: `docs/manda-architecture.md` (v4.3)
- **Agent System PRD**: `_bmad-output/planning-artifacts/agent-system-prd.md`
- **CLAUDE.md**: Project root (implementation patterns)
