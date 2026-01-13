# Story 5: API Route Updates

**File:** `manda-app/app/api/projects/[id]/cims/[cimId]/chat-mvp/route.ts`
**Completion Promise:** `API_ROUTE_COMPLETE`
**Max Iterations:** 15

---

## Overview

Update the API route to emit new SSE event types for workflow progress, outline creation, and enhanced slide updates. Also add database sync for outline and workflow state.

## Dependencies

- Story 1 (State Schema) must be complete
- Story 4 (Graph Flow) must be complete

## Tasks

- [ ] 5.1 Add `workflow_progress` SSE event type
  - Emitted when workflowProgress changes
  - Contains: currentStage, completedStages, sectionProgress summary

- [ ] 5.2 Add `outline_created` SSE event type
  - Emitted when cimOutline is first created
  - Contains: sections array

- [ ] 5.3 Add `outline_updated` SSE event type
  - Emitted when outline is modified
  - Contains: updated sections array

- [ ] 5.4 Add `section_started` SSE event type
  - Emitted when user starts working on a section
  - Contains: sectionId, sectionTitle

- [ ] 5.5 Update streaming logic to detect and emit new events
  - Compare state before/after each graph step
  - Emit appropriate events for changed fields

- [ ] 5.6 Sync outline to CIM database record
  - After outline_created or outline_updated, save to CIM.outline field
  - Use existing Supabase client

- [ ] 5.7 Sync workflow progress for session resume
  - Save workflowProgress to conversation metadata or separate field
  - Load on conversation resume

- [ ] 5.8 Run `npm run type-check` - must pass with no errors

## SSE Event Format

```typescript
// workflow_progress event
{
  type: 'workflow_progress',
  data: {
    currentStage: 'buyer_persona',
    completedStages: ['welcome'],
    currentSectionId: null,
    sectionProgressSummary: {} // { sectionId: status }
  },
  timestamp: string
}

// outline_created event
{
  type: 'outline_created',
  data: {
    sections: [
      { id: 'sec-1', title: 'Executive Summary', description: '...' },
      { id: 'sec-2', title: 'Company Overview', description: '...' }
    ]
  },
  timestamp: string
}

// section_started event
{
  type: 'section_started',
  data: {
    sectionId: 'sec-1',
    sectionTitle: 'Executive Summary'
  },
  timestamp: string
}

// Enhanced slide_update event (existing, add layoutType)
{
  type: 'slide_update',
  data: {
    slideId: 'slide-1',
    sectionId: 'sec-1',
    title: 'Company Snapshot',
    layoutType: 'split-horizontal',
    components: [...]
  },
  timestamp: string
}
```

## State Change Detection

```typescript
// In streaming loop, track previous state
let previousWorkflowStage = initialState.workflowProgress?.currentStage
let previousOutline = initialState.cimOutline
let previousSectionId = initialState.workflowProgress?.currentSectionId

// After each step, check for changes
for await (const event of stream) {
  const currentState = event.state // or however state is accessed

  // Detect workflow progress change
  if (currentState.workflowProgress?.currentStage !== previousWorkflowStage) {
    yield {
      type: 'workflow_progress',
      data: {
        currentStage: currentState.workflowProgress.currentStage,
        completedStages: currentState.workflowProgress.completedStages,
        currentSectionId: currentState.workflowProgress.currentSectionId,
        sectionProgressSummary: Object.fromEntries(
          Object.entries(currentState.workflowProgress.sectionProgress || {})
            .map(([id, p]) => [id, p.status])
        )
      },
      timestamp: new Date().toISOString()
    }
    previousWorkflowStage = currentState.workflowProgress.currentStage
  }

  // Detect outline creation
  if (currentState.cimOutline && !previousOutline) {
    yield {
      type: 'outline_created',
      data: { sections: currentState.cimOutline.sections },
      timestamp: new Date().toISOString()
    }
    // Also sync to database
    await syncOutlineToCIM(cimId, currentState.cimOutline)
  }
  previousOutline = currentState.cimOutline

  // Detect section start
  if (currentState.workflowProgress?.currentSectionId !== previousSectionId) {
    const sectionId = currentState.workflowProgress.currentSectionId
    if (sectionId) {
      const section = currentState.cimOutline?.sections.find(s => s.id === sectionId)
      yield {
        type: 'section_started',
        data: { sectionId, sectionTitle: section?.title || 'Unknown' },
        timestamp: new Date().toISOString()
      }
    }
    previousSectionId = sectionId
  }
}
```

## Database Sync

```typescript
async function syncOutlineToCIM(cimId: string, outline: CIMOutline) {
  const supabase = await createClient()
  await supabase
    .from('cims')
    .update({ outline: outline.sections })
    .eq('id', cimId)
}
```

## Acceptance Criteria

1. New SSE event types are emitted correctly
2. State changes are detected and appropriate events fired
3. Outline is synced to database after creation
4. Enhanced slide_update includes layoutType
5. `npm run type-check` passes with no errors

## Ralph Command

```bash
/ralph-loop "Implement Story 5 from docs/sprint-artifacts/stories/cim-mvp-workflow/story-05-api-route.md.

Read the story file for SSE event specifications.

Implement all tasks 5.1-5.8 in manda-app/app/api/projects/[id]/cims/[cimId]/chat-mvp/route.ts.

After changes, run 'cd manda-app && npm run type-check'.

If type-check fails, fix the errors before proceeding.

Output <promise>API_ROUTE_COMPLETE</promise> when all tasks are done and type-check passes." --max-iterations 15 --completion-promise "API_ROUTE_COMPLETE"
```
