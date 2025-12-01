# Epic Technical Specification: Conversational Assistant

Date: 2025-12-01
Author: Max
Epic ID: E5
Status: Draft

---

## Overview

Epic 5 implements the **Conversational Assistant** - the primary user-facing interface for querying the M&A knowledge base through natural language. This is a core P0 epic that enables analysts to interact with deal intelligence via a chat interface powered by Claude Sonnet 4.5 (or configurable LLM) using LangChain's tool-calling agent framework.

**Core Capability:** Users ask questions in natural language, and the agent dynamically selects from **11 specialized chat tools** to query the knowledge base, detect contradictions, identify gaps, capture findings collaboratively, and provide source-attributed answers in real-time.

**Key Innovation:** The conversational agent acts as the "interface layer" to the deep, continuous background analysis built in Epics 2-4. Rather than users navigating complex dashboards, they simply ask questions and get intelligent, context-aware responses with full source attribution.

**Stories (9 total):**
| Story | Title | Description |
|-------|-------|-------------|
| E5.1 | Integrate LLM via LangChain | Model-agnostic LLM integration with Pydantic structured outputs |
| E5.2 | Implement LangChain Agent with 11 Chat Tools | Tool-calling agent with knowledge, document, workflow, and intelligence tools |
| E5.3 | Build Chat Interface with Conversation History | UI with streaming responses, history sidebar, new conversation creation |
| E5.4 | Implement Source Citation Display | Clickable source citations linking to document viewer |
| E5.5 | Quick Actions and Suggested Follow-ups | Common action buttons and contextual follow-up suggestions |
| E5.6 | Conversation Context and Multi-turn Support | Context persistence across turns and sessions |
| E5.7 | Confidence Indicators and Uncertainty Handling | Visual confidence badges with reasoning tooltips |
| E5.8 | Chat Export Functionality | Export conversations to Markdown, PDF, Word |
| E5.9 | Document Upload via Chat Interface | Drag-and-drop document uploads with processing status |

**Prerequisites (All Complete):** Agent behavior specification (P1-P4, P7-P8) documented in [agent-behavior-spec.md](../agent-behavior-spec.md) covering hybrid search architecture, response formatting, use case behaviors, multi-turn context, test strategy, and correction chain detection.

## Objectives and Scope

### Primary Objectives

1. **Natural Language Knowledge Access:** Enable M&A analysts to query deal intelligence using conversational language instead of navigating complex UIs
2. **Real-Time Tool Invocation:** Implement dynamic tool selection where the LLM decides which of 11 tools to call based on user intent
3. **Source-Attributed Responses:** Every factual claim includes clickable source citations linking to exact document locations
4. **Collaborative Finding Capture:** Allow analysts to capture and validate findings directly through chat conversation
5. **Multi-Turn Context:** Maintain conversation context across multiple exchanges and sessions

### Functional Scope (In Scope)

| Category | Capabilities |
|----------|-------------|
| **Chat Interface** | Streaming responses, conversation history, new conversation creation, message display |
| **11 Chat Tools** | query_knowledge_base, update_knowledge_base, update_knowledge_graph, validate_finding, get_document_info, trigger_analysis, create_irl, suggest_questions, add_to_qa, detect_contradictions, find_gaps |
| **Source Attribution** | Inline citations, clickable links to document viewer, location highlighting |
| **Quick Actions** | Generate Q&A, Find Contradictions, Summarize, Create CIM buttons |
| **Follow-up Suggestions** | LLM-generated contextual follow-up questions |
| **Confidence Display** | Visual badges (High/Medium/Low), uncertainty caveats, reasoning tooltips |
| **Chat Export** | Markdown, PDF, Word formats with sources preserved |
| **Document Upload** | Drag-and-drop, file picker, processing status in chat |

### Out of Scope

- **CIM v3 Workflow Tools:** `suggest_narrative_outline`, `validate_idea_coherence`, `generate_slide_blueprint` are NOT chat tools - they belong to the separate CIM Builder workflow agent (Epic 9)
- **Proactive Guidance:** Initial implementation will NOT include proactive steering of vague queries (deferred to post-MVP iteration based on usage patterns)
- **Advanced Evaluation:** Automated LLM-as-judge evaluation is future scope; MVP uses manual evaluation dataset
- **Voice Interface:** No speech-to-text input in MVP

### Success Metrics

| Metric | Target |
|--------|--------|
| Query Response Time | < 3 seconds for fact lookups |
| Source Attribution Rate | 100% of factual claims have sources |
| Conversation Context Retention | Last 10 messages maintained |
| Tool Selection Accuracy | Agent selects appropriate tool ≥ 90% of time |
| Evaluation Dataset Pass Rate | ≥ 90% of 10 test queries pass all checks |

## System Architecture Alignment

### Architecture Pattern: Tool-Calling Agent

Epic 5 implements the **Conversational Agent Implementation (Real-Time Chat)** pattern from the architecture document:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CONVERSATIONAL AGENT                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   User Query → LangChain Agent → Tool Selection → Tool Execution     │
│                         ↓                              ↓             │
│                  Native Function Calling        11 Chat Tools        │
│                  (Claude/Gemini)                     ↓               │
│                         ↓                    Platform Services       │
│                  Streaming Response                  ↓               │
│                         ↓                    pgvector + Neo4j        │
│                  Source Attribution                                  │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Distinction (from Architecture Doc):**
- **LangChain Agent:** For real-time conversational interactions with tool calling (Epic 5)
- **LangGraph Workflows:** For multi-step workflows with state persistence and human-in-the-loop (Epic 9 CIM v3)

### Technology Stack Alignment

