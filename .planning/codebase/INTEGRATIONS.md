# External Integrations

**Analysis Date:** 2026-01-20

## APIs & External Services

**Large Language Models (Primary):**
- Claude (Anthropic) - Default model claude-sonnet-4-20250514
  - SDK/Client: `@langchain/anthropic` 1.1.3
  - Auth: `ANTHROPIC_API_KEY`
  - Config: `lib/llm/config.ts` + routing in `lib/llm/routing.ts`
  - Usage: Agent reasoning, CIM workflows, document analysis

- Google Gemini - Fallback/secondary models
  - SDK/Client: `@langchain/google-genai` 2.0.0
  - Models: gemini-2.5-pro (main), gemini-2.5-flash, gemini-2.5-flash-lite
  - Auth: `GOOGLE_AI_API_KEY`
  - Backend: `langchain-google-genai` for document analysis via FastAPI
  - Usage: Cost-optimized queries, document parsing analysis

- OpenAI GPT - Tertiary/testing
  - SDK/Client: `@langchain/openai` 1.1.3, `openai` 6.9.1
  - Models: gpt-4o, gpt-4o-mini (current routing uses these for testing)
  - Auth: `OPENAI_API_KEY`
  - Usage: Model routing tests, fallback reasoning

**Embeddings & Semantic Search:**
- Voyage AI (Primary) - voyage-3.5, rerank-2.5
  - SDK/Client: `voyageai` 0.1.0 (frontend), graphiti-core integration (backend)
  - Auth: `VOYAGE_API_KEY`
  - Models: voyage-3.5 (1024 dimensions), rerank-2.5
  - Backend Config: `manda-processing/src/config.py` lines 87-97
  - Purpose: Entity embeddings in Graphiti, retrieval reranking (E10.2, E10.7)

- Tokenization: `tiktoken` for token counting during chunking

**Document Processing:**
- Docling (ML-based)
  - SDK: `docling` 2.15.0+
  - Supports: PDF, DOCX, XLSX, TXT
  - Backend Integration: `manda-processing` document-parse pipeline
  - Purpose: Intelligent document layout parsing (E3.2)

- Supplementary Parsers:
  - `openpyxl` 3.1.5 - Excel parsing
  - `python-docx` 1.1.2 - Word document parsing

## Data Storage

**Databases:**

Primary (Transactional):
- Supabase PostgreSQL (managed)
  - SDK: `@supabase/supabase-js` 2.84.0 (frontend), `supabase` 2.10.0+ (backend)
  - Connection: Transaction mode on port 6543 for pooling
  - Auth Vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - RLS: Row Level Security enforced on all tables
  - Tables: deals, users, Q&A, conversations, documents, projects
  - Multi-tenant: `project_id` enforced in WHERE clauses
  - Backend Driver: `asyncpg` 0.30.0 for async operations
  - Operations: `lib/supabase/operations.ts` provides data access layer

Knowledge Graph:
- Neo4j 5.26+ (self-hosted or managed)
  - SDK: `neo4j-driver` 6.0.1 (frontend), `neo4j` 5.15.0+ (backend)
  - Connection: Bolt protocol (port 7687)
  - Auth Vars: `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`
  - Plugins: APOC required for vector similarity functions
  - Backend Integration: Graphiti for temporal facts + entity extraction
  - Models: Temporal knowledge graph with semantic embeddings
  - Multi-tenant: `group_id` namespacing for isolation
  - Purpose: Entity relationships, temporal facts, semantic search (E4.15, E10.1)

**File Storage:**
- Google Cloud Storage (GCS)
  - SDK: `@google-cloud/storage` 7.17.3 (frontend), `google-cloud-storage` 2.19.0+ (backend)
  - Auth: `GOOGLE_APPLICATION_CREDENTIALS` (service account JSON path)
  - Config: `GCS_BUCKET`, `GCS_PROJECT_ID`
  - Usage: Document uploads/storage, processing pipeline

