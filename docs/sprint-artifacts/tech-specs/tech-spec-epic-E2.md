# Epic Technical Specification: Document Ingestion & Storage

Date: 2025-11-26
Author: Max
Epic ID: 2
Status: Updated (v2.6 Course Correction)

---

## Overview

Epic 2: Document Ingestion & Storage implements the Data Room functionality for the Manda M&A Intelligence Platform. This epic enables secure document upload to Google Cloud Storage (GCS), dual-view organization (Folder Structure and Buckets view), IRL-linked document tracking, and real-time upload progress indicators. Building on the Epic 1 foundation, this epic delivers the core document management capabilities that analysts need to organize M&A due diligence materials.

The architecture decision to use Google Cloud Storage instead of Supabase Storage was made to optimize for large file handling (M&A deals often involve hundreds of MB of documents), native Gemini/Vertex AI integration for future document processing (Epic 3), and enterprise-grade scalability.

> **Course Correction (v2.6, 2025-11-26):**
> - **Unified Bucket/Folder Model:** `folder_path` is the single source of truth. Buckets = top-level folders. Both views derive from the same data.
> - **No Default Categories:** Empty projects have empty data rooms. Users create their own folder/bucket structure.
> - **Removed `category` column:** Documents no longer have a separate category field. Organization is purely via `folder_path`.

## Objectives and Scope

**In Scope:**
- Google Cloud Storage bucket configuration with IAM policies
- File upload API with signed URLs for secure access (15-minute expiry)
- Drag-and-drop document upload UI with progress indicators
- Data Room Folder Structure view with hierarchical navigation
- Data Room Buckets view with category-based organization
- IRL Checklist panel showing document tracking progress
- Document metadata management (view, download, delete, rename)
- View mode toggle (Folders ↔ Buckets) with preference persistence
- Document versioning for re-uploaded files
- Real-time WebSocket updates for upload status

**Out of Scope:**
- Document processing/parsing (Epic 3)
- AI-assisted document classification (Epic 10 - Phase 2)
- Semantic search and embeddings (Epic 3)
- Document preview/viewer (deferred)
- Collaborative annotations (Phase 2)
- External cloud storage integrations (Google Drive, SharePoint - Phase 2)

## System Architecture Alignment

This epic aligns with the architecture decisions by implementing:

- **File Storage:** Google Cloud Storage with signed URLs (Architecture Decision: File Storage section)
- **Backend APIs:** Next.js API Routes for document operations (decided for Epic 2; FastAPI for Epic 3)
- **Database:** PostgreSQL `documents` table with GCS metadata columns (Data Architecture section)
- **Real-time Updates:** Supabase Realtime for WebSocket notifications (Technology Stack section)
- **Security:** RLS policies on documents table, signed URL expiry (NFR-SEC-001, NFR-SEC-004)

Key architectural components from the technology stack:
- `@google-cloud/storage` npm package for GCS operations
- Service account credentials for GCS authentication
- Bucket naming: `manda-documents` (single bucket, project isolation via path prefix)
- Object path format: `{project_id}/{folder_path}/{filename}`

## Detailed Design

### Services and Modules

