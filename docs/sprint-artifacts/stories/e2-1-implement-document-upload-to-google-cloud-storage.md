# Story 2.1: Implement Document Upload to Google Cloud Storage

Status: done

## Story

As a **developer**,
I want **Google Cloud Storage configured with upload API endpoints**,
so that **users can securely upload and store documents in the M&A data room**.

## Context

This is the foundational story for Epic 2: Document Ingestion & Storage. It establishes the GCS integration layer including bucket configuration, service account authentication, file upload API endpoints, signed URL generation, and file type/size validation. This backend infrastructure enables all subsequent document management features.

**Architecture Decision:** Document storage uses Google Cloud Storage instead of Supabase Storage for better cost model with large files, native Gemini/Vertex AI integration (Epic 3), and enterprise scalability.

## Acceptance Criteria

### AC1: GCS Client Configuration
**Given** the application has GCS environment variables configured
**When** the GCS client initializes
**Then** it authenticates using service account credentials
**And** it can access the configured bucket (`manda-documents`)
**And** errors are logged if credentials are missing or invalid

### AC2: File Upload API Endpoint
**Given** I am an authenticated user with project access
**When** I POST a file to `/api/documents/upload` with projectId
**Then** the file is uploaded to GCS at `{projectId}/{filename}`
**And** a document record is created in PostgreSQL
**And** the response includes document metadata (id, name, size, status)
**And** an audit log entry is created for the upload

### AC3: File Type Validation
**Given** I am uploading a document
**When** I submit a file with an allowed type (PDF, Excel, Word, PPT, CSV, TXT, Images)
**Then** the upload succeeds
**When** I submit a file with a disallowed type (.exe, .sh, .bat)
**Then** the upload is rejected with error "File type not supported"

### AC4: File Size Validation
**Given** I am uploading a document
**When** I submit a file under 500MB
**Then** the upload succeeds
**When** I submit a file over 500MB
**Then** the upload is rejected with error "File size exceeds maximum allowed (500MB)"

### AC5: Signed URL Generation
**Given** a document exists in GCS
**When** I request a download URL via GET `/api/documents/[id]`
**Then** a signed URL is generated with 15-minute expiry
**And** the URL allows downloading the file
**And** the URL becomes invalid after expiry

### AC6: RLS Access Control
**Given** User A owns Project 1 with documents
**When** User B tries to upload to Project 1
**Then** the request is rejected with 403/404
**And** no document is created

### AC7: Document Metadata Storage
**Given** a file is uploaded successfully
**When** I query the documents table
**Then** I see: name, file_size, mime_type, gcs_bucket, gcs_object_path, folder_path, category
**And** upload_status is 'completed'
**And** processing_status is 'pending'

### AC8: Environment Configuration
**Given** the .env.example file
**When** a developer sets up the project
**Then** GCS_PROJECT_ID, GCS_BUCKET_NAME, and credential options are documented
**And** the app works with both local credentials and JSON credential string

## Tasks / Subtasks

