# Story 4.12: Implement Export Findings Feature (Advanced)

Status: done
Completed: 2025-11-30

## Story

As an **M&A analyst**,
I want **to export findings to various formats with customizable field selection and export scope options**,
so that **I can use the intelligence in reports and presentations with exactly the columns and data I need**.

## Acceptance Criteria

1. **AC1: Export Modal with Format Selection**
   - Clicking "Export" button opens a modal dialog instead of dropdown
   - Modal shows format options: CSV, Excel, Report (PDF/formatted)
   - Each format has a description of what it includes
   - Modal has Cancel and Export buttons
   - Modal is keyboard accessible (Escape to close, Tab navigation)

2. **AC2: Field Selection Checkboxes**
   - Modal includes a "Fields" section with checkboxes for each column
   - Available fields: Finding Text, Source Document, Page/Cell, Domain, Type, Confidence, Status, Created Date
   - All fields checked by default
   - "Select All" / "Deselect All" quick actions
   - At least one field must be selected (Export button disabled if none)
   - Field selection order determines column order in export

3. **AC3: Export Scope Selection**
   - Radio buttons for export scope:
     - "Export All" - All findings (respecting current filters)
     - "Export Filtered" - Only currently filtered findings
     - "Export Selected" - Only checkbox-selected findings (only enabled if selection exists)
   - Default: "Export Filtered" if filters active, else "Export All"
   - Count shown for each option: "Export All (1,234 findings)"
   - "Export Selected" disabled with message if no selection

4. **AC4: CSV Export with Selected Fields**
   - CSV includes only selected fields in selected order
   - Proper UTF-8 BOM for Excel compatibility
   - Values properly escaped (quotes, commas, newlines)
   - Filename includes export type: `findings-all-{project}-{date}.csv`
   - First row contains column headers

5. **AC5: Excel Export with Formatting**
   - Excel includes only selected fields in selected order
   - Header row with bold formatting and freeze pane
   - Column widths auto-fit to content
   - Confidence column formatted as percentage
   - Status column with conditional color formatting (green=validated, red=rejected, gray=pending)
   - Date column formatted as date
   - Filename: `findings-filtered-{project}-{date}.xlsx`

6. **AC6: Report Format Export (New)**
   - Generates a formatted report document (HTML or PDF)
   - Includes metadata header: project name, export date, filter criteria, finding count
   - Findings grouped by Domain with section headers
   - Each finding shows: text, source with page/cell, confidence bar visualization
   - Summary statistics at end: count by domain, count by status, confidence distribution
   - Filename: `findings-report-{project}-{date}.html` or `.pdf`

7. **AC7: Background Processing for Large Exports**
   - If export count > 500 findings, show "Processing..." progress
   - Progress indicator shows percentage or spinner
   - Export generates in background (non-blocking)
   - User can continue using app while export processes
   - Toast notification when export ready with download link
   - Cancel button available during processing

8. **AC8: Filter Criteria in Export**
   - CSV/Excel exports include a "Filter Criteria" comment row (optional setting)
   - Report format shows filter criteria in header section
   - Empty filters noted as "No filters applied"
   - Example: "Filtered by: Domain=Financial, Confidence>=80%"

9. **AC9: Export History and Re-download**
   - Recent exports (last 5) accessible from dropdown
   - Each shows: filename, date, count, format
   - Click to re-download without regenerating
   - Exports stored temporarily (1 hour) for re-download
   - Clear history option

10. **AC10: Accessibility**
    - Modal follows ARIA dialog pattern with focus trap
    - All checkboxes have proper labels
    - Radio buttons are grouped with fieldset/legend
    - Progress indicator has ARIA live region
    - Screen reader announces export completion

## Tasks / Subtasks

- [ ] **Task 1: Create ExportModal Component** (AC: 1, 10)
  - [ ] Create `components/knowledge-explorer/findings/ExportModal.tsx`
  - [ ] Use shadcn/ui Dialog component
  - [ ] Add format selection with icons (CSV, Excel, Report)
  - [ ] Implement Cancel and Export buttons
  - [ ] Add ARIA attributes for accessibility
  - [ ] Handle Escape key to close

- [ ] **Task 2: Implement Field Selection UI** (AC: 2)
  - [ ] Create field selection section in ExportModal
  - [ ] Add checkbox for each exportable field
  - [ ] Implement Select All / Deselect All buttons
  - [ ] Add drag-and-drop reordering for field order (stretch goal)
  - [ ] Validate at least one field selected
  - [ ] Style with column layout for many fields

