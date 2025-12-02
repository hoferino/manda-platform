# Epic 5 Retrospective: Conversational Assistant

**Epic:** E5 - Conversational Assistant
**Duration:** December 1-2, 2025 (2 days)
**Status:** Complete - 8/9 stories done, 1 deferred
**Agent Model:** Claude Opus 4.5 (claude-opus-4-5-20251101)
**Scrum Master:** Bob (SM Agent)
**Facilitator:** Max (Project Lead)

---

## Executive Summary

Epic 5 delivered the complete Conversational Assistant for the Manda M&A Platform, enabling analysts to query knowledge through natural language and receive contextual, sourced answers. The epic delivered 8 stories in 2 days (with 1 story deferred to keep MVP lean), establishing a robust LangChain-based agent with 11 chat tools, streaming responses, multi-turn context, and confidence indicators.

Key achievement: Built a production-ready conversational agent that integrates with the Knowledge Explorer from Epic 4, providing intelligent M&A analysis with source attribution.

---

## Key Metrics

| Metric | Value |
|--------|-------|
| Stories Completed | 8/9 (89%) |
| Stories Deferred | 1 (E5.8: Chat Export - keep MVP lean) |
| Total Tests Added | ~400+ tests |
| Code Reviews | 4 stories reviewed, all APPROVED |
| Production Incidents | 0 |
| Technical Debt Items | 2 (Neo4j stub in tools, live LLM tests deferred) |

### Stories Delivered

| Story | Title | Key Deliverable |
|-------|-------|-----------------|
| E5.1 | Integrate LLM via LangChain (Model-Agnostic) | LangChain factory with Anthropic/OpenAI/Google |
| E5.2 | Implement LangChain Agent with 11 Chat Tools | All tools + LangGraph executor + SSE streaming |
| E5.3 | Build Chat Interface with Conversation History | Full chat UI with persistence and responsive design |
| E5.4 | Implement Source Citation Display in Messages | Citation parser with document preview modal |
| E5.5 | Implement Quick Actions and Suggested Follow-ups | 4 quick actions + contextual suggestions |
| E5.6 | Add Conversation Context and Multi-turn Support | Context manager with P4 compliance |
| E5.7 | Implement Confidence Indicators and Uncertainty Handling | P2-compliant confidence display |
| E5.9 | Implement Document Upload via Chat Interface | Drag-drop + file picker + status tracking |

### Story Deferred

| Story | Title | Reason |
|-------|-------|--------|
| E5.8 | Implement Chat Export Functionality | Keep MVP lean - export not critical for core agent experience |

---

## What Went Well

### 1. Prerequisites Investment Paid Off

The 7 blocking prerequisites (P1-P7 + P8) defined in Epic 4 retrospective made Epic 5 implementation smooth:
- **P1 Hybrid Search Architecture** - Query behavior well-defined
- **P2 Agent Behavior Framework** - Response formatting rules clear
- **P3 Expected Behaviors** - 7 intent patterns documented
- **P4 Multi-turn Rules** - Context handling rules explicit
- **P7 Test Strategy** - Evaluation harness ready

### 2. LangChain/LangGraph Integration

LangGraph's `createReactAgent` from `@langchain/langgraph/prebuilt` simplified the agent implementation significantly compared to the deprecated `create_tool_calling_agent` approach.

### 3. Component Reuse from Epic 4

The chat interface heavily reused patterns from Knowledge Explorer:
- `DocumentPreviewModal` reused for citations
- Supabase Realtime patterns applied for uploads
- Badge components (ConfidenceBadge) extended for chat

### 4. Streaming Architecture

SSE streaming with clearly defined event types (token, tool_start, tool_end, sources, done, error) worked well:
- `AgentStreamHandler` class cleanly separates streaming logic
- Frontend `useChat` hook handles events with optimistic updates
- Tool indicators provide clear feedback during agent processing

### 5. Fast Iteration Cycle

