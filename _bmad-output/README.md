# BMAD Output Directory

---
title: BMAD Output Index
version: 1.0
status: Current
last-updated: 2026-01-15
---

This directory contains outputs from BMAD (Build Mad Agentic Delivery) workflows.

## Active Development Streams

The project has multiple parallel development streams, each following BMAD methodology:

| Stream | Status | Planning | Implementation |
|--------|--------|----------|----------------|
| **Main Platform (E1-E13)** | E12 In Progress | `docs/` (PRD, Architecture, Epics) | `docs/sprint-artifacts/` |
| **Agent System v2.0** | Epic 3 Complete | `planning-artifacts/agent-system-*` | `implementation-artifacts/agent-system-v2/` |
| **CIM MVP** | Active | `planning-artifacts/cim-*` | `implementation-artifacts/cim-mvp-*` |

## Directory Structure

```
_bmad-output/
├── README.md                      # This file
│
├── planning-artifacts/            # PRDs, architectures, epics, change proposals
│   ├── agent-system-prd.md
│   ├── agent-system-architecture.md
│   ├── agent-system-epics.md
│   ├── cim-builder-architecture-evaluation.md
│   ├── cim-subgraph-architecture.md
│   ├── change-proposal-qa-as-skill-2026-01-10.md
│   ├── sprint-change-proposal-2026-01-11.md
│   ├── implementation-readiness-report-2026-01-10.md
│   └── bmm-workflow-status.yaml
│
├── implementation-artifacts/      # Stories, retrospectives, dev handoffs
│   ├── agent-system-v2/
│   │   ├── stories/               # Story files (1-1, 2-1, 3-1, etc.)
│   │   ├── epics/                 # (empty - specs in planning)
│   │   ├── sprint-status.yaml
│   │   ├── epic-1-retro-2026-01-10.md
│   │   ├── epic-2-retro-2026-01-10.md
│   │   ├── epic-3-retro-2026-01-11.md
│   │   └── sprint-change-proposal-2026-01-10.md
│   └── cim-mvp-dev-handoff.md
│
├── sprint-artifacts/
│   └── cim-mvp-fix-stories.md
│
└── testing/
    └── cim-mvp-testing-log.md
```

## Stream: Agent System v2.0

A BMAD-driven development cycle for the v2 chat agent with context engineering.

| Phase | Artifacts |
|-------|-----------|
| **Planning** | `agent-system-prd.md`, `agent-system-architecture.md`, `agent-system-epics.md` |
| **Implementation** | `implementation-artifacts/agent-system-v2/stories/` |
| **Retrospectives** | `epic-{1,2,3}-retro-2026-01-*.md` |

**Status:** 3 epics complete (14 stories), Story 6.1 pending for CIM integration.

## Stream: CIM MVP

A fast-track parallel development for the CIM Builder MVP.

| Phase | Artifacts |
|-------|-----------|
| **Architecture** | `cim-builder-architecture-evaluation.md`, `cim-subgraph-architecture.md` |
| **Implementation** | `cim-mvp-dev-handoff.md` |
| **Testing** | `testing/cim-mvp-testing-log.md` |
| **Fixes** | `sprint-artifacts/cim-mvp-fix-stories.md` |

**Status:** MVP active, 6 fix stories planned.

## Stream: Main Platform (E1-E13)

The primary platform development, documented in `docs/` directory.

| Phase | Location |
|-------|----------|
| **Planning** | `docs/manda-prd.md`, `docs/manda-architecture.md`, `docs/epics.md` |
| **Implementation** | `docs/sprint-artifacts/stories/` |
| **Retrospectives** | `docs/sprint-artifacts/retrospectives/` |

**Status:** E1-E11 complete, E12 in progress, E13 planned.

## Change Proposals

All change proposals are now centralized in `docs/decisions/`:

| ID | Date | Topic | Status |
|----|------|-------|--------|
| SCP-003 | 2025-12-15 | E10 Architecture Pivot | Approved |
| SCP-006 | 2026-01-11 | CIM MVP Fast Track | Draft |
| CP-001 | 2026-01-10 | Q&A as Skill | Approved |

See [docs/decisions/README.md](../docs/decisions/README.md) for full index.

## BMAD Workflow Status

Track workflow progress in:
- `planning-artifacts/bmm-workflow-status.yaml` - BMAD method status
- `implementation-artifacts/agent-system-v2/sprint-status.yaml` - Sprint tracking

## Related Documentation

- **[Documentation Map](../docs/documentation-map.md)** - Full project documentation index
- **[Agent System Hub](../docs/agent-system/README.md)** - Agent documentation
- **[CIM MVP Hub](../docs/cim-mvp/README.md)** - CIM documentation
- **[Decisions Log](../docs/decisions/README.md)** - Change proposals index
