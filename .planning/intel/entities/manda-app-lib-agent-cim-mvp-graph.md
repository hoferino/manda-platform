---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/agent/cim-mvp/graph.ts
type: service
updated: 2026-01-20
status: active
---

# graph.ts

## Purpose

Defines the LangGraph StateGraph for the CIM MVP workflow with agent, tools, and post-tool processing nodes. Implements workflow progression, HITL validation, prompt caching for cost optimization, and conversation persistence via PostgresSaver checkpointer. Handles tool results that affect state including workflow advancement, context saving, outline management, and slide creation.

## Exports

- `cimMVPGraph` - Pre-compiled graph without checkpointer
- `getCIMMVPGraph(): Promise<CompiledGraph>` - Get graph with PostgresSaver checkpointer (singleton)
- `createCIMMVPGraph(checkpointer?): CompiledGraph` - Create graph with custom or no checkpointer

## Dependencies

- @langchain/langgraph - StateGraph, START, END, ToolNode
- @langchain/anthropic - ChatAnthropic with Claude Haiku 4.5
- @langchain/core/messages - AIMessage
- [[manda-app-lib-agent-cim-mvp-state]] - CIMMVPState, CIMMVPStateType
- [[manda-app-lib-agent-cim-mvp-tools]] - cimMVPTools
- [[manda-app-lib-agent-cim-mvp-prompts]] - getSystemPromptForCaching
- [[manda-app-lib-agent-cim-mvp-knowledge-loader]] - loadKnowledge
- [[manda-app-lib-agent-checkpointer]] - getCheckpointer, Checkpointer

## Used By

TBD

## Notes

Uses Anthropic prompt caching with 1-hour TTL (extended-cache-ttl-2025-04-11 beta) for 60-80% cost reduction. postToolNode performs belt-and-suspenders HITL validation by checking state before applying tool results. Graph flow: agent -> tools -> post_tool -> agent (loop until no tool calls).
