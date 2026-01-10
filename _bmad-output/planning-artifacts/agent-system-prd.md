---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
inputDocuments:
  - docs/manda-prd.md
  - docs/manda-architecture.md
  - docs/agent-behavior-spec.md
  - docs/langgraph-reference.md
  - manda-app/lib/agent/orchestrator/router.ts
  - manda-app/lib/agent/orchestrator/graph.ts
  - manda-app/lib/agent/checkpointer.ts
  - manda-app/lib/cache/redis-cache.ts
workflowType: 'prd'
lastStep: 1
documentCounts:
  briefs: 0
  research: 1
  projectDocs: 4
  codeFiles: 4
---

# Product Requirements Document - Agent System v2.0

**Author:** Max
**Date:** 2026-01-09
**Status:** Complete - Ready for Implementation
**Architecture:** See [agent-system-architecture.md](agent-system-architecture.md) for implementation decisions

---

## Executive Summary

The Agent System v2.0 replaces the current broken chat orchestrator with a production-grade conversational AI that maintains context across sessions, intelligently handles requests via tool-calling (not regex routing), and leverages the existing knowledge graph infrastructure for context-aware responses.

The current system fails because it treats every interaction as a document search and has no memory. Users expect GPT/Claude-level natural conversation with domain intelligence.

**Product Type:** B2B SaaS Platform (Enterprise) - Major Feature Enhancement
**Technical Complexity:** High (LangGraph, multi-agent, knowledge graph integration)

---

## Problem Statement

The existing chat orchestrator has fundamental architectural problems that make it unusable:

1. **No Conversation Memory** - Each request creates a fresh graph; `chatHistory: []` in all outputs
2. **Broken Routing** - Regex-based router routes almost everything to retrieval path
3. **Hardcoded Fallback** - Returns "I don't see that in documents" for ANY query including greetings
4. **No Multimodal** - Cannot process images or uploaded files in chat
5. **Fake Streaming** - Analysis path doesn't actually stream tokens

**Evidence from LangSmith:**
- Input: "what was the first question i asked?"
- chatHistory: [] (empty - no memory)
- selectedPath: "retrieval" (wrong routing)
- Response: "I don't see that information in the uploaded documents..."

---

## Success Criteria

### User Success

**Natural Conversation:**
- Users can have back-and-forth dialogue like ChatGPT/Claude
- Greetings get friendly responses, not document search errors
- Follow-up questions reference previous context seamlessly

**Memory That Works:**
- "What was my first question?" returns the actual first question
- Conversation history persists across browser refreshes
- Context maintained within a session (thread-scoped)

**Intelligent Responses:**
- Agent routes requests via tool-calling, not regex failures
- Knowledge graph provides context-aware, entity-connected answers
- Multimodal input supported (images, files analyzed inline)

**Honest Uncertainty:**
- Agent flags when information is insufficient rather than fabricating
- Partial completions clearly indicate what's done vs what's missing
- No more "I don't see that in documents" for non-document questions

### Business Success

**3-Month Targets (MVP):**
- Chat completion rate > 80% (useful answers vs abandoned)
- Average conversation length > 3 turns (actual dialogue)
- Zero generic fallback responses for general questions
- Routing accuracy > 95% (correct path selection)

**12-Month Targets:**
- Knowledge graph responses outperform baseline RAG by 30%
- Supervisor agent handles complex multi-step analysis
- User satisfaction matches GPT-4/Claude baseline

### Technical Success

| Metric | Target | Current State |
|--------|--------|---------------|
| Conversation memory | 100% persistence | 0% (lost every request) |
| Routing accuracy | >95% correct path | ~20% (regex broken) |
| First token latency | <2s | Unknown |
| Checkpoint backend | PostgresSaver | MemorySaver (volatile) |
| Multimodal support | Images + files | None |
| Knowledge graph hit rate | >80% for deal queries | Underutilized |

---

## Product Scope

### MVP - Minimum Viable Product

