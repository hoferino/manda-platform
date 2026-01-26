# Story 2.4: Implement View Toggle and User Preference

Status: done

## Story

As an **M&A analyst**,
I want **to switch between folder view and buckets view with my preference saved**,
so that **I can choose the organization style that fits my workflow**.

## Context

This story implements the view mode toggle in the Data Room that switches between Folder Structure view (E2.2) and Buckets view (E2.3). The user's preference is persisted per project so they return to their preferred view. This is a UX feature that enables flexible document organization.

## Acceptance Criteria

### AC1: Toggle Button Display
**Given** I am in the Data Room
**When** I look at the top-right area
**Then** I see a view toggle button
**And** it shows the current view mode icon (folder or bucket)
**And** the toggle is clearly visible and accessible

### AC2: Switch to Buckets View
**Given** I am in Folder view
**When** I click the view toggle
**Then** the view switches to Buckets view
**And** the toggle icon updates to show buckets mode
**And** the URL or state reflects the view change
**And** my documents are displayed in category buckets

### AC3: Switch to Folder View
**Given** I am in Buckets view
**When** I click the view toggle
**Then** the view switches to Folder view
**And** the toggle icon updates to show folder mode
**And** my folder structure is displayed

### AC4: Preference Persistence
**Given** I switch to Buckets view for Project A
**When** I navigate away and return to Project A's Data Room
**Then** Buckets view is shown by default
**And** my preference was stored (localStorage or user settings)

### AC5: Per-Project Preference
**Given** I set Project A to Buckets view
**And** I set Project B to Folder view
**When** I switch between projects
**Then** each project shows its saved view preference
**And** preferences are independent per project

### AC6: Context Preservation
**Given** I have selected a folder in Folder view
**When** I switch to Buckets view and back to Folder view
**Then** my previously selected folder is still selected
**And** my scroll position is approximately preserved

### AC7: Responsive Design
**Given** I am on a tablet or mobile device
**When** I view the toggle
**Then** it is appropriately sized and positioned
**And** both views work on smaller screens

## Tasks / Subtasks

- [x] **Task 1: Create View Toggle Component** (AC: #1) ✅
  - [x] Create `components/data-room/view-toggle.tsx`
  - [x] Use shadcn/ui Tabs component (matches existing pattern)
  - [x] Add folder and bucket icons (Lucide: Folders, LayoutGrid)
  - [x] Show current mode with active state via aria-selected

- [x] **Task 2: Implement View Switching** (AC: #2, #3) ✅
  - [x] Add view state to Data Room wrapper with useViewPreference hook
  - [x] Conditionally render FolderView or BucketsView
  - [x] Update toggle icon on switch
  - [x] CSS transitions built into Tailwind classes

- [x] **Task 3: Add Preference Storage** (AC: #4, #5) ✅
  - [x] Create localStorage key: `dataroom-view-{projectId}`
  - [x] Save preference on toggle via saveViewPreference()
  - [x] Load preference on mount via loadViewPreference()
  - [x] Handle missing preference (default to Folders)

- [x] **Task 4: Preserve Context on Switch** (AC: #6) ✅
  - [x] Store selected folder path in ViewContext state
  - [x] Restore folder selection on return to Folder view
  - [x] Store scroll position via refs
  - [x] Track expanded buckets in buckets view

- [x] **Task 5: Responsive Styling** (AC: #7) ✅
  - [x] Toggle labels hidden on mobile (`hidden sm:inline`)
  - [x] Tooltips show on hover for mobile
  - [x] Responsive padding on toggle header
  - [x] Both views already responsive (grid adapts to screen size)

## Dev Notes

### Architecture Patterns
- **Local Storage for Preferences:** Simple and immediate
- **State Management:** React useState or Zustand for view mode
- **URL State (Optional):** Could use query params for shareable links

### Source Tree Components
- `components/data-room/view-toggle.tsx` - Toggle button
- `app/projects/[id]/data-room/page.tsx` - View state management

### Testing Standards
- Component tests for toggle states
- E2E tests for view switching and persistence
- localStorage mock for unit tests

### References
- [Source: docs/sprint-artifacts/tech-spec-epic-2.md#AC-E2-5]
- [Source: docs/epics.md#Story-E2.7]

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/stories/e2-4-implement-view-toggle-and-user-preference.context.xml

### Agent Model Used

claude-opus-4-5-20251101

### Debug Log References

### Completion Notes List

- Implemented 2025-11-26 using claude-opus-4-5-20251101
- All 7 ACs met:
  - AC1: Toggle button visible in Data Room header using Tabs component with icons
  - AC2/AC3: View switching works bidirectionally with state management
  - AC4: localStorage persistence via `dataroom-view-{projectId}` key
  - AC5: Per-project preferences using project-specific localStorage keys
  - AC6: Context preservation via ViewContext state (selected folder, expanded buckets, scroll position)
  - AC7: Responsive design with hidden labels on mobile, tooltips, and adaptive grid
- Test coverage: 14 unit tests for ViewToggle component and hook (all passing)
- Build passes with no TypeScript errors

### File List

**New Files:**
- `manda-app/components/data-room/view-toggle.tsx` - ViewToggle component, useViewPreference hook, localStorage helpers
- `manda-app/__tests__/components/data-room/view-toggle.test.tsx` - 14 unit tests

**Modified Files:**
- `manda-app/components/data-room/index.ts` - Export new view-toggle components
- `manda-app/app/projects/[id]/data-room/data-room-wrapper.tsx` - Integrated ViewToggle with context preservation
- `manda-app/app/projects/[id]/data-room/data-room-client.tsx` - Added optional props for external state control
- `manda-app/components/data-room/buckets-view.tsx` - Added optional props for external state control
