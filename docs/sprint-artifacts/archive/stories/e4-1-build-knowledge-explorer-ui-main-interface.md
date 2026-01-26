# Story 4.1: Build Knowledge Explorer UI Main Interface

Status: completed

## Story

As an **M&A analyst**,
I want **to view all extracted findings in a table format with filtering, sorting, and pagination**,
so that **I can quickly scan and review the intelligence extracted from my deal documents**.

## Acceptance Criteria

1. **AC1: Knowledge Explorer Route and Layout**
   - Knowledge Explorer accessible at `/projects/[id]/knowledge-explorer`
   - Page displays tab navigation (Findings, Contradictions, Gap Analysis)
   - Findings Browser tab is the default view
   - Layout follows UX design with filters on top, table as main content
   - Loading skeleton shows while data fetches

2. **AC2: Findings Table View**
   - Display findings in a shadcn/ui DataTable with columns:
     - Finding (text, truncated to 2 lines with hover to expand)
     - Source (document name with page/cell reference)
     - Domain (badge: financial, operational, market, legal, technical)
     - Confidence (percentage with color indicator)
     - Status (pending, validated, rejected)
     - Actions (validate, reject, edit buttons)
   - Table shows 50 items per page with pagination controls
   - Empty state displays when no findings exist with helpful message

3. **AC3: Sorting Functionality**
   - Sortable columns: Confidence, Domain, Created Date
   - Click column header toggles sort direction (asc/desc)
   - Sort state persists during session
   - Default sort: Created Date (newest first)

4. **AC4: Filter Controls**
   - Filter by Document: Dropdown of all documents in the project
   - Filter by Domain: Multi-select checkboxes (financial, operational, market, legal, technical)
   - Filter by Confidence Range: Slider or preset buttons (High >80%, Medium 60-80%, Low <60%)
   - Filter by Status: Checkboxes (pending, validated, rejected)
   - "Clear All Filters" button resets to default view
   - Active filters shown as badges with individual remove buttons
   - Filter count indicator shows "Showing X of Y findings"

5. **AC5: API Integration**
   - Fetch findings via `GET /api/projects/[id]/findings` endpoint
   - Pass filter parameters as query string
   - Handle loading, error, and empty states gracefully
   - Implement React Query for caching and refetch on filter change
   - API returns paginated response: `{ findings: Finding[], total: number, page: number }`

6. **AC6: Performance Requirements**
   - Initial page load < 500ms (time to first contentful paint)
   - Filter application < 300ms (perceived response)
   - Pagination navigation < 300ms
   - Use server components for initial data fetch
   - Implement optimistic updates for smooth UX

7. **AC7: Responsive Design**
   - Table readable on desktop (1280px+) with all columns visible
   - Tablet (768-1279px): Horizontal scroll for table, collapsible filters
   - Actions column always visible (sticky right)

8. **AC8: Accessibility**
   - WCAG 2.1 Level AA compliance
   - Keyboard navigation for all interactive elements
   - Screen reader friendly table with proper ARIA labels
   - Focus indicators on interactive elements
   - Color-blind friendly confidence indicators (not color-only)

## Tasks / Subtasks

- [x] **Task 1: Create Database Migration for Findings Status** (AC: 2, 5)
  - [x] Write migration `00021_add_findings_status_column.sql`
  - [x] Add `status` column (varchar(20) DEFAULT 'pending')
  - [x] Add `validation_history` JSONB column for audit trail
  - [x] Create index on `status` column
  - [x] Run migration and verify schema

- [x] **Task 2: Create Findings API Route** (AC: 5)
  - [x] Create `app/api/projects/[id]/findings/route.ts`
  - [x] Implement GET handler with query parameters:
    - `documentId`, `domain[]`, `confidenceMin`, `confidenceMax`
    - `status`, `sortBy`, `sortOrder`, `page`, `limit`
  - [x] Add Zod schema for query parameter validation
  - [x] Implement Supabase query with filters
  - [x] Return paginated response with total count
  - [x] Add proper error handling (400, 404, 500)

