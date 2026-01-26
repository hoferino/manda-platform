# GSD Planning State

---
status: Current
managed-by: GSD Workflow
last-updated: 2026-01-26
---

This directory contains **GSD (Get Stuff Done) workflow state**. Files here are managed by GSD commands and should not be manually edited.

## Files

| File | Purpose | Edit? |
|------|---------|-------|
| `PROJECT.md` | Current version, requirements, constraints | GSD-managed |
| `STATE.md` | Execution state (current phase, progress) | GSD-managed |
| `MILESTONES.md` | Completed milestone history with metrics | GSD-managed |

## GSD Commands

```bash
# Check current state
/gsd:progress          # Current milestone, phases, next action

# Work on tasks
/gsd:check-todos       # Pending work items
/gsd:execute-phase     # Execute current phase
/gsd:plan-phase        # Plan a phase before execution

# Milestone management
/gsd:new-milestone     # Start new milestone
/gsd:complete-milestone # Archive and move to next
```

## When to Use This Directory

| Scenario | Action |
|----------|--------|
| Check current project state | Read `PROJECT.md` |
| Understand what's in progress | Read `STATE.md` |
| Review completed work | Read `MILESTONES.md` |
| Modify project state | Use GSD commands, not manual edits |

## Relationship to Other Directories

| Directory | Purpose | Relationship |
|-----------|---------|--------------|
| `.planning/` | GSD execution state | **This directory** |
| `_bmad-output/` | BMAD workflow artifacts | Historical planning context |
| `docs/sprint-artifacts/` | Completed sprint work | Stories moved here after completion |
| `docs/features/` | Feature documentation | Final home for feature docs |

## Do Not Manually Edit

These files are designed to be modified by GSD workflow commands. Manual edits may cause state inconsistencies or be overwritten by future GSD operations.

If you need to make corrections:
1. Use the appropriate GSD command
2. Or document the issue and let GSD handle the update
