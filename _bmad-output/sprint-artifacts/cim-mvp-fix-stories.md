# CIM MVP Fix Stories

**Sprint:** CIM MVP Fixes
**Created:** 2026-01-14
**Status:** Planning Complete

---

## Sprint Overview

Fix critical workflow and UI issues identified during CIM MVP testing. Focus on achieving natural conversation flow matching the v3 prototype while maintaining LangGraph's workflow enforcement.

### Business Impact

These fixes are essential for:
- **User trust:** HITL checkpoints ensure users feel in control of CIM creation
- **Demo readiness:** Slide rendering must work for stakeholder demos
- **Cost efficiency:** Token optimization reduces per-request costs by 60-80%
- **Quality output:** Content-first workflow produces better slides

### Priority Summary

| Priority | Stories | Focus | Why |
|----------|---------|-------|-----|
| P0 | 1, 2, 3 | Critical workflow HITL issues | Users lose control without approval checkpoints |
| P1 | 4 | UI rendering | Blocks demos and user testing |
| P2 | 5 | Token optimization | $0.05/request is unsustainable at scale |
| P3 | 6 | Prompt polish | Quality refinement after core fixes |

---

## Story 1: Fix Outline Stage HITL Flow

**Priority:** P0 (Critical)
**Issue Reference:** Testing Log #3, #8

### Problem Statement

The agent skips human-in-the-loop (HITL) approval during the outline stage. After investment thesis is accepted, the agent immediately generates and saves the outline without:
1. Presenting the proposed structure for review
2. Waiting for user approval
3. Asking which section to build first

**Business Impact:** Users lose control over CIM structure. Wrong outline = wasted effort on slides that don't match buyer needs.

### Acceptance Criteria

- [ ] Agent presents proposed outline structure with reasoning BEFORE calling `create_outline`
- [ ] Agent waits for explicit user approval ("Use this structure" / "Make changes" / "Suggest different")
- [ ] Only after approval does agent call `create_outline` tool
- [ ] After outline is saved, agent asks "Which section should we tackle first?"
- [ ] Agent does NOT auto-assume section order (e.g., Executive Summary first)
- [ ] Conversation flow matches v3 prototype Phase 3-4

### Implementation Guidance

1. **Update outline stage prompt** (`lib/agent/cim-mvp/prompts.ts`)
   - Add explicit HITL checkpoint before `create_outline`
   - Include v3 Phase 3 pattern: present structure → wait for approval → save
   - Add v3 Phase 4 pattern: ask which section first

2. **Update stage transition logic** (`lib/agent/cim-mvp/graph.ts`)
   - Ensure `advance_workflow` to `building_sections` only happens after section choice
   - May need state tracking for outline approval status

3. **Test scenarios:**
   - Complete thesis → verify outline proposal shown before save
   - Reject outline → verify agent offers alternatives
   - Approve outline → verify "which section first?" prompt appears
   - Choose section → verify that specific section starts (not Executive Summary by default)

### Suggested Files

| File | Change |
|------|--------|
| `lib/agent/cim-mvp/prompts.ts` | Rewrite `outline` stage instructions |
| `lib/agent/cim-mvp/graph.ts` | May need state tracking for outline approval |

### Definition of Done

- [ ] All acceptance criteria pass in manual testing
- [ ] LangSmith trace shows separate turns for: propose outline → user approval → save outline → section choice
- [ ] No regression in other stages

---

## Story 2: Fix Building Sections Interactive Design Flow

**Priority:** P0 (Critical)
**Issue Reference:** Testing Log #5

### Problem Statement

Slides are auto-generated without following the v3 interactive design workflow:
1. No content focus discussion (v3 Phase 5-6)
2. No visual design approval (v3 Phase 7)
3. No HITL checkpoints during slide creation

**Business Impact:** Auto-generated slides lack buyer context and often miss what matters most. Users can't iterate on content before visual design.

### Acceptance Criteria

- [ ] For each slide, agent follows 3-step process:
  1. **Content Focus:** Present 3 content options, wait for user choice
  2. **Content Approval:** Build slide content elements, present for approval
  3. **Visual Design:** Propose layout and visual concept, wait for approval
- [ ] Only after visual design approval does agent call `update_slide`
- [ ] User can request changes at any step (content or visual)
- [ ] Flow matches v3 prototype Phase 5-7

### Implementation Guidance

1. **Add slide workflow sub-stages** (`lib/agent/cim-mvp/state.ts`)
   - Track current slide, workflow stage (content_focus → content_approval → visual_design → complete)
   - Store intermediate decisions (selected content, visual concept)

