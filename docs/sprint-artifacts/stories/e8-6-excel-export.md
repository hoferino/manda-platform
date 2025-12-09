# Story 8.6: Excel Export

Status: done

## Story

As an analyst,
I want to export my Q&A list to a professionally formatted Excel file,
so that I can send it to the client for answers in a familiar, editable format.

## Acceptance Criteria

1. **AC1:** GET `/api/projects/[id]/qa/export` endpoint returns a valid `.xlsx` file
2. **AC2:** Excel file columns are: Question | Priority | Answer | Date Answered (in that order)
3. **AC3:** Rows are grouped by category with styled section headers (Financials, Legal, Operations, Market, Technology, HR)
4. **AC4:** Filter parameters (category, priority, status) apply before export - only matching items included
5. **AC5:** Filename follows pattern: `{company_name}_QA_List_{YYYY-MM-DD}.xlsx`
6. **AC6:** Professional formatting applied: styled headers, freeze panes, appropriate column widths, priority color-coding
7. **AC7:** Empty Answer and Date Answered columns for pending items (ready for client to fill)

## Tasks / Subtasks

- [x] **Task 1: Create Q&A Export Service** (AC: #1, #2, #3, #6)
  - [x] 1.1 Create `lib/services/qa-export.ts` with `generateQAExcel()` function
  - [x] 1.2 Use exceljs (already installed from E4.10) for Excel generation
  - [x] 1.3 Define columns: Question (wide), Priority, Answer (wide), Date Answered
  - [x] 1.4 Group items by category with styled category header rows
  - [x] 1.5 Apply priority color coding (High=red, Medium=yellow, Low=green text)
  - [x] 1.6 Apply professional styling: bold headers, gray background, freeze top row
  - [x] 1.7 Set appropriate column widths (Question: 60, Priority: 12, Answer: 50, Date: 18)
  - [x] 1.8 Write unit tests for export service (mock exceljs, verify structure)

- [x] **Task 2: Create Export API Route** (AC: #1, #4, #5)
  - [x] 2.1 Create `app/api/projects/[id]/qa/export/route.ts`
  - [x] 2.2 Accept query parameters: category, priority, status (pending|answered|all)
  - [x] 2.3 Fetch Q&A items using existing `getQAItems()` service with filters
  - [x] 2.4 Generate Excel buffer using `generateQAExcel()`
  - [x] 2.5 Fetch project name for filename from deals table
  - [x] 2.6 Sanitize company name for filename (replace special chars with dash)
  - [x] 2.7 Set response headers: Content-Type, Content-Disposition, Content-Length
  - [x] 2.8 Return Excel file as blob response
  - [x] 2.9 Write API route tests (verify status codes, headers, filter application)

- [x] **Task 3: Add Export Function to Client API** (AC: #1)
  - [x] 3.1 Add `exportQAToExcel()` function to `lib/api/qa.ts`
  - [x] 3.2 Accept filters parameter matching QAFilters type
  - [x] 3.3 Return blob with filename extracted from Content-Disposition header
  - [x] 3.4 Trigger browser download using anchor element method
  - [x] 3.5 Write unit tests for client function

- [x] **Task 4: Create Export Button Component** (AC: #4)
  - [x] 4.1 Create `components/qa/QAExportButton.tsx`
  - [x] 4.2 Accept current filters as props
  - [x] 4.3 Show loading state during export (spinner on button)
  - [x] 4.4 Display success toast with filename after download
  - [x] 4.5 Display error toast if export fails
  - [x] 4.6 Use Download icon from lucide-react
  - [x] 4.7 Write component tests (click, loading, error states)

- [x] **Task 5: Integrate Export into Q&A Management UI** (AC: #4)
  - [x] 5.1 Add QAExportButton to QA page toolbar (next to filter controls)
  - [x] 5.2 Pass current filter state from useQAItems hook to export button
  - [x] 5.3 Ensure export respects active filters
  - [ ] 5.4 Test integration end-to-end (manual verification) - Pending manual test

- [x] **Task 6: Category Grouping Implementation** (AC: #3)
  - [x] 6.1 In export service, group Q&A items by category
  - [x] 6.2 Add category header row before each group (merged cells, bold, background color)
  - [x] 6.3 Sort categories in consistent order: Financials, Legal, Operations, Market, Technology, HR
  - [x] 6.4 Add item count per category in header row
  - [x] 6.5 Add blank row after each category section for readability
  - [x] 6.6 Write tests verifying grouping structure

- [x] **Task 7: Empty Answer Handling** (AC: #7)
  - [x] 7.1 For items where date_answered is NULL, leave Answer and Date Answered cells empty
  - [x] 7.2 Add light gray background or "pending" placeholder style for empty answer cells
  - [x] 7.3 Ensure cells are unlocked/editable for client input
  - [x] 7.4 Write tests verifying pending items have empty answer columns

- [x] **Task 8: Verify Build and Run Tests** (AC: all)
  - [x] 8.1 Run `npm run build` - verify no TypeScript errors
  - [x] 8.2 Run unit tests for export service (15 tests passed)
  - [x] 8.3 Run component tests for QAExportButton (11 tests passed)
  - [x] 8.4 Run API route tests (12 tests passed)
  - [ ] 8.5 Manual E2E test: export filtered Q&A list, verify Excel content - Pending manual test

## Dev Notes

### Architecture Patterns and Constraints

- **Service Layer Pattern:** Follow existing `lib/services/` patterns. Export logic goes in `qa-export.ts`, separate from CRUD in `qa.ts`.
- **API Route Pattern:** Match existing export routes at `app/api/projects/[id]/qa/export/route.ts`. Only GET method needed.
- **Excel Library:** Use exceljs (already installed from E4.10 findings export). Do NOT use xlsx or SheetJS.
- **File Download Pattern:** Return blob response with proper headers. Client triggers download via anchor element.

[Source: docs/sprint-artifacts/tech-spec-epic-E8.md#Services-and-Modules]

### Column Specification

| Column | Header Text | Width | Format | Notes |
|--------|-------------|-------|--------|-------|
| A | Question | 60 | Text wrap | Main question text |
| B | Priority | 12 | Centered | HIGH/MED/LOW with color |
| C | Answer | 50 | Text wrap | Empty for pending items |
| D | Date Answered | 18 | Date format | Empty for pending items |

[Source: docs/sprint-artifacts/tech-spec-epic-E8.md#E8.6-Excel-Export]

### Priority Color Coding

| Priority | Text Color | Background |
|----------|------------|------------|
| high | #DC2626 (red-600) | None |
| medium | #F59E0B (amber-500) | None |
| low | #10B981 (emerald-500) | None |

Match the color scheme used in IRL export and findings export for consistency.

[Source: manda-app/lib/services/irl-export.ts#PRIORITY_COLORS]

### Category Order

Categories should appear in this fixed order for consistency:
1. Financials
2. Legal
3. Operations
4. Market
5. Technology
6. HR

Categories with 0 items should be omitted from export.

[Source: docs/sprint-artifacts/tech-spec-epic-E8.md#TypeScript-Types]

### Existing Patterns to Follow

The findings export at `app/api/projects/[id]/findings/export/route.ts` provides a good reference:
- Uses exceljs with professional styling
- Applies color coding for domains
- Sets freeze panes and column widths
- Returns proper blob response with headers

The IRL export at `lib/services/irl-export.ts` shows grouping patterns:
- `groupItemsByCategory()` function for category grouping
- Category header rows with item counts
- Professional table formatting

[Source: manda-app/app/api/projects/[id]/findings/export/route.ts]
[Source: manda-app/lib/services/irl-export.ts]

### Project Structure Notes

**New Files:**
- `manda-app/lib/services/qa-export.ts` - Excel generation service
- `manda-app/app/api/projects/[id]/qa/export/route.ts` - Export API route
- `manda-app/components/qa/QAExportButton.tsx` - Export button component
- `manda-app/__tests__/lib/services/qa-export.test.ts` - Service tests
- `manda-app/__tests__/components/qa/QAExportButton.test.tsx` - Component tests
- `manda-app/__tests__/app/api/projects/qa-export.test.ts` - API route tests

**Modified Files:**
- `manda-app/lib/api/qa.ts` - Add `exportQAToExcel()` client function
- `manda-app/app/projects/[id]/qa/page.tsx` or `QAPageClient.tsx` - Add export button to toolbar

### Learnings from Previous Story

**From Story e8-5-finding-to-qa-quickadd (Status: in-progress)**

- **New Utility Created:** `lib/utils/finding-qa-mapping.ts` with `mapDomainToQACategory()` - maps finding domains to Q&A categories. Reference this for category validation.
- **New Components Created:**
  - `components/knowledge-explorer/findings/AddToQAModal.tsx` - Modal pattern with pre-population
  - `components/knowledge-explorer/findings/QAExistsIndicator.tsx` - Badge/link pattern
- **New API Routes Created:**
  - `/api/projects/[id]/qa/by-finding/[findingId]` - Pattern for finding-specific Q&A lookup
  - `/api/projects/[id]/qa/check-findings` - Batch existence check pattern
- **Q&A Service Usage:** `createQAItem()` from `lib/api/qa.ts` works correctly with sourceFindingId
- **Integration Pattern:** FindingsBrowser manages modal state and passes callbacks to child components
- **Question Drafting:** Template patterns for professional, client-facing question text established

**From E8.5 Dev Notes - Key Patterns to Reuse:**
- API route follows `/api/projects/[id]/qa/*` pattern
- Component tests use React Testing Library with existing mock patterns
- Toast notifications for success/error feedback
- Loading states with spinner on buttons

[Source: docs/sprint-artifacts/stories/e8-5-finding-to-qa-quickadd.md#Dev-Notes]

**From Story e4-10-implement-export-findings-to-csv-excel (Status: done)**

- **exceljs Pattern:** Use `new ExcelJS.Workbook()`, define columns, add rows, style cells
- **Freeze Panes:** `views: [{ state: 'frozen', ySplit: 1 }]` to freeze header row
- **Color Styling:** Use `{ argb: 'FFXXXXXX' }` format for colors
- **Blob Response:** `await workbook.xlsx.writeBuffer()` then return as Response blob
- **File Headers:** Content-Type, Content-Disposition with filename, Content-Length

### Filter Parameters

The export endpoint should accept these query parameters:
- `category` (optional): Filter by category (Financials, Legal, etc.)
- `priority` (optional): Filter by priority (high, medium, low)
- `status` (optional): 'pending' | 'answered' | 'all' (default: 'all')

These map directly to `QAFilters` type from `lib/types/qa.ts`.

### Performance Considerations

- Q&A lists are typically small (50-200 items), so no pagination needed for export
- If > 500 items, consider streaming or progress indicator
- Category grouping should be done in memory after fetching all items

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E8.md#E8.6-Excel-Export] - AC definitions AC-8.6.1 through AC-8.6.5
- [Source: docs/epics.md#Story-E8.6] - Story definition and gherkin scenarios
- [Source: manda-app/lib/services/qa.ts] - Q&A CRUD service with getQAItems()
- [Source: manda-app/lib/types/qa.ts] - QAItem, QACategory, QAFilters types
- [Source: manda-app/app/api/projects/[id]/findings/export/route.ts] - Excel export pattern reference
- [Source: manda-app/lib/services/irl-export.ts] - Category grouping pattern reference

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/stories/e8-6-excel-export.context.xml

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - Implementation proceeded without significant issues

### Completion Notes List

- **Export Service:** Created `lib/services/qa-export.ts` with `generateQAExcel()` and `groupQAItemsByCategory()` helper functions
- **API Route:** GET endpoint at `/api/projects/[id]/qa/export` with filter support for category, priority, status
- **Client API:** Added `exportQAToExcel()` and `downloadQAExcel()` functions to `lib/api/qa.ts`
- **Export Button:** Created `QAExportButton` component with loading state, success/error toasts
- **UI Integration:** Export button added to Q&A management page toolbar, respects active filters
- **Category Grouping:** Items grouped by category in fixed order (Financials, Legal, Operations, Market, Technology, HR) with item counts
- **Empty Answer Handling:** Pending items have empty Answer/Date Answered cells with light gray background
- **Tests:** 38 total tests (15 service + 11 component + 12 API route)
- **Build:** TypeScript compilation passes

### File List

**New Files:**
- `manda-app/lib/services/qa-export.ts` - Excel generation service
- `manda-app/app/api/projects/[id]/qa/export/route.ts` - Export API endpoint
- `manda-app/components/qa/QAExportButton.tsx` - Export button component
- `manda-app/__tests__/lib/services/qa-export.test.ts` - Service tests (15 tests)
- `manda-app/__tests__/components/qa/QAExportButton.test.tsx` - Component tests (11 tests)
- `manda-app/__tests__/app/api/projects/qa-export.test.ts` - API route tests (12 tests)

**Modified Files:**
- `manda-app/lib/api/qa.ts` - Added exportQAToExcel() and downloadQAExcel() functions
- `manda-app/components/qa/index.ts` - Added QAExportButton export
- `manda-app/components/qa/QAPageClient.tsx` - Integrated export button in toolbar

## Change Log

| Date | Author | Change Description |
|------|--------|-------------------|
| 2025-12-09 | SM Agent | Initial story creation from Epic 8 tech spec and epics.md |
| 2025-12-09 | Dev Agent | Implemented Excel export with all ACs - service, API route, client API, component, UI integration, tests |