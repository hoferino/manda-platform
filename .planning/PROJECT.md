# Documentation Consolidation

## What This Is

Consolidate scattered documentation into `docs/features/` with topic subfolders for agent-v2, knowledge-graph, and cim-builder. Review each doc to determine if it's current (move) or outdated (archive). Create a clear structure where developers know exactly where to find current planning docs.

## Core Value

Single source of truth per topic — clear where to find current docs, no confusion about what's active vs historical.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Create `docs/features/` directory structure with topic subfolders
- [ ] Curate agent-v2 docs — review scattered files, consolidate current ones to `docs/features/agent-v2/`
- [ ] Curate knowledge-graph docs — review scattered files, consolidate to `docs/features/knowledge-graph/`
- [ ] Curate cim-builder docs — review scattered files, consolidate to `docs/features/cim-builder/`
- [ ] Create README for each topic folder explaining what's there
- [ ] Create top-level `docs/features/README.md` explaining the structure

### Out of Scope

- Updating content of core docs (manda-prd.md, manda-architecture.md) — separate work
- Deleting `_bmad-output/` — keep as historical reference
- Reorganizing non-feature docs (testing, deployment, etc.) — not in scope

## Context

**Current state:**
- Documentation scattered between `docs/` and `_bmad-output/`
- Three major initiative areas with docs in multiple locations:
  - **Agent v2:** `_bmad-output/planning-artifacts/agent-system-*.md`, `docs/agent-behavior-spec.md`, `docs/agent-framework-strategy.md`, `docs/agent-system/`
  - **Knowledge Graph:** `_bmad-output/planning-artifacts/dynamic-kg-pipeline/`, `docs/dynamic-knowledge-graph-pipeline-plan.md`
  - **CIM Builder:** `_bmad-output/planning-artifacts/cim-*.md`, `docs/cim-mvp/`
- Some docs may be outdated ideas vs current plans
- Core docs at `docs/` root (manda-prd.md, architecture, epics) stay in place

**Target state:**
```
docs/
  manda-prd.md (unchanged)
  manda-architecture.md (unchanged)
  epics.md (unchanged)
  features/
    README.md
    agent-v2/
      README.md
      [current docs]
    knowledge-graph/
      README.md
      [current docs]
    cim-builder/
      README.md
      [current docs]
```

## Constraints

- **Preserve history**: Keep `_bmad-output/` as historical reference, don't delete
- **No content rewrites**: Just reorganize and curate, don't rewrite docs
- **Core docs untouched**: Root-level docs (PRD, architecture) stay as-is

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Consolidate to docs/features/ | Standard location, already has core docs | — Pending |
| Keep _bmad-output/ | Valuable historical reference for past decisions | — Pending |
| Curate as we go | Better than just moving files — ensures we know what's current | — Pending |

---
*Last updated: 2026-01-20 after initialization*