| Module/Service | Responsibility | Inputs | Outputs | Owner |
|----------------|----------------|--------|---------|-------|
| **lib/gcs/client.ts** | GCS operations (upload, download, delete, signed URLs) | File buffer, project ID, path | GCS object paths, signed URLs | Backend Team |
| **app/api/documents/upload** | File upload endpoint (POST), signed URL generation (GET) | FormData (file, projectId, category) | Document metadata, upload confirmation | Backend Team |
| **app/api/documents/[id]** | Document CRUD operations | Document ID | Document details, download URL | Backend Team |
| **components/data-room/** | Data Room UI components (folder tree, bucket cards, upload zone) | User interactions | Rendered UI, API requests | Frontend Team |
| **components/irl-checklist/** | IRL progress tracking panel | IRL items, documents | Progress visualization | Frontend Team |
| **lib/api/documents.ts** | Client-side document API functions | File, options | Upload results, document data | Frontend Team |

### Data Models and Contracts

**Documents Table (PostgreSQL with GCS columns):**
```sql
-- Migration 00012: Add GCS columns to documents table
-- NOTE (v2.6): category column removed - folder_path is single source of truth
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS gcs_bucket text,
ADD COLUMN IF NOT EXISTS gcs_object_path text,
ADD COLUMN IF NOT EXISTS folder_path text;
-- ADD COLUMN IF NOT EXISTS category text; -- REMOVED in v2.6: buckets derived from folder_path

-- Existing columns:
-- id uuid PRIMARY KEY
-- deal_id uuid REFERENCES deals(id) NOT NULL
-- user_id uuid REFERENCES auth.users(id) NOT NULL
-- name text NOT NULL
-- file_path text (GCS URI: gs://bucket/path)
-- file_size bigint
-- mime_type text
-- upload_status text DEFAULT 'pending' ('pending', 'uploading', 'completed', 'failed')
-- processing_status text DEFAULT 'pending' ('pending', 'processing', 'completed', 'failed')
-- created_at timestamptz DEFAULT now()
-- updated_at timestamptz DEFAULT now()

-- RLS Policy: Users can only access documents in their deals
CREATE POLICY documents_isolation_policy ON documents
    FOR ALL
    USING (
        auth.uid() = user_id OR
        deal_id IN (SELECT id FROM deals WHERE user_id = auth.uid())
    );
```

**Document Versions Table (for E2.8):**
```sql
CREATE TABLE document_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
    version_number integer NOT NULL,
    gcs_object_path text NOT NULL,
    file_size bigint,
    created_at timestamptz DEFAULT now(),
    UNIQUE(document_id, version_number)
);

CREATE INDEX idx_document_versions_doc ON document_versions(document_id);
```

**~~Document Category Enum~~ DEPRECATED (v2.6):**

> **Note:** Document categories are no longer used. Buckets are derived from top-level folders in `folder_path`. This enum is preserved for reference only.

```typescript
// DEPRECATED (v2.6): Categories removed - use folder_path instead
// Buckets = top-level folders, not predefined categories
// export const DOCUMENT_CATEGORIES = [
//   'financial', 'legal', 'commercial', 'operational', 'tax',
//   'hr', 'it', 'environmental', 'regulatory', 'contracts',
//   'corporate', 'insurance', 'intellectual_property', 'real_estate', 'other',
// ] as const

// NEW (v2.6): Bucket = first segment of folder_path
// Example: folder_path = "Financial/Q1 Reports" → bucket = "Financial"
export function getBucketFromPath(folderPath: string | null): string | null {
  if (!folderPath) return null;
  return folderPath.split('/')[0];
}
```

### APIs and Interfaces

**Document Upload API:**

```typescript
// POST /api/documents/upload
// Request: multipart/form-data
{
  file: File,                    // Required: file to upload
  projectId: string,             // Required: deal/project ID
  folderPath?: string,           // Optional: folder path for organization
  category?: DocumentCategory,   // Optional: document category
}

// Response: 200 OK
{
  success: true,
  document: {
    id: string,
    name: string,
    size: number,
    mimeType: string,
    category: string | null,
    folderPath: string | null,
    uploadStatus: 'completed',
    processingStatus: 'pending',
    createdAt: string,
  }
}

// Error Responses:
// 400: Invalid file type, file too large, missing required fields
// 401: Unauthorized
// 404: Project not found or access denied
// 500: Upload failed
```

**Document Details API:**

```typescript
// GET /api/documents/[id]
// Response: 200 OK
{
  document: {
    id: string,
    projectId: string,
    name: string,
    size: number,
    mimeType: string,
    category: string | null,
    folderPath: string | null,
    uploadStatus: string,
    processingStatus: string,
    createdAt: string,
    updatedAt: string,
    downloadUrl: string,          // Signed URL (15-min expiry)
    downloadUrlExpiresIn: number, // Seconds until expiry
  }
}

// DELETE /api/documents/[id]
// Response: 200 OK
{
  success: true,
  message: 'Document deleted successfully'
}

// PATCH /api/documents/[id]
// Request body:
{
  name?: string,
  category?: DocumentCategory,
  folderPath?: string | null,
}
// Response: 200 OK
{
  success: true,
  document: { /* updated fields */ }
}
```

**Signed Upload URL API (for large files):**

```typescript
// GET /api/documents/upload?projectId=xxx&filename=xxx&mimeType=xxx&fileSize=xxx
// Response: 200 OK
{
  uploadUrl: string,   // Signed URL for direct PUT to GCS
  objectPath: string,  // Path where file will be stored
  bucket: string,      // GCS bucket name
  expiresIn: number,   // Seconds until URL expiry (900 = 15 min)
}
```

### Workflows and Sequencing

**Document Upload Flow:**
```
1. User drags file to upload zone (or clicks Upload button)
2. Frontend validates file type and size
3. Frontend creates FormData with file + metadata
4. POST /api/documents/upload
5. API validates user authentication (Supabase Auth)
6. API validates project access (RLS check via deals table)
7. API validates file (type, size)
8. API converts file to buffer
9. API uploads to GCS via @google-cloud/storage
10. API creates document record in PostgreSQL
11. API logs audit event (DOCUMENT_UPLOADED)
12. API returns document metadata
13. Frontend shows success toast
14. Frontend updates document list
```

**Large File Upload Flow (Alternative):**
```
1. Frontend requests signed upload URL
2. GET /api/documents/upload?projectId=xxx&filename=xxx&mimeType=xxx
3. API generates signed URL for direct upload
4. Frontend PUTs file directly to GCS
5. Frontend calls POST /api/documents/confirm (not implemented yet)
6. API verifies file exists in GCS
7. API creates document record
```

**Document Download Flow:**
```
1. User clicks Download on document
2. Frontend calls GET /api/documents/[id]
3. API generates signed download URL (15-min expiry)
4. API returns document metadata + download URL
5. Frontend opens URL in new tab (triggers download)
```

**Folder Navigation Flow:**
```
1. User clicks folder in tree view
2. Frontend updates selected folder state
3. Frontend fetches documents with folder_path filter
4. Documents list updates to show folder contents
5. Breadcrumb updates to show current path
```

## Non-Functional Requirements

### Performance

**NFR-PERF-E2-001: Upload Speed**
- Files under 10MB upload within 5 seconds
- Files 10-50MB upload within 15 seconds
- Files 50-100MB upload within 30 seconds
- Files 100-500MB upload within 2 minutes
- Progress indicator updates at least every 500ms

**NFR-PERF-E2-002: Download Speed**
- Signed URL generation under 200ms
- Download speed limited only by user's connection
- Document list loads within 1 second (up to 100 documents)

**NFR-PERF-E2-003: UI Responsiveness**
- Folder tree expands/collapses within 100ms
- View toggle switches within 200ms
- Drag-and-drop feedback immediate (< 50ms)

### Security

**NFR-SEC-E2-001: Access Control**
- All document operations enforce RLS (users can only access their deals' documents)
- Signed URLs expire after 15 minutes
- GCS bucket has uniform bucket-level access (no public objects)
- Service account has minimal permissions (storage.objectAdmin on specific bucket)

**NFR-SEC-E2-002: File Validation**
- Allowed file types: PDF, Excel (.xlsx, .xls), Word (.docx, .doc), PowerPoint (.pptx, .ppt), Text, CSV, Images
- Maximum file size: 500MB
- MIME type validation on both client and server
- Filename sanitization (prevent path traversal, invalid characters)

**NFR-SEC-E2-003: Audit Trail**
- All document uploads logged with user ID, file name, project ID
- All document downloads logged
- All document deletions logged
- Audit logs are append-only

### Reliability/Availability

**NFR-REL-E2-001: Upload Reliability**
- Failed uploads can be retried
- Partial uploads are cleaned up (no orphaned GCS objects)
- Database transaction ensures atomic document creation
- If GCS upload succeeds but DB fails, cleanup GCS object (TODO)

**NFR-REL-E2-002: Data Integrity**
- Document metadata always matches GCS object
- Deleting document removes both DB record and GCS object
- Foreign key constraints prevent orphaned documents

### Observability

**NFR-OBS-E2-001: Logging**
- Upload start/complete/fail logged with request ID
- GCS errors logged with full context
- File validation failures logged
- Signed URL generation logged

**NFR-OBS-E2-002: Metrics**
- Upload count by status (success/fail)
- Average upload time by file size bucket
- Storage usage per project
- Most common file types uploaded

## Dependencies and Integrations

### External Dependencies

**Google Cloud Storage:**
- Package: `@google-cloud/storage` v7.17.3
- Authentication: Service account credentials (via `GOOGLE_APPLICATION_CREDENTIALS` or `GCS_CREDENTIALS_JSON`)
- Bucket: `manda-documents` (configured via `GCS_BUCKET_NAME`)
- Official Docs: [Cloud Storage Node.js Client](https://cloud.google.com/storage/docs/reference/libraries#client-libraries-install-nodejs)

**Environment Variables Required:**
```bash
GCS_PROJECT_ID=your-gcp-project-id
GCS_BUCKET_NAME=manda-documents
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json  # Local dev
# OR
GCS_CREDENTIALS_JSON={"type":"service_account",...}  # Production
```

### Internal Dependencies

**From Epic 1:**
- Supabase Auth (user authentication)
- Supabase Client (database operations)
- PostgreSQL `documents` table (schema extended)
- `lib/audit.ts` (audit logging)
- shadcn/ui components (Button, Card, Progress, etc.)

**New Components:**
- `lib/gcs/client.ts` - GCS operations wrapper
- `lib/api/documents.ts` - Client-side document API
- `app/api/documents/` - API routes

### Integration Points

**Frontend ↔ API:**
- Document upload via FormData POST
- Document operations via REST API
- Real-time updates via Supabase Realtime (future)

**API ↔ GCS:**
- Service account authentication
- Object upload/download/delete
- Signed URL generation

**API ↔ PostgreSQL:**
- Document metadata CRUD
- RLS enforcement for access control

## Acceptance Criteria (Authoritative)

### AC-E2-1: Document Upload
```gherkin
Given I am authenticated and in my project Data Room
When I upload a valid PDF file (under 500MB)
Then the file is stored in GCS at `{project_id}/{filename}`
And metadata is saved in the documents table
And I see upload progress indicator
And I see success confirmation when complete

