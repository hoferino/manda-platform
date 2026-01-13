# Story 4: Graph Flow Updates

**File:** `manda-app/lib/agent/cim-mvp/graph.ts`
**Completion Promise:** `GRAPH_COMPLETE`
**Max Iterations:** 15

---

## Overview

Update the LangGraph postToolNode to handle the new tool results. Each tool returns a JSON object with specific keys that postToolNode must process to update state.

## Dependencies

- Story 1 (State Schema) must be complete
- Story 2 (Tools) must be complete

## Tasks

- [ ] 4.1 Update `postToolNode` to handle `advance_workflow` results
  - Check for `advancedWorkflow: true` in result
  - Update workflowProgress.currentStage
  - Add previous stage to completedStages

- [ ] 4.2 Update `postToolNode` to handle `save_buyer_persona` results
  - Check for `buyerPersona` key in result
  - Return buyerPersona for state merge

- [ ] 4.3 Update `postToolNode` to handle `save_hero_concept` results
  - Check for `heroContext` key in result
  - Return heroContext for state merge

- [ ] 4.4 Update `postToolNode` to handle `create_outline` results
  - Check for `cimOutline` key in result
  - Check for `sectionDividerSlides` array
  - Initialize sectionProgress for each section
  - Return cimOutline, allSlideUpdates (with divider slides), workflowProgress

- [ ] 4.5 Update `postToolNode` to handle `update_outline` results
  - Check for `cimOutline` key in result
  - Handle add/remove/reorder actions
  - Update sectionProgress accordingly

- [ ] 4.6 Update `postToolNode` to handle `start_section` results
  - Check for `currentSectionId` key in result
  - Update workflowProgress.currentSectionId
  - Update sectionProgress status to 'content_development'

- [ ] 4.7 Update `postToolNode` to handle enhanced `update_slide` with layouts
  - Check for `layoutType` in result (new field)
  - Include layoutType in SlideUpdate
  - Handle both old format (backward compat) and new format

- [ ] 4.8 Ensure state updates properly merge with reducers
  - workflowProgress should use default reducer (replace)
  - buyerPersona should use default reducer (replace)
  - heroContext should use default reducer (replace)
  - cimOutline should use default reducer (replace)
  - allSlideUpdates should use merge reducer (by slideId)

- [ ] 4.9 Run `npm run type-check` - must pass with no errors

## postToolNode Structure

```typescript
async function postToolNode(
  state: CIMMVPStateType
): Promise<Partial<CIMMVPStateType>> {
  const lastMessage = state.messages[state.messages.length - 1]

  if (lastMessage && 'content' in lastMessage) {
    const content = lastMessage.content
    if (typeof content === 'string') {
      try {
        const result = JSON.parse(content)
        const updates: Partial<CIMMVPStateType> = {}

        // Handle advance_workflow
        if (result.advancedWorkflow && result.targetStage) {
          updates.workflowProgress = {
            ...state.workflowProgress,
            currentStage: result.targetStage,
            completedStages: [
              ...state.workflowProgress.completedStages,
              state.workflowProgress.currentStage
            ].filter((v, i, a) => a.indexOf(v) === i) // dedupe
          }
        }

        // Handle save_buyer_persona
        if (result.buyerPersona) {
          updates.buyerPersona = result.buyerPersona
        }

        // Handle save_hero_concept
        if (result.heroContext) {
          updates.heroContext = result.heroContext
        }

        // Handle create_outline
        if (result.cimOutline) {
          updates.cimOutline = result.cimOutline
          // Initialize section progress
          const sectionProgress: Record<string, SectionProgress> = {}
          for (const section of result.cimOutline.sections) {
            sectionProgress[section.id] = {
              sectionId: section.id,
              status: 'pending',
              slides: []
            }
          }
          updates.workflowProgress = {
            ...state.workflowProgress,
            ...(updates.workflowProgress || {}),
            sectionProgress
          }
        }

        // Handle section divider slides
        if (result.sectionDividerSlides) {
          updates.allSlideUpdates = result.sectionDividerSlides
        }

        // Handle start_section
        if (result.currentSectionId) {
          updates.workflowProgress = {
            ...state.workflowProgress,
            ...(updates.workflowProgress || {}),
            currentSectionId: result.currentSectionId
          }
          // Update section status
          if (updates.workflowProgress?.sectionProgress) {
            updates.workflowProgress.sectionProgress[result.currentSectionId] = {
              ...updates.workflowProgress.sectionProgress[result.currentSectionId],
              status: 'content_development'
            }
          }
        }

        // Handle slide update (existing + enhanced)
        if (result.slideId && result.sectionId) {
          updates.pendingSlideUpdate = {
            slideId: result.slideId,
            sectionId: result.sectionId,
            title: result.title || 'Untitled Slide',
            layoutType: result.layoutType || 'title-content', // default
            components: result.components || [],
            status: 'draft',
          }
          updates.allSlideUpdates = [updates.pendingSlideUpdate]
        }

        // Handle gathered context (existing)
        if (result.gatheredContext) {
          updates.gatheredContext = result.gatheredContext
        }

        if (Object.keys(updates).length > 0) {
          return updates
        }
      } catch {
        // Not JSON, ignore
      }
    }
  }

  return {}
}
```

## Acceptance Criteria

1. postToolNode handles all new tool result types
2. State updates are correctly structured for reducers
3. Backward compatibility maintained for existing tools
4. `npm run type-check` passes with no errors

## Ralph Command

```bash
/ralph-loop "Implement Story 4 from docs/sprint-artifacts/stories/cim-mvp-workflow/story-04-graph.md.

Read the story file for postToolNode update details.

Implement all tasks 4.1-4.9 in manda-app/lib/agent/cim-mvp/graph.ts.

Import types from ./state.ts as needed.

After changes, run 'cd manda-app && npm run type-check'.

If type-check fails, fix the errors before proceeding.

Output <promise>GRAPH_COMPLETE</promise> when all tasks are done and type-check passes." --max-iterations 15 --completion-promise "GRAPH_COMPLETE"
```
