---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/agent/cim-mvp/tools.ts
type: service
updated: 2026-01-20
status: active
---

# tools.ts

## Purpose

Defines all LangChain tools for the CIM MVP workflow agent. Provides 12 tools organized into research (web search, knowledge search, section context), workflow progression (advance, navigate, save persona/hero, create/update outline, start section), and output (update slide, save context) categories. Supports both JSON knowledge (dev) and Graphiti (production) via global KnowledgeService.

## Exports

- Research tools: `webSearchTool`, `knowledgeSearchTool`, `getSectionContextTool`
- Workflow tools: `advanceWorkflowTool`, `navigateToStageTool`, `saveBuyerPersonaTool`, `saveHeroConceptTool`, `createOutlineTool`, `updateOutlineTool`, `startSectionTool`
- Output tools: `updateSlideTool`, `saveContextTool`
- `cimMVPTools` - Array of all 12 tools
- `setGlobalKnowledgeService(service)` - Set knowledge service for tools
- `getGlobalKnowledgeService()` - Get current knowledge service

## Dependencies

- @langchain/core/tools - tool function
- zod - Schema validation
- nanoid - ID generation
- [[manda-app-lib-agent-cim-mvp-state]] - State types
- [[manda-app-lib-agent-cim-mvp-knowledge-loader]] - JSON knowledge functions
- [[manda-app-lib-agent-cim-mvp-knowledge-service]] - IKnowledgeService interface

## Used By

TBD

## Notes

Uses global singleton pattern for KnowledgeService because LangChain tools don't have access to LangGraph configurable state during execution. Web search uses Tavily API (requires TAVILY_API_KEY). Tools return JSON results that postToolNode processes to update state.
