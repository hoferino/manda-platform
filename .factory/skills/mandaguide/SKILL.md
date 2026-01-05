---
name: mandaguide
description: Provide context-aware guidance for the Manda platform M&A intelligence system. Use when working on Manda-specific features or architecture.
---

# Manda Platform Guide

## Context

Manda is an M&A intelligence platform with:
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **Backend**: Python 3.12+, FastAPI, Pydantic
- **Knowledge Graph**: Graphiti + Neo4j with Voyage embeddings (moved from pgvector in E10)
- **Database**: Supabase PostgreSQL (RLS enabled, multi-tenant)
- **Queue**: pg-boss for job processing

## Architecture Decisions (E10 Pivot)

As of 2025-12-17, all vector operations use Neo4j:
- **Removed**: pgvector for embeddings storage
- **Current**: Voyage voyage-3.5 (1024-dim embeddings stored in Neo4j)
- **Reranking**: Voyage rerank-2.5 for 20-35% better retrieval accuracy
- **Search**: Hybrid vector + BM25 + graph traversal

## Multi-Tenant Requirements

**CRITICAL**: All operations must be tenant-isolated:
- Every database query MUST include `project_id` in WHERE clause
- RLS policies enforce this at database level
- Neo4j uses `group_id` for tenant isolation
- When testing, verify tenant isolation is maintained

## Document Processing Pipeline

```
Upload → GCS → Webhook → pg-boss → Workers
                    ↓
    Docling parsing → Graphiti ingest → Gemini analysis → Financial extraction
```

## Code Conventions

### Frontend (manda-app/)
- Server Components by default, `"use client"` only when needed
- Use Supabase Auth: `createClient()` from `lib/supabase/server.ts`
- shadcn/ui components in `components/ui/`
- Add components: `npx shadcn@latest add [name]`

### Backend (manda-processing/)
- FastAPI endpoints in `src/api/routes/`
- Job handlers in `src/jobs/handlers/`
- Configuration in `src/config.py`
- Structured logging with `structlog`

## Testing Requirements

### Frontend
- Unit: `npm run test:run` (Vitest)
- Integration: `npm run test:integration` (requires `RUN_INTEGRATION_TESTS=true`)
- E2E: `npm run test:e2e` (Playwright, needs dev server running)

### Backend
- `pytest` for unit tests
- Integration tests marked with `@pytest.mark.integration`
- Use `pytest --cov=src --cov-report=html` for coverage
- Lint with `ruff check .`
- Type check with `mypy src`

## Before Starting Work

1. Check `CLAUDE.md` for detailed project documentation
2. Check `.factory/memories.md` for architecture decisions
3. Check `.factory/rules/` for coding conventions
4. For new epics: Review `docs/sprint-artifacts/epics/`

## Common Patterns

### Database Operations
```python
# Correct - tenant-isolated
SELECT * FROM deals WHERE project_id = {project_id}
# Wrong - missing tenant filter
SELECT * FROM deals
```

### Document Ingestion
- All documents go through Graphiti knowledge graph
- Voyage embeddings are created during ingest-graphiti phase
- Gemini 2.5 Flash analyzes extracted content

### State Management
- Client state: Zustand
- Server state: React Query
- Server actions for mutations

## Troubleshooting

- **Neo4j not responding**: Check `docker-compose -f docker-compose.dev.yml up -d`
- **Tests failing**: Run with `-v` for verbose output
- **Type errors**: Check `npm run type-check` or `mypy src`
- **Linting issues**: Run `npm run lint` or `ruff check .`