- [x] **Task 3: Create FindingsService** (AC: 5)
  - [x] Create `lib/api/findings.ts` (client-side service)
  - [x] Implement `getFindings(projectId, filters)` method
  - [x] Implement `validateFinding(projectId, findingId, action)` method
  - [x] Create TypeScript interfaces in `lib/types/findings.ts`:
    - `Finding`, `FindingFilters`, `FindingStats`
    - `FindingDomain`, `FindingType`, `FindingStatus` types
  - [x] Add helper functions for domain/type/status display

- [x] **Task 4: Build Knowledge Explorer Page Structure** (AC: 1)
  - [x] Update `app/projects/[id]/knowledge-explorer/page.tsx` (Server Component)
  - [x] Create `components/knowledge-explorer/KnowledgeExplorerClient.tsx` (Client Component)
  - [x] Implement tab navigation (Findings, Contradictions, Gap Analysis)
  - [x] Loading skeleton integrated in table component

- [x] **Task 5: Build Findings Browser Component** (AC: 2, 7)
  - [x] Create `components/knowledge-explorer/findings/FindingsBrowser.tsx`
  - [x] Create `components/knowledge-explorer/findings/FindingsTable.tsx`
  - [x] Integrate @tanstack/react-table for DataTable
  - [x] Implement column definitions:
    - Finding text with truncation and hover expand
    - Source with document name + page reference
    - Domain badge component
    - Confidence badge with color indicator
    - Status badge
    - Actions column (validate/reject/edit buttons)
  - [x] Add pagination controls (50 per page)
  - [x] Create empty state component

- [x] **Task 6: Build Filter Components** (AC: 4)
  - [x] Create `components/knowledge-explorer/findings/FindingFilters.tsx`
  - [x] Implement document dropdown filter
  - [x] Implement domain multi-select checkboxes
  - [x] Implement confidence range filter (preset buttons)
  - [x] Implement status checkboxes
  - [x] Create active filter badges with remove buttons
  - [x] Add "Clear All Filters" button
  - [x] Add filter count indicator

- [x] **Task 7: Build Shared Components** (AC: 2, 8)
  - [x] Create `components/knowledge-explorer/shared/ConfidenceBadge.tsx`
    - Color coding: green (>80%), yellow (60-80%), red (<60%)
    - Show percentage value
    - Accessible (icon + text, tooltip with explanation)
  - [x] Create `components/knowledge-explorer/shared/DomainTag.tsx`
    - Badge with domain name and icon
    - Consistent colors per domain
  - [x] Create `components/knowledge-explorer/shared/StatusBadge.tsx`

- [x] **Task 8: Implement Client-Side Data Management** (AC: 5, 6)
  - [x] Implement React state for findings data fetching
  - [x] Implement filter state management (local state)
  - [x] Implement optimistic UI for validation actions
  - [x] Add error handling with toast notifications

- [x] **Task 9: Write Tests** (AC: All)
  - [x] Component tests for FindingsTable (22 tests passing)
    - Rendering tests
    - Pagination tests
    - Sorting tests
    - Actions tests
    - Accessibility tests

## Dev Notes

### Architecture Context

**This story establishes the Knowledge Explorer UI foundation for Epic 4:**

| Layer | Technology | This Story's Role |
|-------|------------|-------------------|
| UI Components | Next.js + shadcn/ui + @tanstack/react-table | **Creates** main UI structure |
| Data Fetching | React Query + Server Components | **Implements** optimized data fetching |
| API Layer | Next.js API Routes | **Creates** findings API endpoint |
| Database | Supabase (PostgreSQL) | **Adds** status column migration |
| State Management | URL params + React Query | **Implements** filter state |

**Component Architecture:**

