# Epic 7 Retrospective: Learning Loop

**Epic:** E7 - Learning Loop
**Duration:** December 7-8, 2025 (2 days)
**Status:** Complete - 6/6 stories done
**Agent Model:** Claude Opus 4.5 (claude-opus-4-5-20251101)
**Scrum Master:** Bob (SM Agent)
**Facilitator:** Max (Project Lead)

---

## Executive Summary

Epic 7 delivered the complete Learning Loop system for the Manda M&A Platform, enabling the system to learn from analyst corrections, validations, and feedback to improve over time. The epic delivered all 6 stories in 2 days, establishing a robust feedback infrastructure with chat-based finding corrections, validation/rejection tracking, response editing with pattern detection, feedback analysis, comprehensive audit trails, and a review queue for dependent items.

Key achievement: Built a production-ready learning loop that integrates with the Knowledge Explorer from Epic 4 and the Conversational Assistant from Epic 5, enabling continuous improvement of AI-generated content based on analyst feedback.

---

## Key Metrics

| Metric | Value |
|--------|-------|
| Stories Completed | 6/6 (100%) |
| Total Tests Added | 77+ tests (documented) |
| Code Reviews | 2 stories reviewed (E7.1, E7.3), APPROVED |
| Production Incidents | 0 |
| Database Migrations | 10 new migrations (00028-00037) |
| New Agent Tools | 3 (correctFinding, getFindingSource, getCorrectionHistory) |
| Technical Debt Items | 8 (6 new from E7.6 deferrals, 2 carried from E5/E6) |

### Stories Delivered

| Story | Title | Key Deliverable |
|-------|-------|-----------------|
| E7.1 | Finding Correction via Chat | 4 migrations, 3 services, 3 agent tools, source validation flow |
| E7.2 | Validation/Rejection Feedback | 1 migration, 1 service, 2 components, confidence adjustment |
| E7.3 | Response Editing and Learning | 2 migrations, 2 services, pattern detection with `diff` package |
| E7.4 | Feedback Incorporation System | 3 migrations, 2 services, Python job handler, 27 tests |
| E7.5 | Comprehensive Audit Trail | 2 services, 6 API routes, 2 components, 18 tests |
| E7.6 | Corrections Propagation | 1 service, 3 API routes, 4 components, review queue page |

---

## What Went Well

### 1. Rapid 2-Day Delivery Maintained

Epic 7 completed in 2 days, matching Epics 5 and 6's pace. The learning loop foundation is production-ready and integrates seamlessly with existing components.

### 2. Strong Architectural Decisions

- **Append-only audit tables**: All feedback tables (`finding_corrections`, `validation_feedback`, `response_edits`) have NO UPDATE/DELETE RLS policies, ensuring 7-year M&A compliance
- **Feature flag gating**: High-risk operations like `sourceErrorCascadeEnabled` and `autoFlagDocumentFindings` are OFF by default for safe rollout
- **Grafana Cloud over in-app admin**: E7.4 pivoted to external analytics for GDPR compliance, avoiding user exposure to internal diagnostics
- **Per-analyst pattern learning**: Edit patterns scoped to individual analyst; cross-user patterns deferred to Phase 2

### 3. Comprehensive Source Validation Flow

E7.1's source validation workflow prevents knowledge base contamination:
1. Agent shows original source document and location
2. Asks user for basis of correction (management call, different document, etc.)
3. Records `validation_status`: `confirmed_with_source`, `override_without_source`, or `source_error`
4. Cascades appropriately when source errors detected

### 4. Confidence Adjustment System

Simple, effective algorithm from E7.2:
- +0.05 per validation (capped at 0.95)
- -0.10 per rejection (floored at 0.1)
- Sources with >50% rejection rate flagged for review

### 5. Pattern Detection for Future Learning

E7.3 established pattern detection using `diff` package:
- Word replacements (e.g., "utilize" → "use")
- Phrase removals
- Patterns stored when occurrence_count >= 3
- Few-shot prompt injection for future generations

### 6. Review Queue Infrastructure

E7.6 built comprehensive review queue:
- Aggregates findings, Q&A answers, and CIM sections needing review
- Neo4j integration for dependent item tracking
- Regeneration service with placeholder for LLM re-analysis
- Ready for E8/E9 integration

---

## What Could Be Improved

### 1. E7.6 Test Coverage Deferred

