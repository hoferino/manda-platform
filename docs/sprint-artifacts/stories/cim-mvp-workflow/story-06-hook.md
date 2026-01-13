# Story 6: UI Hook Updates

**File:** `manda-app/lib/hooks/useCIMMVPChat.ts`
**Completion Promise:** `HOOK_COMPLETE`
**Max Iterations:** 15

---

## Overview

Update the useCIMMVPChat hook to handle new SSE event types and expose workflow state to UI components.

## Dependencies

- Story 1 (State Schema) must be complete
- Story 5 (API Route) must be complete

## Tasks

- [ ] 6.1 Add state for `workflowProgress`
  - Type: WorkflowProgress | null
  - Default: null

- [ ] 6.2 Add state for `cimOutline`
  - Type: CIMOutline | null
  - Default: null

- [ ] 6.3 Handle `workflow_progress` SSE event
  - Update workflowProgress state
  - Call onWorkflowProgress callback if provided

- [ ] 6.4 Handle `outline_created` SSE event
  - Update cimOutline state
  - Call onOutlineCreated callback if provided

- [ ] 6.5 Handle `outline_updated` SSE event
  - Update cimOutline state
  - Call onOutlineUpdated callback if provided

- [ ] 6.6 Handle `section_started` SSE event
  - Update workflowProgress.currentSectionId
  - Call onSectionStarted callback if provided

- [ ] 6.7 Add callbacks to hook options
  - onWorkflowProgress?: (progress: WorkflowProgress) => void
  - onOutlineCreated?: (outline: CIMOutline) => void
  - onOutlineUpdated?: (outline: CIMOutline) => void
  - onSectionStarted?: (sectionId: string, sectionTitle: string) => void

- [ ] 6.8 Export new state from hook return
  - Add workflowProgress to return object
  - Add cimOutline to return object

- [ ] 6.9 Run `npm run type-check` - must pass with no errors

## Hook Interface

```typescript
interface UseCIMMVPChatOptions {
  projectId: string
  cimId: string
  initialMessages?: ConversationMessage[]
  knowledgePath?: string
  // Existing callbacks
  onMessageComplete?: (message: ConversationMessage) => void
  onSlideUpdate?: (slide: SlideUpdate) => void
  onPhaseChange?: (phase: CIMPhase) => void
  onCIMStateChanged?: () => void
  // New callbacks
  onWorkflowProgress?: (progress: WorkflowProgress) => void
  onOutlineCreated?: (outline: CIMOutline) => void
  onOutlineUpdated?: (outline: CIMOutline) => void
  onSectionStarted?: (sectionId: string, sectionTitle: string) => void
}

interface UseCIMMVPChatReturn {
  messages: ConversationMessage[]
  isStreaming: boolean
  error: string | null
  currentTool: string | null
  currentPhase: CIMPhase
  conversationId: string | null
  // New return values
  workflowProgress: WorkflowProgress | null
  cimOutline: CIMOutline | null
  // Methods
  sendMessage: (content: string) => Promise<void>
  retryLastMessage: () => Promise<void>
  clearError: () => void
}
```

## Event Handling

```typescript
// In the SSE processing loop
switch (event.type) {
  case 'token':
    // existing handling
    break

  case 'slide_update':
    // existing handling (may need layoutType update)
    break

  case 'workflow_progress':
    const progress = event.data as WorkflowProgress
    setWorkflowProgress(progress)
    onWorkflowProgress?.(progress)
    break

  case 'outline_created':
    const outline = { sections: event.data.sections } as CIMOutline
    setCimOutline(outline)
    onOutlineCreated?.(outline)
    break

  case 'outline_updated':
    const updatedOutline = { sections: event.data.sections } as CIMOutline
    setCimOutline(updatedOutline)
    onOutlineUpdated?.(updatedOutline)
    break

  case 'section_started':
    const { sectionId, sectionTitle } = event.data
    setWorkflowProgress(prev => prev ? {
      ...prev,
      currentSectionId: sectionId
    } : null)
    onSectionStarted?.(sectionId, sectionTitle)
    break

  case 'done':
    // existing handling
    break

  case 'error':
    // existing handling
    break
}
```

## Acceptance Criteria

1. New state variables are initialized and managed
2. All new SSE event types are handled
3. Callbacks are called when events are received
4. New state is exported from hook return
5. Backward compatibility with existing usage maintained
6. `npm run type-check` passes with no errors

## Ralph Command

```bash
/ralph-loop "Implement Story 6 from docs/sprint-artifacts/stories/cim-mvp-workflow/story-06-hook.md.

Read the story file for hook interface specifications.

Implement all tasks 6.1-6.9 in manda-app/lib/hooks/useCIMMVPChat.ts.

Import types from @/lib/agent/cim-mvp as needed.

After changes, run 'cd manda-app && npm run type-check'.

If type-check fails, fix the errors before proceeding.

Output <promise>HOOK_COMPLETE</promise> when all tasks are done and type-check passes." --max-iterations 15 --completion-promise "HOOK_COMPLETE"
```
