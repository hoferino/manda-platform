# Sprint Change Proposal

**Date:** 2025-12-14
**Triggered By:** PM session during E9 contexting + Knowledge Base architecture review
**Status:** APPROVED
**Scope:** Minor (Development team implementation)

---

## 1. Issue Summary

### Problem Statement

During PM session and UAT testing of the Phase 1 MVP, several refinements were identified:

1. **PRD Differentiator Language** — "Persistent Memory" was vague and not differentiated. Replaced with "Structured Deal Intelligence" emphasizing source attribution, confidence scoring, and relationship mapping.

2. **Pattern Matching Approach Flawed** — The 11+ pre-defined cross-domain patterns were brittle and wouldn't scale. Replaced with "Semantic Intelligence Engine" that builds understanding at ingestion and detects contradictions organically.

3. **Architecture Documentation Inaccurate** — PRD referenced "Vertex AI RAG Engine" which was never implemented. Updated to reflect actual stack: pgvector + Neo4j + OpenAI embeddings + Gemini.

4. **Made-up Success Metrics** — PRD contained "60-70%" and "80%" time savings with no baseline. Removed specific percentages.

5. **CIM Builder Spike Incomplete** — E9.S1 needed complete rewrite to reflect template-driven, editable PPTX approach using Nano Banana Pro, Genspark, and Skywork.ai.

6. **Knowledge Base Architecture Too Rigid** — Current Neo4j implementation uses hardcoded node types (Deal, Document, Finding, Insight). M&A deals require flexible, information-centric model.

7. **Bugs Discovered During UAT** — BUG-002 (Create IRL → 404), plus 5 UX issues.

8. **Test Coverage Gaps** — E7.6 tests deferred, E5.3 chat component tests deferred, no live LLM integration tests.

### Context

Phase 1 MVP (9 epics) is complete. Testing is ongoing. User wants to start new refinement sprint while continuing UAT.

### Evidence

- PRD already updated (lines 72, 467-482, 32-35, 150-154)
- Research document created: [knowledge-base-architecture-research.md](research/knowledge-base-architecture-research.md)
- E9 spike rewritten: [epic-E9-party-mode-findings.md](sprint-artifacts/epics/epic-E9-party-mode-findings.md)
- Bug reports in UAT testing logs

---

## 2. Impact Analysis

### Epic Impact

| Epic | Impact | Action |
|------|--------|--------|
| E1-E8 | None | Complete, no changes needed |
| E9 | Minor | Spike E9.S1 already rewritten |
| **E10 (NEW)** | Creation | Knowledge Base 2.0 (Foundation) |
| **E11 (NEW)** | Creation | Agent Context Engineering |

### Story Impact

**New Stories (E10):**
| ID | Story | Description |
|----|-------|-------------|
| E10.1 | Neo4j Backend Sync | Fix E4.15 — sync findings from manda-processing to Neo4j |
| E10.2 | Lightweight M&A Ontology | Create YAML ontology for concept-aware extraction |
| E10.3 | Information-Centric Schema Migration | Migrate from hardcoded nodes to flexible Information nodes |
| E10.4 | Entity Resolution | Normalize entity names across documents |
| E10.5 | Ontology-Guided Extraction | Pass ontology to Gemini during document analysis |

**New Stories (E11):**
| ID | Story | Description |
|----|-------|-------------|
| E11.1 | Tool Call Context Compression | Post-response hook compresses tool call artifacts |
| E11.2 | Conversation Summarization | LangGraph SummarizationMiddleware for older messages |
| E11.3 | Knowledge Base Write-Back | Index user-provided facts from chat to KB |
| E11.4 | Intent-Aware Knowledge Retrieval | RAG from KB only for factual/task queries |
| E11.5 | Type-Safe Tools (Pydantic AI) | Migrate Python backend to Pydantic AI |
| E11.6 | Model Configuration | Provider-agnostic model switching |
| E11.7 | Integration Tests | Context-knowledge flow validation |

**Tech Debt Items:**
| ID | Item | Description |
|----|------|-------------|
| TD-010 | BUG-002 Fix | Create IRL → 404 route issue |
| TD-011 | UX Issues | Industry dropdown, folder reordering, etc. |
| TD-012 | E7.6 Tests | Deferred correction propagation tests |
| TD-013 | E5.3 Tests | Deferred chat component tests |
| TD-014 | LLM Integration Tests | Automated weekly test runs |

