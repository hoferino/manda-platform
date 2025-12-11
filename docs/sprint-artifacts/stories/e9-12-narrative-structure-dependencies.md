# Story 9.12: Narrative Structure Dependencies

Status: done

## Story

As a **M&A analyst**,
I want **the system to understand narrative roles within sections (introduction, evidence, analysis, etc.) and alert me when I move content between slides with incompatible roles**,
so that **I maintain logical narrative flow within each section and the agent can help me reorganize content appropriately when I make structural changes**.

## Acceptance Criteria

1. **AC #1: Narrative Structure Storage** - Section narrative structure is stored when agent creates multi-slide sections (DB check for narrativeStructure field) [Source: tech-spec-epic-E9.md#E9.12]
2. **AC #2: Slide Narrative Role Definition** - Each slide has a defined narrative role (introduction, context, evidence, analysis, implications, projections, conclusion) visible in slide data [Source: tech-spec-epic-E9.md#E9.12]
3. **AC #3: Content-Role Mismatch Detection** - System detects when content moves between slides with incompatible roles (alert triggered on mismatch) [Source: tech-spec-epic-E9.md#E9.12]
4. **AC #4: Content-Role Warning Message** - Agent alerts user with specific message when structure is violated (e.g., "You moved evidence content to a projections slide") [Source: tech-spec-epic-E9.md#E9.12]
5. **AC #5: Reorganization Suggestions** - Agent suggests reorganization to maintain narrative flow when detecting structure violations [Source: tech-spec-epic-E9.md#E9.12]
6. **AC #6: Coherence Tool Extension** - validateCoherenceTool is extended to check narrative structure integrity within sections [Source: tech-spec-epic-E9.md#E9.12]

## Tasks / Subtasks

