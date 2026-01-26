# Story 6.6: Build IRL Export Functionality (PDF/Word)

Status: done

## Story

As an M&A analyst,
I want to export my IRL to PDF or Word format,
so that I can send a professional document request list to the seller.

## Acceptance Criteria

1. **AC1**: Export dropdown in IRL Builder toolbar offers PDF and Word (.docx) format options
2. **AC2**: PDF export includes all IRL categories and items with proper formatting and hierarchy
3. **AC3**: Word export is editable and maintains professional formatting
4. **AC4**: Export includes priority indicators (High, Medium, Low) with visual distinction
5. **AC5**: Export includes project name and export date as header/letterhead
6. **AC6**: Item notes are included in the export and clearly associated with each item
7. **AC7**: Export shows fulfilled/unfulfilled status for each item
8. **AC8**: Export generation shows loading state and downloads file to user's machine

## Tasks / Subtasks

- [x] Task 1: Create IRL Export Service (AC: 2, 3, 4, 5, 6, 7)
  - [x] 1.1 Install dependencies: `pdfmake` for PDF generation, `docx` for Word generation
  - [x] 1.2 Create `lib/services/irl-export.ts` with export logic
  - [x] 1.3 Implement `generateIRLPdf()` function with pdfmake
  - [x] 1.4 Implement `generateIRLDocx()` function with docx package
  - [x] 1.5 Add project name and date header to both formats
  - [x] 1.6 Format categories with proper hierarchy (category > subcategory > item)
  - [x] 1.7 Add priority badges/labels (color-coded for PDF, text for Word)
  - [x] 1.8 Include notes inline or as sub-bullets
  - [x] 1.9 Add fulfilled status indicator (checkbox or [x]/[ ])

- [x] Task 2: Create Export API Endpoint (AC: 2, 3, 8)
  - [x] 2.1 Create API route `POST /api/projects/[id]/irls/[irlId]/export`
  - [x] 2.2 Accept format parameter: `{ format: 'pdf' | 'word' }`
  - [x] 2.3 Load IRL with all items from database
  - [x] 2.4 Return generated file as blob with appropriate content-type
  - [x] 2.5 Add error handling for missing IRL or empty IRL

- [x] Task 3: Create Export UI Components (AC: 1, 8)
  - [x] 3.1 Create `components/irl/IRLExportDropdown.tsx` with format selection
  - [x] 3.2 Add PDF icon and Word icon for visual distinction
  - [x] 3.3 Implement loading state during export generation
  - [x] 3.4 Trigger browser download on successful export
  - [x] 3.5 Show toast notification on success/failure

- [x] Task 4: Integrate Export into IRL Builder (AC: 1)
  - [x] 4.1 Add export button to IRLBuilder toolbar (next to save)
  - [x] 4.2 Wire up export dropdown to API
  - [x] 4.3 Pass project name and IRL data to export service
  - [ ] 4.4 Add keyboard shortcut hint (optional) - deferred

- [x] Task 5: Write Tests (AC: 1-8)
  - [x] 5.1 Unit tests for `irl-export.ts` service (PDF generation, Word generation)
  - [x] 5.2 Unit tests for IRLExportDropdown component
  - [ ] 5.3 Integration test for export API endpoint - deferred to E2E
  - [x] 5.4 Test with various IRL sizes (empty, small, large 200+ items)
  - [x] 5.5 Test priority formatting and notes inclusion
  - [x] 5.6 Test fulfilled status display

## Dev Notes

### Relevant Architecture Patterns and Constraints

- **Export Libraries**: Tech spec specifies `pdfmake` (^0.2.x) for PDF and `docx` (^8.x) for Word generation - both are client-side capable but we'll generate server-side for consistency
- **File Download Pattern**: Follow the pattern from Knowledge Explorer export (`lib/api/findings.ts` exportFindings function) which triggers browser download via blob URL
- **Performance Target**: Export generation should complete in <10s for PDF, <15s for Word (per tech spec NFR)
- **Professional Formatting**: Include letterhead with project name and date per epics.md requirements

### Source Tree Components to Touch

| File | Operation | Notes |
|------|-----------|-------|
| `lib/services/irl-export.ts` | CREATE | Main export service |
| `components/irl/IRLExportDropdown.tsx` | CREATE | Export dropdown UI |
| `components/irl/IRLBuilder.tsx` | MODIFY | Add export button to toolbar |
| `app/api/projects/[id]/irls/[irlId]/export/route.ts` | CREATE | Export API endpoint |
| `lib/api/irl.ts` | MODIFY | Add exportIRL function |
| `__tests__/lib/services/irl-export.test.ts` | CREATE | Unit tests |
| `__tests__/components/irl/IRLExportDropdown.test.tsx` | CREATE | Component tests |

