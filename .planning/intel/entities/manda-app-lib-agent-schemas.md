---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/agent/schemas.ts
type: model
updated: 2026-01-20
status: active
---

# schemas.ts

## Purpose

Defines comprehensive Zod schemas for all agent tool inputs and outputs. Provides type-safe validation for the 17+ chat tools including knowledge operations, corrections, intelligence analysis, document handling, workflow actions, Q&A management, and IRL generation. Error messages are optimized for LLM understanding.

## Exports

- Common schemas: `SourceCitationSchema`, `SourceCitation`, `FindingDomainSchema`, `FindingDomain`, `FindingStatusSchema`, `FindingStatus`, `RelationshipTypeSchema`, `RelationshipType`
- Knowledge tool inputs: `IndexToKnowledgeBaseInputSchema`, `QueryKnowledgeBaseInputSchema`, `UpdateKnowledgeBaseInputSchema`, `ValidateFindingInputSchema`, `UpdateKnowledgeGraphInputSchema`
- Intelligence tool inputs: `DetectContradictionsInputSchema`, `FindGapsInputSchema`
- Document tool inputs: `GetDocumentInfoInputSchema`, `TriggerAnalysisInputSchema`
- Workflow tool inputs: `SuggestQuestionsInputSchema`, `AddToQAInputSchema`, `CreateIRLInputSchema`
- Q&A tool inputs: `AddQAItemInputSchema`, `AddQAItemInput`
- IRL tool inputs: `GenerateIRLSuggestionsInputSchema`, `AddToIRLInputSchema`, `IRLSuggestionSchema`, `IRLSuggestion`
- Correction tool inputs: `ValidationStatusSchema`, `CorrectionTypeSchema`, `CorrectFindingInputSchema`, `GetFindingSourceInputSchema`, `GetCorrectionHistoryInputSchema`
- Output schemas: `FindingWithSourceSchema`, `QueryKnowledgeBaseOutputSchema`, `ContradictionOutputSchema`, `GapOutputSchema`, `DocumentInfoOutputSchema`, `QASuggestionSchema`
- Aggregate export: `ToolSchemas` - Object containing all schemas

## Dependencies

- zod - Schema validation library
- [[manda-app-lib-types-qa]] - QACategorySchema, QAPrioritySchema

## Used By

TBD

## Notes

All input schemas include detailed descriptions for LLM tool calling. Temporal metadata (dateReferenced) enables time-aware validation and contradiction detection. Schema validation provides clear error messages when LLM provides invalid parameters.
