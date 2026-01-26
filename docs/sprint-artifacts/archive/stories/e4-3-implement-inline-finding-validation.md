# Story 4.3: Implement Inline Finding Validation

Status: done

## Story

As an **M&A analyst**,
I want **to validate, reject, or edit findings inline within the Findings Browser**,
so that **I can quickly curate the knowledge base, improving accuracy and confidence in extracted information without leaving my workflow**.

## Acceptance Criteria

1. **AC1: Confirm Action in FindingsTable**
   - Each finding row displays a ✓ (checkmark) button for confirmation
   - Clicking ✓ immediately shows optimistic UI update (green checkmark indicator)
   - Status changes from `pending` to `validated` in database
   - Confidence increases by 5% (capped at 100%)
   - Validation event recorded in `validation_history` with timestamp and userId
   - Toast notification confirms action: "Finding validated"

2. **AC2: Reject Action in FindingsTable**
   - Each finding row displays a ✗ (X) button for rejection
   - Clicking ✗ immediately shows optimistic UI update (red X indicator)
   - Status changes from `pending` to `rejected` in database
   - Rejected findings hidden from default view (status filter excludes `rejected`)
   - Validation event recorded in `validation_history`
   - Toast notification confirms action: "Finding rejected"
   - Rejected findings accessible via "Rejected" status filter

3. **AC3: Edit Finding Text**
   - Edit icon (pencil) available on each finding row
   - Clicking edit opens inline text editor (editable text field replacing display)
   - Original text preserved in `validation_history` before edit
   - Save button commits changes, Cancel discards
   - Edit event recorded with `previousValue` and `newValue`
   - Toast notification confirms: "Finding updated"
   - Keyboard shortcuts: Enter saves, Escape cancels

4. **AC4: Undo Validation Actions**
   - After validate/reject, show brief undo toast (5 seconds)
   - Clicking "Undo" reverts status to `pending`
   - Removes the validation event from history
   - Returns confidence to previous value (if adjusted)
   - Works for validate, reject, and edit actions

5. **AC5: Validation API Endpoint**
   - `POST /api/projects/[id]/findings/[findingId]/validate` accepts `{ action: 'confirm' | 'reject' }`
   - Endpoint validates user ownership via RLS
   - Returns updated finding with new status, confidence, and validation_history
   - Error responses: 400 for invalid action, 404 for not found, 403 for unauthorized

6. **AC6: Edit API Endpoint**
   - `PATCH /api/projects/[id]/findings/[findingId]` accepts `{ text?: string, status?: FindingStatus }`
   - Endpoint validates user ownership via RLS
   - Records edit in `validation_history` with previous and new values
   - Returns updated finding
   - Error responses: 400 for invalid payload, 404 for not found, 403 for unauthorized

7. **AC7: FindingActions Component**
   - Dedicated `FindingActions.tsx` component encapsulating validate/reject/edit buttons
   - Disabled state when action is in progress (loading spinner)
   - Visual feedback for current status (validated shows green, rejected shows red, pending shows neutral)
   - Accessible: ARIA labels, keyboard navigation, focus management

8. **AC8: Integration with FindingsBrowser**
   - Actions work in both table view and search results mode
   - After validation/rejection, finding count updates
   - Optimistic updates revert on API failure with error toast
   - Coordinated state management with filters (rejected hidden by default)

## Tasks / Subtasks

- [ ] **Task 1: Create Validate API Endpoint** (AC: 5)
  - [ ] Create `app/api/projects/[id]/findings/[findingId]/validate/route.ts`
  - [ ] Implement POST handler accepting `{ action: 'confirm' | 'reject' }`
  - [ ] Add Zod schema for request validation
  - [ ] Implement status update logic with confidence adjustment (+5% on confirm)
  - [ ] Add validation event to `validation_history` JSONB
  - [ ] Add authorization check (user owns the project/deal)
  - [ ] Return updated finding with all fields

- [ ] **Task 2: Enhance Findings PATCH Endpoint for Edit** (AC: 6)
  - [ ] Update/create `app/api/projects/[id]/findings/[findingId]/route.ts` with PATCH handler
  - [ ] Accept `{ text?: string, status?: FindingStatus }` body
  - [ ] Implement edit history tracking in `validation_history`
  - [ ] Preserve `previousValue` and `newValue` in history event
  - [ ] Return updated finding

