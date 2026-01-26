# Epic 4 Retrospective: Collaborative Knowledge Workflow

**Epic:** E4 - Collaborative Knowledge Workflow
**Duration:** November 28-30, 2025 (3 days)
**Status:** Complete - All 13 stories done
**Agent Model:** Claude Opus 4.5 (claude-opus-4-5-20251101)
**Scrum Master:** Bob (SM Agent)
**Facilitator:** Max (Project Lead)

---

## Executive Summary

Epic 4 delivered the complete Knowledge Explorer interface for the Manda M&A Platform, enabling analysts to browse, search, validate, and export findings extracted from deal documents. The epic delivered 13 stories over 3 days with comprehensive test coverage (80%+ on all components) and established reusable patterns for real-time updates, contradiction detection, and gap analysis.

Key achievement: Built a cohesive knowledge management system that will serve as the foundation for Epic 5's Conversational Assistant.

---

## Key Metrics

| Metric | Value |
|--------|-------|
| Stories Completed | 13/13 (100%) |
| Total Tests Added | ~1000+ tests |
| Code Reviews | 4 stories reviewed, all APPROVED first try |
| Production Incidents | 0 |
| Technical Debt Items | 2 (type assertions, Neo4j sync deferred) |

### Stories Delivered

| Story | Title | Key Deliverable |
|-------|-------|-----------------|
| E4.1 | Build Knowledge Explorer UI Main Interface | Foundation with @tanstack/react-table |
| E4.2 | Implement Semantic Search for Findings | OpenAI embeddings + pgvector search |
| E4.3 | Implement Inline Finding Validation | Validate/reject workflow with audit trail |
| E4.4 | Build Card View Alternative for Findings | Responsive card grid with virtual scrolling |
| E4.5 | Implement Source Attribution Links | Clickable links to exact document locations |
| E4.6 | Build Contradictions View | UI for viewing and resolving contradictions |
| E4.7 | Detect Contradictions Using Neo4j | LLM-based detection with Gemini 2.5 Pro |
| E4.8 | Build Gap Analysis View | IRL gaps + information coverage gaps |
| E4.9 | Implement Finding Detail View | Full context with related findings |
| E4.10 | Implement Export Findings to CSV/Excel | Basic export functionality |
| E4.11 | Build Bulk Actions for Finding Management | Multi-select validate/reject/delete |
| E4.12 | Implement Export Findings Feature (Advanced) | HTML reports, templates, export history |
| E4.13 | Build Real-Time Knowledge Graph Updates | Supabase Realtime subscriptions |

---

## What Went Well

### 1. Foundation Reuse Pattern

The Knowledge Explorer foundation from E4.1 was rock solid. We built it once with @tanstack/react-table and every subsequent story extended it. FindingsTable, ContradictionsView, GapAnalysisView - all used the same patterns.

### 2. Learnings from Previous Story Section

The "Learnings from Previous Story" section in each story file was incredibly useful. This was a recommendation from Epic 3's retro, and we followed through on it. Made context handoff between stories seamless.

### 3. LLM Integration Architecture

The contradiction detection in E4.7 was a highlight:
- Gemini 2.5 Pro for pairwise comparison
- 70% confidence threshold to reduce false positives
- Batch processing (5 pairs per request) for cost control
- Thoughtful prompt design distinguishing contradictions from temporal changes

### 4. Real-Time Infrastructure

E4.13 delivered real-time updates using the useDocumentUpdates pattern from Epic 3:
- Composite hook pattern (useFindingsRealtime + useContradictionsRealtime)
- 100ms debouncing to prevent UI thrashing
- Exponential backoff reconnection
- Clean subscription cleanup

### 5. Code Review Quality

All 4 stories that went through code review passed on first submission. The dev notes in each story gave reviewers clear context.

### 6. Test Infrastructure Investment

The Supabase test utilities from the tech debt sprint (`__tests__/utils/supabase-mock.ts`) saved hours of test setup time.

---

## What Could Be Improved

### 1. No Live LLM Integration Tests

**Issue:** We have comprehensive unit tests with mocked LLM responses, but zero live integration tests.

**Impact:** Risk of prompt failures in production. Code is structurally sound but prompts not validated with real API responses.

**Affected Stories:** E4.7 (contradiction detection), E3.5 (document analysis), E3.9 (financial extraction)

**Action:** Create LLM integration test strategy (P7 - Blocking Prerequisite for E5)

### 2. Type Assertions Scattered Across Codebase

**Issue:** Using `(supabase as any)` and `as unknown as` type casts in 6/13 stories because database types aren't regenerated after migrations.

**Impact:** Type safety compromised, potential runtime errors not caught at compile time.

**Action:** Regenerate Supabase types (P5 - Blocking Prerequisite for E5)

### 3. Hybrid/Agentic Search Architecture Not Designed

