# Story 6.2: Implement IRL Creation and Editing

Status: drafted

## Story

As an **M&A analyst**,
I want **to customize my IRL items by adding, editing, removing, and reordering categories and items**,
so that **I can request exactly what I need for this specific deal**.

## Acceptance Criteria

1. **AC1:** Can add new categories with custom names
2. **AC2:** Can add items within categories with name, description, and priority
3. **AC3:** Can edit item name, description, and priority inline
4. **AC4:** Can delete items and categories with confirmation
5. **AC5:** Can drag-and-drop to reorder items within and across categories
6. **AC6:** Save persists all changes to database via API
7. **AC7:** Cancel discards unsaved changes and reverts to saved state

## Tasks / Subtasks

- [ ] **Task 1: Create database migrations for IRL tables** (AC: 6)
  - [ ] Create migration `00026_create_folders_table.sql` with RLS policies
  - [ ] Create migration `00027_create_irls_table.sql` (if not exists, verify schema)
  - [ ] Create migration `00028_create_irl_items_table.sql` with status, priority, and sort_order columns
  - [ ] Create migration `00029_add_folder_id_to_documents.sql`
  - [ ] Apply migrations and regenerate Supabase types with `npm run db:types`
  - [ ] Write migration tests verifying table creation

- [ ] **Task 2: Implement IRL service layer** (AC: 6, 7)
  - [ ] Create `lib/services/irls.ts` with CRUD operations
  - [ ] Implement `getIRL(irlId)` - fetches IRL with items
  - [ ] Implement `updateIRL(irlId, updates)` - updates IRL metadata
  - [ ] Implement `deleteIRL(irlId)` - cascades to items
  - [ ] Implement `createIRLItem(irlId, item)` - adds item to IRL
  - [ ] Implement `updateIRLItem(itemId, updates)` - updates single item
  - [ ] Implement `deleteIRLItem(itemId)` - removes item
  - [ ] Implement `reorderIRLItems(items: {id, sortOrder}[])` - batch update sort orders
  - [ ] Write unit tests for service functions (15+ tests)

- [ ] **Task 3: Create IRL item API endpoints** (AC: 6)
  - [ ] Create `app/api/projects/[id]/irls/[irlId]/route.ts` - GET, PUT, DELETE single IRL
  - [ ] Create `app/api/projects/[id]/irls/[irlId]/items/route.ts` - POST new item, GET all items
  - [ ] Create `app/api/projects/[id]/irls/[irlId]/items/[itemId]/route.ts` - PUT, DELETE item
  - [ ] Create `app/api/projects/[id]/irls/[irlId]/reorder/route.ts` - POST batch reorder
  - [ ] Add Zod validation for request bodies
  - [ ] Write API route tests (12+ tests)

- [ ] **Task 4: Create IRLBuilder component** (AC: 1-5)
  - [ ] Create `components/irl/IRLBuilder.tsx` - main builder container
  - [ ] Implement header with IRL title edit, save, and cancel buttons
  - [ ] Implement "Add Category" button at bottom
  - [ ] Manage local state for unsaved changes
  - [ ] Implement optimistic updates with rollback on error
  - [ ] Write component tests (15+ tests)

- [ ] **Task 5: Create IRLCategory component** (AC: 1, 4, 5)
  - [ ] Create `components/irl/IRLCategory.tsx` - collapsible category section
  - [ ] Implement category header with inline name editing
  - [ ] Add "Add Item" button within category
  - [ ] Add delete category button with confirmation dialog
  - [ ] Implement expand/collapse toggle
  - [ ] Write component tests (12+ tests)

- [ ] **Task 6: Create IRLItem component** (AC: 2, 3, 4)
  - [ ] Create `components/irl/IRLItem.tsx` - single item row
  - [ ] Display item name, description (truncated), priority badge
  - [ ] Implement inline editing on click or edit button
  - [ ] Add priority selector (dropdown: high/medium/low)
  - [ ] Add delete button with confirmation
  - [ ] Write component tests (12+ tests)

