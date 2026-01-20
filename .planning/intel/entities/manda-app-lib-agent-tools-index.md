---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/agent/tools/index.ts
type: module
updated: 2026-01-20
status: active
---

# index.ts

## Purpose

Barrel export for all 17 LangChain agent tools organized by category. Exports individual tools, tool arrays for specific workflows, utility functions, and the tier-based tool loader for complexity-aware tool selection. Tools handle knowledge operations, corrections, intelligence analysis, document management, workflow automation, Q&A creation, and IRL generation.

## Exports

- Knowledge tools: `queryKnowledgeBaseTool`, `updateKnowledgeBaseTool`, `validateFindingTool`, `updateKnowledgeGraphTool`
- Correction tools: `correctFindingTool`, `getFindingSourceTool`, `getCorrectionHistoryTool`, `correctionTools`
- Intelligence tools: `detectContradictionsTool`, `findGapsTool`
- Document tools: `getDocumentInfoTool`, `triggerAnalysisTool`
- Workflow tools: `suggestQuestionsTool`, `addToQATool`, `createIRLTool`
- Q&A tools: `addQAItemTool`, `qaTools`
- Combined: `allChatTools` - Full tool array for AgentExecutor
- Tool loader: `TOOL_TIERS`, `getToolsForComplexity`, `getToolsForIntent`, `getToolCountForComplexity`, `getNextTier`, `canEscalate`, `isToolNotFoundError`, `handleToolEscalation`, `logToolTierSelection`, `EscalationResult`
- Re-exports: All utilities from ./utils

## Dependencies

- [[manda-app-lib-agent-tools-knowledge-tools]] - Knowledge base tools
- [[manda-app-lib-agent-tools-correction-tools]] - Finding correction tools
- [[manda-app-lib-agent-tools-intelligence-tools]] - Analysis tools
- [[manda-app-lib-agent-tools-document-tools]] - Document management tools
- [[manda-app-lib-agent-tools-workflow-tools]] - Workflow automation tools
- [[manda-app-lib-agent-tools-qa-tools]] - Q&A creation tools
- [[manda-app-lib-agent-tools-all-tools]] - Combined tool array
- [[manda-app-lib-agent-tools-tool-loader]] - Tier-based tool loading
- [[manda-app-lib-agent-tools-utils]] - Tool utilities

## Used By

TBD

## Notes

Tool order in allChatTools affects selection priority. Tier-based loading (E13.2) dynamically selects tools based on query complexity to optimize token usage and response latency.