Story E7.6 deferred all tests to prioritize delivery:
- Unit tests for extended correction-propagation.ts
- Unit tests for regeneration.ts service
- Component tests for NeedsReviewBadge and ReviewQueue
- API route tests for review-queue endpoints

**Impact:** Lower confidence in E7.6 code quality. Tests should be added before E8.

### 2. Story Status File Inconsistencies

Some story files show mismatched status vs sprint-status.yaml:
- E7.1: `Status: review` (should be `done`)
- E7.3: `Status: dev-complete` (should be `done`)
- E7.6: `Status: in-progress` (should be `done`)

**Impact:** Minor documentation issue. Status files should be updated.

### 3. Sidebar Navigation Deferred

E7.6 Tasks 9.2 and 9.3 (sidebar navigation item and badge for review queue) were deferred. Users must navigate to `/projects/[id]/review-queue` directly.

**Impact:** Reduced discoverability of review queue. Can be addressed in future sprint.

### 4. Batch Regeneration Not Implemented

"Regenerate All" functionality and pg-boss integration for large batches were deferred. Individual item regeneration works, but bulk operations require manual iteration.

**Impact:** Manual effort for large correction batches. Low priority for MVP.

---

## Technical Patterns Established

### 1. Finding Correction Flow

```
User mentions correction → Agent detects intent →
Show original source (getFindingSourceTool) →
Ask for basis of correction →
Record with validation_status (correctFindingTool) →
Flag dependent insights (propagateCorrection) →
Update Neo4j → Confirm with impact summary
```

### 2. Confidence Adjustment Algorithm

```typescript
// lib/services/validation-feedback.ts
function calculateAdjustedConfidence(
  baseConfidence: number,
  validationCount: number,
  rejectionCount: number
): number {
  const adjustment = (validationCount * 0.05) - (rejectionCount * 0.10);
  return Math.max(0.1, Math.min(0.95, baseConfidence + adjustment));
}
```

### 3. Pattern Detection for Learning

```typescript
// lib/services/response-edits.ts
import * as Diff from 'diff';

function detectEditPatterns(original: string, edited: string): DetectedPattern[] {
  const changes = Diff.diffWords(original, edited);
  // Word replacements: removed + added pair
  // Phrase removals: removed without added
  // Patterns stored when occurrence_count >= 3
}
```

### 4. Feature Flag Infrastructure

```typescript
// lib/config/feature-flags.ts
export const LEARNING_FLAGS = {
  sourceValidationEnabled: true,        // Low risk
  sourceErrorCascadeEnabled: false,     // HIGH risk - off by default
  autoFlagDocumentFindings: false,      // HIGH risk - off by default
  confidenceAdjustmentEnabled: true,    // Medium risk
  patternDetectionEnabled: true,        // Medium risk
  autoThresholdAdjustmentEnabled: false, // Medium risk
  weeklyFeedbackAnalysisEnabled: true,  // Low risk
};
```

### 5. Review Queue Architecture

```typescript
// lib/services/correction-propagation.ts
interface ReviewQueueCounts {
  findings: number;
  qaAnswers: number;
  cimSections: number;
  insights: number;
  total: number;
}

// Findings flagged in Supabase (needs_review column)
// Q&A and CIM flagged in Neo4j (needs_review property)
// Review queue aggregates all sources
```

### 6. Audit Trail Export Pattern

```typescript
// lib/services/audit-export.ts
// UTF-8 with BOM for Excel compatibility
const BOM = '\ufeff';
const csvContent = BOM + headers + '\n' + rows;

// JSON export includes full metadata
interface AuditExportJSON {
  exportedAt: string;
  exportedBy: string;
  dateRange: { start: string; end: string };
  filters: { analystId?: string; findingId?: string };
  totalRecords: number;
  records: AuditEntry[];
}
```

---

## Previous Retrospective Follow-Up

**From Epic 6 Retrospective - Epic 7 Implications:**

| Implication | Status | Evidence |
|-------------|--------|----------|
| Learning Loop can start immediately | ✅ Done | E7 completed in 2 days |
| Feedback sources (chat, validations, IRL) | ✅ Done | All three integrated |
| Storage strategy (separate tables) | ✅ Done | 10 new migrations |
| Privacy/consent | ⏳ Deferred | Feature flags gate collection |
| Analytics dashboard | ✅ Done | Grafana Cloud approach chosen |

