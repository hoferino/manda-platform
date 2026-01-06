---
name: sprint-status
description: Inspect or update sprint-status.yaml to reflect current story/epic states.
---

# Sprint Status

## When to use
- Before starting a story to confirm active epic and statuses.
- After story progress changes (ready-for-dev → in-progress → review → done).

## Steps
1. Load `docs/sprint-artifacts/sprint-status.yaml`.
2. Locate the relevant epic/story entries and update state, timestamps, and notes.
3. Keep statuses consistent between story files and sprint-status.
4. If changes affect planning, capture a `#decision:` in project memory.

## Notes
- Do not alter historical completed items except to fix inaccuracies.
- Follow existing YAML structure and keys.
