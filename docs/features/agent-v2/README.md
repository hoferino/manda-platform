# Agent System v2

LangGraph-based agent architecture with supervisor pattern for intelligent document processing and conversational AI.

## Overview

The Agent v2 system provides a unified framework for:
- **Conversational AI** - General chat with knowledge graph retrieval
- **Workflow orchestration** - Specialized workflows (CIM, IRL, Q&A)
- **Tool calling** - Dynamic tool selection based on context

## Architecture

The system uses a single LangGraph StateGraph with middleware-based context engineering:

```
User Message -> Middleware Stack -> Single StateGraph -> Response
                    |
    context-loader -> workflow-router -> tool-selector -> summarization
```

## Implementation Status

| Workflow | Status | Location |
|----------|--------|----------|
| chat | Active | `lib/agent/v2/` |
| cim | Uses standalone `cim-mvp` | `lib/agent/cim-mvp/` |
| irl | Future | Planned |
| qa | Future | Planned |

## Documentation

### Current (Authoritative)

| Document | Description | Last Updated |
|----------|-------------|--------------|
| [Behavior Specification](behavior-spec.md) | Single source of truth for agent behavior | 2026-01-15 |
| [docs/agent-system/README.md](../../agent-system/README.md) | Agent system index and story tracking | 2026-01-15 |

### Historical (Planning Reference)

These documents in `_bmad-output/` capture planning decisions. They remain as reference but the current implementations may have evolved.

| Document | Purpose | Notes |
|----------|---------|-------|
| [Agent System PRD](../../../_bmad-output/planning-artifacts/agent-system-prd.md) | Original requirements (64 FRs) | Captures v2.0 requirements |
| [Agent System Architecture](../../../_bmad-output/planning-artifacts/agent-system-architecture.md) | Architecture decisions | Middleware stack design |
| [Agent System Epics](../../../_bmad-output/planning-artifacts/agent-system-epics.md) | Epic breakdown | 3 epics, 14 stories |
| [Agent Framework Strategy](../../agent-framework-strategy.md) | Strategic analysis | Superseded by implementation |

### Superseded

| Document | Superseded By |
|----------|---------------|
| `lib/agent/orchestrator/` | Deleted in Story 1.7, replaced by v2 |
| `lib/agent/supervisor/` | Deleted, replaced by v2/nodes/supervisor.ts |

---

[Back to Feature Documentation](../README.md)