Given I try to upload a .exe file
When I submit the upload
Then the upload is rejected
And I see error: "File type not supported"

Given I try to upload a 600MB file
When I submit the upload
Then the upload is rejected
And I see error: "File size exceeds maximum allowed (500MB)"
```

### AC-E2-2: Document Download
```gherkin
Given I have uploaded a document
When I click Download
Then a signed URL is generated (15-min expiry)
And the file downloads to my computer
And the filename matches the original

Given the signed URL has expired
When I try to access it
Then I receive an access denied error
And I can request a new signed URL
```

### AC-E2-3: Folder Structure View
```gherkin
Given I am in Data Room Folder view
When I create a new folder "Financial Reports"
Then the folder appears in the tree view
And I can drag documents into it
And the document's folder_path updates in the database

Given I have nested folders
When I expand/collapse them
Then the tree state is preserved
And performance is smooth (< 100ms)
```

### AC-E2-4: Buckets View (Updated v2.6)
```gherkin
# Updated v2.6: Buckets = top-level folders, not categories
Given I am in Data Room Buckets view
When documents exist with folder_path set
Then I see bucket cards for each unique top-level folder
And each card shows document count and progress (if IRL configured)

Given I click on a bucket card
When it expands
Then I see documents and subfolders in that bucket
And I can upload directly to that bucket/folder

