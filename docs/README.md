# Manda Platform Documentation

---
title: Documentation Hub
version: 2.0
status: Current
last-updated: 2026-01-26
---

Central documentation hub for the Manda M&A Intelligence Platform.

## Quick Navigation

| I want to... | Go to... |
|--------------|----------|
| Understand the product | [PRD](manda-prd.md) (v2.4) |
| See the architecture | [Architecture](manda-architecture.md) (v4.3) |
| Work on agent code | [features/agent-system/](features/agent-system/) |
| Review a decision | [decisions/](decisions/) |
| Check project status | [../.planning/PROJECT.md](../.planning/PROJECT.md) |
| Set up development | [CLAUDE.md](../CLAUDE.md) |
| Deploy to GCP | [deployment/gcp-setup-guide.md](deployment/gcp-setup-guide.md) |
| Work on a sprint story | [sprint-artifacts/](sprint-artifacts/) |

---

## Core Documents

| Document | Version | Description |
|----------|---------|-------------|
| [manda-prd.md](manda-prd.md) | v2.4 | Product requirements, user personas, FRs |
| [manda-architecture.md](manda-architecture.md) | v4.3 | Technical architecture, data flow |
| [epics.md](epics.md) | v2.5 | Epic/story breakdown with BDD criteria |
| [ux-design-specification.md](ux-design-specification.md) | - | UX design system |

---

## Features

| Feature | Documentation |
|---------|---------------|
| **Agent System** | [features/agent-system/](features/agent-system/) |
| └─ Chat v2 | [behavior-spec.md](features/agent-system/behavior-spec.md) |
| └─ CIM Builder | [cim-builder.md](features/agent-system/cim-builder.md) |
| └─ LangGraph patterns | [langgraph.md](features/agent-system/langgraph.md) |
| **Knowledge Graph** | [features/knowledge-graph/](features/knowledge-graph/) |

---

## Guides

| Guide | Purpose |
|-------|---------|
| [testing/testing-guide.md](testing/testing-guide.md) | Comprehensive test reference |
| [testing/test-design-system.md](testing/test-design-system.md) | System testability assessment |
| [deployment/gcp-setup-guide.md](deployment/gcp-setup-guide.md) | GCP setup instructions |
| [deployment/gcp-deployment-guide.md](deployment/gcp-deployment-guide.md) | GCP strategy & cost analysis |

---

## Sprint Work

| Location | Contents |
|----------|----------|
| [sprint-artifacts/README.md](sprint-artifacts/README.md) | Sprint artifacts structure guide |
| [sprint-artifacts/epics/](sprint-artifacts/epics/) | Epic definitions (E1-E13) |
| [sprint-artifacts/active/](sprint-artifacts/active/) | Current work (E12-E13 stories) |
| [sprint-artifacts/archive/](sprint-artifacts/archive/) | Completed work (E1-E11 stories, specs, retros) |

---

## Decisions

All architecture decisions and change proposals are in [decisions/](decisions/).

| Type | Prefix | Purpose |
|------|--------|---------|
| Sprint Change Proposal | SCP-* | Scope changes, pivots |
| Change Proposal | CP-* | Model/design changes |
| Architecture Decision Record | ADR-* | Technical architecture |

Recent decisions:
- [SCP-003](decisions/sprint-change-proposal-2025-12-15.md) - Knowledge Architecture Evolution (E10)
- [ADR-002](decisions/adr-002-convex-cim-state.md) - Convex CIM State Management (proposed)

---

## Implementation Status

| Epic | Name | Status |
|------|------|--------|
| E1-E9 | MVP Phase | Complete |
| E10 | Knowledge Graph Foundation | Complete |
| E11 | Agent Context Engineering | Complete |
| E12 | Production Readiness | In Progress |
| E13 | Agent Orchestration Optimization | Planned |

**Current Phase:** Production Readiness (E12-E13)

---

## BMAD Framework

This project uses BMAD (Build Mad Agentic Delivery) for AI-assisted development.

| Artifact Type | Location |
|---------------|----------|
| Planning artifacts | `_bmad-output/planning-artifacts/` |
| Implementation artifacts | `_bmad-output/implementation-artifacts/` |
| Workflow status | `_bmad-output/planning-artifacts/bmm-workflow-status.yaml` |

---

## Directory Structure

```
docs/
├── README.md                     # This file - documentation hub
│
├── # Core Planning
├── manda-prd.md                  # Product Requirements (v2.4)
├── manda-architecture.md         # Technical Architecture (v4.3)
├── epics.md                      # Epic/Story Breakdown (v2.5)
│
├── # Features (consolidated)
├── features/
│   ├── agent-system/             # All agent docs (chat, CIM, LangGraph)
│   └── knowledge-graph/          # Graphiti + Neo4j
│
├── # Sprint Work
├── sprint-artifacts/             # Epics, stories, tech specs
├── testing/                      # Test plans and guides
├── decisions/                    # SCPs, ADRs (centralized)
│
├── # Infrastructure
├── deployment/                   # Deployment guides
│
└── archived/                     # Superseded documentation
```

---

## Contributing

When adding documentation:

1. **Core docs** (PRD, Architecture) - Edit in place, update version
2. **Agent docs** - Add to `features/agent-system/`
3. **Sprint artifacts** - Add to `sprint-artifacts/`
4. **Superseded docs** - Move to `archived/`
5. **Update this README** when adding new folders

---

## Document Status Legend

| Status | Meaning |
|--------|---------|
| **Current** | Actively maintained, up-to-date |
| **In Progress** | Being worked on |
| **Historical** | Accurate but not frequently updated |
| **Archived** | Superseded, kept for history |

---

*Last updated: 2026-01-26*
