# Epic 2 Retrospective: Document Ingestion & Storage

**Epic:** E2 - Document Ingestion & Storage
**Duration:** 2025-11-25 to 2025-11-26 (2 days)
**Stories Completed:** 8/8 (100%)
**Total Tests:** 135 passing
**Retrospective Date:** 2025-11-26

---

## What Went Well ✅

### 1. Course Correction Agility (v2.6)
The team made a significant mid-epic design change: **Buckets = top-level folders** instead of hardcoded categories. This unified data model is cleaner and more flexible:
- `folder_path` is now the single source of truth
- Removed `deal_type` from project wizard (didn't drive behavior)
- Empty projects have empty data rooms (no default buckets)
- Both Folder and Bucket views read from the same data source

### 2. Clean Component Architecture
- Created a well-organized `components/data-room/` folder with 15+ reusable components
- Proper barrel exports in `index.ts` for clean imports
- Consistent patterns: props interfaces, 'use client' directives, proper TypeScript typing
- Good separation: presentation components vs. state management (Zustand store)

### 3. Infrastructure Foundation
- **GCS Integration:** Singleton client, signed URLs (15-min expiry), proper error handling
- **Upload System:** Zustand store with persistence, progress tracking, parallel uploads (max 3)
- **Optimistic UI:** Updates happen immediately with rollback on error
- **Audit Logging:** All document operations logged with user context

### 4. Test Coverage Growth
- Started Epic 2 with ~19 tests (Epic 1 baseline)
- Ended with **135 tests** - a 7x increase
- Good coverage: unit tests, component tests, store tests

### 5. Stories Well-Defined
- Story files had clear acceptance criteria with Given/When/Then format
- Task breakdowns were appropriately scoped
- Senior Developer Reviews provided quality gates

---

## What Could Be Improved 🔄

### 1. Test Gap in Earlier Stories
- E2.2 (Folder Structure) and E2.3 (Buckets) had minimal test coverage initially
- Tests were added retroactively in later stories
- **Lesson:** Write tests alongside implementation, not after

### 2. E2E Tests Missing
- No Playwright/Cypress E2E tests were created
- Manual verification worked but doesn't scale
- **Lesson:** Consider adding E2E test story or including in DoD

### 3. Duplicate Type Exports
- Encountered TypeScript errors from duplicate exports (`export type { Props }` after interface declaration)
- Fixed by removing redundant exports
- **Lesson:** Use either `export interface` or `export type`, not both

### 4. Component Integration Points
- Some components (like IRL panel) required modifying multiple files to integrate
- **Lesson:** Consider adding integration checklist to story templates

---

## Lessons Learned 📚

| # | Lesson | Impact |
|---|--------|--------|
| 1 | **Virtual folders > separate table** | Simpler data model, no sync issues |
| 2 | **Zustand + localStorage = great UX** | Uploads persist across navigation |
| 3 | **Course corrections are OK mid-epic** | v2.6 refactor improved architecture |
| 4 | **Shadcn/ui accelerates development** | Sheet, Dialog, DropdownMenu, Progress all used |
| 5 | **XHR for upload progress** | Fetch API doesn't expose upload progress |

---

## Technical Decisions Made

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| GCS over Supabase Storage | Better cost model, Gemini integration | ✅ Working well |
| Virtual folders (no folders table) | Simpler, derived from `folder_path` | ✅ Clean architecture |
| Zustand for upload state | Global state with persistence | ✅ Great UX |
| XHR for uploads | Progress events needed | ✅ Works reliably |
| Parallel uploads (max 3) | Balance speed vs. server load | ✅ Good tradeoff |

---

## Story Summary

| Story | Title | Key Deliverables | Tests |
|-------|-------|------------------|-------|
| E2.1 | Document Upload to GCS | GCS client, upload API, signed URLs | 21 |
| E2.2 | Folder Structure View | Two-panel layout, drag-drop, virtual folders | 0* |
| E2.3 | Buckets View | Category cards, progress bars, refactored v2.6 | 0* |
| E2.4 | View Toggle | Toggle component, localStorage persistence | 14 |
| E2.5 | Metadata Management | DocumentCard, Details panel, inline editing | 18 |
| E2.6 | Document Actions | View/Download/Delete, confirmation dialog | 2 |
| E2.7 | Upload Progress | Upload zone, progress bars, Zustand store | 39 |
| E2.8 | IRL Integration | Checklist panel, progress tracking, linking | 23 |

*Tests added retroactively in later stories

---

## Metrics

| Metric | Value |
|--------|-------|
| Stories Completed | 8/8 |
| Tests Written | 116 new tests |
| Components Created | 18 new components |
| Migrations Applied | 3 (00012, 00013, 00014) |
| Build Status | ✅ Passing |
| Type Check | ✅ Clean |

---

## Impact on Next Epic (E3)

**Epic 3: Intelligent Document Processing** builds directly on Epic 2:

### Dependencies Met ✅
1. **Documents in GCS** - E3 can now access uploaded files
2. **Document metadata in PostgreSQL** - E3 can query documents by project
3. **Processing status field** - E3 can update `processing_status`
4. **IRL items table** - E3 can link findings to IRL items

### Recommendations for E3
1. **Add FastAPI service** - New service for Python processing pipeline
2. **Reuse Zustand patterns** - Processing queue similar to upload queue
3. **WebSocket for real-time updates** - E3.6 will need this
4. **Consider batch processing** - Multiple documents queued together

### New Information That May Impact E3
- **IRL items table created** - E3 findings could link to IRL items
- **Processing status already in documents** - Ready for E3 to use
- **Zustand patterns established** - Can mirror for processing queue

---

## Action Items for Next Sprint

- [x] Add E2E tests for Data Room → **Added to backlog as BL-001**
- [x] Consider rate limiting on document endpoints → **Added to backlog as BL-002**
- [x] Monitor GCS costs as usage grows → **Added to backlog as BL-003**

All action items have been added to `sprint-status.yaml` backlog section.

---

**Facilitator:** Bob (Scrum Master AI)
**Attendees:** Max (Product Owner/Developer)
