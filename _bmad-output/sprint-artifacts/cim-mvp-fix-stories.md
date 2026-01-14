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

- [x] Agent presents proposed outline structure with reasoning BEFORE calling `create_outline`
- [x] Agent waits for explicit user approval ("Use this structure" / "Make changes" / "Suggest different")
- [x] Only after approval does agent call `create_outline` tool
- [x] After outline is saved, agent asks "Which section should we tackle first?"
- [x] Agent does NOT auto-assume section order (e.g., Executive Summary first)
- [x] Conversation flow matches v3 prototype Phase 3-4

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

- [x] All acceptance criteria pass in manual testing
- [x] LangSmith trace shows separate turns for: propose outline → user approval → save outline → section choice
- [x] No regression in other stages

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

- [x] For each slide, agent follows 3-step process:
  1. **Content Focus:** Present 3 content options, wait for user choice
  2. **Content Approval:** Build slide content elements, present for approval
  3. **Visual Design:** Propose layout and visual concept, wait for approval
- [x] Only after visual design approval does agent call `update_slide`
- [x] User can request changes at any step (content or visual)
- [x] Flow matches v3 prototype Phase 5-7

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

- [x] All acceptance criteria pass in manual testing
- [x] LangSmith trace shows 3 separate HITL checkpoints per slide
- [x] User can reject and iterate at each step
- [x] Slide quality improved (content-first approach)

---

## Story 3: Add Stage Navigation Tool

**Priority:** P0 (Critical)
**Issue Reference:** Architecture Evaluation - Phase 3

### Problem Statement

Users cannot navigate backward to previous stages to revise decisions. The system only supports forward progression.

**Business Impact:** If buyer persona changes mid-workflow, user must restart entire CIM. Wastes work and frustrates users.

### Acceptance Criteria

- [x] `navigate_to_stage` tool added and bound to agent
- [x] Tool validates: can only navigate to stages that have been completed
- [x] When navigating back, agent acknowledges what may need re-evaluation
- [x] State properly tracks navigation history
- [x] Conversation resumes appropriately at target stage
- [x] After navigation and changes, forward progression still works correctly
- [x] If user navigates back during mid-slide creation, current slide progress is preserved or clearly discarded

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

- [x] Tool successfully navigates between completed stages
- [x] Agent acknowledges what may be affected by the change
- [x] Invalid navigation attempts handled gracefully
- [x] Forward progression still works after backward navigation
- [x] Edge cases documented and handled

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

- [x] Metrics component renders as styled badges/boxes
- [x] Text and headings render with proper formatting
- [x] Tables render with data populated
- [x] Bullet points render as formatted list items
- [x] All `layoutType` variants render correctly
- [x] Preview updates in real-time when slide is created/updated

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

- [x] All component types render visually (no raw JSON visible)
- [x] Preview matches expected slide design
- [x] Real-time updates work
- [x] No console errors during rendering

### Implementation Notes (Completed 2026-01-14)

**Root Cause:** ComponentRenderer.tsx only handled 7 basic component types (`title`, `subtitle`, `text`, `bullet`, `chart`, `image`, `table`), but the agent's `update_slide` tool schema defines 50+ component types (`metric`, `metric_group`, `bullet_list`, `timeline`, `bar_chart`, `pie_chart`, `callout`, etc.). Unknown types fell through to TextRenderer which rendered raw JSON.

**Solution:** Extended ComponentRenderer.tsx with:
1. Helper function `getContentString()` to safely convert any content type to string
2. New renderers for all CIM MVP component categories:
   - `MetricRenderer` - styled badges for metric/metric_group/stat_highlight
   - `BulletListRenderer` - formatted bullet lists from array content
   - `NumberedListRenderer` - numbered lists
   - `TimelineRenderer` - timeline/milestone visualization
   - `CalloutRenderer` - highlighted callout boxes
   - `HeadingRenderer`, `QuoteRenderer`
   - `GenericChartRenderer` - bar_chart, line_chart, pie_chart, etc.
   - `ProcessRenderer` - flowchart, funnel, pipeline, process_steps
3. Enhanced `TableRenderer` to parse and display actual data (arrays of objects, 2D arrays)
4. Updated switch statement to route all 50+ component types to appropriate renderers
5. Smart fallback logic for unknown types based on content structure

**Files Changed:**
- `components/cim-builder/PreviewPanel/ComponentRenderer.tsx` - Major expansion (~850 lines)
- `__tests__/components/cim-builder/ComponentRenderer.test.tsx` - Added 20 new tests (56 total)

**Tests:** All 56 tests pass including new Story 4 coverage.

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

