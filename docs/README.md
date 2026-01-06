# Manda Platform Documentation

**Last Updated:** 2026-01-06

This directory contains all documentation for the Manda M&A Intelligence Platform.

---

## Quick Links

| Document | Description | Version |
|----------|-------------|---------|
| [manda-prd.md](manda-prd.md) | Product Requirements Document | v2.4 |
| [manda-architecture.md](manda-architecture.md) | Technical Architecture | v4.2 |
| [epics.md](epics.md) | Epic and Story Breakdown | v2.5 |
| [ux-design-specification.md](ux-design-specification.md) | UX Design Specification | - |
| [testing/testing-guide.md](testing/testing-guide.md) | Testing & Operations Guide | - |

---

## Documentation Structure

```
docs/
├── README.md                     # This file - documentation index
│
├── manda-prd.md                  # Product Requirements Document
├── manda-architecture.md         # Technical Architecture
├── epics.md                      # Epic and Story Breakdown
├── ux-design-specification.md    # UX Design Specification
│
├── testing/                      # Testing & Operations
│   └── testing-guide.md          # Consolidated testing guide
│
├── sprint-artifacts/             # Sprint Development Artifacts
│   ├── sprint-status.yaml        # Current sprint tracking
│   ├── tech-specs/               # Technical specifications per epic
│   ├── epics/                    # Epic definitions
│   ├── stories/                  # User story files
│   ├── retrospectives/           # Epic retrospectives
│   └── features/                 # Feature documentation
│
├── architecture-decisions/       # Architecture Decision Records (ADRs)
│
├── diagrams/                     # Architecture diagrams
└── deployment/                   # Deployment configuration
```

---

## Core Documentation

### 1. Product Requirements Document (PRD)

**File:** [manda-prd.md](manda-prd.md)

The PRD defines what we're building and why. It includes:
- Product vision and strategy
- User personas and journeys
- Functional requirements (FR-*)
- Non-functional requirements (NFR-*)
- Implementation status by epic

### 2. Architecture Document

**File:** [manda-architecture.md](manda-architecture.md)

The architecture document defines how we're building it:
- Technology decisions and rationale
- System architecture (microservices pattern)
- Data flow and processing pipeline
- Database schemas (PostgreSQL, Neo4j)
- API specifications
- Security model

### 3. Epic and Story Breakdown

**File:** [epics.md](epics.md)

Complete breakdown of all epics and stories:
- 13 epics total (E1-E13)
- E1-E11 complete, E12-E13 in progress
- Acceptance criteria in BDD format
- FR traceability mapping

### 4. UX Design Specification

**File:** [ux-design-specification.md](ux-design-specification.md)

Visual and interaction design:
- Screen layouts and wireframes
- Component specifications
- Navigation patterns
- Design system tokens

---

## Development Resources

### Testing & Operations Guide

**File:** [testing/testing-guide.md](testing/testing-guide.md)

Everything you need to run and test the platform:
- Environment setup
- Service configuration
- Document processing pipeline
- Testing procedures
- Troubleshooting guide
- Test results summary

### Sprint Artifacts

**Directory:** [sprint-artifacts/](sprint-artifacts/)

Active development artifacts:
- **[tech-specs/](sprint-artifacts/tech-specs/)** - Technical specifications for each epic
- **[stories/](sprint-artifacts/stories/)** - Individual user story files
- **[retrospectives/](sprint-artifacts/retrospectives/)** - Epic retrospectives
- **[epics/](sprint-artifacts/epics/)** - Epic definition files

---

## Implementation Status

| Epic | Name | Status | Stories | Completed |
|------|------|--------|---------|-----------|
| E1 | Project Foundation | Complete | 9/9 | 2025-11-25 |
| E2 | Document Ingestion & Storage | Complete | 8/8 | 2025-11-26 |
| E3 | Intelligent Document Processing | Complete | 9/9 | 2025-11-28 |
| E4 | Collaborative Knowledge Workflow | Complete | 13/13 | 2025-11-30 |
| E5 | Conversational Assistant | Complete | 9/9 | 2025-12-02 |
| E6 | IRL Management & Auto-Generation | Complete | 7/7 | 2025-12-04 |
| E7 | Learning Loop | Complete | 6/6 | 2025-12-08 |
| E8 | Q&A Co-Creation Workflow | Complete | 7/7 | 2025-12-09 |
| E9 | CIM Builder | Complete | 15/15 | 2025-12-11 |
| E10 | Knowledge Graph Foundation | Complete | 8/8 | 2025-12-17 |
| E11 | Agent Context Engineering | Complete | 7/7 | 2025-12-18 |
| E12 | Production Readiness | In Progress | 7/11 | - |
| E13 | Agent Orchestration Optimization | Planned | 0/7 | - |

**Current Phase:** Production Readiness (E12-E13)

---

## Recent Updates

### 2026-01-06: Repository Cleanup
- Removed deprecated pgvector/embeddings code (E10.8 cleanup)
- Deleted archive directories (obsolete planning and test docs)
- Created [ADR-001](architecture-decisions/adr-001-graphiti-migration.md) documenting E10 architecture decisions
- Updated documentation versions and epic status

### 2025-12-17: E10 Knowledge Graph Foundation
- Major architecture pivot: pgvector → Graphiti + Neo4j
- Voyage embeddings replace OpenAI (1024d vs 3072d)
- Hybrid search with reranking (20-35% accuracy improvement)
- See [Sprint Change Proposal 2025-12-15](sprint-change-proposal-2025-12-15.md)

### 2025-12-13: Documentation Consolidation
- Consolidated test documents into [testing/testing-guide.md](testing/testing-guide.md)
- Reorganized tech specs into [sprint-artifacts/tech-specs/](sprint-artifacts/tech-specs/)

---

## BMAD Framework

This project uses the BMAD (Build Mad Agentic Delivery) framework for AI-assisted development.

**Key Resources:**
- [bmad/bmm/docs/quick-start.md](../bmad/bmm/docs/quick-start.md) - Getting started
- [bmad/bmm/docs/agents-guide.md](../bmad/bmm/docs/agents-guide.md) - Agent documentation
- [bmad/bmm/docs/workflows-analysis.md](../bmad/bmm/docs/workflows-analysis.md) - Workflow reference

---

## Contributing

When adding or updating documentation:

1. **Core docs** (PRD, Architecture, Epics, UX) - Edit in place, update version number
2. **Sprint artifacts** - Add to appropriate subfolder
3. **Test documentation** - Update [testing/testing-guide.md](testing/testing-guide.md)
4. **Historical docs** - Move to [archive/](archive/) when superseded

Always update this README when adding new documentation files.
