---
stepsCompleted: [1, 2, 3, 4]
partyModeReview: completed
workflowStatus: complete
inputDocuments:
  - _bmad-output/planning-artifacts/agent-system-prd.md
  - _bmad-output/planning-artifacts/agent-system-architecture.md
---

# Agent System v2.0 - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Agent System v2.0, decomposing the requirements from the PRD and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

**Conversation & Memory (FR1-FR9)**
- FR1: Users can have multi-turn conversations that maintain context across messages
- FR2: System remembers conversation history within a thread (users can reference earlier messages)
- FR3: Users can close browser/device and return to find conversation intact
- FR4: System persists all conversation state durably across sessions
- FR5: Each conversation thread is scoped to a single deal (project_id isolation)
- FR6: Users can start new conversation threads within the same deal
- FR7: Users can rename conversation threads
- FR8: Users can archive conversation threads
- FR9: Users can delete conversation threads

**Conversation Search (FR10-FR12)**
- FR10: Users can search across past conversations within a deal by keyword
- FR11: Users can search conversations by date range
- FR12: Search results show relevant message excerpts with context

**Message Routing & Processing (FR13-FR18)**
- FR13: System intelligently routes requests to appropriate handlers without hardcoded patterns
- FR14: Users receive direct responses for simple queries without unnecessary processing
- FR15: System delegates specialized tasks to appropriate specialist agents
- FR16: Users never receive generic fallback responses for non-document questions
- FR17: System handles greetings and casual conversation with natural LLM responses
- FR18: System supports real-time token streaming for all response types

**Multimodal Capabilities (FR19-FR22)**
- FR19: Users can upload images in chat for analysis
- FR20: Users can reference uploaded files in conversation
- FR21: System can extract data from images and cross-reference with knowledge graph
- FR22: Users can drag-and-drop files directly into the chat interface

**Knowledge Graph Integration (FR23-FR26)**
- FR23: System searches knowledge graph for deal-specific context when relevant
- FR24: System provides source attribution for knowledge graph responses
- FR25: System selects appropriate search method (vector, keyword, or graph traversal) based on query characteristics
- FR26: Users receive entity-connected, context-aware responses for deal questions

**Specialist Agent Delegation (FR27-FR31)**
- FR27: System can delegate to deal analyst agent for deal-specific analysis
- FR28: System can delegate to research agent for external research and web search
- FR29: System can delegate to financial agent for financial modeling tasks
- FR30: Specialist agents operate within their defined tool scope
- FR31: Specialist agents hand off tasks outside their scope back to supervisor

**Human-in-the-Loop (FR32-FR36)**
- FR32: System presents plans for approval before executing complex multi-step tasks
- FR33: Users can approve, modify, or reject proposed plans
- FR34: System suggests Q&A entries when detecting information gaps; user confirms with one click
- FR35: System requests approval before persisting data to knowledge base
- FR36: System pauses execution pending user approval for data modifications

**Workflow Support (FR37-FR40)**
- FR37: System supports flexible workflow navigation (skip, reorder, deviate)
- FR38: System tracks workflow progress and displays completion status
- FR39: Users can return to skipped workflow sections at any time
- FR40: Workflow structure guides but does not constrain user actions

**User Feedback & Transparency (FR41-FR48)**
- FR41: System clearly indicates when information is insufficient or missing
- FR42: System provides actionable next steps when unable to complete a request
- FR43: System never fabricates information when data is unavailable
- FR44: System confirms successful operations with clear status messages
- FR45: System uses professional, direct tone consistent with standard LLM behavior
- FR46: Users can provide thumbs up/down feedback on responses
- FR47: System stores feedback as training data for future model fine-tuning
- FR48: System streams thinking/progress indicators when specialist agents are working

**Data Management (FR49-FR51)**
- FR49: Users can request deletion of their own messages (GDPR Article 17)
- FR50: System triggers automatic data cleanup when deal status changes to closed
- FR51: All conversation data stored in EU data centers

**Error Handling & Recovery (FR52-FR55)**
- FR52: System recovers gracefully from transient failures (API timeouts, network issues)
- FR53: System provides clear error messages when operations fail
- FR54: System can resume from last checkpoint after unexpected interruption
- FR55: Failed operations are logged for debugging and do not corrupt conversation state

**Context Window Management (FR56-FR59)**
- FR56: System maintains full conversation history in storage while sending trimmed context to LLM
- FR57: System preserves important context when trimming messages (via summaries or key facts)
- FR58: Specialist agents have independent context windows appropriate to their tasks
- FR59: System generates conversation summaries at natural breakpoints

**Conversation Intelligence (FR60-FR66)**
- FR60: System can reference relevant information from past conversations in the same deal
- FR61: System extracts verified deal facts from conversations and stores in knowledge graph
- FR62: System stores conversation summaries as retrievable nodes linked to deal context
- FR63: System maintains separation between conversational history and deal intelligence
- FR64: Extracted facts and summaries are available for retrieval in future conversations
- FR65: System detects user corrections and offers to persist them to knowledge graph
- FR66: Corrections include provenance metadata (source: user_correction, timestamp, original_value)

### Non-Functional Requirements

**Performance**
- NFR1: First token latency < 2 seconds
- NFR2: Smooth token streaming without visible buffering
- NFR3: Knowledge graph query < 500ms for simple retrieval
- NFR4: Immediate thinking indicator for complex tasks
- NFR5: No artificial concurrent user limit per deal

**Security & Data Handling**
- NFR6: All deal data treated as confidential
- NFR7: EU data center residency for all persistent storage
- NFR8: GCP Vertex AI (EU region) for enterprise LLM access
- NFR9: Audit logging via LangSmith with user/deal context
- NFR10: Data encrypted at rest and in transit

**Reliability**
- NFR11: 99.9% availability
- NFR12: Zero data loss for conversation state
- NFR13: All state changes persisted before acknowledgment (checkpoint integrity)
- NFR14: Specialist failures don't crash conversation (graceful degradation)

**Integration Resilience**
- NFR15: Provider fallback chain (Claude → Gemini → basic responses)

### Additional Requirements

**Architecture Decisions (from agent-system-architecture.md):**
- Single StateGraph + Middleware architecture (enterprise pattern)
- PostgresSaver for checkpointing (existing infrastructure)
- Redis caching for tool results and deal context (existing infrastructure)
- Context engineering: Write/Select/Compress/Isolate pillars
- 70% compression threshold for context window (prevents hallucination in M&A analysis)
- Build in `lib/agent/v2/` directory (parallel development)
- 4-phase migration strategy with sunset plan for legacy code
- Thread ID pattern: `{workflowMode}:{dealId}:{userId}:{conversationId}` (uses `:` delimiter to support UUIDs with hyphens)

**Cache TTLs:**
- Deal context: 1 hour
- Knowledge graph queries: 30 min
- Specialist results: 30 min

**Error Handling Codes:**
- LLM_ERROR, TOOL_ERROR, STATE_ERROR, CONTEXT_ERROR, APPROVAL_REJECTED, STREAMING_ERROR, CACHE_ERROR

