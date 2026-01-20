# Technology Stack

**Analysis Date:** 2026-01-20

## Languages

**Primary:**
- TypeScript 5 - Frontend (Next.js 16, React 19)
- Python 3.12+ - Backend (FastAPI, Docling, LangChain)

**Secondary:**
- JavaScript - Build tooling, scripts
- YAML - Configuration files (models)

## Runtime

**Environment:**
- Node.js (npm via package-lock.json, version unspecified)
- Python 3.12+ (uv package manager)

**Package Manager:**
- Frontend: npm v10+ (inferred from package-lock.json)
- Backend: uv (modern Python package manager)
- Lockfile: npm package-lock.json present

## Frameworks

**Core:**
- Next.js 16.0.7 - Full-stack React framework with App Router, Turbopack dev server
- FastAPI 0.115.0+ - Python async web framework with auto-generated OpenAPI docs
- React 19.2.1 - Frontend UI library (server/client components)

**Styling & UI:**
- Tailwind CSS 4 - Utility-first CSS with PostCSS
- shadcn/ui - Headless component library built on Radix UI
- Radix UI 1.x - Accessible component primitives

**Testing:**
- Vitest 4.0.14 - Unit and integration test runner (ESM native)
- Playwright 1.57.0 - E2E testing with multi-browser support
- pytest 8.3.0+ - Python test framework with asyncio auto-mode
- Testing Library (Jest-DOM, React, User Event) - DOM assertion and interaction testing

**Build/Dev:**
- Turbopack - Next.js 16 default build engine (replaces Webpack)
- Vite 5.x - Dev server via @vitejs/plugin-react
- TypeScript 5 - Type checking via `tsc --noEmit`
- ESLint 9 - Linting (flat config format)
- Ruff 0.8.0+ - Python linting (E/F/I/N/W/UP/B/C4/SIM rules)
- MyPy 1.13.0+ - Python type checking (strict mode)

## Key Dependencies

**Critical:**

Frontend:
- `@langchain/langgraph` 1.0.7 - Agent orchestration framework
- `@langchain/anthropic` 1.1.3 - Claude integration
- `@langchain/google-genai` 2.0.0 - Google Gemini integration
- `@langchain/openai` 1.1.3 - OpenAI GPT integration
- `@supabase/supabase-js` 2.84.0 - PostgreSQL/Auth client
- `neo4j-driver` 6.0.1 - Graph database driver
- `pg-boss` 12.3.1 - PostgreSQL-backed job queue
- `zustand` 5.0.8 - Client state management
- `ioredis` 5.9.1 - Redis client for caching

Backend:
- `graphiti-core[google-genai,voyageai]` 0.3.0+ - Temporal knowledge graph with embeddings
- `docling` 2.15.0+ - ML-based document parsing (PDF, DOCX, XLSX)
- `langchain` 0.3.0+ - LLM orchestration framework
- `langchain-google-genai` 2.1.0+ - Google Gemini for analysis
- `pydantic-ai` 1.0.0+ - Type-safe agent tools (E11.5)
- `asyncpg` 0.30.0 - PostgreSQL async driver
- `supabase` 2.10.0+ - Supabase client
- `neo4j` 5.15.0+ - Neo4j driver for graph operations
- `google-cloud-storage` 2.19.0+ - GCS file storage

**Infrastructure:**
- `@supabase/ssr` 0.7.0 - Server-side rendering auth helper
- `@langchain/langgraph-checkpoint-postgres` 1.0.0 - LangGraph persistence
- `langsmith` 0.4.5+ - LangChain observability (optional dev dependency)
- `logfire` 3.0.0+ - Pydantic AI observability (optional backend dependency)
- `structlog` 24.4.0+ - Structured logging for backend
- `tenacity` 9.0.0+ - Retry library for resilience
- `pyyaml` 6.0.0+ - Model config YAML loading (E11.6)

**Data Export/Document Generation:**
- `pptxgenjs` 4.0.1 - PowerPoint generation
- `docx` 9.5.1 - Word document generation
- `exceljs` 4.4.0 - Excel spreadsheet generation
- `pdfmake` 0.2.20 - PDF generation
- `csv-stringify` 6.6.0 - CSV export

