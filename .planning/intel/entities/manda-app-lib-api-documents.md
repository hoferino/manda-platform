---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/api/documents.ts
type: api
updated: 2026-01-20
status: active
---

# documents.ts

## Purpose

Provides client-side API functions for document management including file uploads, downloads, metadata updates, and citation resolution. Handles multi-tenant isolation via organization headers, processing status tracking with stage-aware retry support, and document lookup caching for citation integration.

## Exports

- Type definitions: `ProcessingStatus`, `ProcessingStage`, `ProcessingError`, `RetryHistoryEntry`, `Document`, `UploadOptions`, `UploadResult`, `DocumentLookupResult`
- Upload functions: `uploadDocument`, `uploadDocuments`, `getSignedUploadUrl`
- Document operations: `getDocument`, `deleteDocument`, `updateDocument`, `downloadDocument`
- Citation resolution: `findDocumentByName`, `findDocumentsByNames`, `clearDocumentLookupCache`
- Utilities: `formatFileSize`, `getFileExtension`, `getFileTypeIcon`
- Constants: `DOCUMENT_CATEGORIES`

## Dependencies

- [[manda-app-lib-gcs-client]] - DocumentCategory type
- [[manda-app-lib-api-client]] - apiFetch, getOrganizationId for multi-tenant headers

## Used By

TBD

## Notes

Processing status pipeline: pending -> parsing -> parsed -> embedding -> analyzing -> analyzed -> complete. Stage-aware retry enables resuming from lastCompletedStage. Document lookup caching optimizes repeated citation resolutions within a session.