- [ ] **Task 3: Create FindingActions Component** (AC: 7)
  - [ ] Create `components/knowledge-explorer/findings/FindingActions.tsx`
  - [ ] Implement ✓ Confirm button with onClick handler
  - [ ] Implement ✗ Reject button with onClick handler
  - [ ] Implement ✎ Edit button with onClick handler
  - [ ] Add loading states for each action
  - [ ] Add visual indicators for current status
  - [ ] Implement accessibility (ARIA labels, keyboard navigation)

- [ ] **Task 4: Implement Inline Edit Mode** (AC: 3)
  - [ ] Create inline editable text field for finding text
  - [ ] Add Save/Cancel buttons during edit mode
  - [ ] Implement Enter (save) and Escape (cancel) keyboard shortcuts
  - [ ] Handle focus management when entering/exiting edit mode
  - [ ] Validate text is not empty before saving

- [ ] **Task 5: Implement Undo Functionality** (AC: 4)
  - [ ] Add undo toast component with 5-second timer
  - [ ] Store previous state for undo capability
  - [ ] Implement revert API call on undo
  - [ ] Clear undo state when new action performed or timeout expires
  - [ ] Handle concurrent undo scenarios

- [ ] **Task 6: Integrate FindingActions into FindingsTable** (AC: 1, 2, 8)
  - [ ] Add FindingActions to each row in FindingsTable
  - [ ] Implement optimistic UI updates
  - [ ] Handle API failures with revert and error toast
  - [ ] Update finding count after status changes
  - [ ] Coordinate with filter state (hide rejected by default)

- [ ] **Task 7: Add Client API Functions** (AC: 5, 6)
  - [ ] Add `validateFinding(projectId, findingId, action)` to `lib/api/findings.ts`
  - [ ] Add `updateFinding(projectId, findingId, updates)` to `lib/api/findings.ts`
  - [ ] Handle error responses with appropriate error types
  - [ ] Add TypeScript types for API payloads and responses

- [ ] **Task 8: Write Tests** (AC: All)
  - [ ] Unit tests for FindingActions component
    - Renders all action buttons
    - Click handlers fire correctly
    - Loading states display
    - Disabled states work
  - [ ] Unit tests for inline edit
    - Edit mode toggles correctly
    - Keyboard shortcuts work
    - Save/Cancel buttons function
  - [ ] API route tests for validate endpoint
  - [ ] API route tests for PATCH endpoint
  - [ ] Integration test for full validation flow

## Dev Notes

### Architecture Context

**This story adds validation/curation capabilities to the Knowledge Explorer:**

| Layer | Technology | This Story's Role |
|-------|------------|-------------------|
| UI Components | Next.js + shadcn/ui | **Creates** FindingActions component |
| API Layer | Next.js API Routes | **Creates** validate endpoint, **Enhances** PATCH endpoint |
| State Management | Optimistic updates + React Query pattern | **Implements** validation state |
| Database | Supabase PostgreSQL | **Uses** validation_history JSONB, status column |

**Validation Flow Architecture:**

```
User clicks ✓ Confirm → Optimistic UI Update → API POST /validate
    → Supabase Update (status, confidence, validation_history)
    → Return updated finding → UI confirms OR reverts on error
```

**Component Integration:**

```
FindingsTable
├── FindingRow
│   ├── FindingText (existing)
│   ├── DomainTag (existing)
│   ├── ConfidenceBadge (existing)
│   ├── StatusBadge (existing)
│   └── FindingActions (NEW)    ← Confirm/Reject/Edit buttons
│       ├── InlineEdit (NEW)    ← Text editing capability
│       └── UndoToast (NEW)     ← 5-second undo option
```

### Project Structure Notes

**New Files to Create:**

```
manda-app/
├── app/api/projects/[id]/findings/
│   └── [findingId]/
│       ├── route.ts             ← PATCH endpoint for edit
│       └── validate/
│           └── route.ts         ← POST endpoint for validate/reject
├── components/knowledge-explorer/
│   └── findings/
│       └── FindingActions.tsx   ← NEW: Action buttons component
└── lib/
    └── api/
        └── findings.ts          ← MODIFY: Add validateFinding, updateFinding
```

