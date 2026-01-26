# PRD: CIM MVP Workflow Fix

**Created:** 2026-01-12
**Status:** Ready for Implementation
**Branch:** `cim-mvp-workflow-fix`

---

## Overview

Refactor the CIM MVP agent to implement a structured, checklist-based workflow that guides users through CIM creation collaboratively. The current implementation has phase-based instructions but no clear progression, causing users to get lost and context to be forgotten.

## Problem Statement

The current CIM MVP implementation lacks a structured workflow:
- `CIMPhase` type (11 phases) is CIM section-focused, not workflow-focused
- No concept of: buyer persona → hero concept → investment thesis → outline → sections → content → visual
- Slides are created too early (without structured content-first approach)
- No state tracking for "where are we in the workflow"
- User can get lost mid-conversation with no way to resume

## Goals

1. **Replace phase-based navigation with workflow-stage tracking**
   - 7 workflow stages: welcome → buyer_persona → hero_concept → investment_thesis → outline → building_sections → complete
   - Checklist metaphor: agent always knows where we are, can resume

2. **Add structured state for buyer persona, hero concept, investment thesis, and outline**
   - BuyerPersona: type, motivations, concerns
   - HeroContext: selected hero, investment thesis (asset/timing/opportunity)
   - CIMOutline: user-defined sections (not predetermined)

3. **Implement comprehensive slide layout/component system**
   - 16 layout types (full, split, quadrant, sidebar, hero-with-details, etc.)
   - 50+ component types (charts, tables, metrics, timelines, callouts, etc.)
   - LLM generates structured JSON, UI renders wireframes

4. **Update UI to show outline tree and wireframe preview**
   - Left panel: CIM Structure with collapsible outline tree
   - Right panel: Slide thumbnails (horizontal scroll) + wireframe detail view

## Success Criteria

- [ ] All TypeScript compiles without errors (`npm run type-check`)
- [ ] All existing tests pass (`npm run test:run`)
- [ ] Build completes successfully (`npm run build`)
- [ ] Agent can progress through full workflow (manual test)
- [ ] UI renders outline tree correctly
- [ ] UI renders slide wireframes correctly
- [ ] State persists across page refresh (can resume workflow)

## Non-Goals

- Production-ready visual polish (wireframes are functional, not beautiful)
- Comprehensive E2E test coverage
- Performance optimization
- PowerPoint export updates (existing export works with new slide format)

## User Stories

| Story | Description | File(s) |
|-------|-------------|---------|
| 1 | State Schema Updates | `state.ts` |
| 2 | New Tools Implementation | `tools.ts` |
| 3 | Prompt Restructuring | `prompts.ts` |
| 4 | Graph Flow Updates | `graph.ts` |
| 5 | API Route Updates | `route.ts` |
| 6 | UI Hook Updates | `useCIMMVPChat.ts` |
| 7 | CIM Structure Panel | `SourcesPanel.tsx` |
| 8 | Preview Panel Thumbnails | `PreviewPanel.tsx` |
| 9 | Wireframe Rendering | `PreviewPanel/` |
| 10 | Integration & Wiring | `CIMBuilderPage.tsx` |

## Technical Approach

### Workflow Stages

```typescript
type WorkflowStage =
  | 'welcome'           // Knowledge pre-loaded, agent greets
  | 'buyer_persona'     // Who are we selling to?
  | 'hero_concept'      // What's the story hook?
  | 'investment_thesis' // 3-part foundation
  | 'outline'           // User-defined CIM structure
  | 'building_sections' // For each section: content → slides → visuals
  | 'complete'          // All done
```

### Key Principles

1. **User can detour anytime** - Ask questions, explore tangents
2. **Agent saves all useful context continuously** - Nothing is lost
3. **Agent always knows where we are in the checklist** - Can resume exactly where left off
4. **Content first, then visuals** - Build slide content before designing layout

## Dependencies

- LangGraph StateGraph with PostgresSaver checkpointer
- Gemini 2.5 Flash for LLM
- Existing CIM Builder UI components
- SSE streaming for real-time updates

## Reference Documents

- Technical Specification: `docs/sprint-artifacts/tech-specs/cim-mvp-workflow-fix.md`
- CIM Workflow Guide: `cim-workflow/cim-workflow.md`
