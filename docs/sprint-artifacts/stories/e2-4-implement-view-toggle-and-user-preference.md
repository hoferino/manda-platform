# Story 2.4: Implement View Toggle and User Preference

Status: ready-for-dev

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

- [ ] **Task 1: Create View Toggle Component** (AC: #1)
  - [ ] Create `components/data-room/view-toggle.tsx`
  - [ ] Use shadcn/ui Toggle or Button component
  - [ ] Add folder and bucket icons (Lucide)
  - [ ] Show current mode with active state

- [ ] **Task 2: Implement View Switching** (AC: #2, #3)
  - [ ] Add view state to Data Room page
  - [ ] Conditionally render FolderView or BucketsView
  - [ ] Update toggle icon on switch
  - [ ] Add smooth transition/animation

- [ ] **Task 3: Add Preference Storage** (AC: #4, #5)
  - [ ] Create localStorage key: `dataroom-view-{projectId}`
  - [ ] Save preference on toggle
  - [ ] Load preference on mount
  - [ ] Handle missing preference (default to Folders)

- [ ] **Task 4: Preserve Context on Switch** (AC: #6)
  - [ ] Store selected folder in state
  - [ ] Restore folder selection on return to Folder view
  - [ ] Optionally store scroll position

- [ ] **Task 5: Responsive Styling** (AC: #7)
  - [ ] Test toggle on mobile/tablet viewports
  - [ ] Adjust size/position for small screens
  - [ ] Ensure both views are mobile-friendly

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

### File List