| Feature | Description | Priority |
|---------|-------------|----------|
| Memory Persistence | PostgresSaver connected to chat graph | P0 |
| Unified Agent Architecture | Single supervisor with tool-calling (no separate router) | P0 |
| Remove Q&A Fallback | No hardcoded "add to Q&A list" response | P0 |
| Real Streaming | Actual token streaming | P0 |
| Multimodal Input | Images, file uploads in chat | P0 |
| Specialist Agents as Tools | Deal analyst, research, financial as callable tools | P0 |
| Knowledge Graph Integration | Entity-aware, context-rich responses | P0 |
| Human-in-the-Loop | Approval for data modifications, plan presentation | P0 |

### Agent Architecture

**Single StateGraph + Middleware Architecture:**

The main agent handles both conversation AND routing via tool selection, using a single LangGraph StateGraph with middleware for context engineering. This follows the LangGraph supervisor pattern where "the supervisor is an agent whose tools are other agents."

```
User Input
    ↓
Middleware Stack (context-loader → workflow-router → tool-selector → summarization)
    ↓
Single StateGraph
    │
    ├─→ workflowMode: 'chat' → supervisor node
    ├─→ workflowMode: 'cim' → cim/phase-router node
    └─→ [future: 'irl']
```

**Why Single Graph + Middleware (not regex router or dual graphs):**
- LLM handles routing via tool-calling (not regex patterns)
- Single graph shared across workflows (no code duplication)
- Middleware handles context engineering (Write/Select/Compress/Isolate)
- Conditional entry points by workflowMode enable workflow-specific routing
- Enterprise pattern per LangGraph documentation

**Architecture Reference:** See `_bmad-output/planning-artifacts/agent-system-architecture.md` for full implementation details.

**Agent Specializations:**

| Agent | Model | Tools | Role |
|-------|-------|-------|------|
| Main Supervisor | Claude Sonnet | All specialist tools | Conversation + orchestration |
| Deal Analyst | Claude Sonnet | KG search, financials, docs | Deal-specific analysis |
| Research | Gemini Flash + Grounding | Web search, market data | External research |
| Financial | Claude/GPT-4 | Modeling tools | Financial analysis |
| Q&A Manager | Claude Sonnet | Q&A CRUD, gap detection | Track client questions |

### Human-in-the-Loop (MVP Scope)

**Approval Required For:**
- Q&A list additions (system suggests, user confirms with one click)
- Multi-step task plans before execution
- Any data persistence operations

**Approval UX:**
- Inline chat buttons: [Approve] [Edit] [Reject]
- Plan presentation with [Approve Plan] [Modify] [Cancel]
- Uses LangGraph `interrupt()` pattern for blocking approval

**Approval Language:**
- Wording controlled via system prompt, not hardcoded
- Professional, direct tone (no hedging phrases)
- Configurable for tone/formality preferences

**Capability Awareness:**
- Each agent knows its own tools via system prompt
- Agents hand off tasks outside their scope to specialists
- No global "cannot do" restrictions - capabilities distributed across agent network
- Research agent HAS web search; deal analyst does NOT (routes to research)

**Behavior Principles:**
- Never fabricate missing information
- Never assume critical parameters
- Present plan before complex execution
- Complete partial work, report gaps with actionable next steps
- Next steps limited to available tool capabilities

### Context Engineering Strategy

Per LangChain best practices, the agent system implements a four-pillar context engineering approach:

| Strategy | Implementation | Purpose |
|----------|----------------|---------|
| **Write** | Scratchpad in state, Store for long-term | Agent notes, extracted facts |
| **Select** | Context loader middleware, Graphiti on-demand | Load once, retrieve as needed |
| **Compress** | Summarization at 70% threshold | Prevent context overflow and hallucination |
| **Isolate** | Specialists get filtered context via ToolRuntime | Clean, focused prompts |

**Why 70% Compression Threshold:**
- M&A analysis requires precision - earlier compression maintains quality
- Models degrade as context fills (not just at 100%)
- Claude Code uses 95% for coding; we need higher quality for financial analysis

### Migration Strategy

The architecture includes a 4-phase migration strategy to replace the broken orchestrator:

