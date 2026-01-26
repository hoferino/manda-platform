# Agent System Documentation

---
title: Agent System Hub
version: 2.0
status: Current
last-updated: 2026-01-26
consolidates: docs/agent-system/, docs/cim-mvp/, docs/features/agent-v2/, docs/features/cim-builder/
---

This folder is the **single authoritative location** for all agent system documentation.

## Current Implementation

| Component | Location | API Endpoint | Status |
|-----------|----------|--------------|--------|
| **Chat Agent (v2)** | `manda-app/lib/agent/v2/` | `/api/projects/[id]/chat` | Production |
| **CIM MVP Agent** | `manda-app/lib/agent/cim-mvp/` | `/api/projects/[id]/cims/[cimId]/chat-mvp` | Production Ready |

## Primary Documentation

| Document | Description |
|----------|-------------|
| **[Behavior Specification](behavior-spec.md)** | Single source of truth for agent behavior (v2.0) |
| **[LangGraph Reference](langgraph.md)** | LangGraph patterns and best practices |
| **[CIM Builder](cim-builder.md)** | CIM workflow implementation details |

## Quick Reference

### Technology Stack

- **LangGraph**: StateGraph-based agent orchestration
- **Graphiti + Neo4j**: Knowledge graph with hybrid search (vector + BM25 + graph)
- **Voyage voyage-3.5**: 1024-dimension embeddings
- **Voyage rerank-2.5**: Result reranking
- **PostgresSaver**: Conversation checkpointing
- **Vertex AI (Claude Sonnet 4)**: Primary LLM

### Code Imports

```typescript
// Chat (v2)
import { streamAgentWithTokens, createInitialState } from '@/lib/agent/v2'

// CIM MVP
import { streamCIMMVP, executeCIMMVP } from '@/lib/agent/cim-mvp'
```

### Thread ID Patterns

```typescript
// v2 chat: {workflowMode}:{dealId}:{userId}:{conversationId}
`chat:${dealId}:${userId}:${conversationId}`

// CIM MVP: cim-mvp:{cimId}
`cim-mvp:${cimId}`
```

## Architecture

### Chat Agent (v2)

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

### CIM Builder (7-Stage Workflow)

```
welcome → buyer_persona → hero_concept → investment_thesis → outline → building_sections → complete
```

## BMAD Planning Artifacts

Agent System v2.0 was developed using BMAD methodology. Historical planning artifacts (reference only):

| Document | Purpose |
|----------|---------|
| [Agent System PRD](../../../_bmad-output/planning-artifacts/agent-system-prd.md) | 64 functional requirements |
| [Agent System Architecture](../../../_bmad-output/planning-artifacts/agent-system-architecture.md) | Middleware stack, state design |
| [Agent System Epics](../../../_bmad-output/planning-artifacts/agent-system-epics.md) | 3 epics, 14 stories |
| [CIM Architecture Evaluation](../../../_bmad-output/planning-artifacts/cim-builder-architecture-evaluation.md) | Framework decision (LangGraph + Claude) |

## Implementation Stories

### Chat Agent v2 (All Complete)

| Epic | Stories |
|------|---------|
| **Epic 1: Foundation** | Unified state, StateGraph, PostgresSaver, thread ID, error recovery |
| **Epic 2: Intelligent Conversation** | Supervisor node, token streaming, workflow router, professional tone |
| **Epic 3: Knowledge & Retrieval** | Graphiti search, source attribution, uncertainty handling |

### CIM MVP Fix Stories (All Complete)

| Story | Issue | Status |
|-------|-------|--------|
| Story 1 | Outline HITL Flow | Complete |
| Story 2 | Building Sections Interactive Design | Complete |
| Story 3 | Stage Navigation Tool | Complete |
| Story 4 | Slide Preview Rendering (50+ components) | Complete |
| Story 5 | Prompt Caching (60-80% cost reduction) | Complete |
| Story 6 | v3 Prompt Patterns | Complete |

## Future Work

- **Story 6.1**: Integrate CIM into v2 agent graph (pending)
- Context compression
- Human-in-the-loop checkpoints
- Multimodal support

## Related Documentation

- **API Reference**: `manda-app/lib/agent/README.md`
- **Agent CLAUDE.md**: `manda-app/lib/agent/CLAUDE.md` (implementation patterns)
- **Architecture**: `docs/manda-architecture.md` (v4.3)
- **Decisions**: `docs/decisions/README.md`

## Superseded Documentation

The following locations are now superseded by this hub:

| Old Location | Status |
|--------------|--------|
| `docs/agent-system/` | Merged here |
| `docs/cim-mvp/` | Merged here |
| `docs/features/agent-v2/` | Merged here |
| `docs/features/cim-builder/` | Merged here |
| `docs/agent-framework-strategy.md` | Archived (historical strategy) |
