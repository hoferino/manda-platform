# CIM Builder

Workflow for creating Confidential Information Memorandums with AI-assisted content generation.

## Overview

The CIM Builder guides users through creating professional M&A documents:
- **Buyer persona definition** - Understanding target buyer characteristics
- **Outline creation** - Structuring the CIM sections
- **Content generation** - AI-assisted writing with human checkpoints
- **Slide preview** - Real-time visualization of the document

## Implementation

The CIM Builder uses a **standalone implementation** separate from the v2 agent system:

| Component | Location |
|-----------|----------|
| Graph | `lib/agent/cim-mvp/graph.ts` |
| State | `lib/agent/cim-mvp/state.ts` |
| Tools | `lib/agent/cim-mvp/tools.ts` |
| Prompts | `lib/agent/cim-mvp/prompts.ts` |
| API | `/api/projects/[id]/cims/[cimId]/chat-mvp` |

## Workflow Stages

1. **Welcome** - Initial context gathering
2. **Buyer Persona** - Define target buyer profile
3. **Outline** - Create document structure
4. **Content** - Generate section content with HITL checkpoints
5. **Review** - Final review and export

## Status

Production-ready as of 2026-01-14 (6 fix stories completed).

## Documentation

### Current (Authoritative)

| Document | Description | Last Updated |
|----------|-------------|--------------|
| [CIM MVP Hub](../../cim-mvp/README.md) | Primary documentation hub for CIM MVP | 2026-01-15 |
| CLAUDE.md | Implementation patterns and anti-patterns | Current |

The CIM MVP Hub contains:
- Implementation status and component locations
- Workflow stages (7 stages from welcome to complete)
- SSE event types
- Testing artifacts

### Historical (Planning Reference)

These documents capture planning and decision-making:

| Document | Purpose | Notes |
|----------|---------|-------|
| [Architecture Evaluation](../../../_bmad-output/planning-artifacts/cim-builder-architecture-evaluation.md) | Framework decision: LangGraph + Claude | 2026-01-14 |
| [Subgraph Analysis](../../../_bmad-output/planning-artifacts/cim-subgraph-architecture.md) | Technical analysis for future v2 integration | Reference for Story 6.1 |
| [Caching Fix Plan](../../../_bmad-output/planning-artifacts/cim-mvp-caching-fix-plan.md) | Prompt caching optimization | Implemented |

### Superseded

| Document | Superseded By |
|----------|---------------|
| `lib/agent/cim/` | Original CIM implementation, superseded by `cim-mvp` |

### Future Work

**Story 6.1: CIM v2 Integration** - The CIM MVP currently runs as a standalone workflow. Future integration into the v2 agent system is planned but not scheduled.

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

---

[Back to Feature Documentation](../README.md)
