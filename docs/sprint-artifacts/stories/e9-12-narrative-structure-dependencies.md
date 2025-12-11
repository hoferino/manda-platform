# Story 9.12: Narrative Structure Dependencies

Status: backlog

## Story

As a **M&A analyst**,
I want **the system to understand the intended narrative structure within sections and alert me when content moves disrupt that structure**,
so that **I can maintain logical flow and information architecture when reorganizing content across slides**.

## Context

This story extends E9.11 (Dependency Tracking) to handle **intra-section narrative flow**, not just cross-slide data references.

**Problem Statement:**
When we create a multi-slide section (e.g., "Strong Growth" with 3 slides), we establish an information architecture:
- Slide 1: Historical context
- Slide 2: Current growth metrics
- Slide 3: Future projections

If the user moves content from slide 2 to slide 3, the current dependency tracking doesn't detect this because:
1. No explicit cross-slide "reference" was created
2. The content moved within the same section
3. The narrative arc (past → present → future) is violated but not flagged

**Solution:**
Store the intended **narrative structure** per section and validate content placement against that structure.

## Acceptance Criteria

1. **AC #1: Section Narrative Structure Storage** - When agent creates multi-slide sections, store the intended information architecture (e.g., roles for each slide: "context", "evidence", "implications")

2. **AC #2: Slide Role Definition** - Each slide within a section has a defined narrative role (e.g., "introduction", "supporting_data", "analysis", "conclusion", "transition")

3. **AC #3: Content-Role Mismatch Detection** - When content moves between slides, agent analyzes if content type matches destination slide's role

4. **AC #4: Structural Coherence Alert** - Agent alerts user: "You moved growth metrics from slide 2 (evidence) to slide 3 (projections). This may disrupt the narrative flow."

5. **AC #5: Reorganization Suggestions** - Agent suggests how to reorganize the section: "Consider moving the projections content to maintain the evidence → analysis → projections flow"

6. **AC #6: Section-Level Validation** - validateCoherenceTool extended to check narrative structure integrity within sections

## Tasks / Subtasks

