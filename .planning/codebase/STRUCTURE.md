# Codebase Structure

**Analysis Date:** 2026-01-20

## Directory Layout

```
manda-platform/
├── manda-app/                      # Next.js 16 frontend (React 19, Tailwind CSS 4)
│   ├── app/                        # Next.js App Router (pages, API routes)
│   │   ├── api/                    # API endpoints
│   │   ├── projects/               # Project workspace pages
│   │   ├── auth/                   # Authentication pages (login, signup, callback)
│   │   ├── layout.tsx              # Root layout with providers
│   │   └── globals.css             # Global Tailwind styles
│   ├── components/                 # React components organized by feature
│   │   ├── ui/                     # shadcn/ui components
│   │   ├── cim-builder/            # CIM builder UI
│   │   ├── chat/                   # Chat interface
│   │   ├── data-room/              # Document management
│   │   ├── irl/                    # Information Request List
│   │   ├── qa/                     # Q&A Builder
│   │   ├── knowledge-explorer/     # Neo4j graph visualization
│   │   ├── providers/              # Context providers (auth, org)
│   │   └── workspace/              # Project workspace layout
│   ├── lib/                        # Internal libraries
│   │   ├── agent/                  # Agent system
│   │   │   ├── v2/                 # v2 chat agent (LangGraph StateGraph)
│   │   │   ├── cim-mvp/            # CIM MVP agent (production)
│   │   │   ├── cim/                # Original CIM (legacy, superseded)
│   │   │   ├── tools/              # Tool definitions
│   │   │   ├── checkpointer.ts     # PostgreSQL state persistence
│   │   │   ├── streaming.ts        # SSE streaming helpers
│   │   │   └── retrieval.ts        # Pre-model retrieval hooks
│   │   ├── supabase/               # Supabase client factory
│   │   ├── neo4j/                  # Neo4j client and query builders
│   │   ├── services/               # Business logic (23 files)
│   │   │   ├── cim.ts              # CIM operations
│   │   │   ├── cim-export.ts       # CIM export to PowerPoint/PDF
│   │   │   ├── irl-export.ts       # IRL export
│   │   │   ├── irl-import.ts       # IRL import
│   │   │   ├── qa.ts               # Q&A operations
│   │   │   ├── corrections.ts      # Correction tracking
│   │   │   ├── correction-propagation.ts  # Cascade corrections
│   │   │   ├── audit-trail.ts      # Audit log operations
│   │   │   └── ... (18 more)
│   │   ├── types/                  # TypeScript type definitions
│   │   ├── hooks/                  # React hooks (17 files)
│   │   ├── llm/                    # LLM integrations
│   │   ├── api/                    # Frontend API client
│   │   ├── auth/                   # Auth utilities
│   │   ├── utils/                  # Utility functions
│   │   ├── errors/                 # Error definitions
│   │   ├── cache/                  # Caching layer
│   │   ├── pgboss/                 # pg-boss queue client
│   │   ├── gcs/                    # Google Cloud Storage
│   │   └── observability/          # Logging/tracing
│   ├── stores/                     # Zustand state management
│   │   └── upload-store.ts         # Document upload state
│   ├── hooks/                      # Convenience re-export directory
│   ├── styles/                     # CSS modules
│   ├── public/                     # Static assets
│   ├── supabase/                   # Supabase migrations
│   ├── e2e/                        # Playwright E2E tests
│   ├── __tests__/                  # Unit and integration tests
│   ├── playwright/                 # Playwright config
│   ├── scripts/                    # Build/utility scripts
│   └── package.json                # Frontend dependencies

├── manda-processing/               # FastAPI backend (Python 3.12+)
│   ├── src/
│   │   ├── main.py                 # FastAPI app initialization
│   │   ├── config.py               # Settings (Pydantic ConfigSettings)
│   │   ├── api/
│   │   │   ├── routes/             # API endpoint handlers
│   │   │   │   ├── health.py       # Health checks
│   │   │   │   ├── webhooks.py     # Document processing webhooks
│   │   │   │   ├── search.py       # Neo4j search
│   │   │   │   ├── processing.py   # Job queue status
│   │   │   │   ├── entities.py     # Entity queries
│   │   │   │   ├── financials.py   # Financial metrics
│   │   │   │   ├── graphiti.py     # Graphiti queries
│   │   │   │   └── agents.py       # Agent endpoints
│   │   │   └── middleware/         # FastAPI middleware
│   │   ├── jobs/
│   │   │   ├── __main__.py         # Worker entry point
│   │   │   ├── queue.py            # pg-boss wrapper
│   │   │   ├── worker.py           # Worker process orchestration
│   │   │   ├── retry_manager.py    # Retry logic
│   │   │   ├── errors.py           # Job error definitions
│   │   │   └── handlers/           # Job type handlers
│   │   │       ├── document_parse.py       # Docling parsing
│   │   │       ├── analyze_document.py     # Gemini analysis
│   │   │       ├── extract_financials.py   # Financial extraction
│   │   │       ├── ingest_graphiti.py      # Graphiti/Neo4j ingestion
│   │   │       ├── embed_chunks.py         # Voyage embeddings (fast path)
│   │   │       ├── detect_contradictions.py
│   │   │       └── ... (more handlers)
│   │   ├── parsers/                # Document parsing
│   │   │   └── docling.py          # Docling wrapper
│   │   ├── embeddings/             # Embedding generation
│   │   │   └── voyage.py           # Voyage 1024-dim embeddings
│   │   ├── reranking/              # Semantic reranking
│   │   │   └── voyage.py           # Voyage rerank-2.5
│   │   ├── graphiti/               # Knowledge graph
│   │   │   ├── client.py           # Graphiti API client
│   │   │   ├── schema/             # Graph schema definitions
│   │   │   └── ingestion.py        # Fact ingestion pipeline
│   │   ├── neo4j/                  # Neo4j driver
│   │   ├── llm/                    # LLM integration
│   │   │   ├── gemini.py           # Gemini 2.5 Flash
│   │   │   └── tools/              # Pydantic AI tools
│   │   ├── agents/                 # Agent implementations
│   │   │   ├── schemas/            # Pydantic AI schemas
│   │   │   └── tools/              # Agent tool definitions
│   │   ├── models/                 # Data models
│   │   │   ├── findings.py         # Finding model
│   │   │   └── financial_metrics.py
│   │   ├── financial/              # Financial parsing
│   │   ├── storage/                # GCS interaction
│   │   ├── observability/          # Logging setup
│   │   ├── scripts/                # Utility scripts
│   │   └── errors/                 # Error definitions
│   ├── tests/
│   │   ├── unit/                   # Unit tests
│   │   ├── integration/            # Integration tests
│   │   └── fixtures/               # Test fixtures
│   ├── config/                     # Config files
│   ├── pyproject.toml              # Python dependencies (uv)
│   ├── pytest.ini                  # Pytest configuration
│   └── docker-compose.yml          # Docker setup

├── docs/                           # Documentation
│   ├── manda-prd.md               # Product requirements
│   ├── manda-architecture.md      # Architecture guide
│   ├── agent-system/              # Agent system docs
│   ├── cim-mvp/                   # CIM MVP documentation
│   ├── decisions/                 # Architecture decision records
│   ├── sprint-artifacts/          # Sprint planning docs
│   └── testing/                   # Testing guides

├── .planning/                      # GSD planning documents
│   └── codebase/                   # This codebase analysis
│       ├── ARCHITECTURE.md         # Architecture patterns
│       ├── STRUCTURE.md            # Directory structure (this file)
│       ├── CONVENTIONS.md          # Coding conventions
│       ├── TESTING.md              # Testing patterns
│       ├── STACK.md                # Technology stack
│       ├── INTEGRATIONS.md         # External integrations
│       └── CONCERNS.md             # Technical debt & issues

├── _bmad-output/                   # BMAD AI workflow artifacts
├── cim-workflow/                   # CIM workflow definitions
├── data/                           # Test data files
├── docker-compose.dev.yml          # Development Docker setup
├── CLAUDE.md                       # Claude development guide
└── README.md                       # Project README
```