**Issue:** Epic 5's `query_knowledge_base` tool needs to combine pgvector semantic search with Neo4j graph traversal. No design exists.

**Impact:** Critical for E5 chat quality. Without hybrid search, agent responses will lack relationship context.

**Action:** Design search strategy combining pgvector + Neo4j (P1 - Blocking Prerequisite for E5)

### 4. Missing shadcn/ui Components

**Issue:** E4.13 required creating `components/ui/switch.tsx` manually because it wasn't installed.

**Impact:** Dev flow interruption, potential inconsistencies.

**Action:** Audit and install needed components for E5 (P6 - Blocking Prerequisite)

### 5. Test Execution Time Growing

**Issue:** Grew from ~550 tests in Epic 3 to 1000+ in Epic 4. Full test runs taking longer.

**Impact:** Slower feedback loop during development.

**Action:** Investigate parallelization (TD3 - Low priority, post-E5)

---

## Technical Patterns Established

### 1. Knowledge Explorer Component Architecture

```
/projects/[id]/knowledge-explorer/
├── page.tsx (Server Component)
├── KnowledgeExplorerClient.tsx (Tab navigation)
├── findings/
│   ├── FindingsBrowser.tsx
│   ├── FindingsTable.tsx
│   ├── FindingCard.tsx
│   └── FindingFilters.tsx
├── contradictions/
│   ├── ContradictionsView.tsx
│   └── ContradictionCard.tsx
├── gaps/
│   ├── GapAnalysisView.tsx
│   └── GapCard.tsx
└── shared/
    ├── ConfidenceBadge.tsx
    ├── DomainTag.tsx
    ├── StatusBadge.tsx
    └── SourceAttributionLink.tsx
```

### 2. Realtime Subscription Pattern

```typescript
// Composite hook combining multiple subscriptions
export function useKnowledgeExplorerRealtime(projectId: string) {
  const findings = useFindingsRealtime(projectId)
  const contradictions = useContradictionsRealtime(projectId)

  return {
    // Aggregate connection status
    isConnected: findings.isConnected && contradictions.isConnected,
    // Combined counts
    findingsCount: findings.count,
    contradictionsCount: contradictions.unresolvedCount,
    // Auto-refresh toggle with localStorage persistence
    autoRefresh, setAutoRefresh
  }
}
```

### 3. LLM Contradiction Detection

```python
# 70% confidence threshold
CONTRADICTION_CONFIDENCE_THRESHOLD = 0.70

# Pre-filtering to reduce LLM calls
- Same domain only
- Same date_referenced only
- Different source chunks
- Skip identical text

# Batch processing (5 pairs per request)
async def compare_batch(pairs: List[Tuple[Finding, Finding]]) -> List[ContradictionResult]
```

### 4. Gap Detection (Runtime Computed)

```typescript
// IRL Gaps: Items without linked documents
const irlGaps = irlItems.filter(item => !documents.some(d => d.irlItemId === item.id))

// Information Gaps: Domains below coverage threshold
const DOMAIN_THRESHOLDS = {
  financial: 5,    // High priority
  operational: 3,  // Medium priority
  market: 3,       // Medium priority
  legal: 2,        // High priority
  technical: 2     // Low priority
}
```

---

## Previous Retrospective Follow-Up

**From Epic 3 Retrospective:**

| Action Item | Status | Evidence |
|-------------|--------|----------|
| Test sharding / parallel execution | ✅ Done | TD-003 in tech debt sprint |
| Shared Supabase test utilities | ✅ Done | `__tests__/utils/supabase-mock.ts` |
| Error message consistency catalog | ⏳ In Progress | Some improvement, not fully cataloged |
| Pipeline visualization tool | ❌ Not Addressed | Remains on backlog |
| E2E tests for Data Room | ✅ Done | TD-001 added Playwright tests |

**Completion Rate:** 3/5 completed, 1/5 in progress, 1/5 deferred

---

## Epic 5 Blocking Prerequisites

**These must be completed BEFORE starting Epic 5 stories:**

| # | Action Item | Owner | Deliverable |
|---|-------------|-------|-------------|
| P1 | Hybrid/Agentic Search Architecture | Architect | Decision doc: pgvector + Neo4j search strategy |
| P2 | Agent Behavior Framework | PM + Architect | Doc: Response formats, length constraints, mode definitions |
| P3 | Expected Behavior per Use Case | PM | Spec: Financial analysis, company analysis, research, CIM workflow modes |
| P4 | Conversation Goal/Mode Framework | PM + Architect | Spec: Intent detection and mode-specific behavior |
| P5 | Regenerate Supabase Types | Dev | Clean types, remove all `as any` casts |
| P6 | Install Missing shadcn/ui Components | Dev | `npx shadcn@latest add avatar` |
| P7 | LLM Integration Test Strategy | QA | Doc: Test approach for real API calls |

### Agent Behavior Design Decisions