### Testing Standards Summary

- **Unit Tests**: Vitest with `@testing-library/react` for components
- **Coverage Target**: 80% for irl-export.ts service
- **Mock Pattern**: Mock pdfmake and docx libraries to test document structure without actually generating files
- **E2E Tests**: Optional - manual verification may be sufficient for export output

### Project Structure Notes

- **Export Service Location**: `lib/services/irl-export.ts` following existing service pattern
- **Component Location**: `components/irl/IRLExportDropdown.tsx` alongside other IRL components
- **API Route**: `app/api/projects/[id]/irls/[irlId]/export/route.ts` following existing IRL route structure
- **Dependencies**: Add `pdfmake` and `docx` to `package.json`

### Learnings from Previous Story

**From Story e6-5-implement-irl-document-linking-and-progress-tracking (Status: done)**

- **Binary Fulfilled Status**: The `irl_items` table now has a `fulfilled BOOLEAN DEFAULT false` column instead of the old status enum. Export should use this field to show item status.
- **Type Definitions**: `IRLItem` interface in `lib/types/irl.ts` includes `fulfilled: boolean` field - use this for status display in export
- **IRL Service Available**: `lib/services/irls.ts` (500 lines) provides comprehensive CRUD - use `getIRL()` and `getIRLItems()` for loading export data
- **Progress Calculation**: `calculateIRLFulfilledProgress()` utility available if needed for summary statistics in export
- **Test Count**: 1600+ tests passing - maintain green build
- **shadcn/ui Components**: Toggle component added - follow existing dropdown patterns

[Source: docs/sprint-artifacts/stories/e6-5-implement-irl-document-linking-and-progress-tracking.md#Completion Notes List]

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E6.md#E6.6 Acceptance Criteria] - AC1-AC6 for export functionality
- [Source: docs/epics.md#Story E6.6] - Full story requirements with Gherkin scenarios
- [Source: docs/sprint-artifacts/tech-spec-epic-E6.md#Dependencies] - pdfmake ^0.2.x, docx ^8.x
- [Source: docs/sprint-artifacts/tech-spec-epic-E6.md#Services and Modules] - irl-export.ts at lib/services/irl-export.ts
- [Source: manda-app/lib/types/irl.ts] - IRL types including IRLItem with fulfilled field
- [Source: manda-app/lib/services/irls.ts] - IRL service for loading IRL data
- [Source: manda-app/components/irl/IRLBuilder.tsx] - Target for toolbar integration
- [Source: manda-app/lib/api/findings.ts#exportFindings] - Pattern for file download

## Dev Agent Record

### Context Reference

- [e6-6-build-irl-export-functionality-excel-csv.context.xml](docs/sprint-artifacts/stories/e6-6-build-irl-export-functionality-excel-csv.context.xml)

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

- **pdfmake Dynamic Import**: Used dynamic import for pdfmake to avoid server-side font loading issues at build time. The library is loaded lazily when `generateIRLPdf()` is called.
- **Fonts**: Using built-in Helvetica fonts (Helvetica, Helvetica-Bold, Helvetica-Oblique, Helvetica-BoldOblique) instead of Roboto to avoid font file bundling issues.
- **Test Count**: 33 tests added (17 service tests + 16 component tests), all passing
- **AC Coverage**: All 8 acceptance criteria implemented and tested
- **Deferred Items**: Keyboard shortcut hint and API integration tests deferred as optional

### File List

| File | Operation | Lines |
|------|-----------|-------|
| `manda-app/lib/services/irl-export.ts` | CREATE | ~570 lines |
| `manda-app/app/api/projects/[id]/irls/[irlId]/export/route.ts` | CREATE | ~115 lines |
| `manda-app/components/irl/IRLExportDropdown.tsx` | CREATE | ~140 lines |
| `manda-app/components/irl/IRLBuilder.tsx` | MODIFY | Added import and export button |
| `manda-app/lib/api/irl.ts` | MODIFY | Added exportIRL function (~60 lines) |
| `manda-app/__tests__/lib/services/irl-export.test.ts` | CREATE | ~360 lines |
| `manda-app/__tests__/components/irl/IRLExportDropdown.test.tsx` | CREATE | ~270 lines |

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-12-03 | SM Agent | Initial story draft created |
| 2025-12-03 | Dev Agent | Implementation complete - all ACs met, 33 tests passing |
