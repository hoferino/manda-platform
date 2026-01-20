---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/agent/cim-mvp/index.ts
type: module
updated: 2026-01-20
status: active
---

# index.ts

## Purpose

Barrel export and streaming helper for the CIM MVP Agent. Provides the simplified CIM workflow agent for MVP testing, using JSON knowledge files from document analysis. Exports all CIM MVP functionality including the graph, state, tools, prompts, knowledge loaders, and streaming/execution helpers.

## Exports

- Graph: `cimMVPGraph`, `createCIMMVPGraph`, `getCIMMVPGraph`
- State types: `CIMMVPState`, `CIMMVPStateType`, `CIMPhase`, `SlideUpdate`, `SlideComponent`, `SourceCitation`, `ComponentType`, `LayoutType`, `WorkflowStage`, `WorkflowProgress`, `SectionProgress`, `SlideProgress`, `BuyerPersona`, `HeroContext`, `CIMSection`, `CIMOutline`, `ComponentPosition`, `ComponentStyle`
- Knowledge types: `KnowledgeFile`, `Finding`, `Executive`, `Location`, `Competitor`, `HistoricalFinancial`, `CIMMVPStreamEvent`
- Tools: `cimMVPTools`
- Prompts: `getSystemPrompt`, `getPhaseDescription`, `getAllPhases`
- Legacy knowledge loader: `loadKnowledge`, `searchKnowledge`, `getKnowledgeForSection`, `getFindingsForSection`, `getCompanyMetadata`, `getDataGaps`, `getDataSummary`, `formatSectionContext`, `clearKnowledgeCache`
- Knowledge Service: `KnowledgeService`, `createKnowledgeService`, `KnowledgeMode`, `KnowledgeServiceConfig`, `KnowledgeSearchOptions`, `KnowledgeSearchResult`, `KnowledgeMetadata`, `KnowledgeReadiness`, `IKnowledgeService`
- Graphiti knowledge: `searchGraphiti`, `getSectionGraphiti`, `getMetadataGraphiti`, `getDataSummaryGraphiti`, `STATIC_SECTION_QUERIES`, `USE_DYNAMIC_QUERIES`, `SectionRetrievalOptions`
- Query generator: `generateDynamicQuery`, `getQueryForSection`, `fetchGraphSchema`, `invalidateQueryCache`, `invalidateSchemaCache`, `getSectionDescription`, `SECTION_DESCRIPTIONS`, `GraphSchema`, `QueryGeneratorInput`, `QueryGenerationResult`
- Streaming: `streamCIMMVP(message, threadId, knowledgePath?): AsyncGenerator<CIMMVPStreamEvent>`
- Execution: `executeCIMMVP(message, threadId, knowledgePath?): Promise<{response, currentPhase, slideUpdates, error}>`

## Dependencies

- @langchain/core/messages - HumanMessage for message construction
- [[manda-app-lib-agent-cim-mvp-graph]] - LangGraph StateGraph
- [[manda-app-lib-agent-cim-mvp-state]] - State schema
- [[manda-app-lib-agent-cim-mvp-types]] - Type definitions
- [[manda-app-lib-agent-cim-mvp-tools]] - CIM tools
- [[manda-app-lib-agent-cim-mvp-prompts]] - System prompts
- [[manda-app-lib-agent-cim-mvp-knowledge-loader]] - JSON knowledge loader
- [[manda-app-lib-agent-cim-mvp-knowledge-service]] - Knowledge service abstraction
- [[manda-app-lib-agent-cim-mvp-graphiti-knowledge]] - Graphiti knowledge retrieval
- [[manda-app-lib-agent-cim-mvp-query-generator]] - Dynamic query generation

## Used By

TBD

## Notes

streamCIMMVP yields events for tokens, workflow_progress, outline_created, outline_updated, section_started, slide_update, phase_change, sources, and done/error. Uses checkpointer for conversation persistence. Tracks yieldedSlideIds to avoid duplicate slide events.