- [ ] Task 1: Define Narrative Structure Schema (AC: #1, #2)
  - [ ] 1.1: Add `SectionNarrativeStructure` type to `lib/types/cim.ts` with slide roles
  - [ ] 1.2: Define standard narrative role types: `introduction`, `context`, `evidence`, `analysis`, `implications`, `conclusion`, `transition`
  - [ ] 1.3: Add `narrativeStructure` field to OutlineSection type
  - [ ] 1.4: Create migration if needed for storage

- [ ] Task 2: Implement Narrative Structure Creation (AC: #1, #2)
  - [ ] 2.1: Update `setOutlineTool` to accept narrative structure definitions
  - [ ] 2.2: Add prompts for agent to define slide roles when creating multi-slide sections
  - [ ] 2.3: Auto-suggest common narrative patterns (chronological, problem-solution, comparative)

- [ ] Task 3: Implement Content-Role Analysis (AC: #3)
  - [ ] 3.1: Create `analyzeContentRoleTool` that classifies content by type (data, narrative, projection, etc.)
  - [ ] 3.2: Content classification heuristics: numbers/charts = evidence, future tense = projection, etc.
  - [ ] 3.3: Match content type against slide's defined role

- [ ] Task 4: Implement Structure Violation Detection (AC: #3, #4)
  - [ ] 4.1: Hook into `updateSlideTool` to detect when content moves between slides
  - [ ] 4.2: Compare content type with destination slide's narrative role
  - [ ] 4.3: Generate alert if mismatch detected: "Content appears to be [evidence] but destination slide role is [projections]"

- [ ] Task 5: Implement Reorganization Suggestions (AC: #5)
  - [ ] 5.1: When structure violation detected, analyze optimal content placement
  - [ ] 5.2: Suggest content swaps or moves to maintain narrative flow
  - [ ] 5.3: Offer to auto-reorganize with user approval

- [ ] Task 6: Extend Coherence Validation (AC: #6)
  - [ ] 6.1: Add `validateNarrativeStructure` check to `validateCoherenceTool`
  - [ ] 6.2: Check each section for slides out of narrative order
  - [ ] 6.3: Check for role mismatches within sections
  - [ ] 6.4: Include structure violations in coherence report

- [ ] Task 7: Write Tests
  - [ ] 7.1: Unit tests for narrative role classification
  - [ ] 7.2: Unit tests for content-role matching
  - [ ] 7.3: Integration tests for structure violation detection
  - [ ] 7.4: Integration tests for reorganization suggestions

## Dev Notes

### Narrative Role Types

```typescript
// lib/types/cim.ts
export const NARRATIVE_ROLES = [
  'introduction',     // Sets context, introduces topic
  'context',          // Historical background, market context
  'evidence',         // Data, metrics, charts supporting claims
  'analysis',         // Interpretation of evidence
  'implications',     // What the evidence/analysis means
  'projections',      // Future-looking statements
  'conclusion',       // Summary, key takeaways
  'transition',       // Bridge between major themes
] as const

export type NarrativeRole = typeof NARRATIVE_ROLES[number]

export interface SectionNarrativeStructure {
  sectionId: string
  pattern: 'chronological' | 'problem_solution' | 'comparative' | 'custom'
  slideRoles: Array<{
    slideId: string
    role: NarrativeRole
    expectedContentTypes: string[]  // e.g., ['metrics', 'charts'] for evidence
  }>
}
```

### Example Scenario

```
Section: "Financial Performance" (3 slides)

Narrative Structure:
  s5: role=context, expects=[historical_overview, time_context]
  s6: role=evidence, expects=[revenue_data, growth_metrics, charts]
  s7: role=projections, expects=[forecasts, future_targets]

User Action: Drags revenue chart from s6 to s7

Detection:
  - Content type: revenue_chart → classified as "evidence"
  - Destination role: s7.role = "projections"
  - Mismatch: evidence ≠ projections

Alert:
  "⚠️ The revenue chart is evidence-type content, but slide 7 is designated
  for projections. This may create a narrative gap in slide 6 (evidence)
  and make slide 7 (projections) less focused.

  Suggestion: Keep the revenue chart in slide 6, or restructure the section
  to [evidence → combined_analysis → projections]."
```

### Content Type Classification Heuristics

| Content Pattern | Classification |
|-----------------|----------------|
| Historical dates, "in 2023", "over the past" | context |
| Revenue, %, growth rate, CAGR, charts | evidence |
| "Analysis shows", "This indicates" | analysis |
| "Going forward", "projected", "forecast" | projections |
| "In summary", "key takeaways" | conclusion |

### Integration with E9.11

This story extends, not replaces, E9.11:
- E9.11: Cross-slide data dependencies (slide A references data from slide B)
- E9.15: Intra-section narrative structure (slide order and content-role alignment)

Both are needed for complete coherence checking.

### Key Components to Modify

| Component | Path | Changes |
|-----------|------|---------|
| CIM Types | `lib/types/cim.ts` | Add NarrativeRole, SectionNarrativeStructure |
| Outline Types | `lib/types/cim.ts` | Extend OutlineSection with narrativeStructure |
| CIM Tools | `lib/agent/cim/tools/cim-tools.ts` | Add analyzeContentRoleTool, extend validateCoherenceTool |
| CIM Prompts | `lib/agent/cim/prompts.ts` | Add narrative structure creation prompts |
| Dependency Graph | `lib/agent/cim/utils/dependency-graph.ts` | May need structure validation utilities |

## References

- [Source: stories/e9-11-dependency-tracking-and-consistency-alerts.md] - Parent story for dependency tracking
- [Source: docs/sprint-artifacts/tech-spec-epic-E9.md] - Epic technical specification
- [Source: lib/types/cim.ts] - CIM type definitions
- [Source: lib/agent/cim/tools/cim-tools.ts] - Tool patterns

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-11 | Story created as follow-up to E9.11 for narrative structure dependencies | Dev Agent (Claude Opus 4.5) |