**File Structure (from Architecture):**
```
lib/agent/v2/
├── index.ts
├── graph.ts
├── state.ts
├── types.ts
├── middleware/
│   ├── context-loader.ts
│   ├── workflow-router.ts
│   ├── tool-selector.ts
│   └── summarization.ts
├── nodes/
│   ├── supervisor.ts
│   ├── retrieval.ts
│   ├── approval.ts
│   ├── specialists/
│   └── cim/
├── tools/
└── utils/
```

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 1 | Multi-turn conversations with context |
| FR2 | Epic 1 | Conversation history remembrance |
| FR3 | Epic 1 | Browser close/return persistence |
| FR4 | Epic 1 | Durable state persistence |
| FR5 | Epic 1 | Thread scoped to deal |
| FR6 | Epic 7 | Start new threads |
| FR7 | Epic 7 | Rename threads |
| FR8 | Epic 7 | Archive threads |
| FR9 | Epic 7 | Delete threads |
| FR10 | Epic 7 | Search by keyword |
| FR11 | Epic 7 | Search by date |
| FR12 | Epic 7 | Search excerpts |
| FR13 | Epic 2 | Intelligent routing |
| FR14 | Epic 2 | Direct simple responses |
| FR15 | Epic 4 | Specialist delegation |
| FR16 | Epic 2 | No generic fallback |
| FR17 | Epic 2 | Natural greetings |
| FR18 | Epic 2 | Real-time streaming |
| FR19 | Epic 8 | Image upload |
| FR20 | Epic 8 | Reference files |
| FR21 | Epic 8 | Image data extraction |
| FR22 | Epic 8 | Drag-and-drop |
| FR23 | Epic 3 | KG search |
| FR24 | Epic 3 | Source attribution |
| FR25 | Epic 3 | Search method selection |
| FR26 | Epic 3 | Entity-connected responses |
| FR27 | Epic 4 | Deal analyst |
| FR28 | Epic 4 | Research agent |
| FR29 | Epic 4 | Financial agent |
| FR30 | Epic 4 | Specialist scope |
| FR31 | Epic 4 | Specialist handoff |
| FR32 | Epic 5 | Plan presentation |
| FR33 | Epic 5 | Approve/modify/reject |
| FR34 | Epic 5 | Q&A suggestion confirmation |
| FR35 | Epic 5 | KB persistence approval |
| FR36 | Epic 5 | Execution pause |
| FR37 | Epic 6 | Flexible workflow navigation |
| FR38 | Epic 6 | Progress tracking |
| FR39 | Epic 6 | Return to skipped sections |
| FR40 | Epic 6 | Non-constraining structure |
| FR41 | Epic 3 | Insufficient info indication |
| FR42 | Epic 3 | Actionable next steps |
| FR43 | Epic 3 | Never fabricate |
| FR44 | Epic 2 | Status confirmation |
| FR45 | Epic 2 | Professional tone |
| FR46 | Epic 9 | Thumbs up/down |
| FR47 | Epic 9 | Feedback storage |
| FR48 | Epic 4 | Progress indicators |
| FR49 | Epic 10 | GDPR message deletion |
| FR50 | Epic 10 | Deal closure cleanup |
| FR51 | Epic 10 | EU data centers |
| FR52 | Epic 9 | Transient failure recovery |
| FR53 | Epic 9 | Clear error messages |
| FR54 | Epic 1 | Resume from checkpoint |
| FR55 | Epic 1 | No state corruption |
| FR56 | Epic 1 | Full history, trimmed context |
| FR57 | Epic 4 | Preserve context when trimming |
| FR58 | Epic 4 | Independent specialist context |
| FR59 | Epic 4 | Conversation summaries |
| FR60 | Epic 11 | Reference past conversations |
| FR61 | Epic 11 | Extract facts to KG |
| FR62 | Epic 11 | Store summaries as nodes |
| FR63 | Epic 11 | Separate history from intelligence |
| FR64 | Epic 11 | Facts available for retrieval |
| FR65 | Epic 11 | Detect user corrections |
| FR66 | Epic 11 | Correction provenance metadata |

## Epic List

### Epic 1: Persistent Conversations
Users can have conversations that persist across sessions - the system remembers what was said. This is the core fix for the broken "chatHistory: []" problem.

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR54, FR55, FR56

**Delivers:**
- PostgresSaver checkpointing connected to chat
- Thread-scoped state persistence
- Resume from checkpoint after interruption
- Full history in storage, trimmed for LLM

---

### Epic 2: Intelligent Conversation - Supervisor & Routing
Users get intelligent responses - greetings are greeted, questions are answered, no more "I don't see that in documents" for non-document questions.

**FRs covered:** FR13, FR14, FR16, FR17, FR18, FR44, FR45

**Delivers:**
- Single StateGraph with supervisor node
- LLM-based routing (no regex)
- Real-time token streaming
- Natural conversation handling
- Professional, direct tone

---

### Epic 3: Knowledge & Retrieval - Deal Intelligence
Users get context-aware answers about their deals with source attribution - the agent knows the deal context.

**FRs covered:** FR23, FR24, FR25, FR26, FR41, FR42, FR43

**Delivers:**
- Graphiti/Neo4j integration
- Vector, keyword, and graph traversal search
- Source attribution
- Honest uncertainty (never fabricates)
- Actionable next steps when data missing

---

### Epic 4: Specialist Agents - Expert Delegation
Users get expert-level analysis - financial modeling, research, deal analysis - by delegating to specialist agents.

**FRs covered:** FR15, FR27, FR28, FR29, FR30, FR31, FR48, FR57, FR58, FR59

**Delivers:**
- Deal analyst specialist
- Research agent (web search via Gemini)
- Financial agent
- Specialist handoff patterns
- Progress indicators during specialist work
- Independent specialist context windows
- Conversation summaries at breakpoints

---

### Epic 5: Human-in-the-Loop - Approval Workflows
Users maintain control - they approve plans before complex tasks execute, and approve data modifications.

**FRs covered:** FR32, FR33, FR34, FR35, FR36

**Delivers:**
- Plan presentation before complex tasks
- Approve/modify/reject UI
- Q&A suggestion and one-click confirmation
- Knowledge base persistence approval
- Execution pause pending approval

---

### Epic 6: CIM Builder Workflow
Users can build Confidential Information Memorandums through a guided, flexible workflow that tracks progress and allows non-linear navigation.

**FRs covered:** FR37, FR38, FR39, FR40

**Delivers:**
- CIM workflow entry point (workflowMode: 'cim')
- Phase router node
- Slide creation functionality
- Dependency checking
- Flexible navigation (skip, reorder, deviate)
- Progress tracking and completion status
- Return to skipped sections

**Architecture Notes:**
- Uses shared specialists from Epic 4
- Uses shared retrieval from Epic 3
- CIM-specific state (cimState) in unified state schema

---

### Epic 7: Thread Management & Conversation Search
Users can organize their conversations - create threads, rename them, archive, delete, and search across past conversations.

**FRs covered:** FR6, FR7, FR8, FR9, FR10, FR11, FR12

**Delivers:**
- Thread creation and management
- Rename, archive, delete threads
- Conversation search by keyword
- Conversation search by date range
- Search results with excerpts

---

### Epic 8: Multimodal Capabilities
Users can upload images and files directly in chat for analysis.

