# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Manda is an M&A intelligence platform with two main services:
- **manda-app**: Next.js 16 frontend with React 19, Tailwind CSS 4, shadcn/ui
- **manda-processing**: FastAPI backend for document processing with Python 3.12+

The services share a Supabase PostgreSQL database and use Graphiti + Neo4j for knowledge graph storage with Voyage embeddings.

> **Architecture Note (E10 Pivot):** As of E10 completion (2025-12-17), all embeddings and semantic search have been consolidated to Graphiti + Neo4j. pgvector was removed. See [Sprint Change Proposal 2025-12-15](docs/sprint-change-proposal-2025-12-15.md) for context.

## Commands

### Frontend (manda-app)

```bash
cd manda-app
npm run dev          # Start dev server with Turbopack (port 3000)
npm run build        # Production build
npm run lint         # ESLint
npm run type-check   # TypeScript type checking

# Testing
npm run test:run              # Vitest unit tests
npm run test:integration      # Integration tests (RUN_INTEGRATION_TESTS=true)
npm run test:e2e              # Playwright E2E tests
npm run test:e2e:ui           # Playwright with UI
npm run test:affected         # Run only changed tests

# Database
npm run db:types     # Generate TypeScript types from Supabase schema
npm run db:push      # Push migrations to Supabase
```

### Backend (manda-processing)

```bash
cd manda-processing

# Setup (first time only)
uv venv .venv                                     # Create virtual environment with uv
source .venv/bin/activate                         # Activate venv
uv pip install -e ".[dev]"                        # Install with dev dependencies

# Always activate venv before running commands
source .venv/bin/activate                         # Activate venv (do this in each terminal session)

# Development
uvicorn src.main:app --reload --port 8000         # Start API server
python -m src.jobs                                # Start background worker

# Testing
pytest                                            # Run all tests
pytest tests/unit/test_api/test_health.py         # Run single test file
pytest --cov=src --cov-report=html                # Tests with coverage

# Code Quality
ruff check .                                      # Linting
mypy src                                          # Type checking
```

### Infrastructure

```bash
# Neo4j (required for knowledge graph)
docker-compose -f docker-compose.dev.yml up -d

# Full processing stack
cd manda-processing && docker compose up -d
```

## Architecture

### Document Processing Pipeline

```
Upload → GCS Storage → Webhook → pg-boss Queue → Workers
                                      ↓
              document-parse (Docling) → ingest-graphiti (Voyage embeddings)
                                      ↓
              analyze-document (Gemini) → extract-financials
```

- **pg-boss**: Shared job queue between Next.js (enqueue) and Python (process)
- **Docling**: ML-based document parsing (PDF, DOCX, XLSX)
- **Graphiti + Neo4j**: Knowledge graph with temporal facts, entity resolution, and hybrid search
- **Voyage voyage-3.5**: 1024-dimension embeddings (stored in Neo4j)
- **Voyage rerank-2.5**: Reranking for 20-35% retrieval accuracy improvement
- **Gemini 2.5 Flash**: Document analysis and finding extraction

### Database

- **Supabase PostgreSQL**: Transactional data store (deals, users, Q&A, conversations)
- **Graphiti + Neo4j**: Knowledge graph with embeddings (vector + BM25 + graph hybrid search)
- Use **Transaction mode (port 6543)** for PostgreSQL connection pooling
- RLS (Row Level Security) enforced on PostgreSQL tables
- Neo4j uses `group_id` namespacing for multi-tenant isolation

### Frontend Architecture

- **App Router**: Pages in `app/`, API routes in `app/api/`
- **Server Components** by default, `"use client"` for interactivity
- **Supabase Auth**: Use `createClient()` from `lib/supabase/server.ts` in server components
- **shadcn/ui**: Components in `components/ui/`, add with `npx shadcn@latest add [name]`
- **Zustand**: State management for client-side state
- **React Query**: Server state and caching

### Backend Architecture