2. **Update building_sections prompt** (`lib/agent/cim-mvp/prompts.ts`)
   - Implement v3 Phase 5: Present 3 content focus options
   - Implement v3 Phase 6: Build and present content elements
   - Implement v3 Phase 7: Propose visual design concept
   - Only call `update_slide` after Phase 7 approval

3. **Update postToolNode** (`lib/agent/cim-mvp/graph.ts`)
   - Handle slide workflow sub-stage transitions

4. **Test scenarios:**
   - Start section → verify content options presented
   - Choose content focus → verify content elements shown for approval
   - Approve content → verify visual design proposal
   - Approve visual → verify slide created
   - Reject at any step → verify agent offers alternatives

### Suggested Files

| File | Change |
|------|--------|
| `lib/agent/cim-mvp/state.ts` | Add slide workflow sub-stage tracking |
| `lib/agent/cim-mvp/prompts.ts` | Rewrite `building_sections` stage instructions |
| `lib/agent/cim-mvp/graph.ts` | Update state handling for slide workflow |

### Definition of Done

- [ ] All acceptance criteria pass in manual testing
- [ ] LangSmith trace shows 3 separate HITL checkpoints per slide
- [ ] User can reject and iterate at each step
- [ ] Slide quality improved (content-first approach)

---

## Story 3: Add Stage Navigation Tool

**Priority:** P0 (Critical)
**Issue Reference:** Architecture Evaluation - Phase 3

### Problem Statement

Users cannot navigate backward to previous stages to revise decisions. The system only supports forward progression.

**Business Impact:** If buyer persona changes mid-workflow, user must restart entire CIM. Wastes work and frustrates users.

### Acceptance Criteria

- [ ] `navigate_to_stage` tool added and bound to agent
- [ ] Tool validates: can only navigate to stages that have been completed
- [ ] When navigating back, agent acknowledges what may need re-evaluation
- [ ] State properly tracks navigation history
- [ ] Conversation resumes appropriately at target stage
- [ ] After navigation and changes, forward progression still works correctly
- [ ] If user navigates back during mid-slide creation, current slide progress is preserved or clearly discarded

### Implementation Guidance

