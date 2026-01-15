# Change Proposal: Q&A as Cross-Cutting Skill (Not Workflow Mode)

**Date:** 2026-01-10
**Author:** Claude Opus 4.5
**Status:** Approved (2026-01-15)
**Impact:** PRD, Architecture, Epics, State Schema
**Resolution:** Q&A repositioned as cross-cutting tool. `'qa'` removed from WorkflowMode type. Implementation deferred to future story.

---

## Summary

The current PRD and architecture incorrectly model Q&A as a separate workflow mode (`'qa'`). In reality, Q&A should be a **cross-cutting skill/tool** that:
1. Is available in ANY workflow (chat, CIM)
2. Proactively suggests adding questions when the system detects ambiguity
3. Manages a Q&A table (not a separate chat interface)

This proposal removes `'qa'` as a workflow mode and repositions it as a specialist tool.

---

## Current State (Incorrect)

### PRD Lines

```markdown
├─→ workflowMode: 'chat' → supervisor node
├─→ workflowMode: 'cim' → cim/phase-router node
└─→ [future: 'irl', 'qa']
```

```markdown
workflowMode: 'chat' | 'cim' | 'irl' | 'qa'
```

### Architecture Lines

```typescript
'qa': 'qaBuilder'         // Future
workflowMode: Annotation<'chat' | 'cim' | 'irl' | 'qa'>
qaState: Annotation<QAWorkflowState | null>    // Future
```

### Epic References

- Story 5.4: "Implement Q&A Modification Approval" - treats Q&A as user-initiated action only
- FR34: "System requests approval before modifying Q&A list entries"

### User Journey 5 (Jordan Kim)

> Jordan types: "Add a question about the Q2 2023 revenue decline to the Q&A list."

This is **user-initiated only** - doesn't capture proactive system detection.

---

## Proposed State (Correct)

### What Q&A Actually Is

**Sell-side context:** The analyst needs to track questions that must be asked to the client (seller). These are gaps, ambiguities, or missing information discovered during analysis.

**Q&A is NOT:**
- A separate chat workflow with its own UI
- A separate entry point in the graph
- Only user-initiated

**Q&A IS:**
- A **table/list** in the UI (similar to a to-do list)
- A **tool** available to the supervisor in any workflow
- **Proactively suggested** when the system detects ambiguity during conversation
- **User-confirmable** - system suggests, user approves adding to list

### Workflow

```
User asks question in chat/CIM
    ↓
Agent searches knowledge graph
    ↓
Agent detects ambiguity/missing info
    ↓
Agent responds + suggests: "I noticed [X] is unclear. Would you like to add this to the Q&A list for the client?"
    ↓
User confirms → Q&A entry created
```

---

## Proposed Changes

### 1. PRD Changes

#### Remove `'qa'` from workflow modes

**Before:**
```markdown
├─→ workflowMode: 'chat' → supervisor node
├─→ workflowMode: 'cim' → cim/phase-router node
└─→ [future: 'irl', 'qa']
```

**After:**
```markdown
├─→ workflowMode: 'chat' → supervisor node
├─→ workflowMode: 'cim' → cim/phase-router node
└─→ [future: 'irl']
```

#### Update Agent Architecture diagram

**Before:**
```
workflowMode: 'chat' | 'cim' | 'irl' | 'qa'
```

**After:**
```
workflowMode: 'chat' | 'cim' | 'irl'
```

#### Add Q&A as a Specialist Tool

Add to the **Agent Specializations** table:

| Agent | Model | Tools | Role |
|-------|-------|-------|------|
| Q&A Manager | Claude Sonnet | Q&A CRUD, ambiguity detection | Track client questions |

#### Update User Journey 5 (Jordan Kim)

**Before:**
> Jordan types: "Add a question about the Q2 2023 revenue decline to the Q&A list."

**After:**
> Jordan is analyzing revenue trends. She asks: "What caused the revenue decline in Q2 2023?"
>
> The agent searches the knowledge graph but finds no explanation. It responds:
>
> "The documents show a 15% revenue decline in Q2 2023 (CIM page 18) but don't explain the cause.
>
> **Suggested Q&A:** Would you like to add this to the client questions?
> - Q: What caused the revenue decline in Q2 2023?
> - Context: CIM shows 15% decline but no explanation
>
> [Add to Q&A] [Skip]"
>
> Jordan clicks [Add to Q&A]. The question appears in her Q&A table.

**Capabilities revealed:** Proactive ambiguity detection, Q&A suggestion, one-click confirmation

#### Add New Functional Requirements

