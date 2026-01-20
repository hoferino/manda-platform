# Architecture

**Analysis Date:** 2026-01-20

## Pattern Overview

**Overall:** Dual-service microarchitecture with clear separation of concerns

Manda uses a **Next.js frontend + FastAPI backend** pattern with:
- **Frontend (manda-app)**: Server-side rendering, client-side agents, real-time UI
- **Backend (manda-processing)**: Async job queue workers, document parsing, embeddings
- **Shared State**: Supabase PostgreSQL for transactional data, Neo4j for knowledge graph
- **Job Queue**: pg-boss connects frontend and backend asynchronously

**Key Characteristics:**
- Multi-tenant isolation via RLS on PostgreSQL and `group_id` namespacing in Neo4j
- Agent-driven workflows (CIM MVP for structured docs, v2 agent for chat)
- Streaming SSE responses for real-time UI updates
- LangGraph-based state machine architecture
- Hybrid search combining BM25, vector embeddings (Voyage 1024-dim), and graph traversal

## Layers

**Frontend API Layer (`app/api/`):**
- Purpose: Expose Next.js server actions as HTTP endpoints
- Location: `manda-app/app/api/`
- Contains: Route handlers for chat, CIM, documents, projects, organizations
- Depends on: Supabase client, LangGraph agent, Neo4j client
- Used by: React frontend, external clients

**Frontend Agent Layer (`lib/agent/`):**
- Purpose: LangGraph-based orchestration and tool execution
- Location: `manda-app/lib/agent/`
- Contains:
  - `cim-mvp/` - Production CIM builder with LangGraph StateGraph
  - `v2/` - Chat agent with supervisor/retrieval nodes
  - `tools/` - Tool definitions (knowledge, workflow, correction)
  - `checkpointer.ts` - PostgreSQL-backed conversation persistence
- Depends on: LangChain, LangGraph, Supabase, Neo4j
- Used by: API routes, React hooks

**Frontend Service Layer (`lib/services/`):**
- Purpose: Business logic for CIM, IRL, Q&A, audits, corrections
- Location: `manda-app/lib/services/`
- Contains: 23 service files handling export, import, validation, propagation
- Depends on: Supabase client, Neo4j queries
- Used by: Components, API routes, agent tools

**Frontend Data Layer (`lib/supabase/`, `lib/neo4j/`):**
- Purpose: Database access and query abstraction
- Location: `manda-app/lib/supabase/`, `manda-app/lib/neo4j/`
- Contains: Client factories, query builders, auth helpers
- Depends on: Supabase SDK, Neo4j driver
- Used by: Services, agent layer

**Backend API Layer (`src/api/routes/`):**
- Purpose: FastAPI endpoint handlers
- Location: `manda-processing/src/api/routes/`
- Contains: Health, webhooks, search, processing, entities, financials, graphiti, agents
- Depends on: FastAPI, Pydantic, internal services
- Used by: External clients, frontend

**Backend Job Processing (`src/jobs/`):**
- Purpose: Async job queue execution and worker management
- Location: `manda-processing/src/jobs/`
- Contains:
  - `queue.py` - pg-boss queue wrapper
  - `worker.py` - Worker process orchestration
  - `handlers/` - Job type handlers (document-parse, ingest-graphiti, analyze-document, extract-financials)
- Depends on: pg-boss, handler implementations
- Used by: Worker process, webhook triggers

**Backend Document Processing (`src/parsers/`, `src/embeddings/`, `src/graphiti/`):**
- Purpose: Parse documents, generate embeddings, ingest into knowledge graph
- Location: `manda-processing/src/parsers/`, `manda-processing/src/embeddings/`, `manda-processing/src/graphiti/`
- Contains:
  - Docling ML-based parser (PDF, DOCX, XLSX support)
  - Voyage 1024-dim embeddings with Voyage rerank-2.5
  - Graphiti entity resolution and fact storage
- Depends on: LLM APIs, Neo4j driver, embedding services
- Used by: Job handlers