Epic completed in 2 days (vs. 3 days for Epic 4) despite similar complexity. Factors:
- Prerequisites removed design decisions from critical path
- "Learnings from Previous Story" sections enabled rapid context handoff
- Test infrastructure from tech debt sprint sped up testing

### 6. Code Review Quality

All 4 reviewed stories passed on first submission. The dev notes gave reviewers clear context, and the acceptance criteria were explicit.

---

## What Could Be Improved

### 1. Neo4j Integration Remains Stubbed

**Issue:** `update_knowledge_graph` tool stores relationships in Supabase metadata as fallback. Neo4j graph updates not implemented.

**Impact:** Graph traversal in queries works (read), but agent-triggered graph updates don't persist to Neo4j.

**Affected Stories:** E5.2 (tools), E5.5 (quick actions using detect_contradictions)

**Action:** Implement Neo4j write integration in Epic 6 or as tech debt story

### 2. Live LLM Integration Tests Still Manual

**Issue:** Unit tests use mocked responses; live API tests exist but are skipped by default (require `RUN_INTEGRATION_TESTS=true`).

**Impact:** Prompt regression testing requires manual effort pre-release.

**Affected Stories:** E5.1, E5.2, E5.6

**Action:** Consider automated weekly integration test runs with budget cap

### 3. Token Counting Approximation

**Issue:** Used character-based token estimation (~4 chars/token) instead of tiktoken due to WASM compatibility issues with Next.js.

**Impact:** Token counts are approximate, but sufficient for context window management.

**Affected Stories:** E5.6

**Action:** Accept for MVP, revisit if context window issues arise in production

### 4. Unit Test Deferral in E5.3

**Issue:** E5.3 (Chat Interface) marked many unit tests as "deferred to testing story" - no dedicated testing story was created.

**Impact:** Lower test coverage on chat components compared to other epics.

**Action:** Create TD story or include in E6 testing scope

---

## Technical Patterns Established

### 1. LLM Factory Pattern

```typescript
// lib/llm/client.ts
export function createLLMClient(config?: Partial<LLMConfig>): BaseChatModel {
  const provider = config?.provider ?? getLLMProvider();
  switch (provider) {
    case 'anthropic': return new ChatAnthropic({...});
    case 'openai': return new ChatOpenAI({...});
    case 'google': return new ChatGoogleGenerativeAI({...});
  }
}
```

### 2. Agent Tool Pattern

```typescript
// lib/agent/tools/knowledge-tools.ts
export const queryKnowledgeBaseTool = tool(
  async (input) => { /* implementation */ },
  {
    name: 'query_knowledge_base',
    description: '...', // LLM-friendly description
    schema: z.object({ query: z.string(), filters: z.object({...}) })
  }
);
```

### 3. SSE Streaming Pattern

```typescript
// lib/agent/streaming.ts
export class AgentStreamHandler {
  handleToken(token: string): void;
  handleToolStart(toolName: string): void;
  handleToolEnd(result: unknown): void;
  handleDone(message: Message): void;
}

// API route
const stream = new ReadableStream({
  async start(controller) {
    const handler = new AgentStreamHandler(controller);
    await agent.invoke(input, { callbacks: [handler] });
  }
});
return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
```

### 4. Context Management Pattern

```typescript
// lib/agent/context.ts
export class ConversationContextManager {
  async loadContext(conversationId: string): Promise<FormattedContext>;
  formatContext(messages: Message[]): BaseMessage[];
  truncateToFitWindow(messages: BaseMessage[], maxTokens: number): BaseMessage[];
}

// Usage in chat route
const contextManager = new ConversationContextManager();
const { messages: chatHistory } = await contextManager.loadContext(conversationId);
await agent.invoke({ input, chat_history: chatHistory });
```

### 5. Confidence Extraction Pattern

