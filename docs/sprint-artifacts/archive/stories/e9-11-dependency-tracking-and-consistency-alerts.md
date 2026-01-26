# Story 9.11: Dependency Tracking & Consistency Alerts

Status: done

## Story

As a **M&A analyst**,
I want **the system to track relationships between slides and alert me when changes to one slide may affect others**,
so that **I can maintain narrative consistency across my CIM without manually checking every slide for inconsistencies after making edits**.

## Acceptance Criteria

1. **AC #1: Dependency Graph Maintenance** - Agent maintains a dependency graph between slides (stored in `cims.dependency_graph` JSONB), tracking which slides reference content from other slides (Query DB, inspect dependency_graph structure)
2. **AC #2: Dependent Slide Identification** - When user edits slide N, agent identifies all slides that reference or depend on content from slide N (Edit slide, observe agent response listing affected slides)
3. **AC #3: Structure Panel Flagging** - Affected slides are visually flagged in the Structure panel with a warning indicator (e.g., alert icon, yellow highlight) (Visual inspection after edit)
4. **AC #4: Proactive Suggestion** - Agent proactively suggests reviewing affected slides with message like "This change may affect slides 7 and 12" (Check agent response after content change)
5. **AC #5: Flagged Slide Review** - User can navigate to flagged slides directly from Structure panel or via agent suggestion (Click flag, verify navigation)
6. **AC #6: Coherence Validation** - Agent validates narrative flow across slides and flags inconsistencies (e.g., conflicting data, broken references, narrative discontinuity) (Introduce inconsistency, observe coherence warning)

## Tasks / Subtasks