**Technical Debt Carried Forward from E6:**

| # | Item | Status |
|---|------|--------|
| TD1 | Fix TypeScript errors in irl-export.test.ts | ⏳ Open |
| TD2 | E5.3 chat component unit tests | ⏳ Open |

**Completion Rate:** E6 prerequisites fully addressed, tech debt items still open.

---

## Epic 8 Implications

### Architecture Ready For

1. **Q&A Co-Creation (E8)** - Review queue ready for Q&A answer flagging
2. **CIM Creation (E9)** - CIMSectionNode type defined in Neo4j
3. **Pattern-based learning** - Few-shot prompt enhancement available for Q&A generation

### Prerequisites for Epic 8

| # | Prerequisite | Owner | Status |
|---|--------------|-------|--------|
| P1 | Verify `qa_lists` and `qa_items` tables exist | Dev | To check |
| P2 | Review Neo4j `QAAnswerNode` type integration | Dev | Ready from E7.6 |
| P3 | Document `BASED_ON` / `DERIVED_FROM` relationships | Architect | In neo4j/types.ts |
| P4 | Plan review queue integration for Q&A items | Dev | Infrastructure ready |

### Considerations for E8

1. **suggest_questions() tool**: Hard cap at 10 suggestions per request
2. **generate_answer() tool**: Leverage KB vector search for source attribution
3. **Q&A ↔ Review Queue**: When findings corrected, dependent Q&A answers should appear in review queue
4. **Export formats**: Reuse patterns from E6 IRL export (PDF/Word with pdfmake/docx)

---

## Technical Debt Backlog

| # | Item | Priority | Source | Status |
|---|------|----------|--------|--------|
| TD1 | E7.6 unit tests for correction-propagation extensions | Medium | E7.6 | Open |
| TD2 | E7.6 unit tests for regeneration service | Medium | E7.6 | Open |
| TD3 | E7.6 component tests for NeedsReviewBadge | Low | E7.6 | Open |
| TD4 | E7.6 component tests for ReviewQueue | Low | E7.6 | Open |
| TD5 | E7.6 sidebar navigation for review queue | Low | E7.6 | Open |
| TD6 | E7.6 batch regeneration with pg-boss | Low | E7.6 | Open |
| TD7 | Fix TypeScript errors in irl-export.test.ts | Low | E6 | Carried |
| TD8 | E5.3 chat component unit tests | Low | E5 | Carried |

---

## Process Improvements

| Item | Status | Notes |
|------|--------|-------|
| "Learnings from Previous Story" sections | ✅ Keep | Critical for context handoff between stories |
| Prerequisites before epic start | ✅ Keep | E6 retro prerequisites enabled smooth E7 |
| Feature flag gating for risky features | ✅ New | Enabled safe rollout of cascade operations |
| Grafana for developer analytics | ✅ New | GDPR-compliant separation from user app |
| 2-day epic cadence | ✅ Maintain | Sustainable with good foundations |
| Code review for complex stories | ✅ Keep | E7.1 and E7.3 reviews caught issues |

---

## Lessons Learned

### Technical

1. **Append-only > mutable**: For audit trails, immutability is non-negotiable in M&A compliance
2. **Feature flags for safety**: High-risk operations should be OFF by default and enabled gradually
3. **External analytics tools**: Grafana Cloud provides better separation than in-app admin dashboards
4. **diff package for pattern detection**: Simple word-level diffing catches most edit patterns
5. **Neo4j for relationship queries**: BASED_ON traversal enables efficient dependent item flagging

### Process

1. **Test deferrals accumulate**: E7.6 deferred all tests; this pattern shouldn't repeat
2. **Story status files need sync**: Manual status updates in story files often lag sprint-status.yaml
3. **2-day epics remain viable**: With solid E1-E6 foundation, rapid delivery continues
4. **Code reviews add value**: E7.1 review caught minor issues before merge

### Product

1. **Source validation prevents contamination**: Asking for correction basis creates accountability
2. **Simple confidence math works**: +0.05/-0.10 algorithm is intuitive and effective
3. **Patterns need volume**: 3+ occurrences threshold prevents noise in pattern detection
4. **Review queue enables human-in-loop**: Flagging dependent items maintains data quality

---

## Appendix: File Inventory

