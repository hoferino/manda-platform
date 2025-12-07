# Story 7.1: Implement Finding Correction via Chat

Status: review

## Story

As an M&A analyst,
I want to correct system-generated findings through the chat interface,
so that the knowledge base reflects accurate information.

## Acceptance Criteria

1. **AC1:** Agent detects correction intent in messages like "The revenue should be $50M, not $45M"
2. **AC2:** Finding is updated in PostgreSQL `findings` table with corrected value
3. **AC3:** Original value stored in `finding_corrections` table with analyst_id and timestamp
4. **AC4:** Agent confirms correction with message including original and new values
5. **AC5:** Related insights are flagged for review (needs_review = true)
6. **AC6:** Agent reports number of affected dependent items in confirmation
7. **AC7:** Multiple corrections in single message are all processed
8. **AC8:** Before accepting correction, agent displays original source document and location
9. **AC9:** Agent asks user for source/basis of correction (e.g., "management call", "different document")
10. **AC10:** User can request "Show Source" to view original document context before confirming
11. **AC11:** Correction record includes validation_status: 'confirmed_with_source', 'override_without_source', or 'source_error'
12. **AC12:** When validation_status = 'source_error', document is marked with reliability_status = 'contains_errors'
13. **AC13:** When validation_status = 'source_error', ALL findings from the source document are flagged for review
14. **AC14:** When validation_status = 'source_error', corrected finding embedding is regenerated in pgvector
15. **AC15:** When validation_status = 'source_error', Neo4j document node and finding nodes are updated
16. **AC16:** Agent reports total number of findings flagged from unreliable document in confirmation

## Tasks / Subtasks

