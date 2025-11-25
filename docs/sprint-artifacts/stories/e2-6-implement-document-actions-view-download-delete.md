# Story 2.6: Implement Document Actions (View, Download, Delete)

Status: ready-for-dev

## Story

As an **M&A analyst**,
I want **to view, download, and delete documents from the data room**,
so that **I can access and manage my deal documents**.

## Context

This story implements the core document actions available from the document list and details view. Users can view documents in-browser (for supported types), download files using signed URLs, and delete documents with proper confirmation and cleanup. This builds on the metadata display from E2.5.

## Acceptance Criteria

### AC1: Actions Menu
**Given** I view a document in the list
**When** I click the actions button (three dots or right-click)
**Then** I see a dropdown with: View, Download, Delete
**And** actions are appropriately enabled/disabled based on status

### AC2: View Document (Preview)
**Given** I click "View" on a supported document (PDF, Image)
**When** the viewer opens
**Then** I see the document content in a modal or new tab
**And** I can close the viewer to return to the list
**Note:** Full preview is stretch goal; link to signed URL is MVP

### AC3: Download Document
**Given** I click "Download" on a document
**When** the download initiates
**Then** a signed URL is fetched (15-min expiry)
**And** the file downloads with original filename
**And** the download works in all major browsers
**And** an audit log is created

### AC4: Delete Document Confirmation
**Given** I click "Delete" on a document
**When** the confirmation dialog appears
**Then** I see the document name and warning message
**And** I can confirm or cancel the deletion
**And** the dialog is accessible (keyboard, screen reader)

### AC5: Delete Document Execution
**Given** I confirm deletion
**When** the delete executes
**Then** the file is removed from GCS
**And** the database record is deleted
**And** the document disappears from the list immediately
**And** an audit log is created
**And** a success toast is shown

### AC6: Delete Error Handling
**Given** a delete operation fails
**When** GCS or database error occurs
**Then** the user sees an error message
**And** the document remains in the list
**And** they can retry the deletion

### AC7: Disabled Actions During Processing
**Given** a document is being processed
**When** I try to delete it
**Then** the delete action is disabled or warns
**And** I cannot delete until processing completes
**Note:** Download should still work for completed uploads

### AC8: Keyboard Accessibility
**Given** I navigate with keyboard
**When** I focus on a document row
**Then** I can open actions menu with Enter/Space
**And** I can navigate menu with arrow keys
**And** I can select action with Enter

## Tasks / Subtasks

- [ ] **Task 1: Create Actions Dropdown** (AC: #1, #8)
  - [ ] Create `components/data-room/document-actions.tsx`
  - [ ] Use shadcn/ui DropdownMenu
  - [ ] Add View, Download, Delete options
  - [ ] Add keyboard navigation

- [ ] **Task 2: Implement View Action** (AC: #2)
  - [ ] Fetch signed URL for viewing
  - [ ] Open in new tab (MVP approach)
  - [ ] (Stretch) Create preview modal for PDFs/images

- [ ] **Task 3: Implement Download Action** (AC: #3)
  - [ ] Call GET /api/documents/[id] for signed URL
  - [ ] Trigger download with correct filename
  - [ ] Handle download errors gracefully

- [ ] **Task 4: Create Delete Confirmation Dialog** (AC: #4, #8)
  - [ ] Create `components/data-room/delete-confirm-dialog.tsx`
  - [ ] Use shadcn/ui AlertDialog
  - [ ] Show document name in message
  - [ ] Add accessible labeling

- [ ] **Task 5: Implement Delete Execution** (AC: #5, #6)
  - [ ] Call DELETE /api/documents/[id]
  - [ ] Remove document from local state immediately
  - [ ] Show success toast
  - [ ] Handle and display errors
  - [ ] Revert local state on error

- [ ] **Task 6: Handle Processing State** (AC: #7)
  - [ ] Disable delete for processing documents
  - [ ] Show tooltip explaining why disabled
  - [ ] Allow download if upload is completed

## Dev Notes

### Architecture Patterns
- **Optimistic Deletion:** Remove from UI immediately, restore on error
- **Signed URLs:** Always fetch fresh URL for download (15-min expiry)
- **Audit Logging:** All actions logged server-side

### Source Tree Components
- `components/data-room/document-actions.tsx` - Actions dropdown
- `components/data-room/delete-confirm-dialog.tsx` - Confirmation
- `lib/api/documents.ts` - Client-side API calls

### Testing Standards
- Component tests for dropdown and dialog
- E2E tests for download and delete flows
- Error handling tests

### References
- [Source: docs/sprint-artifacts/tech-spec-epic-2.md#AC-E2-6]
- [Source: docs/epics.md#Story-E2.6]

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/stories/e2-6-implement-document-actions-view-download-delete.context.xml

### Agent Model Used

claude-opus-4-5-20251101

### Debug Log References

### Completion Notes List

### File List
