# Manda Platform Documentation

---
title: Documentation Hub
version: 1.1
status: Current
last-updated: 2026-01-15
---

This directory contains all documentation for the Manda M&A Intelligence Platform.

---

## Quick Links

| Document | Description | Version |
|----------|-------------|---------|
| [manda-prd.md](manda-prd.md) | Product Requirements Document | v2.4 |
| [manda-architecture.md](manda-architecture.md) | Technical Architecture | v4.3 |
| [epics.md](epics.md) | Epic and Story Breakdown | v2.5 |
| [documentation-map.md](documentation-map.md) | Full documentation index | v1.0 |
| [testing/testing-guide.md](testing/testing-guide.md) | Testing & Operations Guide | - |

---

## Documentation Structure

```
docs/
├── README.md                     # This file - documentation hub
├── documentation-map.md          # Complete documentation index
│
├── # Core Planning
├── manda-prd.md                  # Product Requirements Document (v2.4)
├── manda-architecture.md         # Technical Architecture (v4.3)
├── epics.md                      # Epic and Story Breakdown (v2.5)
├── ux-design-specification.md    # UX Design Specification
│
├── # Audience-Specific
├── manda-index.md                # Developer technical index
├── manda-platform-overview.md    # Stakeholder overview
│
├── # Agent System (NEW)
├── agent-system/                 # Agent v2 documentation hub
│   └── README.md
├── cim-mvp/                      # CIM MVP documentation hub
│   └── README.md
├── agent-behavior-spec.md        # Agent behavior (v2.0)
├── langgraph-reference.md        # LangGraph patterns
│
├── # Infrastructure
├── deployment/                   # Deployment guides
│   └── gcp-setup-guide.md        # GCP setup instructions
├── gcp-deployment-guide.md       # GCP strategy & cost analysis
│
├── # Sprint Work
├── sprint-artifacts/             # Epics, stories, tech specs
│   ├── epics/
│   ├── stories/
│   ├── tech-specs/
│   └── retrospectives/
├── testing/                      # Test plans and results
├── architecture-decisions/       # ADRs
├── decisions/                    # Sprint change proposals (centralized)
│
└── archived/                     # Superseded documentation
```

---

## Core Documentation

### Product & Architecture

| Document | Version | Description |
|----------|---------|-------------|
| [manda-prd.md](manda-prd.md) | v2.4 | Product requirements, user personas, FRs |
| [manda-architecture.md](manda-architecture.md) | v4.3 | Technical architecture, data flow |
| [epics.md](epics.md) | v2.5 | Epic/story breakdown with BDD criteria |
| [ux-design-specification.md](ux-design-specification.md) | - | UX design system |

### Agent System

| Document | Version | Description |
|----------|---------|-------------|
| [agent-system/README.md](agent-system/README.md) | v1.0 | Agent v2 documentation hub |
| [cim-mvp/README.md](cim-mvp/README.md) | v1.0 | CIM MVP documentation hub |
| [agent-behavior-spec.md](agent-behavior-spec.md) | v2.0 | Agent behavior rules |
| [langgraph-reference.md](langgraph-reference.md) | v1.0 | LangGraph patterns |

---

## Implementation Status

| Epic | Name | Status | Completed |
|------|------|--------|-----------|
| E1-E9 | MVP Phase | Complete | 2025-12-11 |
| E10 | Knowledge Graph Foundation | Complete | 2025-12-17 |
| E11 | Agent Context Engineering | Complete | 2025-12-18 |
| E12 | Production Readiness | In Progress | - |
| E13 | Agent Orchestration Optimization | Planned | - |

**Current Phase:** Production Readiness (E12-E13)

---

## Recent Updates

### 2026-01-15: Documentation Restructure

- **Phase 1 (Immediate):**
  - Updated `agent-behavior-spec.md` to v2.0 (reflects current implementation)
  - Closed Q&A as Skill change proposal (approved)
  - Archived legacy `AGENTS.md`

- **Phase 2 (Consolidation):**
  - Clarified CIM architecture docs (evaluation vs analysis)
  - Distinguished platform overview (stakeholder) vs index (developer)
  - Cross-referenced GCP guides (setup vs strategy)

- **Phase 3 (Structure):**
  - Created `docs/agent-system/` hub
  - Created `docs/cim-mvp/` hub
  - Created `docs/archived/` for superseded docs

- **Phase 4 (Index):**
  - Added `documentation-map.md` as central index
  - Added metadata headers to primary docs

- **Phase 5 (Consolidation):**
  - Created `docs/decisions/` for centralized change proposals
  - Consolidated 7 SCPs from 4 scattered locations
  - Updated `_bmad-output/README.md` with multi-stream structure

### 2026-01-06: Repository Cleanup

- Removed deprecated pgvector/embeddings code (E10.8 cleanup)
- Created [ADR-001](architecture-decisions/adr-001-graphiti-migration.md)
- Updated documentation versions

### 2025-12-17: E10 Knowledge Graph Foundation

- Architecture pivot: pgvector → Graphiti + Neo4j
- Voyage embeddings (1024d)
- Hybrid search with reranking

---

## BMAD Framework

This project uses BMAD (Build Mad Agentic Delivery) for AI-assisted development.

### BMAD Output Locations

| Artifact Type | Location |
|---------------|----------|
| Planning artifacts | `_bmad-output/planning-artifacts/` |
| Implementation artifacts | `_bmad-output/implementation-artifacts/` |
| Workflow status | `_bmad-output/planning-artifacts/bmm-workflow-status.yaml` |

### Active BMAD Streams

| Stream | Status | Description |
|--------|--------|-------------|
| Main Platform (E1-E13) | E12 In Progress | Primary development |
| Agent System v2.0 | Epic 3 Complete | BMAD cycle for agent work |
| CIM MVP | Active | Fast-track parallel development |

---

## Contributing

When adding documentation:

1. **Core docs** (PRD, Architecture) - Edit in place, update version
2. **Agent docs** - Add to `agent-system/` or `cim-mvp/`
3. **Sprint artifacts** - Add to `sprint-artifacts/`
4. **Superseded docs** - Move to `archived/`
5. **Update this README** when adding new folders
6. **Update [documentation-map.md](documentation-map.md)** for major changes