| Component | Architecture Decision | Epic 5 Usage |
|-----------|----------------------|--------------|
| **Agent Framework** | LangChain 1.0 + tool calling | `create_tool_calling_agent()` with `AgentExecutor` |
| **LLM Provider** | Configurable (Claude, Gemini, GPT) | Default: Claude Sonnet 4.5 via `langchain-anthropic` |
| **Type Safety** | Pydantic v2.12+ | Structured outputs, tool input/output schemas |
| **Vector Search** | pgvector 0.8+ | `match_findings` RPC for semantic search |
| **Graph Database** | Neo4j 2025.01 | CONTRADICTS, SUPERSEDES, SUPPORTS relationships |
| **Frontend** | Next.js 15 + React 19 | Chat route `/projects/[id]/chat` |
| **Real-time** | Supabase Realtime | WebSocket for streaming responses |
| **State** | PostgreSQL | `conversations`, `messages` tables |

### Hybrid Search Architecture (P1)

The `query_knowledge_base` tool implements the hybrid search pattern:

```
query_knowledge_base(query, filters)
    ↓
1. Intent Detection (LLM)
   - Fact retrieval? → Single answer, high confidence
   - Research? → Multiple findings, temporal context
    ↓
2. Semantic Search (pgvector)
   - match_findings RPC with filters
   - Internal scoring: similarity × recency × confidence
    ↓
3. Temporal Filtering
   - Group by date_referenced
   - Identify superseded findings (SUPERSEDES relationship)
   - For fact retrieval: prefer most recent authoritative
    ↓
4. Conflict Detection (Neo4j)
   - Query for CONTRADICTS relationships
   - Only flag if: same period + no SUPERSEDES + diff docs
    ↓
5. Response Formatting
   - Never show confidence scores to users
   - Translate to natural explanations
```

### Data Flow Integration

```
Frontend (Chat UI)
    ↓ WebSocket
API Gateway (FastAPI)
    ↓
LangChain Agent
    ↓ Tool calls
Platform Services
    ↓
┌──────────────────┬────────────────┐
│   Supabase       │     Neo4j      │
│   (pgvector)     │   (Graph)      │
│   - findings     │ - CONTRADICTS  │
│   - documents    │ - SUPERSEDES   │
│   - messages     │ - SUPPORTS     │
└──────────────────┴────────────────┘
```

## Detailed Design

### Services and Modules

#### Module 1: LLM Integration Layer (`manda-app/lib/llm/`)

**Purpose:** Model-agnostic LLM client wrapper with structured outputs

```typescript
// lib/llm/client.ts
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

export type LLMProvider = "anthropic" | "openai" | "google";

interface LLMConfig {
  provider: LLMProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export function createLLMClient(config: LLMConfig) {
  switch (config.provider) {
    case "anthropic":
      return new ChatAnthropic({
        modelName: config.model,
        temperature: config.temperature ?? 0.7,
        maxTokens: config.maxTokens,
      });
    case "openai":
      return new ChatOpenAI({
        modelName: config.model,
        temperature: config.temperature ?? 0.7,
      });
    case "google":
      return new ChatGoogleGenerativeAI({
        modelName: config.model,
        temperature: config.temperature ?? 0.7,
      });
  }
}
```

**Files:**
- `lib/llm/client.ts` - LLM factory and client wrapper
- `lib/llm/config.ts` - Environment-based provider configuration
- `lib/llm/types.ts` - Pydantic-equivalent TypeScript types for structured outputs

#### Module 2: Agent Tools (`manda-app/lib/agent/tools/`)

**Purpose:** 11 chat tools with Pydantic-style validation via Zod schemas

```typescript
// lib/agent/tools/query-knowledge-base.ts
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const QueryKnowledgeBaseInput = z.object({
  query: z.string().min(3).describe("Search query"),
  filters: z.object({
    deal_id: z.string().uuid().optional(),
    document_id: z.string().uuid().optional(),
    domains: z.array(z.string()).optional(),
    confidence_min: z.number().min(0).max(1).optional(),
  }).optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

export const queryKnowledgeBaseTool = tool(
  async (input) => {
    // 1. Generate embedding for query
    // 2. Call match_findings RPC via Supabase
    // 3. Check Neo4j for CONTRADICTS/SUPERSEDES
    // 4. Format results with sources
    return formattedResults;
  },
  {
    name: "query_knowledge_base",
    description: "Search the knowledge base for findings relevant to a query",
    schema: QueryKnowledgeBaseInput,
  }
);
```

**11 Chat Tools:**

| Tool | Input Schema | Output | Service Integration |
|------|--------------|--------|---------------------|
| `query_knowledge_base` | query, filters, limit | Findings with sources | pgvector + Neo4j |
| `update_knowledge_base` | finding, source, confidence, date_referenced | Confirmation + finding_id | PostgreSQL |
| `update_knowledge_graph` | finding_id, relationships | Graph update status | Neo4j |
| `validate_finding` | finding, context, date_referenced | Validation result + conflicts | pgvector + Neo4j |
| `get_document_info` | doc_id | Document metadata | PostgreSQL |
| `trigger_analysis` | doc_id, analysis_type | Job status | pg-boss |
| `create_irl` | deal_type | IRL structure | PostgreSQL |
| `suggest_questions` | topic, max_count (≤10) | Q&A suggestions | LLM |
| `add_to_qa` | question, answer, sources, priority | Q&A item ID | PostgreSQL |
| `detect_contradictions` | topic | Contradiction list | Neo4j |
| `find_gaps` | category | Gap analysis | PostgreSQL + Neo4j |

**Files:**
- `lib/agent/tools/index.ts` - Tool exports
- `lib/agent/tools/knowledge-tools.ts` - query_knowledge_base, update_knowledge_base, update_knowledge_graph, validate_finding
- `lib/agent/tools/document-tools.ts` - get_document_info, trigger_analysis
- `lib/agent/tools/workflow-tools.ts` - create_irl, suggest_questions, add_to_qa
- `lib/agent/tools/intelligence-tools.ts` - detect_contradictions, find_gaps

#### Module 3: Agent Executor (`manda-app/lib/agent/`)

**Purpose:** LangChain tool-calling agent with streaming support

