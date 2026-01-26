# CIM Builder

---
title: CIM Builder Documentation
version: 1.0
status: Production Ready
last-updated: 2026-01-26
consolidates: docs/cim-mvp/, docs/features/cim-builder/
---

The CIM Builder creates Confidential Information Memorandums with AI-assisted content generation.

## Status: Production Ready

All 6 fix stories completed on 2026-01-14. The CIM MVP is production-ready with:
- HITL checkpoints at all critical workflow stages
- Interactive slide design (content-first, then visual)
- Stage navigation for backward revision
- Full component rendering (50+ types)
- Anthropic prompt caching for cost optimization
- v3 conversational patterns throughout

## Implementation

The CIM Builder uses a **standalone implementation** separate from the v2 agent system:

| Component | Location |
|-----------|----------|
| **Graph** | `lib/agent/cim-mvp/graph.ts` |
| **State** | `lib/agent/cim-mvp/state.ts` |
| **Tools** | `lib/agent/cim-mvp/tools.ts` |
| **Prompts** | `lib/agent/cim-mvp/prompts.ts` |
| **API** | `/api/projects/[id]/cims/[cimId]/chat-mvp` |
| **UI** | `components/cim-builder/CIMBuilderPage.tsx` |

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
├── graph.ts           # LangGraph StateGraph (7 stages)
├── state.ts           # CIM-specific state schema
├── tools.ts           # 15+ CIM tools
├── prompts.ts         # System prompts per stage (v3 HITL patterns)
├── knowledge-loader.ts # JSON knowledge file loader
└── index.ts           # Barrel exports
```

## SSE Events

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

## CIM Tools

| Tool | Purpose |
|------|---------|
| `save_buyer_persona` | Save identified buyer persona |
| `create_outline` | Create CIM section outline |
| `update_outline` | Modify existing outline |
| `generate_slide` | Generate slide content for a section |
| `update_slide` | Update existing slide content |
| `navigate_to_stage` | Move between workflow stages |

## Knowledge Loading

CIM MVP loads knowledge from JSON files:

```typescript
const knowledge = await loadKnowledge(knowledgePath)
// Returns structured company data, financials, narrative
```

## State Management

### Current (PostgreSQL)

| Layer | Technology | Data |
|-------|------------|------|
| **LangGraph Checkpoints** | PostgresSaver | Conversation thread state |
| **Workflow State** | Supabase JSONB | Stage, slides, outline, artifacts |
| **Permissions** | Supabase RLS | User/deal access control |
| **Auth** | Supabase Auth | User sessions |

### Proposed Migration (Convex)

See [ADR-002](../../decisions/adr-002-convex-cim-state.md) for the proposed Convex migration for:
- Real-time updates
- Cascade invalidation
- Durable workflows
- Direct navigation

## Fix Stories (All Complete)

| Story | Issue | Status |
|-------|-------|--------|
| Story 1 | Outline HITL Flow | Complete |
| Story 2 | Building Sections Interactive Design | Complete |
| Story 3 | Stage Navigation Tool | Complete |
| Story 4 | Slide Preview Rendering (50+ components) | Complete |
| Story 5 | Prompt Caching (60-80% cost reduction) | Complete |
| Story 6 | v3 Prompt Patterns | Complete |

## Planning Artifacts (Historical Reference)

| Document | Purpose |
|----------|---------|
| [Architecture Evaluation](../../../_bmad-output/planning-artifacts/cim-builder-architecture-evaluation.md) | Framework decision: LangGraph + Claude |
| [Subgraph Analysis](../../../_bmad-output/planning-artifacts/cim-subgraph-architecture.md) | Technical analysis for future v2 integration |
| [Caching Fix Plan](../../../_bmad-output/planning-artifacts/cim-mvp-caching-fix-plan.md) | Prompt caching optimization |

## Preview Architecture

For slide preview implementation details, see [preview-architecture.md](preview-architecture.md).

For research on slide generation approaches, see [research/slide-generation-research.md](research/slide-generation-research.md).

## Future Work

**Story 6.1: CIM v2 Integration** - The CIM MVP currently runs as a standalone workflow. Future integration into the v2 agent system is planned but not scheduled.

## Related Documentation

- **[Behavior Specification](behavior-spec.md)** - Agent behavior including CIM MVP
- **[Agent System Hub](README.md)** - Parent documentation
- **Agent CLAUDE.md**: `manda-app/lib/agent/CLAUDE.md`