```typescript
// lib/utils/confidence.ts
export function extractConfidence(toolResults: ToolResult[]): MessageConfidence {
  const confidences = toolResults.flatMap(r => r.confidence ?? []);
  return {
    level: aggregateConfidenceLevel(confidences),
    factors: extractFactors(toolResults),
    reasoning: generateNaturalReasoning(confidences) // P2 compliant
  };
}
```

---

## Previous Retrospective Follow-Up

**From Epic 4 Retrospective - Prerequisites (P1-P7):**

| Prerequisite | Status | Evidence |
|--------------|--------|----------|
| P1: Hybrid Search Architecture | ✅ Done | `query_knowledge_base` implements full flow |
| P2: Agent Behavior Framework | ✅ Done | System prompt with all rules |
| P3: Expected Behavior per Use Case | ✅ Done | 7 inferred intents in prompt |
| P4: Conversation Goal/Mode Framework | ✅ Done | Context handling in E5.6 |
| P5: Regenerate Supabase Types | ✅ Done | Clean types, minimal casts |
| P6: Install Missing shadcn/ui Components | ✅ Done | avatar, popover, command added |
| P7: LLM Integration Test Strategy | ✅ Done | Evaluation harness created |
| P8: Correction Chain Detection | ⏳ Partial | SUPERSEDES in spec, implementation deferred |

**Completion Rate:** 7/8 fully complete, 1/8 partially complete

---

## Epic 6 Implications

### Architecture Ready For

1. **IRL Management (E6)** - `create_irl` tool stub ready for real implementation
2. **Chat-triggered IRL Creation** - Agent can add gaps to IRL via tool
3. **Q&A Integration (E8)** - `suggest_questions` and `add_to_qa` tools ready

### Blocking Prerequisites for Epic 6

| # | Action Item | Priority | Owner |
|---|-------------|----------|-------|
| P1 | Neo4j write integration for update_knowledge_graph | Medium | Dev |
| P2 | Audit E5.3 deferred tests - create coverage plan | Low | QA |

### No Blocking Items

Epic 6 (IRL Management) can proceed without blocking prerequisites. The main work is IRL-specific UI and AI-assisted generation, which builds on existing infrastructure.

---

## Technical Debt Backlog

| # | Item | Priority | Target |
|---|------|----------|--------|
| TD1 | Neo4j update_knowledge_graph implementation | Medium | E6 or TD sprint |
| TD2 | E5.3 chat component unit tests | Low | E6 or TD sprint |
| TD3 | Automated weekly LLM integration tests | Low | Post-MVP |
| TD4 | Tiktoken WASM workaround | Low | As needed |

---

## Process Improvements

| Item | Status | Notes |
|------|--------|-------|
| "Learnings from Previous Story" section | ✅ Keep | Critical for rapid context handoff |
| Prerequisites before epic start | ✅ Keep | Prevented design debates during implementation |
| Story deferral for MVP lean | ✅ New | E5.8 deferred - good discipline |
| Code review passing rate | ✅ Maintain | 100% first-pass approval continues |

---

## Lessons Learned

### Technical

1. **LangGraph > LangChain Agent**: `createReactAgent` from LangGraph is cleaner than deprecated AgentExecutor patterns
2. **Streaming complexity**: SSE streaming with multiple event types requires careful frontend state management
3. **Token estimation good enough**: Character-based approximation (~4 chars/token) is practical for context management
4. **Stub implementations enable progress**: Neo4j stub let us complete E5.2 without blocking

### Process

1. **Prerequisites remove decision paralysis**: P1-P7 meant zero design debates during implementation
2. **Deferred stories are okay**: E5.8 deferral shows good scope discipline
3. **Fast epic = good foundations**: 2-day epic completion shows ROI of tech debt sprint

### Product

1. **Agent behavior rules matter**: P2/P3/P4 specs drove consistent agent responses
2. **Confidence is nuanced**: P2-compliant "never show raw scores" rule works well
3. **Upload in chat is natural**: E5.9 drag-drop upload feels intuitive

---

## Appendix: File Inventory

### New Components Created (Epic 5)

