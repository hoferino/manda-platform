# Agent Development Context

This file provides context for working on the agent system in `lib/agent/`.

## Current Implementation Status

> **As of 2026-01-15**
> - **CIM Builder**: `cim-mvp` is production-ready (6 fix stories completed 2026-01-14)
> - **Chat**: `v2` agent is active for general chat
> - **v2 CIM integration**: Pending future work (Story 6.1)

## Active Implementations

### CIM Builder (Production Ready)

The CIM Builder uses a **standalone implementation** separate from the v2 agent system:

| Component | Details |
|-----------|---------|
| **Implementation** | `lib/agent/cim-mvp/` |
| **API Endpoint** | `/api/projects/[id]/cims/[cimId]/chat-mvp` |
| **UI Toggle** | Default ON in `CIMBuilderPage.tsx` |
| **Features** | JSON knowledge, workflow stages, HITL checkpoints, slide preview, prompt caching |

**Key Files:**
- `cim-mvp/graph.ts` - LangGraph StateGraph for CIM workflow
- `cim-mvp/state.ts` - CIM-specific state schema
- `cim-mvp/tools.ts` - CIM tools (save_buyer_persona, create_outline, navigate_to_stage, etc.)
- `cim-mvp/prompts.ts` - Stage prompts with v3 HITL patterns
- `cim-mvp/knowledge-loader.ts` - JSON knowledge file loader

**UI Entry Points:**
- `components/cim-builder/CIMBuilderPage.tsx` - Main UI with MVP toggle
- `lib/hooks/useCIMMVPChat.ts` - React hook for CIM MVP chat

### Chat Agent (v2)

General conversation uses the v2 agent with Graphiti retrieval:

| Component | Details |
|-----------|---------|
| **Implementation** | `lib/agent/v2/` |
| **API Endpoint** | `/api/projects/[id]/chat` |
| **Features** | Graphiti retrieval, supervisor node, tool calling |

**Key Files:**
- `v2/graph.ts` - Single StateGraph definition
- `v2/state.ts` - Unified AgentState schema
- `v2/nodes/supervisor.ts` - Main routing node
- `v2/nodes/retrieval.ts` - Graphiti knowledge graph search

**Shared Files:**
- `checkpointer.ts` - PostgresSaver for conversation persistence
- `streaming.ts` - SSE helpers for response streaming
- `tools/*.ts` - Tool definitions
- `retrieval.ts` - Pre-model retrieval hook

## Patterns

### CIM MVP Patterns

```typescript
// Thread ID format (CIM-scoped)
`cim-mvp:${cimId}`

// SSE events
type CIMMVPStreamEvent =
  | { type: 'token'; content: string; timestamp: string }
  | { type: 'workflow_progress'; data: WorkflowProgress; timestamp: string }
  | { type: 'outline_created'; data: { sections: OutlineSection[] }; timestamp: string }
  | { type: 'slide_update'; data: SlideUpdate; timestamp: string }
  | { type: 'done'; timestamp: string }
  | { type: 'error'; message: string; timestamp: string }

// Import from barrel
import { streamCIMMVP, executeCIMMVP } from '@/lib/agent/cim-mvp'
```

### v2 Chat Patterns

```typescript
// Thread ID format
`{workflowMode}:{dealId}:{userId}:{conversationId}`

// SSE events
type AgentStreamEvent =
  | { type: 'token'; content: string; timestamp: string }
  | { type: 'source_added'; source: SourceCitation; timestamp: string }
  | { type: 'done'; state: FinalState; timestamp: string }

// Import from barrel
import { streamAgentWithTokens, createInitialState } from '@/lib/agent/v2'
```

### Naming Conventions

```typescript
// State & Variables: camelCase
dealContext, workflowMode, cimState, activeSpecialist

// Files & Directories: kebab-case
lib/agent/cim-mvp/knowledge-loader.ts

// Graph Nodes: short descriptive
'supervisor', 'retrieval', 'agent'
```

## Anti-Patterns

```typescript
// Don't use old orchestrator code (DELETED)
import { streamOrchestrator } from '@/lib/agent/orchestrator'

// Don't use original cim/ (superseded by cim-mvp)
import { executeCIMChat } from '@/lib/agent/cim'

// Don't skip timestamps in SSE events
yield { type: 'token', content: '...' }  // Missing timestamp!

// Don't import from deep paths - use barrel exports
import { supervisor } from '@/lib/agent/v2/nodes/supervisor'
```

## Legacy/Superseded Code

| Code | Status | Notes |
|------|--------|-------|
| `lib/agent/orchestrator/` | DELETED | Legacy 3-path regex router |
| `lib/agent/executor.ts` | DELETED | Legacy agent executor |
| `lib/agent/supervisor/` | DELETED | Legacy supervisor module |
| `lib/agent/cim/` | Superseded | Use `cim-mvp/` instead |

## Documentation

- **Agent System Hub**: `docs/agent-system/README.md`
- **CIM MVP Hub**: `docs/cim-mvp/README.md`
- **LangGraph Reference**: `docs/langgraph-reference.md`
- **Behavior Spec**: `docs/agent-behavior-spec.md` (v2.0)
- **Decisions**: `docs/decisions/README.md`

## Future Architecture

> CIM integration into v2 is planned for Story 6.1. Until then, use `cim-mvp`.

See `docs/agent-system/README.md` for the v2 unified architecture vision.
