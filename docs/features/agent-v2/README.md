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

> **Note:** Documentation will be consolidated here from `_bmad-output/` and `docs/` directories during Phase 2.

Current documentation sources:
- `docs/agent-system/` - Agent system hub
- `_bmad-output/planning-artifacts/agent-system-prd.md` - PRD
- `_bmad-output/planning-artifacts/agent-system-architecture.md` - Architecture

---

[Back to Feature Documentation](../README.md)