1. **Phase 1: Parallel Development** - Build in `lib/agent/v2/` alongside existing code
2. **Phase 2: Validation** - Regression testing, semantic comparison
3. **Phase 3: Cutover** - Swap v2 to main location
4. **Phase 4: Cleanup** - Remove legacy code after stable production

See architecture document for detailed sunset plan and file-by-file disposition.

### Post-MVP (Growth)

| Feature | Description |
|---------|-------------|
| Semantic Memory | User preferences across sessions |
| Episodic Memory | Learning from past interactions |
| Configurable Approval Rules | User-defined gates |

### Vision (Future)

| Feature | Description |
|---------|-------------|
| Cross-Deal Learning | Pattern recognition across deals |
| Procedural Memory | Self-refining agent behaviors |

---

## Goals & Success Metrics

*Consolidated into Success Criteria section above*

---

## User Journeys

### Journey 1: Sarah Chen - Multi-Turn Analysis Session

Sarah is a second-year associate at a PE firm evaluating a manufacturing target. She's been assigned to do preliminary due diligence and has uploaded the CIM, financial statements, and management presentation to the deal room.

She opens the chat and types: "What's the revenue growth story for this company?"

The agent searches the knowledge graph, finds the revenue data across multiple documents, and responds with a clear breakdown: historical revenue by segment, growth rates, and notes about one-time items. Sarah follows up: "How does that compare to the industry?" The agent hands off to the research specialist, which searches for industry benchmarks and returns context on whether growth is sustainable.

Sarah then asks: "What did I ask you first today?" The agent immediately responds with her opening question about revenue growth. She smiles - finally, a system that remembers.

Over the next hour, Sarah has a back-and-forth conversation, drilling into margin trends, customer concentration, and capex requirements. Each question builds on the last. When she asks about something not in the documents, the agent clearly states what's missing and offers actionable next steps.

**Capabilities revealed:** Memory persistence, knowledge graph search, research agent handoff, honest uncertainty handling, context across session

---

### Journey 2: Marcus Webb - Complex Analysis with Plan Approval

Marcus is a senior associate who needs to build a preliminary valuation for an investment committee meeting. He types: "Build me a comparable company analysis for this target."

The agent recognizes this as a complex multi-step task and presents a plan:

1. Extract target company metrics from uploaded financials
2. Search for comparable public companies in the same industry
3. Pull current trading multiples for the comp set
4. Calculate implied valuation range

[Approve Plan] [Modify] [Cancel]

Marcus approves. The agent executes step by step, streaming progress. When it finishes, it presents a comp table with the target's implied valuation range.

Marcus then asks: "Add Acme Corp to the comp set." The agent makes the modification and confirms - no approval needed for this direct instruction since the original plan was already approved.

**Capabilities revealed:** Plan approval for complex tasks, financial agent, streaming progress, direct execution for clear instructions

---

### Journey 3: Priya Sharma - Quick Document Question

Priya is an analyst who needs a specific data point for a model. She asks: "What's the target's EBITDA margin for 2024?"

The agent searches the knowledge graph (vector search, not full traversal) and responds within seconds: "Based on the management presentation (slide 12), the 2024 EBITDA margin is 18.3%, up from 16.7% in 2023. The CIM (page 34) provides additional context: margin expansion was driven by operational improvements."

Total interaction: 45 seconds.

**Capabilities revealed:** Fast knowledge graph retrieval (vector + hybrid), source attribution, contextual insights

---

### Journey 4: Alex Torres - Multimodal Analysis

Alex receives a screenshot of a competitor's pricing table. He drags the image into the chat and asks: "How does this compare to our target?"

The agent analyzes the image, extracts the pricing data, then searches the knowledge graph for the target's pricing. It responds with a comparison table and analysis of competitive positioning.

**Capabilities revealed:** Image analysis, cross-reference with knowledge graph, comparative analysis

---

### Journey 5: Jordan Kim - Proactive Q&A Detection

Jordan is analyzing revenue trends for a sell-side deal. She asks: "What caused the revenue decline in Q2 2023?"

