# Manda Platform - Comprehensive Project Index

**Generated:** 2025-12-13
**Last Updated:** 2025-12-19
**Scan Level:** Exhaustive
**Project Type:** Multi-part Monorepo (Web + Backend)

> **Architecture Note (E10 Pivot - 2025-12-17):** Knowledge architecture consolidated from pgvector + Neo4j dual-database to unified Graphiti + Neo4j. See [Sprint Change Proposal 2025-12-15](sprint-change-proposal-2025-12-15.md).

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Structure](#2-repository-structure)
3. [Technology Stack](#3-technology-stack)
4. [Architecture Overview](#4-architecture-overview)
5. [Data Models & Schema](#5-data-models--schema)
6. [API Reference](#6-api-reference)
7. [Component Library](#7-component-library)
8. [Testing Infrastructure](#8-testing-infrastructure)
9. [Development Guide](#9-development-guide)
10. [Documentation Index](#10-documentation-index)

---

## 1. Project Overview

### Vision

**Manda** is an M&A Intelligence Platform that transforms how analysts work with complex deal information. It combines:

- **Deal-Centric Data Room**: Secure document storage, organization, and versioning
- **Knowledge Base**: Persistent storage of findings, insights, contradictions, and relationships
- **Background Processing Engine**: Autonomous document analysis and intelligence building
- **Intelligent Agent Layer**: Natural language interaction with LangChain-powered AI agents

### Implementation Status

| Epic | Status | Description |
|------|--------|-------------|
| E1: Project Foundation | ✅ Complete | Next.js 16, Supabase, Neo4j, pg-boss |
| E2: Document Ingestion | ✅ Complete | GCS upload, folder structure, IRL integration |
| E3: Document Processing | ✅ Complete | Docling parsing, embeddings, LLM analysis |
| E4: Knowledge Explorer | ✅ Complete | Findings browser, contradictions, gaps |
| E5: Conversational Assistant | ✅ Complete | LangChain agent with 11 tools |
| E6: IRL Management | ✅ Complete | Templates, auto-generation, export |
| E7: Learning Loop | ✅ Complete | Corrections, feedback, audit trail |
| E8: Q&A Co-Creation | ✅ Complete | Question/answer management |
| E9: CIM Builder | ✅ Complete | AI-powered document generation |
| E10: Knowledge Graph Foundation | ✅ Complete | Graphiti + Neo4j, Voyage embeddings, hybrid retrieval |
| E11: Agent Context Engineering | In Progress | Context engineering, Pydantic AI |
| E12: Testing & Stabilization | In Progress | E2E testing, error handling |

---

## 2. Repository Structure

```
manda-platform/
├── manda-app/                    # Next.js 16 Frontend Application
│   ├── app/                      # App Router pages and API routes
│   │   ├── api/                  # ~80+ API route handlers
│   │   ├── projects/[id]/        # Project workspace routes
│   │   ├── login/, signup/       # Auth pages
│   │   └── layout.tsx            # Root layout
│   ├── components/               # React components (~150+)
│   │   ├── ui/                   # shadcn/ui primitives
│   │   ├── chat/                 # Chat interface components
│   │   ├── cim-builder/          # CIM builder components
│   │   ├── data-room/            # Data room components
│   │   ├── knowledge-explorer/   # Findings, contradictions, gaps
│   │   ├── irl/                  # IRL builder components
│   │   └── feedback/             # Review queue, audit trail
│   ├── lib/                      # Core libraries
│   │   ├── agent/                # LangChain agent implementation
│   │   ├── api/                  # API client functions
│   │   ├── hooks/                # React hooks (~20+)
│   │   ├── llm/                  # LLM configuration
│   │   ├── neo4j/                # Graph database client
│   │   ├── pgboss/               # Job queue handlers
│   │   ├── services/             # Business logic services
│   │   └── supabase/             # Database client & types
│   ├── stores/                   # Zustand state stores
│   ├── supabase/migrations/      # 39+ SQL migrations
│   ├── e2e/                      # Playwright E2E tests
│   └── __tests__/                # Vitest unit tests (~55+)
│
├── manda-processing/             # Python FastAPI Backend
│   ├── src/
│   │   ├── api/routes/           # FastAPI endpoints
│   │   ├── jobs/handlers/        # Background job handlers
│   │   ├── parsers/              # Document parsers (Docling, Excel, PDF)
│   │   ├── embeddings/           # OpenAI embedding client
│   │   ├── llm/                  # Gemini LLM integration
│   │   ├── financial/            # Financial metric extraction
│   │   ├── storage/              # GCS & Neo4j clients
│   │   └── config.py             # Pydantic settings
│   └── tests/                    # pytest test suite
│
├── manda-designs/                # Design system artifacts (Vite)
│
├── docs/                         # Project documentation
│   ├── manda-prd.md              # Product Requirements Document
│   ├── manda-architecture.md     # Architecture Document
│   ├── test-design-system.md     # Test strategy
│   ├── agent-behavior-spec.md    # AI agent specification
│   ├── diagrams/                 # Excalidraw diagrams
│   └── sprint-artifacts/         # Epics, stories, tech specs
│
└── .bmad/                        # BMAD workflow configuration
```

---

## 3. Technology Stack

### Frontend (manda-app)

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Framework | Next.js | 16.0.7 | App Router, Server Components |
| UI Library | React | 19.2.1 | Component rendering |
| Language | TypeScript | 5.x | Type safety (strict mode) |
| Styling | Tailwind CSS | 4.x | Utility-first CSS with OKLCH |
| Components | shadcn/ui | latest | Accessible component library |
| State | Zustand | 5.0.8 | Client state management |
| Tables | TanStack Table | 8.21.3 | Data grid components |
| Forms | Zod | 4.1.13 | Schema validation |
| AI/LLM | LangChain | 1.1.1 | Agent orchestration |
| Database | Supabase | 2.84.0 | PostgreSQL + Auth + Realtime |
| Graph DB | Neo4j Driver | 6.0.1 | Knowledge graph |
| Job Queue | pg-boss | 12.3.1 | Background processing |
| Cloud Storage | GCS SDK | 7.17.3 | Document storage |

### Backend (manda-processing)

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Framework | FastAPI | 0.115.0 | REST API |
| Language | Python | 3.12+ | Backend processing |
| Settings | Pydantic | 2.10.0 | Configuration |
| Doc Parsing | Docling | 2.15.0 | PDF, DOCX, Excel |
| Embeddings | OpenAI | 1.82.0 | text-embedding-3-large |
| LLM | LangChain | 0.3.0 | Gemini 2.5 integration |
| Database | asyncpg | 0.30.0 | PostgreSQL async |
| Graph DB | Neo4j | 5.15.0 | Knowledge graph |
| Cloud Storage | GCS | 2.19.0 | Document access |

### Testing

| Tool | Scope | Configuration |
|------|-------|---------------|
| Vitest | Unit tests (TS) | `vitest.config.ts` |
| React Testing Library | Component tests | `vitest.setup.ts` |
| Playwright | E2E tests | `playwright.config.ts` |
| pytest | Unit tests (Python) | `pyproject.toml` |

### Infrastructure

| Service | Purpose |
|---------|---------|
| Supabase | PostgreSQL, Auth, pgvector, Realtime |
| Google Cloud Storage | Document file storage |
| Neo4j | Knowledge graph database |
| pg-boss | Job queue (PostgreSQL-based) |

---

## 4. Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MANDA PLATFORM                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  manda-app (Next.js 16)                  │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │    │
│  │  │   Chat   │  │   Data   │  │Knowledge │  │   IRL    │ │    │
│  │  │Interface │  │   Room   │  │ Explorer │  │ Builder  │ │    │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │    │
│  │       │              │              │              │      │    │
│  │  ┌────▼──────────────▼──────────────▼──────────────▼────┐│    │
│  │  │              LangChain Agent (11 Tools)              ││    │
│  │  └──────────────────────────┬───────────────────────────┘│    │
│  └─────────────────────────────┼────────────────────────────┘    │
│                                │                                  │
│  ┌─────────────────────────────▼────────────────────────────┐    │
│  │                   API Routes (80+)                        │    │
│  └─────────────────────────────┬────────────────────────────┘    │
│                                │                                  │
├────────────────────────────────┼────────────────────────────────┤
│                                │                                  │
│  ┌──────────────┐  ┌───────────▼───────────┐  ┌──────────────┐  │
│  │     GCS      │  │      Supabase         │  │    Neo4j     │  │
│  │  Documents   │  │  PostgreSQL + pgvector │  │   Knowledge  │  │
│  │              │  │  + Auth + Realtime    │  │    Graph     │  │
│  └──────┬───────┘  └───────────┬───────────┘  └──────┬───────┘  │
│         │                      │                      │          │
│  ┌──────▼──────────────────────▼──────────────────────▼───────┐ │
│  │              manda-processing (FastAPI)                     │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │ │
│  │  │ Docling  │  │Embeddings│  │  Gemini  │  │Financial │    │ │
│  │  │ Parser   │  │ (OpenAI) │  │ Analysis │  │Extraction│    │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Document Upload** → GCS → Supabase metadata → pg-boss job queue
2. **Processing** → Docling parse → Chunk → Embed → LLM analyze → Store findings
3. **Knowledge Graph** → Neo4j stores entities, relationships, contradictions
4. **Chat** → LangChain agent queries all data sources via tools
5. **Realtime** → Supabase subscriptions push updates to UI

### Key Architectural Patterns

- **Server Components** for data fetching (React 19)
- **Route Handlers** for API endpoints (Next.js App Router)
- **Realtime Subscriptions** for live updates (Supabase)
- **Background Jobs** for async processing (pg-boss)
- **Knowledge Graph** for relationship queries (Neo4j)
- **Vector Search** for semantic similarity (pgvector)
- **Tool Calling** for AI agent capabilities (LangChain)

---

## 5. Data Models & Schema

### Database Tables (Supabase PostgreSQL)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `deals` | M&A projects/deals | id, name, user_id, metadata |
| `documents` | Uploaded files | id, deal_id, gcs_path, status |
| `document_chunks` | Parsed text chunks | id, document_id, content, embedding |
| `findings` | AI-extracted insights | id, deal_id, content, confidence, status |
| `contradictions` | Conflicting findings | id, finding_1_id, finding_2_id, resolution |
| `conversations` | Chat sessions | id, deal_id, title |
| `messages` | Chat messages | id, conversation_id, role, content |
| `irls` | Information Request Lists | id, deal_id, template_type |
| `irl_items` | IRL line items | id, irl_id, category, status |
| `qa_items` | Q&A questions/answers | id, deal_id, question, answer |
| `cims` | CIM documents | id, deal_id, content, slides |
| `folders` | Data room folders | id, deal_id, name, parent_id |
| `audit_logs` | Security audit trail | id, event_type, user_id, metadata |
| `finding_corrections` | User corrections | id, finding_id, original, corrected |
| `validation_feedback` | Validation actions | id, finding_id, action, reason |

### Neo4j Graph Schema

```cypher
// Nodes
(:Deal {id, name})
(:Document {id, name, type})
(:Finding {id, content, confidence, domain})
(:Entity {id, name, type})  // Companies, People, Metrics

// Relationships
(d:Document)-[:BELONGS_TO]->(deal:Deal)
(f:Finding)-[:EXTRACTED_FROM]->(d:Document)
(f:Finding)-[:MENTIONS]->(e:Entity)
(f1:Finding)-[:CONTRADICTS]->(f2:Finding)
(f:Finding)-[:RELATED_TO]->(f2:Finding)
```

### Migrations

39 SQL migrations in `manda-app/supabase/migrations/`:
- `00001` - Enable pgvector extension
- `00002-00009` - Core tables (deals, documents, findings, etc.)
- `00010-00020` - Enhancements (triggers, GCS columns, retry tracking)
- `00021-00039` - Features (contradictions, feedback, Q&A, CIMs)

---

## 6. API Reference

### Authentication (`/api/auth/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Email/password login |
| `/api/auth/logout` | POST | Sign out |
| `/api/auth/signup` | POST | User registration |

### Projects (`/api/projects/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects` | GET, POST | List/create projects |
| `/api/projects/[id]/chat` | POST | Chat with AI agent |
| `/api/projects/[id]/documents/lookup` | GET | Find documents |
| `/api/projects/[id]/findings` | GET, POST | List/create findings |
| `/api/projects/[id]/findings/search` | POST | Semantic search |
| `/api/projects/[id]/findings/[id]/validate` | POST | Validate finding |
| `/api/projects/[id]/contradictions` | GET | List contradictions |
| `/api/projects/[id]/gaps` | GET | List knowledge gaps |
| `/api/projects/[id]/conversations` | GET, POST | Chat conversations |
| `/api/projects/[id]/irls` | GET, POST | Information Request Lists |
| `/api/projects/[id]/qa` | GET, POST | Q&A items |
| `/api/projects/[id]/cims` | GET, POST | CIM documents |
| `/api/projects/[id]/folders` | GET, POST | Data room folders |
| `/api/projects/[id]/thresholds` | GET, PUT | Confidence thresholds |
| `/api/projects/[id]/audit` | GET | Audit trail |

### Documents (`/api/documents/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/documents/upload` | POST | Upload to GCS |
| `/api/documents/[id]` | GET, DELETE | Get/delete document |
| `/api/documents/[id]/retry` | POST | Retry failed processing |

### Processing (`/api/processing/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/processing/queue` | GET | View processing queue |
| `/api/processing/queue/[jobId]` | GET | Get job status |

### Health (`/api/health/`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Overall health check |
| `/api/health/neo4j` | GET | Neo4j connection status |
| `/api/health/pgboss` | GET | pg-boss queue status |

---

## 7. Component Library

### Core UI Components (`components/ui/`)

shadcn/ui primitives: Button, Input, Card, Dialog, Select, Tabs, Table, Badge, Label, Tooltip, Popover, ScrollArea, Progress, Switch, Checkbox, RadioGroup, Accordion, Alert, Avatar, Separator, Collapsible, DropdownMenu, Command (cmdk)

### Feature Components

#### Chat (`components/chat/`)
- `ChatInterface` - Main chat container
- `MessageList` / `MessageItem` - Message rendering
- `ChatInput` - Input with send button
- `CitationRenderer` - Source attribution display
- `ConfidenceBadge` - Confidence indicators
- `ToolIndicator` - Agent tool usage display
- `QuickActions` - Suggested actions
- `FollowUpSuggestions` - Next question prompts

#### Data Room (`components/data-room/`)
- `DocumentList` / `BucketItemList` - File browsers
- `UploadZone` / `UploadPanel` - Drag-drop upload
- `ProcessingQueue` / `ProcessingProgress` - Job status
- `Breadcrumb` - Navigation
- `FolderSelectDialog` - Folder picker

#### Knowledge Explorer (`components/knowledge-explorer/`)
- `FindingsBrowser` - Main findings interface
- `FindingCard` / `FindingsTable` - Display modes
- `FindingDetailPanel` - Full finding view
- `FindingFilters` / `FindingSearch` - Filtering
- `ValidationHistory` - Validation timeline
- `ContradictionsView` / `ContradictionCard` - Conflicts
- `GapAnalysisView` / `GapCard` - Missing info

#### IRL Builder (`components/irl/`)
- `IRLBuilder` - Main IRL interface
- `IRLTemplateSelector` - Template picker
- `IRLCategory` / `IRLItem` - Hierarchical items
- `IRLProgressBar` / `IRLProgressSummary` - Completion tracking
- `IRLExportDropdown` - Export options

#### CIM Builder (`components/cim-builder/`)
- `CIMBuilderLayout` - Three-panel layout
- `CIMListPage` / `CIMCard` - CIM management
- `SourcesPanel` - Source documents/findings
- `SlideNavigation` - Slide preview

#### Feedback (`components/feedback/`)
- `ReviewQueuePanel` - Items needing review
- `NeedsReviewBadge` - Visual indicator
- `AuditTrailExport` - Export audit logs

---

## 8. Testing Infrastructure

### Unit Tests (Vitest)

**Location:** `manda-app/__tests__/` + `*.test.ts` files
**Count:** ~55+ test files

**Categories:**
- API route tests (`__tests__/api/`)
- Hook tests (`__tests__/hooks/`, `__tests__/lib/hooks/`)
- Service tests (`__tests__/lib/services/`)
- Agent tests (`__tests__/lib/agent/`)
- LLM tests (`__tests__/llm/`)
- Component tests (`__tests__/components/`)
- Store tests (`__tests__/stores/`)

**Run:** `npm run test` or `npm run test:run`

### E2E Tests (Playwright)

**Location:** `manda-app/e2e/`
**Files:**
- `auth.setup.ts` - Authentication setup
- `data-room.spec.ts` - Data room workflows
- `irl-folder-generation.spec.ts` - IRL features
- `qa-suggestion-flow.spec.ts` - Q&A workflows

**Run:** `npm run test:e2e`

### Python Tests (pytest)

**Location:** `manda-processing/tests/`
**Structure:**
- `tests/unit/` - Unit tests
- `tests/integration/` - Integration tests

**Run:** `pytest` or `pytest --cov=src`

---

## 9. Development Guide

### Prerequisites

- Node.js 20 LTS+
- Python 3.12+
- Docker (for local Neo4j)
- Supabase account
- Google Cloud project (GCS)

### Quick Start

```bash
# Frontend
cd manda-app
cp .env.example .env.local
npm install
npm run dev

# Backend
cd manda-processing
cp .env.example .env
pip install -e ".[dev]"
uvicorn src.main:app --reload

# Worker (separate terminal)
python -m src.jobs
```

### Environment Variables

**manda-app:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side key
- `GCS_BUCKET` - GCS bucket name
- `GOOGLE_APPLICATION_CREDENTIALS` - GCS key path
- `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` - Neo4j
- `LLM_PROVIDER` - anthropic/openai/google
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_AI_API_KEY`

**manda-processing:**
- `DATABASE_URL` - PostgreSQL connection string
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `API_KEY` - Internal API authentication
- `GCS_BUCKET`, `GCS_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS`
- `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`
- `OPENAI_API_KEY` - For embeddings
- `GOOGLE_API_KEY` - For Gemini analysis

### NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run type-check` | TypeScript validation |
| `npm run lint` | ESLint |
| `npm run test` | Vitest watch mode |
| `npm run test:run` | Vitest single run |
| `npm run test:e2e` | Playwright E2E |
| `npm run db:types` | Regenerate Supabase types |
| `npm run db:push` | Push migrations |

---

## 10. Documentation Index

### Core Documents

| Document | Path | Description |
|----------|------|-------------|
| PRD | [docs/manda-prd.md](manda-prd.md) | Product requirements |
| Architecture | [docs/manda-architecture.md](manda-architecture.md) | System architecture |
| Test Design | [docs/test-design-system.md](test-design-system.md) | Testing strategy |
| Agent Spec | [docs/agent-behavior-spec.md](agent-behavior-spec.md) | AI agent behavior |
| UX Design | [docs/ux-design-specification.md](ux-design-specification.md) | User experience |

### Diagrams

| Diagram | Path |
|---------|------|
| Architecture | [docs/diagrams/manda-platform-architecture.excalidraw](diagrams/manda-platform-architecture.excalidraw) |
| Data Flow | [docs/diagrams/manda-platform-dataflow.excalidraw](diagrams/manda-platform-dataflow.excalidraw) |
| Wireframes | [docs/diagrams/manda-platform-wireframe.excalidraw](diagrams/manda-platform-wireframe.excalidraw) |
| Flowchart | [docs/diagrams/manda-platform-flowchart.excalidraw](diagrams/manda-platform-flowchart.excalidraw) |

### Sprint Artifacts

| Type | Location | Count |
|------|----------|-------|
| Epics | [docs/sprint-artifacts/epics/](sprint-artifacts/epics/) | 7 files |
| Tech Specs | [docs/sprint-artifacts/tech-specs/](sprint-artifacts/tech-specs/) | 8 files |
| Stories | [docs/sprint-artifacts/stories/](sprint-artifacts/stories/) | 90+ files |
| Retrospectives | [docs/sprint-artifacts/retrospectives/](sprint-artifacts/retrospectives/) | 7 files |

### READMEs

| Component | Path |
|-----------|------|
| Frontend | [manda-app/README.md](../manda-app/README.md) |
| Backend | [manda-processing/README.md](../manda-processing/README.md) |
| Supabase | [manda-app/supabase/README.md](../manda-app/supabase/README.md) |

---

## Quick Reference

### Key Paths

```
Source Code:
├── manda-app/app/           # Next.js pages & API routes
├── manda-app/components/    # React components
├── manda-app/lib/           # Core libraries
├── manda-processing/src/    # Python backend

Configuration:
├── manda-app/tsconfig.json
├── manda-app/vitest.config.ts
├── manda-app/playwright.config.ts
├── manda-processing/pyproject.toml

Database:
├── manda-app/supabase/migrations/
├── manda-app/lib/supabase/database.types.ts
├── manda-app/lib/neo4j/schema.ts
```

### LLM Configuration

**Default Provider:** Anthropic (Claude Sonnet 4.5)
**Supported:** Anthropic, OpenAI, Google (Gemini)
**Agent Tools:** 11 tools for knowledge queries, corrections, Q&A, IRL, etc.

### Port Assignments

| Service | Port |
|---------|------|
| Next.js Dev | 3000 |
| FastAPI | 8000 |
| Neo4j Bolt | 7687 |
| Neo4j Browser | 7474 |

---

*This index was generated by the BMAD Document Project workflow (Exhaustive Scan) on 2025-12-13*