**FRs covered:** FR19, FR20, FR21, FR22

**Delivers:**
- Image upload and analysis
- File reference in conversation
- Image data extraction with KG cross-reference
- Drag-and-drop file upload

---

### Epic 9: Observability & User Feedback
Users can provide feedback on responses, and system provides clear error messages with proper audit logging.

**FRs covered:** FR46, FR47, FR52, FR53 + NFR9

**Delivers:**
- Thumbs up/down feedback collection
- Feedback storage for fine-tuning
- Error recovery from transient failures
- Clear, actionable error messages
- LangSmith audit logging with user/deal context

---

### Epic 10: GDPR Compliance & Data Management
Users can exercise GDPR rights, and system enforces data retention policies.

**FRs covered:** FR49, FR50, FR51

**Delivers:**
- GDPR message deletion (Article 17)
- Deal closure data cleanup
- EU data center residency verification

---

### Epic 11: Smarter Answers Over Time
Users get increasingly accurate answers as the system learns from conversations - extracting facts, storing summaries, detecting corrections, and making intelligence available for future reference.

**FRs covered:** FR60, FR61, FR62, FR63, FR64, FR65, FR66

**Delivers:**
- Reference past conversations
- Extract verified facts to knowledge graph
- Store conversation summaries as nodes
- Separate conversational history from deal intelligence
- Detect and persist user corrections
- Correction provenance metadata

---

## Epic 1: Persistent Conversations

Users can have conversations that persist across sessions - the system remembers what was said. This is the core fix for the broken "chatHistory: []" problem.

### Story 1.1: Create Unified Agent State Schema

As a **developer**,
I want a **unified state schema for the agent system**,
So that **all conversation state is properly typed and can be persisted/restored**.

**Depends On:** None (foundation story)

**Test Type:** Unit

**Acceptance Criteria:**

**Given** the agent system needs a unified state schema
**When** I create `lib/agent/v2/state.ts`
**Then** it exports an `AgentState` using LangGraph Annotation.Root with:
- `messages: BaseMessage[]` with messagesStateReducer
- `sources: SourceCitation[]` for attribution
- `pendingApproval: ApprovalRequest | null` for HITL
- `activeSpecialist: string | null` for delegation tracking
- `errors: AgentError[]` for error handling
- `dealContext: DealContext | null` for loaded deal data
- `workflowMode: 'chat' | 'cim' | 'irl'` for routing (Q&A is a cross-cutting tool, not a workflow mode)
- `cimState: CIMWorkflowState | null` for CIM workflow
- `scratchpad: Record<string, unknown>` for agent notes
- `historySummary: string | null` for compressed history
- `tokenCount: number` for context tracking
**And** all type interfaces are exported from `lib/agent/v2/types.ts`
**And** the schema follows camelCase naming conventions per architecture doc
**And** unit tests verify state creation and reducer behavior

---

### Story 1.2: Create Base StateGraph Structure

As a **developer**,
I want a **base StateGraph with conditional entry points**,
So that **different workflow modes can share the same graph infrastructure**.

**Depends On:** Story 1.1 (Unified State Schema)

**Test Type:** Unit

**Acceptance Criteria:**

**Given** the unified state schema from Story 1.1
**When** I create `lib/agent/v2/graph.ts`
**Then** it exports a compiled StateGraph that:
- Uses AgentState as the state schema
- Has conditional entry point based on `workflowMode`
- Routes 'chat' mode to 'supervisor' node (placeholder)
- Routes 'cim' mode to 'cim/phaseRouter' node (placeholder)
- Includes placeholder nodes that pass through state
**And** the graph compiles without errors
**And** `lib/agent/v2/index.ts` exports the graph publicly

---

### Story 1.3: Connect PostgresSaver Checkpointer

As a **user**,
I want my **conversation to persist across browser refreshes**,
So that **I can continue where I left off**.

**Depends On:** Story 1.2 (Base StateGraph)

**Test Type:** Integration

**Acceptance Criteria:**

**Given** the existing PostgresSaver at `lib/agent/checkpointer.ts`
**When** the StateGraph is invoked with a thread config
**Then** conversation state is persisted to PostgreSQL after each node execution
**And** closing and reopening the browser restores the conversation
**And** `chatHistory` in LangSmith traces shows previous messages (not empty array)

**Given** a thread ID like `chat:deal123:user456:conv789`
**When** the graph is invoked with this thread config
**Then** state is isolated to this specific thread
**And** other threads cannot access this state

---

### Story 1.4: Implement Thread ID Generation and Chat API Route

> **Note:** This story consolidates Stories 1.4 and 1.5 from the original breakdown.
> Story 1.3 already implemented the thread ID utilities (`createV2ThreadId`, `parseV2ThreadId`).
> This story focuses on using those utilities to create the v2 chat API route.

As a **user**,
I want **each conversation to have a unique thread**,
So that **my conversations are isolated per deal and don't interfere with each other**.

**Depends On:** Story 1.3 (PostgresSaver Checkpointer)

**Test Type:** Integration

**Acceptance Criteria:**

**Given** a user starts a new conversation in a deal
**When** the chat API is called without a `conversationId`
**Then** a new thread ID is generated following pattern: `{workflowMode}:{dealId}:{userId}:{conversationId}`
**And** the `conversationId` is returned to the client for future requests
**And** thread ID uses `:` delimiter (not `-`) to support UUIDs with hyphens

**Given** a user continues an existing conversation
**When** the chat API is called with a `conversationId`
**Then** the existing thread is resumed from checkpoint
**And** previous messages are loaded from state (via PostgresSaver)
**And** user sees their conversation history intact

**Given** thread isolation requirements (FR5)
**When** any graph operation occurs
**Then** data is scoped to the deal's `project_id`
**And** cross-deal access is prevented
**And** different users in the same deal have separate chat threads
**And** CIM threads are shared within deal (collaborative mode)

**Given** parallel development strategy (NOTE: Route consolidation complete - see Epic 1 Story 1.7)
**When** I update `app/api/projects/[id]/chat/route.ts` to use v2 agent
**Then** it accepts POST requests with `{ message, conversationId?, workflowMode? }`
**And** it invokes the v2 StateGraph with PostgresSaver checkpointing
**And** it returns streaming SSE responses
**And** thread config uses the correct thread ID pattern
**And** the route is protected by existing auth middleware

---

### ~~Story 1.5: Implement Chat API Route for v2~~ (Merged into 1.4)

> **MERGED:** This story has been consolidated into Story 1.4 above.
> The original Story 1.3 already delivered thread ID utilities, making the split
> between "thread management" (1.4) and "API route" (1.5) artificial.

---

### Story 1.6: Implement Basic Error Recovery

As a **user**,
I want **the system to recover from interruptions**,
So that **I don't lose my conversation if something goes wrong**.

**Depends On:** Story 1.4 (Thread ID Generation and Chat API Route)

**Test Type:** Integration

**Acceptance Criteria:**

**Given** a conversation in progress
**When** an unexpected error occurs (API timeout, network issue)
**Then** the error is logged with context (FR55)
**And** conversation state is not corrupted
**And** the user receives a clear error message

