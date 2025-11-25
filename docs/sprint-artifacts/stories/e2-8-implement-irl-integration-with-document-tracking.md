# Story 2.8: Implement IRL Integration with Document Tracking

Status: ready-for-dev

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

- [ ] **Task 1: Create Checklist Panel Component** (AC: #1, #6)
  - [ ] Create `components/data-room/irl-checklist-panel.tsx`
  - [ ] Add panel header with title and collapse button
  - [ ] Implement collapsible behavior
  - [ ] Persist collapse state to localStorage

- [ ] **Task 2: Build Progress Display** (AC: #4)
  - [ ] Create progress header with counts
  - [ ] Add progress bar component
  - [ ] Calculate progress from IRL items and linked documents

- [ ] **Task 3: Create Hierarchical Item List** (AC: #2, #3)
  - [ ] Create `components/data-room/irl-checklist-item.tsx`
  - [ ] Group items by category
  - [ ] Add expand/collapse per category
  - [ ] Show status icon per item

- [ ] **Task 4: Implement Quick Upload** (AC: #5)
  - [ ] Add upload button to pending items
  - [ ] Connect to upload flow
  - [ ] Auto-link uploaded document to IRL item
  - [ ] Refresh progress on complete

- [ ] **Task 5: Handle No IRL State** (AC: #7)
  - [ ] Create empty state component
  - [ ] Show "No IRL configured" message
  - [ ] Add link to IRL creation (placeholder for Epic 6)

- [ ] **Task 6: Implement Document Linking** (AC: #8)
  - [ ] Add irl_item_id column to documents (if not exists)
  - [ ] Update document on link
  - [ ] Add link selection dialog for ambiguous cases

- [ ] **Task 7: Create IRL API Endpoints** (AC: #1, #4)
  - [ ] GET /api/projects/[id]/irl - Get IRL with items
  - [ ] GET /api/projects/[id]/irl/progress - Get progress stats
  - [ ] (Document linking via existing PATCH)

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

### File List