## Directory Purposes

**`manda-app/app/`:**
- Purpose: Next.js App Router - defines routes, pages, API endpoints
- Contains: Route groups, dynamic segments [id], API handler functions
- Key files: `layout.tsx` (root), `page.tsx` (per route), `route.ts` (API handlers)

**`manda-app/components/`:**
- Purpose: Reusable React components organized by business domain
- Contains: Feature-specific components (CIM, Chat, IRL), UI primitives
- Key files: `CIMBuilderPage.tsx`, `ChatInterface.tsx`, `DataRoomTable.tsx`

**`manda-app/lib/agent/`:**
- Purpose: LangGraph-based agent orchestration
- Contains: State schemas, node definitions, tool execution, streaming
- Key files: `v2/graph.ts` (chat agent), `cim-mvp/graph.ts` (CIM agent)

**`manda-app/lib/services/`:**
- Purpose: Business logic abstraction layer
- Contains: CRUD operations, complex workflows, data transformations
- Key files: `cim.ts` (CIM operations), `irl-export.ts` (export logic)

**`manda-app/lib/supabase/` and `lib/neo4j/`:**
- Purpose: Database access abstraction
- Contains: Client factories, query builders, type-safe wrappers
- Key files: `server.ts` (Supabase client), `query.ts` (Neo4j queries)

