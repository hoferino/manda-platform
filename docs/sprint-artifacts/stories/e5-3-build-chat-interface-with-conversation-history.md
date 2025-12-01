# Story E5.3: Build Chat Interface with Conversation History

Status: ready-for-dev

## Story

As an M&A analyst,
I want a chat interface to ask questions about my deal,
so that I can query the knowledge base naturally and maintain conversation context across sessions.

## Acceptance Criteria

1. **AC1: Chat Page Route** - Navigate to `/projects/[id]/chat` and see a chat interface with message display area, input textarea at bottom, and optional conversation sidebar on the left
2. **AC2: Message Submission** - Type a question in the input textarea and press Enter (or click Submit); message appears in chat immediately; loading indicator shows while agent processes
3. **AC3: Streaming Responses** - Agent response streams token-by-token in real-time; streaming uses SSE event types (token, tool_start, tool_end, sources, done) from E5.2 streaming module
4. **AC4: Tool Execution Indicators** - When agent calls a tool, show contextual indicator (e.g., "Searching knowledge base...", "Detecting contradictions..."); indicator updates as tool completes
5. **AC5: Conversation History Sidebar** - Left sidebar displays list of previous conversations with titles and dates; clicking a conversation loads its messages; sidebar is collapsible
6. **AC6: New Conversation** - "New Conversation" button clears the chat and creates a fresh conversation; previous conversation is saved automatically
7. **AC7: Message Persistence** - Messages are stored in database (`conversations` and `messages` tables); reloading the page preserves conversation history
8. **AC8: Auto-Scroll** - Message list auto-scrolls to bottom on new messages; user can scroll up to view history without disruption
9. **AC9: Responsive Design** - Chat interface works on desktop (sidebar visible) and tablet/mobile (sidebar hidden by default, toggleable)

## Tasks / Subtasks

- [ ] Task 1: Create database schema for conversations and messages (AC: 7)
  - [ ] Create migration for `conversations` table (id, project_id, user_id, title, created_at, updated_at)
  - [ ] Create migration for `messages` table (id, conversation_id, role, content, tool_calls, tool_results, sources, tokens_used, created_at)
  - [ ] Add RLS policies (user can only access own conversations)
  - [ ] Create indexes for efficient queries (conversation_id, created_at DESC)
  - [ ] Run migration and regenerate Supabase types

- [ ] Task 2: Create API routes for chat operations (AC: 2, 7)
  - [ ] Create `app/api/projects/[id]/chat/route.ts` - POST for sending messages with SSE streaming response
  - [ ] Create `app/api/projects/[id]/chat/conversations/route.ts` - GET list, POST create new conversation
  - [ ] Create `app/api/projects/[id]/chat/conversations/[convId]/route.ts` - GET single conversation with messages, DELETE
  - [ ] Implement SSE streaming using ReadableStream with event types from `lib/agent/streaming.ts`
  - [ ] Integrate with `createChatAgent()` from `lib/agent/executor.ts`
  - [ ] Write unit tests for API routes

- [ ] Task 3: Create TypeScript types and API client (AC: all)
  - [ ] Create `lib/types/chat.ts` with Conversation, Message, ChatRequest, ChatResponse types
  - [ ] Create `lib/api/chat.ts` with functions: sendMessage, getConversations, getConversation, createConversation, deleteConversation
  - [ ] Implement SSE parsing for streaming responses
  - [ ] Write unit tests for API client

- [ ] Task 4: Create chat page and layout (AC: 1)
  - [ ] Create `app/projects/[id]/chat/page.tsx` with ChatInterface component
  - [ ] Create `app/projects/[id]/chat/layout.tsx` for chat-specific layout (optional)
  - [ ] Add chat navigation item to project workspace sidebar
  - [ ] Write component tests for page rendering

- [ ] Task 5: Build ConversationSidebar component (AC: 5)
  - [ ] Create `components/chat/ConversationSidebar.tsx`
  - [ ] Display list of conversations (title, date, message count preview)
  - [ ] Click to select conversation and load messages
  - [ ] Collapse/expand toggle
  - [ ] Active conversation highlighting
  - [ ] Write component tests