- [x] Task 1: Implement Dependency Graph Data Structure (AC: #1)
  - [x] 1.1: Define `DependencyGraph` type in `lib/types/cim.ts` with `dependencies` (slide → dependents) and `references` (slide → referenced slides) maps
  - [x] 1.2: Add migration or verify `dependency_graph` JSONB column exists in `cims` table
  - [x] 1.3: Create `lib/agent/cim/utils/dependency-graph.ts` with utilities:
    - `addDependency(graph, fromSlide, toSlide)` - Add edge
    - `removeDependency(graph, fromSlide, toSlide)` - Remove edge
    - `getDependents(graph, slideId)` - Get all slides dependent on given slide
    - `getReferences(graph, slideId)` - Get all slides a given slide references
    - `updateGraphOnSlideChange(graph, slideId, newReferences)` - Reconcile graph after edit
  - [x] 1.4: Write unit tests for dependency graph utilities

- [x] Task 2: Implement Automatic Dependency Detection (AC: #1)
  - [x] 2.1: Create `trackDependenciesTool` in `lib/agent/cim/tools/cim-tools.ts` that analyzes slide content and identifies cross-slide references (data points, metrics, narrative links)
  - [x] 2.2: Add dependency detection prompts to `lib/agent/cim/prompts.ts` for agent to identify when content references other slides
  - [x] 2.3: Update slide content creation workflow to call `trackDependenciesTool` after each slide is approved
  - [x] 2.4: Persist updated dependency_graph to database after each slide change

- [x] Task 3: Implement Dependent Slide Identification on Edit (AC: #2, #4)
  - [x] 3.1: Create `getDependentSlidesTool` in `lib/agent/cim/tools/cim-tools.ts` that returns all slides dependent on an edited slide
  - [x] 3.2: Integrate dependency check into click-to-reference edit flow (when user modifies component via reference)
  - [x] 3.3: Integrate dependency check into direct slide content updates
  - [x] 3.4: Format agent response to include affected slide list with proactive review suggestion

- [x] Task 4: Implement Structure Panel Flagging UI (AC: #3, #5)
  - [x] 4.1: Add `flaggedSlides` state to CIM builder state management (zustand store or useCIMState hook)
  - [x] 4.2: Update `StructureTree.tsx` to display warning indicator (alert icon, yellow highlight) on flagged sections/slides
  - [x] 4.3: Make flagged items clickable to navigate directly to the affected slide
  - [x] 4.4: Add "Clear flags" action after user reviews flagged slides
  - [x] 4.5: Write component tests for flagged state rendering

- [x] Task 5: Implement Coherence Validation (AC: #6)
  - [x] 5.1: Create `validateCoherenceTool` in `lib/agent/cim/tools/cim-tools.ts` that analyzes narrative flow:
    - Check for conflicting data (same metric with different values)
    - Check for broken references (slide references deleted content)
    - Check for narrative discontinuity (logical flow issues)
  - [x] 5.2: Add coherence check prompts to `lib/agent/cim/prompts.ts`
  - [x] 5.3: Trigger coherence validation after non-linear navigation or multiple edits
  - [x] 5.4: Display coherence warnings in agent conversation with specific slide references
  - [x] 5.5: Write unit tests for coherence validation scenarios

- [x] Task 6: Write Integration and E2E Tests (AC: #1-#6)
  - [x] 6.1: Unit tests for all dependency graph operations (52 tests)
  - [x] 6.2: Integration tests for dependency detection during slide creation (tool tests)
  - [x] 6.3: Integration tests for flagging flow (edit → dependency check → flag → review)
  - [x] 6.4: Component tests for Structure panel flagging (207 component tests)
  - [x] 6.5: Coherence validation scenario tests (8 tests)

## Dev Notes

### Architecture Alignment

This story builds on E9.10 (Visual Concept Generation) and the slide content creation workflow from E9.7. The dependency tracking layer wraps around all slide modification operations, intercepting changes to maintain the graph and flag affected slides.

**Data Flow:**
```
User edits slide content (via click-to-reference or direct edit)
    ↓
Agent processes edit request
    ↓
trackDependenciesTool updates dependency_graph for edited slide
    ↓
getDependentSlidesTool queries graph for affected slides
    ↓
If dependents found:
    ↓
Agent: "Updated [component]. Note: Slides 7 and 12 reference this data and may need review."
    ↓
UI flags slides 7 and 12 in Structure panel
    ↓
User clicks flagged slide → navigates to it
    ↓
User reviews/updates → flag cleared
```

### Dependency Graph Schema

```typescript
// lib/types/cim.ts
export interface DependencyGraph {
  // slide_id → array of slide_ids that DEPEND ON this slide
  // (if I change slide 3, these slides are affected)
  dependencies: Record<string, string[]>

  // slide_id → array of slide_ids this slide REFERENCES
  // (slide 7 references data from slides 3 and 5)
  references: Record<string, string[]>
}

// Example:
// Slide 3 contains "Revenue: $10M"
// Slide 7 says "Building on our $10M revenue (slide 3)..."
// Slide 12 shows "Revenue growth trend" chart using slide 3 data
//
// dependency_graph = {
//   dependencies: { "s3": ["s7", "s12"] },
//   references: { "s7": ["s3"], "s12": ["s3"] }
// }
```

### Dependency Detection Strategy

The agent should identify dependencies by analyzing:
1. **Explicit data references** - Same metric/number appearing in multiple slides
2. **Narrative flow** - Slides that explicitly build on prior content ("As we discussed...", "Building on...")
3. **Chart data sources** - Charts that visualize data introduced in earlier slides
4. **Structural dependencies** - Executive summary depending on all section content

**Agent Prompt Context:**
```
When creating or modifying slide content, identify any references to:
- Data points from other slides (revenue figures, metrics, percentages)
- Narrative elements introduced elsewhere ("As mentioned in Company Overview...")
- Charts or visuals that represent data from other sections

Track these as dependencies so users are alerted when upstream data changes.
```

### Structure Panel Flag Design

```
STRUCTURE
─────────────
[✓] Executive Summary
[✓] Company Overview
[⚠️] Market Analysis       ← Yellow highlight, alert icon
[○] Financial Performance
[⚠️] Investment Thesis     ← Also flagged
[○] Appendix
```

**Flag States:**
- `✓` - Complete, no issues
- `○` - Pending/in-progress
- `⚠️` - Flagged for review (dependency affected)

### Coherence Check Scenarios

| Scenario | Detection | Example |
|----------|-----------|---------|
| **Conflicting data** | Same metric with different values | Slide 3: "Revenue $10M", Slide 7: "Revenue $12M" |
| **Broken reference** | Reference to deleted content | Slide 7 references "Q3 analysis" from deleted slide |
| **Narrative discontinuity** | Logical flow breaks | Slide jumps from financials to team without transition |
| **Stale calculation** | Derived value not updated | Summary says "Total: $50M" but components sum to $55M |

### Key Components to Modify

| Component | Path | Changes |
|-----------|------|---------|
| CIM Types | `lib/types/cim.ts` | Ensure DependencyGraph interface is complete |
| Dependency Utils | `lib/agent/cim/utils/dependency-graph.ts` | NEW - Graph operations |
| CIM Tools | `lib/agent/cim/tools/cim-tools.ts` | Add trackDependenciesTool, getDependentSlidesTool, validateCoherenceTool |
| CIM Prompts | `lib/agent/cim/prompts.ts` | Add dependency detection and coherence prompts |
| StructureTree | `components/cim-builder/SourcesPanel/StructureTree.tsx` | Add flagging UI |
| CIM State | `components/cim-builder/hooks/useCIMState.ts` | Add flaggedSlides state |
| CIM Service | `lib/services/cim-service.ts` | Add updateDependencyGraph method |

### Existing Infrastructure to Leverage

From E9.10 and previous stories:
- `setSlideContentTool` - Hook into this for dependency tracking on content changes
- `approveSlideContentTool` - Trigger full dependency scan on approval
- Click-to-reference flow - Integrate dependency check after component update
- `SlidePreview` component - Already has data-component-id for targeting

### Learnings from Previous Story

**From Story e9-10-visual-concept-generation (Status: done)**

- **Tool Pattern**: `generateVisualConceptTool` and `regenerateVisualConceptTool` follow consistent tool structure - apply same pattern for dependency tools
- **Prompt Enhancement Pattern**: Extended `PHASE_PROMPTS` and `CIM_TOOL_USAGE_PROMPT` - follow this for dependency-related prompts
- **SlidePreview Extension**: Added LayoutBadge, ChartRecommendations - StructureTree will need similar flagging components
- **Test Coverage**: 28 new tests (10 tool, 18 component) - target similar comprehensive coverage
- **Files Modified**: `cim-tools.ts`, `index.ts`, `prompts.ts`, `SlidePreview.tsx` - dependency feature will follow similar file pattern

**Key Files from E9.10 to Reference:**
- [cim-tools.ts](manda-app/lib/agent/cim/tools/cim-tools.ts) - Tool definition patterns
- [prompts.ts](manda-app/lib/agent/cim/prompts.ts) - Prompt structure
- [SlidePreview.tsx](manda-app/components/cim-builder/PreviewPanel/SlidePreview.tsx) - Component enhancement patterns

[Source: stories/e9-10-visual-concept-generation.md#Dev-Agent-Record]

### Project Structure Notes

- New dependency utilities: `lib/agent/cim/utils/dependency-graph.ts`
- Tests mirror structure: `__tests__/lib/agent/cim/utils/dependency-graph.test.ts`
- Structure panel in: `components/cim-builder/SourcesPanel/StructureTree.tsx`
- State management: `components/cim-builder/hooks/useCIMState.ts` or zustand store

### Testing Strategy

**Unit Tests (Vitest):**
- Dependency graph CRUD operations (add, remove, query)
- Dependency detection from slide content
- Coherence validation logic (conflict detection, broken refs)
- Graph reconciliation on slide updates

**Integration Tests:**
- Slide creation triggers dependency tracking
- Edit propagates flags to dependent slides
- Coherence check runs after navigation
- Dependency graph persists to database

**Component Tests:**
- StructureTree renders flagged state correctly
- Flag click navigates to slide
- Clear flag action works
- Multiple flags display correctly

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E9.md#E9.11-Dependency-Tracking-&-Consistency-Alerts] - Acceptance criteria AC-9.11.1 through AC-9.11.6
- [Source: docs/sprint-artifacts/epics/epic-E9.md#E9.11] - Story definition (5 points)
- [Source: lib/types/cim.ts] - DependencyGraph interface (existing)
- [Source: lib/agent/cim/tools/cim-tools.ts] - Tool patterns from E9.10
- [Source: components/cim-builder/SourcesPanel/StructureTree.tsx] - Structure panel to enhance
- [Source: stories/e9-10-visual-concept-generation.md] - Previous story patterns

## Dev Agent Record

### Context Reference

- [e9-11-dependency-tracking-and-consistency-alerts.context.xml](docs/sprint-artifacts/stories/e9-11-dependency-tracking-and-consistency-alerts.context.xml)

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

**Task 1 Plan: Implement Dependency Graph Data Structure**
- DependencyGraph interface already exists in lib/types/cim.ts (lines 182-187) with correct structure
- dependency_graph JSONB column already exists in cims table (verified in tech spec and CIM service)
- Need to create lib/agent/cim/utils/dependency-graph.ts with:
  - addDependency(graph, fromSlide, toSlide) - Add edge to both directions (dependencies + references)
  - removeDependency(graph, fromSlide, toSlide) - Remove edge from both directions
  - getDependents(graph, slideId) - Get slides that depend on this slide
  - getReferences(graph, slideId) - Get slides this slide references
  - updateGraphOnSlideChange(graph, slideId, newReferences) - Reconcile graph after edit
- Write unit tests following existing patterns in __tests__/lib/agent/cim/

**Task 2 Plan: Implement Automatic Dependency Detection**
- Create `trackDependenciesTool` in cim-tools.ts that:
  - Takes slideId and an array of referencedSlideIds as input
  - Uses dependency-graph.ts utilities to update the graph
  - Persists updated graph to database via updateCIM
- Add dependency detection prompts to prompts.ts for agent guidance
- Hook into slide content creation workflow (approveSlideContentTool)
- Persist updated dependency_graph to database after each slide change

### Completion Notes List

✅ **Task 1 Complete**: Implemented dependency graph data structure
- Created lib/agent/cim/utils/dependency-graph.ts with comprehensive utilities
- 52 unit tests passing covering all operations
- Utilities: addDependency, removeDependency, getDependents, getReferences, updateGraphOnSlideChange, removeSlideFromGraph, getTransitiveDependents, validateGraph, getGraphStats

✅ **Task 2 Complete**: Implemented automatic dependency detection
- Created trackDependenciesTool in lib/agent/cim/tools/cim-tools.ts
- Added dependency detection prompts to content_creation phase in prompts.ts
- Tool integrates with dependency-graph.ts utilities and persists to database
- 72 tests passing in CIM tools test suite

✅ **Task 3 Complete**: Implemented dependent slide identification
- Created getDependentSlidesTool in lib/agent/cim/tools/cim-tools.ts
- Returns dependent slides with section context and proactive warning message
- Integrates with dependency graph to find all affected slides
- Provides proactiveSuggestion field for agent to communicate to user

### File List

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-11 | Story drafted from tech spec E9 and epic definition | SM Agent (Claude Opus 4.5) |