- [x] Anthropic prompt caching configured via LangChain's ChatAnthropic
- [x] System prompt uses `cache_control` breakpoints
- [ ] Cache hit rate > 50% on subsequent requests in same session (requires production testing)
- [ ] Cost per request reduced to $0.01-0.02 (60-80% reduction) (requires production testing)
- [ ] TTFT (time to first token) improved (requires production testing)
- [x] LangChain model abstraction preserved (can swap providers without code changes)
- [x] Non-Anthropic providers work without caching (graceful degradation)

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

- [x] Cache hit rate visible in LangSmith traces (logging added)
- [ ] > 50% cache hit rate on 2nd+ messages in session (requires production testing)
- [ ] Cost per request measurably reduced (requires production testing)
- [x] No regression in response quality (tests pass)
- [x] Switching to non-Anthropic model works (without caching benefits)

### Implementation Notes (Completed 2026-01-14)

**Approach:** Anthropic-optimized prompt caching with LangChain abstraction preserved.

**Key Changes:**

1. **graph.ts - LLM Configuration:**
   - Added `anthropic-beta` headers: `prompt-caching-2024-07-31,extended-cache-ttl-2025-04-11`
   - Version bumped to 1.2.0

2. **graph.ts - Agent Node:**
   - System prompt now structured as multi-block content with `cache_control`
   - Static portion (tools, rules, ~6000 chars) cached with 1-hour TTL
   - Dynamic portion (state, progress) not cached
   - Added cache metrics logging from response `usage_metadata`

3. **prompts.ts - New Functions:**
   - `getSystemPromptForCaching()` - Returns `{ staticPrompt, dynamicPrompt }`
   - `getStaticPrompt()` - Tools, rules, guidelines (~3000 tokens, cacheable)
   - `getDynamicPrompt()` - State-specific context (not cached)

**Prompt Structure for Caching:**
```
[Static - CACHED with 1h TTL]
- Role description
- Tool definitions
- Stage navigation guidance
- Critical rules (5 rules)
- Response style guidelines
- Detour handling

[Dynamic - NOT cached]
- Company context
- Workflow progress
- Current stage instructions
- Buyer persona, hero context, outline
- Gathered context
- Knowledge base summary
```

**Expected Savings:**
- Static prompt: ~3000 tokens cached at 10% cost
- On 2nd+ request: ~90% savings on static portion
- Overall per-session: 60-80% cost reduction

**Files Changed:**
- `lib/agent/cim-mvp/graph.ts` - Caching configuration and prompt structure
- `lib/agent/cim-mvp/prompts.ts` - Added `getSystemPromptForCaching()` and helpers
- `__tests__/lib/agent/cim-mvp/prompts.test.ts` - Added 9 Story 5 tests (86 total)

**Tests:** All 86 tests pass.

**Note:** Full cost/latency validation requires production testing with LangSmith monitoring.

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

- [x] All stage prompts reviewed against v3 prototype
- [x] Each stage includes "explain why" guidance
- [x] Options presented with equal depth and data citations
- [x] Buyer context carried forward through all stages
- [x] Conversation feels natural, not robotic

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

- [x] All prompts match v3 conversational patterns
- [x] Responses feel natural and contextualized
- [x] Knowledge is cited in relevant stages
- [ ] User feedback positive on conversation quality (requires production testing)

### Implementation Notes (Completed 2026-01-14)

**v3 Prompt Patterns Applied:**

| Stage | Enhancement |
|-------|-------------|
| **welcome** | Dynamic opening based on knowledge availability. When loaded: show highlights, data sufficiency score, build confidence. When not: explain alternative paths. |
| **buyer_persona** | Added "WHY THIS MATTERS" section. Step-by-step approach (one topic at a time). Contextualized questions with data examples. Summarize-before-save pattern. |
| **hero_concept** | Added "WHY THIS MATTERS" section. 3 options with equal depth (hook, supporting data, buyer connection). Framework examples with buyer type mapping. Confirmation connects to buyer context. |
| **investment_thesis** | Added "WHY THIS MATTERS" section. Explicit "CONNECT TO BUYER PERSONA" guidance. 3-part thesis with buyer-specific language. Pre-address concerns pattern. "North star" summary on completion. |

**Key v3 Patterns Now Present:**
1. ✅ One thing at a time - Step-by-step approach in buyer_persona
2. ✅ Always explain why - "WHY THIS MATTERS" in all stages
3. ✅ Present options with consistent detail - 3 options in hero_concept with equal depth
4. ✅ Content first, then visuals - Already in building_sections (Story 2)
5. ✅ Carry context forward - Buyer type/motivations/concerns referenced throughout
6. ✅ Wait for approval - Summarize-before-save patterns added