- [ ] **Task 7: Implement drag-and-drop reordering** (AC: 5)
  - [ ] Install `@dnd-kit/core` and `@dnd-kit/sortable` if not present
  - [ ] Create `components/irl/DraggableItem.tsx` wrapper
  - [ ] Implement DndContext in IRLBuilder
  - [ ] Handle drag between categories (cross-category reorder)
  - [ ] Visual feedback during drag (placeholder, opacity)
  - [ ] Persist reorder on drop via API call
  - [ ] Write drag-and-drop tests (8+ tests)

- [ ] **Task 8: Create useIRLBuilder hook** (AC: 6, 7)
  - [ ] Create `components/irl/useIRLBuilder.ts`
  - [ ] Manage local draft state separate from saved state
  - [ ] Implement `isDirty` flag for unsaved changes
  - [ ] Implement `save()` that calls APIs and updates saved state
  - [ ] Implement `cancel()` that reverts to saved state
  - [ ] Handle API errors with toast notifications
  - [ ] Write hook tests (10+ tests)

- [ ] **Task 9: Integrate IRLBuilder into Deliverables page** (AC: 1-7)
  - [ ] Update `app/projects/[id]/deliverables/page.tsx` to show IRL list
  - [ ] Add "Edit" button on each IRL card that opens IRLBuilder
  - [ ] Handle navigation from template selection to builder
  - [ ] Add loading states and empty states
  - [ ] Implement responsive layout

- [ ] **Task 10: Write integration tests** (AC: 1-7)
  - [ ] Test full flow: select template → edit IRL → save → verify in database
  - [ ] Test cancel flow: make changes → cancel → verify reverted
  - [ ] Test drag-and-drop: reorder items → verify new order persists
  - [ ] Test delete: remove item → verify removed from database

## Dev Notes

### Architecture Patterns and Constraints

This story builds on E6.1's template selection UI and establishes the full IRL editing workflow. Key patterns:

**State Management:**
- Use `useState` for local draft state within IRLBuilder
- Keep original data in a ref or separate state for cancel/revert
- Optimistic updates for immediate UI feedback
- Rollback on API errors with toast notification

**Database Schema (from tech spec):**
The `irl_items` table stores individual items with:
- `category` - string grouping
- `subcategory` - optional sub-grouping
- `item_name`, `description` - item details
- `priority` - enum: 'high', 'medium', 'low'
- `status` - enum: 'not_started', 'pending', 'received', 'complete' (used in E6.4)
- `sort_order` - integer for ordering
- `notes` - optional notes field

**Drag-and-Drop:**
Use @dnd-kit/core which is already used in similar patterns in the codebase:
- `DndContext` wraps the entire builder
- `SortableContext` wraps each category's items
- `useSortable` hook on each item
- Cross-category drag requires detecting drop target category

**API Design:**
- Individual item CRUD endpoints for granular updates
- Batch reorder endpoint for efficiency after drag-drop
- All endpoints validate deal ownership via RLS

### Project Structure Notes

```
manda-app/
├── lib/
│   ├── services/
│   │   └── irls.ts               # NEW: IRL CRUD service
│   └── supabase/
│       └── database.types.ts     # REGENERATE: After migrations
├── components/irl/
│   ├── IRLBuilder.tsx            # NEW: Main builder component
│   ├── IRLCategory.tsx           # NEW: Collapsible category
│   ├── IRLItem.tsx               # NEW: Item row component
│   ├── DraggableItem.tsx         # NEW: Drag wrapper
│   └── useIRLBuilder.ts          # NEW: Builder state hook
├── app/
│   ├── projects/[id]/deliverables/
│   │   ├── page.tsx              # MODIFY: Add IRL list view
│   │   └── deliverables-client.tsx # MODIFY: Integrate builder
│   └── api/projects/[id]/irls/
│       ├── [irlId]/
│       │   ├── route.ts          # NEW: Single IRL CRUD
│       │   ├── items/
│       │   │   ├── route.ts      # NEW: Items list/create
│       │   │   └── [itemId]/route.ts # NEW: Item CRUD
│       │   └── reorder/route.ts  # NEW: Batch reorder
└── supabase/migrations/
    ├── 00026_create_folders_table.sql  # NEW
    ├── 00027_create_irls_table.sql     # VERIFY/NEW
    ├── 00028_create_irl_items_table.sql # NEW
    └── 00029_add_folder_id_to_documents.sql # NEW
```