- **FR67:** System detects ambiguous or missing information during conversation analysis
- **FR68:** System proactively suggests adding detected gaps to the Q&A list
- **FR69:** Q&A suggestions include relevant context (source document, what's known vs unknown)
- **FR70:** Users can add Q&A entries with one click from suggestions
- **FR71:** Q&A list is accessible as a table view separate from chat

#### Update FR34

**Before:**
> FR34: System requests approval before modifying Q&A list entries

**After:**
> FR34: System suggests Q&A entries when detecting ambiguity; user confirms with one click

---

### 2. Architecture Changes

#### Remove `'qa'` from WorkflowMode type

**Before:**
```typescript
type WorkflowMode = 'chat' | 'cim' | 'irl' | 'qa'
```

**After:**
```typescript
type WorkflowMode = 'chat' | 'cim' | 'irl'
```

#### Remove `qaState` from AgentState

**Before:**
```typescript
qaState: Annotation<QAWorkflowState | null>,    // Future
```

**After:**
Remove this field entirely. Q&A entries are stored in the database, not in conversation state.

#### Add Q&A Tool to Specialist Tools

Add to `lib/agent/v2/tools/`:

```typescript
// qa-manager.ts
export const qaManagerTool = {
  name: 'qa-manager',
  description: 'Add questions to the Q&A list for client follow-up',
  parameters: z.object({
    action: z.enum(['suggest', 'add', 'list', 'update', 'remove']),
    question: z.string().optional(),
    context: z.string().optional(),
    sourceDocument: z.string().optional(),
    qaId: z.string().optional(),
  }),
}
```

#### Add Ambiguity Detection to Supervisor

The supervisor should detect when:
1. Knowledge graph search returns no results for a factual question
2. Search results are contradictory
3. Information is partial (e.g., "revenue declined" but no cause)

When detected, supervisor uses `qa-manager` tool with `action: 'suggest'`.

---

### 3. Epic Changes

#### Remove Q&A from Workflow Modes in Epic 1

**Before (Story 1-1 state schema):**
```typescript
workflowMode: 'chat' | 'cim' | 'irl' | 'qa'
```

**After:**
```typescript
workflowMode: 'chat' | 'cim' | 'irl'
```

#### Update Story 5.4

**Before:**
> Story 5.4: Implement Q&A Modification Approval
> As a **user**, I want to **approve changes to the Q&A list**

**After:**
> Story 5.4: Implement Q&A Suggestion and Confirmation
> As a **user**, I want the **system to suggest Q&A entries when it detects gaps**, so that I can quickly track questions for the client

**New Acceptance Criteria:**
1. System detects when knowledge graph search finds incomplete information
2. System suggests Q&A entry with pre-filled question and context
3. User can confirm with one click [Add to Q&A]
4. User can skip suggestion [Skip]
5. Q&A entry includes source attribution and timestamp
6. Q&A list is viewable as a table in the UI

#### Add New Story for Q&A Table UI

> Story X.X: Implement Q&A Table View
> As a **user**, I want to **view and manage Q&A entries in a table**, so that I can track all questions for the client

**Acceptance Criteria:**
1. Q&A table shows all questions for the deal
2. Table columns: Question, Context, Source, Status, Created Date
3. Users can mark questions as answered
4. Users can edit question text
5. Users can delete questions
6. Table is accessible from deal navigation

---

### 4. Code Changes Required

#### State Schema (Already Implemented - Needs Update)

In `manda-app/lib/agent/v2/state.ts`:

```typescript
// REMOVE 'qa' from WorkflowMode
export type WorkflowMode = 'chat' | 'cim' | 'irl'  // Remove 'qa'
```

#### Graph Router (Already Implemented - Needs Update)

In `manda-app/lib/agent/v2/graph.ts`:

```typescript
// Remove 'qa' case - it no longer exists as a workflow mode
function routeByWorkflowMode(state: AgentStateType): string {
  switch (state.workflowMode) {
    case 'cim':
      return 'cim/phaseRouter'
    case 'irl':
      return 'supervisor'  // Future: 'irl/router'
    default:
      return 'supervisor'  // 'chat' is default
  }
}
```

#### Tests (Already Implemented - Needs Update)

Remove tests for `qa` workflow mode routing.

---

## Impact Assessment

### Breaking Changes

1. **State Schema:** Remove `'qa'` from `WorkflowMode` type
2. **Tests:** Remove `qa` routing tests
3. **Future Stories:** Epic references to Q&A workflow need updating

### Non-Breaking Additions

1. New Q&A manager tool (future story)
2. Ambiguity detection in supervisor (future story)
3. Q&A table UI (future story)

### Risk

**Low risk** - Q&A workflow was marked as "future" and has no implementation yet. Changing the model now is the right time.

---

## Recommendation

1. **Approve this change proposal**
2. **Update PRD** with the changes above
3. **Update Architecture** to remove `qaState` and `'qa'` mode
4. **Update Epics** with corrected Story 5.4 and new Q&A table story
5. **Update implemented code** (state.ts, graph.ts, tests) to remove `'qa'` mode

The code changes are minimal since we've only implemented placeholder routing. Better to fix the model now than carry incorrect abstractions forward.

---

## Appendix: Full Diff Preview

### state.ts

```diff
- export type WorkflowMode = 'chat' | 'cim' | 'irl' | 'qa'
+ export type WorkflowMode = 'chat' | 'cim' | 'irl'
```

### graph.test.ts

```diff
- it('should execute supervisor node for qa mode', async () => {
-   const state = createInitialState('qa')
-   // ... test code
- })

- it('should route qa mode to supervisor (fallback)', () => {
-   const state = createInitialState('qa')
-   expect(routeByWorkflowMode(state)).toBe('supervisor')
- })
```

### PRD (agent-system-prd.md)

```diff
- └─→ [future: 'irl', 'qa']
+ └─→ [future: 'irl']

- workflowMode: 'chat' | 'cim' | 'irl' | 'qa'
+ workflowMode: 'chat' | 'cim' | 'irl'
```