- [x] **Task 1: Create GCS Client Library** (AC: #1, #8)
  - [x] Create `lib/gcs/client.ts` with Storage initialization
  - [x] Support both `GOOGLE_APPLICATION_CREDENTIALS` path and `GCS_CREDENTIALS_JSON` string
  - [x] Implement singleton pattern for client reuse
  - [x] Add error handling for missing/invalid credentials
  - [x] Export helper functions: `getBucket`, `generateObjectPath`

- [x] **Task 2: Implement File Validation** (AC: #3, #4)
  - [x] Define `ALLOWED_MIME_TYPES` constant (PDF, Excel, Word, PPT, CSV, TXT, Images)
  - [x] Define `ALLOWED_EXTENSIONS` constant
  - [x] Define `MAX_FILE_SIZE` constant (500MB)
  - [x] Create `validateFile(filename, mimeType, size)` function
  - [x] Add filename sanitization to prevent path traversal

- [x] **Task 3: Create Upload API Endpoint** (AC: #2, #6, #7)
  - [x] Create `app/api/documents/upload/route.ts` with POST handler
  - [x] Parse multipart FormData (file, projectId, folderPath, category)
  - [x] Validate user authentication via Supabase
  - [x] Validate project access via RLS on deals table
  - [x] Upload file to GCS with metadata
  - [x] Create document record in PostgreSQL
  - [x] Log audit event with `createAuditLog`
  - [x] Return document metadata on success

- [x] **Task 4: Implement Signed URL Generation** (AC: #5)
  - [x] Create `getSignedDownloadUrl(objectPath, options)` function
  - [x] Configure 15-minute expiry by default
  - [x] Support `responseDisposition` for download filename
  - [x] Create GET handler in `app/api/documents/[id]/route.ts`

- [x] **Task 5: Create Document Operations API** (AC: #5, #6)
  - [x] Implement GET `/api/documents/[id]` for metadata + download URL
  - [x] Implement DELETE `/api/documents/[id]` for file removal
  - [x] Implement PATCH `/api/documents/[id]` for metadata updates
  - [x] Add RLS enforcement on all operations
  - [x] Log audit events for delete operations

- [x] **Task 6: Create Database Migration** (AC: #7)
  - [x] Create migration to add GCS columns to documents table
  - [x] Add columns: gcs_bucket, gcs_object_path, folder_path, category
  - [x] Update document insert to use new columns

- [x] **Task 7: Update Environment Configuration** (AC: #8)
  - [x] Add GCS variables to `.env.example`
  - [x] Document credential setup options in README or MIGRATION_INSTRUCTIONS

- [x] **Task 8: Create Client-Side API Library** (AC: #2)
  - [x] Create `lib/api/documents.ts` with upload functions
  - [x] Implement `uploadDocument(file, options)` function
  - [x] Implement `uploadDocuments(files, options)` for batch uploads
  - [x] Implement `getDocument(id)`, `deleteDocument(id)`, `updateDocument(id, updates)`
  - [x] Add helper functions for file size formatting and type detection

## Dev Notes

### Architecture Patterns
- **GCS Client Singleton:** Single instance for connection reuse
- **Signed URLs:** Time-limited access for security (15 min default)
- **RLS Enforcement:** All access checks via Supabase RLS policies
- **Audit Logging:** All document operations logged with user context

### Source Tree Components
- `lib/gcs/client.ts` - GCS operations wrapper
- `app/api/documents/upload/route.ts` - Upload endpoint
- `app/api/documents/[id]/route.ts` - Document CRUD
- `lib/api/documents.ts` - Client-side API
- `lib/audit.ts` - Audit logging (existing)
- `supabase/migrations/00012_*.sql` - Schema migration

### Testing Standards
- Unit tests for file validation functions
- Integration tests for GCS upload/download
- API tests for all endpoints with auth scenarios
- Security tests for RLS enforcement

### Project Structure Notes
- Follows Next.js App Router API convention
- GCS client in `lib/gcs/` for service isolation
- Client API in `lib/api/` for frontend consumption
- Migrations numbered sequentially after Epic 1

### References
- [Source: docs/sprint-artifacts/tech-spec-epic-2.md#APIs-and-Interfaces]
- [Source: docs/manda-architecture.md#File-Storage]
- [Source: docs/epics.md#Story-E2.1]

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/stories/e2-1-implement-document-upload-to-google-cloud-storage.context.xml

### Agent Model Used

claude-opus-4-5-20251101

### Debug Log References

### Completion Notes List

- 2025-11-25: Story DONE. All 8 ACs implemented. Migration 00012 applied, types regenerated, 21 unit tests added.

### File List

- manda-app/lib/gcs/client.ts (created)
- manda-app/lib/api/documents.ts (created)
- manda-app/app/api/documents/upload/route.ts (created)
- manda-app/app/api/documents/[id]/route.ts (created)
- manda-app/supabase/migrations/00012_add_gcs_columns_to_documents.sql (created)
- manda-app/.env.example (updated)
- manda-app/__tests__/lib/gcs-client.test.ts (created)
- manda-app/lib/supabase/database.types.ts (regenerated)

## Change Log

| Date | Version | Description |
|------|---------|-------------|
| 2025-11-25 | 1.0 | Story completed - all 8 ACs implemented |
| 2025-11-25 | 1.0.1 | Senior Developer Review (AI) notes appended |

---

## Senior Developer Review (AI)

### Reviewer
Max (via Dev Agent - Retroactive Review)

### Date
2025-11-25

### Outcome
**✅ APPROVE** - All acceptance criteria and tasks verified with evidence. Implementation is solid, secure, and follows architectural patterns.

### Summary
Story E2-S1 establishes Google Cloud Storage integration for document uploads. The implementation is complete, well-structured, and follows security best practices. All 8 acceptance criteria have been verified with file:line evidence. No blocking issues found.

### Key Findings

**No HIGH or MEDIUM severity issues found.**

**LOW Severity (Advisory):**

| # | Finding | Location | Recommendation |
|---|---------|----------|----------------|
| 1 | No `DOCUMENT_UPDATED` audit event type | [route.ts:269](manda-app/app/api/documents/[id]/route.ts#L269) | Add dedicated event type for document metadata updates |
| 2 | No rate limiting on document endpoints | upload/route.ts, [id]/route.ts | Add rate limiting middleware for production |
| 3 | GCS delete failure silently logged | [[id]/route.ts:148-152](manda-app/app/api/documents/[id]/route.ts#L148-L152) | Return warning in response if GCS delete fails |

### Acceptance Criteria Coverage

| AC# | Description | Status | Evidence |
|-----|-------------|--------|----------|
| AC1 | GCS Client Configuration | ✅ IMPLEMENTED | [client.ts:83-110](manda-app/lib/gcs/client.ts#L83-L110) |
| AC2 | File Upload API Endpoint | ✅ IMPLEMENTED | [upload/route.ts:29-171](manda-app/app/api/documents/upload/route.ts#L29-L171) |
| AC3 | File Type Validation | ✅ IMPLEMENTED | [client.ts:22-51, 366-398](manda-app/lib/gcs/client.ts#L22-L51) |
| AC4 | File Size Validation | ✅ IMPLEMENTED | [client.ts:54, 388-395](manda-app/lib/gcs/client.ts#L54) |
| AC5 | Signed URL Generation | ✅ IMPLEMENTED | [client.ts:199-222](manda-app/lib/gcs/client.ts#L199-L222) |
| AC6 | RLS Access Control | ✅ IMPLEMENTED | [upload/route.ts:73-84](manda-app/app/api/documents/upload/route.ts#L73-L84) |
| AC7 | Document Metadata Storage | ✅ IMPLEMENTED | [00012_add_gcs_columns_to_documents.sql](manda-app/supabase/migrations/00012_add_gcs_columns_to_documents.sql) |
| AC8 | Environment Configuration | ✅ IMPLEMENTED | [.env.example:37-46](manda-app/.env.example#L37-L46) |

**Summary: 8 of 8 acceptance criteria fully implemented**

### Task Completion Validation

| Task | Marked | Verified | Evidence |
|------|--------|----------|----------|
| Task 1: GCS Client Library | [x] | ✅ | [lib/gcs/client.ts](manda-app/lib/gcs/client.ts) - 399 lines |
| Task 2: File Validation | [x] | ✅ | [client.ts:22-54, 366-398](manda-app/lib/gcs/client.ts#L22-L54) |
| Task 3: Upload API Endpoint | [x] | ✅ | [upload/route.ts](manda-app/app/api/documents/upload/route.ts) |
| Task 4: Signed URL Generation | [x] | ✅ | [client.ts:199-257](manda-app/lib/gcs/client.ts#L199-L257) |
| Task 5: Document Operations API | [x] | ✅ | [[id]/route.ts](manda-app/app/api/documents/[id]/route.ts) |
| Task 6: Database Migration | [x] | ✅ | [00012_add_gcs_columns_to_documents.sql](manda-app/supabase/migrations/00012_add_gcs_columns_to_documents.sql) |
| Task 7: Environment Config | [x] | ✅ | [.env.example:37-46](manda-app/.env.example#L37-L46) |
| Task 8: Client-Side API | [x] | ✅ | [lib/api/documents.ts](manda-app/lib/api/documents.ts) - 329 lines |

**Summary: 8 of 8 completed tasks verified, 0 questionable, 0 false completions**

### Test Coverage and Gaps

- ✅ 21 unit tests in [gcs-client.test.ts](manda-app/__tests__/lib/gcs-client.test.ts)
- ✅ Tests cover: file validation (AC#3, AC#4), path generation, security edge cases
- ⚪ Integration tests for live GCS operations not included (acceptable - requires live GCS credentials)
- ⚪ API endpoint tests not included (can be added in E2E testing phase)

### Architectural Alignment

- ✅ GCS client singleton pattern per architecture spec
- ✅ Signed URLs with 15-minute expiry per security requirements
- ✅ RLS enforcement via Supabase for multi-tenant isolation
- ✅ Path-based project isolation: `{project_id}/{folder_path}/{filename}`
- ✅ Next.js API Routes for document operations (FastAPI reserved for Epic 3)

### Security Notes

- ✅ Path traversal prevention via `sanitizeFilename()` [client.ts:145-151](manda-app/lib/gcs/client.ts#L145-L151)
- ✅ Double validation: both file extension AND MIME type checked
- ✅ Authentication required on all endpoints
- ✅ RLS policies enforce project-level access control
- ✅ Signed URLs prevent direct bucket access
- ✅ Audit logging for upload, access, and delete operations

### Best-Practices and References

- [@google-cloud/storage v7.x](https://cloud.google.com/nodejs/docs/reference/storage/latest) - Official SDK used correctly
- [Next.js App Router API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) - Proper pattern followed
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security) - Multi-tenant isolation implemented

### Action Items

**Advisory Notes (No code changes required):**
- Note: Consider adding `DOCUMENT_UPDATED` audit event type in future stories
- Note: Consider rate limiting for production deployment (Epic 3 or infrastructure story)
- Note: Consider returning warning to user if GCS delete fails but DB delete succeeds
