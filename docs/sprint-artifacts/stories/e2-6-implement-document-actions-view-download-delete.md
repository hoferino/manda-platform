# Story 2.6: Implement Document Actions (View, Download, Delete)

Status: done

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

- [x] **Task 1: Create Actions Dropdown** (AC: #1, #8)
  - [x] Create `components/data-room/document-actions.tsx`
  - [x] Use shadcn/ui DropdownMenu
  - [x] Add View, Download, Delete options
  - [x] Add keyboard navigation

- [x] **Task 2: Implement View Action** (AC: #2)
  - [x] Fetch signed URL for viewing
  - [x] Open in new tab (MVP approach)
  - [ ] (Stretch) Create preview modal for PDFs/images

- [x] **Task 3: Implement Download Action** (AC: #3)
  - [x] Call GET /api/documents/[id] for signed URL
  - [x] Trigger download with correct filename
  - [x] Handle download errors gracefully

- [x] **Task 4: Create Delete Confirmation Dialog** (AC: #4, #8)
  - [x] Create `components/data-room/delete-confirm-dialog.tsx`
  - [x] Use shadcn/ui AlertDialog
  - [x] Show document name in message
  - [x] Add accessible labeling

- [x] **Task 5: Implement Delete Execution** (AC: #5, #6)
  - [x] Call DELETE /api/documents/[id]
  - [x] Remove document from local state immediately
  - [x] Show success toast
  - [x] Handle and display errors
  - [x] Revert local state on error

- [x] **Task 6: Handle Processing State** (AC: #7)
  - [x] Disable delete for processing documents
  - [x] Show tooltip explaining why disabled
  - [x] Allow download if upload is completed

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

- 2025-11-26: All 6 tasks completed successfully
- Created `document-actions.tsx` with View, Download, Delete, Move, Rename options
- Created `delete-confirm-dialog.tsx` with confirmation modal
- Integrated with data-room-client.tsx for optimistic delete with rollback
- All 73 tests passing, production build successful
- Processing state disables delete action with tooltip explanation
- Error handling includes retry option in toast notifications

### File List

- `manda-app/components/data-room/document-actions.tsx` (NEW)
- `manda-app/components/data-room/delete-confirm-dialog.tsx` (NEW)
- `manda-app/components/data-room/document-card.tsx` (MODIFIED)
- `manda-app/components/data-room/index.ts` (MODIFIED)
- `manda-app/app/projects/[id]/data-room/data-room-client.tsx` (MODIFIED)
- `manda-app/__tests__/components/data-room/document-card.test.tsx` (MODIFIED)

---

## Senior Developer Review (AI)

**Date:** 2025-11-26
**Reviewer:** Senior Developer (AI)
**Verdict:** ✅ **APPROVED**

### AC Verification

| AC | Status | Notes |
|----|--------|-------|
| #1 Actions dropdown | ✅ | DocumentActions with shadcn/ui DropdownMenu |
| #2 View in new tab | ✅ | Fetches signed URL, `window.open` with `noopener,noreferrer` |
| #3 Download | ✅ | Uses `downloadDocument` API, error handling with retry |
| #4 Delete confirmation | ✅ | DeleteConfirmDialog with warning message |
| #5 Delete execution | ✅ | Optimistic update with rollback on error |
| #6 Error handling | ✅ | Toast with retry action |
| #7 Processing state | ✅ | `isProcessing()` helper disables delete with tooltip |
| #8 Keyboard a11y | ✅ | Radix UI provides full keyboard navigation |

### Strengths

- Clean component architecture with reusable `DocumentActions`
- Excellent error handling with optimistic updates and rollback
- Well-implemented processing state detection
- Good accessibility with aria-label and keyboard support
- Proper test coverage for new functionality

### Minor Observations (Non-blocking)

- Consider named type for `DeleteResult` return value
- View action click not tested (acceptable - `window.open` is hard to test)

### Security

- ✅ XSS prevention (no raw HTML)
- ✅ Click-jacking protection (`noopener,noreferrer`)
- ✅ Error exposure safe (generic messages)
- ✅ Authorization via server-side RLS

### Test Results

- **73 tests passing**
- 2 new E2.6 tests added