**`manda-processing/src/jobs/`:**
- Purpose: Async job execution system
- Contains: Queue management, worker orchestration, job handlers
- Key files: `worker.py` (process loop), `handlers/` (job type executors)

**`manda-processing/src/api/routes/`:**
- Purpose: FastAPI HTTP endpoints
- Contains: Request validation, business logic invocation, response formatting
- Key files: `health.py`, `webhooks.py`, `search.py`

**`manda-processing/src/parsers/`, `src/embeddings/`, `src/graphiti/`:**
- Purpose: Document processing pipeline
- Contains: Docling parsing, embedding generation, knowledge graph ingestion
- Key files: `docling.py`, `voyage.py`, `ingestion.py`

## Key File Locations

**Entry Points:**

- `manda-app/app/layout.tsx` - Root React layout with providers
- `manda-app/app/page.tsx` - Homepage
- `manda-app/app/projects/[id]/cim-builder/page.tsx` - CIM builder UI
- `manda-app/app/projects/[id]/chat/page.tsx` - Chat interface
- `manda-processing/src/main.py` - FastAPI app initialization
- `manda-processing/src/jobs/__main__.py` - Worker startup

**API Endpoints:**

- `manda-app/app/api/projects/[id]/chat-v2/route.ts` - Chat v2 agent entry
- `manda-app/app/api/projects/[id]/cims/[cimId]/chat-mvp/route.ts` - CIM MVP agent entry
- `manda-app/app/api/documents/upload/route.ts` - Document upload handler
- `manda-processing/src/api/routes/health.py` - Health check endpoint

**Agent Implementation:**

- `manda-app/lib/agent/v2/graph.ts` - Chat agent state machine
- `manda-app/lib/agent/v2/state.ts` - Unified agent state schema
- `manda-app/lib/agent/v2/nodes/supervisor.ts` - Main routing node
- `manda-app/lib/agent/cim-mvp/graph.ts` - CIM MVP state machine
- `manda-app/lib/agent/cim-mvp/knowledge-loader.ts` - JSON knowledge loader
- `manda-app/lib/agent/checkpointer.ts` - PostgreSQL state persistence

**State & Persistence:**

- `manda-app/lib/agent/v2/state.ts` - AgentState Annotation definition
- `manda-app/lib/agent/checkpointer.ts` - PostgresSaver implementation
- `manda-app/stores/upload-store.ts` - Zustand upload UI state

**Tools & Actions:**

- `manda-app/lib/agent/tools/` - Tool definitions by category
- `manda-app/lib/services/` - Business logic (23 service files)
- `manda-processing/src/jobs/handlers/` - Job type executors

**Database Access:**

- `manda-app/lib/supabase/server.ts` - Server-side Supabase client factory
- `manda-app/lib/neo4j/query.ts` - Neo4j query builders
- `manda-processing/src/graphiti/client.py` - Graphiti API wrapper

**Testing:**

- `manda-app/__tests__/` - Unit and integration tests
- `manda-app/e2e/` - Playwright E2E tests
- `manda-processing/tests/` - Pytest tests
- Test patterns: Mock external services, use fixtures for data

**Configuration:**

- `manda-app/package.json` - Frontend dependencies, scripts, build config
- `manda-processing/pyproject.toml` - Backend dependencies (uv format)
- `CLAUDE.md` - Development commands and patterns
- `.planning/codebase/` - This codebase analysis

## Naming Conventions

