# Epic 7: Learning Loop

**Epic ID:** E7
**Status:** Contexted
**Tech Spec:** [docs/sprint-artifacts/tech-spec-epic-E7.md](../tech-spec-epic-E7.md)
**Contexted:** 2025-12-07

**User Value:** System learns from analyst corrections and feedback to continuously improve accuracy and relevance

**Description:**
Implements the learning loop where the system learns from analyst interactions - corrections to findings, validations/rejections, edits to agent responses, and general feedback. The system updates confidence scores, improves extraction patterns, stores analyst edits as examples for future generations, and maintains a feedback database to identify systematic issues.

**Learning Approach (MVP):** Uses **prompt optimization with few-shot examples** - system stores corrections in database and dynamically includes relevant correction patterns in agent system prompts. Future phases may explore fine-tuning or RAG-based learning enhancements.

**Feature Flag Strategy:** The Learning Loop introduces potentially dangerous cascade operations. All high-impact features are gated behind feature flags for safe rollout. Source validation is ON by default; source error cascade and auto-flagging are OFF by default.

**Functional Requirements Covered:**
- FR-LEARN-001: Finding Corrections
- FR-LEARN-002: Confidence Score Learning
- FR-LEARN-003: Response Improvement
- FR-LEARN-004: Feedback Incorporation

**Stories:**
- E7.1: Implement Finding Correction via Chat (with source validation)
- E7.2: Track Validation/Rejection Feedback
- E7.3: Enable Response Editing and Learning
- E7.4: Build Feedback Incorporation System
- E7.5: Maintain Comprehensive Audit Trail
- E7.6: Propagate Corrections to Related Insights

**Total Stories:** 6

**Key Technical Decisions:**
- Source validation flow: Display original citation before accepting corrections
- Source document error cascade: When source has errors, flag ALL findings from document
- Feature flags for safe rollout (sourceErrorCascadeEnabled, autoFlagDocumentFindings = OFF by default)
- Document reliability tracking (trusted, contains_errors, superseded)
- Confidence adjustment: +0.05 per validation, -0.10 per rejection, capped [0.1, 0.95]
- Append-only audit trail design for compliance
- 7 migrations: 00028-00034

**Database Tables:**
- `finding_corrections` - Correction history with source validation fields
- `validation_feedback` - Validate/reject tracking
- `response_edits` - Response edit storage
- `edit_patterns` - Pattern detection
- `feature_flags` - Runtime flag control

**Priority:** P0

---

**Full Details:** See [docs/epics.md](../../epics.md) Epic 7 section
