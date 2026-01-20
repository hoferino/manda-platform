---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/agent/v2/state.ts
type: model
updated: 2026-01-20
status: active
---

# state.ts

## Purpose

Defines the unified agent state schema for the v2 agent system using LangGraph Annotation.Root(). Implements the 4-pillar context engineering approach (Write/scratchpad, Select/dealContext, Compress/historySummary, Isolate/workflowMode). Provides a single state schema that flows through all graph nodes supporting chat, CIM, and IRL workflows.

## Exports

- `AgentState` - LangGraph Annotation.Root state definition with 12 fields and reducers
- `AgentStateType` - TypeScript type extracted from AgentState
- `createInitialState(workflowMode?, dealId?, userId): AgentStateType` - Factory for chat workflow initial state
- `createInitialCIMState(cimId, dealId, userId): AgentStateType` - Factory for CIM workflow initial state

## Dependencies

- @langchain/langgraph - Annotation, messagesStateReducer
- @langchain/core/messages - BaseMessage type
- [[manda-app-lib-agent-v2-types]] - SourceCitation, ApprovalRequest, AgentError, DealContext, CIMWorkflowState, WorkflowMode

## Used By

TBD

## Notes

State fields use different reducer patterns: Replace (scalars), Append (messagesStateReducer for messages), Accumulate (concat for sources/errors). DealContext is populated by contextLoader middleware after initial state creation. SystemPrompt is set by workflow-router middleware.