```
/projects/[id]/knowledge-explorer/
├── page.tsx (Server Component - initial data fetch)
├── components/
│   ├── KnowledgeExplorerClient.tsx (Client - tab navigation)
│   └── findings/
│       ├── FindingsBrowser.tsx (Container)
│       ├── FindingsTable.tsx (DataTable)
│       ├── FindingFilters.tsx (Filter controls)
│       └── shared/
│           ├── ConfidenceBadge.tsx
│           ├── DomainTag.tsx
│           └── StatusBadge.tsx
```

### Project Structure Notes

**New Files to Create:**

```
manda-app/
├── app/
│   ├── api/projects/[id]/findings/
│   │   └── route.ts
│   └── (dashboard)/projects/[id]/knowledge-explorer/
│       └── page.tsx
├── components/knowledge-explorer/
│   ├── KnowledgeExplorerClient.tsx
│   └── findings/
│       ├── FindingsBrowser.tsx
│       ├── FindingsTable.tsx
│       ├── FindingFilters.tsx
│       └── shared/
│           ├── ConfidenceBadge.tsx
│           ├── DomainTag.tsx
│           └── StatusBadge.tsx
├── lib/
│   ├── services/findings.ts
│   └── types/findings.ts
└── supabase/migrations/
    └── 00021_add_findings_status_column.sql
```

**Existing Files to Modify:**
- `app/(dashboard)/projects/[id]/layout.tsx` - Add Knowledge Explorer to sidebar navigation
- `components/sidebar.tsx` - Add navigation item

### Technical Constraints

**From Architecture:**
- Use shadcn/ui components (DataTable, Badge, Select, Checkbox)
- Follow existing Supabase client patterns from `lib/supabase/client.ts`
- RLS policies enforce user isolation (findings.deal_id must belong to auth.uid())
- Use Server Components for initial data fetch, Client Components for interactivity

**Performance Targets (from Tech Spec):**
- Initial page load < 500ms
- Filter application < 300ms
- Pagination navigation < 300ms

**Database Schema (from Tech Spec):**
```sql
-- Existing findings table + new columns
ALTER TABLE findings ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'pending';
ALTER TABLE findings ADD COLUMN IF NOT EXISTS validation_history jsonb DEFAULT '[]';
CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(status);
```

**TypeScript Interfaces (from Tech Spec):**
```typescript
export type FindingDomain = 'financial' | 'operational' | 'market' | 'legal' | 'technical'
export type FindingType = 'metric' | 'fact' | 'risk' | 'opportunity' | 'contradiction'
export type FindingStatus = 'pending' | 'validated' | 'rejected'

export interface Finding {
  id: string
  dealId: string
  documentId: string | null
  text: string
  sourceDocument: string | null
  pageNumber: number | null
  confidence: number | null
  findingType: FindingType
  domain: FindingDomain
  status: FindingStatus
  createdAt: string
}
```

### Out of Scope (Deferred to Later Stories)

| Item | Reason | Planned For |
|------|--------|-------------|
| **Inline validation (✓/✗/Edit)** | Separate story for validation workflow | E4.3 |
| **Semantic search** | Requires OpenAI embedding integration | E4.2 |
| **Card view alternative** | Table view is primary, card is enhancement | E4.4 |
| **Source attribution modal** | Requires document preview integration | E4.5 |
| **Contradictions tab content** | Separate functionality | E4.6 |
| **Gap analysis tab content** | Separate functionality | E4.8 |

### Dependencies

**New Dependencies to Install:**
```bash
npm install @tanstack/react-table
```