The agent searches the knowledge graph but finds no explanation. It responds:

"The documents show a 15% revenue decline in Q2 2023 (CIM page 18) but don't explain the cause.

**Suggested Q&A for Client:**
- Q: What caused the revenue decline in Q2 2023?
- Context: CIM shows 15% YoY decline but no explanation provided

[Add to Q&A] [Skip]"

Jordan clicks [Add to Q&A]. The question appears in her Q&A table, ready to send to the client.

Later, after a client call, Jordan shares: "The CFO said the Q2 decline was a one-time inventory write-off."

The agent responds: "Got it. I've added this to the knowledge base: Q2 2023 revenue decline attributed to one-time inventory write-off (source: CFO call, user-provided). This will be used for future analysis."

**Capabilities revealed:** Proactive gap detection, Q&A suggestion with one-click confirmation, knowledge base updates from conversation

---

### Journey 6: CIM Workflow - Flexible Structure

A user enters the CIM section to work through analysis. The CIM workflow provides structure but allows deviation:

User: "I want to skip market overview and go straight to financials."

Agent: "Moving to Financial Analysis. You can return to Market Overview anytime.
       ✓ Executive Summary (complete)
       ○ Market Overview (skipped)
       → Financial Analysis (current)
       ○ Risk Factors"

The structured workflow guides but doesn't constrain.

**Capabilities revealed:** Flexible workflow navigation, progress tracking, non-rigid structure

---

### Interaction Patterns Summary

| Scenario | Agent Behavior |
|----------|----------------|
| Simple query ("what is the EBITDA?") | Search + respond (no approval) |
| Complex multi-step task ("build comp analysis") | Present plan → approval → execute |
| User provides new information | Add to knowledge base + confirm |
| Ambiguous request | Clarify with options |
| Gap detected (missing info in docs) | Suggest Q&A entry → [Add to Q&A] / [Skip] |
| Direct Q&A instruction ("add X to Q&A") | Execute + confirm |

**Key Principles:**
- Direct instructions execute immediately with confirmation
- Complex tasks require plan approval
- Simple queries just get answered
- New information persists to knowledge base
- Neo4j supports both vector search and graph traversal (use appropriate method)

---

## Domain-Specific Requirements

### GDPR Compliance

**Data Retention:**
- Conversation history retained until deal closure
- Automatic deletion triggered by deal status change to "closed"
- User can request early deletion of their own messages

**Right to Erasure (Article 17):**
- Scope: User's messages only (not entire thread)
- Checkpoint state must support selective message deletion
- Knowledge base entries: remove user attribution or delete

**Data Residency:**
- All persistent data stored in EU data centers
- PostgreSQL, Neo4j, Redis: EU regions required
- LLM API calls: Verify DPA and data processing locations

**Implementation Requirements:**
- Add `user_id` tracking to conversation messages
- Implement selective message deletion from checkpoints
- Deal closure webhook triggers data retention cleanup
- Verify EU endpoints for all external services (Supabase, Neo4j, Upstash, LangSmith)
- Ensure LLM provider DPAs cover EU data processing

---

## Innovation & Novel Patterns

### Detected Innovation Areas

**Workflow-Guided Intelligence vs. Unstructured Chat**

The core innovation is not in the underlying technology (LangGraph supervisor, checkpointing, and knowledge graphs are established patterns) but in how these capabilities are orchestrated to guide users through complex M&A workflows.

Most AI chat products operate on a "dump and hope" model - users upload documents, ask questions, and the LLM attempts to provide useful responses. This fails for M&A due diligence because:

- Users often don't know what questions to ask
- Critical analysis steps get skipped without guidance
- Output quality varies wildly based on user prompt quality
- No structured validation of completeness or accuracy

**The Manda Differentiation:**

The agent system embeds workflow intelligence that guides users toward comprehensive outcomes while remaining flexible enough to accommodate expertise and deviation:

