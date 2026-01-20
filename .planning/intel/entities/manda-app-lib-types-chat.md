---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/types/chat.ts
type: model
updated: 2026-01-20
status: active
---

# chat.ts

## Purpose

Defines the complete type system for the chat interface and conversation management. Provides types for messages with confidence data, conversations, SSE streaming events, source citations, and tool calls. Supports both legacy role naming (human/ai) and new conventions (user/assistant) for backwards compatibility.

## Exports

- Citation types: `SourceCitation`, `ToolCall`
- Message types: `MessageRole`, `MessageConfidence`, `Message`
- Conversation types: `Conversation`, `ConversationWithMessages`
- Request types: `ChatRequest`
- SSE types: `SSEEventType`, `SSETokenEvent`, `SSEToolStartEvent`, `SSEToolEndEvent`, `SSESourcesEvent`, `SSEDoneEvent`, `SSEErrorEvent`, `SSEEvent`
- State types: `ChatState`
- Zod schemas: `ChatRequestSchema`, `ConversationCreateSchema`, `ConversationUpdateSchema`, `MessageQuerySchema`
- Helper functions: `normalizeMessageRole`, `getStorageRole`, `getToolDisplayMessage`, `parseSSEEvent`, `dbMessageToMessage`, `dbConversationToConversation`
- Constants: `TOOL_DISPLAY_MESSAGES`

## Dependencies

- zod - Schema validation library

## Used By

TBD

## Notes

MessageConfidence scores are NEVER shown to users (P2 compliance - internal only). Confidence levels (high/medium/low) are derived for badge display. SourceCitation includes document/chunk IDs for navigation and DocumentPreviewModal integration.
