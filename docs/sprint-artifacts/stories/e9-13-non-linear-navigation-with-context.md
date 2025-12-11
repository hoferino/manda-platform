# Story 9.13: Non-Linear Navigation with Context

Status: done

## Story

As a **M&A analyst**,
I want **to jump to any section in the CIM outline while the agent maintains full context of my workflow state, completed sections, and flagged areas**,
so that **I can work on sections in any order based on my priorities, skip ahead when needed, return to refine earlier sections, and always have the agent aware of what's complete, in-progress, and may need updating**.

## Acceptance Criteria

1. **AC #1: Section Click Navigation** - Clicking any section in the Structure panel navigates to that section, focusing the conversation on that section's content (click works) [Source: tech-spec-epic-E9.md#AC-9.13.1]
2. **AC #2: Agent Jump Acknowledgment** - Agent acknowledges the navigation jump and summarizes the target section's current state (complete/in-progress/pending, slide count, any flags) [Source: tech-spec-epic-E9.md#AC-9.13.2]
3. **AC #3: Section Status Tracking** - Agent tracks and displays section status across the CIM: complete, in-progress, pending (status visible in UI and agent responses) [Source: tech-spec-epic-E9.md#AC-9.13.3]
4. **AC #4: Forward Jump Awareness** - When jumping forward (skipping sections), agent notes which sections are being skipped and their status (e.g., "Skipping Financial Performance - you can return to it later") [Source: tech-spec-epic-E9.md#AC-9.13.4]
5. **AC #5: Backward Jump Awareness** - When jumping backward to an earlier section, agent notes what may need updating and checks for dependency conflicts (e.g., "Returning to Company Overview - slides 7 and 12 reference this content") [Source: tech-spec-epic-E9.md#AC-9.13.5]
6. **AC #6: Coherence Warnings on Navigation** - Agent generates coherence warnings when navigation creates potential inconsistencies (e.g., editing approved content that downstream slides depend on) [Source: tech-spec-epic-E9.md#AC-9.13.6]

## Tasks / Subtasks