| Approach | Traditional AI Chat | Manda Workflow Intelligence |
|----------|--------------------|-----------------------------|
| User experience | Open-ended chat | Guided but flexible workflow |
| Analysis coverage | Depends on user questions | Structured checklist ensures completeness |
| Quality consistency | Varies by prompt quality | Consistent through workflow guardrails |
| Expertise required | High - must know what to ask | Lower - system guides the process |
| Flexibility | Fully open | Structured with escape hatches |

### Validation Approach

**Hypothesis:** Workflow-guided analysis produces more comprehensive, consistent outcomes than unstructured chat.

**Validation Metrics:**
- Coverage completeness: % of standard due diligence areas addressed
- Time to first useful output: Guided vs unguided user cohorts
- Output consistency: Variance in analysis quality across users
- User satisfaction: Task completion confidence scores

### Risk Mitigation

**Risk:** Workflows feel rigid and frustrate experienced users
**Mitigation:** Flexible workflow design (as demonstrated in CIM Builder) - structure guides but doesn't constrain. Users can skip, reorder, or deviate at any point.

**Risk:** Workflow complexity adds latency
**Mitigation:** Lightweight workflow state management; workflows are conversation patterns, not heavy orchestration overhead.

---

## B2B SaaS Specific Requirements

### Multi-Tenancy Architecture

The agent system operates within the existing multi-tenant infrastructure:

| Scope | Isolation Mechanism |
|-------|---------------------|
| Conversations | `project_id` (deal) scoping |
| Thread IDs | Pattern: `cim-{dealId}-{cimId}`, `supervisor-{dealId}-{ts}` |
| Database | RLS policies enforce tenant isolation |
| Knowledge Graph | `group_id` namespacing in Neo4j |
| Caching | Redis keys prefixed with tenant context |

**Agent Thread Isolation:**
- Each conversation thread is scoped to a single deal
- Checkpoints stored with deal context
- Cross-deal data access prevented by design
- User context passed to tools for permission enforcement

### Permission Model (RBAC)

Agent operations respect existing platform roles:

| Role | Agent Capabilities |
|------|-------------------|
| Analyst | Query, view analysis results |
| Associate | Query, execute approved modifications |
| Director | Query, approve plans, modify knowledge base |
| Admin | Full agent capabilities, configuration access |

**Permission Enforcement:**
- Agent inherits user's session context
- Tool operations validated against user permissions
- Q&A list modifications require appropriate role
- Knowledge base updates respect access controls

### Integration Requirements

**Internal Integrations (Required):**

| System | Integration Type | Purpose |
|--------|-----------------|---------|
| Graphiti + Neo4j | Direct API | Knowledge graph queries, entity resolution |
| PostgreSQL | LangGraph Checkpointer | Conversation persistence, state management |
| Upstash Redis | Cache layer | Tool results, retrieval caching |
| LangSmith | SDK | Tracing, observability, debugging |
| GCS | Storage API | Document access for context |

**LLM Provider Integrations:**

| Provider | Model | Use Case |
|----------|-------|----------|
| Anthropic | Claude Sonnet | Main supervisor, deal analyst |
| Google | Gemini Flash + Grounding | Research agent (web search) |
| OpenAI | GPT-4 | Financial modeling (optional) |

**External Integration Points:**
- Webhook endpoints for deal status changes (GDPR cleanup trigger)
- Document processing pipeline integration (findings to knowledge graph)

### Technical Architecture

**Existing Infrastructure to Leverage:**

1. **PostgresSaver** (`lib/agent/checkpointer.ts`) - Ready but not connected
2. **RedisCache** (`lib/cache/redis-cache.ts`) - Ready with Upstash
3. **Graphiti Client** - Ready for knowledge graph operations
4. **LangSmith** - Already configured for tracing

**New Components Required:**

1. **Unified Supervisor Agent** - Replace router + graph architecture
2. **Specialist Agent Tools** - Wrap existing specialists as callable tools
3. **Human-in-the-Loop Handler** - interrupt() pattern implementation
4. **Multimodal Message Handler** - Image/file processing in chat

