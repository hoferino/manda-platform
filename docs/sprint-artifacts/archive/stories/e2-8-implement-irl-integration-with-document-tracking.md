# Story 2.8: Implement IRL Integration with Document Tracking

Status: done

## Story

As an **M&A analyst**,
I want **an IRL checklist panel showing document collection progress**,
so that **I can track which documents I've received against the Information Request List**.

## Context

This story implements the IRL Checklist panel that displays on the right side of the Data Room. It shows overall progress (e.g., "15/19 documents - 79%"), hierarchical checklist items matching the IRL structure, and status indicators for each item. This integrates the Data Room with IRL tracking (full IRL management is in Epic 6).

**Note:** This story reads from existing IRL data. Full IRL creation and management is implemented in Epic 6.

## Acceptance Criteria

### AC1: Checklist Panel Display
**Given** I am in Data Room with an active IRL
**When** the page loads
**Then** I see the checklist panel on the right side
**And** it shows overall progress (X/Y items, percentage)
**And** the panel has a header with "IRL Checklist" title

### AC2: Hierarchical Checklist
**Given** the IRL has categories with items
**When** I view the checklist
**Then** items are grouped by category
**And** categories can expand/collapse
**And** each item shows its name and status

### AC3: Status Indicators
**Given** an IRL item
**When** a document is linked to it
**Then** the item shows ✓ (green checkmark)
**And** the linked document name is shown
**When** no document is linked
**Then** the item shows ○ (empty circle)
**And** an upload button is visible

### AC4: Progress Calculation
**Given** an IRL has 19 items
**When** 15 have linked documents
**Then** the progress shows "15/19 (79%)"
**And** the progress bar fills to 79%
**And** progress updates when documents are uploaded/deleted

### AC5: Quick Upload from Checklist
**Given** I see a pending item in the checklist
**When** I click the upload button next to it
**Then** the file picker opens
**And** I upload a file
**And** the file is automatically linked to that IRL item
**And** the checklist updates to show completed

### AC6: Collapsible Panel
**Given** the checklist panel is open
**When** I click the collapse button
**Then** the panel collapses to a thin strip
**And** I can expand it again
**And** collapse state is remembered

### AC7: No IRL State
**Given** a project has no IRL configured
**When** I view the Data Room
**Then** the checklist panel shows "No IRL configured"
**And** a link to "Create IRL" (leads to Epic 6 feature)
**Or** shows default categories with item counts

### AC8: Document Linking
**Given** I upload a document with a category
**When** the IRL has items in that category
**Then** I am prompted to link to a specific item
**Or** auto-link if exact match by name
**And** the item status updates

## Tasks / Subtasks

- [x] **Task 1: Create Checklist Panel Component** (AC: #1, #6)
  - [x] Create `components/data-room/irl-checklist-panel.tsx`
  - [x] Add panel header with title and collapse button
  - [x] Implement collapsible behavior
  - [x] Persist collapse state to localStorage

- [x] **Task 2: Build Progress Display** (AC: #4)
  - [x] Create progress header with counts
  - [x] Add progress bar component
  - [x] Calculate progress from IRL items and linked documents

- [x] **Task 3: Create Hierarchical Item List** (AC: #2, #3)
  - [x] Create `components/data-room/irl-checklist-item.tsx`
  - [x] Group items by category
  - [x] Add expand/collapse per category
  - [x] Show status icon per item

- [x] **Task 4: Implement Quick Upload** (AC: #5)
  - [x] Add upload button to pending items
  - [x] Connect to upload flow
  - [x] Auto-link uploaded document to IRL item
  - [x] Refresh progress on complete

- [x] **Task 5: Handle No IRL State** (AC: #7)
  - [x] Create empty state component
  - [x] Show "No IRL configured" message
  - [x] Add link to IRL creation (placeholder for Epic 6)

- [x] **Task 6: Implement Document Linking** (AC: #8)
  - [x] Add irl_item_id column to documents (if not exists)
  - [x] Update document on link
  - [x] Add link selection dialog for ambiguous cases

- [x] **Task 7: Create IRL API Endpoints** (AC: #1, #4)
  - [x] GET /api/projects/[id]/irl - Get IRL with items
  - [x] GET /api/projects/[id]/irl/progress - Get progress stats
  - [x] (Document linking via existing PATCH)

## Dev Notes

### Architecture Patterns
- **Read-Only IRL:** This story reads IRL data, doesn't create
- **Document Linking:** Add irl_item_id to documents table
- **Progress Aggregation:** Count linked vs total items

### Source Tree Components
- `components/data-room/irl-checklist-panel.tsx` - Panel wrapper
- `components/data-room/irl-checklist-item.tsx` - Individual item
- `app/api/projects/[id]/irl/route.ts` - IRL endpoints

### Database Changes
```sql
-- Add irl_item_id to documents for linking
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS irl_item_id uuid REFERENCES irl_items(id);
```

### Testing Standards
- Component tests for checklist rendering
- Progress calculation tests
- E2E tests for upload → link flow

### References
- [Source: docs/sprint-artifacts/tech-spec-epic-2.md#AC-E2-7]
- [Source: docs/epics.md#Story-E2.5]
- [Source: docs/manda-prd.md#IRL-Driven-Workflow]

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/stories/e2-8-implement-irl-integration-with-document-tracking.context.xml

### Agent Model Used

claude-opus-4-5-20251101

### Debug Log References

### Completion Notes List

- All 8 acceptance criteria implemented
- Database migration creates irl_items table and adds irl_item_id to documents table
- IRL panel integrates seamlessly into Data Room right sidebar
- Collapsible panel with localStorage persistence
- Progress calculation shows X/Y (percentage%) format
- Hierarchical checklist with expandable/collapsible categories
- Status indicators: green checkmark for completed, empty circle for pending
- Quick upload from checklist items with automatic IRL linking
- Empty state shows "No IRL Configured" with link to create (Epic 6)
- Document linking via upload store irlItemId parameter
- 23 component tests covering all acceptance criteria
- All 135 tests passing

### File List

**New Files:**
- `supabase/migrations/00014_create_irl_items_table.sql` - Database migration
- `lib/api/irl.ts` - IRL API client with types
- `components/data-room/irl-checklist-panel.tsx` - Main panel component
- `components/data-room/irl-checklist-item.tsx` - Individual checklist item
- `components/data-room/irl-empty-state.tsx` - Empty state component
- `__tests__/components/data-room/irl-checklist-panel.test.tsx` - Component tests

**Modified Files:**
- `lib/supabase/database.types.ts` - Added irl_items types
- `stores/upload-store.ts` - Added irlItemId support
- `hooks/use-upload-processor.ts` - Pass irlItemId to API
- `app/api/documents/upload/route.ts` - Handle irl_item_id on upload
- `components/data-room/upload-zone.tsx` - Exported constants
- `components/data-room/index.ts` - Export new components
- `app/projects/[id]/data-room/data-room-wrapper.tsx` - Integrated IRL panel
