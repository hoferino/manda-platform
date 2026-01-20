---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/agent/cim/tools/cim-tools.ts
type: service
updated: 2026-01-20
status: active
---

# cim-tools.ts

## Purpose

Defines the comprehensive suite of LangChain tools for the CIM Builder agent workflow. Provides tools for buyer persona management, investment thesis crafting, outline creation and editing, slide content generation and updates, visual concept management, navigation between phases, and context retrieval from the knowledge base. These tools enable the AI to collaborate with users through the multi-phase CIM creation process.

## Exports

- `saveBuyerPersonaTool` - Tool to save selected buyer persona to state
- `saveInvestmentThesisTool` - Tool to save investment thesis to state
- `createOutlineTool` - Tool to create initial CIM outline structure
- `editOutlineTool` - Tool to modify existing outline sections
- `generateSlideContentTool` - Tool to generate content for a specific slide
- `updateSlideTool` - Tool to update slide content and status
- `addVisualConceptTool` - Tool to add visual concept to a slide
- `navigateToPhaseTool` - Tool to advance workflow phase
- `getContextTool` - Tool to retrieve relevant context from knowledge base
- `cimTools` - Array of all CIM tools for agent registration

## Dependencies

- @langchain/core/tools - DynamicStructuredTool for tool definitions
- zod - Schema validation for tool inputs
- [[manda-app-lib-types-cim]] - CIM type definitions

## Used By

TBD

## Notes

Tools use DynamicStructuredTool pattern with Zod schemas for type-safe inputs. Each tool returns structured results for agent reasoning. Navigation tool enforces phase progression rules. Visual concepts include layout type, chart recommendations, and narrative structure.