Given the project has no folders
When I view Buckets view
Then I see an empty state prompting me to create a folder/bucket
```

### AC-E2-5: View Toggle
```gherkin
Given I am in Folder view
When I click the view toggle
Then the view switches to Buckets view
And my view preference is persisted

Given I return to Data Room later
When the page loads
Then my preferred view is shown
```

### AC-E2-6: Document Actions
```gherkin
Given I view a document in the list
When I click the actions menu
Then I see: View, Download, Delete, Rename

Given I click Delete
When I confirm the deletion
Then the file is removed from GCS
And the database record is deleted
And the document disappears from the list
And an audit log is created
```

### AC-E2-7: IRL Checklist Panel
```gherkin
Given I have an IRL configured for my project
When I view the Data Room
Then I see the checklist panel on the right
And it shows overall progress (X/Y items)

Given I upload a document linked to an IRL item
When the upload completes
Then the checklist item shows as complete
And the progress updates
```

### AC-E2-8: Document Versioning
```gherkin
Given I upload a document named "financials.xlsx"
When I later upload another file with the same name
Then I am prompted: "Replace or create new version?"

Given I choose "Create new version"
When the upload completes
Then both versions are accessible
And the document shows "v2" indicator
And I can download either version
```

## Traceability Mapping

| AC # | PRD Requirement | Architecture Component | API/Interface | Test Strategy |
|------|-----------------|----------------------|---------------|---------------|
| AC-E2-1 | FR-DOC-001: Document Upload | GCS client, Upload API | POST /api/documents/upload | Unit: file validation; Integration: GCS upload; E2E: full upload flow |
| AC-E2-2 | NFR-SEC-004: Document Security | Signed URL generation | GET /api/documents/[id] | Integration: URL generation; Security: expiry verification |
| AC-E2-3 | FR-DOC-002: Document Organization | Folder tree component | PATCH /api/documents/[id] | Component: tree operations; E2E: folder navigation |
| AC-E2-4 | FR-DOC-002: Document Organization | Bucket cards component | GET /api/documents?category=X | Component: card rendering; E2E: category filtering |
| AC-E2-5 | FR-DOC-002 (UX) | View toggle, localStorage | N/A (client-side) | Component: toggle state; E2E: preference persistence |
| AC-E2-6 | FR-DOC-002, NFR-SEC-001 | Document actions, Audit | DELETE /api/documents/[id] | Unit: action handlers; Security: RLS enforcement |
| AC-E2-7 | FR-IRL-002, FR-IRL-003 | IRL checklist component | GET /api/irl/[id]/items | Component: progress calc; E2E: checklist updates |
| AC-E2-8 | FR-DOC-003: Document Versioning | Version table, UI | POST /api/documents/versions | Integration: version creation; E2E: version history |

## Risks, Assumptions, Open Questions

### Risks

**RISK-E2-001: GCS Credentials in Production**
- **Description:** Managing GCS service account credentials securely in deployment
- **Severity:** HIGH (security-critical)
- **Mitigation:**
  - Use `GCS_CREDENTIALS_JSON` env var for Vercel/Railway
  - Never commit credentials to git
  - Rotate service account keys quarterly
  - Use workload identity federation if available
- **Owner:** DevOps

**RISK-E2-002: Large File Upload Timeouts**
- **Description:** Files > 100MB may timeout on server-side upload
- **Severity:** MEDIUM
- **Mitigation:**
  - Implement signed URL upload for large files (client uploads directly to GCS)
  - Set appropriate timeout in Next.js config (maxDuration: 60s)
  - Add chunked upload for very large files (Phase 2)
- **Owner:** Backend Team

**RISK-E2-003: GCS Costs**
- **Description:** Storage and operation costs may accumulate
- **Severity:** LOW (MVP scale)
- **Mitigation:**
  - Monitor usage in GCP Console
  - Set up budget alerts
  - Implement lifecycle policies for old versions
  - Delete unused files promptly
- **Owner:** DevOps

### Assumptions

**ASSUMPTION-E2-001: Single Bucket Architecture**
- **Assumption:** Using single bucket with path-based project isolation (not bucket-per-project)
- **Impact:** Simpler IAM, lower operational overhead
- **Validation:** Architecture doc recommends single bucket with `{project_id}/` prefix
- **Risk if Wrong:** LOW - can migrate to multi-bucket if needed

**ASSUMPTION-E2-002: Next.js API Routes for Epic 2**
- **Assumption:** Using Next.js API Routes (not FastAPI) for document operations
- **Impact:** Simpler deployment, no Python backend needed yet
- **Validation:** FastAPI reserved for Epic 3 (document processing with Docling)
- **Risk if Wrong:** NONE - decision confirmed by user

**ASSUMPTION-E2-003: IRL Integration in Epic 2**
- **Assumption:** Basic IRL tracking (E2.5 IRL Checklist) included, but full IRL management in Epic 6
- **Impact:** Checklist reads from existing IRL data, doesn't create IRLs
- **Validation:** Story scope defines checklist as read-only tracker
- **Risk if Wrong:** LOW - can extend if needed

### Open Questions

**QUESTION-E2-001: WebSocket Real-time Updates**
- **Question:** Should E2.7 use Supabase Realtime or custom WebSocket?
- **Impact:** Complexity vs out-of-box functionality
- **Decision Needed By:** E2.7 implementation
- **Recommendation:** Use Supabase Realtime (already configured in Epic 1)
- **Decision Owner:** Backend Team

**QUESTION-E2-002: Document Preview**
- **Question:** Should we add document preview in Epic 2 or defer?
- **Impact:** User experience vs scope
- **Decision Needed By:** Sprint planning
- **Recommendation:** Defer to Phase 2 - focus on core upload/organize functionality
- **Decision Owner:** Product

**QUESTION-E2-003: Folder Creation UI Location**
- **Question:** Create folder in Data Room or via separate modal?
- **Impact:** UX flow
- **Decision Needed By:** E2.3 design
- **Recommendation:** Inline creation in folder tree (right-click or + button)
- **Decision Owner:** UX

## Test Strategy Summary

### Test Levels

| Test Level | Target Coverage | Focus Areas | Tools |
|------------|-----------------|-------------|-------|
| **Unit** | 80% | GCS client functions, file validation, utilities | Vitest |
| **Component** | 80% | Upload zone, folder tree, bucket cards, checklist | Vitest + React Testing Library |
| **Integration** | 100% (critical paths) | GCS upload/download, API endpoints, RLS | Vitest + Supabase test client |
| **API** | 100% (all endpoints) | Document CRUD, error handling | Supertest / Vitest |
| **E2E** | 100% (user flows) | Upload, download, organize, delete | Playwright |
| **Security** | 100% | Signed URL expiry, RLS enforcement, file type validation | Custom scripts |

### Critical Test Scenarios

**Security Tests:**
1. User A cannot access User B's documents (RLS)
2. Signed URL expires after 15 minutes
3. Invalid file types rejected (server-side)
4. File size limits enforced (server-side)
5. Unauthenticated requests rejected

**Integration Tests:**
1. Upload file to GCS → verify object exists
2. Generate signed URL → verify accessible
3. Delete document → verify GCS object removed
4. Create folder → move document → verify folder_path updated

**E2E User Flows:**
1. Upload single document → see in list → download
2. Upload multiple documents → organize into folders
3. Switch view modes → verify documents persist
4. Delete document → confirm removal from list and GCS

### Definition of Done (Epic 2)

Epic 2 is complete when:
- [ ] Documents can be uploaded to GCS via drag-and-drop or button
- [ ] All accepted file types work (PDF, Excel, Word, PPT, Text, CSV, Images)
- [ ] File size limit (500MB) enforced
- [ ] Documents can be downloaded via signed URLs
- [ ] Folder Structure view works with create/rename/delete
- [ ] Buckets view shows category cards with progress
- [ ] View toggle persists user preference
- [ ] IRL Checklist panel shows document progress
- [ ] Document actions work (view, download, delete, rename)
- [ ] Document versioning prompts on duplicate filename
- [ ] RLS enforces project-level access control
- [ ] All security tests pass
- [ ] All E2E tests pass
- [ ] Audit logs capture all document operations
