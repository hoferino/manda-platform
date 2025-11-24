# Architecture & Epic Updates - 2025-11-24

**Initiated By:** Max (Pre-Story Creation Refinement)
**Completed By:** Winston (Architect Agent)
**Status:** Complete

---

## Summary of Changes

Based on Max's feedback, the following critical updates were made to architecture and epic documents to clarify agent interaction patterns, enhance features, and ensure implementation readiness.

---

## 1. Neo4j Temporal Metadata (Architecture)

**File:** `docs/manda-architecture.md`
**Lines:** 380-450

### Changes Made:
- Added **temporal metadata** to Finding nodes: `date_referenced`, `date_extracted`
- Added **SUPERSEDES** relationship for time-based finding updates
- Enhanced **CONTRADICTS** relationship with temporal awareness
- Added validation logic to prevent false contradictions (Q2 vs Q3 data are different periods, not contradictions)

### Why This Matters:
- Prevents false contradiction detection when data refers to different time periods
- Enables accurate validation when user says "Q3 revenue is $5.5M" vs "Q2 revenue was $5.2M"
- Critical for M&A deals where quarterly/yearly data must be distinguished

### Phase 2 Enhancement:
- **Graphiti by Zep** research added for temporal knowledge graph library

---

## 2. Learning Loop Clarification (Epic 7)

**File:** `docs/epics.md`
**Lines:** 3685

### Changes Made:
- Specified **prompt optimization with few-shot examples** as MVP approach
- Clarified that corrections are stored in database and dynamically included in system prompts
- Noted future phases may explore fine-tuning or RAG enhancements

### Why This Matters:
- Epic 7 was under-specified on HOW learning works
- Prompt optimization is simpler for MVP (no model training required)
- Provides clear implementation path for developers

---

## 3. Agent Tools Restructured (11 Chat Tools, 3 CIM Workflow Tools)

**File:** `docs/manda-architecture.md`
**Lines:** 936-956, 1056-1072