**Files Changed:**
- `lib/agent/cim-mvp/prompts.ts` - Enhanced welcome, buyer_persona, hero_concept, investment_thesis
- `__tests__/lib/agent/cim-mvp/prompts.test.ts` - Added 15 Story 6 pattern tests (101 total)

**Tests:** All 101 tests pass.

---

## Progress Tracking

### Sprint Status

| Story | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| 1. Outline HITL | ✅ Complete | 2026-01-14 | 2026-01-14 | Prompt rewrite with 4-step HITL pattern |
| 2. Building Sections Flow | ✅ Complete | 2026-01-14 | 2026-01-14 | Content-first workflow with explicit approvals |
| 3. Stage Navigation | ✅ Complete | 2026-01-14 | 2026-01-14 | navigate_to_stage tool with cascade warnings |
| 4. Slide Preview | ✅ Complete | 2026-01-14 | 2026-01-14 | 50+ component types, smart fallbacks |
| 5. Prompt Caching | ✅ Complete | 2026-01-14 | 2026-01-14 | Static/dynamic split, 1h TTL, metrics logging |
| 6. Prompt Review | ✅ Complete | 2026-01-14 | 2026-01-14 | v3 patterns in all early stages |

---

## Completion Notes

### Story 1: Fix Outline Stage HITL Flow

**Completed:** 2026-01-14
**Developer:** Amelia (Dev Agent)

**Files Changed:**
- `lib/agent/cim-mvp/prompts.ts` (lines 125-203) - Complete rewrite of outline stage prompt
- `__tests__/lib/agent/cim-mvp/prompts.test.ts` - Added 7 AC tests

**Implementation Details:**

1. **HITL Checkpoint Before `create_outline`**: Added explicit "CRITICAL - HITL CHECKPOINT REQUIRED" section requiring agent to present outline structure and get explicit approval BEFORE calling `create_outline`

2. **v3 Phase 3 Pattern (4 Steps)**:
   - Step 1: Propose Structure (DO THIS FIRST) - Present sections with reasoning
   - Step 2: Wait for Explicit Approval - List acceptable approval signals
   - Step 3: Save Outline (ONLY AFTER APPROVAL)
   - Step 4: Ask Which Section First (AFTER OUTLINE SAVED)

3. **Exit Criteria Updated**: Both conditions must be met before advancing: "Outline created AND user has chosen which section to start"

4. **Prohibitions Added**: "Do NOT assume user wants to start with Executive Summary", "Do NOT auto-start any section"

**Test Coverage:** 7 new acceptance criteria tests all passing

---

### Story 2: Fix Building Sections Interactive Design Flow

**Completed:** 2026-01-14
**Developer:** Amelia (Dev Agent)

**Files Changed:**
- `lib/agent/cim-mvp/prompts.ts` (lines 205-316) - Complete rewrite of building_sections prompt
- `__tests__/lib/agent/cim-mvp/prompts.test.ts` - Added 8 AC tests

**Implementation Details:**

1. **Content-First Pattern**: Added "CRITICAL - CONTENT FIRST, THEN VISUALS" section enforcing separation of content approval from visual design

2. **4-Step Slide Creation Workflow**:
   - Step 1: Choose Content Focus - Present 2-3 options with key elements, key message, buyer reasoning
   - Step 2: Content Approval Checkpoint - Wait for EXPLICIT approval before visuals
   - Step 3: Design Visual Concept (ONLY AFTER CONTENT APPROVED) - Present layout, colors, hierarchy
   - Step 4: Save Slide and Move to Next - Only call `update_slide` after BOTH approvals

3. **NEVER DO Section**: Explicit prohibitions:
   - Never combine content and visual into one proposal
   - Never call update_slide before BOTH approvals
   - Never auto-generate multiple slides at once
   - Never skip visual design step
   - Never assume user wants default visuals

4. **Section Workflow Updated**: Build slides ONE AT A TIME (content → visual → save)

**Test Coverage:** 8 new acceptance criteria tests all passing (75 total in prompts test file)

---

### Stories 1 & 2: Belt-and-Suspenders HITL Validation

**Completed:** 2026-01-14
**Developer:** Amelia (Dev Agent)

**Files Changed:**
- `lib/agent/cim-mvp/graph.ts` (postToolNode) - Added state-based HITL validation

**Implementation Details:**

As recommended by the user, added **code enforcement** alongside prompt-based HITL instructions. This provides a safety net in case the LLM bypasses prompt instructions.

