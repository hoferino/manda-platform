# Documentation Conventions

This file helps Claude understand where to put and find documentation.

## Where Things Go

| Content | Location | Notes |
|---------|----------|-------|
| **Decisions** | `docs/decisions/` | SCP/CP/ADR format |
| **Features** | `docs/features/{name}/` | Per-feature docs |
| **Sprint Work** | `docs/sprint-artifacts/` | Stories, tech specs |
| **Planning** | `_bmad-output/` | During development |
| **Active Milestone** | `.planning/PROJECT.md` | GSD-managed |

## Status Indicators

Use YAML frontmatter in documentation files:

```yaml
---
status: Current | In-Progress | Historical | Archived
last-updated: YYYY-MM-DD
implements: E9, E10  # Epic references
---
```

## Archival Policy

| When | Action |
|------|--------|
| After feature completion | Update `docs/features/{name}/` |
| After sprint | Mark `_bmad-output/` stories as Historical |
| After milestone | Archive to `.planning/milestones/` |

## Navigation

| Starting Point | Use For |
|----------------|---------|
| `documentation-map.md` | Full index of all docs |
| `decisions/README.md` | Decision history |
| `.planning/PROJECT.md` | Current project state |
| `.planning/MILESTONES.md` | Completed milestone history |
| `claude-md-hierarchy.md` | How CLAUDE.md files work (human reference) |

## Decision Types

| Prefix | Type | When to Use |
|--------|------|-------------|
| `SCP-` | Sprint Change Proposal | Scope changes, pivots |
| `CP-` | Change Proposal | Model/design changes |
| `ADR-` | Architecture Decision Record | Technical architecture |

## Creating Documentation

### New Feature Doc

```
docs/features/{feature-name}/
  README.md           # Overview, status
  architecture.md     # Technical details (if complex)
  usage.md            # How to use (if user-facing)
```

### New Decision

1. Create `docs/decisions/{type}-{topic}-YYYY-MM-DD.md`
2. Add entry to `docs/decisions/README.md`
3. Update status when approved/rejected
