# Documentation Cleanup Changelog

This file documents what was removed from core documentation files during Phase 3 cleanup and the rationale for each change.

---

## manda-prd.md Changes

### Date: 2026-01-20

**Frontmatter Updates:**
- Updated `last-updated` from `2026-01-15` to `2026-01-20`

**Sections Simplified:**

#### 1. Architecture Decisions Made (Lines 56-95)

**Before:** Long list mixing implemented decisions with planning details

**After:** Simplified to implemented facts only, removed E11 planning details (P0-P3 priorities)

**Rationale:**
- E11 planning decisions belong in historical planning artifacts (_bmad-output/), not PRD
- PRD should document WHAT was decided and implemented, not HOW it was prioritized during planning
- Removed P0/P1/P2/P3 priority markers - these were sprint planning artifacts
- Simplified decision #14-19 to just state what was implemented

**Removed Content:**
- Detailed P0-P3 priority breakdown for E11 decisions
- Planning commentary like "Reprioritized (2025-12-17)"
- Explanatory notes about why priorities changed
- Conversation Summarization and Tool Result Isolation details (backlog items, not core requirements)

**New References Added:**
- Line 80: Added pointer to `docs/features/agent-v2/` for agent implementation details
- Line 279: Added pointer to `docs/features/agent-v2/` in Agent Layer section
- Line 409: Added pointer to `docs/features/knowledge-graph/` in Knowledge Base Construction
- Line 432: Added pointer to `docs/features/cim-builder/` in CIM Narrative Storybook section

**Updated Status:**
- E11 decisions updated from "📋 PLANNED" to "✅ IMPLEMENTED" with completion date

---

## manda-architecture.md Changes

### Date: 2026-01-20

**Frontmatter Updates:**
- Updated `version` from `4.3` to `4.4`
- Updated `last-updated` from `2026-01-15` to `2026-01-20`
- Updated version description from "Chat Orchestrator - 3-path LangGraph routing" to "v2 Agent System - Supervisor Pattern"

**Major Section Removal:**

#### "Chat Orchestrator Architecture (v4.3)" Section (Lines 1752-1876)

**Removed:** Entire section describing 3-path LangGraph orchestrator architecture

**Rationale:**
- This code was DELETED in Story 1.7 (per CLAUDE.md: "Legacy Code (Removed in Story 1.7)")
- Files referenced (`lib/agent/orchestrator/*`) no longer exist
- Replaced by v2 agent system with supervisor pattern

**Removed Content:**
- Architecture diagram showing vanilla/retrieval/analysis paths
- "Three Paths" table with path descriptions
- Lightweight router implementation details
- Key Files table listing orchestrator files
- Benefits section
- Metrics interface
- State schema (OrchestratorStateAnnotation)

**Replaced With:**
- New "Agent System Architecture (v2)" section
- High-level supervisor pattern flow diagram
- Reference to `docs/features/agent-v2/` for detailed implementation
- Key Components table with actual current files
- Tool Categories overview

**Implementation Status Table Updates:**
- Line 34: Changed "Chat Orchestrator" to "Agent System"
- Changed description from "3-path LangGraph (vanilla/retrieval/analysis)" to "v2 supervisor pattern with Graphiti retrieval"
- Updated version from "✅ v4.3" to "✅ v4.4"

**New References Added:**
- Line 1754: Added pointer to `docs/features/agent-v2/` for complete implementation details
- Line 1796: Added reference to detailed architecture documentation

---

