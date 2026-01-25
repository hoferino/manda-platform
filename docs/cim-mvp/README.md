# CIM MVP Documentation

---
title: CIM MVP Index
version: 1.0
status: Current
stream: CIM MVP
last-updated: 2026-01-15
---

This folder consolidates documentation for the CIM (Confidential Information Memorandum) Builder MVP.

## Status: ✅ Production Ready

All 6 fix stories completed on 2026-01-14. The CIM MVP is now production-ready with:
- HITL checkpoints at all critical workflow stages
- Interactive slide design (content-first, then visual)
- Stage navigation for backward revision
- Full component rendering (50+ types)
- Anthropic prompt caching for cost optimization
- v3 conversational patterns throughout

## Current Implementation

| Component | Location | Status |
|-----------|----------|--------|
| **CIM MVP Agent** | `manda-app/lib/agent/cim-mvp/` | ✅ Production Ready |
| **API Endpoint** | `/api/projects/[id]/cims/[cimId]/chat-mvp` | Active |
| **UI Component** | `components/cim-builder/CIMBuilderPage.tsx` | Active |
| **State Storage** | PostgresSaver + Supabase JSONB | Active (Convex migration proposed) |

## Primary Documentation

### Architecture & Design

- **[CIM Architecture Evaluation](../../_bmad-output/planning-artifacts/cim-builder-architecture-evaluation.md)** (2026-01-14) - Framework decision: LangGraph + Claude
- **[CIM Subgraph Analysis](../../_bmad-output/planning-artifacts/cim-subgraph-architecture.md)** (2026-01-09) - Technical analysis of subgraph options

### Development Artifacts

- **[CIM MVP Dev Handoff](../../_bmad-output/implementation-artifacts/cim-mvp-dev-handoff.md)** - Development tasks and context
- **[CIM MVP Fix Stories](../../_bmad-output/sprint-artifacts/cim-mvp-fix-stories.md)** - 6 fix stories for critical issues

### Testing

- **[CIM MVP Testing Log](../../_bmad-output/testing/cim-mvp-testing-log.md)** - Test results and issue tracking

## Workflow Stages

The CIM Builder follows a 7-stage workflow:

```
welcome → buyer_persona → hero_concept → investment_thesis → outline → building_sections → complete
```

| Stage | Description | Tools Used |
|-------|-------------|------------|
| `welcome` | Greet user, introduce workflow | None |
| `buyer_persona` | Identify target buyer type | `save_buyer_persona` |
| `hero_concept` | Define central narrative | `knowledge_search`, `save_context` |
| `investment_thesis` | Frame the opportunity | `save_hero_concept` |
| `outline` | Create CIM section structure | `create_outline`, `update_outline` |
| `building_sections` | Generate slide content | `update_slide`, `start_section` |
| `complete` | Finalize CIM | Export tools |

## Key Files

```
manda-app/lib/agent/cim-mvp/
├── graph.ts           # LangGraph StateGraph
├── state.ts           # CIM-specific state schema
├── tools.ts           # CIM tools (15+)
├── prompts.ts         # System prompts per stage
├── knowledge-loader.ts # JSON knowledge file loader
└── index.ts           # Barrel exports
```

## SSE Events

```typescript
type CIMMVPStreamEvent =
  | { type: 'token'; content: string; timestamp: string }
  | { type: 'workflow_progress'; data: WorkflowProgress; timestamp: string }
  | { type: 'outline_created'; data: { sections: OutlineSection[] }; timestamp: string }
  | { type: 'slide_update'; data: SlideUpdate; timestamp: string }
  | { type: 'done'; timestamp: string }
  | { type: 'error'; message: string; timestamp: string }
```

## Fix Stories (All Complete)

| Story | Issue | Status |
|-------|-------|--------|
| Story 1 | Outline HITL Flow | ✅ Complete |
| Story 2 | Building Sections Interactive Design | ✅ Complete |
| Story 3 | Stage Navigation Tool | ✅ Complete |
| Story 4 | Slide Preview Rendering (50+ components) | ✅ Complete |
| Story 5 | Prompt Caching (60-80% cost reduction) | ✅ Complete |
| Story 6 | v3 Prompt Patterns | ✅ Complete |

See [CIM MVP Fix Stories](../../_bmad-output/sprint-artifacts/cim-mvp-fix-stories.md) for implementation details.

## State Management Architecture

### Current State (PostgreSQL)

| Layer | Technology | Data |
|-------|------------|------|
| **LangGraph Checkpoints** | PostgresSaver | Conversation thread state |
| **Workflow State** | Supabase JSONB | Stage, slides, outline, artifacts |
| **Permissions** | Supabase RLS | User/deal access control |
| **Auth** | Supabase Auth | User sessions |

### Proposed State (Convex Migration)

> **Status:** Proposed - see [ADR-002](../architecture-decisions/adr-002-convex-cim-state.md)

| Layer | Technology | Data |
|-------|------------|------|
| **Workflow State** | Convex | Stage, slides, outline, artifacts |
| **Conversations** | Convex | Messages with vector embeddings |
| **LangGraph Checkpoints** | Convex (ConvexSaver) | Thread state |
| **Permissions** | Supabase RLS | User/deal access control (unchanged) |
| **Auth** | Supabase Auth | User sessions (unchanged) |

### Benefits of Convex Migration

- **Real-time updates**: Automatic UI push on state changes
- **Cascade invalidation**: Navigate backward → downstream slides marked stale
- **Durable workflows**: Survives crashes, multi-day sessions
- **Direct navigation**: Jump to any slide (not just sequential)

See [tech-spec-convex-cim-migration.md](../sprint-artifacts/tech-specs/tech-spec-convex-cim-migration.md) for implementation details.

## Future Work

- **Story 6.1**: Integrate CIM into v2 agent graph
- Subgraph architecture for phase isolation (V2)
- Live knowledge integration with Graphiti

## Related Documentation

- **[Agent System Index](../agent-system/README.md)** - Parent agent system docs
- **[Agent Behavior Spec](../agent-behavior-spec.md)** - Includes CIM MVP behavior
- **[CLAUDE.md](../../CLAUDE.md)** - CIM MVP patterns and anti-patterns