```
manda-app/
├── lib/
│   ├── llm/
│   │   ├── client.ts         # LLM factory (E5.1)
│   │   ├── config.ts         # Provider configuration
│   │   ├── callbacks.ts      # Token counting
│   │   ├── types.ts          # Zod schemas
│   │   └── index.ts          # Barrel export
│   ├── agent/
│   │   ├── executor.ts       # Agent creation (E5.2)
│   │   ├── prompts.ts        # System prompt
│   │   ├── streaming.ts      # SSE handler
│   │   ├── context.ts        # Context manager (E5.6)
│   │   ├── schemas.ts        # Tool schemas
│   │   └── tools/
│   │       ├── knowledge-tools.ts
│   │       ├── intelligence-tools.ts
│   │       ├── document-tools.ts
│   │       ├── workflow-tools.ts
│   │       └── all-tools.ts
│   ├── hooks/
│   │   ├── useChat.ts        # Chat state (E5.3)
│   │   ├── useConversations.ts
│   │   └── useChatUpload.ts  # Upload state (E5.9)
│   ├── utils/
│   │   ├── citation-parser.ts  # Citation parsing (E5.4)
│   │   ├── confidence.ts       # Confidence utils (E5.7)
│   │   └── confidence-reasoning.ts
│   ├── types/
│   │   └── chat.ts           # Chat types
│   └── api/
│       └── chat.ts           # API client
├── components/chat/
│   ├── ChatInterface.tsx     # Main container
│   ├── ConversationSidebar.tsx
│   ├── MessageList.tsx
│   ├── MessageItem.tsx
│   ├── ChatInput.tsx
│   ├── ToolIndicator.tsx
│   ├── QuickActions.tsx      # (E5.5)
│   ├── FollowUpSuggestions.tsx
│   ├── SourceCitationLink.tsx  # (E5.4)
│   ├── CitationRenderer.tsx
│   ├── ConfidenceBadge.tsx   # (E5.7)
│   ├── ConfidenceTooltipContent.tsx
│   ├── ChatUploadButton.tsx  # (E5.9)
│   ├── ChatDropZone.tsx
│   └── ChatUploadStatus.tsx
└── app/api/projects/[id]/
    ├── chat/
    │   ├── route.ts          # Main chat endpoint
    │   └── upload/route.ts   # Upload endpoint (E5.9)
    └── conversations/
        ├── route.ts
        └── [conversationId]/
            ├── route.ts
            └── messages/route.ts
```

### New Tests Created

```
manda-app/__tests__/
├── llm/
│   ├── config.test.ts        # 29 tests
│   ├── client.test.ts        # 14 tests
│   ├── callbacks.test.ts     # 24 tests
│   ├── types.test.ts         # 26 tests
│   ├── agent-tools.test.ts   # 33 tests
│   └── evaluation-harness.ts # P7 compliance
├── lib/
│   ├── agent/context.test.ts # 34 tests (E5.6)
│   └── utils/
│       ├── citation-parser.test.ts  # 24 tests (E5.4)
│       ├── confidence.test.ts       # 23 tests (E5.7)
│       └── confidence-reasoning.test.ts  # 20 tests
└── components/chat/
    ├── QuickActions.test.tsx        # 22 tests (E5.5)
    ├── FollowUpSuggestions.test.tsx # 17 tests
    ├── useQuickActionAvailability.test.ts # 12 tests
    ├── SourceCitationLink.test.tsx  # 16 tests (E5.4)
    ├── ChatUploadButton.test.tsx    # 24 tests (E5.9)
    ├── ChatDropZone.test.tsx        # 24 tests
    └── ChatUploadStatus.test.tsx    # 24 tests
```

### Database Migrations

```
manda-app/supabase/migrations/
└── 00025_update_messages_for_chat.sql  # sources, tokens columns
```

---

**Document Version:** 1.0
**Created:** 2025-12-02
**Author:** Bob (SM Agent)
**Approved By:** Max (Project Lead)
