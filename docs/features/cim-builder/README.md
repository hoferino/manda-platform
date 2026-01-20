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

> **Note:** Documentation will be consolidated here from `_bmad-output/` and `docs/` directories during Phase 2.

Current documentation sources:
- `docs/cim-mvp/README.md` - CIM MVP hub
- `CLAUDE.md` - Implementation patterns and anti-patterns

---

[Back to Feature Documentation](../README.md)