```typescript
// lib/agent/executor.ts
import { createToolCallingAgent, AgentExecutor } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createLLMClient } from "../llm/client";
import { allChatTools } from "./tools";

const systemPrompt = ChatPromptTemplate.fromMessages([
  ["system", AGENT_SYSTEM_PROMPT], // From agent-behavior-spec.md
  ["placeholder", "{chat_history}"],
  ["human", "{input}"],
  ["placeholder", "{agent_scratchpad}"],
]);

export async function createChatAgent(dealId: string, userId: string) {
  const llm = createLLMClient({
    provider: process.env.LLM_PROVIDER as LLMProvider,
    model: process.env.LLM_MODEL || "claude-sonnet-4-5-20250929",
  });

  const agent = createToolCallingAgent({
    llm,
    tools: allChatTools,
    prompt: systemPrompt,
  });

  return new AgentExecutor({
    agent,
    tools: allChatTools,
    verbose: process.env.NODE_ENV === "development",
  });
}
```

**Files:**
- `lib/agent/executor.ts` - Agent creation and execution
- `lib/agent/prompts.ts` - System prompt based on agent-behavior-spec.md
- `lib/agent/streaming.ts` - Token streaming utilities

#### Module 4: Chat API Routes (`manda-app/app/api/`)

**Purpose:** RESTful + WebSocket endpoints for chat operations

```typescript
// app/api/projects/[id]/chat/route.ts
export async function POST(req: Request, { params }) {
  const { message, conversationId } = await req.json();
  const projectId = params.id;

  // 1. Get or create conversation
  // 2. Save user message
  // 3. Execute agent with streaming
  // 4. Save agent response
  // 5. Return response with sources
}
```

**Files:**
- `app/api/projects/[id]/chat/route.ts` - Chat message endpoint
- `app/api/projects/[id]/chat/conversations/route.ts` - List conversations
- `app/api/projects/[id]/chat/conversations/[convId]/route.ts` - Get conversation
- `app/api/projects/[id]/chat/export/route.ts` - Export conversation

#### Module 5: Chat UI Components (`manda-app/components/chat/`)

**Purpose:** React components for chat interface

**Files:**
- `components/chat/ChatInterface.tsx` - Main chat container
- `components/chat/MessageList.tsx` - Scrollable message display
- `components/chat/MessageItem.tsx` - Individual message with citations
- `components/chat/ChatInput.tsx` - Input textarea with submit
- `components/chat/ConversationSidebar.tsx` - History sidebar
- `components/chat/QuickActions.tsx` - Action buttons
- `components/chat/FollowUpSuggestions.tsx` - Suggested questions
- `components/chat/ConfidenceBadge.tsx` - Confidence indicator
- `components/chat/SourceCitation.tsx` - Clickable source link
- `components/chat/ChatExportDialog.tsx` - Export format selection
- `components/chat/DocumentUpload.tsx` - Drag-and-drop upload

### Data Models and Contracts

#### Database Schema (PostgreSQL)

```sql
-- Conversations table
CREATE TABLE conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id),
    title text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Messages table
CREATE TABLE messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
    content text NOT NULL,
    tool_calls jsonb,           -- Tool invocations made by agent
    tool_results jsonb,         -- Results from tool executions
    sources jsonb,              -- Source citations [{doc_id, location, text}]
    confidence float,           -- Overall confidence score (internal)
    tokens_used integer,        -- Token count for cost tracking
    created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_conversations_project ON conversations(project_id);
CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- RLS Policies
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversations_user_policy ON conversations
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY messages_user_policy ON messages
    FOR ALL USING (
        conversation_id IN (
            SELECT id FROM conversations WHERE user_id = auth.uid()
        )
    );
```

#### TypeScript Types

```typescript
// lib/types/chat.ts

export interface Conversation {
  id: string;
  project_id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_results?: ToolResult[];
  sources?: SourceCitation[];
  confidence?: number;
  tokens_used?: number;
  created_at: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  tool_call_id: string;
  result: unknown;
  error?: string;
}

export interface SourceCitation {
  document_id: string;
  document_name: string;
  location: string;  // "Page 5", "Cell B15", "Section 3.2"
  text_snippet: string;
  url?: string;  // Link to document viewer
}

export interface Finding {
  id: string;
  text: string;
  source_document_id: string;
  source_location: string;
  confidence: number;
  date_referenced: string | null;  // Temporal metadata
  date_extracted: string;
  domains: string[];
  status: "draft" | "validated" | "flagged" | "archived";
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
}

export interface ChatResponse {
  message: Message;
  conversation_id: string;
  suggested_followups?: string[];
}
```

#### Zod Schemas (Tool Validation)

```typescript
// lib/agent/schemas.ts
import { z } from "zod";

export const QueryKnowledgeBaseInput = z.object({
  query: z.string().min(3).describe("Search query text"),
  filters: z.object({
    deal_id: z.string().uuid().optional(),
    document_id: z.string().uuid().optional(),
    domains: z.array(z.string()).optional(),
    statuses: z.array(z.enum(["draft", "validated", "flagged"])).optional(),
    confidence_min: z.number().min(0).max(1).optional(),
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional(),
  }).optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

export const UpdateKnowledgeBaseInput = z.object({
  finding: z.string().min(10).describe("The finding text to store"),
  source: z.object({
    document_id: z.string().uuid(),
    location: z.string().describe("Page, cell, or section reference"),
  }),
  confidence: z.number().min(0).max(1).default(0.8),
  date_referenced: z.string().datetime().optional()
    .describe("The date the data refers to (e.g., Q3 2024)"),
  domains: z.array(z.string()).optional(),
});

export const ValidateFindingInput = z.object({
  finding: z.string().describe("The finding to validate"),
  context: z.string().optional().describe("Additional context for validation"),
  date_referenced: z.string().datetime().optional()
    .describe("Temporal context for validation"),
});

export const DetectContradictionsInput = z.object({
  topic: z.string().describe("Topic to check for contradictions"),
  include_resolved: z.boolean().default(false),
});

export const SuggestQuestionsInput = z.object({
  topic: z.string().describe("Topic to generate questions about"),
  max_count: z.number().int().min(1).max(10).default(5)
    .describe("Maximum number of questions (hard cap: 10)"),
});
```

