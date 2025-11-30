# Story 4.10: Implement Export Findings to CSV/Excel

Status: done

## Story

As an **M&A analyst**,
I want **to export findings to CSV and Excel formats**,
so that **I can share extracted intelligence with colleagues, import it into other tools, or create offline backups of validated findings**.

## Acceptance Criteria

1. **AC1: Export Button in Findings Browser**
   - Export button visible in the Findings Browser toolbar (next to view toggle)
   - Dropdown menu with format options: CSV, Excel (xlsx)
   - Button shows "Export" with download icon
   - Disabled state when no findings available
   - Keyboard accessible (Enter/Space to open dropdown)

2. **AC2: CSV Export**
   - Exports findings to a CSV file with proper escaping
   - Columns: Finding Text, Domain, Type, Confidence, Status, Source Document, Page/Cell Reference, Created Date
   - Respects current filters (only exports filtered findings)
   - UTF-8 encoding for international characters
   - Filename format: `findings-{project-name}-{date}.csv`
   - Download triggers immediately on selection

3. **AC3: Excel Export**
   - Exports findings to an xlsx file using exceljs
   - Single worksheet named "Findings"
   - Header row with bold formatting and freeze panes
   - Columns auto-sized to content width
   - Confidence column formatted as percentage
   - Domain and Status columns with color-coded cells matching UI badges
   - Filename format: `findings-{project-name}-{date}.xlsx`

4. **AC4: Filter-Aware Export**
   - Export respects all active filters (document, domain, type, confidence range, status)
   - Export respects current search query (if semantic search is active)
   - Export count shown in confirmation: "Export 42 findings?"
   - Maximum export limit of 5000 findings to prevent timeout
   - Warning shown if export would exceed limit: "Only first 5000 findings will be exported"

5. **AC5: Export Progress and Feedback**
   - Loading spinner shown during export generation
   - Toast notification on successful export: "Exported X findings to {filename}"
   - Error toast if export fails: "Export failed: {reason}"
   - For large exports (>500 findings), show progress indicator

6. **AC6: Server-Side Generation**
   - Export generated server-side via API route POST /api/projects/[id]/findings/export
   - Request body: `{ format: 'csv' | 'xlsx', filters: FindingFilters }`
   - Response: Binary file with appropriate Content-Type and Content-Disposition headers
   - API validates user has access to project (RLS)

7. **AC7: Accessibility**
   - Export dropdown menu accessible via keyboard
   - Screen reader announces export completion
   - Focus management returns to export button after completion
   - ARIA labels for export button and dropdown items

## Tasks / Subtasks

- [x] **Task 1: Install Export Dependencies** (AC: 3)
  - [x] Add `exceljs` package for Excel generation
  - [x] Add `csv-stringify` package for CSV generation
  - [x] Verify TypeScript types available

- [x] **Task 2: Create Export API Route** (AC: 2, 3, 6)
  - [x] Create `app/api/projects/[id]/findings/export/route.ts`
  - [x] Implement POST handler with format and filters parameters
  - [x] Add Zod schema for request validation
  - [x] Implement CSV generation using csv-stringify
  - [x] Implement Excel generation using exceljs
  - [x] Set appropriate response headers for file download
  - [x] Add 5000 finding limit with truncation

- [x] **Task 3: Create ExportDropdown Component** (AC: 1, 4, 5, 7)
  - [x] Create `components/knowledge-explorer/findings/ExportDropdown.tsx`
  - [x] Use shadcn/ui DropdownMenu component
  - [x] Add CSV and Excel options with icons
  - [x] Show finding count in dropdown items
  - [x] Implement loading state during export
  - [x] Add disabled state when no findings

- [x] **Task 4: Add Export API Client Function** (AC: 6)
  - [x] Add `exportFindings` function to `lib/api/findings.ts`
  - [x] Handle binary response and trigger download
  - [x] Accept format and filters parameters
  - [x] Return filename for toast notification

- [x] **Task 5: Integrate Export into FindingsBrowser** (AC: 1, 4, 5)
  - [x] Add ExportDropdown to FindingsBrowser toolbar
  - [x] Pass current filters and finding count to ExportDropdown
  - [x] Pass current search query if in search mode
  - [x] Add toast notifications for success/error
  - [x] Handle large export warning

- [x] **Task 6: Style Excel Output** (AC: 3)
  - [x] Apply header row formatting (bold, background color)
  - [x] Add freeze panes for header row
  - [x] Auto-size columns based on content
  - [x] Apply conditional formatting for confidence (green/yellow/red)
  - [x] Apply cell colors for domain badges

- [x] **Task 7: Write Component Tests** (AC: All)
  - [x] Test ExportDropdown rendering and interactions
  - [x] Test dropdown menu keyboard navigation
  - [x] Test disabled state when no findings
  - [x] Test loading state during export
  - [x] Test accessibility (ARIA labels, focus management)