**Backend LLM Layer (`src/llm/`, `src/agents/`):**
- Purpose: LLM interactions for analysis and extraction
- Location: `manda-processing/src/llm/`, `manda-processing/src/agents/`
- Contains: Gemini 2.5 Flash integration, Pydantic AI agents, tool definitions
- Depends on: LangChain, Pydantic AI, Google GenAI SDK
- Used by: Job handlers, API routes

**UI Layer (`components/`):**
- Purpose: React components organized by feature domain
- Location: `manda-app/components/`
- Contains: cim-builder, chat, data-room, irl, qa, knowledge-explorer, workspace, ui
- Depends on: shadcn/ui, Tailwind CSS, React hooks, services
- Used by: App Router pages

**Page Layer (`app/`):**
- Purpose: Next.js App Router page and layout components
- Location: `manda-app/app/`
- Contains: Authentication flows, project workspace, feature pages
- Depends on: Components, services, agent layer
- Used by: Browser routing

## Data Flow

**Document Processing Flow:**

1. **Upload** → `app/api/documents/upload/route.ts` enqueues `document-parse` job via pg-boss
2. **Parse** → `src/jobs/handlers/document_parse.py` uses Docling to extract structured content
3. **Analyze** → `src/jobs/handlers/analyze_document.py` uses Gemini to extract findings
4. **Extract Financials** → `src/jobs/handlers/extract_financials.py` parses financial data
5. **Ingest** → `src/jobs/handlers/ingest_graphiti.py` embeds chunks with Voyage and stores in Neo4j via Graphiti
6. **Notify** → Webhook or polling updates frontend with completion status

**Chat/Agent Flow:**

1. **User Input** → `app/api/projects/[id]/chat-v2/route.ts` receives message
2. **Thread Resolution** → Create or load conversation thread from PostgreSQL checkpointer
3. **State Creation** → Initialize AgentState with dealContext, messages, workflow mode
4. **Graph Execution** → LangGraph nodes (supervisor → retrieval → tool execution)
5. **Retrieval** → Query Neo4j with Graphiti hybrid search (vector + BM25 + graph)
6. **Tool Execution** → Execute allowed tools based on workflow mode
7. **SSE Stream** → Yield events (token, source_added, done, error) to frontend
8. **Persistence** → PostgresSaver checkpoints state for conversation resumption

**CIM MVP Workflow Flow:**

1. **User Request** → `app/api/projects/[id]/cims/[cimId]/chat-mvp/route.ts` receives message
2. **Knowledge Loading** → Load JSON knowledge file or query Graphiti
3. **Phase Router** → Determine current workflow stage (welcome, buyer, market, etc.)
4. **Slide Generation** → LangGraph nodes create/update presentation slides
5. **Workflow Progress** → Yield workflow_progress, outline_created, section_started events
6. **Slide Components** → Generate component specifications for slide preview
7. **Persistence** → Save slide state and conversation to PostgreSQL

**Real-time Updates:**

- **Realtime Subscriptions**: Components use `lib/hooks/useKnowledgeExplorerRealtime.ts`, `useContradictionsRealtime.ts` for Supabase real-time subscriptions
- **Polling**: Document status, job queue progress via `app/api/processing/queue/` routes

**State Management:**

- **Server State**: PostgreSQL checkpointer stores LangGraph conversation threads
- **Client State**: Zustand store (`upload-store.ts`) for UI state
- **Graph State**: Neo4j stores entities, facts, embeddings
- **Session State**: Supabase Auth for user identity and RLS enforcement

## Key Abstractions

**LangGraph State Machine:**
- Purpose: Unified state container flowing through agent nodes
- Examples: `lib/agent/v2/state.ts` (AgentState), `lib/agent/cim-mvp/state.ts` (CIMMVPState)
- Pattern: Annotation.Root() with typed fields, reducers for conflict resolution, checkpointer for persistence

**Tool System:**
- Purpose: Agent-executable functions with schema validation
- Examples: `lib/agent/tools/intelligence-tools.ts`, `lib/agent/tools/workflow-tools.ts`
- Pattern: Pydantic models for schemas, structured logging, error classification

**Job Queue Pattern:**
- Purpose: Async task execution across services
- Examples: `src/jobs/queue.py` (pg-boss wrapper), `src/jobs/handlers/`
- Pattern: Enqueue from frontend, process in Python worker, classify errors (transient vs permanent)

