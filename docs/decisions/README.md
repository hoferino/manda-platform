# Decision Log

---
title: Decision Log
version: 1.1
status: Current
purpose: Central index of all sprint change proposals and architectural decisions
last-updated: 2026-01-25
---

This folder contains all sprint change proposals and major decisions made during development. Change proposals document pivots, scope changes, and architectural decisions that impact the project.

## Decision Index

| Date | ID | Title | Status | Implemented | Scope | Impact |
|------|-----|-------|--------|-------------|-------|--------|
| 2025-12-11 | SCP-001 | [IRL Feature UX Pivot](sprint-change-proposal-2025-12-11.md) | **Approved** | ✅ E6 | Minor | E6 UX changes |
| 2025-12-14 | SCP-002 | [PRD/Architecture Refinements](sprint-change-proposal-2025-12-14.md) | **Approved** | ✅ E9/E10 | Minor | PRD v2.3, E9/E10 scope |
| 2025-12-15 | SCP-003 | [Knowledge Architecture Evolution](sprint-change-proposal-2025-12-15.md) | **Approved** | ✅ E10 | **Major** | E10 pgvector→Graphiti pivot |
| 2026-01-05 | SCP-004 | [Fast Path Document Retrieval](sprint-change-proposal-2026-01-05.md) | Pending | ⏳ | Minor | Document query timing |
| 2026-01-10 | SCP-005 | [Redis Postponement](sprint-change-proposal-2026-01-10.md) | **Approved** | ✅ Deferred | Minor | Deferred Redis requirement |
| 2026-01-10 | CP-001 | [Q&A as Cross-Cutting Skill](change-proposal-qa-as-skill-2026-01-10.md) | **Approved** | ✅ E11 | Minor | Q&A model change |
| 2026-01-11 | SCP-006 | [CIM MVP Fast Track](sprint-change-proposal-2026-01-11.md) | Draft | ✅ CIM MVP | Moderate | Parallel CIM MVP track |

## Decision Types

| Prefix | Type | Description |
|--------|------|-------------|
| `SCP-` | Sprint Change Proposal | Scope changes, pivots, bug-driven changes |
| `CP-` | Change Proposal | Model/design changes within BMAD workflow |
| `ADR-` | Architecture Decision Record | Technical architecture decisions |

## Key Decisions by Category

### Architecture

| Decision | Date | Summary |
|----------|------|---------|
| SCP-003 | 2025-12-15 | **E10 Pivot**: pgvector → Graphiti + Neo4j, Voyage embeddings |
| [ADR-001](../architecture-decisions/adr-001-graphiti-migration.md) | 2025-12-15 | Formal ADR documenting E10 architecture |
| [ADR-002](../architecture-decisions/adr-002-convex-cim-state.md) | 2026-01-25 | **Convex for CIM State**: Real-time workflow state, cascade invalidation |

### Product/UX

| Decision | Date | Summary |
|----------|------|---------|
| SCP-001 | 2025-12-11 | IRL is single per project, decoupled from folders |
| SCP-002 | 2025-12-14 | PRD language refinement, CIM Builder spike rewrite |
| CP-001 | 2026-01-10 | Q&A repositioned as cross-cutting tool, not workflow mode |

### Development Process

| Decision | Date | Summary |
|----------|------|---------|
| SCP-005 | 2026-01-10 | Redis deferred - in-memory cache sufficient for now |
| SCP-006 | 2026-01-11 | CIM MVP parallel track for faster user feedback |

## Status Legend

| Status | Meaning |
|--------|---------|
| **Approved** | Decision accepted and implemented/in-progress |
| **Pending** | Awaiting review/approval |
| **Draft** | Proposal in development |
| **Rejected** | Decision not accepted (with rationale) |

| Implemented | Meaning |
|-------------|---------|
| ✅ E{n} | Fully implemented in epic |
| ✅ CIM MVP | Implemented in CIM MVP track |
| ✅ Deferred | Deliberately postponed |
| ⏳ | Pending implementation |

## Creating a New Decision

When proposing a change:

1. Create file: `sprint-change-proposal-YYYY-MM-DD.md` or `change-proposal-{topic}-YYYY-MM-DD.md`
2. Use the standard template (see existing proposals)
3. Include:
   - Problem statement
   - Impact analysis (epics, stories, artifacts)
   - Proposed solution
   - Risk assessment
4. Add entry to this index
5. Update status when approved/rejected

## Related Documentation

- **[Architecture Decisions (ADRs)](../architecture-decisions/)** - Formal architectural decision records
- **[Documentation Hub](../README.md)** - Full documentation index
- **[Sprint Artifacts](../sprint-artifacts/)** - Implementation artifacts