**Existing Files to Modify:**

- `components/knowledge-explorer/findings/FindingsTable.tsx` - Integrate FindingActions
- `lib/types/findings.ts` - Add validation-related types if needed

### Technical Constraints

**From Architecture:**
- Use optimistic UI updates for instant feedback
- All mutations must update `validation_history` for audit trail
- RLS policies ensure user can only validate their own project's findings
- Status filter should exclude `rejected` by default

**From Tech Spec:**
```typescript
// Validate Endpoint
POST /api/projects/[id]/findings/[findingId]/validate
Body: { action: 'confirm' | 'reject' }
Response: Finding

// Edit Endpoint
PATCH /api/projects/[id]/findings/[findingId]
Body: { text?: string, status?: FindingStatus }
Response: Finding

// validation_history event structure
{
  action: 'validated' | 'rejected' | 'edited',
  previousValue?: string,  // For edits
  newValue?: string,       // For edits
  timestamp: string,       // ISO timestamp
  userId: string           // User who performed action
}
```

**Confidence Adjustment:**
- On validate: `confidence = Math.min(1, (confidence || 0.5) + 0.05)`
- On reject: confidence unchanged (finding just marked rejected)
- Cap at 100% (1.0)

### Dependencies

**Existing Dependencies (no new packages needed):**
- `sonner` - Toast notifications (already in project)
- `@supabase/supabase-js` - Database client
- `lucide-react` - Icons (Check, X, Pencil, Undo)

### Learnings from Previous Story

**From Story e4-2 (Implement Semantic Search for Findings) - Status: done**

- **Embedding Service**: `lib/services/embeddings.ts` created with OpenAI text-embedding-3-large
- **FindingsBrowser Structure**: Manages filter state and search mode, passes to FindingsTable
- **FindingsTable Component**: Uses `@tanstack/react-table` DataTable pattern with column definitions
- **API Pattern**: Search endpoint at `app/api/projects/[id]/findings/search/route.ts` with Zod validation
- **Client Service Pattern**: `lib/api/findings.ts` has `getFindings()` and `searchFindings()` - follow same pattern
- **Test Pattern**: Component tests in `__tests__/components/knowledge-explorer/` covering rendering, interactions, edge cases
- **URL State**: Filters and search query managed via URL params (?q=, ?status=, etc.)
- **New Files Created**:
  - `lib/services/embeddings.ts`
  - `app/api/projects/[id]/findings/search/route.ts`
  - `components/knowledge-explorer/findings/FindingSearch.tsx`
- **Modified Files**:
  - `lib/types/findings.ts` - Already has `FindingStatus`, `ValidationEvent` types
  - `components/knowledge-explorer/findings/FindingsTable.tsx` - Has `SimilarityBadge`, action columns pattern

[Source: stories/e4-2-implement-semantic-search-for-findings.md#Dev-Agent-Record]

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E4.md#E4.3-Inline-Validation]
- [Source: docs/sprint-artifacts/tech-spec-epic-E4.md#FindingsService]
- [Source: docs/sprint-artifacts/tech-spec-epic-E4.md#Finding-Validation-Flow]
- [Source: docs/manda-prd.md#FR-KB-001-Structured-Knowledge-Storage]
- [Source: docs/manda-prd.md#FR-LEARN-002-Confidence-Score-Learning]
- [Source: stories/e4-2-implement-semantic-search-for-findings.md#File-List]

## Dev Agent Record

### Context Reference

- [e4-3-implement-inline-finding-validation.context.xml](e4-3-implement-inline-finding-validation.context.xml)

### Agent Model Used

Claude claude-opus-4-5-20251101 (Opus 4.5)

### Debug Log References

**Implementation Plan (2025-11-28):**
1. Task 1-2: Create API endpoints for validate and edit - follow existing route.ts pattern
2. Task 3-4: Build FindingActions component with inline edit - integrate into existing action column
3. Task 5: Implement undo with toast timer and state management
4. Task 6: Integrate into FindingsBrowser with optimistic updates (already partially done)
5. Task 7: Client API functions already exist in lib/api/findings.ts - verify they work
6. Task 8: Write comprehensive tests following existing patterns

### Completion Notes List

### File List

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-28 | Story drafted from tech spec and previous story context | SM Agent |
