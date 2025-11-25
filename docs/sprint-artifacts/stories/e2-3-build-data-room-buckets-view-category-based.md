# Story 2.3: Build Data Room Buckets View (Category-Based)

Status: ready-for-dev

## Story

As an **M&A analyst**,
I want **to organize documents by category buckets with progress indicators**,
so that **I can see document coverage by due diligence category at a glance**.

## Context

This story implements the Buckets view for the Data Room, providing a category-based organization with bucket cards showing progress indicators. Each category (Financial, Legal, Commercial, etc.) displays as a card with progress bar, status badge, and expandable item list. This complements the Folder Structure view (E2.2) and integrates with IRL tracking.

## Acceptance Criteria

### AC1: Category Bucket Cards
**Given** I am in Data Room Buckets view
**When** the page loads
**Then** I see category bucket cards in a grid layout
**And** each card shows: category name, progress bar, status badge
**And** cards are styled consistently with the design system

### AC2: Progress Calculation
**Given** a category has 8 expected items (from IRL or default)
**When** 6 documents are uploaded with that category
**Then** the progress bar shows 75%
**And** the card displays "6/8" or similar indicator
**And** progress updates when documents are added/removed

### AC3: Status Badges
**Given** a category has progress
**When** progress is 0%
**Then** status badge shows "Not Started" (gray)
**When** progress is 1-99%
**Then** status badge shows "In Progress" (yellow/amber)
**When** progress is 100%
**Then** status badge shows "Completed" (green)

### AC4: Expandable Item List
**Given** I click on a bucket card
**When** the card expands
**Then** I see a list of items in that category
**And** each item shows: name, upload status (uploaded/pending/not started)
**And** uploaded items show the linked document name
**And** I can collapse the card again

### AC5: Per-Item Upload
**Given** a bucket card is expanded
**When** I click "Upload" on a pending item
**Then** the file picker opens
**And** I can select a file
**And** the file is uploaded with that category set
**And** the item is marked as uploaded
**And** progress updates immediately

### AC6: Empty State
**Given** a category has no documents
**When** I view the bucket card
**Then** it shows "No documents uploaded"
**And** I can click to upload the first document
**And** progress shows 0%

### AC7: Default Categories
**Given** a project has no IRL configured
**When** I view Buckets view
**Then** I see default M&A categories:
  - Financial
  - Legal
  - Commercial
  - Operational
  - Tax
  - HR
  - IT & Technology
  - Environmental
  - Regulatory
  - Other

## Tasks / Subtasks

- [ ] **Task 1: Create Bucket Card Component** (AC: #1, #2, #3)
  - [ ] Create `components/data-room/bucket-card.tsx`
  - [ ] Add category icon and name
  - [ ] Add progress bar with percentage
  - [ ] Add status badge with color states
  - [ ] Style with shadcn/ui Card component

- [ ] **Task 2: Build Buckets Grid Layout** (AC: #1)
  - [ ] Create `components/data-room/buckets-view.tsx`
  - [ ] Implement responsive grid (3 cols desktop, 2 tablet, 1 mobile)
  - [ ] Fetch category data and document counts
  - [ ] Map categories to bucket cards

- [ ] **Task 3: Implement Progress Calculation** (AC: #2)
  - [ ] Query documents grouped by category
  - [ ] Calculate expected items (from IRL or defaults)
  - [ ] Compute percentage: uploaded / expected
  - [ ] Handle edge cases (no expected, zero total)

- [ ] **Task 4: Add Expandable Item List** (AC: #4)
  - [ ] Add collapsible content area to bucket card
  - [ ] Query IRL items or use defaults per category
  - [ ] Show item status icons
  - [ ] Link uploaded items to documents

- [ ] **Task 5: Implement Per-Item Upload** (AC: #5)
  - [ ] Add upload button to pending items
  - [ ] Connect to upload flow with category preset
  - [ ] Update item status on successful upload
  - [ ] Refresh bucket progress

- [ ] **Task 6: Handle Empty/Default States** (AC: #6, #7)
  - [ ] Create empty state component
  - [ ] Define default categories constant
  - [ ] Show defaults when no IRL configured
  - [ ] Calculate progress against defaults

## Dev Notes

### Architecture Patterns
- **Category Enum:** Uses DOCUMENT_CATEGORIES from lib/gcs/client.ts
- **Progress Aggregation:** Query documents, group by category, count
- **IRL Integration:** Optional - falls back to defaults if no IRL
- **Optimistic Updates:** Progress updates immediately on upload

### Source Tree Components
- `components/data-room/buckets-view.tsx` - Main view
- `components/data-room/bucket-card.tsx` - Individual card
- `components/data-room/bucket-item-list.tsx` - Expanded items

### Testing Standards
- Component tests for bucket card states
- Progress calculation unit tests
- E2E tests for upload → progress update flow

### References
- [Source: docs/sprint-artifacts/tech-spec-epic-2.md#Data-Models]
- [Source: docs/epics.md#Story-E2.4]
- [Source: docs/ux-design-specification.md#Buckets-View]

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/stories/e2-3-build-data-room-buckets-view-category-based.context.xml

### Agent Model Used

claude-opus-4-5-20251101

### Debug Log References

### Completion Notes List

### File List