**Caching:**
- Redis 7-alpine
  - SDK: `ioredis` 5.9.1
  - Connection: `REDIS_URL` (redis://localhost:6379 for dev)
  - Docker: `docker-compose.dev.yml` port 6379
  - Namespaces: Tool results, retrieval cache, summarization cache (defined in `lib/cache/redis-client.ts`)
  - TTL: Tool cache 30 minutes, 50 entry max
  - Purpose: Tool result isolation, retrieval acceleration, response caching (E13.8)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (built-in PostgreSQL authentication)
  - Implementation: OAuth2 + JWT-based
  - Client Code: `app/api/auth/signup/route.ts`, `app/api/auth/logout/route.ts`
  - Server: `lib/supabase/server.ts` for server-side auth in middleware
  - Middleware: `lib/supabase/middleware.ts` for request authentication
  - Sessions: Managed via JWTs (stored in httpOnly cookies)
  - Scopes: Standard email/password + OAuth integrations (configured in Supabase console)

**Multi-tenant:**
- Database isolation via `project_id` in WHERE clauses (enforced by RLS)
- Neo4j isolation via `group_id` namespacing
- All queries validated for tenant context

## Monitoring & Observability

**Error Tracking:**
- LangSmith (optional)
  - SDK: `langsmith` 0.4.5 (dev dependency only)
  - Enabled: `LANGCHAIN_TRACING_V2=true` + `LANGCHAIN_API_KEY`
  - Project: `manda-chat` (default, configurable via `LANGCHAIN_PROJECT`)
  - Config: `lib/llm/config.ts` lines 242-265

- Logfire (optional backend)
  - Package: `logfire` 3.0.0+ (dev dependency)
  - Purpose: Pydantic AI observability (E11.5)

**Logs:**
- Frontend: Console logs + structured logging via audit logger
  - Logger: `lib/audit/logger.ts`
  - Usage tracking: `lib/observability/usage.ts` (token/cost tracking)

- Backend: Structlog for structured output
  - Package: `structlog` 24.4.0+
  - Config: `LOG_LEVEL` (default INFO), `LOG_FORMAT` (json or console)
  - Docker: `docker-compose.yaml` sets `LOG_FORMAT=console` for dev

## CI/CD & Deployment

**Hosting:**
- Frontend: Vercel/self-hosted Next.js (docker-compose ready)
- Backend: Docker container (FastAPI + uvicorn)
- Database: Supabase (managed PostgreSQL)
- Graph: Neo4j (self-hosted or managed)
- Storage: Google Cloud Storage

**Docker:**
- Frontend: `manda-app/Dockerfile` (Next.js)
- Backend: `manda-processing/Dockerfile` + `Dockerfile.dev`
- Dev setup: `docker-compose.dev.yml` (Redis, Neo4j)
- Backend services: `manda-processing/docker-compose.yaml` (API, worker, PostgreSQL, Neo4j)

**CI Pipeline:**
- GitHub Actions
  - Workflows: `.github/workflows/ci.yml`, `benchmark.yml`
  - Tests: Unit (vitest/pytest), integration (RUN_INTEGRATION_TESTS=true), E2E (playwright)
  - Linting: ESLint (frontend), Ruff (backend)
  - Type checking: TypeScript, MyPy

## Environment Configuration

**Required env vars:**

Core Services:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase API endpoint
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public auth key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role for server operations
- `DATABASE_URL` - PostgreSQL connection string (backend)

AI/LLM:
- `ANTHROPIC_API_KEY` - Claude API key (if using Anthropic)
- `OPENAI_API_KEY` - GPT API key (if using OpenAI)
- `GOOGLE_AI_API_KEY` - Gemini API key (if using Google)
- `VOYAGE_API_KEY` - Voyage embeddings key

Graph & Storage:
- `NEO4J_URI` - Graph database connection
- `NEO4J_USER` - Neo4j username
- `NEO4J_PASSWORD` - Neo4j password
- `GOOGLE_APPLICATION_CREDENTIALS` - GCS service account key path
- `GCS_BUCKET` - GCS bucket name

Optional:
- `LANGCHAIN_TRACING_V2` - Enable LangSmith
- `LANGCHAIN_API_KEY` - LangSmith API key
- `LLM_PROVIDER` - Override default LLM provider
- `LLM_MODEL` - Override model selection
- `REDIS_URL` - Redis connection (dev only)

**Secrets location:**
- Frontend: `.env.local` (git-ignored, never commit)
- Backend: `.env` (git-ignored, never commit)
- Production: Environment variables set in deployment platform (Vercel, Cloud Run, etc.)
- Service Accounts: `manda-app/manda-storage-key.json` (local GCS, git-ignored)

## Job Queue

**pg-boss (PostgreSQL-backed):**
- SDK: `pg-boss` 12.3.1
- Schema: `pgboss` (configurable)
- Purpose: Async document processing pipeline
- Client: `lib/pgboss/client.ts`
- Jobs: `lib/pgboss/jobs.ts` defines all job types (document-parse, analyze-document, update-graph, detect-patterns, detect-contradictions)
- Enqueue: `lib/pgboss/enqueue.ts`
- Handler Registration: `lib/pgboss/register-handlers.ts`
- Handlers: `lib/pgboss/handlers/` directory
- Backend Integration: FastAPI consumes jobs from queue, posts results back to frontend
- Graceful shutdown: `lib/pgboss/shutdown.ts`

## Webhooks & Callbacks

**Incoming:**
- Supabase database webhooks (configured in Supabase console)
  - Purpose: Trigger processing on document upload
  - Endpoint: `app/api/webhooks/supabase` (implied from webhook patterns)
  - Secret: `WEBHOOK_SECRET` environment variable

- Backend processing callbacks
  - Document parse → analyze → ingest flow
  - Jobs enqueued from frontend, processed asynchronously

**Outgoing:**
- Backend → Frontend: No direct webhooks (uses pg-boss job queue)
- AI Model callbacks: None (synchronous API calls only)
- Knowledge graph updates: Direct Neo4j writes from backend (async via jobs)

## Real-time Features

**Server-Sent Events (SSE):**
- CIM MVP Chat: `/api/projects/[id]/cims/[cimId]/chat-mvp` streams tokens, workflow progress, slide updates
- v2 Chat Agent: `/api/projects/[id]/chat` streams tokens, source citations
- Implementation: `lib/agent/streaming.ts` provides SSE helpers
- Purpose: Real-time agent response streaming

## LangChain Integration

**Frontend:**
- `@langchain/langgraph` 1.0.7 - Agent StateGraph orchestration
- `@langchain/langgraph-checkpoint-postgres` 1.0.0 - Conversation persistence
- `@langchain/anthropic`, `@langchain/google-genai`, `@langchain/openai` - Model bindings
- Implementation: `lib/agent/v2/` (chat agent), `lib/agent/cim-mvp/` (CIM builder)
- Checkpointer: `lib/agent/checkpointer.ts` persists to Supabase via PostgresSaver

**Backend:**
- `langchain` 0.3.0+, `langchain-google-genai` 2.1.0+ - LLM chains
- `pydantic-ai` 1.0.0+ - Type-safe agent tools (E11.5)
- Purpose: Document analysis pipeline, entity extraction

---

*Integration audit: 2026-01-20*
