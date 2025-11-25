# Story 2.7: Build Upload Progress Indicators and WebSocket Updates

Status: ready-for-dev

## Story

As an **M&A analyst**,
I want **to see real-time upload progress and status updates**,
so that **I know when my documents are uploaded and ready**.

## Context

This story implements the document upload UI with drag-and-drop support, progress indicators for each file, and real-time status updates. This provides immediate feedback during the upload process and notifies users when uploads complete or fail.

## Acceptance Criteria

### AC1: Drag-and-Drop Upload Zone
**Given** I am in the Data Room
**When** I drag files over the drop zone
**Then** the zone highlights with a border/background change
**And** I see "Drop files here to upload" text
**And** on drop, files are added to upload queue

### AC2: File Picker Button
**Given** I am in the Data Room
**When** I click "Upload Files" button
**Then** the file picker dialog opens
**And** I can select multiple files
**And** selected files are added to upload queue

### AC3: Upload Progress Bars
**Given** files are in the upload queue
**When** upload starts
**Then** each file shows a progress bar (0-100%)
**And** progress updates as upload proceeds
**And** file name and size are visible

### AC4: Upload Status States
**Given** a file is uploading
**When** upload is pending
**Then** status shows "Queued" with clock icon
**When** upload is in progress
**Then** status shows percentage with spinner
**When** upload completes
**Then** status shows "Complete" with checkmark
**When** upload fails
**Then** status shows "Failed" with error icon and message

### AC5: Retry Failed Uploads
**Given** an upload has failed
**When** I click "Retry"
**Then** the upload restarts
**And** progress resets to 0%
**And** the file attempts to upload again

### AC6: Bulk Upload Support
**Given** I drop/select 10 files
**When** uploads begin
**Then** all files show in the upload list
**And** uploads may run in parallel (configurable)
**And** overall progress is shown
**And** I can cancel individual uploads

### AC7: Real-Time Notifications (Toast)
**Given** uploads are in progress
**When** an upload completes
**Then** a success toast appears briefly
**When** an upload fails
**Then** an error toast appears with retry option

### AC8: Upload Persistence Across Navigation
**Given** uploads are in progress
**When** I navigate away from Data Room
**Then** uploads continue in background
**And** a notification badge shows upload count
**When** I return to Data Room
**Then** I see current upload status

## Tasks / Subtasks

- [ ] **Task 1: Create Upload Zone Component** (AC: #1, #2)
  - [ ] Create `components/data-room/upload-zone.tsx`
  - [ ] Implement drag-and-drop with visual feedback
  - [ ] Add file picker button
  - [ ] Handle multiple file selection

- [ ] **Task 2: Create Upload Progress Component** (AC: #3, #4)
  - [ ] Create `components/data-room/upload-progress.tsx`
  - [ ] Show file list with individual progress
  - [ ] Use shadcn/ui Progress component
  - [ ] Display status icons per state

- [ ] **Task 3: Implement Upload State Management** (AC: #4, #5, #6)
  - [ ] Create upload state with Zustand or context
  - [ ] Track: queued, uploading, completed, failed
  - [ ] Implement retry functionality
  - [ ] Support parallel uploads (limit: 3)

- [ ] **Task 4: Add Toast Notifications** (AC: #7)
  - [ ] Use Sonner for toast notifications
  - [ ] Show success toast on complete
  - [ ] Show error toast with retry action
  - [ ] Auto-dismiss after few seconds

- [ ] **Task 5: Implement Background Upload Tracking** (AC: #8)
  - [ ] Persist upload state globally
  - [ ] Add upload indicator to header/navbar
  - [ ] Show badge with pending count
  - [ ] Restore view on navigation return

- [ ] **Task 6: Connect to Upload API** (AC: #3, #4)
  - [ ] Use XMLHttpRequest or fetch with progress events
  - [ ] Update progress state on upload progress
  - [ ] Handle completion and error responses
  - [ ] Queue uploads and manage concurrency

## Dev Notes

### Architecture Patterns
- **Upload State Management:** Zustand store for global state
- **Progress Events:** XMLHttpRequest for progress tracking
- **Concurrency Control:** Limit parallel uploads to 3
- **Toast Notifications:** Sonner for non-blocking feedback

### Source Tree Components
- `components/data-room/upload-zone.tsx` - Drop zone
- `components/data-room/upload-progress.tsx` - Progress list
- `stores/upload-store.ts` - Upload state (Zustand)
- `lib/api/documents.ts` - Upload function with progress

### Testing Standards
- Component tests for upload zone interactions
- State management tests for upload queue
- E2E tests for full upload flow

### References
- [Source: docs/sprint-artifacts/tech-spec-epic-2.md#NFR-PERF-E2-001]
- [Source: docs/epics.md#Story-E2.2]

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/stories/e2-7-build-upload-progress-indicators-and-websocket-updates.context.xml

### Agent Model Used

claude-opus-4-5-20251101

### Debug Log References

### Completion Notes List

### File List