- [ ] **Task 3: Implement Export Scope Selection** (AC: 3)
  - [ ] Add radio button group for scope
  - [ ] Calculate counts for each option
  - [ ] Conditionally enable "Export Selected" based on selection state
  - [ ] Default scope based on current filter state
  - [ ] Show finding counts for each option

- [ ] **Task 4: Update CSV Export for Field Selection** (AC: 4, 8)
  - [ ] Modify export API to accept selectedFields array
  - [ ] Filter and reorder columns based on selection
  - [ ] Ensure proper escaping maintained
  - [ ] Add optional filter criteria comment row
  - [ ] Update filename pattern with export type

- [ ] **Task 5: Update Excel Export for Field Selection** (AC: 5, 8)
  - [ ] Modify Excel generation to use selectedFields
  - [ ] Apply conditional formatting for status column
  - [ ] Format confidence as percentage
  - [ ] Format dates properly
  - [ ] Auto-fit column widths
  - [ ] Add filter criteria as hidden row or separate sheet

- [ ] **Task 6: Implement Report Format Export** (AC: 6)
  - [ ] Create report template (HTML structure)
  - [ ] Add metadata header section
  - [ ] Group findings by domain with styled headers
  - [ ] Create confidence bar visualization
  - [ ] Add summary statistics section
  - [ ] Generate HTML file with inline styles
  - [ ] (Optional) Add PDF generation with Puppeteer/jsPDF

- [ ] **Task 7: Implement Background Processing** (AC: 7)
  - [ ] Create export job queue (pg-boss or client-side)
  - [ ] Add progress tracking state
  - [ ] Implement progress indicator UI
  - [ ] Add cancel export functionality
  - [ ] Store completed export for download
  - [ ] Toast notification with download action

- [ ] **Task 8: Implement Export History** (AC: 9)
  - [ ] Create export history storage (localStorage or session)
  - [ ] Track last 5 exports with metadata
  - [ ] Add history dropdown/section in modal
  - [ ] Implement re-download from history
  - [ ] Add clear history option
  - [ ] Set 1-hour expiry for stored exports

- [ ] **Task 9: Integrate ExportModal into FindingsBrowser** (AC: 1-10)
  - [ ] Replace ExportDropdown with ExportModal trigger
  - [ ] Pass filter state to modal
  - [ ] Pass selection state to modal
  - [ ] Wire up export handlers
  - [ ] Handle export completion callbacks

- [ ] **Task 10: Write Component Tests** (AC: All)
  - [ ] Test ExportModal rendering and interactions
  - [ ] Test field selection functionality
  - [ ] Test scope selection with various states
  - [ ] Test format selection
  - [ ] Test progress indicator
  - [ ] Test accessibility (keyboard, ARIA)

- [ ] **Task 11: Write API and Integration Tests** (AC: 4, 5, 6, 7)
  - [ ] Test field-filtered CSV export
  - [ ] Test field-filtered Excel export
  - [ ] Test report format generation
  - [ ] Test background processing flow
  - [ ] Test large export handling

- [ ] **Task 12: Verify Build and All Tests Pass** (AC: All)
  - [ ] Run full test suite
  - [ ] Run production build
  - [ ] Manual testing of export flows
  - [ ] Accessibility audit

## Dev Notes

### Architecture Context

**This story enhances the existing export functionality from E4.10:**

| Layer | Technology | E4.10 (Done) | This Story Adds |
|-------|------------|--------------|-----------------|
| UI Components | React + shadcn/ui | ExportDropdown | **ExportModal** with field/scope selection |
| API Routes | Next.js App Router | /api/.../export | **Enhanced** with field selection, report format |
| Export Engine | exceljs, csv-stringify | Basic CSV/Excel | **Report format**, field filtering, background processing |
| State Management | React hooks | - | **Export history**, progress tracking |

**Export Flow (Enhanced):**

```
User clicks "Export" button
         ↓
ExportModal opens (replaces dropdown)
         ↓
User selects: Format (CSV/Excel/Report)
              Fields (checkboxes)
              Scope (All/Filtered/Selected)
         ↓
User clicks "Export"
         ↓
┌────────────────────────────────────────┐
│ Check finding count                     │
│ If > 500: Background processing         │
│ If <= 500: Immediate export             │
└────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────┐
│ POST /api/projects/[id]/findings/export │
│ Body: {                                 │
│   format: 'csv' | 'xlsx' | 'report',   │
│   fields: ['text', 'domain', ...],     │
│   scope: 'all' | 'filtered' | 'selected'│
│   findingIds?: string[] (if selected)  │
│   includeFilterCriteria: boolean       │
│ }                                       │
└────────────────────────────────────────┘
         ↓
Generate export with selected fields only
         ↓
Return file download
         ↓
Add to export history
```