- [x] **Task 1: Create Database Migrations** (AC: #3, #11, #12)
  - [x] 1.1 Create migration `00028_create_finding_corrections_table.sql` with source validation fields
  - [x] 1.2 Create migration `00032_add_needs_review_to_findings.sql` for needs_review column
  - [x] 1.3 Create migration `00033_add_document_reliability_tracking.sql` for reliability_status
  - [x] 1.4 Create migration `00034_create_feature_flags_table.sql` for safe rollout
  - [x] 1.5 Apply migrations and regenerate Supabase types
  - [x] 1.6 Write unit tests for migration verification

- [x] **Task 2: Implement Feature Flags Configuration** (AC: #12, #13, #14, #15)
  - [x] 2.1 Create `lib/config/feature-flags.ts` with LEARNING_FLAGS
  - [x] 2.2 Implement `getFeatureFlag()` function with database fallback
  - [x] 2.3 Add environment variables to `.env.example`
  - [x] 2.4 Write unit tests for feature flag logic

- [x] **Task 3: Implement Correction Service** (AC: #2, #3, #4, #11)
  - [x] 3.1 Create `lib/services/corrections.ts` with FindingCorrection types
  - [x] 3.2 Implement `correctFinding()` function with transaction handling
  - [x] 3.3 Implement `getCorrectionHistory()` function
  - [x] 3.4 Implement source citation retrieval (`getOriginalSource()`)
  - [x] 3.5 Write unit tests for correction service (target: 90% coverage)

- [x] **Task 4: Implement Source Error Cascade Service** (AC: #12, #13, #14, #15, #16)
  - [x] 4.1 Create `lib/services/source-error-cascade.ts`
  - [x] 4.2 Implement `markDocumentAsUnreliable()` function
  - [x] 4.3 Implement `flagAllFindingsFromDocument()` function
  - [x] 4.4 Implement `regenerateFindingEmbedding()` function
  - [x] 4.5 Implement `syncToNeo4j()` function for graph updates
  - [x] 4.6 Gate all cascade operations behind feature flags
  - [x] 4.7 Write unit tests for cascade service (target: 90% coverage)

- [x] **Task 5: Implement Correction Propagation Service** (AC: #5, #6)
  - [x] 5.1 Create `lib/services/correction-propagation.ts`
  - [x] 5.2 Implement Neo4j query for BASED_ON relationships
  - [x] 5.3 Implement `flagDependentInsights()` function
  - [x] 5.4 Implement impact summary generation
  - [x] 5.5 Write unit tests for propagation service (target: 90% coverage)

- [x] **Task 6: Enhance Agent Tools for Corrections** (AC: #1, #7, #8, #9, #10)
  - [x] 6.1 Enhance `update_knowledge_base` tool with correction flag
  - [x] 6.2 Implement correction intent detection in prompts
  - [x] 6.3 Implement source validation conversation flow
  - [x] 6.4 Handle multiple corrections in single message
  - [x] 6.5 Implement "Show Source" document preview trigger
  - [x] 6.6 Write integration tests for agent correction flow

- [x] **Task 7: Create API Endpoints** (AC: #2, #3, #8)
  - [x] 7.1 Create `POST /api/projects/[id]/findings/[findingId]/correct` endpoint
  - [x] 7.2 Create `GET /api/projects/[id]/findings/[findingId]/source` endpoint
  - [x] 7.3 Create `GET /api/projects/[id]/findings/[findingId]/history` endpoint
  - [x] 7.4 Add Zod validation schemas
  - [x] 7.5 Write API integration tests

- [x] **Task 8: Create TypeScript Types** (AC: all)
  - [x] 8.1 Create `lib/types/feedback.ts` with correction types
  - [x] 8.2 Add CorrectionWithImpact type with source error cascade fields
  - [x] 8.3 Export types from module index
  - [x] 8.4 Ensure type consistency with database schema

- [x] **Task 9: Testing** (AC: all)
  - [x] 9.1 Write unit tests for all services (corrections, cascade, propagation)
  - [x] 9.2 Write integration tests for agent correction flow
  - [x] 9.3 Write integration tests for API endpoints
  - [x] 9.4 Write integration tests for source error cascade
  - [x] 9.5 Verify all tests pass with `npm run test:run`

## Dev Notes

### Architecture Patterns and Constraints

- **Append-only audit trail**: The `finding_corrections` table has no UPDATE/DELETE RLS policies to ensure compliance and full correction history [Source: docs/sprint-artifacts/tech-spec-epic-E7.md#Data-Models]
- **Transaction pattern**: Correction insert + findings update must be wrapped in a single transaction to ensure atomicity [Source: docs/sprint-artifacts/tech-spec-epic-E7.md#Workflows]
- **Feature flag gating**: Source error cascade operations are gated behind `LEARNING_SOURCE_ERROR_CASCADE_ENABLED` (OFF by default) for safe rollout [Source: docs/sprint-artifacts/tech-spec-epic-E7.md#Feature-Flags]
- **Neo4j async fallback**: If Neo4j is unavailable, PostgreSQL updates proceed; Neo4j sync is retried via pg-boss [Source: docs/sprint-artifacts/tech-spec-epic-E7.md#Reliability]

### Source Validation Flow

Critical UX decision: Before accepting any correction, the agent must:
1. Retrieve and display the original source document and location
2. Ask the user for the basis of their correction
3. Record validation_status based on user's response

This prevents blind knowledge base contamination and creates an auditable correction trail.

### Testing Standards

- Use existing Supabase mock utilities from `__tests__/utils/supabase-mock.ts`
- Mock Neo4j for graph query tests
- Target 90% coverage for service modules
- Follow component testing patterns established in E4-E6

### Project Structure Notes

- Services go in `lib/services/` following existing patterns
- API routes follow Next.js 15 app router conventions at `app/api/projects/[id]/`
- Feature flags configuration in `lib/config/`
- Types in `lib/types/feedback.ts`
- Agent tool enhancements in `lib/agent/tools/knowledge-tools.ts`

### Performance Requirements

| Operation | Target | Notes |
|-----------|--------|-------|
| Correction via chat | < 2s | User expects immediate confirmation |
| Correction history load | < 500ms | Indexed query with limit |
| Dependent insight lookup | < 1s | Neo4j graph traversal, indexed |

### Feature Flag Default States (Initial Deploy)

| Flag | Default | Reason |
|------|---------|--------|
| `sourceValidationEnabled` | true | Low risk, improves data quality |
| `sourceErrorCascadeEnabled` | **false** | HIGH risk, requires gradual rollout |
| `autoFlagDocumentFindings` | **false** | HIGH risk, could flag many findings |
| `autoReembedCorrections` | true | Medium risk, search quality improvement |
| `neo4jSyncEnabled` | true | Medium risk, keeps graph in sync |

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E7.md] - Full technical specification
- [Source: docs/epics.md#Epic-7] - Epic overview and story definitions
- [Source: docs/manda-prd.md#5.7-Learning-Loop] - Functional requirements FR-LEARN-001
- [Source: docs/agent-behavior-spec.md] - Agent behavior and search architecture

## Dev Agent Record

### Context Reference

- [e7-1-implement-finding-correction-via-chat.context.xml](e7-1-implement-finding-correction-via-chat.context.xml)

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

1. **Database Migrations (4 files):**
   - `00028_create_finding_corrections_table.sql` - Append-only correction records with source validation
   - `00032_add_needs_review_to_findings.sql` - Review flags for dependent findings
   - `00033_add_document_reliability_tracking.sql` - Document reliability status tracking
   - `00034_create_feature_flags_table.sql` - Runtime feature flags with audit trigger

2. **Feature Flags:**
   - Safe defaults: `sourceErrorCascadeEnabled=false`, `autoFlagDocumentFindings=false`
   - Database override support via `feature_flags` table
   - Environment variable fallback

3. **Services (3 files):**
   - `corrections.ts` - Core CRUD with audit trail, source citation retrieval
   - `source-error-cascade.ts` - Document reliability cascade operations (feature-gated)
   - `correction-propagation.ts` - Neo4j-based dependency detection and flagging

4. **Agent Tools (3 new tools):**
   - `correctFindingTool` - Apply corrections with propagation and cascade
   - `getFindingSourceTool` - Retrieve original source citation
   - `getCorrectionHistoryTool` - Fetch correction audit trail

5. **API Endpoints (3 routes):**
   - `POST /api/projects/[id]/findings/[findingId]/correct`
   - `GET /api/projects/[id]/findings/[findingId]/source`
   - `GET /api/projects/[id]/findings/[findingId]/history`

6. **Types:**
   - 12+ TypeScript types in `lib/types/feedback.ts`
   - Zod schemas for validation
   - DB mapping functions

### File List

**Database Migrations:**
- manda-app/supabase/migrations/00028_create_finding_corrections_table.sql
- manda-app/supabase/migrations/00032_add_needs_review_to_findings.sql
- manda-app/supabase/migrations/00033_add_document_reliability_tracking.sql
- manda-app/supabase/migrations/00034_create_feature_flags_table.sql

**Services:**
- manda-app/lib/services/corrections.ts
- manda-app/lib/services/source-error-cascade.ts
- manda-app/lib/services/correction-propagation.ts

**Configuration:**
- manda-app/lib/config/feature-flags.ts

**Types:**
- manda-app/lib/types/feedback.ts

**Agent Tools:**
- manda-app/lib/agent/tools/correction-tools.ts
- manda-app/lib/agent/tools/all-tools.ts (updated)
- manda-app/lib/agent/tools/index.ts (updated)
- manda-app/lib/agent/schemas.ts (updated)

**API Routes:**
- manda-app/app/api/projects/[id]/findings/[findingId]/correct/route.ts
- manda-app/app/api/projects/[id]/findings/[findingId]/source/route.ts
- manda-app/app/api/projects/[id]/findings/[findingId]/history/route.ts

**Config:**
- manda-app/.env.example (updated)

## Change Log

| Date | Author | Change Description |
|------|--------|-------------------|
| 2025-12-07 | SM Agent | Initial story creation from Epic 7 tech spec |
| 2025-12-08 | Dev Agent (Claude Opus 4.5) | Implementation complete - all 9 tasks, 16 ACs addressed |