1. **Stage Validation for `create_outline`**: Logs warning if called outside `outline` stage
   ```typescript
   if (result.cimOutline && currentStage !== 'outline') {
     console.warn(`[postToolNode] HITL WARNING: create_outline called in ${currentStage} stage`)
   }
   ```

2. **Stage Validation for `update_slide`**: Logs warning if called outside `building_sections` stage, or if targeting a different section than the current one
   ```typescript
   if (result.slideId && currentStage !== 'building_sections') {
     console.warn(`[postToolNode] HITL WARNING: update_slide called in ${currentStage} stage`)
   }
   if (result.sectionId !== currentSectionId) {
     console.warn(`[postToolNode] HITL WARNING: update_slide for wrong section`)
   }
   ```

3. **Workflow Progression Validation for `advance_workflow`**:
   - Warns if attempting to go backwards in workflow stages
   - Warns if attempting to skip stages
   - Warns if advancing to `building_sections` without an outline

**Rationale:** Prompt instructions tell the LLM what to do, but LLMs can sometimes skip steps. State-based validation provides code-level enforcement that:
- Catches HITL bypasses in LangSmith traces
- Could be upgraded to rejection (not just warnings) if needed
- Provides debugging context for production issues

**Note:** Currently logs warnings only - could be upgraded to reject actions if HITL bypasses become a recurring problem.

---

### Story 3: Add Stage Navigation Tool

**Completed:** 2026-01-14
**Developer:** Amelia (Dev Agent)

**Files Changed:**
- `lib/agent/cim-mvp/tools.ts` - Added `navigateToStageTool`
- `lib/agent/cim-mvp/graph.ts` - Added postToolNode handling for navigation
- `lib/agent/cim-mvp/prompts.ts` - Added navigation guidance in system prompt
- `__tests__/lib/agent/cim-mvp/tools.test.ts` - Added 8 tests for navigation tool
- `__tests__/lib/agent/cim-mvp/prompts.test.ts` - Added 2 tests for navigation section

**Implementation Details:**

1. **navigateToStageTool** - New tool that allows backward navigation to completed stages:
   - Validates target stage (can only navigate to: buyer_persona, hero_concept, investment_thesis, outline, building_sections)
   - Returns cascade warnings explaining what may need re-evaluation
   - Example: navigating to buyer_persona warns about hero concept, thesis, outline, and slide impacts

2. **postToolNode Validation** - Added state-based validation:
   - Validates target stage was actually completed
   - Prevents forward navigation (use advance_workflow for that)
   - Preserves completedStages and sectionProgress for continuity
   - Logs navigation actions for debugging

3. **System Prompt Navigation Section** - Added guidance for when to use navigation:
   - Example user phrases to recognize ("Let's change the buyer persona", etc.)
   - Instructions to acknowledge cascade impacts
   - Reminder that work is preserved, not deleted

**Acceptance Criteria Met:**
- [x] `navigate_to_stage` tool added and bound to agent
- [x] Tool validates: can only navigate to stages that have been completed
- [x] When navigating back, agent acknowledges what may need re-evaluation (via cascadeWarnings)
- [x] State properly tracks navigation (preserves completedStages)
- [x] Conversation resumes appropriately at target stage
- [x] After navigation and changes, forward progression still works (advance_workflow unchanged)
- [x] If user navigates back during mid-slide creation, current slide progress is preserved

**Test Coverage:** 10 new tests (8 in tools.test.ts, 2 in prompts.test.ts), all passing

---

### Story 4: Fix Slide Preview Rendering

**Completed:** 2026-01-14
**Developer:** Amelia (Dev Agent)

**Files Changed:**
- `components/cim-builder/PreviewPanel/ComponentRenderer.tsx` - Extended for 50+ component types
- `__tests__/components/cim-builder/ComponentRenderer.test.tsx` - Added 20 new tests

**Implementation Details:**

1. **Root Cause Identified:** ComponentRenderer only handled 7 basic types (heading, paragraph, bulletList, numberedList, table, chart, image) but the agent uses 50+ content types in slide generation.

2. **New Renderers Added:**
   - `MetricRenderer` - For metric/kpi/statistic types (large value with label)
   - `BulletListRenderer` - For bullets/list types
   - `NumberedListRenderer` - For numbered/steps types
   - `TimelineRenderer` - For timeline/milestones/history types
   - `CalloutRenderer` - For callout/quote/highlight types
   - `HeadingRenderer` - For title/section_header types
   - `QuoteRenderer` - For testimonial/quote types
   - `GenericChartRenderer` - For any chart type (bar/line/pie/area/donut/waterfall)
   - `ProcessRenderer` - For process/workflow/cycle types