**Given** the system was interrupted mid-response
**When** the user sends a new message
**Then** the graph resumes from the last successful checkpoint (FR54)
**And** the conversation continues normally

---

### Story 1.7: Remove Legacy Agent Code

As a **developer**,
I want to **remove the deprecated v1 agent orchestrator and related dead code**,
So that **the codebase is clean and free of confusion between old and new implementations**.

**Depends On:** Story 1.4 (Chat API Route) - v2 must be functional before removing v1

**Test Type:** Unit

**Acceptance Criteria:**

**Given** the legacy code marked for deletion in CLAUDE.md
**When** the cleanup is complete
**Then** the following are deleted:
- `lib/agent/orchestrator/` (entire directory)
- `lib/agent/executor.ts`
- `lib/agent/intent.ts`

**And** the following are KEPT (reused by v2):
- `lib/agent/checkpointer.ts`
- `lib/agent/streaming.ts`
- `lib/agent/tools/*.ts`

**And** `npm run build` and `npm run type-check` pass with no errors

---

## Epic 2: Intelligent Conversation - Supervisor & Routing

Users get intelligent responses - greetings are greeted, questions are answered, no more "I don't see that in documents" for non-document questions.

### Story 2.1: Implement Supervisor Node with Tool-Calling

As a **user**,
I want **the agent to understand my intent and route appropriately**,
So that **I get relevant responses instead of generic fallbacks**.

**Depends On:** Story 1.2 (Base StateGraph)

**Test Type:** Unit

**Acceptance Criteria:**

**Given** the v2 StateGraph from Epic 1
**When** I create `lib/agent/v2/nodes/supervisor.ts`
**Then** it implements a supervisor node that:
- Uses Gemini via Vertex AI (EU region for NFR8 compliance)
- Has access to specialist tools (defined in `lib/agent/v2/tools/specialist-definitions.ts`)
- Routes via LLM tool-calling (not regex patterns)
- Returns direct responses for simple queries (FR14)

**Given** a greeting message like "Hello" or "Hi there"
**When** processed by the supervisor
**Then** it responds naturally without searching documents (FR17)
**And** no "I don't see that in documents" response (FR16)

**Given** a simple question about the system
**When** processed by the supervisor
**Then** it responds directly without unnecessary tool calls

**Pre-requisites (from Epic 1 Tech Debt):**
- `@langchain/google-vertexai` installed with `GOOGLE_VERTEX_PROJECT` and `GOOGLE_VERTEX_LOCATION` env vars
- Specialist tool stubs defined in `lib/agent/v2/tools/specialist-definitions.ts`
- Routes consolidated: `/api/projects/[id]/chat-v2` merged into `/api/projects/[id]/chat`

---

### Story 2.2: Implement Real-Time Token Streaming

As a **user**,
I want to **see the response as it's being generated**,
So that **I know the system is working and can read along**.

**Depends On:** Story 2.1 (Supervisor Node)

**Test Type:** Integration

**Acceptance Criteria:**

**Given** a user sends a message
**When** the supervisor generates a response
**Then** tokens stream in real-time via SSE (FR18)
**And** first token appears within 2 seconds (NFR1)
**And** streaming is smooth without visible buffering (NFR2)

**Given** the existing SSE event types in `lib/agent/streaming.ts`
**When** streaming occurs
**Then** events follow the discriminated union pattern with timestamps
**And** `token` events include the content being streamed
**And** `done` event includes the complete response and sources

---

### Story 2.3: Implement Context Loader Middleware

As a **developer**,
I want **deal context loaded once per thread**,
So that **the agent has relevant context without repeated loading**.

**Depends On:** Story 1.1 (Unified State Schema)

**Test Type:** Unit

**Acceptance Criteria:**

**Given** the middleware architecture
**When** I create `lib/agent/v2/middleware/context-loader.ts`
**Then** it loads deal context on first invocation of a thread
**And** stores context in `state.dealContext`
**And** skips loading on subsequent invocations (context already present)

**Given** Redis caching strategy
**When** deal context is loaded
**Then** it's cached with key `deal:{dealId}:context` and 1-hour TTL
**And** cache hits return in ~5ms

**Given** context loading failure
**When** the middleware cannot load deal context
**Then** it sets a CONTEXT_ERROR in state
**And** the agent continues with limited functionality

---

### Story 2.4: Implement Workflow Router Middleware

As a **developer**,
I want **the system prompt to adapt based on workflow mode**,
So that **the agent behaves appropriately for each context**.

**Depends On:** Story 2.3 (Context Loader Middleware)

**Test Type:** Unit

**Acceptance Criteria:**

**Given** the middleware architecture from the architecture doc
**When** I create `lib/agent/v2/middleware/workflow-router.ts`
**Then** it sets the system prompt based on `workflowMode`:
- 'chat' → general assistant prompt with deal context
- 'cim' → CIM builder workflow prompt
- (future modes have placeholder prompts)

**Given** middleware order requirements
**When** the middleware stack is assembled
**Then** workflow-router runs after context-loader
**And** before tool-selector

---

### Story 2.5: Implement Professional Response Tone

As a **user**,
I want **the agent to communicate professionally and directly**,
So that **I get clear, actionable responses**.

**Depends On:** Story 2.4 (Workflow Router Middleware)

**Test Type:** Unit

**Acceptance Criteria:**

**Given** the system prompt configuration
**When** the agent responds to any query
**Then** it uses professional, direct tone (FR45)
**And** avoids hedging phrases like "I think" or "maybe"
**And** confirms successful operations clearly (FR44)

**Given** a successful operation (e.g., search completed)
**When** the agent responds
**Then** the confirmation is clear and concise
**And** includes relevant details without verbosity

---

## Epic 3: Knowledge & Retrieval - Deal Intelligence

Users get context-aware answers about their deals with source attribution - the agent knows the deal context.

### Story 3.1: Implement Retrieval Node with Graphiti Integration

As a **user**,
I want **the agent to search my deal documents for answers**,
So that **I get accurate, sourced information**.

**Depends On:** Story 2.3 (Context Loader Middleware), Story 2.1 (Supervisor Node)

**Test Type:** Integration

**Acceptance Criteria:**

**Given** the v2 StateGraph
**When** I create `lib/agent/v2/nodes/retrieval.ts`
**Then** it integrates with existing Graphiti client
**And** searches the knowledge graph for deal-specific context (FR23)
**And** returns results with source citations

**Given** a query about deal information
**When** retrieval is invoked
**Then** appropriate search method is selected (vector, keyword, or graph) based on query (FR25)
**And** results are entity-connected and context-aware (FR26)
**And** query completes in <500ms for simple retrieval (NFR3)

---

### Story 3.2: Implement Source Attribution

As a **user**,
I want to **know where information comes from**,
So that **I can verify and trust the answers**.

**Depends On:** Story 3.1 (Retrieval Node)

**Test Type:** Unit

**Acceptance Criteria:**

**Given** a response that includes information from documents
**When** the agent responds
**Then** source citations are included (FR24)
**And** citations reference document name and location (page, section)
**And** sources are streamed via `source_added` SSE events

**Given** the SourceCitation type
**When** sources are collected
**Then** they include: documentId, documentName, location, snippet, relevanceScore

---

### Story 3.3: Implement Honest Uncertainty Handling

