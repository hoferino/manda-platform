# Epic 2: Document Ingestion & Storage

**Epic ID:** E2
**Jira Issue:** SCRUM-21
**Status:** In Progress
**Synced:** 2025-11-25

**User Value:** Users can upload, organize, and track documents

**Description:**
Implements document upload, storage in **Google Cloud Storage (GCS)**, folder-based and bucket-based organization views, IRL-linked tracking, and real-time progress indicators.

**Architecture Decision (2025-11-25):**
Document storage uses Google Cloud Storage instead of Supabase Storage for:
- Better cost model for large files (M&A deals often have 100s of MB of documents)
- Native integration with Gemini/Vertex AI for document processing (Epic 3)
- Scalable for enterprise workloads
- Signed URLs for secure, time-limited access

**Functional Requirements Covered:**
- FR-DOC-001: Document Upload & Storage
- FR-DOC-002: Document Organization
- FR-DOC-003: Document Metadata
- FR-IRL-001: IRL Creation

**Stories:**
- E2.1: Implement Document Upload to Google Cloud Storage (SCRUM-22) ✅ DONE
- E2.2: Build Data Room Folder Structure View (SCRUM-23)
- E2.3: Build Data Room Buckets View (Category-Based) (SCRUM-24)
- E2.4: Implement View Toggle and User Preference (SCRUM-25)
- E2.5: Create Document Metadata Management (SCRUM-26)
- E2.6: Implement Document Actions (View, Download, Delete) (SCRUM-27)
- E2.7: Build Upload Progress Indicators and WebSocket Updates (SCRUM-28)
- E2.8: Implement IRL Integration with Document Tracking (SCRUM-29)

**Total Stories:** 8

**Priority:** P0

---

**Technical Notes:**
- GCS bucket per project for isolation
- Signed URLs with 15-minute expiry for secure access
- Metadata stored in PostgreSQL `documents` table
- File paths: `{project_id}/{folder_path}/{filename}`
- Max file size: 500MB (configurable)

**Full Details:** See [docs/epics.md](../../epics.md) lines 785-1335
