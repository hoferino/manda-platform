# Story 2.5: Create Document Metadata Management

Status: ready-for-dev

## Story

As an **M&A analyst**,
I want **to view and update document metadata (name, category, folder)**,
so that **I can organize and track documents effectively**.

## Context

This story implements document metadata display and editing capabilities. Users can view document details (name, size, type, upload date, processing status) and update mutable fields (name, category, folder). This builds on the document storage from E2.1 and provides the foundation for document actions in E2.6.

## Acceptance Criteria

### AC1: Document Card/Row Display
**Given** I am viewing documents in a folder or bucket
**When** I see a document item
**Then** it displays: name, file type icon, size (KB/MB), upload date
**And** processing status is shown if not complete
**And** category badge is shown if set

### AC2: Document Details View
**Given** I click on a document (or "View Details")
**When** the details panel/modal opens
**Then** I see all metadata:
  - Original filename
  - File size
  - MIME type
  - Upload date
  - Category
  - Folder path
  - Upload status
  - Processing status
**And** download URL info (expires in X minutes)

### AC3: Rename Document
**Given** I am viewing document details
**When** I click "Rename" or edit the name field
**Then** I can enter a new name
**And** on save, the database is updated
**And** the new name displays immediately
**And** an audit log is created

### AC4: Change Category
**Given** I am viewing document details
**When** I click on the category dropdown
**Then** I see all available categories
**And** I can select a new category
**And** on save, the database is updated
**And** the document moves to the new bucket in Buckets view

### AC5: Change Folder
**Given** I am viewing document details
**When** I click "Move to Folder"
**Then** I see a folder tree selector
**And** I can select a new folder (or root)
**And** on save, the folder_path is updated
**And** the document appears in the new folder

### AC6: Processing Status Display
**Given** a document is being processed (Epic 3)
**When** I view the document
**Then** I see "Processing..." with a spinner
**And** processing status updates in real-time
**When** processing completes
**Then** status shows "Completed" or "Failed"

### AC7: Validation
**Given** I try to rename a document
**When** I enter an invalid name (empty, too long, special chars)
**Then** I see a validation error
**And** I cannot save until fixed

## Tasks / Subtasks

- [ ] **Task 1: Create Document Card Component** (AC: #1)
  - [ ] Create `components/data-room/document-card.tsx`
  - [ ] Display name with type icon
  - [ ] Show size formatted (KB/MB/GB)
  - [ ] Show relative date (e.g., "2 hours ago")
  - [ ] Add category badge
  - [ ] Add status indicator

- [ ] **Task 2: Build Document Details Panel** (AC: #2)
  - [ ] Create `components/data-room/document-details.tsx`
  - [ ] Use Sheet or Modal for details view
  - [ ] Display all metadata fields
  - [ ] Add action buttons (Download, Delete, Edit)

- [ ] **Task 3: Implement Rename Functionality** (AC: #3, #7)
  - [ ] Add inline edit or modal input
  - [ ] Validate name (required, length, chars)
  - [ ] Call PATCH /api/documents/[id]
  - [ ] Update local state on success

- [ ] **Task 4: Implement Category Change** (AC: #4)
  - [ ] Create category dropdown with all options
  - [ ] Call PATCH /api/documents/[id] with category
  - [ ] Refresh document list/bucket counts

- [ ] **Task 5: Implement Folder Move** (AC: #5)
  - [ ] Create folder selector dialog
  - [ ] Show folder tree for selection
  - [ ] Call PATCH /api/documents/[id] with folderPath
  - [ ] Refresh both old and new folder views

- [ ] **Task 6: Add Processing Status Display** (AC: #6)
  - [ ] Show spinner for processing status
  - [ ] Subscribe to real-time updates (future)
  - [ ] Display final status with icon

## Dev Notes

### Architecture Patterns
- **Optimistic UI:** Update UI immediately, revert on error
- **Validation:** Client-side + server-side validation
- **Real-time Updates:** Prepared for Supabase Realtime (E2.7)

### Source Tree Components
- `components/data-room/document-card.tsx` - Card display
- `components/data-room/document-details.tsx` - Details panel
- `components/data-room/category-select.tsx` - Category dropdown
- `components/data-room/folder-select-dialog.tsx` - Folder picker

### Testing Standards
- Component tests for card rendering
- Form validation tests
- API integration tests for updates

### References
- [Source: docs/sprint-artifacts/tech-spec-epic-2.md#APIs-and-Interfaces]
- [Source: docs/epics.md#Story-E2.6]

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/stories/e2-5-create-document-metadata-management.context.xml

### Agent Model Used

claude-opus-4-5-20251101

### Debug Log References

### Completion Notes List

### File List
