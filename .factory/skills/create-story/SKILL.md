---
name: create-story
description: Create the next ready-for-dev story using BMAD-style disaster-prevention checklists and update sprint tracking.
---

# Create Story (BMAD-aligned)

## When to use
- When a new story is needed from the active epic in `docs/sprint-artifacts/sprint-status.yaml`.
- When an epic is contexted but the next story is not yet ready-for-dev.

## Inputs
- `docs/sprint-artifacts/sprint-status.yaml` (source of active epic/story status)
- `docs/sprint-artifacts/epics/` (epic context, ACs, constraints)
- `docs/manda-architecture.md`, `docs/manda-prd.md`, relevant tech specs
- Previous story files in `docs/sprint-artifacts/stories/` for learnings

## Steps
1. Load sprint-status to locate the active epic and determine the next story key.
2. Load the epic file plus relevant tech spec/architecture/UX references.
3. Re-run the BMAD story creation checklist (`checklist.md`) to prevent missing requirements.
4. Generate a story using `template.md` with:
   - Clear Acceptance Criteria
   - Tasks/Subtasks mapped to ACs
   - Dev Notes with architecture constraints, paths to touch, testing expectations
5. Save to `docs/sprint-artifacts/stories/{story_key}.md` (or the epic’s story path).
6. Update `docs/sprint-artifacts/sprint-status.yaml` with the new story status (ready-for-dev) and metadata.
7. Record any decisions or debt via the memory hook (`#decision:` / `#debt:`).

## Checklist
- Always consult `checklist.md` before finalizing the story.
- Include references to the sources used (epic/architecture/tech spec paths).
- Ensure token-efficient, unambiguous Dev Notes.