**Utilities:**
- `zod` 4.1.13 - Schema validation and TypeScript inference
- `langchain` 1.1.1 - Frontend LLM utilities
- `openai` 6.9.1 - OpenAI API client (frontend backup)
- `voyageai` 0.1.0 - Voyage embeddings client
- `tiktoken` 0.9.0+ - Token counting for chunking
- `httpx` 0.28.0+ - Async HTTP client (backend)
- `recharts` 2.15.0 - Data visualization
- `lucide-react` 0.554.0 - Icon library
- `react-markdown` 10.1.0 - Markdown rendering
- `sonner` 2.0.7 - Toast notifications
- `date-fns` 4.1.0 - Date utilities

## Configuration

**Environment:**
- Frontend: `.env.local` with NEXT_PUBLIC_ prefix for client-side vars
- Backend: `.env` with Pydantic Settings auto-loading
- Both: Supabase (PostgreSQL), Neo4j, GCS, LLM API keys required

**Key Environment Variables:**

Frontend:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEO4J_URI (bolt://localhost:7687)
NEO4J_USER / NEO4J_PASSWORD
GOOGLE_APPLICATION_CREDENTIALS
OPENAI_API_KEY
GOOGLE_AI_API_KEY
GOOGLE_VERTEX_PROJECT / GOOGLE_VERTEX_LOCATION
ANTHROPIC_API_KEY (optional)
LLM_PROVIDER (default: anthropic)
LLM_MODEL (defaults: claude-sonnet-4-20250514 for Anthropic)
LANGCHAIN_TRACING_V2 (optional observability)
LANGCHAIN_API_KEY (optional LangSmith)
REDIS_URL (redis://localhost:6379)
```

Backend:
```
APP_ENV (development|staging|production)
DATABASE_URL (Supabase PostgreSQL)
SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
NEO4J_URI / NEO4J_USER / NEO4J_PASSWORD
GRAPHITI_SEMAPHORE_LIMIT (concurrency for entity extraction)
GCS_BUCKET / GCS_PROJECT_ID / GOOGLE_APPLICATION_CREDENTIALS
OPENAI_API_KEY / EMBEDDING_MODEL
GOOGLE_API_KEY / GEMINI_FLASH_MODEL / GEMINI_PRO_MODEL
VOYAGE_API_KEY / VOYAGE_EMBEDDING_MODEL
API_KEY (for authentication)
WEBHOOK_SECRET (for Supabase webhooks)
```

**Build:**

Frontend (`manda-app/`):
- `tsconfig.json` - Strict TypeScript with path alias `@/*` mapping to root
- `next.config.js` - Next.js configuration
- `eslint.config.mjs` - ESLint flat config format (v9)
- `.env.example` - Template for required environment variables

Backend (`manda-processing/`):
- `pyproject.toml` - uv package management, pytest config, Ruff/MyPy settings
- `Dockerfile.dev` - Development container
- `.env.example` - Environment template

## Platform Requirements

**Development:**
- Node.js 18+ (inferred, no explicit .nvmrc)
- Python 3.12+
- Docker & Docker Compose (for Neo4j, Redis, PostgreSQL local dev)
- uv (Python package manager for backend)
- npm (for frontend)

**Production:**
- Hosted: Supabase PostgreSQL (managed)
- Hosted: Neo4j 5.26+ (community or paid, requires APOC plugin)
- Hosted: Redis for caching (self-hosted or managed)
- Hosted: Google Cloud Storage for documents
- Deployment: Docker containers for both services
- CI/CD: GitHub Actions (`.github/workflows/ci.yml`, `benchmark.yml`)

**Local Services (docker-compose):**
- Redis 7-alpine (port 6379)
- Neo4j 5.26-community with APOC (ports 7474 HTTP, 7687 Bolt)
- PostgreSQL 16-alpine (backend only, optional with Supabase)

---

*Stack analysis: 2026-01-20*
