# Manda Platform Documentation

**Last Updated:** 2025-12-13

This directory contains all documentation for the Manda M&A Intelligence Platform.

---

## Quick Links

| Document | Description | Version |
|----------|-------------|---------|
| [manda-prd.md](manda-prd.md) | Product Requirements Document | v1.9 |
| [manda-architecture.md](manda-architecture.md) | Technical Architecture | v3.3 |
| [epics.md](epics.md) | Epic and Story Breakdown | v2.3 |
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
│   ├── testing-guide.md          # Consolidated testing guide
│   └── archive/                  # Historical test reports
│
├── sprint-artifacts/             # Sprint Development Artifacts
│   ├── sprint-status.yaml        # Current sprint tracking
│   ├── tech-specs/               # Technical specifications per epic
│   ├── epics/                    # Epic definitions
│   ├── stories/                  # User story files
│   ├── retrospectives/           # Epic retrospectives
│   └── features/                 # Feature documentation
│
├── archive/                      # Historical Documents
│   ├── planning/                 # Old planning docs
│   └── sessions/                 # Session handoffs
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
- 9 MVP epics (E1-E9)
- 86 total stories
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

| Epic | Name | Status | Stories |
|------|------|--------|---------|
| E1 | Project Foundation | Complete | 9/9 |
| E2 | Document Ingestion & Storage | Complete | 8/8 |
| E3 | Intelligent Document Processing | Complete | 9/9 |
| E4 | Collaborative Knowledge Workflow | Complete | 13/13 |
| E5 | Conversational Assistant | Complete | 8/9 |
| E6 | IRL Management & Auto-Generation | Complete | 7/7 |
| E7 | Learning Loop | Backlog | 0/6 |
| E8 | Q&A Co-Creation Workflow | Backlog | 0/8 |
| E9 | CIM Builder | Backlog | 0/15 |

**Current Phase:** Testing & Stabilization

---

## Recent Updates

### 2025-12-13: Documentation Consolidation
- Consolidated 12 test documents into single [testing-guide.md](testing/testing-guide.md)
- Archived obsolete planning documents to [archive/](archive/)
- Reorganized tech specs into [sprint-artifacts/tech-specs/](sprint-artifacts/tech-specs/)
- Cleaned up BMAD module duplicates
- Updated README with current versions

### 2025-12-12: Testing Sprint
- Manual testing of document processing pipeline
- Fixed pg-boss schema issues
- Configured Gemini 2.5 Flash for analysis
- Verified upload → parse → embed flow

### 2025-12-11: IRL Feature Updates
- Intelligent Excel parser (v2.7)
- IRL UX pivot proposal
- Project creation wizard enhancements

---

## Archive

Historical documents that are no longer actively maintained:

### Planning Archive ([archive/planning/](archive/planning/))
- `brainstorming-session-results-2025-11-19.md` - Initial brainstorming
- `validation-report-2025-11-19.md` - Planning validation
- `implementation-readiness-report-*.md` - Readiness reports
- `frontend-development-plan.md` - Original Lovable.dev approach (not used)

### Session Archive ([archive/sessions/](archive/sessions/))
- `session-handoff-*.md` - Development session notes
- `architecture-updates-*.md` - Incremental architecture changes

### Test Archive ([testing/archive/](testing/archive/))
- Historical test reports and debugging notes
- Consolidated into [testing-guide.md](testing/testing-guide.md)

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