As a **user**,
I want **the agent to be honest when it doesn't have information**,
So that **I can take appropriate action**.

**Depends On:** Story 3.1 (Retrieval Node)

**Test Type:** Unit

**Acceptance Criteria:**

**Given** a query about information not in the knowledge graph
**When** the agent cannot find relevant data
**Then** it clearly indicates information is insufficient (FR41)
**And** never fabricates or makes up information (FR43)
**And** provides actionable next steps (FR42)

**Given** partial information available
**When** the agent responds
**Then** it provides what's available
**And** clearly indicates what's missing
**And** suggests how to obtain missing information

---

### Story 3.4: Implement Redis Caching for Retrieval

As a **developer**,
I want **retrieval results cached**,
So that **repeated queries are fast and cost-effective**.

**Depends On:** Story 3.1 (Retrieval Node)

**Test Type:** Integration

**Acceptance Criteria:**

**Given** the Redis caching strategy from architecture
**When** a knowledge graph query is executed
**Then** results are cached with key `deal:{dealId}:kg:{queryHash}` and 30-min TTL

**Given** a repeated query within TTL
**When** retrieval is invoked
**Then** cached results are returned without hitting Neo4j
**And** response time is ~5ms

**Given** cache miss
**When** retrieval is invoked
**Then** query executes against Neo4j
**And** results are cached for future use

---

## Epic 4: Specialist Agents - Expert Delegation

Users get expert-level analysis - financial modeling, research, deal analysis - by delegating to specialist agents.

### Story 4.1: Implement Tool Selector Middleware

As a **developer**,
I want **tools filtered based on workflow mode and permissions**,
So that **the supervisor only sees relevant tools**.

**Depends On:** Story 2.4 (Workflow Router Middleware)

**Test Type:** Unit

**Acceptance Criteria:**

**Given** the middleware architecture
**When** I create `lib/agent/v2/middleware/tool-selector.ts`
**Then** it filters available tools based on:
- Current `workflowMode`
- User permissions from runtime context
- Specialist availability

**Given** 'chat' mode
**When** tool selection runs
**Then** general specialist tools are available
**And** workflow-specific tools are excluded

---

### Story 4.2: Implement Specialist Tool Definitions

As a **developer**,
I want **specialists defined as tools**,
So that **the supervisor can delegate to them via tool-calling**.

**Depends On:** Story 4.1 (Tool Selector Middleware)

**Test Type:** Unit

**Acceptance Criteria:**

**Given** the supervisor-as-tools pattern from architecture
**When** I create `lib/agent/v2/tools/definitions.ts`
**Then** it defines specialist tools:
- `financial-analyst`: Deal-specific financial analysis
- `document-researcher`: Deep document search and analysis
- `kg-expert`: Knowledge graph traversal and entity queries
- `due-diligence`: Due diligence checklist and analysis

**And** each tool has:
- Clear description for LLM understanding
- Zod schema for input validation
- Kebab-case naming per architecture patterns

---

### Story 4.3: Implement Deal Analyst Specialist

As a **user**,
I want **expert deal analysis**,
So that **I get professional-quality insights about my deals**.

**Depends On:** Story 4.2 (Specialist Tool Definitions), Story 3.1 (Retrieval Node)

**Test Type:** Unit

**Acceptance Criteria:**

**Given** the specialist tool definitions
**When** I create `lib/agent/v2/nodes/specialists/deal-analyst.ts`
**Then** it provides deal-specific analysis capabilities (FR27)
**And** uses knowledge graph for context
**And** operates within its defined tool scope (FR30)

**Given** a question outside deal analyst's scope
**When** the specialist cannot answer
**Then** it hands off back to supervisor (FR31)
**And** suggests which specialist might help

---

### Story 4.4: Implement Research Specialist with Web Search

As a **user**,
I want **external research capabilities**,
So that **I can get market context and external data**.

**Depends On:** Story 4.2 (Specialist Tool Definitions)

**Test Type:** Unit

**Acceptance Criteria:**

**Given** the specialist architecture
**When** I create `lib/agent/v2/nodes/specialists/research-agent.ts`
**Then** it provides external research and web search (FR28)
**And** uses Gemini Flash with Grounding for web search
**And** returns results with source attribution

**Given** the deal analyst receives a question about market context
**When** it's outside deal analyst's scope
**Then** the supervisor routes to research specialist

---

### Story 4.5: Implement Financial Specialist

As a **user**,
I want **financial modeling capabilities**,
So that **I can get professional financial analysis**.

**Depends On:** Story 4.2 (Specialist Tool Definitions), Story 3.1 (Retrieval Node)

**Test Type:** Unit

**Acceptance Criteria:**

**Given** the specialist architecture
**When** I create `lib/agent/v2/nodes/specialists/financial-analyst.ts`
**Then** it provides financial modeling tasks (FR29)
**And** can analyze financial statements
**And** can build basic comparable company analysis

**Given** a financial modeling request
**When** the financial specialist executes
**Then** results include structured data where applicable
**And** sources are attributed

---

### Story 4.6: Implement Specialist Progress Streaming

As a **user**,
I want to **see when specialists are working**,
So that **I know the system is actively processing my request**.

**Depends On:** Story 4.3 (Deal Analyst), Story 2.2 (Token Streaming)

**Test Type:** Integration

**Acceptance Criteria:**

**Given** a specialist is invoked
**When** the specialist begins work
**Then** `specialist_start` SSE event is sent (FR48)
**And** includes which specialist is active

**Given** a specialist completes
**When** results are ready
**Then** `specialist_end` SSE event is sent
**And** includes duration and summary

**Given** the `activeSpecialist` state field
**When** a specialist is working
**Then** state reflects which specialist is active

---

### Story 4.7: Implement Summarization Middleware

As a **developer**,
I want **conversation context compressed at 70% threshold**,
So that **long conversations don't degrade response quality**.

**Depends On:** Story 1.1 (Unified State Schema), Story 4.1 (Tool Selector Middleware)

**Test Type:** Unit

**Acceptance Criteria:**

**Given** the 70% compression threshold from architecture
**When** I create `lib/agent/v2/middleware/summarization.ts`
**Then** it monitors `tokenCount` in state
**And** triggers summarization when context reaches 70% of limit

**Given** summarization is triggered
**When** compression runs
**Then** older messages are summarized using Gemini Flash
**And** summary is stored in `historySummary` field
**And** recent 10 messages are preserved
**And** important context is maintained (FR57)

---

### Story 4.8: Implement Independent Specialist Context

As a **developer**,
I want **specialists to have focused context**,
So that **they get clean prompts without conversation noise**.

**Depends On:** Story 4.3 (Deal Analyst), Story 4.7 (Summarization Middleware)

**Test Type:** Unit

**Acceptance Criteria:**

**Given** the Isolate pillar of context engineering
**When** a specialist is invoked
**Then** it receives filtered context relevant to its task (FR58)
**And** full conversation history is not passed
**And** deal context and query are provided

**Given** specialist results
**When** they're returned to supervisor
**Then** they follow the `SpecialistResult` shape:
- `answer: string`
- `sources: SourceCitation[]`
- `confidence?: number`
- `data?: unknown`

---

