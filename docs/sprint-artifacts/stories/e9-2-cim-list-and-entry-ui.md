# Story 9.2: CIM List & Entry UI

Status: complete

## Story

As a **M&A analyst**,
I want **a CIM list view showing all CIMs for a deal with ability to create, open, and delete CIMs**,
so that **I can manage multiple CIM versions and quickly access the CIM Builder for any deal**.

## Acceptance Criteria

1. **AC #1: CIM List Route** - CIM list view accessible at `/projects/[id]/cim-builder` (Navigate to URL)
2. **AC #2: CIM Card Display** - CIM cards display: name, last updated timestamp, and progress indicator (Visual inspection)
3. **AC #3: Create CIM Flow** - "Create New CIM" button opens name input dialog (Click button, see dialog)
4. **AC #4: CIM Navigation** - Click CIM card navigates to builder with CIM loaded at `/projects/[id]/cim-builder/[cimId]` (Click card, see builder)
5. **AC #5: Delete CIM Flow** - Delete CIM shows confirmation dialog, removes from list after confirmation (Delete, confirm gone)
6. **AC #6: Empty State** - Empty state displays when no CIMs exist for deal with helpful messaging (View empty deal)

## Tasks / Subtasks

- [x] Task 1: Create CIM List page route (AC: #1)
  - [x] 1.1: Create `app/projects/[id]/cim-builder/page.tsx` page component
  - [x] 1.2: Add server-side authentication check (redirect to login if unauthenticated)
  - [x] 1.3: Verify route renders correctly at `/projects/[id]/cim-builder`

- [x] Task 2: Build CIM list client components (AC: #2)
  - [x] 2.1: Create `components/cim-builder/CIMListPage.tsx` client component
  - [x] 2.2: Create `components/cim-builder/CIMCard.tsx` with name, updated timestamp, progress
  - [x] 2.3: Implement `CIMProgressIndicator` showing workflow phase progress
  - [x] 2.4: Create `useCIMs` hook in `lib/hooks/useCIMs.ts` for data fetching
  - [x] 2.5: Integrate with existing project workspace layout

- [x] Task 3: Implement Create CIM flow (AC: #3)
  - [x] 3.1: Create `CreateCIMDialog.tsx` with name input field
  - [x] 3.2: Add Zod validation for CIM name (3-100 characters, required)
  - [x] 3.3: Connect to POST `/api/projects/[id]/cims` endpoint
  - [x] 3.4: Handle loading and error states with toast notifications
  - [x] 3.5: Refresh CIM list after successful creation

- [x] Task 4: Implement CIM card navigation (AC: #4)
  - [x] 4.1: Add click handler to CIMCard that navigates to `/projects/[id]/cim-builder/[cimId]`
  - [x] 4.2: Create placeholder `app/projects/[id]/cim-builder/[cimId]/page.tsx` for E9.3
  - [x] 4.3: Use Next.js router for client-side navigation

- [x] Task 5: Implement Delete CIM flow (AC: #5)
  - [x] 5.1: Create `DeleteCIMDialog.tsx` confirmation dialog
  - [x] 5.2: Add delete button (trash icon) to CIMCard with kebab menu
  - [x] 5.3: Connect to DELETE `/api/projects/[id]/cims/[cimId]` endpoint
  - [x] 5.4: Handle optimistic UI update with rollback on error
  - [x] 5.5: Show success/error toast notifications

- [x] Task 6: Implement empty state (AC: #6)
  - [x] 6.1: Create `CIMEmptyState.tsx` component with illustration placeholder
  - [x] 6.2: Display message: "No CIMs yet" with description text
  - [x] 6.3: Include "Create your first CIM" button that opens CreateCIMDialog

- [x] Task 7: Add sidebar navigation entry (AC: #1)
  - [x] 7.1: Add "CIM Builder" link to project workspace sidebar (similar to Q&A, IRL)
  - [x] 7.2: Use appropriate icon (Presentation)
  - [x] 7.3: Highlight active state when on `/projects/[id]/cim-builder/*` routes

- [x] Task 8: Testing (AC: #1-6)
  - [x] 8.1: Unit tests for CIMCard component (rendering, click handlers)
  - [x] 8.2: Unit tests for CreateCIMDialog (validation, submission)
  - [x] 8.3: Unit tests for DeleteCIMDialog (confirmation flow)
  - [x] 8.4: Unit tests for CIMEmptyState (rendering, button click)
  - [x] 8.5: Unit tests for useCIMs hook (fetch, create, delete operations)
  - [x] 8.6: Build verification (TypeScript type-check passes)

## Dev Notes

### Architecture Alignment

This story builds the entry point UI for the CIM Builder feature. The CIM list follows existing patterns in the codebase:
- Similar to Q&A page route (`app/projects/[id]/qa/page.tsx`) for list views
- Similar to IRL page route (`app/projects/[id]/deliverables/page.tsx`) for workspace integration
- Uses existing dialog components from shadcn/ui (Dialog, AlertDialog)

The CIM Builder is the core value-add of the Manda platform - M&A analysts are paid to create CIMs and present them to buyers. This UI provides the entry point to that workflow.

### Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Page Structure | Server + Client component split | Server component handles auth, client handles interactivity |
| Data Fetching | useCIMs hook with SWR pattern | Consistent with existing hooks (useQAItems, useIRLs) |
| Progress Display | Phase-based progress bar | Aligns with WorkflowState phases from E9.1 types |
| Dialog Pattern | shadcn/ui Dialog + AlertDialog | Existing UI patterns; AlertDialog for delete confirmation |

### Component Structure

```
app/projects/[id]/cim-builder/
├── page.tsx                    # Server component (auth, metadata)
└── [cimId]/
    └── page.tsx                # Placeholder for E9.3 (3-panel builder)

components/cim-builder/
├── CIMListPage.tsx             # Main list view client component
├── CIMCard.tsx                 # Individual CIM card
├── CIMProgressIndicator.tsx    # Workflow phase progress bar
├── CIMEmptyState.tsx           # Empty state with CTA
├── CreateCIMDialog.tsx         # Name input dialog
└── DeleteCIMDialog.tsx         # Confirmation dialog

lib/hooks/
└── useCIMs.ts                  # Data fetching hook
```

### API Integration

Uses endpoints created in E9.1:
- `GET /api/projects/[id]/cims` - List CIMs for deal
- `POST /api/projects/[id]/cims` - Create new CIM
- `DELETE /api/projects/[id]/cims/[cimId]` - Delete CIM

### Progress Indicator Design

The CIMProgressIndicator shows workflow phase progress:
- **persona** (0-14%) → **thesis** (15-28%) → **outline** (29-42%) → **content_creation** (43-71%) → **visual_concepts** (72-85%) → **review** (86-99%) → **complete** (100%)
- Use `calculateCIMProgress()` helper from `lib/types/cim.ts`

### Testing Strategy

Follow existing patterns from Q&A and IRL component tests:
- Mock Supabase client responses
- Test component rendering with various CIM states
- Test dialog open/close flows
- Test error handling and loading states

### Project Structure Notes

- New page route: `app/projects/[id]/cim-builder/page.tsx`
- New components directory: `components/cim-builder/`
- New hook: `lib/hooks/useCIMs.ts`
- Sidebar navigation update: `components/project-workspace/ProjectSidebar.tsx`

### Learnings from Previous Story

**From Story e9-1-cim-database-schema-and-deal-integration (Status: complete)**

- **New Service Created**: `lib/services/cim.ts` with full CRUD operations - use `getCIMsForDeal()`, `createCIM()`, `deleteCIM()` methods
- **TypeScript Types**: `lib/types/cim.ts` has comprehensive types including `CIM`, `WorkflowState`, `CIMPhase` - import from there
- **Helper Functions**: `calculateCIMProgress()` and `getWorkflowStateDescription()` available in types file
- **API Routes Ready**: REST endpoints at `/api/projects/[id]/cims` and `/api/projects/[id]/cims/[cimId]` fully functional
- **Database Schema**: `cims` table extended with JSONB columns for workflow_state, slides, buyer_persona, outline, dependency_graph, conversation_history
- **RLS Policies**: Four granular policies (SELECT, INSERT, UPDATE, DELETE) enforce deal-based access control

[Source: stories/e9-1-cim-database-schema-and-deal-integration.md#Dev-Agent-Record]

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E9.md#E9.2-CIM-List-&-Entry-UI] - Acceptance criteria definitions
- [Source: docs/sprint-artifacts/tech-spec-epic-E9.md#Detailed-Design] - Component structure and UI specifications
- [Source: docs/sprint-artifacts/tech-spec-epic-E9.md#APIs-and-Interfaces] - API endpoint contracts
- [Source: stories/e9-1-cim-database-schema-and-deal-integration.md] - CIM service and types created in E9.1

## Dev Agent Record

### Context Reference

- [e9-2-cim-list-and-entry-ui.context.xml](./e9-2-cim-list-and-entry-ui.context.xml)

### Agent Model Used

Claude Opus 4.5

### Debug Log References

- All tasks executed sequentially
- TypeScript type-check passes
- Build successful
- 67 unit tests passing

### Completion Notes List

1. Created CIM Builder list page at `/projects/[id]/cim-builder` with server-side auth
2. Built 6 client components: CIMListPage, CIMCard, CIMProgressIndicator, CIMEmptyState, CreateCIMDialog, DeleteCIMDialog
3. Added useCIMs hook for data fetching with optimistic updates
4. Integrated Create CIM flow with name validation (3-100 chars)
5. Implemented delete with confirmation dialog and optimistic UI
6. Added placeholder page for CIM Builder editor at `/projects/[id]/cim-builder/[cimId]`
7. Added "CIM Builder" to sidebar navigation with Presentation icon
8. Extended Progress component with indicatorClassName prop for color customization
9. All 6 acceptance criteria verified

### File List

**New Files Created:**
- `manda-app/app/projects/[id]/cim-builder/page.tsx` - CIM list page route
- `manda-app/app/projects/[id]/cim-builder/[cimId]/page.tsx` - CIM editor placeholder
- `manda-app/components/cim-builder/CIMListPage.tsx` - Main list client component
- `manda-app/components/cim-builder/CIMCard.tsx` - CIM card component
- `manda-app/components/cim-builder/CIMProgressIndicator.tsx` - Progress bar component
- `manda-app/components/cim-builder/CIMEmptyState.tsx` - Empty state component
- `manda-app/components/cim-builder/CreateCIMDialog.tsx` - Create dialog
- `manda-app/components/cim-builder/DeleteCIMDialog.tsx` - Delete confirmation dialog
- `manda-app/lib/hooks/useCIMs.ts` - Data fetching hook
- `manda-app/__tests__/components/cim-builder/CIMCard.test.tsx` - CIMCard tests
- `manda-app/__tests__/components/cim-builder/CreateCIMDialog.test.tsx` - CreateCIMDialog tests
- `manda-app/__tests__/components/cim-builder/DeleteCIMDialog.test.tsx` - DeleteCIMDialog tests
- `manda-app/__tests__/components/cim-builder/CIMEmptyState.test.tsx` - CIMEmptyState tests
- `manda-app/__tests__/hooks/useCIMs.test.ts` - useCIMs hook tests

**Modified Files:**
- `manda-app/lib/workspace-navigation.ts` - Added CIM Builder nav entry with Presentation icon
- `manda-app/components/ui/progress.tsx` - Extended with indicatorClassName prop

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-10 | Story drafted from tech spec E9 | SM Agent |
| 2025-12-10 | Story context generated, status → ready-for-dev | Story Context Workflow |
| 2025-12-10 | Story implemented, all ACs complete, status → complete | Dev Agent |