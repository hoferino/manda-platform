# Agent System Documentation

---
title: Agent System Index
version: 1.0
status: Current
stream: Agent System v2.0
last-updated: 2026-01-15
---

This folder consolidates documentation for the Manda Agent System (v2 chat + CIM MVP).

## Current Implementation

| Component | Location | Status |
|-----------|----------|--------|
| **Chat Agent (v2)** | `manda-app/lib/agent/v2/` | Production |
| **CIM MVP Agent** | `manda-app/lib/agent/cim-mvp/` | MVP (Active) |

## Primary Documentation

### Specification & Behavior

- **[Agent Behavior Spec](../agent-behavior-spec.md)** (v2.0) - Single source of truth for agent behavior
- **[LangGraph Reference](../langgraph-reference.md)** - LangGraph patterns and best practices

### API Reference

- **[Agent API README](../../manda-app/lib/agent/README.md)** - Quick reference for API endpoints, SSE events, usage examples

### BMAD Planning Artifacts

Agent System v2.0 was developed using BMAD methodology. Planning artifacts:

- **[Agent System PRD](../../_bmad-output/planning-artifacts/agent-system-prd.md)** - 64 functional requirements
- **[Agent System Architecture](../../_bmad-output/planning-artifacts/agent-system-architecture.md)** - Middleware stack, state design
- **[Agent System Epics](../../_bmad-output/planning-artifacts/agent-system-epics.md)** - 3 epics, 14 stories

### CIM MVP Artifacts

- **[CIM Architecture Evaluation](../../_bmad-output/planning-artifacts/cim-builder-architecture-evaluation.md)** - Framework decision (LangGraph + Claude)
- **[CIM Subgraph Analysis](../../_bmad-output/planning-artifacts/cim-subgraph-architecture.md)** - Future architecture reference

## Implementation Stories

### Epic 1: Foundation (Complete)

| Story | File | Description |
|-------|------|-------------|
| 1-1 | Unified Agent State | AgentState with 11 fields |
| 1-2 | Base StateGraph | StateGraph with conditional routing |
| 1-3 | PostgresSaver | PostgreSQL persistence |
| 1-4 | Thread ID Management | Chat API route |
| 1-6 | Error Recovery | Error framework + retry logic |
| 1-7 | Remove Legacy Code | Cleanup orchestrator |

### Epic 2: Intelligent Conversation (Complete)

| Story | File | Description |
|-------|------|-------------|
| 2-1 | Supervisor Node | LLM routing via Vertex AI |
| 2-2 | Token Streaming | SSE token events |
| 2-3 | Workflow Router | System prompt by mode |
| 2-4 | Professional Tone | Prompt guidelines |

### Epic 3: Knowledge & Retrieval (Complete)

| Story | File | Description |
|-------|------|-------------|
| 3-1 | Retrieval Node | Graphiti search integration |
| 3-2 | Source Attribution | Citation tracking |
| 3-3 | Uncertainty Handling | Confidence detection |

Full story files: `_bmad-output/implementation-artifacts/agent-system-v2/stories/`

## Retrospectives

- **[Epic 1 Retro](../../_bmad-output/implementation-artifacts/agent-system-v2/epic-1-retro-2026-01-10.md)** - 2026-01-10
- **[Epic 2 Retro](../../_bmad-output/implementation-artifacts/agent-system-v2/epic-2-retro-2026-01-10.md)** - 2026-01-10
- **[Epic 3 Retro](../../_bmad-output/implementation-artifacts/agent-system-v2/epic-3-retro-2026-01-11.md)** - 2026-01-11

## Future Work

- **Story 6.1**: Integrate CIM into v2 agent graph (pending)
- Context compression
- Human-in-the-loop checkpoints
- Multimodal support

## Related Documentation

- **[CLAUDE.md](../../CLAUDE.md)** - Agent implementation rules and patterns
- **[Main Architecture](../manda-architecture.md)** (v4.3) - Platform architecture