## Epic 5: Human-in-the-Loop - Approval Workflows

Users maintain control - they approve plans before complex tasks execute, and approve data modifications.

### Story 5.1: Implement Approval Node with Interrupt

As a **developer**,
I want **a node that pauses execution for user approval**,
So that **users can review before sensitive operations**.

**Depends On:** Story 1.2 (Base StateGraph), Story 1.3 (PostgresSaver)

**Test Type:** Unit

**Acceptance Criteria:**

**Given** the LangGraph interrupt() pattern
**When** I create `lib/agent/v2/nodes/approval.ts`
**Then** it implements HITL approval flow:
- Sets `pendingApproval` in state with request details
- Calls `interrupt()` to pause graph execution
- Returns `approval_required` SSE event

**Given** an approval is pending
**When** the graph state is checked
**Then** `pendingApproval` contains the ApprovalRequest with:
- `type`: 'plan' | 'qa_modify' | 'kb_persist'
- `description`: What needs approval
- `details`: Structured data for display

---

### Story 5.2: Implement Plan Approval for Complex Tasks

As a **user**,
I want to **review plans before complex tasks execute**,
So that **I can modify or cancel before work begins**.

**Depends On:** Story 5.1 (Approval Node), Story 2.1 (Supervisor Node)

**Test Type:** Integration

**Acceptance Criteria:**

**Given** a complex multi-step task request (FR32)
**When** the supervisor identifies a complex task
**Then** it presents a plan before execution
**And** the plan shows numbered steps
**And** user sees [Approve] [Modify] [Cancel] options (FR33)

**Given** user approves the plan
**When** approval is submitted via API
**Then** graph resumes from checkpoint
**And** executes the approved plan
**And** streams progress for each step

**Given** user rejects the plan
**When** rejection is submitted
**Then** graph resumes with rejection in state
**And** agent acknowledges and offers alternatives

---

### Story 5.3: Implement Approval API Endpoint

As a **developer**,
I want **an API to submit approval decisions**,
So that **the frontend can send user responses**.

**Depends On:** Story 5.1 (Approval Node), Story 1.5 (Chat API Route)

**Test Type:** Integration

**Acceptance Criteria:**

**Given** a pending approval in graph state
**When** `POST /api/projects/[id]/chat/approve` is called
**Then** it accepts `{ conversationId, decision: 'approve' | 'modify' | 'reject', modifications?: object }`
**And** resumes the graph with the decision

**Given** the approval endpoint
**When** called with invalid conversationId
**Then** it returns 404

**Given** the approval endpoint
**When** called without pending approval
**Then** it returns 400 with clear error

---

### Story 5.4: Implement Q&A Suggestion and Confirmation

As a **user**,
I want the **system to suggest Q&A entries when it detects information gaps**,
So that **I can quickly track questions for the client**.

**Depends On:** Story 3.1 (Retrieval Node), Story 2.1 (Supervisor Node)

**Test Type:** Integration

**Acceptance Criteria:**

**Given** a query about information not found in documents (FR34)
**When** the agent detects ambiguous or missing information
**Then** it suggests a Q&A entry with:
- Pre-filled question based on the gap detected
- Context showing what is known vs unknown
- Source document reference if applicable
**And** displays [Add to Q&A] [Skip] buttons

**Given** user clicks [Add to Q&A]
**When** the Q&A entry is created
**Then** it appears in the Q&A table
**And** includes timestamp and source attribution
**And** confirmation message is shown

**Given** user clicks [Skip]
**When** the suggestion is dismissed
**Then** no Q&A entry is created
**And** conversation continues normally

**Given** a direct Q&A instruction ("add X to Q&A")
**When** the user explicitly requests
**Then** the entry is added immediately with confirmation

---

### Story 5.5: Implement Knowledge Base Persistence Approval

As a **user**,
I want to **approve when data is saved to the knowledge base**,
So that **I control what information is persisted**.

**Depends On:** Story 5.2 (Plan Approval), Story 5.3 (Approval API), Story 3.1 (Retrieval Node)

**Test Type:** Integration

**Acceptance Criteria:**

**Given** a request to persist data to knowledge graph (FR35)
**When** the agent prepares the persistence
**Then** it requests approval before executing
**And** shows what data will be saved

**Given** user provides information in chat
**When** the agent wants to store it as a fact
**Then** it presents what will be stored
**And** waits for approval (FR36)

---

## Epic 6: CIM Builder Workflow

Users can build Confidential Information Memorandums through a guided, flexible workflow that tracks progress and allows non-linear navigation.

### Story 6.1: Implement CIM Phase Router Node

As a **user**,
I want **guided CIM creation with phase tracking**,
So that **I can systematically build a complete CIM**.

**Depends On:** Story 1.2 (Base StateGraph), Story 2.4 (Workflow Router)

**Test Type:** Unit

**Acceptance Criteria:**

**Given** workflowMode is 'cim'
**When** I create `lib/agent/v2/nodes/cim/phase-router.ts`
**Then** it routes to the appropriate CIM phase based on `cimState`
**And** tracks which phases are complete, in-progress, skipped

**Given** the CIM workflow entry
**When** a user enters CIM mode
**Then** phase progress is displayed (FR38)
**And** current phase is highlighted

---

### Story 6.2: Implement CIM State Management

As a **developer**,
I want **CIM-specific state tracked in the unified schema**,
So that **CIM progress persists across sessions**.

**Depends On:** Story 1.1 (Unified State Schema), Story 6.1 (CIM Phase Router)

**Test Type:** Unit

**Acceptance Criteria:**

**Given** the `cimState` field in AgentState
**When** CIM workflow is active
**Then** it tracks:
- Current phase
- Completed phases
- Skipped phases
- Generated slide content
- Dependencies between sections

**Given** the user closes and reopens the browser
**When** they return to CIM
**Then** their progress is restored from checkpoint

---

### Story 6.3: Implement Flexible CIM Navigation

As a **user**,
I want to **skip, reorder, or deviate from CIM phases**,
So that **I can work in the order that makes sense for me**.

**Depends On:** Story 6.2 (CIM State Management)

**Test Type:** Integration

**Acceptance Criteria:**

**Given** a CIM in progress
**When** the user asks to skip to a different section (FR37)
**Then** the agent moves to that section
**And** marks previous section as skipped
**And** displays updated progress

**Given** a skipped section
**When** the user wants to return to it (FR39)
**Then** they can navigate back at any time
**And** the section is marked as in-progress

**Given** the workflow structure (FR40)
**When** the user deviates from suggested order
**Then** the system guides but does not constrain

---

### Story 6.4: Implement CIM Slide Creation Node

As a **user**,
I want **AI-assisted slide content creation**,
So that **I can efficiently generate CIM sections**.

**Depends On:** Story 6.3 (CIM Navigation), Story 3.1 (Retrieval Node), Story 4.5 (Financial Specialist)

**Test Type:** Integration

**Acceptance Criteria:**

**Given** a CIM phase is active
**When** I create `lib/agent/v2/nodes/cim/slide-creation.ts`
**Then** it generates slide content based on:
- Phase requirements
- Deal context from knowledge graph
- User input and preferences