### Compliance Requirements

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| GDPR | Documented (Domain section) | EU data centers, selective deletion |
| SOC 2 | Inherited | Platform-level compliance |
| Data Residency | Required | EU endpoints for all services |
| Audit Logging | Required | LangSmith traces + custom events |

---

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Platform MVP - Build the foundation that enables natural conversation with domain intelligence

**Rationale:** The current system is fundamentally broken. MVP must deliver working conversation (memory, routing, streaming) while leveraging existing infrastructure (PostgresSaver, Redis, Graphiti).

**Resource Requirements:**
- 1-2 engineers familiar with LangGraph
- Access to existing infrastructure (already ready)
- LLM API keys (Anthropic, Google, OpenAI)

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
1. Multi-turn analysis (Journey 1 - Sarah)
2. Complex tasks with plan approval (Journey 2 - Marcus)
3. Quick document queries (Journey 3 - Priya)
4. Multimodal analysis (Journey 4 - Alex)
5. Knowledge base updates (Journey 5 - Jordan)
6. Flexible workflow (Journey 6 - CIM)

**Must-Have Capabilities:**

| Capability | Justification |
|------------|---------------|
| Memory Persistence | Without this, no conversation is possible |
| Unified Supervisor | LLM routing replaces broken regex router |
| Real Streaming | Core UX expectation |
| Multimodal Input | Required for deal team workflows |
| Specialist Agents | Deal analyst, research, financial as tools |
| Knowledge Graph | Leverage existing Graphiti investment |
| Human-in-the-Loop | Required for data modification approval |

**What's NOT in MVP:**
- Semantic memory (user preferences across sessions)
- Episodic memory (learning from past interactions)
- Cross-deal learning
- Self-refining agent behaviors

### Post-MVP Features

**Phase 2 (Growth):**

| Feature | Description |
|---------|-------------|
| Semantic Memory | User preferences persist across sessions |
| Episodic Memory | System learns from successful past interactions |
| Configurable Approval Rules | Users define their own approval gates |
| Enhanced Workflow Templates | More pre-built workflow patterns |

**Phase 3 (Expansion):**

| Feature | Description |
|---------|-------------|
| Cross-Deal Learning | Pattern recognition across deals in organization |
| Procedural Memory | Self-refining agent behaviors based on outcomes |
| Custom Agent Training | Organization-specific agent specializations |

### Risk Mitigation Strategy

**Technical Risks:**

| Risk | Mitigation |
|------|------------|
| LangGraph complexity | Comprehensive reference doc created; PostgresSaver already tested |
| Multi-agent coordination | Start with supervisor-as-tools pattern (simpler than subgraphs) |
| Knowledge graph performance | Redis caching layer already ready |

**Market Risks:**

| Risk | Mitigation |
|------|------------|
| Users expect GPT-level quality | Use Claude Sonnet for supervisor; benchmark against GPT-4 |
| Workflow feels rigid | Flexible workflow design - skip, reorder, deviate allowed |

**Resource Risks:**

| Risk | Mitigation |
|------|------------|
| Limited engineering capacity | All infrastructure already exists; MVP is primarily integration |
| LLM costs at scale | Redis caching for retrieval; prompt caching via static system prompts |

---

## Functional Requirements

### Conversation & Memory

- FR1: Users can have multi-turn conversations that maintain context across messages
- FR2: System remembers conversation history within a thread (users can reference earlier messages)
- FR3: Users can close browser/device and return to find conversation intact (like ChatGPT)
- FR4: System persists all conversation state durably across sessions
- FR5: Each conversation thread is scoped to a single deal (project_id isolation)
- FR6: Users can start new conversation threads within the same deal
- FR7: Users can rename conversation threads
- FR8: Users can archive conversation threads
- FR9: Users can delete conversation threads

### Conversation Search

- FR10: Users can search across past conversations within a deal by keyword
- FR11: Users can search conversations by date range
- FR12: Search results show relevant message excerpts with context

### Message Routing & Processing

