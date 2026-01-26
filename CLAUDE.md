# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Manda is an M&A intelligence platform with two main services:
- **manda-app**: Next.js 16 frontend with React 19, Tailwind CSS 4, shadcn/ui
- **manda-processing**: FastAPI backend for document processing with Python 3.12+

The services share a Supabase PostgreSQL database and use Graphiti + Neo4j for knowledge graph storage with Voyage embeddings.

> **Architecture Note (E10 Pivot):** All embeddings and semantic search consolidated to Graphiti + Neo4j. pgvector was removed. See [SCP-003](docs/decisions/sprint-change-proposal-2025-12-15.md).

## Commands

### Frontend (manda-app)

```bash
cd manda-app
npm run dev          # Start dev server with Turbopack (port 3000)
npm run build        # Production build
npm run lint         # ESLint
npm run type-check   # TypeScript type checking
npm run test:run     # Vitest unit tests
npm run test:e2e     # Playwright E2E tests
npm run db:types     # Generate TypeScript types from Supabase
```

### Backend (manda-processing)

```bash
cd manda-processing
source .venv/bin/activate                         # Activate venv first
uvicorn src.main:app --reload --port 8000         # Start API server
python -m src.jobs                                # Start background worker
pytest                                            # Run tests
ruff check . && mypy src                          # Lint + type check
```

### Infrastructure

```bash
docker-compose -f docker-compose.dev.yml up -d    # Neo4j for knowledge graph
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

### Database

- **Supabase PostgreSQL**: Transactional data (deals, users, Q&A, conversations)
- **Graphiti + Neo4j**: Knowledge graph with embeddings (vector + BM25 + graph hybrid search)
- Use **Transaction mode (port 6543)** for PostgreSQL connection pooling
- RLS enforced on PostgreSQL tables; Neo4j uses `group_id` namespacing

### Multi-Tenant Isolation

All database queries must include `project_id` in WHERE clauses. RLS policies enforce tenant isolation.

## Project Status

| Source | Content | Location |
|--------|---------|----------|
| **Current state** | Version, requirements, constraints | `.planning/PROJECT.md` |
| **Milestones** | Completed history with metrics | `.planning/MILESTONES.md` |
| **Decisions** | SCPs, ADRs with implementation status | `docs/decisions/README.md` |
| **Epics** | Implementation status by epic | `docs/manda-prd.md` |

### Status Commands

```bash
# GSD commands (if using GSD workflow)
/gsd:progress          # Current milestone, phases, next action
/gsd:check-todos       # Pending work items
```

## Subdirectory Context

Claude automatically loads context from subdirectory CLAUDE.md files based on what you're editing:

| Working on | Context loaded from |
|------------|---------------------|
| Agent code (`lib/agent/`) | `manda-app/lib/agent/CLAUDE.md` |
| Frontend (`manda-app/`) | `manda-app/CLAUDE.md` |
| Backend (`manda-processing/`) | `manda-processing/CLAUDE.md` |
| Documentation (`docs/`) | `docs/CLAUDE.md` |

## Documentation

- **PRD**: `docs/manda-prd.md` (v2.4)
- **Architecture**: `docs/manda-architecture.md` (v4.3)
- **Agent System**: `docs/features/agent-system/README.md` (consolidates all agent docs)
- **Testing Guide**: `docs/testing/testing-guide.md`
- **Decisions**: `docs/decisions/README.md`

## BMAD Framework

This project uses BMAD for AI-assisted development:
- `/bmad:bmm:workflows:dev-story` - Implement a user story
- `/bmad:bmm:workflows:code-review` - Adversarial code review
- `/bmad:bmm:workflows:create-story` - Create next story from epic
- `/bmad:bmm:workflows:sprint-status` - Check sprint progress
