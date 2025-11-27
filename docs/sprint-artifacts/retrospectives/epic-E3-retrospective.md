# Epic 3 Retrospective: Intelligent Document Processing

**Epic:** E3 - Intelligent Document Processing
**Duration:** November 26-28, 2025 (3 days)
**Status:** ✅ Complete - All 9 stories done
**Agent Model:** Claude Opus 4.5 (claude-opus-4-5-20251101)
**Scrum Master:** Bob (SM Agent)

---

## Executive Summary

Epic 3 established the complete document processing pipeline for the Manda M&A Platform, from initial parsing through financial metric extraction. The epic delivered 9 stories over 3 days with comprehensive test coverage (85-93% backend, 80%+ frontend) and established reusable patterns for job handling, error classification, and real-time updates.

---

## Key Metrics

| Metric | Value |
|--------|-------|
| Stories Completed | 9/9 (100%) |
| Total Tests Added | ~550+ tests |
| Backend Test Coverage | 85-93% |
| Frontend Test Coverage | 80%+ on new components |
| Processing Pipeline Stages | 5 (parse → embed → analyze → extract_financials → complete) |

### Stories Delivered

| Story | Title | Tests | Coverage |
|-------|-------|-------|----------|
| E3.1 | FastAPI Backend with pg-boss Job Queue | 79 | 93% |
| E3.2 | Docling Document Parsing Integration | 136 | 86% |
| E3.3 | Document Parsing Job Handler | - | Integrated |
| E3.4 | Generate Embeddings for Semantic Search | 37 | 86% |
| E3.5 | LLM Analysis with Gemini 2.5 Tiered | 62 | 85% |
| E3.6 | Processing Status & WebSocket Updates | 207 | 80%+ |
| E3.7 | Processing Queue Visibility | - | 80%+ |
| E3.8 | Retry Logic for Failed Processing | 139 | 85% |
| E3.9 | Financial Metrics Extraction | 82 | 87% |

---

## Technical Debt Resolved

Before starting the Epic 3 retrospective, we identified and fixed technical debt from Epic 2 to ensure a clean foundation:

### Bug Fixes (v2.7.1)

| Issue | Root Cause | Fix Applied |
|-------|------------|-------------|
| **Buckets Tab Not Clickable** | Tooltip components wrapping TabsTrigger elements intercepted click events | Removed Tooltip wrappers from `view-toggle.tsx` |
| **New Bucket Button Missing** | `onCreateFolder` prop not passed to `BucketsView` component | Added CreateFolderDialog and handlers to `data-room-wrapper.tsx` |

### Files Modified

- `manda-app/components/data-room/view-toggle.tsx` - Removed Tooltip interference
- `manda-app/app/projects/[id]/data-room/data-room-wrapper.tsx` - Added bucket creation flow
- `docs/sprint-artifacts/epics/epic-E2.md` - Documented v2.7.1 fixes
- `docs/manda-architecture.md` - Added v2.7.1 changelog

### Lesson Learned

**Zero Technical Debt Policy**: Before closing an epic, ensure all discovered bugs are fixed and documented. This prevents accumulation of issues that slow down future development.

---

## What Went Well

### 1. Architecture & Foundation (E3.1)

- **Clean FastAPI Setup**: Python 3.12+ with modern async patterns
- **Direct SQL for pg-boss**: Avoided Node.js dependency by using asyncpg directly
- **High Test Coverage from Start**: 93% coverage set the quality bar
- **Proper Service Separation**: manda-app (Next.js) and manda-processing (Python) clearly defined

### 2. Document Parsing Pipeline (E3.2, E3.3)

- **Docling Integration**: Robust parsing for PDF, Word, Excel with OCR fallback
- **Parser Interface Pattern**: `BaseParser` abstract class enables clean file-type handling
- **ParseResult Model**: Well-structured with chunks, formulas, and tables for downstream consumption
- **GCS Integration**: Seamless file storage with manda-storage-key credentials

### 3. Embeddings & LLM Analysis (E3.4, E3.5)

- **OpenAI text-embedding-3-large**: 3072 dimensions for high-quality semantic search
- **Tiered Gemini Strategy**: Flash → Pro → Lite balances cost and capability
- **Structured Findings**: M&A domain categories (financial, legal, operational, risk, strategic)
- **Proper Retry Logic**: API calls handle transient failures gracefully

### 4. Real-time Updates (E3.6, E3.7)

- **Supabase Realtime Pattern**: Reusable subscription hook (`useDocumentUpdates`)
- **Connection Status Indicator**: Visual feedback for WebSocket state
- **ProcessingQueue Component**: Users see what's being processed
- **Toast Notifications**: Immediate feedback on completion/failure

### 5. Retry & Error Handling (E3.8)