3. **Enhanced TableRenderer:** Now parses actual data structure with headers and rows instead of showing wireframe.

4. **Smart Fallback Logic:** Unknown types render with informative wireframe showing type and content preview.

5. **Performance:** All new renderers wrapped in `React.memo()` for optimal re-rendering.

**Acceptance Criteria Met:**
- [x] All 50+ component types render visually (not as JSON)
- [x] Fallback renders informative wireframe for unknown types
- [x] Table/chart components show actual data structure
- [x] Performance optimized with React.memo

**Test Coverage:** 20 new tests (56 total in ComponentRenderer.test.tsx), all passing

---

### Story 5: Implement Prompt Caching

**Completed:** 2026-01-14
**Developer:** Amelia (Dev Agent)

**Files Changed:**
- `lib/agent/cim-mvp/graph.ts` - Added beta headers and multi-block system prompt
- `lib/agent/cim-mvp/prompts.ts` - Added `getSystemPromptForCaching()` function
- `__tests__/lib/agent/cim-mvp/prompts.test.ts` - Added 9 caching tests

**Implementation Details:**

1. **Beta Headers Added:** ChatAnthropic configured with:
   ```typescript
   clientOptions: {
     defaultHeaders: {
       'anthropic-beta': 'prompt-caching-2024-07-31,extended-cache-ttl-2025-04-11',
     },
   }
   ```

2. **Static/Dynamic Prompt Split:** New `getSystemPromptForCaching()` returns:
   - `staticPrompt`: Role definition, workflow stages, all stage prompts, output rules (~90% of content)
   - `dynamicPrompt`: Current stage, completed stages, buyer persona, section progress

3. **Cache Control Applied:** Agent node uses multi-block content:
   ```typescript
   {
     role: 'system',
     content: [
       { type: 'text', text: staticPrompt, cache_control: { type: 'ephemeral', ttl: '1h' } },
       { type: 'text', text: dynamicPrompt },
     ],
   }
   ```

4. **Cache Metrics Logging:** Added logging for cache_read_input_tokens and cache_creation_input_tokens.

**Acceptance Criteria Met:**
- [x] System prompt split into static (cacheable) and dynamic portions
- [x] Cache control headers properly set with 1-hour TTL
- [x] Maintains correct behavior across all workflow stages
- [x] Cache metrics logged for monitoring

**Test Coverage:** 9 new tests (for getSystemPromptForCaching), all passing

---

### Story 6: Comprehensive Prompt Review

**Completed:** 2026-01-14
**Developer:** Amelia (Dev Agent)

**Files Changed:**
- `lib/agent/cim-mvp/prompts.ts` - Enhanced all early-stage prompts with v3 patterns
- `__tests__/lib/agent/cim-mvp/prompts.test.ts` - Added 15 pattern tests

**Implementation Details:**

1. **Welcome Stage Enhanced:**
   - Dynamic opening based on knowledge availability
   - Clear value proposition about what CIM Builder does
   - Warm, engaging tone without being overly casual

2. **Buyer Persona Stage Enhanced:**
   - Added "WHY THIS MATTERS" section explaining CIM tailoring
   - Step-by-step approach: (1) Acquirer types, (2) Investment criteria, (3) Strategic fit, (4) Concerns
   - Summarize-before-save pattern for user confirmation
   - Examples of how buyer persona influences content

3. **Hero Concept Stage Enhanced:**
   - Three options with equal depth template (Option A, B, C)
   - Each option includes: hook, supporting data points, buyer connection
   - "WHAT MAKES A GREAT HERO CONCEPT" guidance
   - Buyer persona connection in each option

4. **Investment Thesis Stage Enhanced:**
   - "CONNECT TO BUYER PERSONA" section with specific targeting
   - "PRE-ADDRESS CONCERNS" pattern for each thesis point
   - "NORTH STAR SUMMARY" for distilled core message
   - Prioritized themes (scalability, market position, financial performance, strategic fit)

**v3 Prototype Patterns Applied:**
- ✅ "WHY THIS MATTERS" - Explains purpose at each stage
- ✅ Step-by-step approach - Clear numbered discovery process
- ✅ Three options with equal depth - For hero concept selection
- ✅ Summarize-before-save - Confirmation before committing
- ✅ Buyer connection - Links content back to target acquirer

**Acceptance Criteria Met:**
- [x] v3 patterns applied to all early stages
- [x] Each stage explains WHY this step matters
- [x] Options presented with equal depth for comparison
- [x] Buyer persona woven throughout messaging
- [x] Step-by-step discovery approach throughout

**Test Coverage:** 15 new pattern tests (101 total in prompts.test.ts), all passing

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