- FR13: System intelligently routes requests to appropriate handlers without hardcoded patterns
- FR14: Users receive direct responses for simple queries without unnecessary processing
- FR15: System delegates specialized tasks to appropriate specialist agents
- FR16: Users never receive generic fallback responses for non-document questions
- FR17: System handles greetings and casual conversation with natural LLM responses
- FR18: System supports real-time token streaming for all response types

### Multimodal Capabilities

- FR19: Users can upload images in chat for analysis
- FR20: Users can reference uploaded files in conversation
- FR21: System can extract data from images and cross-reference with knowledge graph
- FR22: Users can drag-and-drop files directly into the chat interface

### Knowledge Graph Integration

- FR23: System searches knowledge graph for deal-specific context when relevant
- FR24: System provides source attribution for knowledge graph responses
- FR25: System selects appropriate search method (vector, keyword, or graph traversal) based on query characteristics
- FR26: Users receive entity-connected, context-aware responses for deal questions

### Specialist Agent Delegation

- FR27: System can delegate to deal analyst agent for deal-specific analysis
- FR28: System can delegate to research agent for external research and web search
- FR29: System can delegate to financial agent for financial modeling tasks
- FR30: Specialist agents operate within their defined tool scope
- FR31: Specialist agents hand off tasks outside their scope back to supervisor

### Human-in-the-Loop

- FR32: System presents plans for approval before executing complex multi-step tasks
- FR33: Users can approve, modify, or reject proposed plans
- FR34: System suggests Q&A entries when detecting information gaps; user confirms with one click
- FR35: System requests approval before persisting data to knowledge base
- FR36: System pauses execution pending user approval for data modifications

### Workflow Support

- FR37: System supports flexible workflow navigation (skip, reorder, deviate)
- FR38: System tracks workflow progress and displays completion status
- FR39: Users can return to skipped workflow sections at any time
- FR40: Workflow structure guides but does not constrain user actions

### User Feedback & Transparency

- FR41: System clearly indicates when information is insufficient or missing
- FR42: System provides actionable next steps when unable to complete a request
- FR43: System never fabricates information when data is unavailable
- FR44: System confirms successful operations with clear status messages
- FR45: System uses professional, direct tone consistent with standard LLM behavior
- FR46: Users can provide thumbs up/down feedback on responses
- FR47: System stores feedback as training data for future model fine-tuning
- FR48: System streams thinking/progress indicators when specialist agents are working

### Data Management

- FR49: Users can request deletion of their own messages (GDPR Article 17)
- FR50: System triggers automatic data cleanup when deal status changes to closed
- FR51: All conversation data stored in EU data centers

### Error Handling & Recovery

- FR52: System recovers gracefully from transient failures (API timeouts, network issues)
- FR53: System provides clear error messages when operations fail
- FR54: System can resume from last checkpoint after unexpected interruption
- FR55: Failed operations are logged for debugging and do not corrupt conversation state

### Context Window Management

- FR56: System maintains full conversation history in storage while sending trimmed context to LLM
- FR57: System preserves important context when trimming messages (via summaries or key facts)
- FR58: Specialist agents have independent context windows appropriate to their tasks
- FR59: System generates conversation summaries at natural breakpoints

### Conversation Intelligence

- FR60: System can reference relevant information from past conversations in the same deal
- FR61: System extracts verified deal facts from conversations and stores in knowledge graph
- FR62: System stores conversation summaries as retrievable nodes linked to deal context
- FR63: System maintains separation between conversational history and deal intelligence (prevents semantic pollution)
- FR64: Extracted facts and summaries are available for retrieval in future conversations
- FR65: System detects user corrections and offers to persist them to knowledge graph
- FR66: Corrections include provenance metadata (source: user_correction, timestamp, original_value)

### Q&A Management (Sell-Side)

