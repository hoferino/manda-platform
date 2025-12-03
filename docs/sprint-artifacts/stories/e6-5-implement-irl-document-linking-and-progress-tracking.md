# Story 6.5: Implement IRL-Document Linking and Progress Tracking

Status: done

## Story

As an M&A analyst,
I want to manually track which IRL items are fulfilled via an expandable checklist in the Data Room sidebar,
so that I know what I'm still waiting for and can freely restructure my folders without confusing the system.

## Acceptance Criteria

1. **AC1**: An expandable IRL checklist is visible in the Data Room sidebar when an IRL exists for the project
2. **AC2**: Each IRL item shows a simple checkbox (unchecked = not fulfilled, checked = fulfilled)
3. **AC3**: Clicking an item checkbox toggles between fulfilled and not fulfilled
4. **AC4**: A progress bar shows X/Y items fulfilled (Z%) at the top of the checklist
5. **AC5**: Document uploads do NOT auto-update IRL status (users check manually)
6. **AC6**: Category sections within the checklist are collapsible
7. **AC7**: Filter toggle to show only unfulfilled items
8. **AC8**: Checkbox changes are persisted to the database immediately with optimistic UI updates

## Tasks / Subtasks

- [x] Task 1: Create IRL Checklist components (AC: 1, 2, 6)
  - [x] 1.1 Updated `components/data-room/irl-checklist-panel.tsx` - main checklist container with expand/collapse
  - [x] 1.2 Category sections with collapsible headers in IRLChecklistCategory
  - [x] 1.3 Updated `components/data-room/irl-checklist-item.tsx` - individual item with checkbox
  - [x] 1.4 Progress bar integrated in panel header with percentage display
  - [x] 1.5 Used shadcn/ui Checkbox and Toggle components for consistent styling

- [x] Task 2: Implement checkbox toggle and persistence (AC: 3, 8)
  - [x] 2.1 State management built into IRLChecklistPanel with optimistic updates
  - [x] 2.2 Implemented `toggleIRLItemFulfilled()` function in `lib/api/irl.ts`
  - [x] 2.3 Direct database update via Supabase client
  - [x] 2.4 Implemented optimistic updates with rollback on error
  - [x] 2.5 Added toast notifications for errors

- [x] Task 3: Implement progress calculation and display (AC: 4)
  - [x] 3.1 Added `calculateIRLFulfilledProgress()` in `lib/types/irl.ts` for binary fulfilled/not fulfilled
  - [x] 3.2 Progress bar component with percentage display in panel header
  - [x] 3.3 Real-time progress updates when checkbox changes
  - [x] 3.4 Shows counts: "X/Y (Z%)"

- [x] Task 4: Database migration for binary fulfilled status (AC: 2, 3)
  - [x] 4.1 Created migration `00027_add_fulfilled_to_irl_items.sql` to add `fulfilled BOOLEAN DEFAULT false` column
  - [x] 4.2 Migration includes data migration from `status: complete` → `fulfilled=true`
  - [x] 4.3 Updated `lib/types/irl.ts` with `fulfilled: boolean` field in IRLItem interface
  - [x] 4.4 Updated IRL service and API routes to use `fulfilled` field
  - [x] 4.5 Types use assertion until migration applied to production

- [x] Task 5: Implement unfulfilled filter (AC: 7)
  - [x] 5.1 Added Filter toggle button in checklist header
  - [x] 5.2 Filter items based on toggle state using useMemo
  - [x] 5.3 Persist filter preference in localStorage

- [x] Task 6: Integrate checklist into Data Room sidebar (AC: 1)
  - [x] 6.1 IRLChecklistPanel already integrated in data-room-wrapper.tsx
  - [x] 6.2 Fetches IRL data when Data Room loads
  - [x] 6.3 Shows IRLEmptyState placeholder if no IRL exists
  - [x] 6.4 Added expand/collapse toggle for entire checklist panel

- [x] Task 7: Write tests (AC: 1-8)
  - [x] 7.1 Updated unit tests for IRLChecklistPanel component (render, expand/collapse)
  - [x] 7.2 Added unit tests for IRLChecklistItem (checkbox display, click handling)
  - [x] 7.3 Tests for state management with mocked API
  - [x] 7.4 Tests for progress calculation
  - [x] 7.5 Tests for fulfilled toggle
  - [x] 7.6 Tests for filter toggle

## Dev Notes

### Relevant Architecture Patterns and Constraints

- **Manual-Only Tracking**: Per PRD FR-IRL-002, IRL status is updated ONLY by user action. Document uploads do NOT trigger automatic checkbox changes. This is intentional - users often restructure folders and we don't want to create false links.
- **Binary Status Model**: Simplified from 4 statuses to boolean `fulfilled` field. This replaces the `status` enum with a simple true/false.
- **Database Change**: The `irl_items.status` column will be replaced with `irl_items.fulfilled BOOLEAN DEFAULT false`
- **Optimistic Updates**: Follow the pattern from Knowledge Explorer FindingActions - update UI immediately, rollback on error
- **Component Pattern**: Follow existing IRL component patterns in `components/irl/`

### Source Tree Components to Touch

| File | Operation | Notes |
|------|-----------|-------|
| `components/irl/IRLChecklist.tsx` | CREATE | Main checklist container |
| `components/irl/IRLChecklistCategory.tsx` | CREATE | Collapsible category section |
| `components/irl/IRLChecklistItem.tsx` | CREATE | Item with status indicator |
| `components/irl/IRLProgressBar.tsx` | CREATE | Progress bar component |
| `hooks/useIRLChecklist.ts` | CREATE | State management hook |
| `components/data-room/DataRoomSidebar.tsx` | MODIFY | Add IRL checklist panel |
| `components/data-room/DataRoomClient.tsx` | MODIFY | Load IRL data |