### Changes Made:
- **Removed legacy tool:** `generate_cim_section()` (tool #10)
- **Renumbered tools:** Now 11 chat tools + 3 CIM workflow tools (14 total, not 15)
- **Updated suggest_questions():** Added `max_count=10` parameter (hard cap)
- **Clarified separation:** CIM v3 tools are ONLY in CIM Builder agent, NOT in chat

### Tool List (Chat Agent - 11 tools):
1. query_knowledge_base
2. update_knowledge_base (with temporal metadata)
3. update_knowledge_graph
4. validate_finding (with temporal validation)
5. get_document_info
6. trigger_analysis
7. create_irl
8. suggest_questions (max 10)
9. add_to_qa
10. detect_contradictions (temporal-aware)
11. find_gaps

### CIM v3 Tools (Separate Agent):
12. suggest_narrative_outline
13. validate_idea_coherence
14. generate_slide_blueprint

### Why This Matters:
- Clear separation between reactive chat and guided workflows
- Prevents confusion about which tools are available where
- CIM creation exclusively handled by dedicated workflow agent

---

## 4. Q&A Workflow Simplified (Epic 8)

**File:** `docs/epics.md`
**Lines:** 4076-4078, 4182-4186

### Changes Made:
- **Simplified workflow:** Reduced from 3 phases to 2-3 phases
- **Hard cap at 10 suggestions** per request
- **Excel format specified:** Question | Priority | Answer | Date Answered
- **User can request alternative formats:** Word, PDF

### Why This Matters:
- Original Q&A workflow was over-engineered
- Cap at 10 prevents overwhelming user
- Excel format is standard for M&A workflows

---

## 5. Epic 3 - Configurable Extraction Model

**File:** `docs/epics.md`
**Lines:** 1357

### Changes Made:
- Changed from "Gemini 3.0 Pro for extraction" to "Configurable LLM for extraction (default: Gemini 2.0 Pro, swappable via env variable)"

### Why This Matters:
- Allows flexibility to change models without code changes
- Aligns with multi-model architecture strategy
- Environment variable approach (`EXTRACTION_MODEL=gemini-2.0-pro`)

---

## 6. Epic 5 Updates - Chat Agent Enhancements

**File:** `docs/epics.md`
**Lines:** 2744-2748, 2857-2886, 3308-3363

### Changes Made:

#### A. Epic 5 Header Updated:
- Tool count: "15 agent tools" → "11 chat tools"
- Story count: 8 → 9 stories
- Description clarifies chat vs CIM workflow separation

#### B. Story E5.2 Updated:
- Title: "Implement LangChain Agent with 15 Tools" → "11 Chat Tools"
- Added temporal metadata to tools
- Added uncertainty detection feature
- Added security requirement (system prompt never exposed)
- Removed CIM v3 tools from chat agent

#### C. New Stories Added:

**Story E5.8: Chat Export Functionality**
- Export conversations in Markdown, PDF, Word formats
- Preserves sources, timestamps, confidence scores

**Story E5.9: Document Upload via Chat**
- Drag-and-drop and file picker in chat
- Uploads trigger processing pipeline automatically
- Status updates in chat ("Analyzing document...")
- Post-processing notification ("12 findings extracted")

### Why This Matters:
- Chat upload enhances workflow efficiency
- Uncertainty detection → Q&A suggestion is valuable
- Security requirements prevent prompt injection
- Export enables knowledge sharing

---

## 7. UI Structure Decision Documented

**File:** `docs/ui-structure-decision-needed.md` (NEW)

### Purpose:
- Document pending decision on navigation structure
- Current: "Chat" + "Deliverables"
- Proposed: "Analysis" + separate "Q&A Builder" + "CIM Builder" tabs

### Status:
- Decision deferred until Epic 5 sprint planning
- Not blocking implementation
- Clarity optimization question

---

## 8. Epic Totals Updated

**File:** `docs/epics.md`
**Line:** 44

### Change:
- Total Stories (MVP): 79 → 80

**Breakdown:**
- Epic 1: 9 stories (unchanged)
- Epic 2: 8 stories (unchanged)
- Epic 3: 9 stories (unchanged)
- Epic 4: 14 stories (unchanged)
- **Epic 5: 9 stories (was 8)** ← +1 story (E5.9: chat upload)
- Epic 6: 8 stories (unchanged)
- Epic 7: 6 stories (unchanged)
- Epic 8: 8 stories (unchanged)
- Epic 9: 9 stories (unchanged)

---

## Summary of Impact

### 🟢 High Priority Changes (Implemented):
1. ✅ Temporal metadata in Neo4j schema
2. ✅ Learning loop mechanism clarified
3. ✅ Agent tools restructured (11 + 3)
4. ✅ Q&A workflow simplified (max 10)
5. ✅ Extraction model made configurable
6. ✅ Chat agent enhanced (upload, uncertainty detection)
7. ✅ Security requirements added

### 🔵 Documentation Improvements:
1. ✅ UI structure decision documented for later review
2. ✅ Architecture updates consolidated in this document
3. ✅ Epic descriptions enhanced with clarifications

### 📊 Files Modified:
1. `docs/manda-architecture.md` - Neo4j schema, agent tools, chat implementation
2. `docs/epics.md` - Epic 3, 5, 7, 8 updates
3. `docs/ui-structure-decision-needed.md` - NEW file for deferred decision
4. `docs/architecture-updates-2025-11-24.md` - NEW summary document (this file)

---

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| **Learning Loop: Prompt Optimization** | Simpler MVP, no model training required |
| **Chat Tools: 11 (not 15)** | CIM tools belong in separate workflow agent |
| **Q&A Suggestions: Max 10** | Prevents overwhelming user |
| **Temporal Metadata Required** | Critical for M&A data validation |
| **Chat Upload: Add Story** | Enhances workflow efficiency |
| **Tool Indicators: Show** | User confirmed they want to see tool calls |
| **To-Do List in Chat: Remove** | Deemed unnecessary |
| **Security: System Prompt Hidden** | Prevents prompt injection, user manipulation |

---

## Deferred Decisions

| Decision | Status | Timeline |
|----------|--------|----------|
| **UI Navigation Structure** | Documented, not blocking | Epic 5 sprint planning |
| **Graphiti Integration** | Research noted for Phase 2 | After MVP launch |
| **Genkit by Google** | Rejected (redundant with LangChain) | N/A |

---

## Next Steps

1. ✅ All critical architecture gaps resolved
2. ✅ Epic 5 ready for story creation
3. ✅ Implementation readiness validated
4. 🎯 **Ready to proceed with story creation**

**Recommendation:** Start creating stories for Epic 1 (Project Foundation) as it already has tech spec and is fully ready for implementation.

---

**Approved By:** Max
**Date:** 2025-11-24
**Status:** Complete - Ready for Implementation
