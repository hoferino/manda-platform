# Manda Platform - Documentation Map

---
title: Documentation Map
version: 1.0
status: Current
purpose: Central index of all project documentation
last-updated: 2026-01-15
---

This document provides a comprehensive map of all documentation in the Manda Platform project, organized by category and audience.

## Quick Navigation

| If you want to... | Go to... |
|-------------------|----------|
| Understand the platform | [Platform Overview](manda-platform-overview.md) |
| Set up development | [CLAUDE.md](../CLAUDE.md) |
| Learn the architecture | [Architecture](manda-architecture.md) v4.3 |
| See product requirements | [PRD](manda-prd.md) v2.4 |
| Work on a story | [Sprint Artifacts](sprint-artifacts/) |
| Understand the agent system | [Agent System Index](agent-system/README.md) |
| Review decisions/pivots | [Decisions Log](decisions/README.md) |
| Deploy to GCP | [GCP Setup Guide](deployment/gcp-setup-guide.md) |

---

## Documentation Structure

```
manda-platform/
├── CLAUDE.md                    # Developer guide (Claude Code)
├── README.md                    # Project overview
│
├── docs/
│   ├── README.md               # Documentation hub
│   ├── documentation-map.md    # ← You are here
│   │
│   ├── # Core Planning Docs
│   ├── manda-prd.md           # Product Requirements (v2.4)
│   ├── manda-architecture.md  # Technical Architecture (v4.3)
│   ├── epics.md               # Epic/Story Breakdown (v2.5)
│   │
│   ├── # Audience-Specific
│   ├── manda-index.md         # Developer technical index
│   ├── manda-platform-overview.md  # Stakeholder overview
│   │
│   ├── # Agent System
│   ├── agent-system/          # Agent documentation hub
│   ├── cim-mvp/               # CIM MVP documentation hub
│   ├── agent-behavior-spec.md # Agent behavior (v2.0)
│   ├── langgraph-reference.md # LangGraph patterns
│   │
│   ├── # Infrastructure
│   ├── deployment/            # Deployment guides
│   ├── gcp-deployment-guide.md # GCP strategy
│   │
│   ├── # Sprint Work
│   ├── sprint-artifacts/      # Epics, stories, tech specs
│   ├── testing/               # Test plans and results
│   ├── architecture-decisions/ # ADRs
│   ├── decisions/             # Sprint change proposals (centralized)
│   │
│   └── archived/              # Superseded documentation
│
└── _bmad-output/              # BMAD workflow outputs
    ├── planning-artifacts/    # PRDs, architectures, epics
    └── implementation-artifacts/  # Stories, retrospectives
```

---

## Core Documentation

### Product & Architecture

| Document | Version | Status | Purpose | Audience |
|----------|---------|--------|---------|----------|
| [manda-prd.md](manda-prd.md) | v2.4 | Current | Product Requirements | All |
| [manda-architecture.md](manda-architecture.md) | v4.3 | Current | Technical Architecture | Developers |
| [epics.md](epics.md) | v2.5 | Current | Epic/Story Breakdown | All |
| [ux-design-specification.md](ux-design-specification.md) | - | Current | UX Design Specs | Design, Frontend |

### Developer Guides

| Document | Version | Status | Purpose | Audience |
|----------|---------|--------|---------|----------|
| [CLAUDE.md](../CLAUDE.md) | - | Current | Claude Code guidance | Developers |
| [manda-index.md](manda-index.md) | v1.1 | Current | Technical index | Developers |
| [manda-platform-overview.md](manda-platform-overview.md) | v1.0 | Current | High-level overview | Stakeholders |

---

## Agent System Documentation

### Specifications

| Document | Version | Status | Purpose |
|----------|---------|--------|---------|
| [agent-behavior-spec.md](agent-behavior-spec.md) | v2.0 | Current | Agent behavior rules |
| [langgraph-reference.md](langgraph-reference.md) | - | Current | LangGraph patterns |
| [agent-system/README.md](agent-system/README.md) | v1.0 | Current | Agent system hub |
| [cim-mvp/README.md](cim-mvp/README.md) | v1.0 | Current | CIM MVP hub |

### BMAD Planning (Agent System v2.0)

| Document | Location | Status |
|----------|----------|--------|
| Agent System PRD | `_bmad-output/planning-artifacts/agent-system-prd.md` | Complete |
| Agent System Architecture | `_bmad-output/planning-artifacts/agent-system-architecture.md` | Complete |
| Agent System Epics | `_bmad-output/planning-artifacts/agent-system-epics.md` | Complete |
| CIM Architecture Evaluation | `_bmad-output/planning-artifacts/cim-builder-architecture-evaluation.md` | Recommendation Ready |

### Implementation Artifacts