- [x] Task 1: Implement Navigation State Tracking (AC: #2, #3)
  - [x] 1.1: Created navigation state types in `lib/types/cim.ts`:
    - `NavigationType` - enum for sequential, jump, backward, forward
    - `NavigationWarning` - interface for dependency warnings
    - `NavigationEvent` - interface for tracking navigation history
    - `NavigationState` - interface for current navigation context
    - `NavigationResult` - interface for navigation operation results
    - `NavigationOptions` - interface for navigation configuration
  - [x] 1.2: Added helper functions to `lib/types/cim.ts`:
    - `createDefaultNavigationState()` - Initialize navigation
    - `determineNavigationType()` - Calculate navigation direction
    - `canNavigateBack()` / `canNavigateForward()` - History navigation checks
  - [x] 1.3: Added Zod schemas for all navigation types

- [x] Task 2: Create Navigation Jump Agent Tool (AC: #1, #2, #4, #5)
  - [x] 2.1: Created `navigateToSectionTool` in `lib/agent/cim/tools/cim-tools.ts`:
    - Takes cimId, sectionId, fromSectionId (optional)
    - Performs coherence check via dependency graph
    - Returns section details, warnings, navigation type
    - Includes formatted message with context summary
  - [x] 2.2: Created `getNextSectionTool` to recommend next section based on dependencies

- [x] Task 3: Implement Coherence Check on Navigation (AC: #6)
  - [x] 3.1: Created `lib/agent/cim/utils/navigation-coherence.ts` (280 lines) with:
    - `checkNavigationCoherence()` - Check for incomplete dependencies
    - `getNavigationContextSummary()` - Build section context
    - `shouldRequireConfirmation()` - Determine if warnings block navigation
    - `formatNavigationWarnings()` - Format warnings for display
    - `getRecommendedNextSection()` - Smart section recommendation
    - `checkJumpSafety()` - Validate jump ahead is safe
  - [x] 3.2: Integrated with dependency-graph.ts utilities for coherence checking

- [x] Task 4: Enhance StructureTree for Navigation (AC: #1, #3)
  - [x] 4.1: Updated `StructureTree.tsx` with new props:
    - `currentSectionId` - Highlight active section
    - `dependencyWarnings` - Show warning indicators per section
    - `onNavigate` - Navigation callback with context
  - [x] 4.2: Added 'needs_review' status to SECTION_STATUSES
  - [x] 4.3: Styled active section with primary color, warning sections with amber

- [x] Task 5: Implement useCIMNavigation Hook (AC: #1, #2, #3, #4, #5)
  - [x] 5.1: Created `lib/hooks/useCIMNavigation.ts` (300 lines) with:
    - `navigateToSection()` - Navigate with coherence check
    - `goBack()` / `goForward()` - History navigation
    - `canGoBack` / `canGoForward` - Navigation state
    - `getWarningsForSection()` - Per-section warnings
    - `getSectionsWithWarnings()` - All sections with issues
    - `getRecommendedNext()` - Smart next section
    - `getContextSummary()` - Section context
    - `acknowledgeWarnings()` - User acknowledgment
    - `resetNavigation()` - Clear state

- [x] Task 6: Add Navigation UI Enhancements (AC: #1, #3)
  - [x] 6.1: StructureTree shows current section indicator (ArrowRight icon)
  - [x] 6.2: Warning count displayed for sections with incomplete dependencies
  - [x] 6.3: Distinct styling for current vs flagged vs pending sections

- [x] Task 7: Write Unit and Integration Tests (AC: #1-#6)
  - [x] 7.1: Navigation coherence tests (34 tests in navigation-coherence.test.ts)
  - [x] 7.2: Navigation types tests (32 tests in cim-navigation.test.ts)
  - [x] 7.3: useCIMNavigation hook tests (27 tests in useCIMNavigation.test.ts)
  - Total: 93 tests (exceeds 50 test target)

## Dev Notes

### Architecture Alignment

This story completes the CIM Builder's navigation system by enabling non-linear section access while maintaining agent context. It builds on:
- **E9.3** (3-Panel Layout): StructureTree already has click handlers and section display
- **E9.11** (Dependency Tracking): Dependency graph enables coherence checking
- **E9.12** (Narrative Structure): Narrative roles inform coherence warnings

**Navigation Flow:**
```
User clicks section in StructureTree
    ↓
useCIMNavigation.navigateToSection(sectionId)
    ↓
navigateToSectionTool calculates:
    - Current vs target section (direction)
    - Sections being skipped (if forward)
    - Dependencies affected (if backward)
    ↓
checkNavigationCoherenceTool validates:
    - No circular dependencies created
    - Approved content not orphaned
    ↓
Agent responds with acknowledgment:
    "Jumping to Financial Performance.
     Skipping: Company Overview (in-progress), Market Analysis (pending)
     Current state: 2/5 slides complete
     Note: This section references data from Company Overview"
    ↓
workflow_state.current_section_index updated
navigation_history appended
UI updates: StructureTree highlights current, ConversationPanel refocuses
```

### Key Components to Modify/Create

| Component | Path | Changes |
|-----------|------|---------|
| Navigation Utils | `lib/agent/cim/utils/navigation.ts` | NEW - Direction, summary, context utilities |
| CIM Types | `lib/types/cim.ts` | Add NavigationEvent, extend WorkflowState |
| CIM Tools | `lib/agent/cim/tools/cim-tools.ts` | Add navigateToSectionTool, checkNavigationCoherenceTool |
| CIM Prompts | `lib/agent/cim/prompts.ts` | Add navigation phase prompts |
| StructureTree | `components/cim-builder/SourcesPanel/StructureTree.tsx` | Add active section, keyboard nav |
| useCIMNavigation | `lib/hooks/useCIMNavigation.ts` | NEW - Navigation state management |
| Navigation Breadcrumb | `components/cim-builder/NavigationBreadcrumb.tsx` | NEW - Phase/Section display |

### Learnings from Previous Story

**From Story e9-12-narrative-structure-dependencies (Status: done)**

- **New Service Pattern**: `lib/agent/cim/utils/narrative-structure.ts` (490 lines) demonstrates comprehensive utility file structure - navigation.ts should follow similar patterns
- **Tool Structure**: checkNarrativeCompatibilityTool, getSectionReorganizationTool show consistent pattern:
  - Input validation
  - CIM retrieval via service
  - Operation with detailed return
  - Formatted messages for agent
- **Type Extensions**: NarrativeRole and NarrativeStructure added to cim.ts - NavigationEvent should follow same location
- **UI Badge Pattern**: NarrativeRoleBadge in SlidePreview shows how to add visual indicators - apply for active section
- **Test Coverage**: 37 unit tests in single file - target similar comprehensive coverage
- **Files Created**:
  - `lib/agent/cim/utils/narrative-structure.ts`
  - `__tests__/lib/agent/cim/utils/narrative-structure.test.ts`
- **Files Modified**:
  - `lib/types/cim.ts` - Extended with types
  - `lib/agent/cim/tools/cim-tools.ts` - Added 3 tools
  - `components/cim-builder/PreviewPanel/SlidePreview.tsx` - Added badge

[Source: stories/e9-12-narrative-structure-dependencies.md#Dev-Agent-Record]

### Project Structure Notes

- Navigation utilities: `lib/agent/cim/utils/navigation.ts`
- Tests: `__tests__/lib/agent/cim/utils/navigation.test.ts`
- Hook: `lib/hooks/useCIMNavigation.ts`
- Hook tests: `__tests__/lib/hooks/useCIMNavigation.test.ts`
- Component enhancements: `components/cim-builder/SourcesPanel/StructureTree.tsx`

### Testing Strategy

**Unit Tests (Vitest):**
- Navigation direction calculation (forward/backward/same)
- Skipped section detection
- Section status summary generation
- Navigation context building
- Tool input validation and response formatting

**Integration Tests:**
- Navigation triggers agent acknowledgment
- Workflow state updates correctly
- Navigation history persists
- Coherence warnings generated appropriately

**Component Tests:**
- StructureTree highlights current section
- Keyboard navigation works
- Loading states display during navigation
- Breadcrumb updates on navigation

**E2E Tests:**
- Full flow: Click section → See acknowledgment → State updates → Navigate back → See warning

### Example Agent Messages

**Forward Jump (skipping sections):**
```
📍 **Jumping to Financial Performance**

**Current Position:** You're in Company Overview (Slide 2 of 4)
**Target Section:** Financial Performance (0 slides created)

**Skipped Sections:**
- Market Analysis (pending - not started)

**What Happens Next:**
I'll help you create the Financial Performance slides. You can return to Market Analysis anytime.

Would you like me to start with revenue metrics or profitability?
```

**Backward Jump (with dependencies):**
```
📍 **Returning to Company Overview**

**Target Section State:**
- 4 slides complete
- Status: approved

⚠️ **Dependency Note:**
Slides in later sections reference this content:
- Slide 7 (Financial Performance) references "founding year"
- Slide 12 (Growth Strategy) references "team size"

Changes here may require updates to those slides. I'll track any modifications.

What would you like to change?
```

**Coherence Warning:**
```
⚠️ **Coherence Alert**

You're navigating to an approved section that downstream content depends on.

**Affected Dependencies:**
- Financial Performance (3 slides) references Company Overview data
- Executive Summary (1 slide) quotes Company Overview metrics

**Options:**
1. Continue editing (I'll flag affected slides for review)
2. View affected slides first
3. Cancel navigation

What would you like to do?
```

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E9.md#AC-9.13.1-6] - Acceptance criteria
- [Source: docs/epics.md#E9.13] - Story definition (3 points)
- [Source: lib/types/cim.ts] - CIM types and WorkflowState
- [Source: lib/agent/cim/tools/cim-tools.ts] - Existing tool patterns
- [Source: lib/agent/cim/utils/dependency-graph.ts] - Dependency utilities for coherence checks
- [Source: lib/agent/cim/utils/narrative-structure.ts] - Template for utility file
- [Source: components/cim-builder/SourcesPanel/StructureTree.tsx] - Navigation click handling
- [Source: stories/e9-12-narrative-structure-dependencies.md] - Previous story patterns

## Dev Agent Record

### Context Reference

- [e9-13-non-linear-navigation-with-context.context.xml](e9-13-non-linear-navigation-with-context.context.xml) - Generated 2025-12-11

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- All 6 acceptance criteria implemented
- 93 unit tests written (exceeds 50 target)
- Type check passes
- Navigation coherence utilities integrated with existing dependency graph
- Added 2 new agent tools: `navigateToSectionTool`, `getNextSectionTool`
- StructureTree enhanced with current section highlighting and warning indicators
- useCIMNavigation hook provides complete navigation state management

### File List

**New Files Created:**
- `manda-app/lib/agent/cim/utils/navigation-coherence.ts` (280 lines) - Coherence checking utilities
- `manda-app/lib/hooks/useCIMNavigation.ts` (300 lines) - Navigation state management hook
- `manda-app/__tests__/lib/agent/cim/utils/navigation-coherence.test.ts` (34 tests)
- `manda-app/__tests__/lib/hooks/useCIMNavigation.test.ts` (27 tests)
- `manda-app/__tests__/lib/types/cim-navigation.test.ts` (32 tests)

**Modified Files:**
- `manda-app/lib/types/cim.ts` - Added NavigationType, NavigationWarning, NavigationEvent, NavigationState, NavigationResult, NavigationOptions types and Zod schemas. Added 'needs_review' to SECTION_STATUSES. Added navigation helper functions.
- `manda-app/lib/agent/cim/tools/cim-tools.ts` - Added navigateToSectionTool and getNextSectionTool (2 new tools, total now 22)
- `manda-app/components/cim-builder/SourcesPanel/StructureTree.tsx` - Added currentSectionId, dependencyWarnings, onNavigate props. Enhanced styling for current section and warnings.

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-11 | Story drafted with full acceptance criteria, tasks, and learnings from E9.12 | SM Agent (Claude Opus 4.5) |
| 2025-12-11 | Story implemented: All 7 tasks completed, 93 tests passing, all ACs met | Dev Agent (Claude Opus 4.5) |
