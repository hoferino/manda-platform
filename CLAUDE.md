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

### Agent System - Current Implementation

> **Implementation Status (2026-01-13)**
> - **CIM Builder**: `cim-mvp` is the active implementation (standalone)
> - **Chat**: `v2` agent is active for general chat
> - **v2 CIM integration**: Pending future work (Story 6.1)

The platform has two active agent implementations:

#### CIM Builder (Production MVP)

The CIM Builder uses a **standalone implementation** separate from the v2 agent system:

| Component | Details |
|-----------|---------|
| **Implementation** | `lib/agent/cim-mvp/` |
| **API Endpoint** | `/api/projects/[id]/cims/[cimId]/chat-mvp` |
| **UI Toggle** | Default ON in `CIMBuilderPage.tsx` |
| **Features** | JSON knowledge file, workflow stages, slide updates, SSE streaming |

**Key Files (CIM MVP):**
- `lib/agent/cim-mvp/graph.ts` - LangGraph StateGraph for CIM workflow
- `lib/agent/cim-mvp/state.ts` - CIM-specific state schema
- `lib/agent/cim-mvp/tools.ts` - CIM tools (save_buyer_persona, create_outline, etc.)
- `lib/agent/cim-mvp/knowledge-loader.ts` - JSON knowledge file loader
- `app/api/projects/[id]/cims/[cimId]/chat-mvp/route.ts` - API endpoint

**UI Entry Point:**
- `components/cim-builder/CIMBuilderPage.tsx` - Main UI with MVP toggle
- `lib/hooks/useCIMMVPChat.ts` - React hook for CIM MVP chat

#### Chat Agent (v2)

General conversation uses the v2 agent with Graphiti retrieval:

| Component | Details |
|-----------|---------|
| **Implementation** | `lib/agent/v2/` |
| **API Endpoint** | `/api/projects/[id]/chat` |
| **Features** | Graphiti retrieval, supervisor node, tool calling |

**Key Files (v2 Chat):**
- `lib/agent/v2/graph.ts` - Single StateGraph definition
- `lib/agent/v2/state.ts` - Unified AgentState schema
- `lib/agent/v2/nodes/supervisor.ts` - Main routing node
- `lib/agent/v2/nodes/retrieval.ts` - Graphiti knowledge graph search

**Supporting Files (shared):**
- `lib/agent/checkpointer.ts` - PostgresSaver for conversation persistence
- `lib/agent/streaming.ts` - SSE helpers for response streaming
- `lib/agent/tools/*.ts` - Tool definitions
- `lib/agent/retrieval.ts` - Pre-model retrieval hook

### Agent System v2.0 - Future Architecture

> The v2 architecture documents describe the **target state** for unified agent integration.
> CIM integration into v2 is planned for Story 6.1. Until then, CIM uses the standalone `cim-mvp` implementation.

The v2 architecture envisions a single LangGraph StateGraph with middleware-based context engineering:

```
User Message → Middleware Stack → Single StateGraph → Response
                    ↓
    context-loader → workflow-router → tool-selector → summarization (70%)
```

| Workflow Mode | Current Status | Description |
|---------------|----------------|-------------|
| **chat** | ✅ Active | General conversation via `lib/agent/v2/` |
| **cim** | ⏳ Pending | Placeholder at `v2/nodes/cim/phase-router.ts` - uses `cim-mvp` instead |
| **irl** | ⏳ Future | Information Request List workflow |
| **qa** | ⏳ Future | Q&A Builder workflow |

**Legacy Code (Removed in Story 1.7):**
- `lib/agent/orchestrator/` - Legacy 3-path regex router (DELETED)
- `lib/agent/executor.ts` - Legacy agent executor (DELETED)
- `lib/agent/supervisor/` - Legacy supervisor module (DELETED)

**Superseded Code:**
- `lib/agent/cim/` - Original CIM implementation (superseded by `cim-mvp`)

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

## Agent Implementation Rules

When implementing agent code, follow these patterns:

### CIM MVP Patterns

```typescript
// ✅ CIM MVP thread ID (CIM-scoped)
`cim-mvp:${cimId}`

// ✅ CIM MVP SSE events
type CIMMVPStreamEvent =
  | { type: 'token'; content: string; timestamp: string }
  | { type: 'workflow_progress'; data: WorkflowProgress; timestamp: string }
  | { type: 'outline_created'; data: { sections: OutlineSection[] }; timestamp: string }
  | { type: 'slide_update'; data: SlideUpdate; timestamp: string }
  | { type: 'done'; timestamp: string }
  | { type: 'error'; message: string; timestamp: string }

// ✅ Import from cim-mvp barrel
import { streamCIMMVP, executeCIMMVP } from '@/lib/agent/cim-mvp'
```

### v2 Chat Patterns

```typescript
// ✅ v2 thread ID format
`{workflowMode}:{dealId}:{userId}:{conversationId}`

// ✅ v2 SSE events
type AgentStreamEvent =
  | { type: 'token'; content: string; timestamp: string }
  | { type: 'source_added'; source: SourceCitation; timestamp: string }
  | { type: 'done'; state: FinalState; timestamp: string }

// ✅ Import from v2 barrel
import { streamAgentWithTokens, createInitialState } from '@/lib/agent/v2'
```

### Naming Conventions

```typescript
// ✅ State & Variables: camelCase
dealContext, workflowMode, cimState, activeSpecialist

// ✅ Files & Directories: kebab-case
lib/agent/cim-mvp/knowledge-loader.ts
lib/agent/v2/nodes/supervisor.ts

// ✅ Graph Nodes: short descriptive
'supervisor', 'retrieval', 'agent'
```

### Anti-Patterns to Avoid

```typescript
// ❌ Don't use old orchestrator code (DELETED)
import { streamOrchestrator } from '@/lib/agent/orchestrator'

// ❌ Don't use original cim/ (superseded by cim-mvp)
import { executeCIMChat } from '@/lib/agent/cim'

// ❌ Don't skip timestamps in SSE events
yield { type: 'token', content: '...' }  // Missing timestamp

// ❌ Don't import from deep paths
import { supervisor } from '@/lib/agent/v2/nodes/supervisor'  // Use barrel export
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