**Files:**
- TypeScript/TSX: `kebab-case.ts`, `kebab-case.tsx` (e.g., `chat-interface.tsx`)
- Python: `snake_case.py` (e.g., `document_parse.py`)
- Components: PascalCase directory + index export (e.g., `CIMBuilder/index.tsx`)
- Tests: `{name}.test.ts`, `{name}.test.tsx`, `test_{name}.py`
- Services: `{domain}.ts` (e.g., `cim.ts`, `irl-export.ts`)

**Directories:**
- Feature domains: `kebab-case` (e.g., `cim-builder`, `data-room`, `knowledge-explorer`)
- Utilities: descriptive plural (e.g., `services`, `hooks`, `tools`, `handlers`)
- API routes: Dynamic segments `[param]`, files `route.ts`
- Nested domains: Path-based hierarchy (e.g., `api/projects/[id]/chat-v2`)

**Code Identifiers:**
- Variables/functions: `camelCase` (e.g., `cimState`, `workflowMode`, `activeSpecialist`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_WORKER_CONFIG`)
- Types/Interfaces: `PascalCase` (e.g., `AgentState`, `CIMMVPStateType`, `WorkflowMode`)
- React Hooks: `useXxx` (e.g., `useCIMMVPChat`, `useChat`, `useContradictionsRealtime`)

**LangGraph:**
- Graph nodes: Short descriptive names (e.g., `'supervisor'`, `'retrieval'`, `'agent'`)
- Thread IDs: Format-specific (e.g., `cim-mvp:${cimId}`, `{workflow}:{dealId}:{userId}:{convId}`)

## Where to Add New Code

**New Feature:**
- Primary code: `manda-app/components/{feature-name}/` for UI, `manda-app/lib/services/{feature}.ts` for logic
- Tests: `manda-app/__tests__/{path}/` mirroring src structure
- API routes: `manda-app/app/api/{resource}/route.ts`
- Example: CIM Builder spans `components/cim-builder/`, `lib/services/cim.ts`, `lib/agent/cim-mvp/`

**New Component/Module:**
- Implementation: `manda-app/components/{category}/{ComponentName}/index.tsx`
- Hooks (if needed): `manda-app/lib/hooks/use{ComponentName}.ts`
- Services (if needed): `manda-app/lib/services/{component}.ts`
- Tests: `manda-app/__tests__/components/{category}/{ComponentName}.test.tsx`

**Utilities:**
- Shared helpers: `manda-app/lib/utils/` for generic utilities
- Domain-specific: Place near domain (e.g., `lib/agent/utils/` for agent utilities)
- Type definitions: `manda-app/lib/types/` for shared types

**Backend Job Handler:**
- Implementation: `manda-processing/src/jobs/handlers/{job_name}.py`
- Registration: Add to `Worker.register()` in `src/jobs/__main__.py`
- Tests: `manda-processing/tests/unit/test_jobs/test_{job_name}.py`

**Backend API Route:**
- Implementation: `manda-processing/src/api/routes/{resource}.py`
- Registration: Add import and router inclusion in `src/main.py`
- Tests: `manda-processing/tests/unit/test_api/test_{resource}.py`

**Database Queries:**
- Supabase: Add method to appropriate service file (e.g., `lib/services/cim.ts`)
- Neo4j: Add to `lib/neo4j/query.ts` as reusable function
- Patterns: Always filter by `project_id` (Supabase), `group_id` (Neo4j) for multi-tenant safety

## Special Directories

**`manda-app/.next/`:**
- Purpose: Next.js build output directory
- Generated: Yes (during `npm run build`)
- Committed: No (.gitignored)

**`manda-processing/.venv/`:**
- Purpose: Python virtual environment
- Generated: Yes (via `uv venv .venv`)
- Committed: No (.gitignored)

**`manda-app/node_modules/`, `manda-processing/__pycache__/`:**
- Purpose: Dependency caches
- Generated: Yes
- Committed: No

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents (this directory)
- Generated: By codebase mapper tool
- Committed: Yes (for reference by other tools)

**`manda-app/supabase/migrations/`:**
- Purpose: Supabase database migration SQL files
- Generated: By `npm run db:push` or manual creation
- Committed: Yes (schema versioning)

**`docs/decisions/`:**
- Purpose: Architecture decision records (ADRs)
- Generated: By team during planning
- Committed: Yes (decision history)

**`_bmad-output/`:**
- Purpose: BMAD AI workflow artifacts (PRD, architecture specs)
- Generated: By BMAD planning workflows
- Committed: Yes (for reference)

---

*Structure analysis: 2026-01-20*