**Given** slide content generation
**When** the agent creates content
**Then** it uses specialists (retrieval, financial) as needed
**And** presents drafts for user review

---

### Story 6.5: Implement CIM Dependency Checking

As a **developer**,
I want **CIM dependencies validated**,
So that **phases with prerequisites are flagged appropriately**.

**Depends On:** Story 6.2 (CIM State Management)

**Test Type:** Unit

**Acceptance Criteria:**

**Given** CIM phases may have dependencies
**When** I create `lib/agent/v2/nodes/cim/dependency-check.ts`
**Then** it validates that required context exists before generating content

**Given** a phase with missing dependencies
**When** the user navigates to that phase
**Then** they're informed what's needed
**And** offered to go back or proceed anyway

---

## Epic 7: Thread Management & Conversation Search

Users can organize their conversations - create threads, rename them, archive, delete, and search across past conversations.

### Story 7.1: Implement Conversation Thread Management API

As a **user**,
I want to **manage my conversation threads**,
So that **I can organize my work**.

**Depends On:** Story 1.4 (Thread ID Generation)

**Acceptance Criteria:**

**Given** thread management requirements
**When** a user creates a new thread (FR6)
**Then** it's added to their thread list
**Test Type:** Integration

**Given** an existing thread
**When** the user renames it (FR7)
**Then** the name is updated and persisted
**Test Type:** Integration

**Given** an existing thread
**When** the user archives it (FR8)
**Then** it's moved to archived status
**Test Type:** Integration

**Given** an existing thread
**When** the user deletes it (FR9)
**Then** it's removed from their list
**And** underlying checkpoint data is cleaned up
**Test Type:** Integration

---

### Story 7.2: Implement Thread List UI

As a **user**,
I want to **see and manage my threads in the sidebar**,
So that **I can navigate between conversations easily**.

**Depends On:** Story 7.1 (Thread Management API)

**Acceptance Criteria:**

**Given** a user with multiple threads
**When** they view the chat interface
**Then** threads are listed in the sidebar with name and last message date
**Test Type:** E2E

**Given** thread actions (rename, archive, delete)
**When** the user interacts with thread menu
**Then** the action is performed and UI updates immediately
**Test Type:** E2E

---

### Story 7.3: Implement Conversation Search Backend

As a **user**,
I want to **search my past conversations**,
So that **I can find previous discussions**.

**Depends On:** Story 1.3 (PostgresSaver), Story 7.1 (Thread Management)

**Acceptance Criteria:**

**Given** search requirements
**When** a user searches by keyword (FR10)
**Then** matching conversations are returned
**Test Type:** Integration

**Given** date range search (FR11)
**When** a user specifies dates
**Then** conversations within that range are returned
**Test Type:** Integration

**Given** search results
**When** returned from API
**Then** they include relevant message excerpts with context (FR12)
**Test Type:** Unit

---

### Story 7.4: Implement Conversation Search UI

As a **user**,
I want to **search conversations from the interface**,
So that **I can quickly find past discussions**.

**Depends On:** Story 7.3 (Search Backend)

**Acceptance Criteria:**

**Given** the search interface
**When** a user enters search terms
**Then** results appear with highlighted excerpts
**Test Type:** E2E

**Given** search results
**When** a user clicks a result
**Then** they navigate to that conversation at the relevant message
**Test Type:** E2E

---

## Epic 8: Multimodal Capabilities

Users can upload images and files directly in chat for analysis.

### Story 8.1: Implement Image Upload Processing

As a **user**,
I want to **upload images in chat for analysis**,
So that **I can get insights from visual content**.

**Depends On:** Story 2.1 (Supervisor Node)

**Acceptance Criteria:**

**Given** multimodal support requirement (FR19)
**When** a user uploads an image
**Then** it's stored in GCS and reference passed to LLM
**And** analysis is provided in the response
**Test Type:** Integration

**Given** an image with data (tables, charts) (FR21)
**When** analyzed by vision-capable model
**Then** structured data can be extracted
**Test Type:** Integration

---

### Story 8.2: Implement Image-KG Cross-Reference

As a **user**,
I want **extracted image data cross-referenced with deal context**,
So that **I get enriched insights**.

**Depends On:** Story 8.1 (Image Upload), Story 3.1 (Retrieval Node)

**Acceptance Criteria:**

**Given** extracted data from an image
**When** the agent processes the analysis
**Then** it cross-references with knowledge graph (FR21)
**And** provides context-aware insights
**Test Type:** Integration

---

### Story 8.3: Implement File Reference in Conversation

As a **user**,
I want to **reference uploaded deal files in conversation**,
So that **I can ask questions about specific documents**.

**Depends On:** Story 2.1 (Supervisor Node), Story 3.1 (Retrieval Node)

**Acceptance Criteria:**

**Given** files uploaded to the deal (FR20)
**When** a user references a file by name
**Then** the agent retrieves context from that specific file
**And** answers are scoped to that document
**Test Type:** Integration

---

### Story 8.4: Implement Drag-and-Drop Upload UI

As a **user**,
I want to **drag and drop files into chat**,
So that **I can easily share content**.

**Depends On:** Story 8.1 (Image Upload Processing)

**Acceptance Criteria:**

**Given** the chat interface (FR22)
**When** a user drags a file into the chat area
**Then** it's uploaded and a preview appears
**And** the file is attached to the message
**Test Type:** E2E

---

## Epic 9: Observability & User Feedback

Users can provide feedback on responses, and system provides clear error messages with proper audit logging.

### Story 9.1: Implement LangSmith Audit Logging

As a **developer**,
I want **all LLM calls logged to LangSmith with context**,
So that **we can debug and audit agent behavior**.

**Depends On:** Story 2.1 (Supervisor Node)

**Acceptance Criteria:**

**Given** NFR9 audit logging requirement
**When** any LLM call is made
**Then** it's logged to LangSmith with:
- User ID
- Deal ID (project_id)
- Thread ID
- Workflow mode
- Specialist name (if applicable)
**Test Type:** Integration

**Given** logged traces
**When** viewed in LangSmith
**Then** they can be filtered by user/deal/thread
**Test Type:** Manual verification

---

### Story 9.2: Implement User Feedback Collection

As a **user**,
I want to **provide feedback on responses**,
So that **the system can improve over time**.

**Depends On:** Story 1.5 (Chat API Route)

**Acceptance Criteria:**

**Given** feedback requirements
**When** a user gives thumbs up/down (FR46)
**Then** the feedback is recorded with message ID
**Test Type:** Integration

**Given** feedback storage (FR47)
**When** feedback is submitted
**Then** it's stored with full message context
**And** linked to LangSmith trace for correlation
**Test Type:** Integration

---

### Story 9.3: Implement Feedback UI

As a **user**,
I want to **easily provide feedback on any response**,
So that **I can improve the system**.

**Depends On:** Story 9.2 (Feedback Collection)

**Acceptance Criteria:**

**Given** any agent response
**When** displayed in chat
**Then** thumbs up/down buttons appear on hover
**Test Type:** E2E

**Given** feedback submitted
**When** the button is clicked
**Then** visual confirmation appears
**And** user can optionally add text feedback
**Test Type:** E2E

---

### Story 9.4: Implement Error Recovery and Messaging