### APIs and Interfaces

#### REST API Endpoints

| Method | Endpoint | Description | Request | Response |
|--------|----------|-------------|---------|----------|
| POST | `/api/projects/[id]/chat` | Send message to agent | `ChatRequest` | `ChatResponse` (streaming) |
| GET | `/api/projects/[id]/chat/conversations` | List conversations | - | `Conversation[]` |
| GET | `/api/projects/[id]/chat/conversations/[convId]` | Get conversation with messages | - | `{conversation, messages}` |
| DELETE | `/api/projects/[id]/chat/conversations/[convId]` | Delete conversation | - | `{success: boolean}` |
| POST | `/api/projects/[id]/chat/export` | Export conversation | `{format, conversationId}` | File download |
| POST | `/api/projects/[id]/chat/upload` | Upload document via chat | `FormData` | `{documentId, status}` |

#### Chat Message Endpoint Detail

```typescript
// POST /api/projects/[id]/chat
// Request
interface ChatRequest {
  message: string;
  conversation_id?: string;  // Omit to create new conversation
}

// Response (Server-Sent Events for streaming)
// Event types:
// - "token": { text: string } - Streaming token
// - "tool_start": { tool: string, args: object } - Tool invocation started
// - "tool_end": { tool: string, result: object } - Tool completed
// - "sources": { citations: SourceCitation[] } - Source citations
// - "done": { message: Message, suggested_followups: string[] } - Complete
// - "error": { message: string, code: string } - Error occurred

// Example SSE stream:
// data: {"type":"token","text":"Q3 2024 revenue was "}
// data: {"type":"token","text":"€5.2M"}
// data: {"type":"tool_start","tool":"query_knowledge_base","args":{"query":"Q3 revenue"}}
// data: {"type":"tool_end","tool":"query_knowledge_base","result":{...}}
// data: {"type":"sources","citations":[{"document_name":"Q3_Report.pdf","location":"p.12"}]}
// data: {"type":"done","message":{...},"suggested_followups":["How does this compare to Q2?"]}
```

#### Supabase RPC Functions

```sql
-- match_findings: Semantic search for findings (existing from E3)
CREATE OR REPLACE FUNCTION match_findings(
  query_embedding vector(3072),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_deal_id uuid DEFAULT NULL,
  filter_domains text[] DEFAULT NULL,
  filter_statuses text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  text text,
  source_document_id uuid,
  source_location text,
  confidence float,
  date_referenced timestamptz,
  similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.text,
    f.source_document_id,
    f.source_location,
    f.confidence,
    f.date_referenced,
    1 - (f.embedding <=> query_embedding) AS similarity
  FROM findings f
  WHERE
    (filter_deal_id IS NULL OR f.deal_id = filter_deal_id)
    AND (filter_domains IS NULL OR f.domains && filter_domains)
    AND (filter_statuses IS NULL OR f.status = ANY(filter_statuses))
    AND 1 - (f.embedding <=> query_embedding) > match_threshold
  ORDER BY f.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

#### Neo4j Cypher Queries

```cypher
// Detect contradictions for a topic
MATCH (f1:Finding)-[:CONTRADICTS]->(f2:Finding)
WHERE f1.topic CONTAINS $topic OR f2.topic CONTAINS $topic
AND NOT (f1)-[:SUPERSEDES]->(f2)
AND NOT (f2)-[:SUPERSEDES]->(f1)
RETURN f1, f2, f1.date_referenced AS date1, f2.date_referenced AS date2

// Check for supersession chain
MATCH path = (newer:Finding)-[:SUPERSEDES*]->(older:Finding)
WHERE newer.id = $finding_id
RETURN path, nodes(path) AS chain

// Find supporting evidence
MATCH (f:Finding)-[s:SUPPORTS]->(related:Finding)
WHERE f.id = $finding_id
RETURN related, s.strength AS support_strength
ORDER BY s.strength DESC
```

#### WebSocket Events (Supabase Realtime)

```typescript
// Subscribe to conversation updates
const channel = supabase
  .channel(`conversation:${conversationId}`)
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "messages" },
    (payload) => handleNewMessage(payload.new)
  )
  .subscribe();
```

### Workflows and Sequencing

#### Chat Message Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CHAT MESSAGE WORKFLOW                            │
└─────────────────────────────────────────────────────────────────────────┘

User submits message
    │
    ▼
┌─────────────────────┐
│ 1. Authenticate     │ ← Supabase Auth middleware
│    & Authorize      │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ 2. Get/Create       │ ← If no conversation_id, create new
│    Conversation     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ 3. Save User        │ ← Store in messages table
│    Message          │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ 4. Load Context     │ ← Last 10 messages for context window
│    (Last N msgs)    │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ 5. Execute Agent    │ ← LangChain AgentExecutor.stream()
│    (Streaming)      │
│    ┌────────────────┤
│    │ Tool Selection │ ← LLM decides which tools to call
│    │ Tool Execution │ ← Tools query pgvector/Neo4j
│    │ Response Gen   │ ← Format with sources
│    └────────────────┤
└─────────┬───────────┘
          │ SSE tokens, tool events, sources
          ▼
┌─────────────────────┐
│ 6. Save Agent       │ ← Store response + tool calls + sources
│    Response         │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ 7. Generate         │ ← LLM suggests 2-3 follow-ups
│    Follow-ups       │
└─────────┬───────────┘
          │
          ▼
Return complete response
```

#### Tool Execution Sequencing