### Testing Standards Summary

- **Unit Tests**: Vitest with `@testing-library/react` for components
- **API Tests**: Integration tests with Supabase mock utilities from `__tests__/utils/supabase-mock.ts`
- **E2E Tests**: Playwright tests in `e2e/` directory
- **Coverage Target**: 85% for new components/hooks

### Project Structure Notes

- **Hook Location**: `hooks/useIRLChecklist.ts` (follows existing hook pattern)
- **Component Location**: `components/irl/` (extends existing IRL components)
- **Existing Types**: `lib/types/irl.ts` has `IRLItem` - will need to update to use `fulfilled: boolean` instead of `status` enum
- **Existing API**: Status update endpoint exists at `PATCH /items/[itemId]/status` - will be updated to accept `{ fulfilled: boolean }`
- **Migration Required**: Add `fulfilled` column to `irl_items` table, migrate existing status data, drop old `status` column

### Learnings from Previous Story

**From Story e6-4 (Status: done)**

- **Folder Service Created**: `lib/services/folders.ts` with full CRUD - checklist may need to query folders for context
- **GCS Folder Operations**: `lib/gcs/folder-operations.ts` available if needed for folder metadata
- **IRL Service Pattern**: `lib/services/irls.ts` (500 lines) provides comprehensive CRUD including item status updates
- **Test Count**: 1592 tests passing - maintain green build
- **UI Pattern**: "Generate Folders" button in IRLBuilder shows dialog pattern for feedback
- **Data Room Integration**: FolderTree already has expand/collapse, context menus - follow similar patterns for checklist

[Source: docs/sprint-artifacts/stories/e6-4-implement-data-room-folder-structure-auto-generation-from-irl.md#Completion Notes List]

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E6.md#E6.4 Acceptance Criteria] - E6.4 in tech spec covers status tracking (mapped to E6.5 in sprint)
- [Source: docs/epics.md#Story E6.5] - Full story requirements and definition of done
- [Source: manda-app/lib/types/irl.ts] - IRL types including status enums and display config
- [Source: manda-app/lib/services/irls.ts] - IRL service with existing status update methods
- [Source: manda-app/components/irl/IRLBuilder.tsx] - IRL Builder component patterns to follow
- [Source: manda-app/components/irl/IRLItem.tsx] - Existing item component with status handling

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

1. **Simplified IRL Checklist**: Replaced the document-linking approach (from E2.8) with a simpler binary checkbox model. Users manually check items as "fulfilled" without needing to link specific documents.

2. **Database Migration**: Created `00027_add_fulfilled_to_irl_items.sql` to add `fulfilled BOOLEAN DEFAULT false` column. Includes migration logic to convert existing `status: complete` → `fulfilled=true`.

3. **UI Components Updated**:
   - `irl-checklist-panel.tsx`: Complete rewrite with filter toggle, progress display, and optimistic updates
   - `irl-checklist-item.tsx`: Simplified to use Checkbox component with click-anywhere toggle
   - Added shadcn/ui Toggle component for filter button

4. **Type System Extended**:
   - Added `fulfilled: boolean` to `IRLItem` interface in both `lib/types/irl.ts` and `lib/api/irl.ts`
   - Added `IRLFulfilledProgress` interface and `calculateIRLFulfilledProgress()` function
   - Added `UpdateIRLItemFulfilledRequestSchema` Zod schema

5. **Service Layer Extended**:
   - Added `updateIRLItemFulfilled()` in `lib/services/irls.ts`
   - Added `getIRLFulfilledProgress()` in `lib/services/irls.ts`
   - Added `toggleIRLItemFulfilled()` in `lib/api/irl.ts`

6. **Progress Calculation Changed**: Now based on `fulfilled` boolean instead of `documentId !== null`. This ensures manual-only tracking per PRD requirements.

7. **Filter Persistence**: Filter toggle state persisted to localStorage key `manda-irl-panel-filter-unfulfilled`.

8. **Test Updates**: Rewrote `__tests__/components/data-room/irl-checklist-panel.test.tsx` for new component behavior. Updated gap-related tests to include `fulfilled` field.

### File List

| File | Operation |
|------|-----------|
| `supabase/migrations/00027_add_fulfilled_to_irl_items.sql` | CREATE |
| `components/data-room/irl-checklist-panel.tsx` | MODIFY |
| `components/data-room/irl-checklist-item.tsx` | MODIFY |
| `components/ui/toggle.tsx` | CREATE (via shadcn) |
| `lib/types/irl.ts` | MODIFY |
| `lib/api/irl.ts` | MODIFY |
| `lib/services/irls.ts` | MODIFY |
| `app/api/projects/[id]/gaps/route.ts` | MODIFY |
| `app/api/projects/[id]/irls/route.ts` | MODIFY |
| `components/irl/useIRLBuilder.ts` | MODIFY |
| `app/projects/[id]/data-room/data-room-wrapper.tsx` | MODIFY |
| `__tests__/components/data-room/irl-checklist-panel.test.tsx` | MODIFY |
| `__tests__/components/knowledge-explorer/gaps/GapAnalysisView.test.tsx` | MODIFY |
| `__tests__/components/knowledge-explorer/gaps/GapCard.test.tsx` | MODIFY |
| `e2e/irl-folder-generation.spec.ts` | MODIFY |

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-12-03 | SM Agent | Initial story draft created |
| 2025-12-03 | Claude | Implemented story - added fulfilled field, updated checklist UI, added filter toggle |