- **Error Classification System**: Transient vs permanent with regex patterns
- **Stage-Aware Retry**: Resume from failed stage saves processing costs
- **Rate Limiting**: 60s cooldown prevents manual retry spam
- **Total Attempt Cap**: 5 attempts max prevents runaway costs
- **User-Friendly Messages**: Actionable guidance for each error type

### 6. Financial Extraction (E3.9)

- **Efficient Pipeline**: Consumes existing ParseResult (no re-parsing)
- **Bilingual Patterns**: EN + DE for German M&A market (Umsatz, EBITDA, GuV)
- **Clean Separation**: Detector identifies financial docs, Extractor pulls metrics
- **Neo4j Ready**: Schema designed for future graph integration

---

## What Could Be Improved

### 1. Cross-Story Context Management

- **Issue**: Context assembly between stories was manual
- **Impact**: Some patterns were rediscovered instead of reused
- **Recommendation**: The "Learnings from Previous Story" section pattern worked well - formalize this in story templates

### 2. Test Execution Time

- **Issue**: 550+ tests cause slower full test runs
- **Impact**: Development feedback loop longer as test suite grows
- **Recommendation**: Implement test sharding or parallel execution in CI

### 3. Frontend Test Patterns

- **Issue**: Mocking Supabase client required repetitive setup across tests
- **Impact**: Test boilerplate increases, potential inconsistencies
- **Recommendation**: Create shared test utilities for Supabase mocking

### 4. Error Message Consistency

- **Issue**: Some error messages are technical, others user-friendly
- **Impact**: Inconsistent user experience on failures
- **Recommendation**: Create error message catalog for consistency (potential i18n foundation)

### 5. Pipeline Debugging

- **Issue**: 5-stage pipeline is complex to debug when issues occur
- **Impact**: Troubleshooting requires checking multiple handlers
- **Recommendation**: Consider pipeline visualization tool or enhanced logging

---

## Key Patterns Established

### 1. Job Handler Pattern

```python
async def handle_job(job: Job) -> dict:
    """Standard job handler structure."""
    document_id = job.data["document_id"]

    # 1. Load document/context
    doc = await get_document(document_id)

    # 2. Update status to processing
    await update_status(document_id, "processing_stage")

    try:
        # 3. Execute core logic
        result = await process(doc)

        # 4. Store results
        await store_results(document_id, result)

        # 5. Enqueue next stage (if applicable)
        await enqueue_next_job(document_id)

        return {"status": "success"}
    except Exception as e:
        # 6. Classify and handle error
        error = ErrorClassifier().classify(e)
        await handle_error(document_id, error)
        raise
```

### 2. Supabase Client Singleton

```python
_supabase_client: SupabaseClient | None = None

def get_supabase_client() -> SupabaseClient:
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = SupabaseClient()
    return _supabase_client
```

### 3. Realtime Subscription Hook

```typescript
export function useDocumentUpdates(
  projectId: string,
  onUpdate: (payload: DocumentUpdate) => void
) {
  // Subscribe to postgres_changes
  // Filter by project_id
  // Handle INSERT/UPDATE/DELETE
  // Auto-reconnect on disconnect
}
```

### 4. Error Classification

```python
class ErrorClassifier:
    TRANSIENT_PATTERNS = [
        (r"timeout|timed out", "timeout"),
        (r"rate.?limit|429", "rate_limit"),
        (r"service.?unavailable|503", "service_unavailable"),
    ]

    PERMANENT_PATTERNS = [
        (r"invalid.?file", "invalid_file"),
        (r"unsupported.?(format|type)", "unsupported_format"),
    ]
```

### 5. Stage-Aware Processing

```python
class ProcessingStage(str, Enum):
    PENDING = "pending"
    PARSED = "parsed"
    EMBEDDED = "embedded"
    ANALYZED = "analyzed"
    FINANCIALS_EXTRACTED = "financials_extracted"
    COMPLETE = "complete"
```

---

## Backlog Items Identified

### High Priority

| Item | Reason | Target Epic |
|------|--------|-------------|
| Agent Tool `query_financial_metric` | Required for AI chat to access financial data | Epic 5 |
| Cross-document entity linking | Enable relationship discovery | Epic 4 |

### Medium Priority

| Item | Reason | Target |
|------|--------|--------|
| Financial Metrics UI Display | Show extracted metrics in DocumentDetails | Phase 2 Frontend |
| Pipeline Visualization Tool | Debug complex multi-stage processing | DevEx |
| Test Utilities for Supabase Mocking | Reduce test boilerplate | Tech Debt |
| Test Sharding / Parallel Execution | 550+ tests causing slow CI runs | Tech Debt |
| Error Message Consistency Catalog | Some messages technical, others user-friendly | Tech Debt |

### Low Priority

| Item | Reason | Target |
|------|--------|--------|
| CSV File Parsing Support | Some clients use CSV exports | Future |
| Manual Metric Correction UI | Allow analysts to fix extraction errors | Phase 2 |
| Error Message i18n Foundation | Prepare for internationalization | Future |

### Process Improvements

