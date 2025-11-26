# Epic 3: Intelligent Document Processing

**Epic ID:** E3
**Jira Issue:** SCRUM-3
**Synced:** 2025-11-24

**User Value:** Users get automated analysis and findings extracted from documents

**Description:**
Implements the background processing pipeline that automatically parses uploaded documents, extracts structured data, generates embeddings for semantic search, performs initial AI analysis, and stores findings in the knowledge base.

**Functional Requirements Covered:**
- FR-DOC-004: Document Processing
- FR-KB-001: Structured Knowledge Storage
- FR-KB-002: Source Attribution
- FR-BG-001: Event-Driven Architecture
- FR-BG-002: Processing Pipeline

**Stories:**
- E3.1: Set up FastAPI Backend with pg-boss Job Queue
- E3.2: Integrate Docling for Document Parsing
- E3.3: Implement Document Parsing Job Handler
- E3.4: Generate Embeddings for Semantic Search
- E3.5: Implement LLM Analysis with Gemini 2.5 (Tiered Approach)
- E3.6: Create Processing Status Tracking and WebSocket Updates
- E3.7: Implement Processing Queue Visibility
- E3.8: Implement Retry Logic for Failed Processing
- E3.9: Financial Model Integration - Extract and Query Financial Metrics

**Total Stories:** 9

**Priority:** P0

---

## Preparation Notes (from E2 Retrospective)

**Dependencies from Epic 2 (all met ✅):**
- Documents are now stored in Google Cloud Storage
- Document metadata is in PostgreSQL with `processing_status` field
- IRL items table available for linking findings to checklist items
- Zustand patterns established for state management

**Recommendations for Implementation:**
1. **FastAPI Service Setup** - New Python service for processing pipeline (separate from Next.js)
2. **Reuse Zustand Patterns** - Processing queue similar to upload queue in E2.7
3. **WebSocket Infrastructure** - E3.6 will need real-time status updates
4. **Batch Processing** - Consider processing multiple documents queued together
5. **GCS Access** - FastAPI service will need GCS credentials to read uploaded documents

**Technical Context:**
- Documents stored at: `gs://manda-documents-dev/{project_id}/{folder_path}/{filename}`
- Signed URLs available via `lib/gcs/client.ts:getSignedDownloadUrl()`
- Processing status values: `pending`, `processing`, `completed`, `failed`
- 135 tests in place from E1/E2 - continue test-first approach

---

**Full Details:** See [docs/epics.md](../../epics.md) lines 1336-2030
