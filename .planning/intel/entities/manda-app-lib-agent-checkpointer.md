---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/agent/checkpointer.ts
type: service
updated: 2026-01-20
status: active
---

# checkpointer.ts

## Purpose

Provides durable workflow state persistence for LangGraph using PostgresSaver with MemorySaver fallback. Implements lazy initialization, graceful degradation when PostgreSQL fails, and shared singleton instance pattern. Includes thread ID helpers for CIM and Supervisor workflows with deal ID parsing for RLS policies.

## Exports

- `getCheckpointer(): Promise<Checkpointer>` - Get or create checkpointer singleton
- `resetCheckpointer(): void` - Reset singleton for testing
- `isUsingPostgres(): boolean` - Check if using PostgresSaver (not fallback)
- `isCheckpointerInitialized(): boolean` - Check if checkpointer is ready
- `getCheckpointMetadata(): Record<string, unknown>` - Get metadata for LangSmith traces
- `logCheckpointOperation(operation, threadId?, metadata?)` - Structured logging
- `createCIMThreadId(dealId, cimId): string` - Generate CIM thread ID
- `createSupervisorThreadId(dealId, timestamp?): string` - Generate Supervisor thread ID
- `parseDealIdFromThreadId(threadId): string | null` - Extract deal UUID from thread ID
- `Checkpointer` - Type union: PostgresSaver | MemorySaver

## Dependencies

- @langchain/langgraph-checkpoint-postgres - PostgresSaver
- @langchain/langgraph - MemorySaver

## Used By

TBD

## Notes

Uses Transaction mode (port 6543) for connection pooling in serverless. Thread ID formats: CIM is cim-{dealId}-{cimId}, Supervisor is supervisor-{dealId}-{timestamp}. PostgresSaver creates langgraph_checkpoints and langgraph_checkpoint_writes tables via setup().