```
Agent receives user query
    │
    ▼
┌─────────────────────┐
│ Intent Detection    │ ← Fact lookup? Research? Due diligence?
│ (Implicit in LLM)   │
└─────────┬───────────┘
          │
          ├──────────────────────────────────────┐
          │                                      │
          ▼                                      ▼
┌─────────────────────┐              ┌─────────────────────┐
│ Single Tool Call    │              │ Multi-Tool Chain    │
│ (Simple queries)    │              │ (Complex queries)   │
└─────────┬───────────┘              └─────────┬───────────┘
          │                                      │
          │   "What's Q3 revenue?"              │   "Any red flags?"
          │          │                           │          │
          │          ▼                           │          ▼
          │   query_knowledge_base              │   detect_contradictions
          │          │                           │          │
          │          ▼                           │          ▼
          │   Return single finding              │   find_gaps
          │                                      │          │
          │                                      │          ▼
          │                                      │   query_knowledge_base
          │                                      │          │
          │                                      │          ▼
          │                                      │   Synthesize results
          │                                      │
          └──────────────────────────────────────┘
                              │
                              ▼
                    Format with sources
                    (P2 behavior spec)
```

#### Conversation Context Management

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONTEXT WINDOW MANAGEMENT                             │
└─────────────────────────────────────────────────────────────────────────┘

Conversation History (messages table)
    │
    ▼
┌─────────────────────┐
│ Load Last N         │ ← N = 10 (configurable)
│ Messages            │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Token Count Check   │ ← If > 8000 tokens, summarize older
└─────────┬───────────┘
          │
          ├─────────────── < 8000 tokens ──────────────────┐
          │                                                 │
          ▼                                                 ▼
┌─────────────────────┐                         ┌─────────────────────┐
│ Summarize Older     │                         │ Use Full History    │
│ Messages            │                         │                     │
└─────────┬───────────┘                         └─────────┬───────────┘
          │                                                 │
          └──────────────────┬──────────────────────────────┘
                             │
                             ▼
                    Pass to LLM prompt
```

#### Document Upload via Chat Flow

```
User drops/selects file
    │
    ▼
┌─────────────────────┐
│ 1. Validate File    │ ← Check format, size
│    (Frontend)       │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ 2. Upload to GCS    │ ← Same as E2 upload
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ 3. Create Document  │ ← Status: "processing"
│    Record           │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ 4. Queue Processing │ ← pg-boss job
│    Job              │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ 5. Show Status      │ ← "Uploading financials.pdf..."
│    in Chat          │   "Analyzing..."
│                     │   "12 findings extracted"
└─────────────────────┘
```

#### Story Implementation Order

```
E5.1 (LLM Integration)
    │
    ▼
E5.2 (Agent + 11 Tools) ────┐
    │                        │
    ▼                        │ Parallel
E5.3 (Chat Interface) ──────┤
    │                        │
    └────────────────────────┘
              │
              ▼
E5.4 (Source Citations)
    │
    ▼
E5.6 (Multi-turn Context)
    │
    ▼
E5.5 (Quick Actions) ───────┐
    │                        │
    ▼                        │ Parallel
E5.7 (Confidence Badges) ───┤
    │                        │
    └────────────────────────┘
              │
              ▼
E5.8 (Export) ──────────────┐
    │                        │
    ▼                        │ Parallel
E5.9 (Document Upload) ─────┘
```

## Non-Functional Requirements

### Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Time to First Token** | < 500ms | From message submit to first SSE token |
| **Fact Lookup Response** | < 3 seconds | Simple query → complete answer |
| **Tool Execution** | < 2 seconds per tool | Single tool call completion |
| **Semantic Search** | < 500ms | pgvector match_findings query |
| **Neo4j Query** | < 300ms | Contradiction/relationship lookup |
| **Context Load** | < 200ms | Load last 10 messages |
| **Concurrent Users** | 50 per project | Simultaneous chat sessions |

**Optimization Strategies:**
- **Streaming:** Token-by-token SSE prevents perceived latency
- **pgvector HNSW Index:** Fast approximate nearest neighbor search
- **Connection Pooling:** Reuse Supabase and Neo4j connections
- **Tool Parallelization:** Independent tools execute concurrently when possible
- **Embedding Cache:** Cache frequently-used query embeddings (1-hour TTL)

### Security

| Requirement | Implementation |
|-------------|----------------|
| **Authentication** | Supabase Auth required for all chat endpoints |
| **Authorization** | RLS policies ensure users only access own conversations |
| **Data Isolation** | Conversations scoped to project; findings scoped to deal |
| **System Prompt Protection** | Never expose system prompt or tool metadata to frontend |
| **Input Sanitization** | Zod validation on all tool inputs |
| **Rate Limiting** | 60 messages/minute per user (configurable) |
| **Cost Protection** | Per-user token budget tracking; alerts at thresholds |
| **Audit Logging** | All tool invocations logged with user context |

**Critical Security Rules:**
1. **Never expose confidence scores directly** - translate to natural language (per P2 spec)
2. **System prompt never returned to client** - agent internals are private
3. **Tool results filtered** - only relevant data exposed in chat response
4. **Document access verified** - tools check user has project access before querying

### Reliability/Availability

| Requirement | Implementation |
|-------------|----------------|
| **LLM Retry** | LangChain built-in exponential backoff (3 retries) |
| **Provider Fallback** | If primary LLM fails, fall back to secondary (Claude → Gemini) |
| **Tool Error Handling** | Graceful degradation - agent explains tool failure to user |
| **Conversation Recovery** | State persisted after each message; resume on reconnect |
| **Partial Response** | If streaming fails mid-response, partial content saved |
| **Database Failover** | Supabase managed HA; Neo4j read replica for queries |

**Error Handling Patterns:**
```typescript
// Tool error handling
try {
  const result = await tool.execute(input);
  return formatSuccess(result);
} catch (error) {
  // Log for debugging
  logger.error("Tool execution failed", { tool: tool.name, error });
  // Return user-friendly message
  return `I encountered an issue while ${tool.description}.
          Error: ${error.message}. Please try again or rephrase your question.`;
}
```

### Observability

| Component | Metric | Alert Threshold |
|-----------|--------|-----------------|
| **LLM Latency** | Time to complete | > 10 seconds |
| **Token Usage** | Tokens per request | > 50K tokens (budget alert) |
| **Tool Failures** | Error rate | > 5% per hour |
| **Conversation Length** | Messages per conversation | Info: > 50 messages |
| **Search Quality** | Empty result rate | > 20% of queries |
| **Cost Tracking** | Daily spend per user | Configurable threshold |

**Logging Structure:**
```typescript
// Request logging
{
  "timestamp": "2025-12-01T10:30:00Z",
  "request_id": "uuid",
  "user_id": "uuid",
  "project_id": "uuid",
  "conversation_id": "uuid",
  "event": "chat_message",
  "input_tokens": 150,
  "output_tokens": 320,
  "tools_called": ["query_knowledge_base", "detect_contradictions"],
  "response_time_ms": 2450,
  "model": "claude-sonnet-4-5-20250929"
}
```

**Integration Points:**
- **LangSmith (optional):** LangChain native tracing for prompt debugging
- **Vercel Analytics:** Frontend performance metrics
- **Supabase Dashboard:** Database query performance
- **Custom Dashboard:** Token usage, cost tracking, tool success rates

## Dependencies and Integrations

### New NPM Dependencies

```json
{
  "dependencies": {
    // LangChain Core
    "langchain": "^0.3.0",
    "@langchain/core": "^0.3.0",
    "@langchain/anthropic": "^0.3.0",
    "@langchain/openai": "^0.3.0",
    "@langchain/google-genai": "^0.1.0",

    // Validation
    "zod": "^3.23.0",

    // Export functionality
    "pdfmake": "^0.2.10",
    "docx": "^8.5.0"
  }
}
```

### Epic Dependencies (Prerequisites)

| Dependency | Epic | Status | Required For |
|------------|------|--------|--------------|
| Document ingestion | E2 | Complete | Documents to query |
| Findings extraction | E3 | Complete | Knowledge base content |
| pgvector match_findings | E3 | Complete | Semantic search |
| Neo4j graph | E3 | Complete | Contradiction detection |
| Knowledge validation | E4 | Complete | validate_finding tool |
| Findings management | E4 | Complete | update_knowledge_base tool |
| Gap analysis | E4 | Complete | find_gaps tool |

### External Service Integrations

| Service | Purpose | Configuration |
|---------|---------|---------------|
| **Anthropic API** | Claude Sonnet 4.5 (default conversational LLM) | `ANTHROPIC_API_KEY` |
| **OpenAI API** | Embeddings (text-embedding-3-large) | `OPENAI_API_KEY` |
| **Google AI API** | Gemini (fallback/alternative) | `GOOGLE_AI_API_KEY` |
| **Neo4j** | Graph queries (contradictions, relationships) | `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` |
| **Supabase** | PostgreSQL, Auth, Realtime | `SUPABASE_URL`, `SUPABASE_KEY` |
| **Google Cloud Storage** | Document storage (chat uploads) | `GCS_BUCKET`, service account |

### Internal Service Dependencies

```
┌─────────────────────────────────────────────────────────────────────┐
│                    EPIC 5 SERVICE DEPENDENCIES                       │
└─────────────────────────────────────────────────────────────────────┘