- [ ] Task 6: Build MessageList component (AC: 8)
  - [ ] Create `components/chat/MessageList.tsx`
  - [ ] Render messages with role (user/assistant) styling
  - [ ] Auto-scroll to bottom on new messages
  - [ ] Allow scrolling up without disruption (detect user scroll)
  - [ ] Loading state for assistant response
  - [ ] Write component tests

- [ ] Task 7: Build MessageItem component (AC: 3, 4)
  - [ ] Create `components/chat/MessageItem.tsx`
  - [ ] User message styling (right-aligned, user avatar)
  - [ ] Assistant message styling (left-aligned, AI avatar)
  - [ ] Support markdown rendering in messages
  - [ ] Tool execution indicator slot
  - [ ] Timestamp display
  - [ ] Write component tests

- [ ] Task 8: Build ChatInput component (AC: 2)
  - [ ] Create `components/chat/ChatInput.tsx`
  - [ ] Textarea with auto-resize
  - [ ] Submit on Enter (Shift+Enter for newline)
  - [ ] Submit button with loading state
  - [ ] Disable input during agent processing
  - [ ] Write component tests

- [ ] Task 9: Build ToolIndicator component (AC: 4)
  - [ ] Create `components/chat/ToolIndicator.tsx`
  - [ ] Map tool names to user-friendly messages:
    - query_knowledge_base → "Searching knowledge base..."
    - detect_contradictions → "Checking for contradictions..."
    - find_gaps → "Analyzing gaps..."
    - get_document_info → "Looking up document..."
    - validate_finding → "Validating finding..."
  - [ ] Show spinner during tool execution
  - [ ] Display tool result summary on completion
  - [ ] Write component tests

- [ ] Task 10: Build ChatInterface container component (AC: all)
  - [ ] Create `components/chat/ChatInterface.tsx`
  - [ ] Compose ConversationSidebar, MessageList, ChatInput
  - [ ] Manage conversation state (current conversation, messages)
  - [ ] Handle SSE streaming and update messages in real-time
  - [ ] Handle new conversation creation
  - [ ] Write integration tests

- [ ] Task 11: Create useChat hook for state management (AC: 2, 3, 7)
  - [ ] Create `lib/hooks/useChat.ts`
  - [ ] Manage messages state with optimistic updates
  - [ ] Handle SSE streaming connection and events
  - [ ] Manage loading/error states
  - [ ] Auto-save conversation on message
  - [ ] Write hook tests

- [ ] Task 12: Create useConversations hook (AC: 5, 6)
  - [ ] Create `lib/hooks/useConversations.ts`
  - [ ] Fetch and cache conversations list
  - [ ] Create new conversation
  - [ ] Switch between conversations
  - [ ] Delete conversation
  - [ ] Write hook tests

- [ ] Task 13: Implement responsive design (AC: 9)
  - [ ] Desktop: sidebar visible, 280px width
  - [ ] Tablet/Mobile: sidebar hidden by default, toggle button
  - [ ] Mobile: full-width chat area
  - [ ] Test on multiple viewport sizes
  - [ ] Write visual regression tests (optional)

- [ ] Task 14: Integration testing (AC: all)
  - [ ] E2E test: send message and receive streamed response
  - [ ] E2E test: create new conversation
  - [ ] E2E test: switch between conversations
  - [ ] E2E test: verify message persistence after page reload
  - [ ] Test tool indicators appear during agent processing

## Dev Notes

### Relevant Architecture Patterns and Constraints

This story implements the **Chat Interface** from UX Design Specification Section 5.4. The interface integrates with the LangChain agent and streaming infrastructure created in E5.2.

**Key Architecture Constraints:**
- **SSE Streaming:** Use Server-Sent Events for token-by-token display (not WebSocket)
- **Event Types:** Consume events from `lib/agent/streaming.ts`: token, tool_start, tool_end, sources, done, error
- **Agent Integration:** Call `createChatAgent()` from `lib/agent/executor.ts`
- **Context Window:** Pass last 10 messages to LLM (configurable via P4 spec)
- **RLS Policies:** User can only access own conversations