### New Files Created (Epic 7)

```
manda-app/
├── supabase/migrations/
│   ├── 00028_create_finding_corrections_table.sql
│   ├── 00029_create_validation_feedback_table.sql
│   ├── 00030_create_response_edits_table.sql
│   ├── 00031_create_edit_patterns_table.sql
│   ├── 00032_add_needs_review_to_findings.sql
│   ├── 00033_add_document_reliability_tracking.sql
│   ├── 00034_create_feature_flags_table.sql
│   ├── 00035_create_feedback_analytics_table.sql
│   ├── 00036_create_confidence_thresholds_table.sql
│   └── 00037_create_prompt_improvements_table.sql
├── lib/
│   ├── config/
│   │   └── feature-flags.ts
│   ├── services/
│   │   ├── corrections.ts
│   │   ├── source-error-cascade.ts
│   │   ├── correction-propagation.ts (extended)
│   │   ├── validation-feedback.ts
│   │   ├── response-edits.ts
│   │   ├── prompt-enhancement.ts
│   │   ├── feedback-analysis.ts
│   │   ├── confidence-thresholds.ts
│   │   ├── audit-trail.ts
│   │   ├── audit-export.ts
│   │   └── regeneration.ts
│   ├── types/
│   │   ├── feedback.ts (extended significantly)
│   │   └── findings.ts (added needsReview fields)
│   ├── neo4j/
│   │   └── types.ts (added QAAnswerNode, CIMSectionNode)
│   └── agent/tools/
│       ├── correction-tools.ts
│       └── all-tools.ts (updated)
├── components/
│   ├── knowledge-explorer/findings/
│   │   ├── FindingValidationButtons.tsx
│   │   ├── RejectionReasonDialog.tsx
│   │   └── FindingHistoryPanel.tsx
│   ├── chat/
│   │   └── ResponseEditMode.tsx
│   ├── settings/
│   │   └── PatternManagement.tsx
│   └── feedback/
│       ├── AuditTrailExport.tsx
│       ├── NeedsReviewBadge.tsx
│       ├── ReviewQueuePanel.tsx
│       └── index.ts
├── app/
│   ├── api/projects/[id]/
│   │   ├── findings/[findingId]/
│   │   │   ├── correct/route.ts
│   │   │   ├── source/route.ts
│   │   │   ├── history/route.ts (enhanced)
│   │   │   ├── validate/route.ts (updated)
│   │   │   ├── reject/route.ts
│   │   │   └── stats/route.ts
│   │   ├── messages/[messageId]/edits/route.ts
│   │   ├── feedback-analysis/route.ts
│   │   ├── thresholds/route.ts
│   │   ├── audit/
│   │   │   ├── route.ts
│   │   │   ├── export/route.ts
│   │   │   ├── corrections/route.ts
│   │   │   ├── validations/route.ts
│   │   │   └── edits/route.ts
│   │   └── review-queue/
│   │       ├── route.ts
│   │       └── [itemId]/
│   │           ├── route.ts
│   │           └── regenerate/route.ts
│   ├── user/patterns/route.ts
│   └── projects/[id]/review-queue/
│       ├── page.tsx
│       └── ReviewQueuePageClient.tsx
└── __tests__/
    ├── services/
    │   ├── validation-feedback.test.ts (17 tests)
    │   ├── feedback-analysis.test.ts (11 tests)
    │   ├── confidence-thresholds.test.ts (16 tests)
    │   └── audit-trail.test.ts (18 tests)
    └── lib/services/
        └── response-edits.test.ts (15 tests)

manda-processing/
└── src/jobs/handlers/
    └── analyze_feedback.py
```

### Modified Files

```
manda-app/
├── components/knowledge-explorer/findings/
│   ├── FindingCard.tsx (added NeedsReviewBadge)
│   ├── FindingsTable.tsx (added NeedsReviewBadge)
│   └── index.ts (exports)
├── lib/agent/tools/
│   ├── index.ts (updated exports)
│   └── all-tools.ts (updated tool count)
├── lib/agent/schemas.ts (updated)
└── .env.example (feature flag vars)

manda-processing/
└── src/jobs/handlers/__init__.py (registered analyze_feedback)
```

---

**Document Version:** 1.0
**Created:** 2025-12-09
**Author:** Bob (SM Agent)
**Approved By:** Max (Project Lead)