**Multi-Tenant Isolation:**
- Purpose: Enforce data separation per organization
- Implementation: RLS on PostgreSQL tables, `group_id` in Neo4j queries
- Pattern: Filter by `project_id` in all SQL, by `group_id` in Neo4j

**Knowledge Service:**
- Purpose: Abstraction over JSON knowledge files vs Graphiti retrieval
- Examples: `lib/agent/cim-mvp/knowledge-service.ts`, `lib/agent/cim-mvp/graphiti-knowledge.ts`
- Pattern: Interface-based design (IKnowledgeService), pluggable backends

**Checkpointer Pattern:**
- Purpose: Conversation persistence for thread resumption
- Implementation: `lib/agent/checkpointer.ts` uses PostgreSQL to store LangGraph state
- Pattern: Keyed by `thread_id`, allows resuming conversations across sessions

## Entry Points

**Frontend - Chat:**
- Location: `app/api/projects/[id]/chat-v2/route.ts`
- Triggers: User sends message in chat UI
- Responsibilities: Validate request, load thread, invoke v2 agent, stream SSE response

**Frontend - CIM MVP:**
- Location: `app/api/projects/[id]/cims/[cimId]/chat-mvp/route.ts`
- Triggers: User interacts in CIM builder
- Responsibilities: Load knowledge, navigate workflow stage, generate slide content

**Frontend - Document Upload:**
- Location: `app/api/documents/upload/route.ts`
- Triggers: User selects file in data room
- Responsibilities: Upload to GCS, enqueue document-parse job, track in database

**Backend - Job Worker:**
- Location: `src/jobs/__main__.py`
- Triggers: `python -m src.jobs` startup
- Responsibilities: Poll queue, execute registered handlers, manage retries

**Backend - API Server:**
- Location: `src/main.py`
- Triggers: `uvicorn src.main:app --reload` startup
- Responsibilities: Handle webhook callbacks, expose health/search/entities endpoints

**Frontend - App:**
- Location: `app/layout.tsx`
- Triggers: Browser navigation to `/`
- Responsibilities: Initialize providers (auth, organization), render outlet

## Error Handling

**Strategy:** Layered with user-friendly fallback

- **Frontend**: API routes catch errors and return 400/401/404/500 responses, SSE events carry error detail
- **Agent**: LangGraph nodes handle tool failures, yield error events with retry logic
- **Backend**: Job handlers classify errors (transient/permanent), use retry manager or mark complete
- **Database**: RLS policies prevent unauthorized access, queries fail safely with typed errors

**Patterns:**

- **Try-Catch with Classification**: `src/jobs/worker.py` catches exceptions and wraps permanent errors in PermanentJobError
- **Error Events**: Agent streams `{ type: 'error', error: { code, message }, timestamp }` for client handling
- **Validation Errors**: Pydantic models validate input, return 422 with field-level errors
- **Service Errors**: Structured logging with `structlog` captures context for debugging

## Cross-Cutting Concerns

**Logging:**
- Structured logging via `structlog` (backend) and browser console (frontend)
- Pattern: JSON format in production, color console in development
- Scope: API requests, job execution, agent node transitions

**Validation:**
- Frontend: Zod schemas in API routes (e.g., ChatV2RequestSchema)
- Backend: Pydantic models in src/models/ and FastAPI routes
- Agent: Tool schema validation via LangChain StructuredTool

**Authentication:**
- Supabase Auth for user sessions and token generation
- Frontend: Middleware validates session before API routes
- Backend: JWT validation on FastAPI endpoints with get_current_user dependency
- Multi-tenant: RLS policies enforce project_id ownership

**Observability:**
- Logfire integration for Pydantic AI tracing (optional, configured via LOGFIRE_TOKEN)
- Backend: structlog with ISO timestamps and exception info
- Frontend: Client-side error tracking via API error responses

**Performance:**
- Streaming responses via SSE for real-time updates (no polling overhead)
- Checkpointing reduces re-computation on thread resumption
- Batching in job handlers (batch_size configured per job type)
- Hybrid search combines index efficiency (BM25) with semantic accuracy (embeddings)

---

*Architecture analysis: 2026-01-20*