### Testing Standards

Following established patterns:
- **Service tests**: Mock Supabase client, test each CRUD operation
- **API tests**: Test route handlers with mock requests/responses
- **Component tests**: React Testing Library with user-event for interactions
- **Drag-drop tests**: @testing-library/user-event's drag functionality or mock DndContext

Test file locations:
- `__tests__/lib/services/irls.test.ts`
- `__tests__/api/irls/[irlId].test.ts`
- `__tests__/api/irls/items.test.ts`
- `__tests__/components/irl/IRLBuilder.test.tsx`
- `__tests__/components/irl/IRLCategory.test.tsx`
- `__tests__/components/irl/IRLItem.test.tsx`

### UI Component Patterns

Use existing shadcn/ui components:
- `Card` for IRL display in list view
- `Input` for inline editing
- `Button` for actions (save, cancel, add, delete)
- `AlertDialog` for delete confirmations
- `Badge` for priority indicators (red=high, yellow=medium, gray=low)
- `Collapsible` for category expand/collapse
- `DropdownMenu` for item actions
- `Skeleton` for loading states

Keyboard shortcuts:
- `Enter` to save inline edit
- `Escape` to cancel inline edit
- `Ctrl/Cmd+S` to save entire IRL (optional)

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E6.md#E6.3] - Authoritative acceptance criteria
- [Source: docs/sprint-artifacts/tech-spec-epic-E6.md#Data Models and Contracts] - Database schema
- [Source: docs/sprint-artifacts/tech-spec-epic-E6.md#APIs and Interfaces] - API endpoint specifications
- [Source: docs/epics.md#Story E6.3] - Epic story details
- [Source: docs/sprint-artifacts/stories/e6-1-build-irl-builder-ui-with-template-selection.md] - E6.1 completion notes

### Learnings from Previous Story

**From Story e6-1-build-irl-builder-ui-with-template-selection (Status: done)**

- **Database Schema Adaptation**: Existing `irls` table uses `name` (not `title`), `user_id`, and `sections` JSONB column for storing template items. This story needs to work with the existing schema OR migrate to the tech spec schema.
- **Type Coercion**: Use `?? undefined` for null vs undefined issues when interfacing with Supabase.
- **Test Mock Updates**: Ensure test mocks match actual database schema structure.
- **Component Patterns**: IRLTemplateCard, IRLTemplateModal established in E6.1 - follow similar patterns.
- **Template Service**: `lib/services/irl-templates.ts` with caching pattern can be reused for IRL service.

**Key Files Created in E6.1:**
- `lib/types/irl.ts` - IRL type definitions (USE and extend)
- `lib/services/irl-templates.ts` - Template service (reference pattern)
- `components/irl/*.tsx` - Component patterns to follow
- `app/api/projects/[id]/irls/route.ts` - IRL creation API (extend)

**Schema Decision Required:**
The tech spec defines `irl_items` as a separate table, but E6.1 notes the existing `irls.sections` JSONB column stores items. This story should:
1. Either use the existing JSONB approach (simpler, no migration)
2. Or migrate to normalized `irl_items` table (per tech spec, more flexible)

Recommendation: Implement `irl_items` table per tech spec for better querying, status tracking, and future IRL-document linking in E6.5.

[Source: stories/e6-1-build-irl-builder-ui-with-template-selection.md#Dev-Agent-Record]

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-02 | Story drafted from tech spec E6.3 and epics.md | SM Agent |
