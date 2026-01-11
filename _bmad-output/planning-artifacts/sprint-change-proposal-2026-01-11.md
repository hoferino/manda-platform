# Sprint Change Proposal: CIM MVP Fast Track

**Date:** 2026-01-11
**Author:** Max (via PM Agent)
**Status:** Draft - Pending Approval
**Scope:** Minor-Moderate (New parallel track, no disruption to existing work)

---

## 1. Issue Summary

### Problem Statement

Development velocity on Agent System v2.0 is too slow to get the core value proposition (CIM generation) in front of users for testing. The current architecture, while technically sound, is over-engineered for validating product-market fit.

### Evidence

- Local IDE testing with Claude (no LangGraph/orchestration) produced good CIM results
- Existing CIM Builder UI components are ready but not wired to a working agent
- API costs are a concern - Claude Max plan preferred for analysis phase
- Need user feedback on CIM workflow ASAP

### Discovery Context

- Triggered by: Strategic velocity decision
- Type: Parallel MVP track (not replacing v2, running alongside)

---

## 2. Impact Analysis

### What This Change Does NOT Affect

| Item | Status |
|------|--------|
| Agent System v2.0 development | **Continues unchanged** |
| Existing PRD, Architecture, Epics | **Remain valid for v2** |
| Current codebase in `lib/agent/v2/` | **Untouched** |

### What This Change Creates

A new **parallel MVP track** for immediate user testing:

| Component | Description |
|-----------|-------------|
| Improved `manda-analyze` skill | Enhanced document analysis → JSON output |
| JSON knowledge file | Structured extraction stored in project folder |
| Simplified CIM agent | Basic LangGraph with memory, web search, JSON access |
| UI wiring | Connect existing CIM Builder UI to simplified agent |

---

## 3. Recommended Approach

### Strategy: Parallel MVP Track

Run a lightweight CIM implementation alongside the full v2 development:

```
TRACK A (Continues): Agent System v2.0
├── Full middleware architecture
├── Graphiti/Neo4j integration
├── Specialist agents
└── Enterprise-grade features

TRACK B (NEW - Fast MVP): CIM Fast Track
├── manda-analyze (IDE) → JSON file
├── Simple agent (chat + web search + memory)
├── Existing CIM UI components
└── Immediate user testing
```

### Rationale

- **Low Risk:** Doesn't disrupt ongoing v2 work
- **Low Effort:** Leverages existing UI components
- **High Value:** Gets core CIM workflow testable immediately
- **Learning:** User feedback informs v2 priorities

---

## 4. Detailed Change Proposals

### 4.1 Improved manda-analyze Skill

**Current State:** Basic document analyzer outputting Markdown

**Proposed Changes:**

```
File: .claude/commands/manda-analyze.md

Changes:
- Output format: JSON (not Markdown)
- Comprehensive extraction (everything, user decides relevance)
- Structured by CIM sections
- Source attribution for every finding
- Store in project folder: data/{company}/knowledge.json
```

**JSON Schema (proposed):**

```json
{
  "metadata": {
    "analyzed_at": "ISO date",
    "documents": ["list of files"],
    "company_name": "string"
  },
  "sections": {
    "company_overview": {
      "history": [...findings],
      "mission_vision": [...findings],
      "milestones": [...findings]
    },
    "management_team": [...],
    "business_model": [...],
    "financial_performance": [...],
    "market_opportunity": [...],
    "competitive_landscape": [...],
    "growth_strategy": [...],
    "risk_factors": [...]
  },
  "raw_extractions": {
    "all_findings": [...every finding with source]
  }
}
```

---

### 4.2 Simplified CIM Agent

**Location:** `manda-app/lib/agent/cim-mvp/` (separate from v2)

**Capabilities:**
- Conversation memory (thread-scoped, persisted)
- Read JSON knowledge file
- Read source documents (fallback for specific questions)
- Web search (for market data, comps, etc.)
- CIM workflow phase tracking
- Task tool pattern (reasoning about what to do next)

**Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│  CIM MVP Agent                                               │
├─────────────────────────────────────────────────────────────┤
│  Input: User message + conversation history                  │
│                                                              │
│  Context:                                                    │
│    - JSON knowledge file (loaded at session start)           │
│    - Source documents (on-demand retrieval)                  │
│    - Current CIM phase & progress                            │
│                                                              │
│  Tools:                                                      │
│    - web_search: External research                           │
│    - read_source: Access original documents                  │
│    - update_slide: Modify slide content                      │
│    - navigate_phase: Move between CIM sections               │
│                                                              │
│  Output: Response + slide updates + sources                  │
└─────────────────────────────────────────────────────────────┘
```

**Key Difference from v2:**
- No middleware stack
- No specialist agents
- No Graphiti/Neo4j
- Simple, direct Claude conversation
- State tracking via simple JSON (not complex AgentState)

---

### 4.3 UI Wiring

**Existing Components (Ready to Use):**
- `components/cim-builder/CIMBuilderPage.tsx` - 3-panel layout
- `components/cim-builder/PreviewPanel/` - Slide preview with wireframe rendering
- `components/cim-builder/ConversationPanel/` - Chat interface
- `components/cim-builder/SourcesPanel/` - Document/findings browser

**Changes Needed:**

```
File: app/api/projects/[id]/cims/[cimId]/chat-mvp/route.ts (NEW)

Purpose: API endpoint for simplified CIM agent
- POST: Send message, get streaming response
- Reads JSON knowledge file from project folder
- Uses simplified agent (not v2 graph)
```

```
File: components/cim-builder/ConversationPanel/ConversationPanel.tsx

Changes:
- Add prop to switch between v2 and MVP agent
- Default to MVP for testing
- Maintain same interface
```

```
File: lib/hooks/useCIMBuilder.ts

Changes:
- Support MVP agent endpoint
- Real-time slide updates from agent responses
- Phase tracking in local state
```

---

### 4.4 Preview Integration

**Existing Preview Components:**
- `SlidePreview.tsx` - Renders slide with components
- `ComponentRenderer.tsx` - Renders individual component types
- `PreviewPanel.tsx` - Navigation and container

**Required Behavior:**
- When agent creates/updates a slide → Preview updates immediately
- Agent tool `update_slide` returns structured slide data
- UI receives slide update via SSE event
- Preview re-renders with new content

**No Changes Needed to Preview Components** - They already support the `Slide` type. Just need to wire the data flow.

---

## 5. Implementation Handoff

### Scope Classification: **Minor-Moderate**

This is a parallel track that can be implemented directly by the development team.

### Implementation Order

1. **Improve manda-analyze** (1-2 hours)
   - Update output format to JSON
   - Expand extraction categories
   - Test with sample documents

2. **Create CIM MVP agent** (4-6 hours)
   - Simple LangGraph graph with memory
   - Tools: web_search, read_source, update_slide
   - JSON knowledge loading
   - Phase tracking

3. **Create MVP API route** (1-2 hours)
   - `/api/projects/[id]/cims/[cimId]/chat-mvp`
   - Streaming SSE response
   - Slide update events

4. **Wire UI** (2-3 hours)
   - Connect ConversationPanel to MVP endpoint
   - Handle slide update events
   - Test end-to-end flow

### Success Criteria

- [ ] manda-analyze produces comprehensive JSON knowledge file
- [ ] CIM agent can answer questions using JSON knowledge
- [ ] CIM agent can search web for additional context
- [ ] Conversation history persists (user can continue where left off)
- [ ] Preview updates when agent creates/modifies slides
- [ ] Complete workflow: analyze docs → chat → build slides → preview

### Git Strategy

Use **git worktrees** for parallel development:

```bash
# Create worktree for MVP track
git worktree add ../manda-platform-mvp -b cim-mvp-fast-track

# Work on MVP in separate directory
cd ../manda-platform-mvp
# ... implement MVP ...

# Main repo continues v2 development
cd ../manda-platform
# ... continue v2 work ...
```

This keeps both tracks isolated and mergeable.

---

## 6. Next Steps

Upon approval:

1. **Create git worktree** for MVP development
2. **Improve manda-analyze skill** - output JSON
3. **Build simplified CIM agent** in `lib/agent/cim-mvp/`
4. **Wire to existing UI**
5. **Test with real documents**
6. **Get user feedback**

---

## Approval

**Requested Action:** Approve this parallel MVP track

- [ ] Approved - Proceed with implementation
- [ ] Approved with modifications - [specify]
- [ ] Rejected - [reason]

---

*Generated by BMAD Course Correction Workflow*
*Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>*
