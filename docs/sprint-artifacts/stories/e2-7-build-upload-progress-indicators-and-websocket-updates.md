# Story 2.7: Build Upload Progress Indicators and WebSocket Updates

Status: done

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

- [x] **Task 1: Create Upload Zone Component** (AC: #1, #2) ✅
  - [x] Create `components/data-room/upload-zone.tsx`
  - [x] Implement drag-and-drop with visual feedback
  - [x] Add file picker button
  - [x] Handle multiple file selection

- [x] **Task 2: Create Upload Progress Component** (AC: #3, #4) ✅
  - [x] Create `components/data-room/upload-progress.tsx`
  - [x] Show file list with individual progress
  - [x] Use shadcn/ui Progress component
  - [x] Display status icons per state

- [x] **Task 3: Implement Upload State Management** (AC: #4, #5, #6) ✅
  - [x] Create upload state with Zustand or context
  - [x] Track: queued, uploading, completed, failed
  - [x] Implement retry functionality
  - [x] Support parallel uploads (limit: 3)

- [x] **Task 4: Add Toast Notifications** (AC: #7) ✅
  - [x] Use Sonner for toast notifications
  - [x] Show success toast on complete
  - [x] Show error toast with retry action
  - [x] Auto-dismiss after few seconds

- [x] **Task 5: Implement Background Upload Tracking** (AC: #8) ✅
  - [x] Persist upload state globally
  - [x] Add upload indicator to header/navbar
  - [x] Show badge with pending count
  - [x] Restore view on navigation return

- [x] **Task 6: Connect to Upload API** (AC: #3, #4) ✅
  - [x] Use XMLHttpRequest or fetch with progress events
  - [x] Update progress state on upload progress
  - [x] Handle completion and error responses
  - [x] Queue uploads and manage concurrency

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

**All acceptance criteria implemented:**

1. **AC1 - Drag-and-Drop Upload Zone**: Implemented in `upload-zone.tsx` with visual feedback (border/background changes), "Drop files here to upload" text on hover, and automatic queue addition on drop.

2. **AC2 - File Picker Button**: Upload button with file picker dialog, supports multiple file selection, validates file types and sizes (500MB max).

3. **AC3 - Upload Progress Bars**: Individual progress bars per file in `upload-progress.tsx` using shadcn/ui Progress component, showing file name and size.

4. **AC4 - Upload Status States**: Four status states implemented - Queued (clock icon), Uploading (spinner with percentage), Complete (checkmark), Failed (error icon with message).

5. **AC5 - Retry Failed Uploads**: Retry button on failed uploads, resets progress to 0% and re-queues the file.

6. **AC6 - Bulk Upload Support**: Supports multiple files, parallel uploads limited to 3 concurrent, overall progress shown, individual cancel buttons for queued/failed items.

7. **AC7 - Real-Time Notifications**: Sonner toast notifications on completion (success) and failure (error with retry option), auto-dismiss after 3-5 seconds.

8. **AC8 - Upload Persistence Across Navigation**: Zustand store with localStorage persistence, UploadIndicator in TopNav shows badge with pending count and overall progress, uploads continue in background.

### File List

**New Files Created:**
- [stores/upload-store.ts](manda-app/stores/upload-store.ts) - Zustand store for upload state management
- [components/data-room/upload-zone.tsx](manda-app/components/data-room/upload-zone.tsx) - Drag-and-drop upload zone component
- [components/data-room/upload-progress.tsx](manda-app/components/data-room/upload-progress.tsx) - Upload progress list component
- [components/data-room/upload-panel.tsx](manda-app/components/data-room/upload-panel.tsx) - Combined upload zone + progress panel
- [components/upload-indicator.tsx](manda-app/components/upload-indicator.tsx) - Global upload indicator for navbar
- [hooks/use-upload-processor.ts](manda-app/hooks/use-upload-processor.ts) - Upload queue processor hook
- [__tests__/stores/upload-store.test.ts](manda-app/__tests__/stores/upload-store.test.ts) - Upload store unit tests (22 tests)
- [__tests__/components/data-room/upload-zone.test.tsx](manda-app/__tests__/components/data-room/upload-zone.test.tsx) - Upload zone unit tests (17 tests)

**Modified Files:**
- [components/data-room/index.ts](manda-app/components/data-room/index.ts) - Added E2.7 component exports
- [components/workspace/TopNav.tsx](manda-app/components/workspace/TopNav.tsx) - Added UploadIndicator
- [app/projects/[id]/data-room/data-room-client.tsx](manda-app/app/projects/[id]/data-room/data-room-client.tsx) - Integrated UploadButton