As a **user**,
I want **clear error messages when things go wrong**,
So that **I know what happened and what to do**.

**Depends On:** Story 1.6 (Basic Error Recovery)

**Acceptance Criteria:**

**Given** transient failures (FR52)
**When** an API timeout or network issue occurs
**Then** the system attempts retry with exponential backoff
**And** informs the user if recovery fails
**Test Type:** Unit

**Given** any error (FR53)
**When** an operation fails
**Then** the error message is clear and actionable
**And** does not expose technical details to user
**Test Type:** Unit

**Given** the AgentError structure from architecture
**When** errors occur
**Then** they use standard error codes: LLM_ERROR, TOOL_ERROR, STATE_ERROR, CONTEXT_ERROR, APPROVAL_REJECTED, STREAMING_ERROR, CACHE_ERROR
**Test Type:** Unit

---

### Story 9.5: Implement LLM Fallback Chain

As a **user**,
I want **the system to gracefully degrade if a provider fails**,
So that **I can still get responses**.

**Depends On:** Story 2.1 (Supervisor Node)

**Acceptance Criteria:**

**Given** NFR15 provider fallback requirement
**When** Claude API returns error or timeout
**Then** system automatically falls back to Gemini
**Test Type:** Integration

**Given** both Claude and Gemini fail
**When** fallback chain exhausts options
**Then** user receives clear message about service degradation
**And** basic functionality remains available
**Test Type:** Integration

---

## Epic 10: GDPR Compliance & Data Management

Users can exercise GDPR rights, and system enforces data retention policies.

### Story 10.1: Implement GDPR Message Deletion

As a **user**,
I want to **delete my own messages**,
So that **I can exercise my GDPR rights**.

**Depends On:** Story 1.3 (PostgresSaver), Story 7.1 (Thread Management)

**Acceptance Criteria:**

**Given** GDPR Article 17 requirements (FR49)
**When** a user requests message deletion
**Then** their messages are removed from checkpoint state
**And** knowledge base entries are anonymized or deleted
**Test Type:** Integration

**Given** selective deletion requirement
**When** messages are deleted
**Then** only the user's messages are removed
**And** thread integrity is maintained
**Test Type:** Integration

---

### Story 10.2: Implement Message Deletion UI

As a **user**,
I want to **delete messages from the interface**,
So that **I can manage my data**.

**Depends On:** Story 10.1 (GDPR Message Deletion)

**Acceptance Criteria:**

**Given** a user's own message
**When** they select delete from the message menu
**Then** confirmation dialog appears
**And** message is deleted upon confirmation
**Test Type:** E2E

---

### Story 10.3: Implement Deal Closure Cleanup

As a **system administrator**,
I want **automatic data cleanup on deal closure**,
So that **data retention policies are enforced**.

**Depends On:** Story 1.3 (PostgresSaver)

**Acceptance Criteria:**

**Given** deal status change to "closed" (FR50)
**When** the webhook is triggered
**Then** conversation history retention timer starts (configurable)
**And** after retention period, data is soft-deleted
**Test Type:** Integration

**Given** EU data residency requirements (FR51)
**When** data is stored
**Then** all storage is in EU data centers
**And** this is verified in infrastructure configuration
**Test Type:** Manual verification

---

## Epic 11: Smarter Answers Over Time

Users get increasingly accurate answers as the system learns from conversations - extracting facts, storing summaries, detecting corrections, and making intelligence available for future reference.

### Story 11.1: Implement Fact Extraction Pipeline

As a **user**,
I want **the system to identify and extract verified facts**,
So that **deal intelligence is captured**.

**Depends On:** Story 3.1 (Retrieval Node), Story 5.5 (KB Persistence Approval)

**Acceptance Criteria:**

**Given** conversation intelligence requirements (FR61)
**When** the agent identifies verified facts in conversation
**Then** they can be extracted to knowledge graph (with approval from Epic 5)
**Test Type:** Integration

**Given** semantic pollution concerns (FR63)
**When** facts are extracted
**Then** conversational history is kept separate from deal intelligence
**And** facts are tagged with source: 'conversation'
**Test Type:** Unit

---

### Story 11.2: Implement Conversation Summary Storage

As a **user**,
I want **conversation summaries stored for future reference**,
So that **I can quickly understand past discussions**.

**Depends On:** Story 4.7 (Summarization Middleware), Story 3.1 (Retrieval Node)

**Acceptance Criteria:**

**Given** conversation summaries (FR62)
**When** generated at natural breakpoints
**Then** they're stored as retrievable nodes linked to deal
**And** include thread ID and timestamp
**Test Type:** Integration

**Given** future conversations (FR64)
**When** extracted facts and summaries exist
**Then** they're available for retrieval
**Test Type:** Integration

---

### Story 11.3: Implement Past Conversation Reference

As a **user**,
I want **the agent to reference relevant past conversations**,
So that **context is preserved across sessions**.

**Depends On:** Story 11.2 (Summary Storage), Story 3.1 (Retrieval Node)

**Acceptance Criteria:**

**Given** past conversations in same deal (FR60)
**When** a query relates to previous discussions
**Then** relevant summaries and facts are retrieved
**And** agent references them in response with attribution
**Test Type:** Integration

---

### Story 11.4: Implement User Correction Detection

As a **user**,
I want **the system to detect when I correct it**,
So that **errors can be fixed permanently**.

**Depends On:** Story 2.1 (Supervisor Node), Story 3.1 (Retrieval Node)

**Acceptance Criteria:**

**Given** a user corrects information provided by the agent (FR65)
**When** the agent detects a correction pattern (e.g., "Actually, it's X not Y")
**Then** it acknowledges the correction
**And** offers to persist the correct information
**Test Type:** Integration

**Given** correction detection
**When** analyzing user messages
**Then** false positives are minimized through confidence scoring
**And** user always confirms before persistence
**Test Type:** Unit

---

### Story 11.5: Implement Correction Persistence with Provenance

As a **user**,
I want **my corrections saved to the knowledge graph**,
So that **the system learns from my feedback**.

**Depends On:** Story 11.4 (Correction Detection), Story 5.5 (KB Persistence Approval)

**Acceptance Criteria:**

**Given** a confirmed user correction (FR66)
**When** persisted to knowledge graph
**Then** correction includes provenance metadata:
- source: 'user_correction'
- timestamp: ISO date
- original_value: what was corrected
- user_id: who made the correction
- thread_id: conversation context
**Test Type:** Unit

**Given** corrected facts
**When** retrieved in future conversations
**Then** they supersede previous incorrect information
**And** provenance is available for audit
**Test Type:** Integration

---

### Story 11.6: Implement Correction UI

As a **user**,
I want to **see when corrections are detected and confirm persistence**,
So that **I control what the system learns**.

**Depends On:** Story 11.4 (Correction Detection), Story 11.5 (Correction Persistence)

**Acceptance Criteria:**

**Given** a detected correction
**When** displayed in chat
**Then** a confirmation card appears showing:
- Original value
- Corrected value
- [Persist] [Dismiss] buttons
**Test Type:** E2E

**Given** user clicks Persist
**When** the action completes
**Then** confirmation message appears
**And** correction is saved with approval flow
**Test Type:** E2E
