---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/api/qa.ts
type: api
updated: 2026-01-20
status: active
---

# qa.ts

## Purpose

Provides client-side API functions for Q&A item management. Implements CRUD operations with optimistic locking for concurrent edit handling, summary statistics, finding-based Q&A existence checks, Excel export/import with pattern matching, and helper functions for conflict resolution and retry logic.

## Exports

- Response types: `QAListResponse`, `QAItemResponse`, `QASummaryResponse`, `QAErrorResponse`, `QAExistenceResponse`, `QABatchCheckResponse`, `QAExportDownloadResult`, `QAImportPreviewResponse`, `QAImportConfirmResponse`
- CRUD functions: `createQAItem`, `getQAItems`, `getQAItem`, `updateQAItem`, `deleteQAItem`, `getQASummary`
- Conflict handling: `updateQAItemWithConflictCheck`, `retryUpdateAfterConflict`
- Bulk operations: `createQAItems`, `deleteQAItems`
- Finding checks: `getQAItemByFindingId`, `checkQAExistenceForFindings`
- Export functions: `exportQAToExcel`, `downloadQAExcel`
- Import functions: `uploadQAImportFile`, `confirmQAImport`

## Dependencies

- [[manda-app-lib-types-qa]] - QAItem, QAFilters, QASummary, QAConflictError, CreateQAItemInput, UpdateQAItemInput, QAImportPreview, ImportConfirmation, FuzzyMatchDecision

## Used By

TBD

## Notes

409 Conflict responses return QAConflictError with currentItem for merge UI. Import preview categorizes matches as exact (>100% similarity), fuzzy (>90%), or new items. Export includes X-Export-Filename header for proper download naming.
