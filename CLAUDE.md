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
pip install -e ".[dev]"                           # Install with dev dependencies
uvicorn src.main:app --reload --port 8000         # Start API server
python -m src.jobs                                # Start background worker
pytest                                            # Run all tests
pytest tests/unit/test_api/test_health.py         # Run single test file
pytest --cov=src --cov-report=html                # Tests with coverage
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

### LangChain Integration

Both services use LangChain for LLM operations:
- Frontend: `@langchain/anthropic`, `@langchain/google-genai`, `@langchain/openai`
- Backend: `langchain`, `langchain-google-genai`, `pydantic-ai`

### Testing

- Unit tests mock external services (Supabase, OpenAI, etc.)
- Integration tests require `RUN_INTEGRATION_TESTS=true`
- E2E tests use Playwright against running dev server
- Backend uses pytest with asyncio mode auto-enabled

### Multi-Tenant Isolation

All database queries must include `project_id` in WHERE clauses. RLS policies enforce tenant isolation at the database level.

## Documentation

- **PRD**: `docs/manda-prd.md` (v1.9)
- **Architecture**: `docs/manda-architecture.md` (v3.3)
- **Epics/Stories**: `docs/epics.md`, `docs/sprint-artifacts/stories/`
- **Testing Guide**: `docs/testing/testing-guide.md`
- **Tech Specs**: `docs/sprint-artifacts/tech-specs/`

## BMAD Framework

This project uses BMAD (Build Mad Agentic Delivery) for AI-assisted development. Key workflows:
- `/bmad:bmm:workflows:dev-story` - Implement a user story
- `/bmad:bmm:workflows:code-review` - Adversarial code review
- `/bmad:bmm:workflows:create-story` - Create next story from epic
- `/bmad:bmm:workflows:sprint-status` - Check sprint progress
