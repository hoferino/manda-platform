# CIM MVP Workflow Fix - Stories for Ralph Wiggum

This directory contains stories for autonomous implementation using the [Ralph Wiggum plugin](https://github.com/anthropics/claude-code/tree/main/plugins/ralph-wiggum).

## Overview

These stories implement a structured, checklist-based workflow for the CIM MVP agent. See [PRD.md](./PRD.md) for full context.

## Story Execution Order

Stories must be executed sequentially as each depends on the previous:

| # | Story | File(s) | Max Iterations | Promise |
|---|-------|---------|----------------|---------|
| 1 | [State Schema](./story-01-state-schema.md) | `state.ts` | 15 | `STATE_SCHEMA_COMPLETE` |
| 2 | [Tools](./story-02-tools.md) | `tools.ts` | 20 | `TOOLS_COMPLETE` |
| 3 | [Prompts](./story-03-prompts.md) | `prompts.ts` | 15 | `PROMPTS_COMPLETE` |
| 4 | [Graph Flow](./story-04-graph.md) | `graph.ts` | 15 | `GRAPH_COMPLETE` |
| 5 | [API Route](./story-05-api-route.md) | `route.ts` | 15 | `API_ROUTE_COMPLETE` |
| 6 | [UI Hook](./story-06-hook.md) | `useCIMMVPChat.ts` | 15 | `HOOK_COMPLETE` |
| 7 | [Outline Tree](./story-07-outline-tree.md) | `SourcesPanel/` | 20 | `OUTLINE_TREE_COMPLETE` |
| 8 | [Thumbnails](./story-08-thumbnails.md) | `PreviewPanel.tsx` | 15 | `THUMBNAILS_COMPLETE` |
| 9 | [Wireframes](./story-09-wireframe.md) | `PreviewPanel/` | 25 | `WIREFRAME_COMPLETE` |
| 10 | [Integration](./story-10-integration.md) | `CIMBuilderPage.tsx` | 20 | `INTEGRATION_COMPLETE` |

## Quick Start

### Prerequisites

1. Install Ralph Wiggum plugin:
   ```bash
   /plugin ralph
   ```

2. Ensure you're on the correct branch:
   ```bash
   git checkout cim-mvp-workflow-fix
   ```

3. Verify environment:
   ```bash
   cd manda-app && npm install
   ```

### Running Stories

Copy and paste each Ralph command from the story files, or use these quick commands:

```bash
# Story 1
/ralph-loop "Implement Story 1 from docs/sprint-artifacts/stories/cim-mvp-workflow/story-01-state-schema.md. Read the story file, implement all tasks, run type-check. Output <promise>STATE_SCHEMA_COMPLETE</promise> when done." --max-iterations 15 --completion-promise "STATE_SCHEMA_COMPLETE"

# Story 2
/ralph-loop "Implement Story 2 from docs/sprint-artifacts/stories/cim-mvp-workflow/story-02-tools.md. Read the story file, implement all tasks, run type-check. Output <promise>TOOLS_COMPLETE</promise> when done." --max-iterations 20 --completion-promise "TOOLS_COMPLETE"

# Story 3
/ralph-loop "Implement Story 3 from docs/sprint-artifacts/stories/cim-mvp-workflow/story-03-prompts.md. Read the story file, implement all tasks, run type-check. Output <promise>PROMPTS_COMPLETE</promise> when done." --max-iterations 15 --completion-promise "PROMPTS_COMPLETE"

# Story 4
/ralph-loop "Implement Story 4 from docs/sprint-artifacts/stories/cim-mvp-workflow/story-04-graph.md. Read the story file, implement all tasks, run type-check. Output <promise>GRAPH_COMPLETE</promise> when done." --max-iterations 15 --completion-promise "GRAPH_COMPLETE"

# Story 5
/ralph-loop "Implement Story 5 from docs/sprint-artifacts/stories/cim-mvp-workflow/story-05-api-route.md. Read the story file, implement all tasks, run type-check. Output <promise>API_ROUTE_COMPLETE</promise> when done." --max-iterations 15 --completion-promise "API_ROUTE_COMPLETE"

# Story 6
/ralph-loop "Implement Story 6 from docs/sprint-artifacts/stories/cim-mvp-workflow/story-06-hook.md. Read the story file, implement all tasks, run type-check. Output <promise>HOOK_COMPLETE</promise> when done." --max-iterations 15 --completion-promise "HOOK_COMPLETE"

# Story 7
/ralph-loop "Implement Story 7 from docs/sprint-artifacts/stories/cim-mvp-workflow/story-07-outline-tree.md. Read the story file, implement all tasks, run type-check. Output <promise>OUTLINE_TREE_COMPLETE</promise> when done." --max-iterations 20 --completion-promise "OUTLINE_TREE_COMPLETE"

# Story 8
/ralph-loop "Implement Story 8 from docs/sprint-artifacts/stories/cim-mvp-workflow/story-08-thumbnails.md. Read the story file, implement all tasks, run type-check. Output <promise>THUMBNAILS_COMPLETE</promise> when done." --max-iterations 15 --completion-promise "THUMBNAILS_COMPLETE"

# Story 9
/ralph-loop "Implement Story 9 from docs/sprint-artifacts/stories/cim-mvp-workflow/story-09-wireframe.md. Read the story file, implement all tasks, run type-check. Output <promise>WIREFRAME_COMPLETE</promise> when done." --max-iterations 25 --completion-promise "WIREFRAME_COMPLETE"

# Story 10
/ralph-loop "Implement Story 10 from docs/sprint-artifacts/stories/cim-mvp-workflow/story-10-integration.md. Read the story file, implement all tasks, run type-check AND build. Output <promise>INTEGRATION_COMPLETE</promise> when done." --max-iterations 20 --completion-promise "INTEGRATION_COMPLETE"
```

### After All Stories Complete

1. **Manual verification:**
   ```bash
   cd manda-app && npm run dev
   ```
   - Create a new CIM
   - Test workflow progression
   - Verify outline tree
   - Verify slide wireframes

2. **Run tests:**
   ```bash
   cd manda-app && npm run test:run
   ```

3. **Create PR:**
   ```bash
   git add -A
   git commit -m "feat(cim-mvp): implement workflow-based CIM creation"
   git push -u origin cim-mvp-workflow-fix
   ```

## Safety Notes

- Always set `--max-iterations` to prevent runaway loops
- Run in sandboxed environment if possible
- Monitor token usage
- Review changes after each story before proceeding

## Reference

- [Tech Spec](../../tech-specs/cim-mvp-workflow-fix.md)
- [CIM Workflow Guide](../../../../cim-workflow/cim-workflow.md)
- [Ralph Wiggum Plugin](https://github.com/anthropics/claude-code/tree/main/plugins/ralph-wiggum)
