# Story 8.2: Q&A Management UI with Collaborative Editing

Status: ready-for-dev

## Story

As an analyst,
I want to view and edit Q&A items in a collaborative table,
so that I can manage questions with colleagues in real-time.

## Acceptance Criteria

1. **AC1:** Q&A items display in a table with category grouping (collapsible sections per category)
2. **AC2:** Inline editing enabled for question text - click to edit, blur to save
3. **AC3:** Priority badges display with correct colors (High=red, Medium=yellow, Low=green)
4. **AC4:** 409 Conflict response from API triggers conflict resolution modal showing both versions
5. **AC5:** Conflict resolution options (Keep Mine/Keep Theirs/Merge) function correctly and resolve the conflict
6. **AC6:** Refresh button reloads Q&A list from server with latest data
7. **AC7:** Status indicator shows pending (no date_answered) vs answered items
8. **AC8:** "Last edited by [name] at [time]" indicator displays per row

## Tasks / Subtasks

- [ ] **Task 1: Create Q&A Page Route and Layout** (AC: #1)
  - [ ] 1.1 Create `app/projects/[id]/qa/page.tsx` with server component
  - [ ] 1.2 Create `components/qa/QAPageClient.tsx` client wrapper
  - [ ] 1.3 Add Q&A navigation item to project sidebar (if not present)
  - [ ] 1.4 Implement loading skeleton state

- [ ] **Task 2: Create QATable Component with Category Grouping** (AC: #1, #7, #8)
  - [ ] 2.1 Create `components/qa/QATable.tsx` with @tanstack/react-table
  - [ ] 2.2 Implement category grouping with collapsible sections using Accordion pattern
  - [ ] 2.3 Add table columns: Question, Priority, Status (answered/pending), Last Edited
  - [ ] 2.4 Display "Last edited by [name] at [time]" using relative time formatting
  - [ ] 2.5 Add status indicator column (badge for pending/answered based on date_answered null check)
  - [ ] 2.6 Style table with existing DataTable patterns from Knowledge Explorer

- [ ] **Task 3: Create PriorityBadge Component** (AC: #3)
  - [ ] 3.1 Create `components/qa/PriorityBadge.tsx` with variant prop
  - [ ] 3.2 Apply colors: High=destructive/red, Medium=warning/yellow, Low=secondary/green
  - [ ] 3.3 Add accessibility labels for screen readers

- [ ] **Task 4: Implement Inline Editing** (AC: #2)
  - [ ] 4.1 Create `components/qa/QAInlineEdit.tsx` component
  - [ ] 4.2 Implement click-to-edit behavior with text input
  - [ ] 4.3 Handle blur event to trigger save via updateQAItem API
  - [ ] 4.4 Add optimistic UI update with rollback on error
  - [ ] 4.5 Handle Escape key to cancel edit, Enter key to save

- [ ] **Task 5: Create useQAItems Hook** (AC: #1, #6)
  - [ ] 5.1 Create `hooks/useQAItems.ts` with SWR or React Query pattern
  - [ ] 5.2 Implement fetch with category/priority/status filters
  - [ ] 5.3 Add refresh function for manual refetch
  - [ ] 5.4 Handle loading, error, and empty states

- [ ] **Task 6: Implement Conflict Detection and Modal** (AC: #4, #5)
  - [ ] 6.1 Create `components/qa/ConflictResolutionModal.tsx`
  - [ ] 6.2 Display "Your version" vs "Their version" side-by-side comparison
  - [ ] 6.3 Implement "Keep Mine" button - force update with current user's changes
  - [ ] 6.4 Implement "Keep Theirs" button - refresh with server version
  - [ ] 6.5 Implement "Merge" button - open merge view for manual reconciliation
  - [ ] 6.6 Detect 409 response in update handler and trigger modal
  - [ ] 6.7 Pass currentItem from 409 response to modal for comparison

- [ ] **Task 7: Create Category/Priority Filter Controls** (AC: #1)
  - [ ] 7.1 Create `components/qa/QAFilterBar.tsx` with filter dropdowns
  - [ ] 7.2 Add category filter (All, Financials, Legal, Operations, Market, Technology, HR)
  - [ ] 7.3 Add priority filter (All, High, Medium, Low)
  - [ ] 7.4 Add status filter (All, Pending, Answered)
  - [ ] 7.5 Persist filters in URL query params for shareability

- [ ] **Task 8: Add Refresh Button** (AC: #6)
  - [ ] 8.1 Add Refresh button to toolbar with RefreshCw icon
  - [ ] 8.2 Wire to useQAItems.refresh() function
  - [ ] 8.3 Show loading spinner during refresh
  - [ ] 8.4 Display toast on successful refresh

- [ ] **Task 9: Write Component Tests** (AC: all)
  - [ ] 9.1 Write unit tests for QATable rendering and grouping
  - [ ] 9.2 Write unit tests for PriorityBadge variants
  - [ ] 9.3 Write unit tests for QAInlineEdit blur/save behavior
  - [ ] 9.4 Write unit tests for ConflictResolutionModal options
  - [ ] 9.5 Write unit tests for useQAItems hook
  - [ ] 9.6 Write integration tests for conflict detection flow

- [ ] **Task 10: Verify Build and Integration** (AC: all)
  - [ ] 10.1 Run type-check to verify no TypeScript errors
  - [ ] 10.2 Run all tests to verify no regressions
  - [ ] 10.3 Manually test conflict resolution flow with two browser tabs
  - [ ] 10.4 Verify inline editing saves correctly

## Dev Notes

### Architecture Patterns and Constraints

- **Component Library:** Use existing shadcn/ui components (Table, Badge, Button, Dialog, Input, Accordion)
- **Data Fetching:** Follow SWR pattern established in `useConversations` and `useChat` hooks from Epic 5
- **Table Pattern:** Follow `@tanstack/react-table` patterns from FindingsTable in Knowledge Explorer (E4.1)
- **Inline Editing:** Follow InlineEdit pattern from `components/knowledge-explorer/InlineEdit.tsx` (E4.3)
- **Conflict Modal:** Follow Dialog patterns from existing modals in the codebase

[Source: docs/manda-architecture.md#Frontend-Architecture]

### Optimistic Locking Implementation

The API uses `updated_at` for optimistic locking:
1. Load item with current `updated_at` timestamp
2. On save, include `updated_at` in PUT request
3. Server checks: `UPDATE ... WHERE id = $id AND updated_at = $timestamp`
4. If 0 rows affected → 409 Conflict with current item state
5. UI shows ConflictResolutionModal with both versions

[Source: docs/sprint-artifacts/tech-spec-epic-E8.md#Workflows-and-Sequencing]

### Status Derivation

- **No status column in DB** - status is derived from `date_answered`:
  - `date_answered IS NULL` → pending (show yellow/outline badge)
  - `date_answered IS NOT NULL` → answered (show green/success badge)
- Use helper functions from `lib/types/qa.ts`: `isPending(item)`, `isAnswered(item)`

[Source: docs/sprint-artifacts/tech-spec-epic-E8.md#Key-Architectural-Decisions]

### Performance Requirements

| Operation | Target | Notes |
|-----------|--------|-------|
| Q&A list load | < 500ms | 95th percentile for 100 items |
| Inline save | < 200ms | API response time |
| Conflict modal render | < 100ms | UI responsiveness |

[Source: docs/sprint-artifacts/tech-spec-epic-E8.md#Performance]

### Project Structure Notes

New files for this story:
- `app/projects/[id]/qa/page.tsx` - Server component page
- `components/qa/QAPageClient.tsx` - Client wrapper
- `components/qa/QATable.tsx` - Main table component
- `components/qa/PriorityBadge.tsx` - Priority indicator
- `components/qa/QAInlineEdit.tsx` - Inline editing
- `components/qa/ConflictResolutionModal.tsx` - Conflict UI
- `components/qa/QAFilterBar.tsx` - Filter controls
- `hooks/useQAItems.ts` - Data fetching hook

Files to reuse:
- `lib/types/qa.ts` - Types and helpers (from E8.1)
- `lib/api/qa.ts` - API functions (from E8.1)
- `lib/services/qa.ts` - Service layer (from E8.1)

### Learnings from Previous Story

**From Story e8-1-data-model-and-crud-api (Status: done)**

- **Database Schema Applied**: `qa_items` table with optimistic locking via `updated_at`
- **Types Available**: `QAItem`, `QACategory`, `QAPriority`, `CreateQAItemInput`, `UpdateQAItemInput`, `QAConflictError` at `lib/types/qa.ts`
- **Helper Functions**: `isPending()`, `isAnswered()` available for status derivation
- **API Functions Ready**: `createQAItem`, `getQAItems`, `getQAItem`, `updateQAItem`, `deleteQAItem`, `getQASummary` at `lib/api/qa.ts`
- **Conflict Response Format**: 409 response includes `{ error: 'conflict', currentItem: QAItem, yourChanges: Partial<QAItem> }`
- **Service Layer**: `lib/services/qa.ts` handles optimistic locking check
- **59 Tests Passing**: Full coverage on types and API routes

**Files Created:**
- `manda-app/lib/types/qa.ts` - Use QAItem, QAConflictError types
- `manda-app/lib/api/qa.ts` - Use updateQAItem for inline edits with locking
- `manda-app/app/api/projects/[id]/qa/route.ts` - GET list endpoint
- `manda-app/app/api/projects/[id]/qa/[itemId]/route.ts` - PUT endpoint returns 409 on conflict

**Testing Pattern**: Follow API route test patterns from `__tests__/app/api/projects/[id]/qa/route.test.ts`

[Source: docs/sprint-artifacts/stories/e8-1-data-model-and-crud-api.md#Dev-Agent-Record]

### Related Components to Reference

From previous epics:
- `components/knowledge-explorer/FindingsTable.tsx` - Table with DataTable patterns (E4.1)
- `components/knowledge-explorer/InlineEdit.tsx` - Inline editing component (E4.3)
- `components/knowledge-explorer/ConfidenceBadge.tsx` - Badge component pattern (E4.1)
- `components/chat/MessageItem.tsx` - Complex component with conditional rendering (E5.3)

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E8.md#E8.2] - Acceptance criteria AC-8.2.1 through AC-8.2.6
- [Source: docs/epics.md#Story-E8.2] - Story definition and gherkin scenarios
- [Source: docs/sprint-artifacts/tech-spec-epic-E8.md#TypeScript-Types] - QAItem and conflict types
- [Source: docs/sprint-artifacts/tech-spec-epic-E8.md#Workflows-and-Sequencing] - Optimistic locking flow
- [Source: docs/manda-architecture.md#Frontend-Architecture] - Component patterns
- [Source: docs/sprint-artifacts/stories/e8-1-data-model-and-crud-api.md] - Previous story learnings

## Dev Agent Record

### Context Reference

- [e8-2-qa-management-ui.context.xml](docs/sprint-artifacts/stories/e8-2-qa-management-ui.context.xml)

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Author | Change Description |
|------|--------|-------------------|
| 2025-12-09 | SM Agent | Initial story creation from Epic 8 tech spec and epics.md |