**Chat API Design (from tech-spec):**
```typescript
// POST /api/projects/[id]/chat
// Request: { message: string, conversation_id?: string }
// Response: SSE stream with events:
// - { type: "token", text: string }
// - { type: "tool_start", tool: string, args: object }
// - { type: "tool_end", tool: string, result: object }
// - { type: "sources", citations: SourceCitation[] }
// - { type: "done", message: Message, suggested_followups: string[] }
// - { type: "error", message: string, code: string }
```

[Source: docs/sprint-artifacts/tech-spec-epic-E5.md#Chat Message Endpoint Detail]

### UI Component Structure

```
app/projects/[id]/chat/
├── page.tsx              # Chat page
└── layout.tsx            # Optional chat layout

components/chat/
├── ChatInterface.tsx     # Main container
├── ConversationSidebar.tsx
├── MessageList.tsx
├── MessageItem.tsx
├── ChatInput.tsx
├── ToolIndicator.tsx
└── index.ts              # Barrel export
```

[Source: docs/sprint-artifacts/tech-spec-epic-E5.md#Module 5: Chat UI Components]

### Database Schema

```sql
CREATE TABLE conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id),
    title text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
    content text NOT NULL,
    tool_calls jsonb,
    tool_results jsonb,
    sources jsonb,
    tokens_used integer,
    created_at timestamptz DEFAULT now()
);
```

[Source: docs/sprint-artifacts/tech-spec-epic-E5.md#Database Schema (PostgreSQL)]

### Project Structure Notes

- New `components/chat/` directory following existing `components/knowledge-explorer/` pattern
- API routes in `app/api/projects/[id]/chat/` following existing patterns
- Hooks in `lib/hooks/` following `useFindings`, `useContradictions` patterns
- Types in `lib/types/chat.ts` following `lib/types/findings.ts` pattern
- Tests in `__tests__/chat/` following established patterns

### Learnings from Previous Story

**From Story e5-2-implement-langchain-agent-with-11-chat-tools (Status: done)**

- **Agent Module Created**: Complete `lib/agent/` module available:
  - `executor.ts` - `createChatAgent()` function ready for use
  - `streaming.ts` - `AgentStreamHandler` class with SSE event types
  - `prompts.ts` - System prompt with P2/P3 behaviors
  - All 11 tools ready for invocation

- **SSE Event Types Established**:
  ```typescript
  type SSEEventType = 'token' | 'tool_start' | 'tool_end' | 'sources' | 'done' | 'error';
  ```

- **LangGraph Integration**: Using `createReactAgent` from `@langchain/langgraph/prebuilt`

- **Test Patterns**: 33 unit tests with comprehensive mocking; streaming utilities tested

- **Default Model**: claude-sonnet-4-5-20250929 with temperature 0.7

- **Dependencies Already Installed**: All LangChain packages, Zod for validation

[Source: docs/sprint-artifacts/stories/e5-2-implement-langchain-agent-with-11-chat-tools.md#Dev-Agent-Record]

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E5.md#Module 5: Chat UI Components]
- [Source: docs/sprint-artifacts/tech-spec-epic-E5.md#Chat Message Endpoint Detail]
- [Source: docs/sprint-artifacts/tech-spec-epic-E5.md#Database Schema (PostgreSQL)]
- [Source: docs/sprint-artifacts/tech-spec-epic-E5.md#Story-Level Acceptance Criteria - E5.3]
- [Source: docs/ux-design-specification.md#Section 5.4 Chat (Conversational Assistant)]
- [Source: docs/agent-behavior-spec.md#P4: Conversation Goal/Mode Framework]
- [Source: docs/epics.md#Story E5.3: Build Chat Interface with Conversation History]

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/stories/e5-3-build-chat-interface-with-conversation-history.context.xml

### Agent Model Used

claude-opus-4-5-20251101

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-01 | Story drafted from epics.md and tech-spec-epic-E5.md | SM Agent |
| 2025-12-01 | Context XML generated, story marked ready-for-dev | Context Workflow |