| Item | Reason | Target |
|------|--------|--------|
| Formalize "Learnings from Previous Story" | Cross-story context was manual - pattern worked well | Story Template |
| Epic Closure Checklist | Ensure tech debt fixed before epic close (v2.7.1 lesson) | Process |

---

## Preparation for Epic 4: Knowledge Graph

Epic 4 will build on the following E3 deliverables:

### Database Assets

| Table | Purpose for E4 |
|-------|----------------|
| `documents` | Source nodes for graph |
| `document_chunks` | Text content with embeddings |
| `findings` | Structured insights as graph nodes |
| `financial_metrics` | Numeric data nodes with relationships |

### Code Assets

| Asset | Reuse in E4 |
|-------|-------------|
| `SupabaseClient` | Extend for Neo4j writes |
| `FindingsService` | Source for entity extraction |
| `ErrorClassifier` | Graph sync error handling |
| Job Handler Pattern | Graph sync job handlers |

### Key Dependencies

1. **Neo4j Integration**: Connect to graph database
2. **Entity Extraction**: Identify companies, people, dates from findings
3. **Relationship Mapping**: Link metrics to findings to documents
4. **Contradiction Detection**: Cross-source validation

---

## Lessons Learned

### Technical

1. **Direct SQL > ORM**: Using asyncpg directly for pg-boss was cleaner than Node.js dependency
2. **Tiered LLM Strategy**: Different model tiers (Flash/Pro/Lite) enable cost optimization
3. **Stage Tracking**: `last_completed_stage` enables efficient retry without reprocessing
4. **Pattern Matching**: Regex-based detection works well for financial document classification

### Process

1. **Story Context Files**: .context.xml files provide comprehensive context for dev agents
2. **Learnings Sections**: Including "Learnings from Previous Story" prevents rework
3. **Code Review Integration**: AI code review catches issues before merge
4. **Test-First Quality Bar**: 80%+ coverage requirement ensures reliability

### Team

1. **Agent Specialization**: Different agents (SM, Dev, Architect) bring focused expertise
2. **Workflow Automation**: BMAD workflows reduce manual coordination
3. **Context Preservation**: Sprint status files maintain state across sessions

---

## Conclusion

Epic 3 successfully delivered a production-ready document processing pipeline with:

- **Robust parsing** for PDF, Word, Excel with OCR fallback
- **Semantic search** via OpenAI embeddings in pgvector
- **Intelligent analysis** using tiered Gemini models
- **Financial extraction** with EN/DE pattern support
- **Real-time updates** via Supabase Realtime
- **Resilient processing** with error classification and stage-aware retry

The patterns and infrastructure established in E3 provide a solid foundation for Epic 4's knowledge graph integration and Epic 5's AI agent capabilities.

---

## Appendix: File Inventory

### New Services Created

```
manda-processing/
├── src/
│   ├── api/routes/
│   │   ├── webhooks.py          # Webhook endpoints for job triggers
│   │   ├── processing.py        # Queue visibility endpoints
│   │   └── financial_metrics.py # Financial data query API
│   ├── jobs/
│   │   ├── worker.py            # pg-boss job worker
│   │   ├── errors.py            # Error classification
│   │   ├── retry_manager.py     # Stage-aware retry logic
│   │   └── handlers/
│   │       ├── parse_document.py
│   │       ├── generate_embeddings.py
│   │       ├── analyze_document.py
│   │       └── extract_financials.py
│   ├── parsers/
│   │   ├── docling_parser.py    # PDF/Word parsing
│   │   └── excel_parser.py      # Excel/CSV parsing
│   ├── financial/
│   │   ├── detector.py          # Financial document detection
│   │   └── extractor.py         # Metric extraction
│   ├── embeddings/
│   │   └── openai_client.py     # OpenAI embedding generation
│   ├── analysis/
│   │   └── gemini_client.py     # Gemini LLM analysis
│   └── storage/
│       ├── supabase_client.py   # Database operations
│       └── gcs_client.py        # Google Cloud Storage
```

### Frontend Components Created

```
manda-app/
├── components/data-room/
│   ├── processing-status-badge.tsx
│   ├── processing-progress.tsx
│   ├── processing-queue.tsx
│   └── queue-item.tsx
├── lib/hooks/
│   ├── useDocumentUpdates.ts
│   └── useProcessingQueue.ts
└── app/api/
    ├── documents/[id]/retry/route.ts
    └── processing/queue/
        ├── route.ts
        └── [jobId]/route.ts
```

### Database Migrations

```
manda-app/supabase/migrations/
├── 00015_create_document_chunks_table.sql
├── 00016_create_findings_table.sql
├── 00017_enable_pgvector_extension.sql
├── 00018_add_retry_tracking.sql
└── 00019_create_financial_metrics_table.sql
```

---

**Document Version:** 1.0
**Created:** 2025-11-28
**Author:** SM Agent (Bob)