Chat API
    │
    ├── Knowledge Service (E3/E4)
    │   ├── match_findings RPC
    │   ├── Findings CRUD
    │   └── Embedding generation
    │
    ├── Document Service (E2)
    │   ├── Document metadata
    │   └── Upload pipeline
    │
    ├── Graph Service (E3)
    │   ├── Neo4j queries
    │   └── Relationship management
    │
    └── IRL Service (E6 - forward dependency)
        └── create_irl tool (stub until E6)
```

### Environment Variables

```bash
# LLM Configuration
LLM_PROVIDER=anthropic  # or openai, google
LLM_MODEL=claude-sonnet-4-5-20250929
ANTHROPIC_API_KEY=sk-...
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=...

# Cost/Rate Limits
LLM_MAX_TOKENS_PER_REQUEST=4096
LLM_RATE_LIMIT_PER_MINUTE=60
LLM_DAILY_TOKEN_BUDGET=1000000

# Feature Flags
ENABLE_TOOL_LOGGING=true
ENABLE_COST_TRACKING=true
ENABLE_FALLBACK_LLM=true

# Optional: LangSmith tracing
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=...
LANGCHAIN_PROJECT=manda-chat
```

## Acceptance Criteria (Authoritative)

### Epic-Level Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-E5-01 | User can ask questions in natural language | Manual test: submit query, receive response |
| AC-E5-02 | Agent provides answers with source citations | Every factual claim has (source: doc, location) |
| AC-E5-03 | Conversation history persists across sessions | Reload page, history preserved |
| AC-E5-04 | Agent can call all 11 chat tools | Each tool invocable via appropriate query |
| AC-E5-05 | Responses include confidence indicators | Visual badges displayed for responses |
| AC-E5-06 | Follow-up questions maintain context | Multi-turn conversation works naturally |
| AC-E5-07 | User can capture findings via chat | Finding stored with correct source |
| AC-E5-08 | System suggests Q&A questions | Follow-up suggestions appear after response |

### Story-Level Acceptance Criteria

#### E5.1: LLM Integration
- [ ] LangChain provider configured via environment variable
- [ ] Chat completion request returns generated text
- [ ] Retry logic works on API failure
- [ ] Token usage logged per request
- [ ] Structured outputs validated with Pydantic/Zod

#### E5.2: Agent with 11 Tools
- [ ] `query_knowledge_base` performs semantic search via pgvector
- [ ] `update_knowledge_base` stores findings with temporal metadata
- [ ] `validate_finding` checks for contradictions with date awareness
- [ ] `detect_contradictions` queries Neo4j CONTRADICTS relationships
- [ ] `find_gaps` identifies missing information by category
- [ ] `get_document_info` retrieves document metadata
- [ ] `trigger_analysis` enqueues processing job
- [ ] `create_irl` returns IRL structure (stub until E6)
- [ ] `suggest_questions` generates ≤10 Q&A suggestions
- [ ] `add_to_qa` stores Q&A item
- [ ] `update_knowledge_graph` creates Neo4j relationships
- [ ] Agent selects appropriate tool based on query intent
- [ ] System prompt never exposed to frontend
- [ ] **P3 compliance:** System prompt implements all 7 inferred intent behaviors (see agent-behavior-spec.md P3)
- [ ] **P7 compliance:** Evaluation harness with 10 test queries, 50K token budget (see agent-behavior-spec.md P7)

#### E5.3: Chat Interface
- [ ] Message list displays with auto-scroll
- [ ] Input textarea submits on Enter
- [ ] Streaming responses render token-by-token
- [ ] Tool execution shows loading indicator
- [ ] Conversation sidebar lists previous conversations
- [ ] "New Conversation" button creates fresh context

#### E5.4: Source Citations
- [ ] Citations render inline: (source: filename, location)
- [ ] Citations are clickable links
- [ ] Clicking opens document viewer at location
- [ ] Relevant section highlighted in viewer
- [ ] **P2 compliance:** Source attribution format matches agent-behavior-spec.md P2 rules

#### E5.5: Quick Actions
- [ ] "Find Contradictions" triggers detect_contradictions tool
- [ ] "Generate Q&A" triggers suggest_questions tool
- [ ] Suggested follow-ups appear after each response
- [ ] Clicking follow-up populates input field

#### E5.6: Multi-turn Context
- [ ] Last 10 messages passed to LLM
- [ ] References to "earlier" resolved correctly
- [ ] Context persists across page reloads
- [ ] Long conversations truncated gracefully
- [ ] **P4 compliance:** Context handling rules match agent-behavior-spec.md P4 (clear follow-up, ambiguous, topic shift)

#### E5.7: Confidence Indicators
- [ ] High/Medium/Low badges with color coding
- [ ] Tooltip shows confidence reasoning
- [ ] Low confidence triggers caveats in response
- [ ] "I don't know" includes explanation and next steps

#### E5.8: Export
- [ ] Markdown export preserves all messages and sources
- [ ] PDF export properly formatted
- [ ] Word export includes timestamps

#### E5.9: Document Upload via Chat
- [ ] Drag-and-drop triggers upload
- [ ] File picker available in input area
- [ ] Status messages shown in chat
- [ ] Processing completion notification displayed

## Traceability Mapping

### Functional Requirements → Stories

| FR ID | FR Description | Story | Implementation |
|-------|----------------|-------|----------------|
| FR-CONV-001 | Chat Interface | E5.3, E5.6 | ChatInterface.tsx, MessageList.tsx, ConversationSidebar.tsx |
| FR-CONV-002 | Query Capabilities | E5.2 | 11 agent tools with Zod schemas |
| FR-CONV-004 | Response Quality | E5.4, E5.7 | SourceCitation.tsx, ConfidenceBadge.tsx |
| FR-ARCH-002 | Tool-Based Agent Integration | E5.1, E5.2 | LangChain create_tool_calling_agent |
| FR-COLLAB-001 | Collaborative Document Analysis | E5.2 | update_knowledge_base, validate_finding tools |

### Stories → Technical Components

| Story | Components | Files |
|-------|------------|-------|
| E5.1 | LLM Client | `lib/llm/client.ts`, `lib/llm/config.ts` |
| E5.2 | Agent + Tools | `lib/agent/executor.ts`, `lib/agent/tools/*.ts` |
| E5.3 | Chat UI | `app/projects/[id]/chat/page.tsx`, `components/chat/*.tsx` |
| E5.4 | Sources | `components/chat/SourceCitation.tsx`, `components/chat/MessageItem.tsx` |
| E5.5 | Quick Actions | `components/chat/QuickActions.tsx`, `components/chat/FollowUpSuggestions.tsx` |
| E5.6 | Context | `lib/agent/context.ts`, `app/api/projects/[id]/chat/route.ts` |
| E5.7 | Confidence | `components/chat/ConfidenceBadge.tsx` |
| E5.8 | Export | `app/api/projects/[id]/chat/export/route.ts`, `components/chat/ChatExportDialog.tsx` |
| E5.9 | Upload | `components/chat/DocumentUpload.tsx`, `app/api/projects/[id]/chat/upload/route.ts` |

### Agent Behavior Spec → Implementation

| Spec Section | Implementation Location |
|--------------|------------------------|
| P1: Hybrid Search Architecture | `lib/agent/tools/knowledge-tools.ts` - query_knowledge_base |
| P2: Agent Behavior Framework | `lib/agent/prompts.ts` - system prompt |
| P3: Expected Behavior per Use Case | Implicit in LLM prompt + tool selection |
| P4: Conversation Goal/Mode Framework | `lib/agent/context.ts` - context management |
| P7: LLM Integration Test Strategy | `__tests__/agent/*.test.ts` |
| P8: Correction Chain Detection | `lib/hooks/document-upload.ts` - filename pattern detection |

### Architecture Decisions → Code

| Architecture Decision | Implementation |
|-----------------------|----------------|
| LangChain 1.0 + tool calling | `create_tool_calling_agent()` in executor.ts |
| Pydantic v2 (via Zod) | Zod schemas in `lib/agent/schemas.ts` |
| pgvector 0.8+ | `match_findings` RPC, HNSW index |
| Neo4j 2025.01 | Cypher queries in `lib/graph/queries.ts` |
| SSE streaming | ReadableStream in chat API route |
| Supabase Realtime | WebSocket subscription in ChatInterface.tsx |

## Risks, Assumptions, Open Questions

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **LLM API Latency** | Medium | High | Streaming reduces perceived latency; fallback to secondary provider |
| **Token Cost Overrun** | Medium | Medium | Per-user token budget tracking; alerts at thresholds |
| **Tool Selection Errors** | Medium | Medium | Comprehensive prompt engineering; evaluation dataset for validation |
| **Context Window Limits** | Low | Medium | Summarize older messages; configurable context length |
| **Source Attribution Gaps** | Medium | High | Strict tool output formatting; validation tests for citations |
| **Neo4j Query Performance** | Low | Medium | Index optimization; query caching for common patterns |
| **LangChain Version Drift** | Medium | Low | Pin specific versions; upgrade quarterly with testing |

### Assumptions

| Assumption | Rationale | Validation |
|------------|-----------|------------|
| Users will ask M&A-domain questions | Product is purpose-built for M&A analysts | User interviews, beta feedback |
| 10 messages provide sufficient context | Balance between context and token cost | A/B test different context lengths |
| Claude Sonnet 4.5 is optimal for chat | Best balance of quality, speed, cost | Evaluate against Gemini Pro, GPT-4 Turbo |
| pgvector similarity threshold 0.7 is appropriate | Standard threshold for semantic search | Tune based on search quality metrics |
| E3/E4 knowledge base has sufficient coverage | Prerequisites are complete | Validate findings exist before E5 development |

### Open Questions

| Question | Owner | Decision Deadline | Impact if Unresolved |
|----------|-------|-------------------|----------------------|
| **Q1:** Should we support voice input? | Product | Post-MVP | Scope creep; can add later |
| **Q2:** How to handle documents without findings? | PM | Before E5.2 | Poor UX for empty searches |
| **Q3:** Token budget per user vs. per project? | Finance | Before E5.1 | Cost model unclear |
| **Q4:** LangSmith for observability or custom? | Tech Lead | Before E5.1 | Affects logging implementation |
| **Q5:** How to test prompt quality systematically? | QA | Before E5.7 | Risk of regression in agent behavior |

### Technical Debt Notes

- **P8 Implementation:** Filename pattern detection is MVP; content-based detection deferred to future epic
- **Proactive Guidance:** Agent does NOT proactively steer conversations in MVP; defer to post-launch iteration
- **Evaluation Dataset:** Manual evaluation in MVP; automated LLM-as-judge evaluation is future scope
- **create_irl Tool:** Returns stub until E6 is complete

## Test Strategy Summary

### Test Pyramid (from P7 Spec)

```
                    ┌─────────────────┐
                    │   Integration   │  ~50K tokens/run
                    │   Tests (Live)  │  Manual before release
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │        Unit Tests           │  Every commit, CI
              │        (Mocked LLM)         │  Free, fast
              └─────────────────────────────┘
```

### Unit Tests (Mocked LLM)

| Component | Test Cases | Framework |
|-----------|-----------|-----------|
| LLM Client | Provider switching, retry logic, error handling | Vitest |
| Agent Tools | Input validation, output formatting, error cases | Vitest |
| Context Manager | Message loading, truncation, summarization | Vitest |
| Chat API | Request validation, response formatting | Vitest |
| UI Components | Rendering, interactions, state management | React Testing Library |

**Example Unit Test:**
```typescript
// __tests__/agent/tools/query-knowledge-base.test.ts
describe("query_knowledge_base", () => {
  it("validates input schema", async () => {
    await expect(queryKnowledgeBaseTool.invoke({ query: "ab" }))
      .rejects.toThrow("String must contain at least 3 characters");
  });

  it("formats findings with sources", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: mockFindings });
    const result = await queryKnowledgeBaseTool.invoke({ query: "Q3 revenue" });
    expect(result).toContain("(source:");
  });
});
```

### Integration Tests (Live LLM)

**Budget:** 50,000 tokens per test run (per P7 spec)

| Test Category | Token Budget | Test Count |
|---------------|-------------|------------|
| Basic Tool Invocation | 15K | 5 tests |
| Prompt Behavior Compliance | 20K | 5 tests |
| Multi-turn Context | 10K | 3 tests |
| Error Handling | 5K | 2 tests |

**When to Run:**
- Before releases
- After prompt changes
- After tool modifications
- NOT on every commit

### Evaluation Dataset (MVP)

10 curated queries with expected behaviors (from P7 spec):

| ID | Query | Intent | Key Checks |
|----|-------|--------|------------|
| EVAL-001 | "What's the Q3 revenue?" | Fact lookup | Single answer, source cited |
| EVAL-002 | "Walk me through the P&L" | Deep dive | Structured, headers, trends |
| EVAL-003 | "Any red flags?" | Due diligence | Contradictions, gaps noted |
| EVAL-004 | "Compare forecast to actual" | Comparison | Side-by-side, variance |
| EVAL-005 | "Summarize the management team" | Synthesis | Aggregated, gaps noted |
| EVAL-006 | "What's missing for the IRL?" | Gap ID | Coverage analysis |
| EVAL-007 | "Tell me about the company" | Exploration | Overview, drill-down offered |
| EVAL-008 | "Q3 revenue?" → "And EBITDA?" | Multi-turn | Context maintained |
| EVAL-009 | [query with no data] | Uncertainty | Explains WHY, offers Q&A |
| EVAL-010 | [query with conflicts] | Conflict | Both sources shown |

**Pass Criteria:** ≥ 90% of checks pass (9/10 queries)

### E2E Tests (Playwright)

| Test Suite | Scenarios |
|------------|-----------|
| Chat Flow | Send message, receive streaming response, view sources |
| Conversation Management | Create, switch, delete conversations |
| Quick Actions | Click action, verify tool invocation |
| Export | Export to each format, verify content |
| Upload | Drag file, verify processing status |

### Test Data Fixtures

```typescript
// __tests__/fixtures/chat-fixtures.ts
export const mockConversation = {
  id: "conv-123",
  project_id: "proj-456",
  user_id: "user-789",
  title: "Q3 Analysis",
  created_at: "2025-12-01T10:00:00Z",
};

export const mockFindings = [
  {
    id: "find-1",
    text: "Q3 2024 revenue was €5.2M",
    source_document_id: "doc-1",
    source_location: "Page 12",
    confidence: 0.95,
    date_referenced: "2024-09-30",
  },
];
```

---

**Document Generated:** 2025-12-01
**Status:** Ready for Review
**Next Step:** User approval, then story creation workflow
