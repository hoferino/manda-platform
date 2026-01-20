---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/agent/v2/graph.ts
type: service
updated: 2026-01-20
status: active
---

# graph.ts

## Purpose

Defines the single StateGraph for the v2 agent system with conditional entry points based on workflow mode. Implements the retrieval-first architecture where all requests pass through retrieval node before routing to supervisor (chat/IRL) or CIM phase router based on workflowMode. Provides graph compilation with PostgresSaver checkpointer for conversation persistence.

## Exports

- `graphBuilder` - StateGraph builder for extension and testing
- `agentGraph` - Pre-compiled graph without checkpointer
- `routeFromStart` - Router function from START to retrieval
- `routeByWorkflowMode` - Router function from retrieval to supervisor or CIM
- `createCompiledAgentGraph(): Promise<CompiledAgentGraph>` - Get graph with PostgresSaver checkpointer (singleton)
- `resetCompiledGraph(): void` - Reset singleton for testing

## Dependencies

- @langchain/langgraph - StateGraph, START, END
- [[manda-app-lib-agent-v2-state]] - AgentState, AgentStateType
- [[manda-app-lib-agent-v2-nodes]] - supervisorNode, cimPhaseRouterNode, retrievalNode
- [[manda-app-lib-agent-checkpointer]] - getCheckpointer

## Used By

TBD

## Notes

Graph flow: START -> retrieval -> (supervisor | cim/phaseRouter) -> END. CIM phase router is a placeholder for Story 6.1 integration. Uses singleton caching for compiled graph with checkpointer to avoid reconnection overhead.