- **FastAPI**: API endpoints in `src/api/routes/`
- **Pydantic Settings**: Configuration in `src/config.py`
- **Job Handlers**: Add to `src/jobs/handlers/`, register in worker
- **Structured Logging**: Use `structlog` for consistent logging

## Key Patterns

### Agent System v2.0 (Single StateGraph + Middleware)

> **Story 1.7 Complete:** The legacy 3-path regex router (`lib/agent/orchestrator/`), supervisor module, and executor have been removed. Agent System v2.0 is now the sole implementation. Routes have been consolidated - `/api/projects/[id]/chat` is now the v2 agent endpoint. See `_bmad-output/planning-artifacts/agent-system-architecture.md` for full details.

The agent system uses a single LangGraph StateGraph with middleware-based context engineering:

```
User Message → Middleware Stack → Single StateGraph → Response
                    ↓
    context-loader → workflow-router → tool-selector → summarization (70%)
```

| Workflow Mode | Entry Point | Description |
|---------------|-------------|-------------|
| **chat** | supervisor node | General conversation + specialist routing |
| **cim** | cim/phase-router | CIM Builder multi-phase workflow |
| **irl** | (future) | Information Request List workflow |
| **qa** | (future) | Q&A Builder workflow |

**Architecture Decisions:**
- Single graph with conditional entry points (not dual graphs)
- LLM handles routing via tool-calling (not regex patterns)
- 70% compression threshold (prevents hallucination in M&A analysis)
- Specialists as tools, not separate graphs
- PostgresSaver checkpointing for conversation persistence
- Redis caching for tool results and deal context

**Key Files (v2):**
- `lib/agent/v2/graph.ts` - Single StateGraph definition
- `lib/agent/v2/state.ts` - Unified AgentState schema
- `lib/agent/v2/middleware/` - Context engineering middleware
- `lib/agent/v2/nodes/supervisor.ts` - Main routing node
- `lib/agent/v2/nodes/specialists/` - Financial analyst, document researcher, etc.
- `lib/agent/v2/nodes/cim/` - CIM workflow nodes

**Supporting Files (shared):**
- `lib/agent/checkpointer.ts` - PostgresSaver for conversation persistence
- `lib/agent/streaming.ts` - SSE helpers for response streaming
- `lib/agent/tools/*.ts` - Tool definitions (18 tools)
- `lib/agent/intent.ts` - Intent classification (used by retrieval, LLM routing)
- `lib/agent/retrieval.ts` - Pre-model retrieval hook
- `lib/agent/summarization.ts` - Conversation summarization
- `lib/agent/tool-isolation.ts` - Tool result isolation (used by CIM)
- `lib/agent/cim/` - CIM workflow (intact, uses v2 infrastructure)

**Removed in Story 1.7:**
- `lib/agent/orchestrator/` - Legacy 3-path regex router (DELETED)
- `lib/agent/executor.ts` - Legacy agent executor (DELETED)
- `lib/agent/supervisor/` - Legacy supervisor module (DELETED)
- `lib/agent/graph.ts` - Legacy root graph (DELETED)

**API Entry Points:**
- `app/api/projects/[id]/chat/route.ts` - v2 agent system (sole entry point)

### LangChain Integration

Both services use LangChain for LLM operations:
- Frontend: `@langchain/anthropic`, `@langchain/google-genai`, `@langchain/openai`, `@langchain/langgraph`
- Backend: `langchain`, `langchain-google-genai`, `pydantic-ai`

### Testing

- Unit tests mock external services (Supabase, OpenAI, etc.)
- Integration tests require `RUN_INTEGRATION_TESTS=true`
- E2E tests use Playwright against running dev server
- Backend uses pytest with asyncio mode auto-enabled

### Multi-Tenant Isolation

All database queries must include `project_id` in WHERE clauses. RLS policies enforce tenant isolation at the database level.

## Documentation

