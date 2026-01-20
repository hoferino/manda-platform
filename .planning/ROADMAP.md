# Roadmap: Documentation Consolidation

**Created:** 2026-01-20
**Core Value:** Single source of truth per topic

## Overview

| Phase | Name | Goal | Requirements |
|-------|------|------|--------------|
| 1 | Create Structure | Set up docs/features/ directory structure | STRUCT-01, STRUCT-02, STRUCT-03 |
| 2 | Curate Feature Docs | Move current docs to features/, archive outdated | AGT-01, AGT-02, KG-01, KG-02, CIM-01, CIM-02 |
| 3 | Clean Core Docs | Remove outdated sections from PRD and architecture | CORE-01, CORE-02 |

---

## Phase 1: Create Structure

**Goal:** Set up the docs/features/ directory structure with READMEs

**Requirements:**
- STRUCT-01: Create `docs/features/` directory with subfolders
- STRUCT-02: Create `docs/features/README.md`
- STRUCT-03: Create README.md in each topic subfolder

**Success Criteria:**
1. `docs/features/` exists with agent-v2/, knowledge-graph/, cim-builder/ subfolders
2. Each folder has a README.md explaining its purpose
3. Top-level README explains the features/ structure

---

## Phase 2: Curate Feature Docs

**Goal:** Review scattered docs, consolidate current ones to features/, identify what's outdated

**Requirements:**
- AGT-01, AGT-02: Agent v2 docs
- KG-01, KG-02: Knowledge graph docs
- CIM-01, CIM-02: CIM builder docs

**Success Criteria:**
1. Agent v2 current docs consolidated to `docs/features/agent-v2/`
2. Knowledge graph current docs consolidated to `docs/features/knowledge-graph/`
3. CIM builder current docs consolidated to `docs/features/cim-builder/`
4. Each folder's README lists what's there and what's current vs historical
5. No duplication between `_bmad-output/` and `docs/features/`

**Source files to review:**

Agent v2:
- `_bmad-output/planning-artifacts/agent-system-prd.md`
- `_bmad-output/planning-artifacts/agent-system-architecture.md`
- `_bmad-output/planning-artifacts/agent-system-epics.md`
- `docs/agent-behavior-spec.md`
- `docs/agent-framework-strategy.md`
- `docs/agent-system/README.md`

Knowledge Graph:
- `_bmad-output/planning-artifacts/dynamic-kg-pipeline/` (PRD, ADR, epic, stories)
- `docs/dynamic-knowledge-graph-pipeline-plan.md`

CIM Builder:
- `_bmad-output/planning-artifacts/cim-builder-architecture-evaluation.md`
- `_bmad-output/planning-artifacts/cim-subgraph-architecture.md`
- `_bmad-output/planning-artifacts/cim-mvp-caching-fix-plan.md`
- `docs/cim-mvp/README.md`

---

## Phase 3: Clean Core Docs

**Goal:** Remove outdated sections from manda-prd.md and manda-architecture.md

**Requirements:**
- CORE-01: Review and clean manda-prd.md
- CORE-02: Review and clean manda-architecture.md

**Success Criteria:**
1. manda-prd.md contains only current/accurate information
2. manda-architecture.md contains only current/accurate information
3. Removed sections documented (what was removed and why)
4. No broken internal references after cleanup

---

## Progress

| Phase | Status | Completion |
|-------|--------|------------|
| 1 | Pending | 0% |
| 2 | Pending | 0% |
| 3 | Pending | 0% |

---
*Roadmap created: 2026-01-20*