### Project Structure Notes

**New Files to Create:**

```
manda-app/
├── app/api/projects/[id]/findings/export/
│   └── route.ts                           ← MODIFY: Add field selection, report format
├── components/knowledge-explorer/findings/
│   ├── ExportModal.tsx                    ← NEW: Full export modal with options
│   ├── FieldSelector.tsx                  ← NEW: Field checkbox selection component
│   ├── ExportScopeSelector.tsx            ← NEW: Scope radio button group
│   ├── ExportProgress.tsx                 ← NEW: Progress indicator component
│   └── ExportHistory.tsx                  ← NEW: Recent exports dropdown
├── lib/
│   └── export/
│       ├── report-generator.ts            ← NEW: Report format generation
│       └── export-queue.ts                ← NEW: Background processing logic
└── __tests__/
    └── components/knowledge-explorer/findings/
        ├── ExportModal.test.tsx           ← NEW
        ├── FieldSelector.test.tsx         ← NEW
        └── ExportProgress.test.tsx        ← NEW
```

**Existing Files to Modify:**

- `components/knowledge-explorer/findings/FindingsBrowser.tsx` - Replace dropdown with modal trigger
- `components/knowledge-explorer/findings/index.ts` - Export new components
- `lib/api/findings.ts` - Update exportFindings with new parameters
- `app/api/projects/[id]/findings/export/route.ts` - Enhanced export API

### Technical Constraints

**From Tech Spec:**
- Export 500 findings < 10s (with background processing for larger sets)
- Excel export with formatting (headers, column widths, data types)
- CSV with proper escaping
- Support for filtered and selected exports

**From E4.10 Implementation (Reuse):**
- ExportDropdown patterns and structure
- csv-stringify for CSV generation
- exceljs for Excel generation
- Toast patterns for completion/error
- Filename generation patterns

**Implementation Decisions:**
- Report format as HTML initially (PDF as stretch goal - requires server-side rendering)
- Background processing threshold: 500 findings
- Export history stored in localStorage (5 most recent, 1 hour expiry)
- Field selection uses array order for column order
- "Report" format groups by domain alphabetically

### Learnings from Previous Story

**From Story e4-11 (Build Bulk Actions for Finding Management) - Status: done**

- **Selection State Integration**: `useSelectionState` hook available for "Export Selected" scope
- **Toast Pattern**: Success toasts with action button - use for download/re-download
- **Modal Pattern**: BulkConfirmDialog pattern available for modal structure
- **Batch Processing**: batchValidateFindings shows pattern for handling multiple items

**Files/Patterns to Reuse:**
- `components/knowledge-explorer/findings/ExportDropdown.tsx` - Export logic, format handling
- `components/knowledge-explorer/findings/BulkConfirmDialog.tsx` - Modal dialog pattern
- `components/knowledge-explorer/findings/useSelectionState.ts` - For "Export Selected" integration
- `lib/api/findings.ts` - exportFindings function to extend
- `components/ui/dialog.tsx` - shadcn/ui dialog component
- `components/ui/checkbox.tsx` - For field selection
- `components/ui/radio-group.tsx` - For scope selection

**Key Insight**: The existing export API and ExportDropdown provide a solid foundation. This story layers enhanced UX (modal, field selection, scope) on top without replacing core export logic.

[Source: stories/e4-11-build-bulk-actions-for-finding-management.md#Dev-Notes]
[Source: stories/e4-11-build-bulk-actions-for-finding-management.md#Completion-Notes]

### References

- [Source: docs/epics.md#Story-E4.12-Implement-Export-Findings-Feature-Advanced]
- [Source: docs/sprint-artifacts/tech-spec-epic-E4.md#Non-Functional-Requirements]
- [Source: manda-app/components/knowledge-explorer/findings/ExportDropdown.tsx]
- [Source: manda-app/lib/api/findings.ts#exportFindings]
- [Source: stories/e4-11-build-bulk-actions-for-finding-management.md]

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-30 | Story drafted from epics, tech spec, and previous story (e4-11) learnings. Renumbered from E4.13 after duplicate E4.11 removal. | SM Agent |
