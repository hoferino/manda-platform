# Story 2.2: Build Data Room Folder Structure View

Status: ready-for-dev

## Story

As an **M&A analyst**,
I want **to organize documents in a hierarchical folder structure**,
so that **I can structure documents logically like a traditional data room**.

## Context

This story implements the Folder Structure view for the Data Room, providing hierarchical tree navigation on the left panel and a document list on the right. Users can create, rename, and delete folders, and drag-and-drop documents between folders. This is one of two primary views for document organization (the other being Buckets view in E2.3).

## Acceptance Criteria

### AC1: Folder Tree Component
**Given** I am in Data Room Folder view
**When** the page loads
**Then** I see a folder tree on the left panel
**And** root folders are visible by default
**And** folders with children show expand/collapse arrows
**And** selected folder is highlighted

### AC2: Create Folder
**Given** I am in the folder tree
**When** I click "New Folder" button (or right-click menu)
**Then** a modal/inline input appears for folder name
**And** I can enter a folder name and confirm
**And** the folder is created in the database
**And** it appears in the tree immediately

### AC3: Rename Folder
**Given** I right-click on a folder
**When** I select "Rename"
**Then** the folder name becomes editable inline
**And** I can save the new name
**And** the database is updated
**And** all documents in that folder have their folder_path updated

### AC4: Delete Folder
**Given** I right-click on a folder
**When** I select "Delete"
**Then** I see a confirmation dialog
**And** I can choose to move documents to root or delete them
**And** after confirming, the folder is removed
**And** documents are handled per my choice

### AC5: Document List in Selected Folder
**Given** I click on a folder in the tree
**When** the folder is selected
**Then** the main panel shows documents in that folder
**And** documents are displayed as a list or grid
**And** each document shows name, type icon, size, date
**And** empty folders show "No documents" message

### AC6: Drag-and-Drop Documents
**Given** documents are displayed in the list
**When** I drag a document to another folder in the tree
**Then** the drop target highlights
**And** on drop, the document moves to that folder
**And** the database folder_path is updated
**And** both the old and new folder views refresh

### AC7: Expand/Collapse Persistence
**Given** I expand some folders and collapse others
**When** I navigate away and return
**Then** my expand/collapse state is preserved
**And** this is stored in localStorage

### AC8: Breadcrumb Navigation
**Given** I am viewing a nested folder (e.g., Financial/Q3)
**When** I look at the breadcrumb
**Then** I see the full path: Root > Financial > Q3
**And** I can click any breadcrumb segment to navigate

## Tasks / Subtasks

- [ ] **Task 1: Create Data Room Layout** (AC: #1, #5)
  - [ ] Create `app/projects/[id]/data-room/page.tsx`
  - [ ] Create two-panel layout (left: tree, right: content)
  - [ ] Set up responsive breakpoints

- [ ] **Task 2: Build Folder Tree Component** (AC: #1, #7)
  - [ ] Create `components/data-room/folder-tree.tsx`
  - [ ] Implement recursive tree rendering
  - [ ] Add expand/collapse functionality with icons
  - [ ] Add selected state styling
  - [ ] Persist expand state to localStorage

- [ ] **Task 3: Implement Create Folder** (AC: #2)
  - [ ] Add "New Folder" button above tree
  - [ ] Create folder creation modal/inline input
  - [ ] Add API endpoint for folder creation
  - [ ] Update tree on successful creation

- [ ] **Task 4: Implement Rename/Delete Folder** (AC: #3, #4)
  - [ ] Add right-click context menu to folders
  - [ ] Implement inline rename functionality
  - [ ] Implement delete with confirmation
  - [ ] Handle document reassignment on delete

- [ ] **Task 5: Build Document List Component** (AC: #5)
  - [ ] Create `components/data-room/document-list.tsx`
  - [ ] Display documents from selected folder
  - [ ] Show name, type icon, size, upload date
  - [ ] Add empty state for folders without documents

- [ ] **Task 6: Implement Drag-and-Drop** (AC: #6)
  - [ ] Use HTML5 drag-and-drop API or library (react-dnd)
  - [ ] Add drag handlers to document items
  - [ ] Add drop handlers to folder tree items
  - [ ] Highlight valid drop targets
  - [ ] Update folder_path on successful drop

- [ ] **Task 7: Add Breadcrumb Navigation** (AC: #8)
  - [ ] Create `components/data-room/breadcrumb.tsx`
  - [ ] Parse current folder path into segments
  - [ ] Make each segment clickable
  - [ ] Handle root folder specially

## Dev Notes

### Architecture Patterns
- **Two-Panel Layout:** Left sidebar (tree) + main content (list)
- **Local State for Tree:** Expand/collapse in localStorage
- **Server State for Folders:** Supabase query for folder structure
- **Optimistic UI:** Update tree immediately, sync in background

### Source Tree Components
- `app/projects/[id]/data-room/page.tsx` - Data room page
- `components/data-room/folder-tree.tsx` - Tree component
- `components/data-room/document-list.tsx` - Document list
- `components/data-room/breadcrumb.tsx` - Breadcrumb nav

### Testing Standards
- Component tests for tree rendering and interactions
- E2E tests for folder CRUD operations
- Drag-and-drop tests for document moving

### References
- [Source: docs/sprint-artifacts/tech-spec-epic-2.md#Workflows-and-Sequencing]
- [Source: docs/epics.md#Story-E2.3]
- [Source: docs/ux-design-specification.md#Data-Room]

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/stories/e2-2-build-data-room-folder-structure-view.context.xml

### Agent Model Used

claude-opus-4-5-20251101

### Debug Log References

### Completion Notes List

### File List