| Decision | Resolution |
|----------|------------|
| Response length | Adaptive with max cap (e.g., 500 words summary, structured output) |
| Conversation storage | Store + manual/suggested capture to findings |
| Agent modes | Goal-oriented with intent detection |
| Tool prioritization | Phased: 4 must-have → 3 should-have → 4 nice-to-have |
| Feedback mechanism | Thumbs up/down + optional comment |

### Tool Prioritization for E5

**Must Have (4):**
- query_knowledge_base
- get_document_info
- detect_contradictions
- find_gaps

**Should Have (3):**
- validate_finding
- update_knowledge_base
- suggest_questions

**Nice to Have (4):**
- create_irl
- add_to_qa
- trigger_analysis
- update_knowledge_graph

---

## Technical Debt Backlog

| # | Item | Priority | Target |
|---|------|----------|--------|
| TD1 | LLM integration tests (mocked only) | High | Address in P7 |
| TD2 | Neo4j CONTRADICTS relationships not synced | Medium | Address in P1 |
| TD3 | Test execution time growing | Low | Post-E5 |

---

## Process Improvements

| Item | Status | Notes |
|------|--------|-------|
| "Learnings from Previous Story" section | ✅ Keep | Proven effective in E4 |
| Code review passing rate | ✅ Maintain | 100% first-pass approval |
| BMAD input_file_patterns | ✅ No Changes | Working as designed |

---

## Lessons Learned

### Technical

1. **Foundation first**: Investing in E4.1's table infrastructure paid dividends across all 13 stories
2. **Mocked tests are necessary but insufficient**: Unit tests with mocks prove code structure, but LLM integration tests are needed for prompt validation
3. **Realtime requires debouncing**: 100ms debounce prevents UI thrashing during rapid updates
4. **Type safety matters**: Accumulated type assertions create hidden risk

### Process

1. **Block on design decisions**: Agent behavior should be designed before building chat infrastructure
2. **Cross-story context**: "Learnings from Previous Story" sections prevent rework
3. **Iterative expectation**: Complex features like conversational AI will require iteration post-launch

### Product

1. **User mental model**: Analysts don't think in graph hops - they want answers
2. **Output format matters**: 15 pages of output is unusable; need adaptive, constrained responses
3. **Goal-oriented design**: Different use cases (financial analysis vs. research) need different agent behaviors

---

## Appendix: File Inventory

### New Components Created (Epic 4)

```
manda-app/components/knowledge-explorer/
├── KnowledgeExplorerClient.tsx
├── ConnectionStatusIndicator.tsx
├── AutoRefreshToggle.tsx
├── RealtimeToastHandler.tsx
├── findings/
│   ├── FindingsBrowser.tsx
│   ├── FindingsTable.tsx
│   ├── FindingCard.tsx
│   ├── FindingsCardGrid.tsx
│   ├── FindingFilters.tsx
│   ├── FindingDetailView.tsx
│   └── ExportModal.tsx
├── contradictions/
│   ├── ContradictionsView.tsx
│   ├── ContradictionCard.tsx
│   └── ContradictionActions.tsx
├── gaps/
│   ├── GapAnalysisView.tsx
│   ├── GapCard.tsx
│   └── GapActions.tsx
└── shared/
    ├── ConfidenceBadge.tsx
    ├── DomainTag.tsx
    ├── StatusBadge.tsx
    ├── SourceAttributionLink.tsx
    ├── DocumentPreviewModal.tsx
    ├── ExcelPreview.tsx
    ├── PdfPreview.tsx
    └── FallbackPreview.tsx
```

### New Hooks Created

```
manda-app/lib/hooks/
├── useFindingsRealtime.ts
├── useContradictionsRealtime.ts
└── useKnowledgeExplorerRealtime.ts
```

### New API Routes Created

```
manda-app/app/api/projects/[id]/
├── findings/
│   ├── route.ts
│   ├── [findingId]/route.ts
│   ├── export/route.ts
│   └── bulk/route.ts
├── contradictions/
│   ├── route.ts
│   ├── detect/route.ts
│   └── [contradictionId]/resolve/route.ts
├── gaps/
│   ├── route.ts
│   └── [gapId]/
│       ├── resolve/route.ts
│       ├── add-to-irl/route.ts
│       └── add-finding/route.ts
└── chunks/[chunkId]/route.ts
```

### Backend Services Created (manda-processing)

```
manda-processing/src/
├── llm/
│   └── contradiction_detector.py
└── jobs/handlers/
    └── detect_contradictions.py
```

### Database Migrations

```
manda-app/supabase/migrations/
├── 00021_add_findings_status_column.sql
├── 00022_add_search_indexes.sql
├── 00023_create_contradictions_table.sql
└── 00024_add_deals_metadata_column.sql
```

---

**Document Version:** 1.0
**Created:** 2025-11-30
**Author:** Bob (SM Agent)
**Approved By:** Max (Project Lead)