- [x] Task 1: Define Narrative Role Types and Schema (AC: #1, #2)
  - [x] 1.1: Add `NarrativeRole` type to `lib/types/cim.ts` with roles: `introduction`, `context`, `evidence`, `analysis`, `implications`, `projections`, `conclusion`
  - [x] 1.2: Add `narrative_role` field to `Slide` interface in `lib/types/cim.ts`
  - [x] 1.3: Add `narrativeStructure` field to `OutlineSection` interface to store section's narrative flow definition
  - [x] 1.4: Define `NarrativeStructure` type capturing expected role sequence for each section type
  - [x] 1.5: Update Zod schemas in `lib/types/cim.ts` for new types (`NarrativeRoleSchema`, `NarrativeStructureSchema`)

- [x] Task 2: Implement Narrative Role Assignment During Slide Creation (AC: #1, #2)
  - [x] 2.1: Update `generateSlideContentTool` to auto-assign narrative role based on content and position
  - [x] 2.2: Update `updateSlideTool` to allow changing narrative role with compatibility checking
  - [x] 2.3: Add `suggestNarrativeRoleForSlide()` utility to suggest roles based on content, position, and existing roles

- [x] Task 3: Implement Content-Role Compatibility Matrix (AC: #3, #4)
  - [x] 3.1: Create `lib/agent/cim/utils/narrative-structure.ts` with utilities:
    - `checkContentRoleCompatibility()` - Check if content matches assigned role
    - `inferNarrativeRole()` - Detect role from content patterns
    - `ROLE_COMPATIBILITY_MATRIX` - Full compatibility matrix for all role pairs
    - `ROLE_CONTENT_INDICATORS` - Patterns and keywords for each role
  - [x] 3.2: Define compatibility matrix with high/medium/low/incompatible levels
  - [x] 3.3: Write comprehensive unit tests for compatibility logic (37 tests covering all scenarios)

- [x] Task 4: Implement Content-Role Mismatch Detection Tool (AC: #3, #4)
  - [x] 4.1: Create `checkNarrativeCompatibilityTool` in `lib/agent/cim/tools/cim-tools.ts` that:
    - Takes cimId and slideId
    - Analyzes content characteristics to detect role
    - Checks compatibility with assigned role
    - Returns detailed mismatch information and suggestions
  - [x] 4.2: Integrate compatibility checking into `updateSlideTool` when role changes

- [x] Task 5: Implement Reorganization Suggestion Tool (AC: #5)
  - [x] 5.1: Create `getSectionReorganizationTool` in `lib/agent/cim/tools/cim-tools.ts` that:
    - Takes cimId and sectionId
    - Analyzes narrative flow issues
    - Suggests role changes and reordering
    - Provides proactive message for agent to present
  - [x] 5.2: Implement `suggestReorganization()` utility function

- [x] Task 6: Extend validateCoherenceTool for Narrative Structure (AC: #6)
  - [x] 6.1: Create `validateNarrativeStructureTool` for dedicated narrative structure validation:
    - Check for missing required roles per section type
    - Check for duplicate roles where only one expected
    - Check for role sequence violations
    - Check for content-role mismatches
  - [x] 6.2: Add completeness percentage and formatted message output
  - [x] 6.3: Implement `validateNarrativeStructure()` utility with comprehensive checks

- [x] Task 7: UI Integration for Narrative Role Display (AC: #2)
  - [x] 7.1: Update `SlidePreview.tsx` to show narrative role badge with unique colors and icons
  - [x] 7.2: Add data-narrative-role attribute for testing
  - [x] 7.3: Style narrative role indicators with role-specific colors (purple, slate, emerald, amber, cyan, indigo, rose)

- [x] Task 8: Write Integration and E2E Tests (AC: #1-#6)
  - [x] 8.1: Unit tests for narrative role types (3 tests)
  - [x] 8.2: Unit tests for content-role compatibility matrix (4 tests)
  - [x] 8.3: Unit tests for mismatch detection - inferNarrativeRole and checkContentRoleCompatibility (8 tests)
  - [x] 8.4: Unit tests for default narrative structures (4 tests)
  - [x] 8.5: Unit tests for reorganization suggestions (3 tests)
  - [x] 8.6: Unit tests for narrative structure validation (5 tests)
  - [x] 8.7: Unit tests for suggestNarrativeRoleForSlide (4 tests)
  - [x] 8.8: Edge case tests (4 tests)
  - Total: 37 tests all passing

## Dev Notes

### Architecture Alignment

This story extends E9.11 (Dependency Tracking & Consistency Alerts) to add intra-section intelligence. While E9.11 tracks cross-slide dependencies at the CIM level, E9.12 focuses on **within-section narrative coherence**.

**Data Flow:**
```
User moves content between slides (via click-to-reference or drag)
    ↓
Agent processes content move request
    ↓
detectNarrativeMismatchTool analyzes:
    - Source slide narrative role
    - Target slide narrative role
    - Content type/characteristics
    ↓
If incompatible:
    ↓
Agent: "⚠️ You're moving evidence content to a projections slide. This may disrupt narrative flow."
    ↓
suggestNarrativeReorganizationTool offers alternatives:
    "Consider: (1) Keep in current slide, (2) Move to analysis slide instead, (3) Create new evidence slide"
    ↓
User decides
    ↓
validateCoherenceTool runs periodic checks on section narrative integrity
```

### Narrative Role Schema

```typescript
// lib/types/cim.ts

export type NarrativeRole =
  | 'introduction'   // Sets context, hooks reader
  | 'context'        // Background information, market/industry context
  | 'evidence'       // Data points, facts, supporting information
  | 'analysis'       // Interpretation of evidence, insights
  | 'implications'   // What the analysis means for buyer
  | 'projections'    // Forward-looking statements, forecasts
  | 'conclusion'     // Summary, call to action

export const NARRATIVE_ROLES: NarrativeRole[] = [
  'introduction',
  'context',
  'evidence',
  'analysis',
  'implications',
  'projections',
  'conclusion',
]

export interface NarrativeStructure {
  // Expected sequence of roles for this section type
  expectedRoleSequence: NarrativeRole[]
  // Which roles are required vs optional
  requiredRoles: NarrativeRole[]
  optionalRoles: NarrativeRole[]
}

// Extended Slide interface
export interface Slide {
  // ... existing fields
  narrative_role?: NarrativeRole  // NEW: This slide's narrative role
}

// Extended OutlineSection interface
export interface OutlineSection {
  // ... existing fields
  narrativeStructure?: NarrativeStructure  // NEW: Section's narrative definition
}
```

### Content-Role Compatibility Matrix

```
Role Compatibility Rules:

COMPATIBLE MOVES (minimal warning):
- introduction → context (natural progression)
- evidence → analysis (supporting relationship)
- analysis → implications (logical flow)
- implications → projections (forward-looking)
- any → conclusion (can summarize anything)

INCOMPATIBLE MOVES (strong warning):
- evidence → projections (evidence is historical, projections are future)
- projections → evidence (future claims can't become evidence)
- conclusion → introduction (reverses narrative arc)
- analysis → evidence (interpretation != data)

NEUTRAL MOVES (context-dependent):
- context → evidence (depends on content specificity)
- evidence → context (generalizing specific data)
```

### Example Agent Warnings

**Content-Role Mismatch:**
```
⚠️ **Narrative Structure Alert**

You're moving content from "Market Size Evidence" (evidence role) to "Growth Projections" (projections role).

**Issue:** Evidence content (historical data, facts) is being placed in a projections context (forward-looking statements).

**Suggestions:**
1. Keep the data in the evidence slide and reference it from projections
2. Move to "Market Analysis" slide instead (analysis role - can interpret evidence)
3. Create a new slide with appropriate role for this content
```

**Reorganization Suggestion:**
```
📋 **Section Narrative Review**

The "Financial Performance" section has a suboptimal narrative flow:

Current: [projections] → [evidence] → [analysis] → [conclusion]
Recommended: [context] → [evidence] → [analysis] → [projections] → [conclusion]

**Issue:** Projections before evidence disrupts the "show me the data first" flow.

**Quick Fix:** Move "Revenue Projections" slide to position 4 (after Analysis).
```

### Key Components to Modify/Create

| Component | Path | Changes |
|-----------|------|---------|
| CIM Types | `lib/types/cim.ts` | Add NarrativeRole, NarrativeStructure, extend Slide and OutlineSection |
| CIM Schemas | `lib/agent/cim/schemas.ts` | Add Zod schemas for narrative types |
| Narrative Utils | `lib/agent/cim/utils/narrative-structure.ts` | NEW - Compatibility matrix, detection logic |
| CIM Tools | `lib/agent/cim/tools/cim-tools.ts` | Add detectNarrativeMismatchTool, suggestNarrativeReorganizationTool |
| CIM Tools (existing) | `lib/agent/cim/tools/cim-tools.ts` | Extend validateCoherenceTool |
| CIM Prompts | `lib/agent/cim/prompts.ts` | Add narrative role guidance prompts |
| SlidePreview | `components/cim-builder/PreviewPanel/SlidePreview.tsx` | Add narrative role badge |
| StructureTree | `components/cim-builder/SourcesPanel/StructureTree.tsx` | Add narrative role context display |

### Learnings from Previous Story

**From Story e9-11-dependency-tracking-and-consistency-alerts (Status: done)**

- **Dependency Graph Infrastructure**: `lib/agent/cim/utils/dependency-graph.ts` provides the foundation - narrative utils should follow similar patterns
- **Tool Patterns**: `trackDependenciesTool`, `getDependentSlidesTool`, `validateCoherenceTool` demonstrate consistent tool structure with:
  - Input validation
  - CIM retrieval
  - Operation execution
  - Formatted success/error responses
  - Proactive suggestions for agent
- **StructureTree Enhancement**: Already supports flagging with amber highlighting (`flaggedSections`, `FlaggedSection` interface) - extend for narrative role display
- **Test Coverage Pattern**: 52 unit tests for utilities + integration tests for tools - target similar comprehensive coverage
- **New Service Created**: `lib/agent/cim/utils/dependency-graph.ts` - Use as template for `narrative-structure.ts`
- **Files Modified**:
  - `lib/agent/cim/tools/cim-tools.ts` - Add new tools following existing patterns
  - `lib/agent/cim/tools/index.ts` - Export new tools
  - `lib/agent/cim/prompts.ts` - Add narrative-related prompts
  - `components/cim-builder/SourcesPanel/StructureTree.tsx` - Extend flagging UI

[Source: stories/e9-11-dependency-tracking-and-consistency-alerts.md#Dev-Agent-Record]

### Project Structure Notes

- New narrative utilities: `lib/agent/cim/utils/narrative-structure.ts`
- Tests mirror structure: `__tests__/lib/agent/cim/utils/narrative-structure.test.ts`
- Component enhancements: `components/cim-builder/PreviewPanel/SlidePreview.tsx`, `components/cim-builder/SourcesPanel/StructureTree.tsx`

### Testing Strategy

**Unit Tests (Vitest):**
- Narrative role type validation
- Compatibility matrix logic (all role combinations)
- Mismatch detection algorithms
- Reorganization suggestion generation
- Schema validation for new types

**Integration Tests:**
- Narrative structure stored on section creation
- Mismatch detection during slide content moves
- validateCoherenceTool includes narrative checks
- Reorganization suggestions generated correctly

**Component Tests:**
- SlidePreview renders narrative role badge
- StructureTree shows narrative role context
- Role indicators styled correctly

**E2E Tests:**
- Full flow: Create section → Add slides with roles → Move content → See warning → Accept reorganization

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E9.md#E9.12-Narrative-Structure-Dependencies] - Acceptance criteria AC-9.12.1 through AC-9.12.6
- [Source: docs/epics.md#E9.12] - Story definition (5 points)
- [Source: lib/types/cim.ts] - CIM types to extend
- [Source: lib/agent/cim/tools/cim-tools.ts] - Existing tool patterns from E9.11 (validateCoherenceTool)
- [Source: lib/agent/cim/utils/dependency-graph.ts] - Utility patterns to follow
- [Source: components/cim-builder/SourcesPanel/StructureTree.tsx] - Structure panel for UI extension
- [Source: components/cim-builder/PreviewPanel/SlidePreview.tsx] - Preview panel for role badge
- [Source: stories/e9-11-dependency-tracking-and-consistency-alerts.md] - Previous story patterns and learnings

## Dev Agent Record

### Context Reference

- [e9-12-narrative-structure-dependencies.context.xml](e9-12-narrative-structure-dependencies.context.xml) - Generated 2025-12-11

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

- **AC #1 (Narrative Structure Storage)**: Implemented `NarrativeStructure` interface with `expectedRoleSequence`, `requiredRoles`, and `optionalRoles` fields. Added to `OutlineSection` interface as optional `narrativeStructure` field.
- **AC #2 (Slide Narrative Role Definition)**: Added `narrative_role` field to `Slide` interface with 7 role types. Auto-assigned during slide creation via `generateSlideContentTool`. UI displays role badge in SlidePreview with unique colors and icons.
- **AC #3 (Content-Role Mismatch Detection)**: Created comprehensive `ROLE_COMPATIBILITY_MATRIX` with high/medium/low/incompatible levels. `checkContentRoleCompatibility()` analyzes content against assigned role.
- **AC #4 (Content-Role Warning Message)**: `checkNarrativeCompatibilityTool` returns detailed mismatch info with `mismatchDetails` and `suggestedRole`. `updateSlideTool` now includes compatibility check when role changes.
- **AC #5 (Reorganization Suggestions)**: `getSectionReorganizationTool` analyzes section narrative flow and provides actionable suggestions with proactive messages for agent presentation.
- **AC #6 (Coherence Tool Extension)**: Created `validateNarrativeStructureTool` that checks missing roles, duplicate roles, role sequence violations, and content-role mismatches. Returns completeness percentage and formatted validation messages.

### File List

**New Files:**
- `lib/agent/cim/utils/narrative-structure.ts` - Narrative structure utilities (490 lines)
- `__tests__/lib/agent/cim/utils/narrative-structure.test.ts` - 37 unit tests

**Modified Files:**
- `lib/types/cim.ts` - Added NARRATIVE_ROLES, NarrativeRole, NarrativeStructure, NarrativeRoleSchema, NarrativeStructureSchema; Extended Slide and OutlineSection interfaces
- `lib/agent/cim/tools/cim-tools.ts` - Added checkNarrativeCompatibilityTool, getSectionReorganizationTool, validateNarrativeStructureTool; Updated generateSlideContentTool and updateSlideTool with narrative role support
- `components/cim-builder/PreviewPanel/SlidePreview.tsx` - Added NarrativeRoleBadge component with role-specific colors and icons

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-11 | Story redrafted with full template, learnings from E9.11, and detailed tasks | SM Agent (Claude Opus 4.5) |
| 2025-12-11 | Story created as follow-up to E9.11 for narrative structure dependencies | Dev Agent (Claude Opus 4.5) |
