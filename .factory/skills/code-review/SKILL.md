---
name: code-review
description: Perform an adversarial senior dev review that finds concrete issues and syncs sprint status.
---

# Code Review (BMAD-aligned)

## When to use
- Story status is set to `review` in the story file or sprint-status.

## Inputs
- Target story file in `docs/sprint-artifacts/stories/`
- `docs/sprint-artifacts/sprint-status.yaml`
- Architecture/standards docs referenced in the story

## Steps
1. Load the story file and resolve epic/story IDs and status.
2. Load architecture/UX/tech specs relevant to the story.
3. Run the review checklist (`checklist.md`) to drive findings (3–10 issues minimum).
4. Cross-check ACs vs implementation/tests; validate File List completeness.
5. Document review notes under the story’s review section and set outcome (Approve/Changes Requested/Blocked).
6. Sync sprint-status.yaml if status changes.
7. Capture decisions/debt via memory hook (`#decision:`, `#debt:`).

## Checklist
- Use `checklist.md` for validation steps and coverage.
- Ensure security and regression risks are explicitly assessed.
