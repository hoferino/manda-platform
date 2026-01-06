---
name: dev-story
description: Implement a story with BMAD Definition of Done checks, tests, and sprint tracking updates.
---

# Dev Story (BMAD-aligned)

## When to use
- Story is marked ready-for-dev in `docs/sprint-artifacts/sprint-status.yaml` or story file.

## Inputs
- Target story file in `docs/sprint-artifacts/stories/`
- `docs/sprint-artifacts/sprint-status.yaml`
- Architecture/tech specs referenced in the story Dev Notes
- Testing conventions in `.factory/rules/testing.md`

## Steps
1. Load the story file and ensure ACs and tasks are clear.
2. Implement tasks/subtasks with tests first when feasible.
3. Update the story file sections only where allowed: Tasks/Subtasks, Dev Agent Record, File List, Change Log/Status.
4. Run the Definition of Done checklist (`checklist.md`) before marking complete.
5. Update status to `review` in both the story file and sprint-status.yaml.
6. Capture decisions or debt via memory hook (`#decision:`, `#debt:`) into project memory.

## Checklist
- Follow `checklist.md` for the Definition of Done and quality gates.
- Ensure File List lists every changed file.
- Ensure tests cover ACs and edge cases.
