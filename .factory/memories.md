# Manda Platform Project Memories

## Architecture Decisions

### Knowledge Graph (E10 Pivot)
- Consolidated to Graphiti + Neo4j for all embeddings and semantic search (2025-12-17)
- Removed pgvector - all vector operations now in Neo4j
- Voyage voyage-3.5 embeddings (1024 dimensions)
- Voyage rerank-2.5 for improved retrieval (20-35% better accuracy)
- Graph search: hybrid vector + BM25 + graph traversal
- Multi-tenant isolation via `group_id` namespacing in Neo4j

### Tech Stack
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **Backend**: Python 3.12+, FastAPI, Pydantic
- **Database**: Supabase PostgreSQL (port 6543, Transaction mode enabled)
- **Queue**: pg-boss shared between Next.js and Python
- **LLM**: Gemini 2.5 Flash for document analysis
- **Document Parsing**: Docling (PDF, DOCX, XLSX)

### Multi-Tenant Pattern
- All database queries MUST include `project_id` in WHERE clauses
- RLS (Row Level Security) enforced at database level
- Neo4j uses `group_id` for tenant isolation

## Document Processing Pipeline

```
Upload → GCS Storage → Webhook → pg-boss Queue → Workers
                                      ↓
              document-parse (Docling) → ingest-graphiti (Voyage embeddings)
                                      ↓
              analyze-document (Gemini) → extract-financials
```

## Known Issues & Considerations

### Documentation Files
- PRD: `docs/manda-prd.md` (v1.9)
- Architecture: `docs/manda-architecture.md` (v3.3)
- Sprint change proposals: `docs/sprint-artifacts/sprint-change-proposal-*.md`

### Testing Strategy
- Frontend: Vitest (unit), Playwright (E2E), Integration tests with env var
- Backend: pytest with asyncio auto-enabled
- All external services should be mocked in unit tests
- Integration tests require `RUN_INTEGRATION_TESTS=true`

### Frontend Patterns
- App Router in `app/` directory
- Server Components by default
- API routes in `app/api/`
- Supabase Auth: use `createClient()` from `lib/supabase/server.ts`
- Add shadcn/ui components with `npx shadcn@latest add [name]`

### Backend Patterns
- API endpoints in `src/api/routes/`
- Job handlers in `src/jobs/handlers/`
- Configuration in `src/config.py`
- Structured logging with `structlog`

## Important Notes

- Always check `CLAUDE.md` for detailed project context
- The project uses the BMAD framework for AI-assisted development
- LangChain is used for LLM operations in both services
- Database migrations are managed through Supabase
- Neo4j can be started with `docker-compose -f docker-compose.dev.yml up -d`
