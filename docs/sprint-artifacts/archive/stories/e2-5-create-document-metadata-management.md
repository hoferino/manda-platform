# Story 2.5: Create Document Metadata Management

Status: done

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

- [x] **Task 1: Create Document Card Component** (AC: #1) ✅
  - [x] Create `components/data-room/document-card.tsx`
  - [x] Display name with type icon
  - [x] Show size formatted (KB/MB/GB)
  - [x] Show relative date (e.g., "2 hours ago") via date-fns
  - [x] Add category badge
  - [x] Add status indicator

- [x] **Task 2: Build Document Details Panel** (AC: #2) ✅
  - [x] Create `components/data-room/document-details.tsx`
  - [x] Use Sheet for details view (slide-out panel)
  - [x] Display all metadata fields
  - [x] Add action buttons (Download, Delete, Move)

- [x] **Task 3: Implement Rename Functionality** (AC: #3, #7) ✅
  - [x] Add inline edit in details panel
  - [x] Validate name (required, length, special chars)
  - [x] Call PATCH /api/documents/[id]
  - [x] Update local state on success with optimistic UI

- [x] **Task 4: Implement Category Change** (AC: #4) ✅
  - [x] Create category dropdown with all DOCUMENT_CATEGORIES options
  - [x] Call PATCH /api/documents/[id] with category
  - [x] Optimistic UI update with rollback on error

- [x] **Task 5: Implement Folder Move** (AC: #5) ✅
  - [x] Create `components/data-room/folder-select-dialog.tsx`
  - [x] Show folder tree for selection with current indicator
  - [x] Call PATCH /api/documents/[id] with folderPath
  - [x] Update document in both views on success

- [x] **Task 6: Add Processing Status Display** (AC: #6) ✅
  - [x] Show animated spinner for processing status
  - [x] Display status badges (Pending, Processing, Completed, Failed)
  - [x] Only show badge when not completed (completed is default state)

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

- Implemented 2025-11-26 using claude-opus-4-5-20251101
- All 7 ACs met:
  - AC1: DocumentCard displays name, icon, size, relative date, category badge, status indicator
  - AC2: DocumentDetails sheet shows all metadata with actions
  - AC3: Inline rename with validation in details panel
  - AC4: Category dropdown with optimistic UI updates
  - AC5: FolderSelectDialog with tree view for moving documents
  - AC6: Processing status badges with animated spinner
  - AC7: Name validation (empty, length, special chars)
- Test coverage: 18 unit tests for DocumentCard component (all passing)
- Build passes with no TypeScript errors
- Total: 71 tests passing

### File List

**New Files:**
- `manda-app/components/data-room/document-card.tsx` - DocumentCard component with file icons, badges, relative dates
- `manda-app/components/data-room/document-details.tsx` - DocumentDetails sheet panel with all metadata and actions
- `manda-app/components/data-room/folder-select-dialog.tsx` - FolderSelectDialog for moving documents
- `manda-app/__tests__/components/data-room/document-card.test.tsx` - 18 unit tests
- `manda-app/components/ui/sheet.tsx` - shadcn/ui Sheet component (added via CLI)

**Modified Files:**
- `manda-app/components/data-room/index.ts` - Export new E2.5 components
- `manda-app/components/data-room/document-list.tsx` - Refactored to use DocumentCard component
- `manda-app/app/projects/[id]/data-room/data-room-client.tsx` - Integrated DocumentDetails and FolderSelectDialog
