---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/api/irl.ts
type: api
updated: 2026-01-20
status: active
---

# irl.ts

## Purpose

Provides client-side API functions and Supabase queries for IRL (Information Request List) management. Handles IRL retrieval with items and linked documents, progress tracking, document-item linking, AI-generated suggestions, folder generation from categories, PDF/Word export, and fulfilled status toggling for manual checklists.

## Exports

- Type definitions: `IRLItem`, `IRL`, `IRLProgress`, `IRLCategory`, `IRLSuggestion`, `FolderGenerationResult`, `IRLExportFormat`, `ExportResult`
- Core functions: `getProjectIRL`, `getProjectIRLs`, `getIRLProgress`
- Document linking: `linkDocumentToIRLItem`, `unlinkDocumentFromIRLItem`
- Item management: `toggleIRLItemFulfilled`
- AI suggestions: `getIRLSuggestions`, `addSuggestionToIRL`, `addMultipleSuggestionsToIRL`
- Folder generation: `generateFoldersFromIRL`
- Export: `exportIRL`
- Utilities: `groupItemsByCategory`

## Dependencies

- [[manda-app-lib-supabase-client]] - createClient for Supabase queries

## Used By

TBD

## Notes

Supports both irl_items table and legacy sections JSONB for template-based IRLs. Progress calculated from fulfilled status, not document linkage. Folder generation creates both PostgreSQL records and GCS prefixes. Export triggers browser download via blob URL.