- FR67: System detects ambiguous or missing information during conversation analysis
- FR68: System proactively suggests adding detected gaps to the Q&A list for client follow-up
- FR69: Q&A suggestions include relevant context (source document, what's known vs unknown)
- FR70: Users can add Q&A entries with one click from suggestions ([Add to Q&A] button)
- FR71: Q&A list is accessible as a table view separate from chat
- FR72: Users can mark Q&A entries as answered, edit, or delete them
- FR73: Q&A entries include source attribution and creation timestamp

---

## Non-Functional Requirements

### Performance

| Metric | Target | Rationale |
|--------|--------|-----------|
| First Token Latency | < 2 seconds | Users expect responsive chat experience |
| Token Streaming | Smooth, no visible buffering | Standard LLM UX expectation |
| Knowledge Graph Query | < 500ms for simple retrieval | Fast context injection |
| Complex Task Feedback | Immediate thinking indicator | User knows system is working |
| Concurrent Users | No artificial limit per deal | Team collaboration supported |

### Security & Data Handling

| Requirement | Specification |
|-------------|---------------|
| Data Classification | All deal data treated as confidential |
| Data Residency | EU data centers for all persistent storage |
| LLM Provider | GCP Vertex AI (EU region) for enterprise data handling |
| Audit Logging | All agent operations logged via LangSmith with user/deal context |
| Encryption | Data encrypted at rest and in transit |

**LLM Provider Strategy - Vertex AI:**

All LLM access via GCP Vertex AI for enterprise benefits:
- Single GCP enterprise agreement covers data handling
- EU data residency via `europe-west1` or `europe-west4` regions
- Prompt caching (1-hour TTL) for cost optimization
- Service account authentication (no API keys in code)

| Model | Role | Availability |
|-------|------|--------------|
| Claude Sonnet 3.5/3.7 | Primary supervisor, deal analyst | GA/Preview |
| Claude Haiku 3.5 | Fast, cost-effective tasks | GA |
| Gemini 2.0 Flash | Research agent, multimodal | GA |

### Reliability

| Metric | Target | Rationale |
|--------|--------|-----------|
| Uptime | 99.9% availability | Enterprise SLA expectation |
| Data Durability | Zero data loss for conversation state | Core product promise |
| Checkpoint Integrity | All state changes persisted before acknowledgment | Resumability guarantee |
| Graceful Degradation | Specialist failures don't crash conversation | User can continue with reduced capability |

### Integration Resilience

| Component | Failure Handling |
|-----------|-----------------|
| LLM Provider Outage | Automatic fallback within Vertex AI (Claude → Gemini) |
| Neo4j (Self-Hosted) | Internal management; standard HA practices |
| Redis Cache Miss | Graceful fallback to source (no error to user) |
| LangSmith Unavailable | Non-blocking; continue without tracing |

**Provider Fallback Chain (all via Vertex AI EU):**
1. Primary: Claude Sonnet
2. Secondary: Gemini Flash
3. Degraded: Basic responses without specialist delegation

---

## Technical Constraints

*To be completed in discovery phase*

---

## Dependencies

*To be completed in discovery phase*

---

## Risks & Mitigations

*To be completed in discovery phase*

---

## Appendix: Research Findings

### Current System Analysis

The existing chat orchestrator has fundamental architectural problems:

1. **No Conversation Memory**: Each request creates a fresh graph without checkpointing
2. **Broken Routing**: Regex-based router routes almost everything to retrieval path
3. **Hardcoded Fallback**: Retrieval path always offers Q&A when no context found
4. **No Multimodal**: Cannot process images or uploaded files in chat
5. **Fake Streaming**: Analysis path doesn't actually stream tokens

### LangSmith Trace Evidence

```json
{
  "message": "what was the first question i asked?",
  "chatHistory": [],
  "selectedPath": "retrieval",
  "response": "I don't see that information in the uploaded documents..."
}
```

### Available Infrastructure

| Component | Status | Notes |
|-----------|--------|-------|
| PostgreSQL Checkpointer | Ready | `lib/agent/checkpointer.ts` - not connected to chat |
| Redis Cache | Ready | `lib/cache/redis-cache.ts` - Upstash integration |
| Graphiti + Neo4j | Ready | Knowledge graph with hybrid search |
| LangSmith | Ready | Tracing and observability |

### Reference Documentation

See [docs/langgraph-reference.md](../docs/langgraph-reference.md) for comprehensive LangGraph patterns.
