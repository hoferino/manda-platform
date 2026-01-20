---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/types/cim.ts
type: model
updated: 2026-01-20
status: active
---

# cim.ts

## Purpose

Defines the complete type system for the CIM (Confidential Information Memorandum) Builder workflow. Provides interfaces, enums, Zod validation schemas, and helper functions for all CIM entities including workflow phases, buyer personas, outline sections, slides, visual concepts, dependency graphs, and navigation state. This is the authoritative source for CIM types across the codebase.

## Exports

- Phase constants and types: `CIM_PHASES`, `CIMPhase`, `CIMPhaseSchema`
- Buyer types: `BUYER_TYPES`, `BuyerType`, `BuyerTypeSchema`, `BuyerPersona`, `BuyerPersonaSchema`
- Component types: `COMPONENT_TYPES`, `ComponentType`, `ComponentTypeSchema`
- Layout types: `LAYOUT_TYPES`, `LayoutType`, `LayoutTypeSchema`
- Chart types: `CHART_TYPES`, `ChartType`, `ChartTypeSchema`
- Source types: `SOURCE_TYPES`, `SourceType`, `SourceTypeSchema`, `SourceReference`, `SourceReferenceSchema`
- Narrative types: `NARRATIVE_ROLES`, `NarrativeRole`, `NarrativeRoleSchema`, `NarrativeStructure`, `NarrativeStructureSchema`
- Status types: `SLIDE_STATUSES`, `SlideStatus`, `SlideStatusSchema`, `SECTION_STATUSES`, `SectionStatus`, `SectionStatusSchema`
- Navigation types: `NAVIGATION_TYPES`, `NavigationType`, `NavigationTypeSchema`, `NavigationWarning`, `NavigationWarningSchema`, `NavigationEvent`, `NavigationEventSchema`, `NavigationState`, `NavigationStateSchema`, `NavigationResult`, `NavigationResultSchema`, `NavigationOptions`, `NavigationOptionsSchema`
- Core interfaces: `WorkflowState`, `WorkflowStateSchema`, `OutlineSection`, `OutlineSectionSchema`, `ChartRecommendation`, `ChartRecommendationSchema`, `VisualConcept`, `VisualConceptSchema`, `SlideComponent`, `SlideComponentSchema`, `Slide`, `SlideSchema`, `DependencyGraph`, `DependencyGraphSchema`, `ConversationMessage`, `ConversationMessageSchema`, `CIM`
- Input types: `CreateCIMInput`, `CreateCIMInputSchema`, `UpdateCIMInput`, `UpdateCIMInputSchema`, `CIMListItem`
- Helper functions: `getNextPhase`, `getPreviousPhase`, `isPhaseCompleted`, `isCIMComplete`, `calculateCIMProgress`, `getWorkflowStateDescription`, `createDefaultWorkflowState`, `createDefaultDependencyGraph`, `createDefaultNavigationState`, `determineNavigationType`, `canNavigateBack`, `canNavigateForward`
- Database mapping: `CIMDbRow`, `mapDbRowToCIM`, `mapCIMToDbInsert`, `mapCIMToDbUpdate`, `cimToListItem`

## Dependencies

- zod - Schema validation library

## Used By

TBD

## Notes

Contains comprehensive Zod schemas for runtime validation. Helper functions support workflow progression and navigation state management. Database mappers handle snake_case to camelCase conversion.