### Artifact Conflicts

| Artifact | Conflict | Resolution |
|----------|----------|------------|
| PRD | Differentiators, architecture, metrics | ✅ Already updated |
| Architecture Doc | None | Reflects actual implementation |
| UX Spec | None | KB changes are backend |
| Sprint Status | Missing E10 | 📝 Needs update |
| Epic Files | Missing E10 | 📝 Needs creation |

### Technical Impact

| Area | Impact |
|------|--------|
| Neo4j Schema | New node types (Information, Entity) |
| manda-processing | Add Neo4j sync after findings stored |
| LLM Prompts | Include ontology in extraction prompts |
| PostgreSQL | New entity tables for resolution |

---

## 3. Recommended Approach

### Selected Path: Direct Adjustment (Create E10)

**Rationale:**
1. PRD changes already applied — no further documentation work
2. E10 addresses architectural gap without affecting completed work
3. Bug fixes can run in parallel with E10 implementation
4. Minimal disruption, clear path forward
5. Testing can continue during implementation

### Alternatives Considered

| Alternative | Why Not Selected |
|-------------|-----------------|
| Rollback | No completed work is broken — this is refinement |
| MVP Scope Reduction | MVP already complete — this is Phase 2 |
| Delay KB changes | Would leave architectural debt unaddressed |

### Effort Estimate

| Category | Stories | Effort |
|----------|---------|--------|
| E10 Foundation | 5 stories | ~5-7 days |
| Bug Fixes | 2 items | ~2 days |
| Test Coverage | 3 items | ~2 days |
| **Total** | 10 items | **~8-10 days** |

### Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Schema migration breaks existing data | Low | Migration is additive, not destructive |
| Ontology too rigid | Low | YAML-based, easily modified |
| Neo4j sync performance | Low | Batch processing, async |
| Test infrastructure complexity | Low | Build on existing Vitest setup |

---

## 4. Detailed Change Proposals

### 4.1 PRD Changes (Already Applied)

**Change 1: Differentiator Language**

```markdown
OLD (Line 72):
- **Persistent Memory**: Builds cumulative knowledge across all conversations and documents - never forgets previous insights, contradictions, or analyst decisions

NEW:
- **Structured Deal Intelligence**: Every finding stored with precise source attribution (document, page, cell), confidence scoring, and relationship mapping to other findings. The system knows not just what you learned, but where it came from, how confident it is, and what it contradicts — building a queryable knowledge graph, not just a memory.
```

**Rationale:** "Persistent Memory" is vague and sounds like basic chat history. "Structured Deal Intelligence" emphasizes the unique value: source attribution, confidence, and relationships.

---

**Change 2: Pattern Matching → Semantic Intelligence**

```markdown
OLD (Lines 467-482):
1. **Cross-Domain Intelligence Engine**
   - 11+ sophisticated cross-check patterns:
     - Financial × Operational Efficiency
     - Growth × Quality
     - Contracts × Financial Projections
     [... 8 more patterns ...]
   - Configurable rules engine
   - Confidence scoring with thresholds (>60-70% to surface)

NEW:
1. **Semantic Intelligence Engine**
   Rather than relying on pre-defined pattern matching, Manda builds deep semantic understanding during document analysis. Each finding is stored with:
   - **Contextual metadata**: Time period, entity, accounting basis, source reliability
   - **Semantic classification**: What type of fact this is (revenue figure, contract term, headcount, assumption)
   - **Relationship mapping**: How this finding connects to others (supports, contradicts, depends on)

   This enables the system to detect contradictions and gaps organically — not because it was programmed to check "Revenue × Contracts," but because it understands that a $10M revenue projection for Customer X is inconsistent with a $2M/year contract that expires in 6 months.
```

**Rationale:** Pre-defined patterns are brittle and don't scale. Semantic understanding at ingestion enables organic contradiction detection across any domain.

---

**Change 3: Architecture Decisions**

```markdown
OLD (Lines 32-35):
5. **Document Processing (Epic 3):** Docling for parsing (Excel formulas, tables, OCR) + Vertex AI RAG Engine for retrieval/indexing layer - hybrid approach leveraging best of both

NEW:
5. **Document Processing (Epic 3):** Docling for parsing (Excel formulas, tables, OCR) + pgvector for semantic search + OpenAI embeddings (text-embedding-3-large, 3072 dimensions)
6. **Knowledge Graph:** Neo4j for relationship mapping (CONTRADICTS, SUPPORTS, DERIVED_FROM) + Gemini 2.5 Pro/Flash/Lite tiered LLM strategy for analysis
7. **Deployment Target:** Google Cloud Run - scale-to-zero, cost-effective for variable traffic, native GCS integration
8. **Future Migration Path:** Supabase → Cloud SQL for PostgreSQL when scale requires (documented for planning)
```

