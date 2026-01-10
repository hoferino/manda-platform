---
stepsCompleted: [1, 2]
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
- FR34: System requests approval before modifying Q&A list entries
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

**Conversation Intelligence (FR60-FR64)**
- FR60: System can reference relevant information from past conversations in the same deal
- FR61: System extracts verified deal facts from conversations and stores in knowledge graph
- FR62: System stores conversation summaries as retrievable nodes linked to deal context
- FR63: System maintains separation between conversational history and deal intelligence
- FR64: Extracted facts and summaries are available for retrieval in future conversations

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
- Thread ID pattern: `{workflowMode}-{dealId}-{userId}-{conversationId}`

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

{{requirements_coverage_map}}

## Epic List

{{epics_list}}