1. **Add navigate_to_stage tool** (`lib/agent/cim-mvp/tools.ts`)
   - Validate target stage was completed
   - Define which stages can navigate to which (e.g., can't skip backward to welcome)
   - Return navigation result with context

2. **Update postToolNode** (`lib/agent/cim-mvp/graph.ts`)
   - Handle `navigate_to_stage` tool result
   - Update `workflowProgress.currentStage`
   - Decide: invalidate downstream artifacts OR mark as "needs review"

3. **Update system prompt** (`lib/agent/cim-mvp/prompts.ts`)
   - Add guidance for when to use navigation
   - Include cascade invalidation awareness

4. **Edge cases to handle:**
   - User says "let's change the buyer persona" at outline stage
   - User navigates back, makes no changes, then wants to continue
   - User navigates back during slide creation (mid-building_sections)

5. **Test scenarios:**
   - At outline stage, say "let's go back to buyer persona" → verify navigation works
   - After navigation, verify appropriate context is provided
   - Try to navigate to uncompleted stage → verify error handling
   - Navigate back → forward again → verify state consistency

### Suggested Files

| File | Change |
|------|--------|
| `lib/agent/cim-mvp/tools.ts` | Add `navigate_to_stage` tool |
| `lib/agent/cim-mvp/graph.ts` | Bind tool, handle in postToolNode |
| `lib/agent/cim-mvp/prompts.ts` | Add navigation guidance to system prompt |

### Definition of Done

- [ ] Tool successfully navigates between completed stages
- [ ] Agent acknowledges what may be affected by the change
- [ ] Invalid navigation attempts handled gracefully
- [ ] Forward progression still works after backward navigation
- [ ] Edge cases documented and handled

---

## Story 4: Fix Slide Preview Rendering

**Priority:** P1 (High - Blocks User Testing)
**Issue Reference:** Testing Log #6

### Problem Statement

The slide preview panel renders raw JSON instead of visual slides:
- Raw JSON arrays visible: `[{"label":"ARR","value":"$28.5M"},...]`
- Unformatted component data
- Empty table cells with dotted borders
- Bullet points showing raw array syntax

**Business Impact:** Impossible to demo or test CIM builder until this is fixed. Users cannot evaluate slide quality.

### Acceptance Criteria

- [ ] Metrics component renders as styled badges/boxes
- [ ] Text and headings render with proper formatting
- [ ] Tables render with data populated
- [ ] Bullet points render as formatted list items
- [ ] All `layoutType` variants render correctly
- [ ] Preview updates in real-time when slide is created/updated

### Implementation Guidance

1. **Discovery first:** Investigate root cause
   - Is JSON being stored incorrectly in database?
   - Or is rendering logic missing/broken?
   - Check network response vs rendered output

2. **Audit SlidePreview component** (`components/cim-builder/PreviewPanel/`)
   - Identify how `components` array is being rendered
   - Check `layoutType` mapping to renderers

3. **Fix component renderers**
   - Metrics: Parse `{label, value}` objects → render styled badges
   - Text: Handle string content → render formatted paragraphs
   - Tables: Parse row/column data → render HTML table
   - Lists: Parse array items → render `<ul>/<li>`

4. **Add missing layout type handlers**
   - Audit all `layoutType` values used by agent
   - Ensure each has a corresponding renderer

5. **Test scenarios:**
   - Create slide with metrics → verify badges render
   - Create slide with text blocks → verify formatting
   - Create slide with tables → verify table renders
   - Update slide → verify preview updates real-time

### Suggested Files

| File | Change |
|------|--------|
| `components/cim-builder/PreviewPanel/SlidePreview.tsx` | Fix component rendering |
| `components/cim-builder/PreviewPanel/SlideRenderer.tsx` | May need to create/fix |
| `lib/agent/cim-mvp/types.ts` | Check slide schema for component types |

### Definition of Done

- [ ] All component types render visually (no raw JSON visible)
- [ ] Preview matches expected slide design
- [ ] Real-time updates work
- [ ] No console errors during rendering

---

## Story 5: Implement Prompt Caching

**Priority:** P2 (Cost Optimization)
**Issue Reference:** Architecture Evaluation - Token Optimization

### Problem Statement

Current token usage is high (57k input tokens/request) with 0% cache hit rate, resulting in $0.05-0.06 per request.

**Business Impact:** At 20 messages per CIM session, cost = $1+ per CIM. Unsustainable for production use.

### Architecture Decision: Anthropic-Optimized with LangChain Fallback

**Decision:** Implement Anthropic-specific prompt caching while preserving LangChain abstraction.

**Rationale:**
- 60-80% cost reduction outweighs theoretical model flexibility
- CIM prompts are already Claude-optimized—switching models requires prompt retuning anyway
- LangChain abstraction remains intact as emergency fallback
- Caching is additive—other providers simply won't benefit (graceful degradation)

**Trade-off accepted:** If switching to OpenAI/Gemini in future, caching benefits are lost but system still functions.

### Acceptance Criteria

- [ ] Anthropic prompt caching configured via LangChain's ChatAnthropic
- [ ] System prompt uses `cache_control` breakpoints
- [ ] Cache hit rate > 50% on subsequent requests in same session
- [ ] Cost per request reduced to $0.01-0.02 (60-80% reduction)
- [ ] TTFT (time to first token) improved
- [ ] LangChain model abstraction preserved (can swap providers without code changes)
- [ ] Non-Anthropic providers work without caching (graceful degradation)

### Implementation Guidance

1. **Research LangChain caching support**
   - Check if `ChatAnthropic` supports `cache_control` in message content
   - May need to use `withStructuredOutput` or custom message formatting
   - Anthropic beta header: `anthropic-beta: prompt-caching-2024-07-31`

2. **Structure prompts for caching**
   - Place stable content first (tools, base system prompt, knowledge)
   - Place dynamic content last (conversation history, user message)
   - Add `cache_control: { type: "ephemeral" }` breakpoints at strategic positions
   - Minimum cacheable prefix: 1024 tokens (Haiku), 2048 tokens (Sonnet)

3. **Implement lazy knowledge injection** (`lib/agent/cim-mvp/prompts.ts`)
   - Only inject full knowledge for stages that need it (hero_concept, investment_thesis, building_sections)
   - Use summary for early stages (welcome, buyer_persona)

4. **Preserve model abstraction**
   - Wrap caching config in provider check
   - If provider !== 'anthropic', skip cache_control blocks
   - Document fallback behavior

5. **Add monitoring**
   - Log cache hit/miss from response headers (`anthropic-cache-hit`)
   - Track in LangSmith traces
   - Verify cost reduction in Anthropic dashboard

### Suggested Files

| File | Change |
|------|--------|
| `lib/agent/cim-mvp/graph.ts` | Configure Anthropic caching, preserve abstraction |
| `lib/agent/cim-mvp/prompts.ts` | Structure for caching, lazy knowledge injection |
| `lib/agent/cim-mvp/config.ts` | Add provider detection if needed |

### Definition of Done

- [ ] Cache hit rate visible in LangSmith traces
- [ ] > 50% cache hit rate on 2nd+ messages in session
- [ ] Cost per request measurably reduced
- [ ] No regression in response quality
- [ ] Switching to non-Anthropic model works (without caching benefits)

---

## Story 6: Comprehensive Prompt Review

**Priority:** P3 (Polish)
**Issue Reference:** Testing Log #4, Architecture Evaluation
**Dependencies:** Complete after Stories 1 and 2

### Problem Statement

Prompts across all stages need refinement to match v3 prototype conversational patterns:
- Missing "explain why" context
- Options not presented with consistent detail
- Missing data citations from knowledge
- Generic rather than buyer-contextualized responses

**Business Impact:** Robotic responses reduce user engagement and trust. Missing knowledge citations waste the data we have.

### Scope Note

This story covers prompts NOT already addressed in Stories 1 and 2:
- `welcome`: Dynamic based on knowledge availability
- `buyer_persona`: Contextualize questions with company data
- `hero_concept`: Present 3 data-backed options with citations
- `investment_thesis`: Connect to buyer motivations

Stories 1 and 2 handle `outline` and `building_sections` prompts respectively.

### Acceptance Criteria

- [ ] All stage prompts reviewed against v3 prototype
- [ ] Each stage includes "explain why" guidance
- [ ] Options presented with equal depth and data citations
- [ ] Buyer context carried forward through all stages
- [ ] Conversation feels natural, not robotic

### Implementation Guidance

1. **Create prompt review checklist** based on v3 patterns:
   - [ ] One thing at a time (no bulk generation)
   - [ ] Always explain why (connect to buyer context)
   - [ ] Present options with consistent detail
   - [ ] Content first, then visuals
   - [ ] Carry context forward
   - [ ] Wait for approval before advancing

2. **Review and update each stage prompt:**
   - `welcome`: Dynamic based on knowledge availability
   - `buyer_persona`: Contextualize questions with company data
   - `hero_concept`: Present 3 data-backed options with citations
   - `investment_thesis`: Connect to buyer motivations

3. **Test conversational quality**
   - Compare responses to v3 prototype examples
   - Verify knowledge citations appear in responses
   - Verify buyer context referenced throughout

### Suggested Files

| File | Change |
|------|--------|
| `lib/agent/cim-mvp/prompts.ts` | Update welcome, buyer_persona, hero_concept, investment_thesis prompts |

### Definition of Done

- [ ] All prompts match v3 conversational patterns
- [ ] Responses feel natural and contextualized
- [ ] Knowledge is cited in relevant stages
- [ ] User feedback positive on conversation quality

---

## Progress Tracking

### Sprint Status

| Story | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| 1. Outline HITL | ⬜ Not Started | | | |
| 2. Building Sections Flow | ⬜ Not Started | | | |
| 3. Stage Navigation | ⬜ Not Started | | | |
| 4. Slide Preview | ⬜ Not Started | | | |
| 5. Prompt Caching | ⬜ Not Started | | | |
| 6. Prompt Review | ⬜ Not Started | | | |

### Status Legend

- ⬜ Not Started
- 🔄 In Progress
- ✅ Complete
- ⏸️ Blocked
- ❌ Cancelled

---

## Dependencies

```
Story 1 (Outline HITL) ─────────────────┐
                                        ├─→ Story 6 (Prompt Review)
Story 2 (Building Sections Flow) ───────┘

Story 3 (Stage Navigation) ─→ Independent

Story 4 (Slide Preview) ─→ Independent (can test after Story 2)

Story 5 (Prompt Caching) ─→ Independent (can be done anytime)
```

**Recommended Order:**
1. Story 1 (Outline HITL) - Unblocks user testing
2. Story 2 (Building Sections Flow) - Core workflow fix
3. Story 4 (Slide Preview) - Enables visual testing
4. Story 3 (Stage Navigation) - Improves UX
5. Story 5 (Prompt Caching) - Cost optimization
6. Story 6 (Prompt Review) - Polish (after 1 & 2 complete)

---

## Reference Documents

- [CIM Builder Architecture Evaluation](_bmad-output/planning-artifacts/cim-builder-architecture-evaluation.md)
- [CIM Subgraph Architecture](_bmad-output/planning-artifacts/cim-subgraph-architecture.md)
- [CIM MVP Testing Log](_bmad-output/testing/cim-mvp-testing-log.md)
- [v3 Prototype](.claude/commands/manda-cim-company-overview-v3.md)
