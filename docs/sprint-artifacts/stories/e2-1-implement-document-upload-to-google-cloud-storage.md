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
