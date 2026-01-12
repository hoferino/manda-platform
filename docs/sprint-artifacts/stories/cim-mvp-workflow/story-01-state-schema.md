# Story 1: State Schema Updates

**File:** `manda-app/lib/agent/cim-mvp/state.ts`
**Completion Promise:** `STATE_SCHEMA_COMPLETE`
**Max Iterations:** 15

---

## Overview

Update the CIM MVP state schema to support the new workflow-based approach. Add types for workflow progress tracking, buyer persona, hero context, outline, and enhanced slide components.

## Tasks

- [ ] 1.1 Add `WorkflowStage` type with stages: welcome, buyer_persona, hero_concept, investment_thesis, outline, building_sections, complete
- [ ] 1.2 Add `WorkflowProgress` interface with currentStage, completedStages, currentSectionId, currentSlideId, sectionProgress
- [ ] 1.3 Add `SectionProgress` interface with sectionId, status (pending/content_development/building_slides/complete), slides array
- [ ] 1.4 Add `SlideProgress` interface with slideId, contentApproved, visualApproved
- [ ] 1.5 Add `BuyerPersona` interface (type: string, motivations: string[], concerns: string[])
- [ ] 1.6 Add `HeroContext` interface (selectedHero: string, investmentThesis: { asset: string, timing: string, opportunity: string })
- [ ] 1.7 Add `CIMSection` interface (id: string, title: string, description: string)
- [ ] 1.8 Add `CIMOutline` interface (sections: CIMSection[])
- [ ] 1.9 Add `LayoutType` union type with 16 layout types (see spec)
- [ ] 1.10 Add `ComponentType` union type with 50+ component types (see spec)
- [ ] 1.11 Update `SlideComponent` interface with position, style, icon, label fields
- [ ] 1.12 Update `SlideUpdate` to include layoutType field
- [ ] 1.13 Add `workflowProgress` to CIMMVPState annotation with default value
- [ ] 1.14 Add `buyerPersona` to CIMMVPState annotation with default value
- [ ] 1.15 Add `heroContext` to CIMMVPState annotation with default value
- [ ] 1.16 Add `cimOutline` to CIMMVPState annotation with default value
- [ ] 1.17 Run `npm run type-check` - must pass with no errors

## Type Definitions

### WorkflowStage
```typescript
export type WorkflowStage =
  | 'welcome'
  | 'buyer_persona'
  | 'hero_concept'
  | 'investment_thesis'
  | 'outline'
  | 'building_sections'
  | 'complete'
```

### LayoutType (16 types)
```typescript
export type LayoutType =
  | 'full'
  | 'title-only'
  | 'title-content'
  | 'split-horizontal'
  | 'split-horizontal-weighted'
  | 'split-vertical'
  | 'quadrant'
  | 'thirds-horizontal'
  | 'thirds-vertical'
  | 'six-grid'
  | 'sidebar-left'
  | 'sidebar-right'
  | 'hero-with-details'
  | 'comparison'
  | 'pyramid'
  | 'hub-spoke'
```

### ComponentType (50+ types)
See `docs/sprint-artifacts/tech-specs/cim-mvp-workflow-fix.md` for full list.

## Acceptance Criteria

1. All new types are exported from state.ts
2. CIMMVPState includes all new annotations
3. Default values provided for all new state fields
4. `npm run type-check` passes with no errors

## Ralph Command

```bash
/ralph-loop "Implement Story 1 from docs/sprint-artifacts/stories/cim-mvp-workflow/story-01-state-schema.md.

Read the story file and the tech spec at docs/sprint-artifacts/tech-specs/cim-mvp-workflow-fix.md for full type definitions.

Implement all tasks 1.1-1.17 in manda-app/lib/agent/cim-mvp/state.ts.

After each significant change, run 'cd manda-app && npm run type-check'.

If type-check fails, fix the errors before proceeding.

Output <promise>STATE_SCHEMA_COMPLETE</promise> when all tasks are done and type-check passes." --max-iterations 15 --completion-promise "STATE_SCHEMA_COMPLETE"
```
