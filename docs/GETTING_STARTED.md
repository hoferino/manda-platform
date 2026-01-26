# Getting Started

---
title: Developer Onboarding Guide
status: Current
audience: New developers, contractors
last-updated: 2026-01-26
---

Welcome to the Manda platform. This guide helps you get productive quickly.

## First Week Path

### Day 1: Understand the Product

1. **Read the PRD** - [manda-prd.md](manda-prd.md) (v2.4)
   - Focus on: Vision, Problem Statement, Core Features (sections 1-4)
   - Skip for now: Detailed FRs (section 5+)

2. **Understand the users** - M&A analysts at investment banks who:
   - Process hundreds of documents per deal
   - Extract findings, track Q&A, create CIMs
   - Need AI assistance, not AI replacement

### Day 2: Understand the Architecture

1. **Read the architecture doc** - [manda-architecture.md](manda-architecture.md) (v4.3)
   - Two services: `manda-app` (Next.js) + `manda-processing` (FastAPI)
   - Supabase PostgreSQL + Neo4j (Graphiti) for data
   - Key: E10 migrated from pgvector to Graphiti for embeddings

2. **Key decisions to know:**
   - [SCP-003](decisions/sprint-change-proposal-2025-12-15.md) - E10 Graphiti migration
   - [ADR-001](architecture-decisions/adr-001-graphiti-migration.md) - Why we chose Graphiti

### Day 3: Set Up Development Environment

**Frontend (manda-app):**
```bash
cd manda-app
npm install
cp .env.example .env.local  # Fill in values
npm run dev                  # Port 3000
```

**Backend (manda-processing):**
```bash
cd manda-processing
python -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env         # Fill in values
uvicorn src.main:app --reload --port 8000
```

**Infrastructure:**
```bash
docker-compose -f docker-compose.dev.yml up -d  # Neo4j
```

See [deployment/gcp-setup-guide.md](deployment/gcp-setup-guide.md) for GCS configuration.

### Day 4: Explore the Codebase

**Start with these entry points:**

| Area | Location | What it does |
|------|----------|--------------|
| Frontend routing | `manda-app/app/` | Next.js App Router pages |
| Agent system | `manda-app/lib/agent/` | LangGraph agents, tools |
| API routes | `manda-app/app/api/` | Backend-for-frontend APIs |
| Job handlers | `manda-processing/src/jobs/` | Background processing |
| Graphiti service | `manda-processing/src/services/graphiti_service.py` | Knowledge graph |

**Read the CLAUDE.md files:**
- Root [CLAUDE.md](../CLAUDE.md) - Project overview, commands
- [manda-app/CLAUDE.md](../manda-app/CLAUDE.md) - Frontend patterns
- [manda-processing/CLAUDE.md](../manda-processing/CLAUDE.md) - Backend patterns
- [manda-app/lib/agent/CLAUDE.md](../manda-app/lib/agent/CLAUDE.md) - Agent implementation

### Day 5: Make Your First Change

1. Pick a small issue or story from [sprint-artifacts/active/](sprint-artifacts/active/)
2. Run the tests to verify setup:
   ```bash
   # Frontend
   cd manda-app && npm run test:run

   # Backend
   cd manda-processing && pytest
   ```
3. Make your change, run linters:
   ```bash
   # Frontend
   npm run lint && npm run type-check

   # Backend
   ruff check . && mypy src
   ```

---

## Key Concepts

### Document Processing Pipeline

```
Upload → GCS → Webhook → pg-boss Queue → Workers
                              ↓
        document-parse (Docling) → ingest-graphiti (Voyage)
                              ↓
        analyze-document (Gemini) → extract-financials
```

### Knowledge Graph (Graphiti + Neo4j)

- **Voyage embeddings** (voyage-3.5, 1024 dimensions)
- **Hybrid search**: Vector + BM25 + graph traversal
- **Entity types**: Company, Person, Document, Finding, etc.
- **Temporal facts**: Valid time tracking for contradictions

### Agent System

- **LangGraph** for orchestration
- **Two modes**: Chat v2 (general Q&A) and CIM Builder (document creation)
- See [features/agent-system/](features/agent-system/) for details

---

## Project Status

| Source | What it tells you |
|--------|-------------------|
| [.planning/PROJECT.md](../.planning/PROJECT.md) | Current milestone, version, constraints |
| [decisions/README.md](decisions/README.md) | All architectural decisions |
| [manda-prd.md](manda-prd.md) section 1 | Epic completion status |

**Current state:** E1-E11 complete, E12 (Production Readiness) in progress, E13 (Agent Orchestration) planned.

---

## Getting Help

- **Codebase questions**: Check relevant CLAUDE.md files first
- **Architecture questions**: [manda-architecture.md](manda-architecture.md)
- **Decision history**: [decisions/](decisions/)
- **Feature docs**: [features/](features/)

---

## Common Pitfalls

| Mistake | Correct approach |
|---------|------------------|
| Looking for pgvector code | Removed in E10 - use Graphiti service |
| Using OpenAI embeddings | We use Voyage voyage-3.5 |
| Direct Neo4j queries | Use Graphiti service layer |
| Editing `.planning/` files | GSD-managed - don't manually edit |