**Rationale:** Vertex AI RAG was never implemented. Updated to reflect actual stack.

---

**Change 4: Success Metrics**

```markdown
OLD (Lines 150-154):
- **CIM Storybook Creation**: Cut narrative planning time by 60-70% through AI-guided outline and blueprint generation
- **Visual Styling**: Reduce formatting time by 80% through style template extraction and reuse

NEW:
- **CIM Storybook Creation**: Reduce narrative planning time through AI-guided outline and blueprint generation
- **Visual Styling**: Reduce formatting time through style template extraction and reuse
```

**Rationale:** Percentages were made up with no baseline. Directional language is honest.

---

### 4.2 Epic 10 Definition (To Be Created)

**File:** `docs/sprint-artifacts/epics/epic-E10.md`

```markdown
# Epic 10: Knowledge Base 2.0 (Foundation)

**Epic ID:** E10
**Priority:** P0

**User Value:** System understands M&A entities and relationships flexibly, enabling organic contradiction detection and semantic intelligence.

**Description:**
Evolves the Knowledge Base from hardcoded node types to an information-centric, ontology-guided model. Implements:
- Neo4j backend sync (fixes E4.15)
- Lightweight M&A ontology for concept-aware extraction
- Flexible Information nodes instead of rigid Finding nodes
- Entity resolution across documents
- Ontology-guided LLM extraction

**Stories:**
- E10.1: Neo4j Backend Sync
- E10.2: Lightweight M&A Ontology
- E10.3: Information-Centric Schema Migration
- E10.4: Entity Resolution
- E10.5: Ontology-Guided Extraction

**Deferred to Next Sprint:**
- Hybrid retrieval (agentic query routing)
- LeanRAG integration
- Cross-deal intelligence
```

---

### 4.3 Sprint Status Update (To Be Applied)

**File:** `docs/sprint-artifacts/sprint-status.yaml`

Add:
```yaml
epic-10: backlog
10-jira-id: SCRUM-10
10-notes: |
  Knowledge Base 2.0 Foundation
  - Neo4j backend sync (fixes E4.15)
  - M&A ontology for semantic extraction
  - Information-centric schema migration
```

---

### 4.4 PRD Epic Table Update (To Be Applied)

**File:** `docs/manda-prd.md` (Lines 23-25)

```markdown
OLD:
| E8: Q&A Co-Creation Workflow | Backlog | 0/8 | - |
| E9: CIM Builder | Backlog | 0/15 | - |

NEW:
| E7: Learning Loop | ✅ Complete | 6/6 | 2025-12-08 |
| E8: Q&A Co-Creation Workflow | ✅ Complete | 7/7 | 2025-12-09 |
| E9: CIM Builder | Contexted | 0/15 | - |
| **E10: Knowledge Base 2.0** | Backlog | 0/5 | - |
```

---

## 5. Implementation Handoff

### Scope Classification: Minor

This change can be implemented directly by the development team without PO/SM/Architect escalation.

### Responsibilities

| Role | Responsibility |
|------|----------------|
| **Dev Team** | Create E10 epic file, update sprint-status.yaml, implement E10 stories, fix bugs |
| **Max (PM/User)** | Continue UAT testing, report new issues, approve implementations |

### Success Criteria

1. **Neo4j populated** — Findings sync to Neo4j after document processing
2. **Ontology in use** — Gemini uses ontology for entity extraction
3. **Zero critical bugs** — BUG-002 and all critical issues resolved
4. **Test coverage** — Deferred tests implemented, LLM integration tests running
5. **Documentation** — Research doc and epic files complete

### Next Steps

1. ✅ Sprint Change Proposal approved
2. 📝 Create E10 epic definition file
3. 📝 Update sprint-status.yaml with E10
4. 📝 Update PRD epic tracking table
5. 🔧 Begin implementation: Bug fixes + E10 in parallel
6. 🧪 Continue UAT testing

---

**Document Version:** 1.0
**Created:** 2025-12-14
**Author:** Correct-Course Workflow
**Approved By:** Max
