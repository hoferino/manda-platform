---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/agent/cim-mvp/state.ts
type: model
updated: 2026-01-20
status: active
---

# state.ts

## Purpose

Defines the complete state schema for the CIM MVP agent workflow using LangGraph's Annotation pattern. Provides type-safe state management for the multi-stage CIM (Confidential Information Memorandum) creation process, including workflow progression, buyer personas, investment thesis, slide generation, and accumulated company context from conversations.

## Exports

- `CIMPhase` - Type union of CIM document phases (executive_summary, company_overview, etc.)
- `WorkflowStage` - Type union of workflow stages (welcome, buyer_persona, hero_concept, investment_thesis, outline, building_sections, complete)
- `LayoutType` - Type union of 15 slide layout options (full, split-horizontal, quadrant, etc.)
- `ComponentType` - Type union of 50+ slide component types organized by category (text, charts, tables, process, organizational, etc.)
- `SlideProgress` - Interface tracking individual slide approval status
- `SectionProgress` - Interface tracking section build status and child slides
- `WorkflowProgress` - Interface tracking overall workflow state and section progress
- `BuyerPersona` - Interface for target buyer type, motivations, and concerns
- `HeroContext` - Interface for selected hero concept and investment thesis breakdown
- `CIMSection` - Interface for outline section definition
- `CIMOutline` - Interface containing array of CIM sections
- `ComponentPosition` - Interface for layout region placement
- `ComponentStyle` - Interface for component emphasis, size, and alignment
- `SlideComponent` - Interface for individual slide content components
- `SlideUpdate` - Interface for slide content updates with layout and status
- `SourceCitation` - Interface for document attribution
- `GatheredContext` - Interface for accumulated company information (financials, team, products, market, risks)
- `CIMMVPState` - LangGraph Annotation.Root state definition with reducers
- `CIMMVPStateType` - TypeScript type extracted from CIMMVPState

## Dependencies

- @langchain/langgraph - Annotation pattern for state management
- @langchain/core/messages - BaseMessage type for conversation history

## Used By

TBD

## Notes

Uses deep merge reducer for gatheredContext to accumulate company information across messages without losing prior data. Slide updates use a Map-based reducer to merge by slideId.