| Document | Location | Status |
|----------|----------|--------|
| Epic 1 Retrospective | `_bmad-output/implementation-artifacts/.../epic-1-retro-2026-01-10.md` | Complete |
| Epic 2 Retrospective | `_bmad-output/implementation-artifacts/.../epic-2-retro-2026-01-10.md` | Complete |
| Epic 3 Retrospective | `_bmad-output/implementation-artifacts/.../epic-3-retro-2026-01-11.md` | Complete |
| CIM MVP Dev Handoff | `_bmad-output/implementation-artifacts/cim-mvp-dev-handoff.md` | Active |

---

## Infrastructure Documentation

### Deployment

| Document | Version | Purpose |
|----------|---------|---------|
| [deployment/gcp-setup-guide.md](deployment/gcp-setup-guide.md) | v1.0 | Step-by-step GCP setup |
| [gcp-deployment-guide.md](gcp-deployment-guide.md) | v1.0 | GCP strategy & cost analysis |

### Setup

| Document | Location | Purpose |
|----------|----------|---------|
| Graphiti Setup | `setup/graphiti-local-setup.md` | Local Neo4j + Graphiti |

---

## Sprint Artifacts

### Epics (13 total)

| Epic | Status | Location |
|------|--------|----------|
| E1-E11 | Complete | `sprint-artifacts/epics/` |
| E12 | In Progress | `sprint-artifacts/epics/epic-E12.md` |
| E13 | Planned | `sprint-artifacts/epics/epic-E13.md` |

### Stories

130+ story files organized by epic in `sprint-artifacts/stories/`

Pattern: `e{epic}-{number}-{title}.md`

### Tech Specs

11 tech specs in `sprint-artifacts/tech-specs/`

Pattern: `tech-spec-epic-E{N}.md`

### Retrospectives

11 retrospectives in `sprint-artifacts/retrospectives/`

---

## Testing Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| Testing Guide | [testing/testing-guide.md](testing/testing-guide.md) | Comprehensive test reference |
| Test Strategy | [testing/manda-test-strategy.md](testing/manda-test-strategy.md) | Overall test approach |
| Agent Test Plan | [testing/agent-behavior-test-plan.md](testing/agent-behavior-test-plan.md) | Agent testing spec |
| Manual Test Plans | [testing/manual-test-plan-*.md](testing/) | Happy path + edge cases |

---

## Architecture Decisions

| ADR | Topic | Status |
|-----|-------|--------|
| [ADR-001](architecture-decisions/adr-001-graphiti-migration.md) | Graphiti Migration (E10) | Accepted |

---

## BMAD Workflow Tracking

### Workflow Status

- Main workflow: `_bmad-output/planning-artifacts/bmm-workflow-status.yaml`
- Sprint status: `_bmad-output/implementation-artifacts/agent-system-v2/sprint-status.yaml`

### Change Proposals (Centralized)

All change proposals are now consolidated in **[docs/decisions/](decisions/README.md)**.

| ID | Proposal | Date | Status |
|----|----------|------|--------|
| SCP-001 | [IRL Feature UX Pivot](decisions/sprint-change-proposal-2025-12-11.md) | 2025-12-11 | Approved |
| SCP-002 | [PRD/Architecture Refinements](decisions/sprint-change-proposal-2025-12-14.md) | 2025-12-14 | Approved |
| SCP-003 | [Knowledge Architecture Evolution](decisions/sprint-change-proposal-2025-12-15.md) | 2025-12-15 | Approved |
| SCP-004 | [Fast Path Document Retrieval](decisions/sprint-change-proposal-2026-01-05.md) | 2026-01-05 | Pending |
| SCP-005 | [Redis Postponement](decisions/sprint-change-proposal-2026-01-10.md) | 2026-01-10 | Approved |
| CP-001 | [Q&A as Cross-Cutting Skill](decisions/change-proposal-qa-as-skill-2026-01-10.md) | 2026-01-10 | Approved |
| SCP-006 | [CIM MVP Fast Track](decisions/sprint-change-proposal-2026-01-11.md) | 2026-01-11 | Draft |

---

## Document Status Legend

| Status | Meaning |
|--------|---------|
| **Current** | Actively maintained, up-to-date |
| **In Progress** | Being worked on |
| **Reference** | Accurate but not frequently updated |
| **Needs Update** | Outdated, needs revision |
| **Archived** | Superseded, kept for history |

---

## Maintenance Guidelines

### When to Update This Map

1. When adding new documentation folders
2. When major documents are versioned
3. When documents are archived
4. After completing an epic (check for new docs)

### Document Ownership

| Area | Owner |
|------|-------|
| PRD, Architecture | Product/Architecture |
| Sprint Artifacts | Development Team |
| Agent System | Agent Team |
| Testing | QA/Development |
| Infrastructure | DevOps |

---

*Last updated: 2026-01-15*
