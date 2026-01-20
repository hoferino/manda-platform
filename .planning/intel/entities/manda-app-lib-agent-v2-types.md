---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/agent/v2/types.ts
type: model
updated: 2026-01-20
status: active
---

# types.ts

## Purpose

Defines all type interfaces for the v2 unified agent state schema. Establishes the canonical type definitions for workflow modes, source citations, approval requests (HITL), structured errors, deal context, CIM workflow state, and SSE streaming events. Serves as the single source of truth for agent system types across the codebase.

## Exports

- `WorkflowMode` - Type union: 'chat' | 'cim' | 'irl' for graph entry point routing
- `SourceCitation` - Interface for document attribution with location, snippet, and relevance score
- `ApprovalRequestBase` - Base interface for all HITL approval requests
- `QAModificationApproval` - Interface for Q&A item change approvals
- `PlanApproval` - Interface for multi-step operation approvals
- `KnowledgeBaseUpdateApproval` - Interface for knowledge graph fact additions
- `DestructiveActionApproval` - Interface for irreversible operation approvals
- `ApprovalRequest` - Discriminated union of all approval types
- `AgentErrorCode` - Enum of error codes (LLM_ERROR, TOOL_ERROR, STATE_ERROR, etc.)
- `AgentError` - Interface for structured errors with recoverability info
- `DealContext` - Interface for deal metadata with tenant isolation fields
- `CIMPhase` - Re-exported from lib/types/cim.ts
- `Slide` - Interface for individual CIM slide
- `CIMWorkflowState` - Interface for CIM workflow tracking
- `TokenStreamEvent` - SSE event for partial response streaming
- `SourceAddedEvent` - SSE event when source is referenced
- `ApprovalRequiredEvent` - SSE event for HITL interrupts
- `SpecialistProgressEvent` - SSE event for specialist execution status
- `ErrorStreamEvent` - SSE event for non-fatal errors
- `DoneStreamEvent` - SSE event for completion with final state
- `AgentStreamEvent` - Discriminated union of all SSE event types

## Dependencies

- [[manda-app-lib-types-cim]] - CIMPhase type definition

## Used By

TBD

## Notes

All approval request types use discriminated union pattern with `type` field. Timestamps use ISO 8601 format. Stream events designed for SSE transport to frontend.