**Existing Dependencies to Use:**
- `@supabase/supabase-js` - Database client
- `@tanstack/react-query` - Data fetching (if not already installed, add it)
- `lucide-react` - Icons
- `zod` - Schema validation
- shadcn/ui components (already installed)

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E4.md#E4.1-Findings-Browser-Table-View]
- [Source: docs/sprint-artifacts/tech-spec-epic-E4.md#Detailed-Design]
- [Source: docs/sprint-artifacts/tech-spec-epic-E4.md#APIs-and-Interfaces]
- [Source: docs/epics.md#Story-E4.1-Build-Findings-Browser-with-Table-View]
- [Source: docs/ux-design-specification.md#5.3-Knowledge-Explorer]
- [Source: docs/manda-architecture.md#Frontend-Architecture]

### Learnings from Previous Story

**From Story e3-9 (Financial Model Integration):**

- **Job handler pattern**: Follow existing patterns in `manda-processing/src/jobs/handlers/`
- **Supabase client methods**: Add service layer methods following `supabase_client.py` patterns
- **API route structure**: Follow FastAPI router patterns from Epic 3 for consistency
- **Test coverage**: Maintain 80%+ coverage on new code
- **Code review process**: Address HIGH priority issues immediately, refactor duplicates

**Key Patterns to Reuse:**
- Error handling patterns from Epic 3
- Pydantic/Zod schema validation approach
- Service layer abstraction for database operations

## Dev Agent Record

### Context Reference

docs/sprint-artifacts/stories/e4-1-build-knowledge-explorer-ui-main-interface.context.xml

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

**Implementation completed 2025-11-28**

1. **Database Migration**: Created `00021_add_findings_status_column.sql` to add `status` and `validation_history` columns to findings table.

2. **API Route**: Implemented `/api/projects/[id]/findings` with full query parameter support for filtering, sorting, and pagination. Uses Zod for validation.

3. **TypeScript Types**: Created comprehensive type system in `lib/types/findings.ts` with helper functions for display formatting.

4. **Client Service**: Created `lib/api/findings.ts` with functions for fetching, creating, and validating findings.

5. **Knowledge Explorer UI**:
   - Tab navigation with Findings, Contradictions, Gap Analysis tabs
   - FindingsBrowser with filters and table
   - @tanstack/react-table DataTable with sorting and pagination
   - Responsive filter controls with collapsible sections
   - Shared badge components (Confidence, Domain, Status)

6. **Testing**: 22 component tests for FindingsTable covering rendering, pagination, sorting, actions, and accessibility.

7. **Build**: Application builds successfully with no TypeScript errors in new code.

### File List

**New Files (Created):**
- `manda-app/supabase/migrations/00021_add_findings_status_column.sql` - Database migration
- `manda-app/app/api/projects/[id]/findings/route.ts` - API route with GET/POST handlers
- `manda-app/lib/types/findings.ts` - TypeScript types and helpers
- `manda-app/lib/api/findings.ts` - Client-side service functions
- `manda-app/components/knowledge-explorer/index.ts` - Component exports
- `manda-app/components/knowledge-explorer/KnowledgeExplorerClient.tsx` - Tab navigation
- `manda-app/components/knowledge-explorer/findings/index.ts` - Findings exports
- `manda-app/components/knowledge-explorer/findings/FindingsBrowser.tsx` - Container component
- `manda-app/components/knowledge-explorer/findings/FindingsTable.tsx` - DataTable with actions
- `manda-app/components/knowledge-explorer/findings/FindingFilters.tsx` - Filter controls
- `manda-app/components/knowledge-explorer/shared/index.ts` - Shared exports
- `manda-app/components/knowledge-explorer/shared/ConfidenceBadge.tsx` - Confidence display
- `manda-app/components/knowledge-explorer/shared/DomainTag.tsx` - Domain badge
- `manda-app/components/knowledge-explorer/shared/StatusBadge.tsx` - Status badge
- `manda-app/__tests__/components/knowledge-explorer/findings-table.test.tsx` - Unit tests

**Modified Files:**
- `manda-app/app/projects/[id]/knowledge-explorer/page.tsx` - Updated from placeholder to full implementation

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-28 | Story drafted from tech spec and epics | SM Agent |
| 2025-11-28 | Story implementation completed - all 9 tasks done | Dev Agent |