- [x] **Task 8: Write API Route Tests** (AC: 2, 3, 6)
  - [x] Test validation (invalid format, missing format)
  - [x] Test authentication required
  - [x] Test 404 for non-existent project

## Dev Notes

### Architecture Context

**This story implements the Export Findings feature in Knowledge Explorer:**

| Layer | Technology | This Story's Role |
|-------|------------|-------------------|
| UI Components | React + shadcn/ui | **Creates** ExportDropdown component |
| API Routes | Next.js App Router | **Creates** /api/projects/[id]/findings/export endpoint |
| Libraries | exceljs, csv-stringify | **NEW** - Server-side export generation |
| Types | TypeScript | **Extends** with ExportFormat type |
| Data | Supabase | **Queries** findings table with filters |

**Export Flow:**

```
User clicks Export > CSV
         ↓
ExportDropdown shows loading spinner
         ↓
┌────────────────────────────────────────┐
│ POST /api/projects/[id]/findings/export│
│ Body: { format: 'csv', filters: {...} }│
│                                        │
│ 1. Query findings with filters         │
│ 2. Transform to export format          │
│ 3. Generate CSV/Excel binary           │
│ 4. Return with Content-Disposition     │
└────────────────────────────────────────┘
         ↓
Browser triggers file download
         ↓
Toast: "Exported 42 findings to findings-acme-2025-11-30.csv"
```

### Project Structure Notes

**New Files to Create:**

```
manda-app/
├── app/api/projects/[id]/findings/export/
│   └── route.ts                           ← NEW: POST export endpoint
├── components/knowledge-explorer/findings/
│   └── ExportDropdown.tsx                 ← NEW: Export dropdown component
├── lib/
│   └── services/
│       └── export.ts                      ← NEW: Export generation service (optional)
└── __tests__/
    ├── api/projects/findings/
    │   └── export.test.ts                 ← NEW: API route tests
    └── components/knowledge-explorer/findings/
        └── ExportDropdown.test.tsx        ← NEW: Component tests
```

**Existing Files to Modify:**

- `lib/api/findings.ts` - Add exportFindings function
- `lib/types/findings.ts` - Add ExportFormat type (optional)
- `components/knowledge-explorer/findings/FindingsBrowser.tsx` - Add ExportDropdown to toolbar
- `components/knowledge-explorer/findings/index.ts` - Export ExportDropdown

### Technical Constraints

**From Tech Spec (E4.10: Implement Export Findings to CSV/Excel):**
- POST /api/projects/[id]/findings/export
- Body: { format: 'csv' | 'xlsx', filters?: FindingFilters }
- Response: Binary file download
- Target performance: Export 500 findings < 10s

**From Architecture:**
- exceljs for Excel generation (recommended in tech spec)
- csv-stringify for CSV generation (recommended in tech spec)
- Server-side generation to handle large datasets
- Maximum 5000 findings per export (prevent timeout)

**Dependencies to Add:**
```json
{
  "exceljs": "^4.4.0",
  "csv-stringify": "^6.5.0"
}
```

### Learnings from Previous Story

**From Story e4-9 (Implement Finding Detail View with Full Context) - Status: done**

- **API Pattern**: Use Zod validation for request body
- **Error Handling**: Return appropriate HTTP status codes with error messages
- **Test Coverage**: 173 tests - maintain similar coverage for export tests
- **FindingFilters Interface**: Already exists in lib/types/findings.ts - use for export filters
- **buildQueryString**: Reuse from lib/api/findings.ts for consistent filter handling

**Files/Patterns to Reuse:**
- `lib/api/findings.ts` - Existing API client (extend with exportFindings, DO NOT RECREATE)
- `lib/types/findings.ts` - FindingFilters already defined
- `components/ui/dropdown-menu.tsx` - shadcn/ui dropdown component
- `components/ui/button.tsx` - Button with loading state

**Key Insight**: The existing `buildQueryString` function in findings.ts can be adapted for the export API, ensuring consistent filter handling.

[Source: stories/e4-9-implement-finding-detail-view-with-full-context.md#Completion-Notes]

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E4.md#E4.10]
- [Source: docs/sprint-artifacts/tech-spec-epic-E4.md#APIs-and-Interfaces]
- [Source: manda-app/lib/types/findings.ts#FindingFilters]
- [Source: manda-app/lib/api/findings.ts]
- [Source: stories/e4-9-implement-finding-detail-view-with-full-context.md#Completion-Notes]

## Dev Agent Record

### Context Reference

- [e4-10-implement-export-findings-to-csv-excel.context.xml](e4-10-implement-export-findings-to-csv-excel.context.xml)

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-30 | Story drafted from tech spec, epics, and previous story context | SM Agent |