- **PRD**: `docs/manda-prd.md` (v2.4)
- **Architecture**: `docs/manda-architecture.md` (v4.3)
- **Epics/Stories**: `docs/epics.md` (v2.5), `docs/sprint-artifacts/stories/`
- **Testing Guide**: `docs/testing/testing-guide.md`
- **Tech Specs**: `docs/sprint-artifacts/tech-specs/`
- **Architecture Decisions**: `docs/architecture-decisions/` (ADRs)

## Agent System v2.0 - Implementation Rules

When implementing Agent System v2.0 code, follow these patterns exactly:

### Naming Conventions

```typescript
// ✅ State & Variables: camelCase
dealContext, workflowMode, cimState, activeSpecialist

// ✅ Files & Directories: kebab-case
lib/agent/middleware/context-loader.ts
lib/agent/nodes/cim/phase-router.ts

// ✅ Graph Nodes: short descriptive, workflow prefix
'supervisor', 'retrieval', 'approval'
'cim/phaseRouter', 'cim/slideCreation'

// ✅ Specialist Tools: kebab-case
'financial-analyst', 'document-researcher', 'kg-expert'
```

### Type Patterns

```typescript
// ✅ Discriminated unions for events (matches existing SSEEvent pattern)
export type AgentStreamEvent =
  | { type: 'token'; content: string; timestamp: string }
  | { type: 'source_added'; source: SourceCitation; timestamp: string }
  | { type: 'approval_required'; request: ApprovalRequest; timestamp: string }
  | { type: 'done'; state: FinalState; timestamp: string }

// ✅ Standard specialist result shape
interface SpecialistResult {
  answer: string
  sources: SourceCitation[]
  confidence?: number
  data?: unknown
}
```

### Middleware Order (Critical)

```typescript
// ✅ Correct order - dependencies flow left to right
const middlewareStack = [
  contextLoaderMiddleware,    // 1. Load deal context first
  workflowRouterMiddleware,   // 2. Set system prompt by mode
  toolSelectorMiddleware,     // 3. Filter tools by permissions
  summarizationMiddleware,    // 4. Compress at 70% (last)
]
```

### Cache Keys

```typescript
// ✅ Pattern: {scope}:{identifier}:{type}:{hash?}
`deal:${dealId}:context`                          // 1 hour TTL
`deal:${dealId}:kg:${queryHash}`                  // 30 min TTL
`deal:${dealId}:specialist:${tool}:${inputHash}`  // 30 min TTL
```

### Anti-Patterns to Avoid

```typescript
// ❌ Don't use old orchestrator code
import { streamOrchestrator } from '@/lib/agent/orchestrator'  // DEPRECATED

// ❌ Don't mix naming conventions
const deal_context = state.dealContext  // snake_case variable

// ❌ Don't skip timestamps in events
yield { type: 'token', content: '...' }  // Missing timestamp

// ❌ Don't return unstructured tool results
return { answer: '...' }  // Missing sources array

// ❌ Don't import from deep paths
import { supervisor } from '@/lib/agent/nodes/supervisor'  // Import from index
```

### Thread ID Pattern

```typescript
// Format: {workflowMode}-{dealId}-{userId}-{conversationId}
'chat-deal123-user456-conv789'
'cim-deal123-cim001'  // CIM is deal-scoped, not user-scoped
```

## BMAD Framework

This project uses BMAD (Build Mad Agentic Delivery) for AI-assisted development. Key workflows:
- `/bmad:bmm:workflows:dev-story` - Implement a user story
- `/bmad:bmm:workflows:code-review` - Adversarial code review
- `/bmad:bmm:workflows:create-story` - Create next story from epic
- `/bmad:bmm:workflows:sprint-status` - Check sprint progress

## Agent System Documentation

- **PRD**: `_bmad-output/planning-artifacts/agent-system-prd.md`
- **Architecture**: `_bmad-output/planning-artifacts/agent-system-architecture.md`
- **LangGraph Reference**: `docs/langgraph-reference.md`
- **Behavior Spec**: `docs/agent-behavior-spec.md` (needs update after v2 implementation)
